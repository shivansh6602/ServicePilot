import express from 'express';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import authRoutes from '../routes/auth.routes.js';
import technicianRoutes from '../routes/technician.routes.js';
import * as authService from '../services/auth.service.js';
import prisma from '../config/prisma.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use('/api/technicians', technicianRoutes);

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

async function runTechnicianTests() {
  console.log('Starting Phase 4 Technician Integration Tests...\n');
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/technicians`;
  const createdBusinessIds = [];

  try {
    const tenantA = await createOwner('TechnicianTenantA');
    const tenantB = await createOwner('TechnicianTenantB');
    const tenantWithoutTechnicians = await createOwner('EmptyTechnicianTenant');
    createdBusinessIds.push(
      tenantA.business.id,
      tenantB.business.id,
      tenantWithoutTechnicians.business.id,
    );
    const technicianEmail = `alex_${Date.now()}@example.com`;

    console.log('Test 1: owner creates a technician in their own business');
    const createResponse = await request(baseUrl, tenantA.accessToken, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Alex Technician',
        email: technicianEmail.toUpperCase(),
        password: 'Technician123!',
        businessId: tenantB.business.id,
      }),
    });
    const createData = await createResponse.json();
    if (createResponse.status !== 201 || createData.data.technician.businessId !== tenantA.business.id) {
      throw new Error(`Technician creation failed: ${JSON.stringify(createData)}`);
    }
    if (createData.data.technician.role !== 'TECHNICIAN' || createData.data.technician.passwordHash) {
      throw new Error(`Technician response is invalid: ${JSON.stringify(createData)}`);
    }
    const technician = await prisma.user.findUnique({ where: { email: technicianEmail } });
    if (!technician || !(await bcrypt.compare('Technician123!', technician.passwordHash))) {
      throw new Error('Technician password was not hashed correctly');
    }
    console.log('Passed');

    console.log('Test 2: technician listing is scoped to the owner business and excludes password hashes');
    const tenantBTechnicianResponse = await request(baseUrl, tenantB.accessToken, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Taylor Other Business',
        email: `taylor_${Date.now()}@example.com`,
        password: 'Technician123!',
      }),
    });
    if (tenantBTechnicianResponse.status !== 201) {
      throw new Error(`Failed to create Tenant B technician: ${tenantBTechnicianResponse.status}`);
    }
    const tenantBTechnicianData = await tenantBTechnicianResponse.json();
    const tenantBTechnician = tenantBTechnicianData.data.technician;
    const listResponse = await request(`${baseUrl}?businessId=${tenantB.business.id}`, tenantA.accessToken);
    const listData = await listResponse.json();
    if (listResponse.status !== 200 || listData.data.technicians.length !== 1 || listData.data.technicians[0].id !== technician.id) {
      throw new Error(`Tenant-scoped technician listing failed: ${JSON.stringify(listData)}`);
    }
    if (listData.data.technicians.some((listedTechnician) => Object.hasOwn(listedTechnician, 'passwordHash'))) {
      throw new Error('Technician listing exposed passwordHash');
    }
    console.log('Passed');

    console.log('Test 3: owner receives an empty technician list when none exist');
    const emptyListResponse = await request(baseUrl, tenantWithoutTechnicians.accessToken);
    const emptyListData = await emptyListResponse.json();
    if (emptyListResponse.status !== 200 || emptyListData.data.technicians.length !== 0) {
      throw new Error(`Expected an empty technician list: ${JSON.stringify(emptyListData)}`);
    }
    console.log('Passed');

    console.log('Test 4: duplicate technician email is rejected');
    const duplicateResponse = await request(baseUrl, tenantB.accessToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'Duplicate Alex', email: technicianEmail, password: 'Technician123!' }),
    });
    if (duplicateResponse.status !== 409) throw new Error(`Expected 409, got ${duplicateResponse.status}`);
    console.log('Passed');

    console.log('Test 5: validation, authentication, and OWNER authorization are enforced');
    const invalidResponse = await request(baseUrl, tenantA.accessToken, {
      method: 'POST',
      body: JSON.stringify({ name: 'A', email: 'invalid', password: 'short' }),
    });
    if (invalidResponse.status !== 400) throw new Error(`Expected 400, got ${invalidResponse.status}`);
    const unauthenticated = await request(baseUrl, null, { method: 'POST', body: JSON.stringify({}) });
    if (unauthenticated.status !== 401) throw new Error(`Expected 401, got ${unauthenticated.status}`);
    const technicianToken = authService.generateAccessToken({
      userId: technician.id,
      businessId: technician.businessId,
      role: technician.role,
    });
    const forbidden = await request(baseUrl, technicianToken, { method: 'POST', body: JSON.stringify({}) });
    if (forbidden.status !== 403) throw new Error(`Expected 403, got ${forbidden.status}`);
    const unauthenticatedList = await request(baseUrl, null);
    if (unauthenticatedList.status !== 401) throw new Error(`Expected listing 401, got ${unauthenticatedList.status}`);
    const forbiddenList = await request(baseUrl, technicianToken);
    if (forbiddenList.status !== 403) throw new Error(`Expected listing 403, got ${forbiddenList.status}`);
    console.log('Passed');

    console.log('Test 6: owner detail and update enforce tenant scope, validation, and protected fields');
    const detailResponse = await request(`${baseUrl}/${technician.id}`, tenantA.accessToken);
    const detailData = await detailResponse.json();
    if (detailResponse.status !== 200 || detailData.data.technician.id !== technician.id || detailData.data.technician.passwordHash) {
      throw new Error(`Own technician detail failed: ${JSON.stringify(detailData)}`);
    }
    const crossDetailResponse = await request(`${baseUrl}/${tenantBTechnician.id}`, tenantA.accessToken);
    if (crossDetailResponse.status !== 404) throw new Error(`Expected cross-tenant detail 404, got ${crossDetailResponse.status}`);
    const updateResponse = await request(`${baseUrl}/${technician.id}`, tenantA.accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Alex Updated', email: `updated_${Date.now()}@example.com` }),
    });
    const updateData = await updateResponse.json();
    if (updateResponse.status !== 200 || updateData.data.technician.name !== 'Alex Updated' || updateData.data.technician.passwordHash) {
      throw new Error(`Own technician update failed: ${JSON.stringify(updateData)}`);
    }
    for (const body of [
      { name: 'A' },
      { businessId: tenantB.business.id, role: 'OWNER', passwordHash: 'raw', password: 'Password123!' },
    ]) {
      const response = await request(`${baseUrl}/${technician.id}`, tenantA.accessToken, { method: 'PATCH', body: JSON.stringify(body) });
      if (response.status !== 400) throw new Error(`Expected protected/invalid update 400, got ${response.status}`);
    }
    const duplicateUpdate = await request(`${baseUrl}/${technician.id}`, tenantA.accessToken, {
      method: 'PATCH', body: JSON.stringify({ email: tenantBTechnician.email }),
    });
    if (duplicateUpdate.status !== 409) throw new Error(`Expected duplicate email 409, got ${duplicateUpdate.status}`);
    const crossUpdate = await request(`${baseUrl}/${tenantBTechnician.id}`, tenantA.accessToken, {
      method: 'PATCH', body: JSON.stringify({ name: 'Takeover attempt' }),
    });
    if (crossUpdate.status !== 404) throw new Error(`Expected cross-tenant update 404, got ${crossUpdate.status}`);
    console.log('Passed');

    console.log('Test 7: technician login uses the existing token/cookie flow and rejects wrong roles');
    const loginResponse = await request(`http://127.0.0.1:${server.address().port}/api/auth/technician/login`, null, {
      method: 'POST', body: JSON.stringify({ email: updateData.data.technician.email, password: 'Technician123!' }),
    });
    const loginData = await loginResponse.json();
    const refreshCookie = loginResponse.headers.get('set-cookie');
    if (loginResponse.status !== 200 || !loginData.data.accessToken || loginData.data.user.role !== 'TECHNICIAN' || loginData.data.user.passwordHash || !refreshCookie?.includes('refreshToken=') || !refreshCookie.toLowerCase().includes('httponly')) {
      throw new Error(`Technician login failed or returned unsafe data: ${JSON.stringify(loginData)}`);
    }
    const refreshResponse = await request(`http://127.0.0.1:${server.address().port}/api/auth/refresh`, null, {
      method: 'POST', headers: { Cookie: refreshCookie.split(';')[0] },
    });
    if (refreshResponse.status !== 200) throw new Error(`Technician refresh failed: ${refreshResponse.status}`);
    for (const credentials of [
      { email: updateData.data.technician.email, password: 'wrong-password' },
      { email: tenantA.user.email, password: 'Password123!' },
    ]) {
      const response = await request(`http://127.0.0.1:${server.address().port}/api/auth/technician/login`, null, {
        method: 'POST', body: JSON.stringify(credentials),
      });
      if (response.status !== 401) throw new Error(`Expected technician login rejection 401, got ${response.status}`);
    }
    console.log('Passed');

    console.log('Test 8: technicians cannot access OWNER-only routes and photo changes are authorized');
    const liveTechnicianToken = loginData.data.accessToken;
    for (const path of [baseUrl, `${baseUrl}/${technician.id}`]) {
      const response = await request(path, liveTechnicianToken);
      if (response.status !== 403) throw new Error(`Expected OWNER-only route 403, got ${response.status}`);
    }
    const selfPhoto = await request(`${baseUrl}/${technician.id}/profile-photo`, liveTechnicianToken, {
      method: 'PATCH', body: JSON.stringify({ profilePhotoUrl: 'https://example.com/photos/alex.jpg' }),
    });
    const selfPhotoData = await selfPhoto.json();
    if (selfPhoto.status !== 200 || selfPhotoData.data.technician.profilePhotoUrl !== 'https://example.com/photos/alex.jpg' || selfPhotoData.data.technician.passwordHash) {
      throw new Error(`Self photo update failed: ${JSON.stringify(selfPhotoData)}`);
    }
    const ownerPhoto = await request(`${baseUrl}/${technician.id}/profile-photo`, tenantA.accessToken, {
      method: 'PATCH', body: JSON.stringify({ profilePhotoUrl: 'https://example.com/photos/owner-managed.jpg' }),
    });
    if (ownerPhoto.status !== 200) throw new Error(`Expected same-tenant owner photo update 200, got ${ownerPhoto.status}`);
    const otherPhoto = await request(`${baseUrl}/${tenantBTechnician.id}/profile-photo`, liveTechnicianToken, {
      method: 'PATCH', body: JSON.stringify({ profilePhotoUrl: 'https://example.com/photos/takeover.jpg' }),
    });
    if (otherPhoto.status !== 403) throw new Error(`Expected technician cross-user photo 403, got ${otherPhoto.status}`);
    const crossBusinessOwnerPhoto = await request(`${baseUrl}/${tenantBTechnician.id}/profile-photo`, tenantA.accessToken, {
      method: 'PATCH', body: JSON.stringify({ profilePhotoUrl: 'https://example.com/photos/cross-tenant.jpg' }),
    });
    if (crossBusinessOwnerPhoto.status !== 404) throw new Error(`Expected owner cross-tenant photo 404, got ${crossBusinessOwnerPhoto.status}`);
    console.log('Passed');

    console.log('\nAll technician integration tests passed.');
  } catch (error) {
    console.error(`\nTechnician test suite failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    for (const businessId of createdBusinessIds) {
      await prisma.business.delete({ where: { id: businessId } }).catch(() => {});
    }
    server.close();
    await prisma.$disconnect();
  }
}

runTechnicianTests();
