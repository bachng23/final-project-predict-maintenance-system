const http = require('http');

async function testPredictionHistory() {
  console.log('🚀 Đang kiểm tra API GET /api/bearings/:id/predictions...');

  // Bước 1: Lấy ID của một bearing trước
  const getBearing = () => new Promise((resolve, reject) => {
    http.get('http://localhost:5000/api/bearings', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data).data[0].id));
    }).on('error', reject);
  });

  try {
    const bearingId = await getBearing();
    console.log(`📌 Sử dụng Bearing ID: ${bearingId}`);

    // Bước 2: Lấy lịch sử dự đoán
    const limit = 5;
    http.get(`http://localhost:5000/api/bearings/${bearingId}/predictions?limit=${limit}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        if (res.statusCode === 200) {
          console.log(`✅ Lấy lịch sử thành công. Số lượng điểm: ${json.count}`);
          if (json.data.length > 0) {
            console.log('📈 Điểm dữ liệu đầu tiên:', {
              sample_ts: json.data[0].sample_ts,
              health_score: json.data[0].health_score,
              rul_hours: json.data[0].rul_hours
            });
          }
        } else {
          console.error('❌ Lỗi API:', json);
        }
      });
    });
  } catch (error) {
    console.error('❌ Thất bại:', error.message);
  }
}

testPredictionHistory();
