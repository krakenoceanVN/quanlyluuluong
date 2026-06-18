# 流量管理系统 · Traffic Management System

Hệ thống quản lý phân phối lưu lượng quảng cáo. Mỗi **链接 (link)** là một URL trung gian
`/main/link/{shortCode}`; khi người dùng truy cập, **engine** chọn một **广告 (ad)** đích theo
**trọng số (weight)** và **giới hạn ngày (dailyLimit)**, đếm lưu lượng theo thời gian thực bằng Redis,
và đồng bộ định kỳ về PostgreSQL. Mỗi link có thể gắn nhiều mã **统计 (tracker)** bên thứ ba.

## Kiến trúc

```
┌────────────┐      /api/v1 (JWT)       ┌──────────────────────────────┐
│  Web (SPA) │ ───────────────────────▶│  API  (NestJS)               │
│  React+AntD│                          │  ├─Auth (JWT access/refresh) │
└────────────┘                          │  ├─CRUD links/ads/trackers   │
      ▲  served by nginx                │  ├─Reports (dashboard/query) │
      │                                 │  ├─Audit log (mọi write)     │
 end-user                               │  └─Engine /main/link/:code   │
   │ GET /main/link/:code               │       │            │         │
   └───────────────────────────────────▶        ▼            ▼        │
                                        │  PostgreSQL      Redis       │
                                        │  (Prisma)    (counters,cache)│
                                        └──────────────────────────────┘
                              Worker: flush Redis counters → TrafficDaily mỗi 60s
```

- **Frontend**: React 18 + TypeScript + Vite + Ant Design + TanStack Query + React Router + Recharts.
- **Backend**: NestJS + Prisma + PostgreSQL + Redis (ioredis), validate bằng class-validator, JWT + bcrypt.
- **Infra**: Docker Compose (web + api + postgres + redis).

## Chạy nhanh bằng Docker

```bash
cp .env.example .env          # chỉnh secret nếu cần
docker compose up --build
```

- Web:    http://localhost:5173  (đăng nhập `admin` / `admin123`)
- API:    http://localhost:3000/api/v1
- Engine: http://localhost:3000/main/link/o702jib0  (link mẫu từ seed)

API container tự chạy `prisma migrate deploy` + seed (idempotent) trước khi khởi động.

## Chạy thủ công (không dùng image api/web — dev trên host)

Yêu cầu: Node ≥ 20. PostgreSQL + Redis có thể chạy bằng Docker (khuyến nghị) hoặc cài sẵn.

```bash
# 0) Cài dependencies cho cả workspace
npm install

# 1) Tạo file cấu hình (chỉ MỘT .env ở thư mục gốc là đủ)
cp .env.example .env

# 2) Bật Postgres + Redis (chỉ hạ tầng, KHÔNG bật container api)
docker compose up -d postgres redis
#    nếu trước đó đã chạy full stack, tắt api để nhả cổng 3000:
docker compose stop api

# 3) Tạo schema + seed dữ liệu mẫu (lệnh prisma tự đọc .env ở gốc qua dotenv-cli)
npm run prisma:migrate -w apps/api      # lần đầu: tạo & áp migration
npm run prisma:seed    -w apps/api      # admin/admin123 + dữ liệu mẫu (idempotent)

# 4) Chạy API (terminal 1)
npm run dev -w apps/api                  # http://localhost:3000  (NestJS watch mode)

# 5) Chạy Web (terminal 2)
npm run dev -w apps/web                  # http://localhost:5173  (Vite, proxy /api & /main → 3000)
```

Mở http://localhost:5173, đăng nhập **admin / admin123**.

> **Lưu ý cổng Postgres**: nếu máy đã có PostgreSQL cục bộ chiếm cổng 5432, Docker map sang **5433**
> (xem `docker-compose.yml`) và `.env` mẫu đã trỏ `DATABASE_URL=...localhost:5433`. Nếu bạn dùng
> PostgreSQL cài sẵn trên 5432 thì sửa lại `DATABASE_URL` cho khớp.

Lệnh hữu ích khác:
```bash
npm run prisma:studio -w apps/api        # xem/sửa DB bằng Prisma Studio
npm run test          -w apps/api        # unit test
npm run test:e2e      -w apps/api        # e2e (cần Postgres+Redis đang chạy)
npm run build                            # build cả hai app
```

## Dữ liệu seed

- 1 user admin: **admin / admin123**
- 2 tracker, 6 ad, 2 link (link `11-02-01` có 2 ad; `11-02-02` để trống)
- 7 ngày lưu lượng gần nhất cho các membership của link `11-02-01`

## Mô hình dữ liệu (Prisma — 8 model)

`User · Link · Ad · LinkAd · Tracker · LinkTracker · TrafficDaily · AuditLog`
(xem [apps/api/prisma/schema.prisma](apps/api/prisma/schema.prisma)).

Ràng buộc xóa (trả **409** kèm message):
- Xóa **Link** chỉ khi không còn `LinkAd`.
- Xóa **Ad** chỉ khi không nằm trong `LinkAd` nào.
- Xóa **Tracker** chỉ khi không `Link` nào dùng.

Xóa là **soft-delete** (`deletedAt`); `TrafficDaily` lịch sử được giữ nguyên.

## Engine phân phối — `GET /main/link/:shortCode`

1. Tìm link theo `shortCode`; không tồn tại / `status=off` → trang 404.
2. Lọc ad đủ điều kiện: `LinkAd.status` + `Ad.status` + chưa chạm `dailyLimit` hôm nay
   (đếm bằng Redis `flow:{linkAdId}:{yyyy-mm-dd}`, TTL 48h).
3. **Weighted random** trên các ứng viên còn lại — ad chạm giới hạn tự nhường lưu lượng cho ad khác.
   Không còn ứng viên → trang fallback `暂无可用内容`.
4. `INCR` Redis (không ghi DB mỗi request); worker đồng bộ về `TrafficDaily` mỗi 60s.
5. Có tracker → trả trang HTML mỏng nhúng mã tracker rồi redirect; không có → `302` trực tiếp.
6. Config link được cache trong Redis (mặc định 30s) và **invalidate** khi có chỉnh sửa
   link/ad/tracker liên quan.

## API (prefix `/api/v1`, tất cả cần JWT trừ engine & health)

| Method | Path | Mô tả |
|---|---|---|
| POST | `/auth/login` | đăng nhập, trả access+refresh |
| POST | `/auth/refresh` | làm mới token |
| GET | `/auth/me` | thông tin user hiện tại |
| GET/POST | `/links` | danh sách (`page,pageSize,keyword`) / tạo |
| GET/PATCH/DELETE | `/links/:id` | chi tiết / sửa / xóa (409 nếu còn ad) |
| PATCH | `/links/:id/status` | lên/xuống line |
| GET | `/links/:id/ads` | membership + lưu lượng hôm nay |
| PUT | `/links/:id/ads` | thay toàn bộ ad (transfer) |
| PATCH | `/links/:id/ads/:adId` | sửa weight/dailyLimit/note/status |
| GET/POST | `/ads` | danh sách / tạo (validate URL) |
| GET/PATCH/DELETE | `/ads/:id` | chi tiết / sửa / xóa (409 nếu đang dùng) |
| PATCH | `/ads/:id/status` | lên/xuống line |
| GET | `/ads/:id/links` | các link chứa ad này |
| GET/POST | `/trackers` | danh sách / tạo |
| GET/PATCH/DELETE | `/trackers/:id` | chi tiết / sửa / xóa (409 nếu đang dùng) |
| GET | `/dashboard?date=` | dữ liệu trang chủ |
| GET | `/traffic?from=&to=&linkId=&adKeyword=` | truy vấn lưu lượng |
| GET | `/audit-logs?module=&from=&to=&userId=&page=` | nhật ký thao tác |

Chuẩn response: `{ code, message, data }`; lỗi validate trả **422** kèm `fields`.

## Giao diện (6 trang)

首页 (dashboard realtime 5s) · 数据查询 (lọc + biểu đồ đường) · 链接管理 (inline edit, popup tạo) ·
链接编辑 (inline edit + transfer 2 cột) · 广告管理 · 统计管理 (2 cột) · 操作日志.

## Kiểm thử

```bash
npm run test       -w apps/api          # unit: weighted-random, limit cap, ràng buộc xóa
npm run test:e2e   -w apps/api          # e2e luồng đầy đủ (cần Postgres+Redis đã migrate)
```

Test chính:
- Phân phối weighted random ≈ trọng số trên 10.000 mẫu.
- Lưu lượng dồn sang ad còn lại khi một ad chạm `dailyLimit`; fallback khi tất cả chạm.
- Xóa Link/Ad/Tracker đang được dùng → ném `BusinessConflictException` (409).
- e2e: tạo tracker → link gắn tracker → ad → thêm ad vào link → gọi engine → counter tăng → sync DB.

## Biến môi trường

Xem [.env.example](.env.example). Quan trọng:
`DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
`PUBLIC_LINK_DOMAIN` (không hard-code domain), `TRAFFIC_SYNC_INTERVAL_SEC`, `LINK_CACHE_TTL_SEC`.

## Triển khai production

Deploy lên 1 máy ảo (Alibaba Cloud ECS) + tên miền + HTTPS tự động (Caddy): xem **[DEPLOY.md](DEPLOY.md)**.
Dùng `docker-compose.prod.yml` + `.env.production` (mẫu: `.env.production.example`).

## Tài liệu phát triển

Chi tiết kiến trúc, quy ước code, luồng dữ liệu và hướng dẫn mở rộng (thêm trường / resource / trang,
engine, test, deploy, sự cố thường gặp): xem **[DEVELOPMENT.md](DEVELOPMENT.md)**.

## Ghi chú

`traffic-management-prototype.html` ở thư mục gốc là bản prototype tĩnh ban đầu (một file HTML),
được giữ lại làm tham chiếu thiết kế. Sản phẩm thực tế là monorepo `apps/api` + `apps/web`.
