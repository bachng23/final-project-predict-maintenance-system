const API_URL = 'http://localhost:5000/api';

async function runTest() {
    console.log('--- 1. Kiểm tra danh sách PENDING ---');
    const getRes = await fetch(`${API_URL}/decisions/pending`);
    const getData = await getRes.json();

    if (!getData.success || getData.count === 0) {
        console.log('❌ Không có Decision nào đang PENDING để test.');
        console.log('👉 Vui lòng chạy lệnh sau để reset trạng thái (trong một terminal khác):');
        console.log('   node -e "const { PrismaClient } = require(\'@prisma/client\'); const p = new PrismaClient(); p.decision.updateMany({ data: { decisionStatus: \'PENDING\', resolvedAt: null } }).then(() => console.log(\'Reset xong!\')).finally(() => p.$disconnect())"');
        return;
    }

    const targetId = getData.data[0].id;
    console.log(`✅ Tìm thấy ${getData.count} bản ghi. Đang test với ID: ${targetId}`);

    console.log('\n--- 2. Gửi lệnh APPROVE ---');
    const approveRes = await fetch(`${API_URL}/decisions/${targetId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE' })
    });
    const approveData = await approveRes.json();
    
    if (approveData.success) {
        console.log('✅ Chấp thuận (APPROVE) thành công!');
    } else {
        console.error('❌ Thất bại:', approveData.error?.message || approveData);
    }

    console.log('\n--- 3. Kiểm tra lại danh sách ---');
    const finalRes = await fetch(`${API_URL}/decisions/pending`);
    const finalData = await finalRes.json();
    console.log(`📊 Số lượng PENDING còn lại: ${finalData.count}`);
}

runTest().catch(console.error);
