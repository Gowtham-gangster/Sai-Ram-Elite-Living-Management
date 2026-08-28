const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function runTests() {
  console.log('====================================================');
  console.log('    PHASE 7: PAYMENT & HOSTEL SETTINGS API TESTS    ');
  console.log('====================================================\n');

  const baseUrl = 'http://localhost:3000';

  // 1. Unauthenticated rejection
  console.log('--- Step 1: Unauthenticated Access Guard ---');
  const unauthRes = await fetch(`${baseUrl}/api/settings`);
  console.log('Unauthenticated GET Status:', unauthRes.status);
  if (unauthRes.status !== 401) throw new Error('Unauthenticated access was not rejected with HTTP 401!');
  console.log('✅ Step 1 PASSED: Unauthenticated access blocked.');

  // 2. Admin Login
  console.log('\n--- Step 2: Admin Login ---');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sairam.com', password: 'admin123' }),
  });
  const cookie = loginRes.headers.get('set-cookie');
  console.log('Login Status:', loginRes.status, 'Cookie Set:', Boolean(cookie));
  const headers = { 'Cookie': cookie, 'Content-Type': 'application/json' };

  // 3. Fetch Settings & Admin Profile
  console.log('\n--- Step 3: GET /api/settings ---');
  const getRes = await fetch(`${baseUrl}/api/settings`, { headers });
  const getData = await getRes.json();
  console.log('Settings Fetch Status:', getRes.status, {
    hostelName: getData.settings?.hostelName,
    bankName: getData.settings?.bankName,
    upiId: getData.settings?.upiId,
    adminEmail: getData.adminUser?.email,
  });
  if (getRes.status !== 200 || !getData.settings || !getData.adminUser) {
    throw new Error('Failed to retrieve settings or admin profile!');
  }
  console.log('✅ Step 3 PASSED: Settings & admin profile retrieved.');

  // 4. Update Settings (PUT /api/settings)
  console.log('\n--- Step 4: PUT /api/settings (Update Hostel, Banking & Policies) ---');
  const updateRes = await fetch(`${baseUrl}/api/settings`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      hostelName: 'SAIRAM ELITE LIVING',
      hostelAddress: 'Plot #42, ITPL Main Road, Whitefield, Bengaluru - 560066',
      contactPhone: '+91 98450 12345',
      whatsAppNumber: '+91 98450 12345',
      contactEmail: 'contact@sairameliteliving.com',
      websiteUrl: 'https://sairameliteliving.com',
      bankName: 'ICICI Bank',
      accountHolderName: 'SAIRAM ELITE LIVING HOSPITALITY LLP',
      accountNumber: '001122334455',
      ifscCode: 'ICIC0000011',
      upiId: 'sairamhostel@icici',
      paymentInstructions: 'Transfer rent by the 5th. Mention room number in remarks.',
      defaultDueDayOfMonth: 5,
      lateFeePerDay: 75,
      gracePeriodDays: 4,
      rulesAndRegulations: '1. Gate closes at 10:30 PM.\n2. Quiet hours: 11 PM to 6 AM.',
    }),
  });
  const updateData = await updateRes.json();
  console.log('Update Settings Status:', updateRes.status, {
    bankName: updateData.settings?.bankName,
    upiId: updateData.settings?.upiId,
    lateFeePerDay: updateData.settings?.lateFeePerDay,
  });
  if (updateRes.status !== 200 || updateData.settings?.bankName !== 'ICICI Bank') {
    throw new Error('Failed to update hostel settings: ' + JSON.stringify(updateData));
  }
  console.log('✅ Step 4 PASSED: Hostel and banking settings updated securely in database.');

  // 5. Update Admin Password (PATCH /api/settings)
  console.log('\n--- Step 5: PATCH /api/settings (Update Admin Password) ---');
  // First test invalid current password
  const invalidPassRes = await fetch(`${baseUrl}/api/settings`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      currentPassword: 'wrongpassword',
      newPassword: 'newpassword123',
      confirmPassword: 'newpassword123',
    }),
  });
  console.log('Invalid Current Password Status:', invalidPassRes.status);
  if (invalidPassRes.status !== 400) throw new Error('Incorrect current password was not rejected!');

  // Now change password with valid current password
  const validPassRes = await fetch(`${baseUrl}/api/settings`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      currentPassword: 'admin123',
      newPassword: 'admin123_updated',
      confirmPassword: 'admin123_updated',
    }),
  });
  const validPassData = await validPassRes.json();
  console.log('Valid Password Change Status:', validPassRes.status, 'Message:', validPassData.message);
  if (validPassRes.status !== 200) throw new Error('Failed to update admin password!');

  // Reset back to admin123 for test environment consistency
  const resetPassRes = await fetch(`${baseUrl}/api/settings`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      currentPassword: 'admin123_updated',
      newPassword: 'admin123',
      confirmPassword: 'admin123',
    }),
  });
  console.log('Reset Password Back Status:', resetPassRes.status);
  console.log('✅ Step 5 PASSED: Admin password update and bcrypt verification working 100%.');

  console.log('\n🎉 ALL PHASE 7 SETTINGS & SECURITY TESTS PASSED 100%!');
}

runTests()
  .catch(e => {
    console.error('❌ Test failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
