async function testSingleLogin() {
  console.log('Testing unified admin authentication...');
  const baseUrl = 'http://localhost:3000';

  // 1. Attempt login
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@sairam.com',
      password: 'admin123',
    }),
  });

  const loginData = await loginRes.json();
  console.log('Login Status:', loginRes.status);
  console.log('Login Response:', loginData);

  if (!loginRes.ok || !loginData.success) {
    throw new Error('Admin login failed!');
  }

  // Extract set-cookie
  const cookieHeader = loginRes.headers.get('set-cookie');
  console.log('Cookie received:', cookieHeader ? 'Yes (sairam_admin_token)' : 'No');

  // 2. Fetch /api/auth/me with cookie
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: {
      cookie: cookieHeader || '',
    },
  });

  const meData = await meRes.json();
  console.log('Me Status:', meRes.status);
  console.log('Me Data:', meData);

  if (!meRes.ok || !meData.user) {
    throw new Error('Failed to verify session on /api/auth/me');
  }

  console.log('✅ Single unified login system verified successfully!');
}

testSingleLogin().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});
