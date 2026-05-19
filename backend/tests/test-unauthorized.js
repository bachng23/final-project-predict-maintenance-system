const API_URL = 'http://localhost:5000/api/v1';

async function testUnauthorized() {
  console.log('--- Kiểm tra truy cập không có Token ---');
  const res = await fetch(`${API_URL}/users`);
  const data = await res.json();
  if (res.status === 401) {
    console.log('✅ Blocked (401 Unauthorized) as expected');
  } else {
    console.error('❌ Failed: Should have been 401 but got', res.status);
  }

  console.log('\n--- Kiểm tra truy cập với role không phải ADMIN ---');
  // First create a non-admin user
  const adminRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const adminToken = (await adminRes.json()).token;

  const username = `user_${Date.now()}`;
  await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ username, password: 'password123', role: 'VIEWER' }),
  });

  // Login as non-admin
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'password123' }),
  });
  const userToken = (await loginRes.json()).token;

  const res2 = await fetch(`${API_URL}/users`, {
    headers: { Authorization: `Bearer ${userToken}` }
  });
  if (res2.status === 403) {
    console.log('✅ Blocked (403 Forbidden) for non-admin user as expected');
  } else {
    console.error('❌ Failed: Should have been 403 but got', res2.status);
  }
}

testUnauthorized().catch(console.error);
