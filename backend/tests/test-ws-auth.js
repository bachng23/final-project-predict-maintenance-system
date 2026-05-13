const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

// Cấu hình giống như trong server
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const PORT = process.env.PORT || 5000;
const URL = `http://localhost:${PORT}/predictions`;

// 1. Tạo một token giả lập để test
const testUser = { id: 'test_user_123', role: 'admin' };
const token = jwt.sign(testUser, JWT_SECRET);

console.log('--- Bắt đầu Test WebSocket Auth ---');
console.log('Target URL:', URL);
console.log('Test User ID:', testUser.id);

// 2. Khởi tạo kết nối
const socket = io(URL, {
  auth: { token },
  transports: ['websocket'] // Ép sử dụng websocket để tránh lỗi polling nếu có
});

// Sự kiện khi kết nối thành công
socket.on('connect', () => {
  console.log('✅ Kết nối thành công! Socket ID:', socket.id);
  
  // Test gửi sự kiện subscribe
  const bearingId = 'bearing_001';
  console.log(`--- Đang gửi yêu cầu subscribe tới: ${bearingId} ---`);
  socket.emit('subscribe', bearingId);
});

// Sự kiện khi có lỗi kết nối (ví dụ sai token)
socket.on('connect_error', (err) => {
  console.error('❌ Lỗi kết nối:', err.message);
  process.exit(1);
});

// Lắng nghe dữ liệu (nếu Kafka đang chạy và có data sẽ thấy ở đây)
socket.on('prediction', (data) => {
  console.log('📩 Nhận dữ liệu prediction:', data);
});

// Tự động đóng sau 5 giây để kết thúc test
setTimeout(() => {
  console.log('--- Kết thúc test sau 5 giây ---');
  socket.disconnect();
  process.exit(0);
}, 5000);
