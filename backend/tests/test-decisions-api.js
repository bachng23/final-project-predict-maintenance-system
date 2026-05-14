const API_BASE_URL = 'http://localhost:5000/api';

// Requires a valid JWT in TEST_TOKEN env var:
//   TEST_TOKEN=<your_jwt> node tests/test-decisions-api.js
const TOKEN = process.env.TEST_TOKEN;
if (!TOKEN) {
  console.error('❌ TEST_TOKEN env variable is required. Set it to a valid JWT before running.');
  process.exit(1);
}

const authHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};

async function testAllFeatures() {
  console.log('🚀 BẮT ĐẦU KIỂM TRA TOÀN DIỆN DECISIONS API...\n');

  const runAction = async (id, payload, label) => {
    console.log(`--- Test ${label} ---`);
    const res = await fetch(`${API_BASE_URL}/v1/decisions/${id}/action`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Message:', data.message || data.error?.message);
    if (data.success) console.log('✅ Thành công');
    else console.log('❌ Thất bại:', data.error?.message || data.message);
    console.log('');
    return data;
  };

  try {
    // 1. GET /pending
    console.log('--- Kiểm tra GET /pending ---');
    const getRes = await fetch(`${API_BASE_URL}/v1/decisions/pending`, { headers: authHeaders });
    const getData = await getRes.json();
    console.log(`Tìm thấy ${getData.count} quyết định chờ xử lý.\n`);

    if (getData.count === 0) {
      console.log('⚠️ Không có dữ liệu. Chạy: node prisma/seed.js để tạo dữ liệu mẫu.');
      return;
    }

    const id = getData.data[0].id;

    // 2. Test APPROVE
    await runAction(id, { action: 'APPROVE' }, 'Hành động APPROVE');

    // 3. Test re-submitting a resolved decision (must return 409)
    await runAction(id, { action: 'REJECT' }, 'Gửi lại action cho bản ghi đã đóng (Phải lỗi 409)');

    // 4. OVERRIDE / REJECT require a new PENDING record — run seed again first.
    console.log('--- Lưu ý: Để test OVERRIDE/REJECT, chạy "node prisma/seed.js" để tạo thêm bản ghi PENDING ---\n');
  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  }
}

testAllFeatures();
