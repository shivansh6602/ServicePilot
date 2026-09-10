import express from 'express';
import dotenv from 'dotenv';
import customerRoutes from '../routes/customer.routes.js';
import * as authService from '../services/auth.service.js';
import prisma from '../config/prisma.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/customers', customerRoutes);

const request = (url, token, options = {}) => fetch(url, {
  ...options,
  headers: {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  },
});

async function createOwner(name) {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return authService.registerTenant({
    businessName: `${name} Business`,
    name: `${name} Owner`,
    email: `${name.toLowerCase()}_${suffix}@example.com`,
    password: 'Password123!',
  });
}

async function runCustomerTests() {
  console.log('Starting Phase 3 Customer Management Integration Tests...\n');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/customers`;
  const createdBusinessIds = [];

  try {
    const tenantA = await createOwner('TenantA');
    const tenantB = await createOwner('TenantB');
    createdBusinessIds.push(tenantA.business.id, tenantB.business.id);

    console.log('Test 1: owner creates a customer');
    const createResponse = await request(baseUrl, tenantA.accessToken, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Ada Lovelace',
        phone: '+1 555 0100',
        email: 'ADA@EXAMPLE.COM',
        address: '1 Analytical Engine Way',
        notes: 'Prefers morning visits',
      }),
    });
    const createData = await createResponse.json();
    if (createResponse.status !== 201 || createData.data.customer.businessId !== tenantA.business.id) {
      throw new Error(`Customer creation failed: ${JSON.stringify(createData)}`);
    }
    const customer = createData.data.customer;
    if (customer.email !== 'ada@example.com') throw new Error('Customer email was not normalized');
    console.log('Passed');

    console.log('Test 2: list and search only return the requesting tenant records');
    const tenantBCustomer = await request(baseUrl, tenantB.accessToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Grace Hopper', phone: '+1 555 0200' }),
    });
    if (tenantBCustomer.status !== 201) throw new Error('Failed to create Tenant B customer');
    const listResponse = await request(baseUrl, tenantA.accessToken);
    const listData = await listResponse.json();
    if (listResponse.status !== 200 || listData.data.customers.length !== 1 || listData.data.customers[0].id !== customer.id) {
      throw new Error(`Tenant-scoped listing failed: ${JSON.stringify(listData)}`);
    }
    const searchResponse = await request(`${baseUrl}?search=lovelace`, tenantA.accessToken);
    const searchData = await searchResponse.json();
    if (searchResponse.status !== 200 || searchData.data.customers.length !== 1 || searchData.data.customers[0].id !== customer.id) {
      throw new Error(`Customer search failed: ${JSON.stringify(searchData)}`);
    }
    console.log('Passed');

    console.log('Test 3: detail includes customer job service history');
    const job = await prisma.job.create({
      data: {
        businessId: tenantA.business.id,
        customerId: customer.id,
        problemDescription: 'Repair water heater',
        status: 'COMPLETED',
        serviceCharge: 150,
      },
    });
    await prisma.job.create({
      data: {
        businessId: tenantB.business.id,
        customerId: customer.id,
        problemDescription: 'Must not appear in Tenant A history',
        status: 'COMPLETED',
      },
    });
    const detailResponse = await request(`${baseUrl}/${customer.id}`, tenantA.accessToken);
    const detailData = await detailResponse.json();
    if (detailResponse.status !== 200 || detailData.data.customer.jobs.length !== 1 || detailData.data.customer.jobs[0].id !== job.id) {
      throw new Error(`Customer detail/history failed: ${JSON.stringify(detailData)}`);
    }
    const historyResponse = await request(`${baseUrl}/${customer.id}/history`, tenantA.accessToken);
    const historyData = await historyResponse.json();
    if (historyResponse.status !== 200 || historyData.data.jobs[0]?.id !== job.id) {
      throw new Error(`Customer history endpoint failed: ${JSON.stringify(historyData)}`);
    }
    console.log('Passed');

    console.log('Test 4: owner updates a customer; invalid data is rejected');
    const updateResponse = await request(`${baseUrl}/${customer.id}`, tenantA.accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'Gate code: 1234' }),
    });
    const updateData = await updateResponse.json();
    if (updateResponse.status !== 200 || updateData.data.customer.notes !== 'Gate code: 1234') {
      throw new Error(`Customer update failed: ${JSON.stringify(updateData)}`);
    }
    const invalidResponse = await request(baseUrl, tenantA.accessToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'A', phone: 'bad' }),
    });
    if (invalidResponse.status !== 400) throw new Error(`Expected validation failure, got ${invalidResponse.status}`);
    console.log('Passed');

    console.log('Test 5: cross-tenant detail, update, and history are hidden');
    for (const [method, path, body] of [
      ['GET', `${baseUrl}/${customer.id}`, undefined],
      ['GET', `${baseUrl}/${customer.id}/history`, undefined],
      ['PATCH', `${baseUrl}/${customer.id}`, JSON.stringify({ name: 'Attempted takeover' })],
    ]) {
      const response = await request(path, tenantB.accessToken, { method, body });
      if (response.status !== 404) throw new Error(`Expected cross-tenant ${method} to return 404, got ${response.status}`);
    }
    console.log('Passed');

    console.log('Test 6: authentication and OWNER authorization are required');
    const unauthenticated = await request(baseUrl, null);
    if (unauthenticated.status !== 401) throw new Error(`Expected 401, got ${unauthenticated.status}`);
    const technician = await prisma.user.create({
      data: {
        businessId: tenantA.business.id,
        email: `technician_${Date.now()}@example.com`,
        passwordHash: 'not-used-by-this-test',
        name: 'Technician',
        role: 'TECHNICIAN',
      },
    });
    const technicianToken = authService.generateAccessToken({
      userId: technician.id,
      businessId: technician.businessId,
      role: technician.role,
    });
    const forbidden = await request(baseUrl, technicianToken);
    if (forbidden.status !== 403) throw new Error(`Expected 403, got ${forbidden.status}`);
    console.log('Passed');

    console.log('\nAll customer management integration tests passed.');
  } catch (error) {
    console.error(`\nCustomer test suite failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    for (const businessId of createdBusinessIds) {
      await prisma.business.delete({ where: { id: businessId } }).catch(() => {});
    }
    server.close();
    await prisma.$disconnect();
  }
}

runCustomerTests();
