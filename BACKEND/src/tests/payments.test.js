import express from 'express';
import dotenv from 'dotenv';
import jobRoutes from '../routes/job.routes.js';
import * as authService from '../services/auth.service.js';
import * as paymentService from '../services/payment.service.js';
import prisma from '../config/prisma.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use('/api/jobs', jobRoutes);

const request = (url, token, options = {}) => fetch(url, {
  ...options,
  headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
});

const createOwner = async (name) => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return authService.registerTenant({
    businessName: `${name} Business`, name: `${name} Owner`,
    email: `${name}_${suffix}@example.com`, password: 'Password123!',
  });
};

async function runPaymentTests() {
  console.log('Starting Phase 7 Payment integration tests...\n');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/jobs`;
  const businesses = [];
  try {
    const tenantA = await createOwner('PaymentsA');
    const tenantB = await createOwner('PaymentsB');
    businesses.push(tenantA.business.id, tenantB.business.id);
    const customerA = await prisma.customer.create({ data: { businessId: tenantA.business.id, name: 'Customer A', phone: `+1555${Date.now()}` } });
    const customerB = await prisma.customer.create({ data: { businessId: tenantB.business.id, name: 'Customer B', phone: `+1666${Date.now()}` } });
    const techA = await prisma.user.create({ data: { businessId: tenantA.business.id, name: 'Tech A', role: 'TECHNICIAN', passwordHash: 'unused', email: `pay_tech_${Date.now()}@example.com` } });
    const techAToken = authService.generateAccessToken({ userId: techA.id, businessId: tenantA.business.id, role: 'TECHNICIAN' });

    const createCompletedJob = async (customerId = customerA.id, businessId = tenantA.business.id) => prisma.job.create({
      data: {
        businessId, customerId, status: 'COMPLETED', problemDescription: 'Payment test', serviceCharge: 100, discount: 10,
        parts: { create: [{ name: 'Part', quantity: 2, unitCost: 15 }] },
        charges: { create: [{ title: 'Labour', amount: 20 }] },
      },
    });

    console.log('Test 1: payment and receipt totals are computed from stored job data');
    const job = await createCompletedJob(); // 100 + (2 * 15) + 20 - 10 = 140
    const first = await request(`${baseUrl}/${job.id}/payments`, tenantA.accessToken, { method: 'POST', body: JSON.stringify({ amount: 40, paymentMethod: 'CASH', notes: 'Deposit' }) });
    const firstData = await first.json();
    if (first.status !== 201 || firstData.data.receipt.totals.total !== 140 || firstData.data.receipt.totals.paid !== 40 || firstData.data.receipt.totals.pending !== 100 || firstData.data.receipt.totals.paymentStatus !== 'PARTIALLY_PAID') throw new Error(`Incorrect first payment totals: ${JSON.stringify(firstData)}`);
    const second = await request(`${baseUrl}/${job.id}/payments`, tenantA.accessToken, { method: 'POST', body: JSON.stringify({ amount: 100, paymentMethod: 'UPI' }) });
    const secondData = await second.json();
    if (second.status !== 201 || secondData.data.receipt.totals.paid !== 140 || secondData.data.receipt.totals.pending !== 0 || secondData.data.receipt.totals.paymentStatus !== 'PAID' || secondData.data.receipt.job.status !== 'PAID') throw new Error(`Incorrect final payment totals: ${JSON.stringify(secondData)}`);
    const receiptResponse = await request(`${baseUrl}/${job.id}/receipt`, tenantA.accessToken);
    const receiptData = await receiptResponse.json();
    if (receiptResponse.status !== 200 || receiptData.data.receipt.payments.length !== 2 || receiptData.data.receipt.parts[0].total !== 30 || receiptData.data.receipt.totals.total !== 140) throw new Error(`Stored receipt does not match data: ${JSON.stringify(receiptData)}`);
    const paymentHistory = await prisma.jobStatusHistory.findFirst({ where: { jobId: job.id, toStatus: 'PAID' } });
    if (!paymentHistory || paymentHistory.fromStatus !== 'COMPLETED' || paymentHistory.changedById !== tenantA.user.id) throw new Error('Final payment was not status-audited');
    console.log('Passed');

    console.log('Test 2: all supported payment methods are stored');
    for (const method of ['CASH', 'UPI', 'CARD', 'OTHER']) {
      const methodJob = await createCompletedJob();
      const response = await request(`${baseUrl}/${methodJob.id}/payments`, tenantA.accessToken, { method: 'POST', body: JSON.stringify({ amount: 1, paymentMethod: method }) });
      const data = await response.json();
      if (response.status !== 201 || data.data.payment.paymentMethod !== method) throw new Error(`${method} payment failed: ${JSON.stringify(data)}`);
    }
    console.log('Passed');

    console.log('Test 3: invalid values, client totals, overpayment, and non-completed jobs are rejected');
    const invalidJob = await createCompletedJob();
    for (const body of [
      { amount: -1, paymentMethod: 'CASH' }, { amount: 0, paymentMethod: 'CASH' },
      { amount: 1, paymentMethod: 'ONLINE' }, { amount: 1, paymentMethod: 'CASH', paidAmount: 1 },
    ]) {
      const response = await request(`${baseUrl}/${invalidJob.id}/payments`, tenantA.accessToken, { method: 'POST', body: JSON.stringify(body) });
      if (response.status !== 400) throw new Error(`Invalid payment expected 400, got ${response.status}`);
    }
    const overpayment = await request(`${baseUrl}/${invalidJob.id}/payments`, tenantA.accessToken, { method: 'POST', body: JSON.stringify({ amount: 141, paymentMethod: 'CARD' }) });
    if (overpayment.status !== 409 || await prisma.payment.count({ where: { jobId: invalidJob.id } }) !== 0) throw new Error('Overpayment was accepted or persisted');
    const requestedJob = await prisma.job.create({ data: { businessId: tenantA.business.id, customerId: customerA.id, problemDescription: 'Not complete' } });
    const premature = await request(`${baseUrl}/${requestedJob.id}/payments`, tenantA.accessToken, { method: 'POST', body: JSON.stringify({ amount: 1, paymentMethod: 'CASH' }) });
    if (premature.status !== 409) throw new Error(`Premature payment expected 409, got ${premature.status}`);
    console.log('Passed');

    console.log('Test 4: owner-only and tenant-scoped access are enforced');
    const accessJob = await createCompletedJob();
    const unauthenticated = await request(`${baseUrl}/${accessJob.id}/payments`, null, { method: 'POST', body: JSON.stringify({ amount: 1, paymentMethod: 'CASH' }) });
    const technician = await request(`${baseUrl}/${accessJob.id}/payments`, techAToken, { method: 'POST', body: JSON.stringify({ amount: 1, paymentMethod: 'CASH' }) });
    const crossBusiness = await request(`${baseUrl}/${accessJob.id}/payments`, tenantB.accessToken, { method: 'POST', body: JSON.stringify({ amount: 1, paymentMethod: 'CASH' }) });
    const receiptAsTech = await request(`${baseUrl}/${accessJob.id}/receipt`, techAToken);
    const receiptCrossBusiness = await request(`${baseUrl}/${accessJob.id}/receipt`, tenantB.accessToken);
    if (unauthenticated.status !== 401 || technician.status !== 403 || crossBusiness.status !== 404 || receiptAsTech.status !== 403 || receiptCrossBusiness.status !== 404) throw new Error('Payment authorization or tenant isolation failed');
    const tenantBJob = await createCompletedJob(customerB.id, tenantB.business.id);
    if ((await request(`${baseUrl}/${tenantBJob.id}/receipt`, tenantA.accessToken)).status !== 404) throw new Error('Cross-business receipt was exposed');
    console.log('Passed');

    console.log('Test 5: payment and PAID history roll back together on failure');
    const rollbackJob = await createCompletedJob();
    try {
      await paymentService.recordPayment(tenantA.business.id, '00000000-0000-0000-0000-000000000000', rollbackJob.id, { amount: 140, paymentMethod: 'OTHER' });
      throw new Error('Expected payment history foreign-key failure');
    } catch (err) {
      if (err.message === 'Expected payment history foreign-key failure') throw err;
    }
    const [rolledBackJob, rolledBackPayments, rolledBackHistory] = await Promise.all([
      prisma.job.findUnique({ where: { id: rollbackJob.id } }),
      prisma.payment.count({ where: { jobId: rollbackJob.id } }),
      prisma.jobStatusHistory.count({ where: { jobId: rollbackJob.id } }),
    ]);
    if (rolledBackJob.status !== 'COMPLETED' || rolledBackPayments !== 0 || rolledBackHistory !== 0) throw new Error('Failed payment left partial data behind');
    console.log('Passed');

    console.log('\nAll Phase 7 Payment integration tests passed.');
  } catch (err) {
    console.error(`\nPayment test suite failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    for (const id of businesses) await prisma.business.delete({ where: { id } }).catch(() => {});
    server.close();
    await prisma.$disconnect();
  }
}

runPaymentTests();
