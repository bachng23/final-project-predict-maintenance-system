require('dotenv').config();
const http = require('http');

async function checkAPI() {
  const PORT = process.env.PORT || 5000;
  console.log(`🚀 Đang kiểm tra API GET /api/bearings trên PORT ${PORT}...`);

  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/api/bearings',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      if (res.statusCode === 200) {
        const json = JSON.parse(data);
        console.log('✅ Kết nối thành công (200 OK)');
        console.log(`📊 Số lượng máy: ${json.count}`);
        
        if (json.data.length > 0) {
          const b = json.data[0];
          console.log('🔍 Kiểm tra cấu trúc dữ liệu máy đầu tiên:');
          console.log(`   - ID: ${b.bearing_id}`);
          console.log(`   - Status: ${b.status}`);
          console.log(`   - RUL (Hours): ${b.rul_hours}`);
          
          // Kiểm tra xem có field bắt buộc không
          const required = ['bearing_id', 'status', 'health_score', 'rul_hours'];
          const missing = required.filter(f => !(f in b));
          
          if (missing.length === 0) {
            console.log('✨ Tất cả các trường bắt buộc đều hiện diện.');
          } else {
            console.error('❌ Thiếu trường dữ liệu:', missing);
          }
        }
      } else {
        console.error(`❌ Lỗi API: Status Code ${res.statusCode}`);
        console.error('Data:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Không thể kết nối tới Server. Hãy đảm bảo bạn đã chạy "npm run dev".');
    console.error('Chi tiết lỗi:', error.message);
  });

  req.end();
}

// Chạy kiểm tra
checkAPI();
