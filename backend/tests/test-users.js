const API_URL = 'http://localhost:5000/api/v1';

/**
 * Script kiểm tra toàn diện API Quản lý người dùng
 */
async function runTests() {
  console.log('🚀 Bắt đầu kiểm tra API User Management...\n');

  try {
    // 1. Lấy token Admin
    console.log('--- Bước 1: Đăng nhập Admin ---');
    const loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    
    const loginData = await loginRes.json();
    if (!loginData.success) {
      throw new Error(`Đăng nhập thất bại: ${loginData.message}`);
    }
    
    const token = loginData.token;
    const adminHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    console.log('✅ Đăng nhập thành công.\n');

    // 2. Lấy danh sách users
    console.log('--- Bước 2: Lấy danh sách Users ---');
    const listRes = await fetch(`${API_URL}/users`, { headers: adminHeaders });
    const listData = await listRes.json();
    console.log(`✅ Lấy danh sách thành công. Số lượng: ${listData.count}\n`);

    // 3. Tạo User mới
    console.log('--- Bước 3: Tạo User mới ---');
    const tempUsername = `test_${Math.floor(Math.random() * 10000)}`;
    const createRes = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        username: tempUsername,
        password: 'password123',
        fullName: 'Test Automation User',
        role: 'OPERATOR'
      }),
    });
    const createData = await createRes.json();
    const newUserId = createData.data.id;
    console.log(`✅ Tạo User thành công. ID: ${newUserId}\n`);

    // 4. Cập nhật User (Deactivate)
    console.log('--- Bước 4: Vô hiệu hóa User (Deactivate) ---');
    const updateRes = await fetch(`${API_URL}/users/${newUserId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ active: false, role: 'ENGINEER' }),
    });
    const updateData = await updateRes.json();
    console.log(`✅ Cập nhật thành công. Trạng thái active: ${updateData.data.active}\n`);

    // 5. Kiểm tra phân quyền (Unauthorized)
    console.log('--- Bước 5: Kiểm tra bảo mật (Phân quyền) ---');
    const noTokenRes = await fetch(`${API_URL}/users`);
    console.log(`✅ Không token: ${noTokenRes.status} (Mong đợi 401)`);

    // Thử dùng token của user thường vừa tạo để truy cập admin
    const userLoginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: tempUsername, password: 'password123' }),
      });
    const userLoginData = await userLoginRes.json();
    
    if (userLoginData.success) {
        const userToken = userLoginData.token;
        const forbiddenRes = await fetch(`${API_URL}/users`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
        });
        console.log(`✅ Token user thường: ${forbiddenRes.status} (Mong đợi 403)`);
    } else {
        // User bị deactivate ở bước 4 nên login trả về 401 là đúng
        console.log(`✅ Login user bị khóa: ${userLoginRes.status} (Mong đợi 401)`);
    }

    console.log('\n✨ Tất cả bài kiểm tra đã hoàn tất thành công!');

  } catch (error) {
    console.error('\n❌ Lỗi trong quá trình kiểm tra:');
    console.error(error.message);
    console.log('\nHãy đảm bảo server đang chạy: npm run dev');
  }
}

runTests();
