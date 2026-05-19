const API_URL = 'http://localhost:5000/api/v1';

async function getToken() {
  const loginData = {
    username: 'admin',
    password: 'admin123' // Mặc định từ seed.js
  };

  try {
    console.log(`Đang thử đăng nhập vào ${API_URL}/auth/login...`);
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginData),
    });

    const data = await response.json();

    if (data.success) {
      console.log('\n✅ Đăng nhập thành công!');
      console.log('--- TOKEN CỦA BẠN ---');
      console.log(data.token);
      console.log('--------------------');
      console.log('\n👉 Để chạy test, hãy copy lệnh dưới đây:');
      console.log(`$env:TEST_TOKEN="${data.token}"; node tests/test-api.js`);
    } else {
      console.error('❌ Đăng nhập thất bại:', data.message);
      console.log('Hãy đảm bảo server đang chạy (npm run dev) và đã chạy seed (npm run prisma:seed).');
    }
  } catch (error) {
    console.error('❌ Lỗi kết nối:', error.message);
  }
}

getToken();
