## 2. Tầng Dữ liệu (Prisma Schema - `schema.prisma`)

### Tối ưu hiệu suất & Kiểu dữ liệu

- **Chuyển `Decimal` sang `Float`:** Các trường như `rulHours`, `pFail`, `healthScore`, `loadKn`, `confidenceGap` nên dùng `Float`. Trong PostgreSQL, `Decimal` không xác định độ chính xác sẽ gây lãng phí tài nguyên RAM và làm chậm các phép toán so sánh/sắp xếp.
    
- **Sử dụng Enum cho phân loại:** Thay thế các trường `String` tự do bằng `Enum` để đảm bảo tính toàn vẹn dữ liệu:
    
    - `Decision.decisionType` -> `enum DecisionType`
        
    - `AuditLog.entityType` -> `enum EntityType`
        
    - `RuntimeConfig.configGroup` -> `enum ConfigGroup`
        

### Tối ưu truy vấn (Indexing)

Cần bổ sung Index cho các cột thường xuyên xuất hiện trong mệnh đề `WHERE` hoặc `ORDER BY` của API:

- **Model `AuditLog`**: Thêm `@@index([entityType, entityId])` để hỗ trợ tra cứu lịch sử theo thực thể.
    
- **Model `Decision`**: Thêm `@@index([decisionStatus])` để tối ưu các API lọc danh sách theo trạng thái.
    

### Rủi ro mất dữ liệu (Cascade Delete)

- **Hiện trạng:** Đang dùng `onDelete: Cascade` cho hầu hết các quan hệ chính.
    
- **Rủi ro:** Nếu xóa nhầm 1 bản ghi `Bearing`, toàn bộ dữ liệu lịch sử AI và Log sẽ bị xóa sạch.
    
- **Đề xuất:** Chuyển sang mô hình **Soft Delete** (thêm cột `active` hoặc `deletedAt`) hoặc sử dụng `onDelete: Restrict` cho các bảng chứa dữ liệu lịch sử quan trọng.
    

---

## 3. Khởi tạo dữ liệu (Seeding - `seed.js`)

### Tính Idempotent (Chạy lại nhiều lần)

- **Lỗi:** Phần tạo `RuntimeConfig` đang dùng `.create()`. Nếu chạy lệnh seed lần thứ 2, DB sẽ bị nhân đôi dữ liệu gây lỗi logic config.
    
- **Giải pháp:** Thêm ràng buộc `@unique` cho `configKey` trong schema và sử dụng `.upsert()` trong file seed.
    

### Bảo mật mật khẩu Admin

- **Lỗi:** Mật khẩu đang được hardcode dạng text tĩnh (`'hashed_password_here'`), khiến account admin không thể đăng nhập thực tế.
    
- **Giải pháp:** Sử dụng thư viện `bcrypt` để băm mật khẩu thật khi seed.
    

> **Gợi ý code:**
> 
> JavaScript
> 
> ```
> const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
> // ... sau đó đưa hashedPassword vào mục create của user Admin
> ```