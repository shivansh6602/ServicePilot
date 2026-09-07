import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from '../routes/auth.routes.js';
import prisma from '../config/prisma.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

async function runAuthTests() {
  console.log('🧪 Starting Phase 2 Authentication Integration Tests...\n');

  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/auth`;

  const testEmail = `test_owner_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const profilePhotoUrl = 'https://example.com/photos/owner.jpg';

  let accessToken = '';
  let refreshTokenCookie = '';

  try {
    // 1. Register Business Tenant & Owner Account with optional profile photo
    console.log('Test 1: POST /api/auth/register (Business Tenant & Owner registration with profilePhotoUrl)');
    const regRes = await fetch(`${baseUrl}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: 'Apex Plumbing Co',
        name: 'John Doe',
        email: testEmail,
        password: testPassword,
        profilePhotoUrl,
      }),
    });

    const regData = await regRes.json();
    console.log(`- Status Code: ${regRes.status}`);
    console.log(`- Status Payload: ${regData.status}`);
    console.log(`- User Profile Photo: ${regData.data?.user?.profilePhotoUrl}`);

    if (regRes.status !== 201 || regData.status !== 'success') {
      throw new Error(`Registration failed: ${JSON.stringify(regData)}`);
    }
    if (regData.data?.user?.profilePhotoUrl !== profilePhotoUrl) {
      throw new Error(`profilePhotoUrl mismatch! Expected ${profilePhotoUrl}, got ${regData.data?.user?.profilePhotoUrl}`);
    }

    const setCookieHeader = regRes.headers.get('set-cookie');
    console.log(`- Set-Cookie Header present: ${Boolean(setCookieHeader)}`);
    if (!setCookieHeader || !setCookieHeader.includes('refreshToken=')) {
      throw new Error('Set-Cookie header missing or does not set refreshToken');
    }
    if (!setCookieHeader.toLowerCase().includes('httponly')) {
      throw new Error('refreshToken cookie missing HttpOnly flag');
    }
    console.log('✅ Test 1 Passed!\n');

    // 2. Login to obtain Access Token and Refresh Cookie
    console.log('Test 2: POST /api/auth/login');
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const loginData = await loginRes.json();
    console.log(`- Status Code: ${loginRes.status}`);
    console.log(`- Access Token Issued: ${Boolean(loginData.data?.accessToken)}`);

    if (loginRes.status !== 200 || !loginData.data?.accessToken) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }

    accessToken = loginData.data.accessToken;
    const loginCookieHeader = loginRes.headers.get('set-cookie');
    if (!loginCookieHeader || !loginCookieHeader.includes('refreshToken=')) {
      throw new Error('Login Set-Cookie header missing refreshToken');
    }
    refreshTokenCookie = loginCookieHeader.split(';')[0]; // refreshToken=...
    console.log('✅ Test 2 Passed!\n');

    // 3. Access Protected /api/auth/me with Access Token
    console.log('Test 3: GET /api/auth/me (Authenticated with Bearer Token)');
    const meRes = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const meData = await meRes.json();
    console.log(`- Status Code: ${meRes.status}`);
    console.log(`- Authenticated User ID: ${meData.data?.user?.userId}`);

    if (meRes.status !== 200 || meData.status !== 'success') {
      throw new Error(`GET /me failed: ${JSON.stringify(meData)}`);
    }
    console.log('✅ Test 3 Passed!\n');

    // 4. Access Protected /api/auth/me with invalid token
    console.log('Test 4: GET /api/auth/me (Invalid token should fail)');
    const failMeRes = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer invalid_token_123',
      },
    });

    console.log(`- Status Code: ${failMeRes.status}`);
    if (failMeRes.status !== 401) {
      throw new Error(`Expected 401 for invalid token, got ${failMeRes.status}`);
    }
    console.log('✅ Test 4 Passed!\n');

    // 5. Refresh Access Token using Refresh Cookie
    console.log('Test 5: POST /api/auth/refresh (Using httpOnly Refresh Cookie)');
    const refreshRes = await fetch(`${baseUrl}/refresh`, {
      method: 'POST',
      headers: {
        Cookie: refreshTokenCookie,
      },
    });

    const refreshData = await refreshRes.json();
    console.log(`- Status Code: ${refreshRes.status}`);
    console.log(`- New Access Token Issued: ${Boolean(refreshData.data?.accessToken)}`);

    if (refreshRes.status !== 200 || !refreshData.data?.accessToken) {
      throw new Error(`Token refresh failed: ${JSON.stringify(refreshData)}`);
    }

    const newAccessToken = refreshData.data.accessToken;

    // Verify new access token works on protected route
    const newMeRes = await fetch(`${baseUrl}/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${newAccessToken}`,
      },
    });
    if (newMeRes.status !== 200) {
      throw new Error('New access token failed to authenticate on /me');
    }
    console.log('✅ Test 5 Passed!\n');

    // 6. Logout and clear cookie
    console.log('Test 6: POST /api/auth/logout');
    const logoutRes = await fetch(`${baseUrl}/logout`, {
      method: 'POST',
    });

    const logoutData = await logoutRes.json();
    const logoutCookieHeader = logoutRes.headers.get('set-cookie');
    console.log(`- Status Code: ${logoutRes.status}`);
    console.log(`- Cookie Cleared (expires in past): ${logoutCookieHeader?.includes('Expires=') || logoutCookieHeader?.includes('Max-Age=0')}`);

    if (logoutRes.status !== 200 || logoutData.status !== 'success') {
      throw new Error(`Logout failed: ${JSON.stringify(logoutData)}`);
    }
    console.log('✅ Test 6 Passed!\n');

    // Cleanup test user & business created during test
    console.log('Cleaning up database test records...');
    const createdUser = await prisma.user.findUnique({ where: { email: testEmail } });
    if (createdUser) {
      await prisma.business.delete({ where: { id: createdUser.businessId } });
    }
    console.log('Cleanup completed successfully.');

    console.log('\n🎉 ALL AUTHENTICATION INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error.message);
    process.exitCode = 1;
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runAuthTests();
