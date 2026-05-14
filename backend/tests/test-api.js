const API_URL = 'http://localhost:5000/api';

// Requires a valid JWT in TEST_TOKEN env var:
//   TEST_TOKEN=<your_jwt> node tests/test-api.js
const TOKEN = process.env.TEST_TOKEN;
if (!TOKEN) {
  console.error('❌ TEST_TOKEN env variable is required. Set it to a valid JWT before running.');
  process.exit(1);
}

const authHeaders = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};

async function runTest() {
  console.log('--- 1. Kiểm tra danh sách PENDING ---');
  const getRes = await fetch(`${API_URL}/v1/decisions/pending`, { headers: authHeaders });
  const getData = await getRes.json();

  if (!getData.success || getData.count === 0) {
    console.log('❌ Không có Decision nào đang PENDING để test.');
    console.log('👉 Chạy: node prisma/seed.js để tạo dữ liệu mẫu.');
    return;
  }

  const targetId = getData.data[0].id;
  console.log(`✅ Tìm thấy ${getData.count} bản ghi. Đang test với ID: ${targetId}`);

  console.log('\n--- 2. Gửi lệnh APPROVE ---');
  const approveRes = await fetch(`${API_URL}/v1/decisions/${targetId}/action`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ action: 'APPROVE' }),
  });
  const approveData = await approveRes.json();

  if (approveData.success) {
    console.log('✅ Chấp thuận (APPROVE) thành công!');
  } else {
    console.error('❌ Thất bại:', approveData.error?.message || approveData);
  }

  console.log('\n--- 3. Kiểm tra lại danh sách ---');
  const finalRes = await fetch(`${API_URL}/v1/decisions/pending`, { headers: authHeaders });
  const finalData = await finalRes.json();
  console.log(`📊 Số lượng PENDING còn lại: ${finalData.count}`);
}

runTest().catch(console.error);
