import express from 'express';
import dotenv from 'dotenv';
import jobRoutes from '../routes/job.routes.js';
import * as authService from '../services/auth.service.js';
import * as jobService from '../services/job.service.js';
import prisma from '../config/prisma.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/jobs', jobRoutes);

const request = (url, token, options = {}) => fetch(url, {
  ...options,
  headers: {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  },
});

const createOwner = async (name) => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return authService.registerTenant({
    businessName: `${name} Business`, name: `${name} Owner`,
    email: `${name.toLowerCase()}_${suffix}@example.com`, password: 'Password123!',
  });
};

const createTechnician = async (businessId, name) => prisma.user.create({
  data: {
    businessId, name, role: 'TECHNICIAN', passwordHash: 'unused',
    email: `${name.toLowerCase()}_${Date.now()}_${Math.random().toString(36).slice(2)}@example.com`,
  },
});

async function runJobTests() {
  console.log('Starting Phase 5 Job Workflow Integration Tests...\n');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/jobs`;
  const businesses = [];

  try {
    const tenantA = await createOwner('JobsTenantA');
    const tenantB = await createOwner('JobsTenantB');
    businesses.push(tenantA.business.id, tenantB.business.id);
    const customerA = await prisma.customer.create({ data: { businessId: tenantA.business.id, name: 'A Customer', phone: `+1555${Date.now()}` } });
    const customerB = await prisma.customer.create({ data: { businessId: tenantB.business.id, name: 'B Customer', phone: `+1666${Date.now()}` } });
    const technicianA = await createTechnician(tenantA.business.id, 'Jobs Tech A');
    const technicianA2 = await createTechnician(tenantA.business.id, 'Jobs Tech A2');
    const technicianB = await createTechnician(tenantB.business.id, 'Jobs Tech B');
    const nonTechnician = await prisma.user.create({
      data: { businessId: tenantA.business.id, name: 'Extra Owner', role: 'OWNER', passwordHash: 'unused', email: `extra_owner_${Date.now()}@example.com` },
    });
    const technicianAToken = authService.generateAccessToken({ userId: technicianA.id, businessId: tenantA.business.id, role: 'TECHNICIAN' });
    const technicianA2Token = authService.generateAccessToken({ userId: technicianA2.id, businessId: tenantA.business.id, role: 'TECHNICIAN' });
    const technicianBToken = authService.generateAccessToken({ userId: technicianB.id, businessId: tenantB.business.id, role: 'TECHNICIAN' });

    console.log('Test 1: owner creates a tenant-scoped requested job; validation rejects protected fields');
    const createResponse = await request(baseUrl, tenantA.accessToken, { method: 'POST', body: JSON.stringify({ customerId: customerA.id, problemDescription: 'Repair water heater', serviceCharge: 100, businessId: tenantB.business.id }) });
    if (createResponse.status !== 400) throw new Error(`Expected protected businessId rejection, got ${createResponse.status}`);
    const validCreate = await request(baseUrl, tenantA.accessToken, { method: 'POST', body: JSON.stringify({ customerId: customerA.id, problemDescription: 'Repair water heater', serviceCharge: 100 }) });
    const validData = await validCreate.json();
    if (validCreate.status !== 201 || validData.data.job.businessId !== tenantA.business.id || validData.data.job.status !== 'REQUESTED') throw new Error(`Job creation failed: ${JSON.stringify(validData)}`);
    const job = validData.data.job;
    if ((await request(baseUrl, null, { method: 'POST', body: '{}' })).status !== 401) throw new Error('Unauthenticated creation was allowed');
    for (const customerId of ['not-a-uuid', customerB.id]) {
      const response = await request(baseUrl, tenantA.accessToken, { method: 'POST', body: JSON.stringify({ customerId, problemDescription: 'Bad customer' }) });
      if (![400, 404].includes(response.status)) throw new Error(`Invalid/cross-tenant customer was accepted: ${response.status}`);
    }
    console.log('Passed');

    console.log('Test 2: only owner assigns a same-tenant technician and assignment is audited');
    const assignResponse = await request(`${baseUrl}/${job.id}/assign`, tenantA.accessToken, { method: 'PATCH', body: JSON.stringify({ technicianId: technicianA.id }) });
    const assignedData = await assignResponse.json();
    if (assignResponse.status !== 200 || assignedData.data.job.status !== 'ASSIGNED' || assignedData.data.job.technicianId !== technicianA.id) throw new Error(`Assignment failed: ${JSON.stringify(assignedData)}`);
    const assignmentHistory = await prisma.jobStatusHistory.findMany({ where: { jobId: job.id } });
    if (assignmentHistory.length !== 1 || assignmentHistory[0].fromStatus !== 'REQUESTED' || assignmentHistory[0].toStatus !== 'ASSIGNED' || assignmentHistory[0].changedById !== tenantA.user.id) throw new Error('Assignment history is incorrect');
    for (const technicianId of [technicianB.id, nonTechnician.id]) {
      const fresh = await prisma.job.create({ data: { businessId: tenantA.business.id, customerId: customerA.id, problemDescription: 'Assignment validation' } });
      const response = await request(`${baseUrl}/${fresh.id}/assign`, tenantA.accessToken, { method: 'PATCH', body: JSON.stringify({ technicianId }) });
      if (response.status !== 404) throw new Error(`Invalid assignment expected 404, got ${response.status}`);
    }
    const technicianAssignment = await request(`${baseUrl}/${job.id}/assign`, technicianAToken, { method: 'PATCH', body: JSON.stringify({ technicianId: technicianA.id }) });
    if (technicianAssignment.status !== 403) throw new Error('Technician assignment was allowed');
    console.log('Passed');

    console.log('Test 3: assigned technician can make only valid state transitions, with correct history actor');
    const transition = await request(`${baseUrl}/${job.id}/status`, technicianAToken, { method: 'PATCH', body: JSON.stringify({ status: 'ON_THE_WAY' }) });
    const transitionData = await transition.json();
    if (transition.status !== 200 || transitionData.data.job.status !== 'ON_THE_WAY') throw new Error(`Valid transition failed: ${JSON.stringify(transitionData)}`);
    const history = await prisma.jobStatusHistory.findMany({ where: { jobId: job.id }, orderBy: { createdAt: 'asc' } });
    if (history.length !== 2 || history[1].fromStatus !== 'ASSIGNED' || history[1].toStatus !== 'ON_THE_WAY' || history[1].changedById !== technicianA.id) throw new Error('Transition history is incorrect');
    const invalidTransition = await request(`${baseUrl}/${job.id}/status`, technicianAToken, { method: 'PATCH', body: JSON.stringify({ status: 'COMPLETED' }) });
    if (invalidTransition.status !== 409) throw new Error(`Expected invalid transition 409, got ${invalidTransition.status}`);
    const invalidStatus = await request(`${baseUrl}/${job.id}/status`, technicianAToken, { method: 'PATCH', body: JSON.stringify({ status: 'NOT_A_STATUS' }) });
    if (invalidStatus.status !== 400) throw new Error(`Expected invalid status 400, got ${invalidStatus.status}`);
    console.log('Passed');

    console.log('Test 4: technician and tenant resource authorization are enforced');
    for (const [token, expected] of [[technicianA2Token, 403], [technicianBToken, 404]]) {
      const response = await request(`${baseUrl}/${job.id}/status`, token, { method: 'PATCH', body: JSON.stringify({ status: 'IN_PROGRESS' }) });
      if (response.status !== expected) throw new Error(`Expected technician authorization ${expected}, got ${response.status}`);
    }
    const ownerTransition = await request(`${baseUrl}/${job.id}/status`, tenantA.accessToken, { method: 'PATCH', body: JSON.stringify({ status: 'IN_PROGRESS' }) });
    if (ownerTransition.status !== 200) throw new Error('Owner could not operate on own tenant job');
    const completed = await request(`${baseUrl}/${job.id}/status`, technicianAToken, { method: 'PATCH', body: JSON.stringify({ status: 'COMPLETED' }) });
    if (completed.status !== 200) throw new Error('Completion failed');
    const terminal = await request(`${baseUrl}/${job.id}/status`, tenantA.accessToken, { method: 'PATCH', body: JSON.stringify({ status: 'CONFIRMED' }) });
    if (terminal.status !== 409) throw new Error(`Terminal transition should be rejected, got ${terminal.status}`);
    console.log('Passed');

    console.log('Test 5: history failure rolls back the status update');
    const rollbackJob = await prisma.job.create({ data: { businessId: tenantA.business.id, customerId: customerA.id, technicianId: technicianA.id, status: 'ASSIGNED', problemDescription: 'Rollback test' } });
    try {
      await jobService.updateJobStatus(tenantA.business.id, { userId: '00000000-0000-0000-0000-000000000000', role: 'OWNER' }, rollbackJob.id, 'ON_THE_WAY');
      throw new Error('Expected status history foreign-key failure');
    } catch (err) {
      if (err.message === 'Expected status history foreign-key failure') throw err;
    }
    const rolledBackJob = await prisma.job.findUnique({ where: { id: rollbackJob.id } });
    const rolledBackHistory = await prisma.jobStatusHistory.count({ where: { jobId: rollbackJob.id } });
    if (rolledBackJob.status !== 'ASSIGNED' || rolledBackHistory !== 0) throw new Error('Status update was not rolled back with failed history');
    console.log('Passed');

    console.log('\nAll Phase 5 Job Workflow integration tests passed.');
  } catch (err) {
    console.error(`\nJob test suite failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    for (const id of businesses) await prisma.business.delete({ where: { id } }).catch(() => {});
    server.close();
    await prisma.$disconnect();
  }
}

runJobTests();
