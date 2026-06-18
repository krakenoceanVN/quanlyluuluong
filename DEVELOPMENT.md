# Tài liệu phát triển — 流量管理系统 (Traffic Management System)

Tài liệu này dành cho lập trình viên sẽ bảo trì / mở rộng hệ thống. Phần "chạy nhanh" xem
[README.md](README.md); ở đây tập trung vào **kiến trúc, quy ước, luồng dữ liệu** và **hướng dẫn
từng bước** cho các tác vụ hay gặp.

---

## 1. Tech stack & lý do chọn

| Lớp | Công nghệ | Vai trò |
|---|---|---|
| Web | React 18 + TypeScript + Vite | SPA, build nhanh, HMR |
| UI | Ant Design 5 + Recharts | Bảng/form/modal sẵn có; biểu đồ đường |
| Data fetching | TanStack Query v5 | Cache, invalidate, loading/error tự động |
| API | NestJS 10 | DI, module hoá, guard/interceptor/filter |
| ORM | Prisma 5 + PostgreSQL | Type-safe, migration |
| Cache/counter | Redis (ioredis) | Đếm lưu lượng realtime + cache config |
| Auth | JWT (access/refresh) + bcrypt | Stateless auth |
| Hạ tầng | Docker Compose | postgres + redis + api + web |

---

## 2. Cấu trúc thư mục

```
quanlyluuluong/
├─ docker-compose.yml          # 4 service: postgres, redis, api, web
├─ .env.example / .env         # MỘT file cấu hình dùng chung (root)
├─ package.json                # npm workspaces (apps/*)
├─ README.md                   # chạy nhanh
├─ DEVELOPMENT.md              # tài liệu này
├─ traffic-management-prototype.html  # prototype tĩnh ban đầu (tham chiếu)
│
├─ apps/api/                   # Backend NestJS
│  ├─ prisma/
│  │  ├─ schema.prisma         # 8 model
│  │  ├─ seed.ts               # dữ liệu mẫu (idempotent)
│  │  └─ migrations/           # migration đã áp
│  ├─ src/
│  │  ├─ main.ts               # bootstrap: prefix, pipe, filter, interceptor
│  │  ├─ app.module.ts         # khai báo toàn bộ module
│  │  ├─ common/               # cross-cutting (response, exception, dto chung, decorator)
│  │  ├─ prisma/               # PrismaService (global)
│  │  ├─ redis/                # RedisService (global)
│  │  ├─ flow/                 # FlowService — đếm lưu lượng + cache invalidation (global)
│  │  ├─ audit/                # AuditService + GET /audit-logs (global)
│  │  ├─ auth/                 # login/refresh, JWT strategy, guard
│  │  ├─ trackers/ ads/ links/ # 3 resource CRUD
│  │  ├─ reports/              # /dashboard, /traffic
│  │  └─ engine/              # /main/link/:code, weighted-random, sync worker
│  └─ test/                    # e2e
│
└─ apps/web/                   # Frontend React
   ├─ src/
   │  ├─ main.tsx              # providers: ConfigProvider(zhCN), QueryClient, Router, Auth
   │  ├─ App.tsx               # routes + Protected
   │  ├─ auth.tsx              # AuthProvider / useAuth
   │  ├─ api/
   │  │  ├─ client.ts          # axios + JWT + refresh + unwrap
   │  │  └─ endpoints.ts       # mọi lời gọi API
   │  ├─ components/           # AppLayout, PageHead, EditableText
   │  ├─ pages/                # 7 trang
   │  ├─ types.ts hooks.ts styles.css
   └─ nginx.conf               # phục vụ SPA + proxy /api,/main → api
```

**Nguyên tắc**: backend là nguồn sự thật duy nhất; frontend không tính toán nghiệp vụ (trọng số,
giới hạn, đếm lưu lượng) — chỉ hiển thị và gọi API.

---

## 3. Luồng dữ liệu

### 3.1 Request quản trị (CRUD)
```
Web (TanStack Query) → axios (gắn Bearer JWT) → Nest
  → JwtAuthGuard (xác thực)
  → ValidationPipe (DTO class-validator; lỗi → 422 + fields)
  → Controller → Service (nghiệp vụ + Prisma + AuditService.log)
  → ResponseInterceptor bọc { code, message, data }
  ← Web nhận data, invalidate query liên quan để đồng bộ
```

### 3.2 Request engine (công khai, KHÔNG cần JWT)
```
End-user → GET /main/link/:shortCode (ngoài prefix /api/v1)
  → EngineService.serve():
     1. Lấy config link (Redis cache 30s, miss → DB rồi cache)
     2. Lọc ad: membership ON + ad ON + chưa chạm dailyLimit (đọc Redis counter)
     3. pickWeighted() chọn 1 ad theo trọng số
     4. FlowService.increment() — INCR Redis (seed từ DB nếu key nguội)
     5. Có tracker → HTML mỏng nhúng tracker rồi redirect; không → 302
  → SyncWorker mỗi 60s: đọc set "dirty" → upsert TrafficDaily (giá trị tuyệt đối, idempotent)
```

### 3.3 "Today / realtime" được tính thế nào
- Bộ đếm sống nằm ở Redis key `flow:{linkAdId}:{yyyy-mm-dd}` (TTL 48h).
- `FlowService.getTodayMap()` đọc Redis trước; key nguội thì fallback `TrafficDaily` trong DB.
- Worker ghi **giá trị tuyệt đối** từ Redis vào DB → chạy lại không trùng lặp (idempotent).
- Trang 首页 poll `/dashboard` mỗi 5s khi xem ngày hôm nay.

---

## 4. Quy ước code (BẮT BUỘC tuân theo khi thêm mới)

### 4.1 Response & lỗi
- Mọi response JSON tự được bọc `{ code: 0, message: 'ok', data }` bởi
  [ResponseInterceptor](apps/api/src/common/response.interceptor.ts). Service chỉ cần `return data`.
- Lỗi nghiệp vụ "đang được dùng" → ném `BusinessConflictException` (**409**),
  xem [common/app.exceptions.ts](apps/api/src/common/app.exceptions.ts).
- Lỗi validate DTO → tự động **422** kèm `fields` (map field → message), cấu hình ở
  [main.ts](apps/api/src/main.ts).
- Engine ghi thẳng response (`@Res()`) nên KHÔNG bị interceptor bọc.

### 4.2 Validation
- Mỗi resource có thư mục `dto/` dùng `class-validator`. Ví dụ
  [links/dto/link.dto.ts](apps/api/src/links/dto/link.dto.ts).
- Query phân trang kế thừa [PaginationQueryDto](apps/api/src/common/dto/pagination.dto.ts)
  (`page`, `pageSize` ≤ 1000, `keyword`).

### 4.3 Audit log
- **Mọi thao tác ghi** (create/update/delete/toggle) PHẢI gọi `AuditService.log(...)` trong service,
  kèm `detail` chứa `before`/`after` khi là sửa. Xem mẫu ở
  [ads.service.ts](apps/api/src/ads/ads.service.ts).
- Module/action quy ước: `module` = tên tiếng Trung ('链接管理'/'广告管理'/'统计管理');
  `action` ∈ `create|update|delete|online|offline|replace-ads|update-ad`.
  Frontend dịch action sang câu mô tả ở [LogsPage.tsx](apps/web/src/pages/LogsPage.tsx).

### 4.4 Soft-delete & ràng buộc
- Xóa Link/Ad/Tracker là **soft-delete** (`deletedAt`). Mọi truy vấn list/detail phải lọc
  `deletedAt: null`.
- Trước khi xóa: kiểm tra ràng buộc (xem `usageCount`), vi phạm → 409.

### 4.5 Cache invalidation
- Bất cứ khi nào sửa thứ ảnh hưởng tới engine (link, membership, status ad, code tracker) phải gọi
  `FlowService.invalidateLinkConfig(shortCode)` để xoá cache Redis. Xem các service tương ứng.

### 4.6 Frontend
- Gọi API qua [api/endpoints.ts](apps/web/src/api/endpoints.ts) (không gọi axios rải rác).
- Đọc dữ liệu bằng `useQuery`, ghi bằng `useMutation` + `qc.invalidateQueries(...)` để đồng bộ.
- Tái dùng component: [PageHead](apps/web/src/components/PageHead.tsx),
  [EditableText](apps/web/src/components/EditableText.tsx) (sửa tại chỗ, Enter lưu / Esc huỷ).
- Toàn bộ chuỗi gửi lên là UTF‑8 (tiếng Việt/Trung đều OK) — **không** test bằng PowerShell/Git Bash
  với ký tự có dấu (shell Windows phá encoding); dùng Node hoặc chính giao diện.

---

## 5. Cấu hình môi trường

- Chỉ **một** `.env` ở thư mục gốc. App đọc qua `ConfigModule` (envFilePath `['.env','../../.env']`),
  các lệnh Prisma đọc qua `dotenv-cli` (`-e ../../.env`).
- Biến quan trọng (xem [.env.example](.env.example)):
  `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_TTL`,
  `JWT_REFRESH_TTL`, `PUBLIC_LINK_DOMAIN` (không hard-code domain), `TRAFFIC_SYNC_INTERVAL_SEC`,
  `LINK_CACHE_TTL_SEC`, `DISABLE_SYNC_WORKER` (đặt `1` để tắt worker, dùng khi chạy e2e).
- **Cổng Postgres**: máy dev có Postgres cục bộ 5432 → Docker map ra **5433**; `.env` trỏ `localhost:5433`.
  Trong mạng Docker, service `api` dùng `postgres:5432` (compose ghi đè `DATABASE_URL`).

---

## 6. Cơ sở dữ liệu

8 model: `User · Link · Ad · LinkAd · Tracker · LinkTracker · TrafficDaily · AuditLog`
([schema.prisma](apps/api/prisma/schema.prisma)).

Quan hệ cốt lõi:
- `Link` N–N `Ad` qua **`LinkAd`** (mang cấu hình `weight/dailyLimit/note/status/sortOrder`).
- `Link` N–N `Tracker` qua **`LinkTracker`**.
- `TrafficDaily` 1 dòng / (linkAd, ngày), `@@unique([linkAdId, date])`.

Lệnh:
```bash
npm run prisma:migrate -w apps/api   # tạo migration mới khi đổi schema (dev)
npm run prisma:deploy  -w apps/api   # áp migration ở production
npm run prisma:seed    -w apps/api   # seed (idempotent: bỏ qua nếu đã có admin)
npm run prisma:reset   -w apps/api   # ⚠️ drop + migrate + seed lại (mất dữ liệu)
npm run prisma:studio  -w apps/api   # GUI xem/sửa DB
```

Sau khi sửa `schema.prisma` luôn chạy `prisma:migrate` (tạo migration) rồi `prisma generate`
(tự chạy trong `build`). Đổi enum/field → cập nhật DTO + type frontend tương ứng.

---

## 7. Công thức thêm tính năng (end-to-end)

### 7.1 Thêm một TRƯỜNG mới (ví dụ: thêm `priority` cho `Ad`)

1. **Schema**: thêm `priority Int @default(0)` vào model `Ad` trong
   [schema.prisma](apps/api/prisma/schema.prisma) → `npm run prisma:migrate -w apps/api`.
2. **DTO**: thêm field vào `CreateAdDto`/`UpdateAdDto` ([ads/dto/ad.dto.ts](apps/api/src/ads/dto/ad.dto.ts))
   với decorator validate (`@IsInt() @Min(0)` …).
3. **Service**: ghi field khi create/update; thêm vào `detail` của audit nếu cần
   ([ads.service.ts](apps/api/src/ads/ads.service.ts)).
4. **Frontend type**: thêm vào `Ad` trong [types.ts](apps/web/src/types.ts).
5. **Frontend**: thêm cột bảng / ô form ở [AdsPage.tsx](apps/web/src/pages/AdsPage.tsx);
   cập nhật chữ ký `createAd/updateAd` trong [endpoints.ts](apps/web/src/api/endpoints.ts).
6. Nếu trường ảnh hưởng engine → đưa vào config cache + gọi invalidate.

### 7.2 Thêm một RESOURCE mới (module CRUD)

Sao chép khuôn `trackers/` (đơn giản nhất):
1. Tạo `src/<name>/` gồm `dto/`, `<name>.service.ts`, `<name>.controller.ts`, `<name>.module.ts`.
2. Controller: `@UseGuards(JwtAuthGuard)`, dùng `@CurrentUser()` lấy `userId` truyền xuống service.
3. Service: inject `PrismaService`, `AuditService` (+ `FlowService` nếu đụng engine). Mọi write gọi audit.
4. Đăng ký module trong [app.module.ts](apps/api/src/app.module.ts) (`imports: [...]`).
5. Thêm hàm gọi trong [endpoints.ts](apps/web/src/api/endpoints.ts) + type trong `types.ts`.
6. (Tuỳ chọn) thêm trang + route trong [App.tsx](apps/web/src/App.tsx) và mục menu trong
   [AppLayout.tsx](apps/web/src/components/AppLayout.tsx).

### 7.3 Thêm một TRANG frontend

1. Tạo `src/pages/XxxPage.tsx`, dùng `PageHead`, `useQuery`/`useMutation`.
2. Khai báo `<Route>` trong [App.tsx](apps/web/src/App.tsx) (đặt trong `<Protected>`).
3. Thêm mục vào mảng `MENU` của [AppLayout.tsx](apps/web/src/components/AppLayout.tsx)
   (key = path để highlight đúng).

---

## 8. Engine phân phối (chi tiết)

File: [engine/](apps/api/src/engine/), [flow/flow.service.ts](apps/api/src/flow/flow.service.ts).

- **Redis keys** (tập trung ở [engine/traffic.keys.ts](apps/api/src/engine/traffic.keys.ts)):
  - `flow:{linkAdId}:{date}` — bộ đếm ngày.
  - `link:cfg:{shortCode}` — config link đã cache (JSON).
  - `flow:dirty` — set các counter cần đồng bộ về DB.
- **pickWeighted** ([weighted-random.ts](apps/api/src/engine/weighted-random.ts)): hàm thuần,
  nhận `rng` để test xác định; trọng số ≤ 0 coi như 0; tất cả 0 → chọn đều.
- **Giới hạn & dồn lưu lượng**: ad chạm `dailyLimit` bị loại khỏi danh sách ứng viên → lưu lượng tự
  dồn sang ad còn lại theo trọng số. Hết ứng viên → trang fallback `暂无可用内容`.
- **increment** seed từ DB khi key nguội (Lua atomic) — tránh đếm lại từ 0 sau khi Redis restart.
- **SyncWorker** ([sync.worker.ts](apps/api/src/engine/sync.worker.ts)): `setInterval` mỗi
  `TRAFFIC_SYNC_INTERVAL_SEC`; drain `flow:dirty`, upsert giá trị tuyệt đối. Đặt `DISABLE_SYNC_WORKER=1`
  để tắt (e2e tự gọi `worker.flush()` thủ công).

---

## 9. Auth & phân quyền

- `POST /auth/login` trả `accessToken` (ngắn) + `refreshToken` (dài) + `user`.
- Frontend lưu token ở `localStorage`; axios tự gắn Bearer và **tự refresh** khi gặp 401
  ([api/client.ts](apps/web/src/api/client.ts)).
- `JwtStrategy` ([auth/jwt.strategy.ts](apps/api/src/auth/jwt.strategy.ts)) gắn `req.user`
  `{ userId, username, role }`; lấy trong controller bằng `@CurrentUser()`.
- Role `ADMIN|OPERATOR` đã có trong model; nếu cần chặn theo role, viết thêm `RolesGuard` + decorator
  `@Roles('ADMIN')` (chưa bật trong bản hiện tại).

---

## 10. Frontend patterns

- **Data**: `useQuery({ queryKey, queryFn })`; key gồm cả tham số filter để cache đúng. Mutation xong
  gọi `qc.invalidateQueries({ queryKey: [...] })` → các trang liên quan tự cập nhật (đồng bộ).
- **Sửa tại chỗ**: [EditableText](apps/web/src/components/EditableText.tsx) — click để sửa, Enter lưu,
  Esc/blur huỷ; có `parse` cho trường số.
- **Transfer 2 cột** (gán ad vào link): dùng AntD `Transfer` ở
  [LinkEditPage.tsx](apps/web/src/pages/LinkEditPage.tsx), submit gọi `PUT /links/:id/ads` (thay toàn bộ).
- **Realtime**: `refetchInterval: 5000` khi xem hôm nay ở [HomePage.tsx](apps/web/src/pages/HomePage.tsx).
- **i18n**: UI đang tiếng Trung giản thể theo đặc tả. Muốn đổi sang tiếng Việt: sửa text trong các trang
  + `ConfigProvider locale` ở [main.tsx](apps/web/src/main.tsx).

---

## 11. Kiểm thử

```bash
npm run test     -w apps/api    # unit (jest)
npm run test:e2e -w apps/api    # e2e (cần Postgres+Redis đang chạy)
```

- **Unit** đặt cạnh file `*.spec.ts`. Mẫu:
  - logic thuần: [weighted-random.spec.ts](apps/api/src/engine/weighted-random.spec.ts)
  - service mock Prisma/Redis: [engine.service.spec.ts](apps/api/src/engine/engine.service.spec.ts),
    [ads.service.spec.ts](apps/api/src/ads/ads.service.spec.ts)
- **e2e**: [test/app.e2e-spec.ts](apps/api/test/app.e2e-spec.ts) dựng app thật + Postgres + Redis,
  chạy luồng tracker→link→ad→engine→counter→sync→ràng buộc xóa.
- Viết test mới: ưu tiên tách logic thuần để test không cần DB; service test thì mock Prisma bằng
  object có `jest.fn()`.

---

## 12. Build & Deploy

- **Dev**: xem [README.md](README.md) mục "Chạy thủ công".
- **Docker**: `docker compose up --build`. Hai Dockerfile multi-stage:
  - [apps/api/Dockerfile](apps/api/Dockerfile): build (prisma generate + nest build) → runtime
    node:20-alpine (cài `openssl` cho Prisma musl). Lệnh compose: `migrate deploy && seed && start`.
  - [apps/web/Dockerfile](apps/web/Dockerfile): build Vite → nginx phục vụ tĩnh + proxy `/api`,`/main`.
- Deps được hoist lên `node_modules` ở root (npm workspaces) → Dockerfile copy root `node_modules`.
- Production checklist: đổi `JWT_*_SECRET`, đặt `PUBLIC_LINK_DOMAIN` đúng tên miền thật, dùng Postgres/Redis
  có sao lưu, bật HTTPS trước nginx.

---

## 13. Sự cố thường gặp (gotchas)

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `redis error` lặp lại, API crash khi `npm run dev` | chạy ở `apps/api`, không nạp `.env` gốc | đã fix bằng envFilePath; đảm bảo có `.env` ở gốc |
| `EADDRINUSE :3000` | container `api` đang chạy | `docker compose stop api` trước khi dev host |
| Prisma `P1000 auth failed` ở localhost:5432 | đụng Postgres cục bộ | dùng cổng **5433** (đã map trong compose/.env) |
| Prisma trên Docker: `Could not parse schema engine response` | Alpine thiếu OpenSSL | Dockerfile đã `apk add openssl` + `binaryTargets` musl |
| Tiếng Việt thành `?` | test bằng PowerShell/Git Bash phá UTF‑8 | test bằng Node hoặc giao diện; app lưu UTF‑8 đúng |
| `pageSize must not be greater than 200` | picker tải >200 bản ghi | giới hạn đã nâng lên 1000 trong PaginationQueryDto |

---

## 14. Hướng mở rộng gợi ý

- Sửa `shortCode` sau khi tạo (trang 链接编辑) + cảnh báo URL cũ sẽ hỏng.
- `RolesGuard` chặn thao tác ghi cho `OPERATOR`.
- Lọc phía server cho ô "广告单名称" ở trang 数据查询 (hiện lọc client).
- Phân tách bundle frontend (chunk lớn ~1.6MB) bằng dynamic import.
- Thêm chỉ số/biểu đồ theo giờ; export CSV cho 数据查询 và 操作日志.
- Healthcheck cho service `api` trong docker-compose; CI chạy `lint + test + build`.
```
