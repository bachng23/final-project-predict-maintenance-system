const API_URL = 'http://localhost:5000/api/v1';

async function testUserManagement() {
  console.log('--- Đang lấy token Admin ---');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const loginData = await loginRes.json();
  
  if (!loginData.success) {
    console.error('❌ Đăng nhập Admin thất bại:', loginData.message);
    return;
  }
  
  const token = loginData.token;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  console.log('\n--- 1. Kiểm tra GET /users ---');
  const getRes = await fetch(`${API_URL}/users`, { headers });
  const getData = await getRes.json();
  if (getData.success) {
    console.log('✅ Lấy danh sách user thành công!');
    console.log(`Số lượng user: ${getData.count}`);
  } else {
    console.error('❌ Lấy danh sách user thất bại:', getData.error);
  }

  console.log('\n--- 2. Kiểm tra POST /users (Tạo user mới) ---');
  const newUser = {
    username: `testuser_${Date.now()}`,
    password: 'password123',
    fullName: 'Test User',
    email: 'test@example.com',
    role: 'OPERATOR'
  };
  const createRes = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify(newUser),
  });
  const createData = await createRes.json();
  let createdUserId;
  if (createData.success) {
    createdUserId = createData.data.id;
    console.log(`✅ Tạo user thành công! ID: ${createdUserId}`);
  } else {
    console.error('❌ Tạo user thất bại:', createData.error || createData);
    return;
  }

  console.log('\n--- 3. Kiểm tra PATCH /users/:id (Cập nhật role) ---');
  const updateRes = await fetch(`${API_URL}/users/${createdUserId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ role: 'ENGINEER', active: false }),
  });
  const updateData = await updateRes.json();
  if (updateData.success) {
    console.log('✅ Cập nhật user thành công!');
    console.log(`Role mới: ${updateData.data.role}, Active: ${updateData.data.active}`);
  } else {
    console.error('❌ Cập nhật user thất bại:', updateData.error || updateData);
  }

  console.log('\n--- 4. Kiểm tra Filter role (GET /users?role=ADMIN) ---');
  const filterRes = await fetch(`${API_URL}/users?role=ADMIN`, { headers });
  const filterData = await filterRes.json();
  if (filterData.success) {
    const allAdmin = filterData.data.every(u => u.role === 'ADMIN');
    console.log(`✅ Filter role ADMIN thành công! (Tất cả đều là ADMIN: ${allAdmin})`);
  } else {
    console.error('❌ Filter role thất bại:', filterData.error);
  }
}

testUserManagement().catch(console.error);
