Đây là danh sách link và thông tin truy cập chính xác nhất qua **Tailscale** (IP: `100.109.46.15`) để bạn gửi cho các thành viên trong dự án:

### 1. Truy cập qua trình duyệt (Web UI)

| Dịch vụ | Link truy cập (Click để mở) | Chức năng |
| :--- | :--- | :--- |
| **Adminer** | [http://100.109.46.15:8080](http://100.109.46.15:8080) | Quản lý Database PostgreSQL |
| **Grafana** | [http://100.109.46.15:3000](http://100.109.46.15:3000) | Xem Dashboard, biểu đồ |
| **Redis Insight** | [http://100.109.46.15:5540](http://100.109.46.15:5540) | Quản lý, xem dữ liệu Redis |
| **Prometheus** | [http://100.109.46.15:9090](http://100.109.46.15:9090) | Kiểm tra dữ liệu Monitoring |

---

### 2. Thông số kết nối trực tiếp (Cho Code/App)

Nếu team bạn cần kết nối từ Source code (Python, Java, Node.js...) hoặc các Tool như DBeaver, TablePlus:

*   **PostgreSQL:**
    *   **Host:** `100.109.46.15`
    *   **Port:** `5432`
*   **Redis:**
    *   **Host:** `100.109.46.15`
    *   **Port:** `6379`

---

### 3. Lưu ý khi cấu hình bên trong các Tool (Quan trọng)

Khi các thành viên đăng nhập vào các giao diện Web để kết nối với Database, họ cần dùng **tên của service trong Docker** thay vì IP:

*   **Trong giao diện Adminer:**
    *   Hệ quản trị: **PostgreSQL**
    *   Máy chủ (Server): `postgre_db` (Đây là tên container trong mạng Docker)
    *   Tài khoản/Mật khẩu: Lấy từ file `.env` của bạn.
*   **Trong giao diện Redis Insight:**
    *   Host: `redis_cache`
    *   Port: `6379`
*   **Trong Grafana (Thêm Data Source):**
    *   Nếu chọn Prometheus: URL là `http://prometheus:9090`
    *   Nếu chọn PostgreSQL: Host là `postgre_db:5432`

**Yêu cầu đối với thành viên:** Tất cả các thành viên đều phải cài Tailscale và đăng nhập vào cùng một mạng (Tailnet) với máy lab thì mới mở được các link này.

POSTGRES_USER: admin
POSTGRES_PASSWORD: 123123
POSTGRES_DB: predictive-maintenance-db

GF_SECURITY_ADMIN_USER: admin
GF_SECURITY_ADMIN_PASSWORD: 123123