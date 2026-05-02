# Team Shared Contract
# Risk-Aware Multi-Agent Predictive Maintenance System

> Tài liệu thống nhất cho toàn team khi phát triển hệ thống.
>
> Mục tiêu của file này là làm **single source of truth** cho 3 lớp thông tin:
> - **Database Schema**
> - **Data Contract**
> - **API Contract**
>
> File này **không chứa code**. Chỉ mô tả các quy ước, cấu trúc dữ liệu, và hợp đồng giao tiếp giữa các thành phần.

---

## 1. Mục đích sử dụng

File này được dùng chung bởi:
- **Frontend team**: biết chính xác field nào có thể hiển thị, field nào optional, enum nào cần map sang UI
- **Backend team**: biết schema DB nào cần tạo, response nào cần trả về, endpoint nào cần giữ ổn định
- **AI / Orchestrator team**: biết event nào cần publish, payload nào cần persist, decision nào cần ghi audit
- **DevOps / QA**: biết health, metrics summary, versioning và behavior contract để kiểm thử

Nguyên tắc:
- Tên field phải nhất quán giữa DB, API, và event payload
- Mọi enum phải được định nghĩa rõ
- Mọi timestamp dùng chuẩn ISO 8601 UTC
- Mọi ID phải stable, không phụ thuộc UI
- Mọi thay đổi breaking contract phải được review liên team

---

## 2. Quy ước chung

### 2.1 Naming convention

- Database table: `snake_case`, số nhiều
- Database column: `snake_case`
- API JSON field: `snake_case`
- Enum value: `UPPER_SNAKE_CASE`
- WebSocket / event type: `dot.case` hoặc `snake_case`, nhưng phải thống nhất toàn hệ thống

Khuyến nghị dùng các prefix sau:
- `bearing_*` cho đối tượng liên quan bearing
- `prediction_*` cho dự đoán
- `decision_*` cho HITL decision
- `agent_*` cho negotiation / transcript

### 2.2 Time convention

- Tất cả timestamp lưu và truyền dưới dạng UTC
- Format chuẩn:
  - `2026-05-01T10:00:00Z`
- UI được phép convert sang local timezone khi hiển thị, nhưng dữ liệu gốc luôn là UTC

### 2.3 ID convention

- `bearing_id`: định danh nghiệp vụ, ví dụ `XJT-B1`
- `prediction_id`: UUID
- `snapshot_id`: UUID
- `decision_id`: UUID
- `event_id`: UUID
- `user_id`: UUID

### 2.4 Nullability convention

- Field nào bắt buộc phải luôn có giá trị trong mọi response production thì đánh dấu là `required`
- Field chỉ có trong một số phase hoặc scenario thì đánh dấu `optional`
- Không dùng chuỗi rỗng để thay cho `null`

### 2.5 Versioning convention

- API version theo URL: `/api/v1`
- Event payload có `schema_version`
- Khi có thay đổi breaking:
  - API tạo version mới
  - Event phải tăng `schema_version`

---

## 3. Domain model tổng quát

Hệ thống xoay quanh các thực thể chính:

1. **Bearing**
   - Đối tượng thiết bị đang được theo dõi
2. **Prediction**
   - Kết quả suy luận tại một thời điểm cho một bearing
3. **Snapshot**
   - Ảnh chụp trạng thái phục vụ decision / investigation
4. **Decision**
   - Một yêu cầu con người review và xác nhận hành động
5. **Decision Action**
   - Hành động cuối cùng do operator thực hiện
6. **Override Preference**
   - Dữ liệu lưu lại khi con người override AI recommendation
7. **Agent Transcript**
   - Log của quá trình propose / critique / vote giữa các agent
8. **Runtime Config**
   - Cấu hình ngưỡng, policy, agent setting có hiệu lực tại runtime
9. **User**
   - Người dùng hệ thống
10. **Audit Log**
   - Nhật ký thay đổi mang tính truy vết

---

## 4. Database Schema

## 4.1 Bảng `bearings`

**Mục đích:**
- Lưu thông tin master data của từng bearing

| Column | Type | Required | Mô tả |
|---|---|---|---|
| `id` | UUID | yes | Primary key nội bộ |
| `bearing_id` | VARCHAR | yes | Mã nghiệp vụ duy nhất, ví dụ `XJT-B1` |
| `display_name` | VARCHAR | yes | Tên hiển thị trên UI |
| `dataset_source` | VARCHAR | yes | Nguồn dữ liệu, ví dụ `XJTU-SY` |
| `condition_label` | VARCHAR | yes | Điều kiện vận hành, ví dụ `35HZ_12KN` |
| `rpm` | INTEGER | optional | Tốc độ quay nếu có |
| `load_kn` | NUMERIC | optional | Tải trọng nếu có |
| `installation_date` | TIMESTAMP | optional | Ngày đưa vào sử dụng |
| `status` | VARCHAR | yes | Trạng thái hiện tại của bearing |
| `active` | BOOLEAN | yes | Bearing còn được monitor hay không |
| `created_at` | TIMESTAMP | yes | Thời điểm tạo record |
| `updated_at` | TIMESTAMP | yes | Thời điểm cập nhật gần nhất |

**Constraints:**
- `bearing_id` là unique
- `status` phải thuộc tập enum `BearingStatus`

**Quan hệ:**
- 1 bearing có nhiều predictions
- 1 bearing có nhiều snapshots
- 1 bearing có nhiều decisions gián tiếp qua snapshots

---

## 4.2 Bảng `predictions`

**Mục đích:**
- Lưu toàn bộ kết quả dự đoán theo thời gian

| Column | Type | Required | Mô tả |
|---|---|---|---|
| `id` | UUID | yes | Primary key |
| `bearing_id` | UUID | yes | FK tới `bearings.id` |
| `file_idx` | INTEGER | yes | Thứ tự cửa sổ / sample trong timeline |
| `sample_ts` | TIMESTAMP | yes | Thời điểm dữ liệu gốc được gán |
| `rul_hours` | NUMERIC | yes | Remaining Useful Life theo giờ |
| `rul_lower_hours` | NUMERIC | optional | Cận dưới khoảng tin cậy |
| `rul_upper_hours` | NUMERIC | optional | Cận trên khoảng tin cậy |
| `p_fail` | NUMERIC | yes | Xác suất fail trong horizon định nghĩa |
| `health_score` | NUMERIC | yes | Điểm sức khỏe 0-100 |
| `uncertainty_score` | NUMERIC | optional | Mức độ bất định tổng hợp |
| `fault_type` | VARCHAR | optional | Loại fault dự đoán |
| `fault_confidence` | NUMERIC | optional | Độ tin cậy của fault type |
| `stat_score` | NUMERIC | optional | Thành phần statistical score |
| `rul_drop_score` | NUMERIC | optional | Thành phần RUL degradation score |
| `hybrid_score` | NUMERIC | optional | Điểm tổng hợp anomaly / escalation |
| `threshold_tau` | NUMERIC | optional | Ngưỡng xác suất fail áp dụng tại thời điểm đó |
| `model_version` | VARCHAR | yes | Version model tạo ra prediction |
| `pipeline_run_id` | VARCHAR | optional | Liên kết tới pipeline run hoặc MLflow run |
| `created_at` | TIMESTAMP | yes | Thời điểm prediction được persist |

**Constraints:**
- Unique composite: `(bearing_id, file_idx, model_version)` nếu cần theo dõi đa model
- `p_fail` nằm trong `[0, 1]`
- `health_score` nằm trong `[0, 100]`

**Indexes khuyến nghị:**
- `(bearing_id, file_idx desc)`
- `(bearing_id, sample_ts desc)`
- `(created_at desc)`

---

## 4.3 Bảng `snapshots`

**Mục đích:**
- Lưu snapshot dùng cho explainability, review, và ra quyết định

| Column | Type | Required | Mô tả |
|---|---|---|---|
| `id` | UUID | yes | Primary key |
| `bearing_id` | UUID | yes | FK tới `bearings.id` |
| `prediction_id` | UUID | yes | FK tới `predictions.id` |
| `snapshot_ts` | TIMESTAMP | yes | Thời điểm snapshot được tạo |
| `status` | VARCHAR | yes | Trạng thái snapshot |
| `trigger_source` | VARCHAR | yes | Nguồn tạo snapshot: anomaly, safety_veto, manual, scheduled |
| `feature_vector_ref` | VARCHAR | optional | Tham chiếu tới nơi lưu feature vector đầy đủ |
| `signal_window_ref` | VARCHAR | optional | Tham chiếu tới raw signal window nếu có |
| `summary_json` | JSONB | optional | Summary gọn cho UI / auditing |
| `created_at` | TIMESTAMP | yes | Thời điểm lưu DB |

**Mục đích của `summary_json`:**
- Lưu các field tóm tắt ổn định cho UI mà không phải join quá sâu trong mọi trường hợp

**Quan hệ:**
- 1 snapshot có thể có 0 hoặc 1 decision
- 1 snapshot có nhiều transcript entries

---

## 4.4 Bảng `decisions`

**Mục đích:**
- Lưu đối tượng decision đang chờ hoặc đã được operator xử lý

| Column | Type | Required | Mô tả |
|---|---|---|---|
| `id` | UUID | yes | Primary key |
| `snapshot_id` | UUID | yes | FK tới `snapshots.id` |
| `decision_type` | VARCHAR | yes | Loại decision |
| `recommended_action` | VARCHAR | yes | Hành động AI đề xuất |
| `recommended_confidence` | NUMERIC | optional | Độ tin cậy đề xuất |
| `decision_status` | VARCHAR | yes | `PENDING`, `RESOLVED`, `ACKNOWLEDGED` |
| `priority` | VARCHAR | yes | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `safety_veto` | BOOLEAN | yes | Có phải safety veto hay không |
| `reason_summary` | TEXT | optional | Tóm tắt lý do để hiển thị nhanh |
| `opened_at` | TIMESTAMP | yes | Lúc decision được tạo |
| `resolved_at` | TIMESTAMP | optional | Lúc được xử lý xong |
| `version` | INTEGER | yes | Dùng cho optimistic locking |
| `created_at` | TIMESTAMP | yes | Thời điểm insert |
| `updated_at` | TIMESTAMP | yes | Thời điểm update gần nhất |

**Constraints:**
- Mỗi `snapshot_id` chỉ có tối đa 1 decision active

---

## 4.5 Bảng `decision_actions`

**Mục đích:**
- Lưu hành động cuối cùng mà con người đã thực hiện trên decision

| Column | Type | Required | Mô tả |
|---|---|---|---|
| `id` | UUID | yes | Primary key |
| `decision_id` | UUID | yes | FK tới `decisions.id` |
| `action` | VARCHAR | yes | `APPROVE`, `OVERRIDE`, `REJECT`, `ACKNOWLEDGE` |
| `final_action` | VARCHAR | yes | Hành động thực tế cuối cùng áp dụng |
| `override_reason` | TEXT | optional | Lý do override nếu có |
| `actor_user_id` | UUID | yes | FK tới `users.id` |
| `actor_role` | VARCHAR | yes | Role của người thao tác tại thời điểm submit |
| `submitted_at` | TIMESTAMP | yes | Thời điểm submit |
| `source` | VARCHAR | yes | `WEB_UI`, `API`, `SYSTEM` |

**Lưu ý:**
- `decision_actions` là immutable log
- Không update record sau khi đã insert

---

## 4.6 Bảng `override_preferences`

**Mục đích:**
- Lưu dữ liệu phục vụ DPO / preference learning trong tương lai

| Column | Type | Required | Mô tả |
|---|---|---|---|
| `id` | UUID | yes | Primary key |
| `decision_id` | UUID | yes | FK tới `decisions.id` |
| `snapshot_id` | UUID | yes | FK tới `snapshots.id` |
| `ai_recommended_action` | VARCHAR | yes | Action AI đề xuất |
| `human_selected_action` | VARCHAR | yes | Action con người chọn |
| `override_reason` | TEXT | optional | Lý do textual |
| `confidence_gap` | NUMERIC | optional | Chênh lệch confidence nếu có |
| `created_at` | TIMESTAMP | yes | Thời điểm log |

---

## 4.7 Bảng `agent_transcripts`

**Mục đích:**
- Lưu chi tiết negotiation transcript giữa các agent

| Column | Type | Required | Mô tả |
|---|---|---|---|
| `id` | UUID | yes | Primary key |
| `snapshot_id` | UUID | yes | FK tới `snapshots.id` |
| `round_no` | INTEGER | yes | Round của negotiation |
| `agent_name` | VARCHAR | yes | Tên agent |
| `message_type` | VARCHAR | yes | `PROPOSE`, `CRITIQUE`, `VOTE`, `SUMMARY` |
| `action_candidate` | VARCHAR | optional | Action agent đang nghiêng về |
| `confidence` | NUMERIC | optional | Confidence của agent |
| `reasoning_text` | TEXT | yes | Nội dung reasoning |
| `created_at` | TIMESTAMP | yes | Thời điểm tạo |

**Indexes khuyến nghị:**
- `(snapshot_id, round_no, created_at)`

---

## 4.8 Bảng `runtime_configs`

**Mục đích:**
- Lưu versioned runtime config cho thresholds, agent settings, synthetic context

| Column | Type | Required | Mô tả |
|---|---|---|---|
| `id` | UUID | yes | Primary key |
| `config_group` | VARCHAR | yes | `THRESHOLDS`, `AGENTS`, `SYNTHETIC_CONTEXT` |
| `config_key` | VARCHAR | yes | Tên key |
| `config_value_json` | JSONB | yes | Giá trị config |
| `version_no` | INTEGER | yes | Version tăng dần |
| `is_active` | BOOLEAN | yes | Có phải bản đang active |
| `updated_by` | UUID | optional | FK tới `users.id` |
| `updated_at` | TIMESTAMP | yes | Thời điểm cập nhật |

---

## 4.9 Bảng `users`

**Mục đích:**
- Lưu người dùng hệ thống

| Column | Type | Required | Mô tả |
|---|---|---|---|
| `id` | UUID | yes | Primary key |
| `username` | VARCHAR | yes | Tên đăng nhập |
| `full_name` | VARCHAR | optional | Tên hiển thị |
| `email` | VARCHAR | optional | Email |
| `password_hash` | VARCHAR | yes | Hash mật khẩu |
| `role` | VARCHAR | yes | `VIEWER`, `OPERATOR`, `ENGINEER`, `ADMIN` |
| `active` | BOOLEAN | yes | Có đang hoạt động |
| `last_login_at` | TIMESTAMP | optional | Lần đăng nhập gần nhất |
| `created_at` | TIMESTAMP | yes | Thời điểm tạo |
| `updated_at` | TIMESTAMP | yes | Thời điểm cập nhật |

---

## 4.10 Bảng `audit_logs`

**Mục đích:**
- Lưu truy vết thay đổi nghiệp vụ và cấu hình

| Column | Type | Required | Mô tả |
|---|---|---|---|
| `id` | UUID | yes | Primary key |
| `entity_type` | VARCHAR | yes | `DECISION`, `CONFIG`, `AUTH`, `SYSTEM` |
| `entity_id` | VARCHAR | yes | ID đối tượng liên quan |
| `action` | VARCHAR | yes | Hành động thực hiện |
| `actor_user_id` | UUID | optional | Người thực hiện |
| `payload_json` | JSONB | optional | Snapshot dữ liệu liên quan |
| `created_at` | TIMESTAMP | yes | Thời điểm log |

---

## 4.11 Quan hệ giữa các bảng

- `bearings` 1 - N `predictions`
- `bearings` 1 - N `snapshots`
- `predictions` 1 - 1 hoặc 1 - N logic với `snapshots` tùy cách tạo snapshot
- `snapshots` 1 - 0/1 `decisions`
- `decisions` 1 - N `decision_actions`
- `decisions` 1 - 0/1 `override_preferences`
- `snapshots` 1 - N `agent_transcripts`
- `users` 1 - N `decision_actions`
- `users` 1 - N `runtime_configs`
- `users` 1 - N `audit_logs`

---

## 5. Data Contract

## 5.1 Enum definitions

### `BearingStatus`
- `NORMAL`
- `INSPECT`
- `NEGOTIATE`
- `MAINTAIN`
- `STOP`
- `OFFLINE`

### `FaultType`
- `INNER_RACE`
- `OUTER_RACE`
- `BALL`
- `CAGE`
- `UNKNOWN`

### `DecisionStatus`
- `PENDING`
- `RESOLVED`
- `ACKNOWLEDGED`

### `DecisionAction`
- `CONTINUE`
- `INSPECT`
- `MAINTAIN`
- `STOP`

### `OperatorAction`
- `APPROVE`
- `OVERRIDE`
- `REJECT`
- `ACKNOWLEDGE`

### `PriorityLevel`
- `LOW`
- `MEDIUM`
- `HIGH`
- `CRITICAL`

### `TriggerSource`
- `ANOMALY_TRIGGER`
- `SAFETY_VETO`
- `MANUAL_REQUEST`
- `SCHEDULED_CHECK`

### `AgentMessageType`
- `PROPOSE`
- `CRITIQUE`
- `VOTE`
- `SUMMARY`

---

## 5.2 Object contract: Bearing Summary

**Mục đích:**
- Dùng cho dashboard card, list view, quick summary

**Fields:**
- `bearing_id` required
- `display_name` required
- `condition_label` required
- `status` required
- `latest_prediction_at` required
- `health_score` required
- `rul_hours` required
- `p_fail` required
- `fault_type` optional
- `fault_confidence` optional
- `priority` optional
- `last_decision_status` optional

---

## 5.3 Object contract: Prediction Detail

**Mục đích:**
- Dùng cho detail page, chart timeline, analytics

**Fields:**
- `prediction_id` required
- `bearing_id` required
- `file_idx` required
- `sample_ts` required
- `rul_hours` required
- `rul_lower_hours` optional
- `rul_upper_hours` optional
- `p_fail` required
- `health_score` required
- `uncertainty_score` optional
- `fault_type` optional
- `fault_confidence` optional
- `stat_score` optional
- `rul_drop_score` optional
- `hybrid_score` optional
- `threshold_tau` optional
- `model_version` required

---

## 5.4 Object contract: Snapshot Summary

**Mục đích:**
- Dùng cho queue, decision list, audit summary

**Fields:**
- `snapshot_id` required
- `bearing_id` required
- `prediction_id` required
- `snapshot_ts` required
- `trigger_source` required
- `status` required
- `summary` optional

**Khuyến nghị `summary` nên chứa:**
- `p_fail`
- `rul_hours`
- `health_score`
- `fault_type`
- `uncertainty_score`
- `hybrid_score`

---

## 5.5 Object contract: Decision Summary

**Mục đích:**
- Dùng cho pending queue và decision cards

**Fields:**
- `decision_id` required
- `snapshot_id` required
- `bearing_id` required
- `decision_status` required
- `recommended_action` required
- `recommended_confidence` optional
- `priority` required
- `safety_veto` required
- `reason_summary` optional
- `opened_at` required
- `resolved_at` optional

---

## 5.6 Object contract: Decision Detail

**Mục đích:**
- Dùng cho screen review đầy đủ

**Fields:**
- `decision` required
- `snapshot` required
- `latest_prediction` required
- `agent_transcript` optional
- `available_operator_actions` required
- `audit_state` optional

**Yêu cầu business:**
- Nếu `safety_veto = true` thì `available_operator_actions` chỉ nên cho phép `ACKNOWLEDGE`
- Nếu decision đã resolved thì object detail vẫn đọc được nhưng không còn thao tác ghi

---

## 5.7 Object contract: Agent Transcript Entry

**Fields:**
- `round_no` required
- `agent_name` required
- `message_type` required
- `action_candidate` optional
- `confidence` optional
- `reasoning_text` required
- `created_at` required

---

## 5.8 Object contract: Runtime Threshold Config

**Fields:**
- `tau_star` required
- `hybrid_score_threshold` required
- `k_consecutive` required
- `cooldown_minutes` required
- `effective_version` required
- `updated_at` required
- `updated_by` optional

---

## 5.9 Object contract: Agent Config

**Fields:**
- `max_negotiation_rounds` required
- `llm_model_name` required
- `temperature` required
- `enable_safety_veto` required
- `enable_transcript_persistence` required
- `effective_version` required
- `updated_at` required
- `updated_by` optional

---

## 5.10 Object contract: Synthetic Context Config

**Fields:**
- `shift_remaining_hours` optional
- `throughput_priority` optional
- `cost_false_positive` optional
- `cost_false_negative` optional
- `notes` optional
- `effective_version` required

---

## 5.11 Event contract: Common envelope

Mọi event realtime hoặc message bus nên tuân thủ envelope chung:

- `event_id` required
- `event_type` required
- `schema_version` required
- `timestamp` required
- `source_service` required
- `payload` required

**Mục đích:**
- Giúp backend và frontend parse nhất quán
- Dễ logging, replay, và debug

---

## 5.12 Event contract: `bearing.status.updated`

**Khi nào phát sinh:**
- Có prediction mới làm thay đổi trạng thái hoặc summary realtime của bearing

**Payload tối thiểu:**
- `bearing_id`
- `status`
- `health_score`
- `rul_hours`
- `p_fail`
- `prediction_id`
- `sample_ts`

---

## 5.13 Event contract: `bearing.prediction.created`

**Khi nào phát sinh:**
- Prediction mới được persist thành công

**Payload tối thiểu:**
- `prediction_id`
- `bearing_id`
- `file_idx`
- `sample_ts`
- `rul_hours`
- `p_fail`
- `health_score`
- `model_version`

---

## 5.14 Event contract: `decision.created`

**Khi nào phát sinh:**
- Hệ thống tạo một decision mới cần operator xử lý

**Payload tối thiểu:**
- `decision_id`
- `snapshot_id`
- `bearing_id`
- `recommended_action`
- `priority`
- `safety_veto`
- `opened_at`

---

## 5.15 Event contract: `decision.resolved`

**Khi nào phát sinh:**
- Operator hoặc hệ thống vừa hoàn tất xử lý decision

**Payload tối thiểu:**
- `decision_id`
- `snapshot_id`
- `operator_action`
- `final_action`
- `actor_user_id`
- `resolved_at`

---

## 5.16 Event contract: `alert.safety_veto`

**Khi nào phát sinh:**
- Safety policy kích hoạt chặn hành động nguy hiểm

**Payload tối thiểu:**
- `bearing_id`
- `snapshot_id`
- `decision_id`
- `reason_summary`
- `priority`
- `triggered_at`

---

## 6. API Contract

## 6.1 Auth & authorization

### Authentication model

- Dùng JWT access token
- Có refresh token riêng
- Frontend gửi access token qua `Authorization: Bearer <token>`

### Role model

- `VIEWER`
  - chỉ đọc dashboard, detail, monitoring
- `OPERATOR`
  - đọc toàn bộ dữ liệu vận hành
  - submit approve / override / reject / acknowledge
- `ENGINEER`
  - có quyền cấu hình thresholds và agents
- `ADMIN`
  - toàn quyền, bao gồm user management nếu triển khai sau

### Permission rules tối thiểu

- `GET` data endpoints: `VIEWER+`
- `POST /decisions/{id}/action`: `OPERATOR+`
- `PATCH /config/*`: `ENGINEER+`

---

## 6.2 Response format chuẩn

### Success response

Response thành công nên theo format:
- `data`
- `meta` optional

### Error response

Response lỗi nên theo format:
- `error.code`
- `error.message`
- `error.detail` optional
- `error.request_id` optional

### Pagination meta

Khi endpoint trả danh sách phân trang, `meta` nên có:
- `total`
- `limit`
- `offset` hoặc `cursor`
- `next_cursor` nếu dùng cursor pagination

---

## 6.3 Endpoint group: Auth

### `POST /api/v1/auth/login`

**Mục đích:**
- Đăng nhập và nhận access token

**Request fields:**
- `username` required
- `password` required

**Response fields:**
- `access_token` required
- `refresh_token` required
- `token_type` required
- `expires_in` required
- `user` required

### `POST /api/v1/auth/refresh`

**Mục đích:**
- Cấp access token mới

**Request fields:**
- `refresh_token` required

**Response fields:**
- `access_token` required
- `refresh_token` optional
- `expires_in` required

### `POST /api/v1/auth/logout`

**Mục đích:**
- Invalidate refresh token

**Request fields:**
- `refresh_token` required

---

## 6.4 Endpoint group: Bearings

### `GET /api/v1/bearings`

**Mục đích:**
- Lấy danh sách bearings kèm latest status

**Query params:**
- `status` optional
- `condition_label` optional
- `priority` optional
- `limit` optional
- `offset` optional

**Response data shape:**
- list of `Bearing Summary`

### `GET /api/v1/bearings/{bearing_id}`

**Mục đích:**
- Lấy thông tin chi tiết một bearing

**Path params:**
- `bearing_id` required

**Response data shape:**
- bearing master info
- latest prediction summary
- latest decision summary optional

---

## 6.5 Endpoint group: Predictions

### `GET /api/v1/predictions/{bearing_id}`

**Mục đích:**
- Lấy lịch sử predictions của một bearing

**Query params:**
- `limit` optional
- `from_idx` optional
- `from_ts` optional
- `to_ts` optional

**Response data shape:**
- list of `Prediction Detail`
- pagination meta

### `GET /api/v1/predictions/{bearing_id}/latest`

**Mục đích:**
- Lấy prediction mới nhất

**Response data shape:**
- single `Prediction Detail`

---

## 6.6 Endpoint group: Snapshots

### `GET /api/v1/snapshots`

**Mục đích:**
- Lấy danh sách snapshots theo điều kiện lọc

**Query params:**
- `bearing_id` optional
- `status` optional
- `trigger_source` optional
- `limit` optional
- `offset` optional

**Response data shape:**
- list of `Snapshot Summary`

### `GET /api/v1/snapshots/{snapshot_id}`

**Mục đích:**
- Lấy chi tiết snapshot để phục vụ review / explainability

**Response data shape:**
- `snapshot`
- `prediction`
- `feature_vector_ref` optional
- `signal_window_ref` optional
- `agent_transcript` optional

---

## 6.7 Endpoint group: Decisions

### `GET /api/v1/decisions/pending`

**Mục đích:**
- Lấy queue các decisions đang chờ xử lý

**Query params:**
- `priority` optional
- `bearing_id` optional
- `safety_veto` optional
- `limit` optional
- `offset` optional

**Response data shape:**
- list of `Decision Summary`

### `GET /api/v1/decisions/{decision_id}`

**Mục đích:**
- Lấy chi tiết 1 decision

**Response data shape:**
- `Decision Detail`

### `POST /api/v1/decisions/{decision_id}/action`

**Mục đích:**
- Submit hành động của operator

**Request fields:**
- `operator_action` required
- `final_action` optional
- `override_reason` optional
- `client_version` optional

**Business rules:**
- Nếu `operator_action = APPROVE` thì `final_action` mặc định bằng `recommended_action`
- Nếu `operator_action = OVERRIDE` thì `final_action` là required
- Nếu `operator_action = OVERRIDE` thì `override_reason` nên là required
- Nếu `safety_veto = true` thì chỉ cho phép `ACKNOWLEDGE`
- Nếu decision đã resolved thì request phải bị từ chối
- Nếu `client_version` không khớp server version thì trả conflict

**Response data shape:**
- `decision_id`
- `decision_status`
- `operator_action`
- `final_action`
- `resolved_at`

### `GET /api/v1/decisions/history`

**Mục đích:**
- Xem lịch sử decisions đã xử lý

**Query params:**
- `bearing_id` optional
- `action` optional
- `date_from` optional
- `date_to` optional
- `limit` optional
- `offset` optional

**Response data shape:**
- list of resolved decisions với audit summary

---

## 6.8 Endpoint group: Config

### `GET /api/v1/config/thresholds`

**Mục đích:**
- Lấy cấu hình thresholds đang active

**Response data shape:**
- `Runtime Threshold Config`

### `PATCH /api/v1/config/thresholds`

**Mục đích:**
- Cập nhật thresholds

**Request fields:**
- `tau_star` optional
- `hybrid_score_threshold` optional
- `k_consecutive` optional
- `cooldown_minutes` optional

**Business rules:**
- Chỉ `ENGINEER+`
- Mọi thay đổi phải ghi `audit_logs`
- Không được cho phép giá trị vượt ngoài range validation đã định nghĩa

### `GET /api/v1/config/agents`

**Mục đích:**
- Lấy agent config đang active

### `PATCH /api/v1/config/agents`

**Mục đích:**
- Cập nhật cấu hình agent

**Request fields:**
- `max_negotiation_rounds` optional
- `llm_model_name` optional
- `temperature` optional
- `enable_safety_veto` optional
- `enable_transcript_persistence` optional

### `GET /api/v1/config/synthetic-context`

**Mục đích:**
- Lấy synthetic context đang active

### `PATCH /api/v1/config/synthetic-context`

**Mục đích:**
- Cập nhật synthetic context

---

## 6.9 Endpoint group: Monitoring

### `GET /api/v1/health`

**Mục đích:**
- Health check tổng hợp của service và dependencies

**Response data shape:**
- `service_status`
- `database_status`
- `redis_status`
- `orchestrator_status` optional
- `version`
- `timestamp`

### `GET /api/v1/metrics/summary`

**Mục đích:**
- Trả số liệu tổng hợp cho monitoring page

**Response data shape:**
- `decisions_today`
- `pending_decisions`
- `override_rate`
- `avg_negotiation_duration_seconds`
- `prediction_latency_p95_seconds`
- `active_ws_connections`

---

## 6.10 WebSocket contract

### Channel ` /ws/bearings/status `

**Mục đích:**
- Broadcast mọi thay đổi summary của bearings

**Message type chính:**
- `bearing.status.updated`

### Channel ` /ws/bearing/{bearing_id} `

**Mục đích:**
- Stream timeline và summary của một bearing cụ thể

**Message type chính:**
- `bearing.prediction.created`
- `bearing.status.updated`

### Channel ` /ws/decisions `

**Mục đích:**
- Notify decision queue thay đổi

**Message type chính:**
- `decision.created`
- `decision.resolved`

### Channel ` /ws/alerts `

**Mục đích:**
- Alert ưu tiên cao, đặc biệt safety veto

**Message type chính:**
- `alert.safety_veto`

### WS auth rule

- Client gửi JWT khi connect
- Token invalid hoặc expired thì server từ chối hoặc đóng kết nối
- Client phải tự reconnect sau khi refresh token

---

## 6.11 Error code catalog tối thiểu

- `UNAUTHORIZED`
- `FORBIDDEN`
- `BEARING_NOT_FOUND`
- `PREDICTION_NOT_FOUND`
- `SNAPSHOT_NOT_FOUND`
- `DECISION_NOT_FOUND`
- `DECISION_ALREADY_RESOLVED`
- `DECISION_VERSION_CONFLICT`
- `INVALID_OPERATOR_ACTION`
- `INVALID_CONFIG_VALUE`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

---

## 7. Business rules bắt buộc team phải thống nhất

1. Một decision sau khi resolved thì không được sửa lại.
2. Override phải được lưu dưới dạng dữ liệu có thể audit và tái sử dụng cho learning.
3. Safety veto có độ ưu tiên cao nhất và không được cho phép bypass bằng flow thường.
4. Dashboard luôn ưu tiên latest persisted prediction, không dùng dữ liệu chưa commit.
5. Frontend không tự suy diễn business logic nếu backend chưa xác nhận.
6. Mọi config runtime thay đổi phải có version và audit log.
7. Mọi timestamp trao đổi giữa services phải là UTC.

---

## 8. Phạm vi mở rộng trong tương lai

Các phần sau chưa bắt buộc ở version đầu nhưng nên chừa chỗ trong contract:
- User management đầy đủ
- Multi-site / multi-line support
- File upload inspection workflow
- Maintenance ticket integration
- Notification preference per user
- Model comparison mode giữa nhiều model versions

---

## 9. Checklist review trước khi implement

Trước khi frontend, backend, hoặc orchestrator bắt đầu code một feature mới, cần kiểm tra:

- Thực thể này đã có trong Database Schema chưa?
- Payload này đã có trong Data Contract chưa?
- Endpoint hoặc event này đã có trong API Contract chưa?
- Enum đã thống nhất tên chưa?
- Field nào required và field nào optional đã rõ chưa?
- Có cần audit log hoặc versioning không?
- Có ảnh hưởng backward compatibility không?

---

## 10. Kết luận

Tài liệu này là điểm tựa chung để cả team làm việc đồng bộ.

Nếu cần thay đổi:
- ưu tiên sửa file này trước
- sau đó mới cập nhật implementation details ở từng service
- mọi thay đổi liên quan contract phải được thông báo cho các team còn lại

Mục tiêu cuối cùng là:
- frontend không đoán sai dữ liệu
- backend không trả response mơ hồ
- orchestrator không publish event thiếu field
- toàn hệ thống giữ được tính nhất quán và khả năng mở rộng
