/**
 * Script kiểm tra API Quản lý người dùng dành cho Admin
 * Cách chạy: node tests/test-admin-api.js
 */

const API_URL = 'http://localhost:5000/api/v1';

// Cấu hình Admin mặc định (phù hợp với seed.js)
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

async function runTests() {
  console.log('🚀 Bắt đầu kiểm tra API Quản lý người dùng...\n');

  try {
    // 1. Đăng nhập để lấy Token
    console.log('Step 1: Đăng nhập Admin...');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ADMIN_CREDENTIALS),
    });
    const loginData = await loginRes.json();

    if (!loginData.success) {
      throw new Error(`Đăng nhập thất bại: ${loginData.error?.message || loginData.message}`);
    }

    const token = loginData.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    console.log('✅ Đăng nhập thành công. Token đã sẵn sàng.\n');

    // 2. Lấy danh sách người dùng
    console.log('Step 2: Lấy danh sách users...');
    const listRes = await fetch(`${API_URL}/users`, { headers: authHeaders });
    const listData = await listRes.json();
    if (listData.success) {
      console.log(`✅ Lấy danh sách thành công! (Tìm thấy ${listData.count} người dùng)`);
    } else {
      console.error('❌ Lấy danh sách thất bại:', listData.error);
    }

    // 3. Tạo người dùng mới
    console.log('\nStep 3: Tạo người dùng mới...');
    const testUsername = `test_user_${Math.floor(Math.random() * 10000)}`;
    const createRes = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        username: testUsername,
        password: 'password123456',
        fullName: 'Test User API',
        email: `${testUsername}@example.com`,
        role: 'OPERATOR'
      }),
    });
    const createData = await createRes.json();
    
    if (createData.success) {
      console.log(`✅ Tạo thành công user: ${createData.data.username} (ID: ${createData.data.id})`);
    } else {
      console.error('❌ Tạo user thất bại:', createData.error);
      return;
    }

    const newUserId = createData.data.id;

    // 4. Cập nhật Role người dùng
    console.log(`\nStep 4: Cập nhật role cho user ${testUsername} sang ENGINEER...`);
    const updateRes = await fetch(`${API_URL}/users/${newUserId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        role: 'ENGINEER'
      }),
    });
    const updateData = await updateRes.json();
    if (updateData.success && updateData.data.role === 'ENGINEER') {
      console.log('✅ Cập nhật role thành công.');
    } else {
      console.error('❌ Cập nhật role thất bại:', updateData.error);
    }

    // 5. Deactivate (Vô hiệu hóa) người dùng
    console.log('\nStep 5: Vô hiệu hóa người dùng (active: false)...');
    const deactivateRes = await fetch(`${API_URL}/users/${newUserId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        active: false
      }),
    });
    const deactivateData = await deactivateRes.json();
    if (deactivateData.success && deactivateData.data.active === false) {
      console.log('✅ Vô hiệu hóa thành công.');
    } else {
      console.error('❌ Vô hiệu hóa thất bại:', deactivateData.error);
    }

    // 6. Kiểm tra Filter theo Role
    console.log('\nStep 6: Kiểm tra lọc theo role (GET /users?role=ADMIN)...');
    const filterRes = await fetch(`${API_URL}/users?role=ADMIN`, { headers: authHeaders });
    const filterData = await filterRes.json();
    if (filterData.success) {
      const allIsAdmin = filterData.data.every(u => u.role === 'ADMIN');
      console.log(`✅ Lọc thành công! Tất cả kết quả trả về là ADMIN: ${allIsAdmin}`);
    } else {
      console.error('❌ Lọc thất bại:', filterData.error);
    }

    console.log('\n🎉 Hoàn tất kiểm tra API!');

  } catch (error) {
    console.error('\n❌ Lỗi trong quá trình chạy test:', error.message);
  }
}

runTests();
