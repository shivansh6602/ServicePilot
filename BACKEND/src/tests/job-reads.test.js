import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import jobRoutes from '../routes/job.routes.js';

process.env.JWT_ACCESS_SECRET = 'job-read-test-secret';

const ownerId = '11111111-1111-4111-8111-111111111111';
const technicianId = '22222222-2222-4222-8222-222222222222';
const otherTechnicianId = '33333333-3333-4333-8333-333333333333';
const businessId = '44444444-4444-4444-8444-444444444444';
const otherBusinessId = '55555555-5555-4555-8555-555555555555';
const jobId = '66666666-6666-4666-8666-666666666666';

const app = express();
app.use('/api/jobs', jobRoutes);

const originals = {
  findMany: prisma.job.findMany,
  findFirst: prisma.job.findFirst,
  historyFindMany: prisma.jobStatusHistory.findMany,
};
const queries = [];
let firstResult = null;

prisma.job.findMany = async (query) => {
  queries.push({ method: 'findMany', query });
  return [{ id: jobId, status: 'ASSIGNED', customer: { id: 'customer-1', name: 'Customer', phone: '123', address: null }, technician: { id: technicianId, name: 'Tech' } }];
};
prisma.job.findFirst = async (query) => {
  queries.push({ method: 'findFirst', query });
  return firstResult;
};
prisma.jobStatusHistory.findMany = async (query) => {
  queries.push({ method: 'historyFindMany', query });
  return [{ id: 'history-1', fromStatus: 'REQUESTED', toStatus: 'ASSIGNED', reason: null, createdAt: new Date(), changedBy: { id: ownerId, name: 'Owner', role: 'OWNER' } }];
};

const tokenFor = (userId, tenantId, role) => jwt.sign(
  { userId, businessId: tenantId, role },
  process.env.JWT_ACCESS_SECRET,
  { expiresIn: '5m' },
);
const request = (baseUrl, path, token) => fetch(`${baseUrl}${path}`, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});
const startServer = () => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => {
    resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
  });
});

try {
  const { server, baseUrl } = await startServer();
  try {
    const ownerToken = tokenFor(ownerId, businessId, 'OWNER');
    const technicianToken = tokenFor(technicianId, businessId, 'TECHNICIAN');

    let response = await request(baseUrl, '/api/jobs', ownerToken);
    assert.equal(response.status, 200);
    assert.deepEqual(queries.pop().query.where, { businessId });

    firstResult = { id: jobId, status: 'ASSIGNED', customer: { id: 'customer-1', name: 'Customer', phone: '123', address: null }, technician: { id: technicianId, name: 'Tech' }, parts: [], charges: [], photos: [] };
    response = await request(baseUrl, `/api/jobs/${jobId}`, ownerToken);
    assert.equal(response.status, 200);
    const ownerDetailQuery = queries.pop().query;
    assert.deepEqual(ownerDetailQuery.where, { id: jobId, businessId });
    assert.equal('businessId' in ownerDetailQuery.select, false);
    assert.equal('customerId' in ownerDetailQuery.select, false);
    assert.equal('technicianId' in ownerDetailQuery.select, false);
    assert.equal('payments' in ownerDetailQuery.select, false);
    assert.equal('workNotes' in ownerDetailQuery.select, false);

    firstResult = { id: jobId };
    response = await request(baseUrl, `/api/jobs/${jobId}/status-history`, ownerToken);
    assert.equal(response.status, 200);
    assert.deepEqual(queries.shift().query.where, { id: jobId, businessId });
    assert.deepEqual(queries.pop().query.where, { jobId });

    response = await request(baseUrl, '/api/jobs/assigned', technicianToken);
    assert.equal(response.status, 200);
    assert.deepEqual(queries.pop().query.where, { businessId, technicianId });

    firstResult = { id: jobId, status: 'ASSIGNED', customer: { id: 'customer-1', name: 'Customer', phone: '123', address: null }, technician: { id: technicianId, name: 'Tech' }, parts: [], charges: [], photos: [] };
    response = await request(baseUrl, `/api/jobs/assigned/${jobId}`, technicianToken);
    assert.equal(response.status, 200);
    assert.deepEqual(queries.pop().query.where, { id: jobId, businessId, technicianId });

    firstResult = null;
    response = await request(baseUrl, `/api/jobs/${jobId}`, tokenFor(ownerId, otherBusinessId, 'OWNER'));
    assert.equal(response.status, 404);
    assert.deepEqual(queries.pop().query.where, { id: jobId, businessId: otherBusinessId });

    response = await request(baseUrl, `/api/jobs/assigned/${jobId}`, tokenFor(otherTechnicianId, businessId, 'TECHNICIAN'));
    assert.equal(response.status, 404);
    assert.deepEqual(queries.pop().query.where, { id: jobId, businessId, technicianId: otherTechnicianId });

    assert.equal((await request(baseUrl, '/api/jobs')).status, 401);
    assert.equal((await request(baseUrl, '/api/jobs/assigned', ownerToken)).status, 403);
    assert.equal((await request(baseUrl, '/api/jobs', technicianToken)).status, 403);
    console.log('Job read authorization tests passed.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
} finally {
  prisma.job.findMany = originals.findMany;
  prisma.job.findFirst = originals.findFirst;
  prisma.jobStatusHistory.findMany = originals.historyFindMany;
  await prisma.$disconnect();
}
