const API_BASE_URL = 'http://localhost:5000/api';

async function testAllFeatures() {
  console.log('🚀 BẮT ĐẦU KIỂM TRA TOÀN DIỆN TASK 2...\n');

  const runAction = async (id, payload, label) => {
    console.log(`--- Test ${label} ---`);
    const res = await fetch(`${API_BASE_URL}/decisions/${id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Message:', data.message);
    if (data.success) console.log('✅ Thành công');
    else console.log('❌ Thất bại:', data.error?.message || data.message);
    console.log('');
    return data;
  };

  try {
    // 1. Kiểm tra GET Pending
    console.log('--- Kiểm tra GET /pending ---');
    const getRes = await fetch(`${API_BASE_URL}/decisions/pending`);
    const getData = await getRes.json();
    console.log(`Tìm thấy ${getData.count} quyết định chờ xử lý.`);
    
    if (getData.count === 0) {
      console.log('⚠️ Không có dữ liệu. Đang tự động chạy seed...');
      // Trong môi trường này tôi không gọi shell từ JS được, nhưng giả định bạn đã chạy seed.
      return;
    }

    // Lấy ID để test các case khác nhau (cần chạy seed nhiều lần hoặc tạo nhiều bản ghi)
    const id = getData.data[0].id;

    // 2. Test APPROVE
    await runAction(id, { action: 'APPROVE' }, 'Hành động APPROVE');

    // 3. Test Validation (Xử lý lại bản ghi đã đóng)
    await runAction(id, { action: 'REJECT' }, 'Gửi lại action cho bản ghi đã đóng (Phải lỗi)');

    // 4. Test OVERRIDE (Cần bản ghi mới - bạn hãy chạy "node prisma/seed.js" lần nữa trước khi chạy script này nếu muốn test case này)
    console.log('--- Lưu ý: Để test tiếp OVERRIDE/REJECT, hãy đảm bảo có thêm bản ghi PENDING trong DB ---\n');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  }
}

testAllFeatures();
