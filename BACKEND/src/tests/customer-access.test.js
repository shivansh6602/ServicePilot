import assert from 'node:assert/strict';
import express from 'express';
import prisma from '../config/prisma.js';
import customerAccessRoutes from '../routes/customer-access.routes.js';

const app = express();
app.use('/api/customer-portal', customerAccessRoutes);

const originalFindToken = prisma.customerAccessToken.findUnique;
const originalFindJob = prisma.job.findFirst;

let storedToken;
let portalJob;
let jobQuery;

prisma.customerAccessToken.findUnique = async () => storedToken;
prisma.job.findFirst = async (query) => {
  jobQuery = query;
  return portalJob;
};

const request = async (baseUrl, token) => fetch(`${baseUrl}/api/customer-portal/job`, {
  headers: { Authorization: `Bearer ${token}` },
});

const startServer = () => new Promise((resolve) => {
  const server = app.listen(0, '127.0.0.1', () => {
    const { port } = server.address();
    resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
  });
});

try {
  const { server, baseUrl } = await startServer();
  try {
    storedToken = {
      id: 'access-token-id',
      jobId: 'job-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    };
    portalJob = {
      id: 'job-1',
      status: 'COMPLETED',
      problemDescription: 'Repair water heater',
      scheduledAt: null,
      serviceCharge: 100,
      discount: 0,
      problemFound: 'Failed heating element',
      workPerformed: 'Replaced heating element',
      completionNotes: null,
      parts: [{ name: 'Heating element', quantity: 1, unitCost: 50 }],
      charges: [{ title: 'Labour', amount: 50 }],
      photos: [{ type: 'AFTER', photoUrl: 'https://example.test/after.jpg', caption: null }],
    };

    const validResponse = await request(baseUrl, 'valid-token');
    assert.equal(validResponse.status, 200);
    assert.deepEqual((await validResponse.json()).data.job, portalJob);
    assert.deepEqual(jobQuery.where, { id: 'job-1' });
    assert.equal('businessId' in jobQuery.select, false);
    assert.equal('customerId' in jobQuery.select, false);
    assert.equal('technicianId' in jobQuery.select, false);
    assert.equal('payments' in jobQuery.select, false);
    assert.equal('customer' in jobQuery.select, false);

    jobQuery = undefined;
    storedToken = { ...storedToken, revokedAt: new Date() };
    const revokedResponse = await request(baseUrl, 'revoked-token');
    assert.equal(revokedResponse.status, 401);
    assert.equal(jobQuery, undefined);

    storedToken = {
      ...storedToken,
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1),
    };
    const expiredResponse = await request(baseUrl, 'expired-token');
    assert.equal(expiredResponse.status, 401);
    assert.equal(jobQuery, undefined);

    storedToken = {
      ...storedToken,
      expiresAt: new Date(Date.now() + 60_000),
    };
    portalJob = null;
    const missingJobResponse = await request(baseUrl, 'orphaned-job-token');
    assert.equal(missingJobResponse.status, 404);

    console.log('Customer portal scoped-read tests passed.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
} finally {
  prisma.customerAccessToken.findUnique = originalFindToken;
  prisma.job.findFirst = originalFindJob;
  await prisma.$disconnect();
}
