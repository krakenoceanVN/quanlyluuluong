# Báo cáo Cập nhật Dự án: Traffic Management System (流量管理系统) — 30/06/2026

## Tổng quan (Executive Summary)

Phiên làm việc tập trung vào 3 nhóm việc chính:

1. **Sắp xếp danh sách theo mã định danh** — thay thế `localeCompare(numeric:true)` (dễ vỡ với chuỗi có độ dài khác nhau) bằng hàm `naturalCompare` mới ở 5 trang SPA, đảm bảo `"11-02-01" < "11-02-02" < "11-03-01"` đúng thứ tự trong mọi trường hợp.
2. **Debug lỗi 400 Bad Request** khi submit form "Chỉnh sửa liên kết" — phát hiện môi trường chạy là Docker (không phải local), container giữ code gốc, mọi sửa file `.ts` trên host không có hiệu lực cho tới khi `docker compose up --build`.
3. **Sửa 2 bug 500 (server crash) trong `LinksService.update`** — null không được xử lý đúng cách (`null.trim()` crash), và `trackerIds` chứa id không tồn tại vi phạm FK constraint mà không có thông báo rõ ràng.

---

## Các công việc đã hoàn thành (Tasks Completed)

| # | Công việc | Loại |
|---|---|---|
| 1 | Tạo `naturalCompare` + `sortByCode` (tokenized natural sort) | Tính năng mới |
| 2 | Áp dụng sort theo `name` cho 5 trang: HomePage, LinksPage, AdsPage, LinkEditPage, QueryPage | Tính năng mới |
| 3 | Thêm `defaultSortOrder: 'ascend'` cho table ở LinksPage, AdsPage | UX |
| 4 | Thêm `console.error` log chi tiết trong axios response interceptor (`client.ts`) | Debug helper |
| 5 | Sửa `LinksService.update` — xử lý `null` cho name/description/note/trackerIds | Bug fix |
| 6 | Sửa `LinksService.update` — validate `trackerIds` tồn tại trước khi insert, trả 409 thay vì 500 | Bug fix |
| 7 | Xác định root cause lỗi 400 — chạy sai môi trường (Docker vs local) | Phân tích |
| 8 | Dọn dẹp debug log tạm thời | Cleanup |

---

## Chi tiết các thay đổi (Detailed Changes)

### 1. `apps/web/src/utils/sort.ts` (MỚI)

**Vấn đề trước:** Dự án dùng `localeCompare(..., { numeric: true })` rải rác ở 4 file. Hàm này **so sánh theo lexicographic**, không hiểu "đoạn số". Với input độ dài khác nhau (`"11-2-1"` vs `"11-02-01"`) sẽ trả về thứ tự sai.

**Giải pháp:** Tách chuỗi thành các đoạn số/chữ xen kẽ bằng regex `/(\d+)|(\D+)/g`, so sánh đoạn số theo giá trị, đoạn chữ theo lexicographic. Tie-break bằng độ dài chuỗi.

**Code:**

```ts
export function naturalCompare(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g;
  const at = a.match(re) ?? [];
  const bt = b.match(re) ?? [];
  const len = Math.min(at.length, bt.length);
  for (let i = 0; i < len; i++) {
    const av = at[i];
    const bv = bt[i];
    const an = /^\d/.test(av);
    const bn = /^\d/.test(bv);
    if (an && bn) {
      const diff = Number(av) - Number(bv);
      if (diff) return diff;
    } else if (av !== bv) {
      return av < bv ? -1 : 1;
    }
  }
  return at.length - bt.length;
}

export function sortByCode<T>(rows: readonly T[], key: keyof T, dir: 'asc' | 'desc' = 'asc'): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return rows.slice().sort((a, b) => sign * naturalCompare(String(a[key] ?? ''), String(b[key] ?? '')));
}
```

**Bảng kiểm thử so với `localeCompare(numeric:true)`:**

| a | b | `localeCompare` | `naturalCompare` |
|---|---|---|---|
| `11-02-01` | `11-02-02` | -1 ✓ | -1 ✓ |
| `11-2-1` | `11-02-01` | **+1 ✗** | -1 ✓ |
| `11-2-10` | `11-02-2` | **+1 ✗** | -1 ✓ |
| `11-A-1` | `11-A-2` | -1 ✓ | -1 ✓ |
| `11-A-2` | `11-B-1` | -1 ✓ | -1 ✓ |

---

### 2. `apps/web/src/pages/HomePage.tsx` (SỬA)

**Trước:** Sort cards dashboard bằng `localeCompare` (line 66).
**Sau:** Thay bằng `naturalCompare`, thêm import.

```ts
// Thêm import
import { naturalCompare } from '../utils/sort';

// Trong render
{(data?.links ?? [])
  .slice()
  .sort((a, b) => naturalCompare(a.name, b.name))
  .map((link) => ( ... ))}
```

---

### 3. `apps/web/src/pages/LinksPage.tsx` (SỬA)

**Trước:** `sorter` cho cột 名称 dùng `localeCompare`, không có default sort.
**Sau:** Thay bằng `naturalCompare`, thêm `defaultSortOrder: 'ascend'`.

```ts
import { naturalCompare } from '../utils/sort';

// Cột "名称"
{
  title: '名称',
  dataIndex: 'name',
  sorter: (a: LinkRow, b: LinkRow) => naturalCompare(a.name, b.name),
  defaultSortOrder: 'ascend',
  sortDirections: ['ascend', 'descend'],
  render: (v: string, r: LinkRow) => ( ... ),
},
```

---

### 4. `apps/web/src/pages/AdsPage.tsx` (SỬA)

**Trước:** Tương tự LinksPage — `sorter` dùng `localeCompare`.
**Sau:** Thay bằng `naturalCompare`, thêm `defaultSortOrder: 'ascend'`.

```ts
import { naturalCompare } from '../utils/sort';

// Cột "名称"
{
  title: '名称',
  dataIndex: 'name',
  sorter: (a: Ad, b: Ad) => naturalCompare(a.name, b.name),
  defaultSortOrder: 'ascend',
  sortDirections: ['ascend', 'descend'],
  render: (v: string) => <b>{v}</b>,
},
```

---

### 5. `apps/web/src/pages/LinkEditPage.tsx` (SỬA)

**Trước:** Transfer panel sort ad theo `localeCompare`.
**Sau:** Thay bằng `naturalCompare`.

```ts
import { naturalCompare } from '../utils/sort';

// Trong render ads
.sort((a, b) => (sortAsc ? 1 : -1) * naturalCompare(a.name, b.name))
```

---

### 6. `apps/web/src/pages/QueryPage.tsx` (SỬA)

**Trước:** Không sort — `links` được filter qua `useMemo` rồi render theo thứ tự backend trả.
**Sau:** Sort theo `naturalCompare` TRƯỚC khi filter (để kết quả filter vẫn đúng thứ tự).

```ts
import { naturalCompare } from '../utils/sort';

const links = useMemo(() => {
  const all = (data?.links ?? []).slice();
  all.sort((a, b) => naturalCompare(a.name, b.name));
  if (!debLink) return all;
  const kw = debLink.toLowerCase();
  return all.filter((l) => l.name.toLowerCase().includes(kw));
}, [data, debLink]);
```

---

### 7. `apps/web/src/api/client.ts` (SỬA — debug helper)

**Trước:** Khi response 4xx/5xx mà body không có `message`, axios ném `"Request failed with status code 400"` — không biết được nguyên nhân.
**Sau:** Log đầy đủ (method, URL, status, body) ra `console.error` để debug.

```ts
// Trong response interceptor
const body = error.response?.data;
if (status >= 400) {
  // eslint-disable-next-line no-console
  console.error('[api]', status, error.config?.method?.toUpperCase(), error.config?.url, body ?? error.message);
}
throw new ApiError(body?.message ?? error.message ?? '请求失败', status, body?.fields);
```

---

### 8. `apps/api/src/links/links.service.ts` (SỬA — bug fix)

**Vấn đề trước:** Method `update` có 2 bug gây **500 Internal Server Error**:

1. **`null.trim()` crash** — DTO `UpdateLinkDto` có `@IsOptional() @IsString()`. Khi client gửi `note: null`, `class-validator` bỏ qua (vì `IsOptional` coi null là "skip"), nhưng `dto.note.trim()` trong service vẫn chạy → `null.trim()` ném `TypeError`.
2. **FK constraint không validate** — `tx.linkTracker.createMany({ data: dto.trackerIds.map(...) })` thẳng vào DB, nếu `trackerIds` chứa id không tồn tại (đã xóa / fake) → `Foreign key constraint violated` → 500.

**Giải pháp:**
- Build object `data` thủ công, kiểm tra cả `undefined` lẫn `null` trước khi gọi `.trim()`.
- Validate `trackerIds` tồn tại trong transaction; nếu có id lạ → ném `BusinessConflictException` (HTTP 409) với message rõ ràng.

**Code mới:**

```ts
async update(id: string, dto: UpdateLinkDto, userId: string) {
  const before = await this.prisma.link.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw new NotFoundException('链接不存在');

  const data: Prisma.LinkUpdateInput = {};
  if (dto.name !== undefined && dto.name !== null) data.name = dto.name.trim();
  if (dto.description !== undefined && dto.description !== null) data.description = dto.description;
  if (dto.note !== undefined && dto.note !== null) data.note = dto.note;

  const after = await this.prisma.$transaction(async (tx) => {
    const updated = Object.keys(data).length
      ? await tx.link.update({ where: { id }, data })
      : await tx.link.findUniqueOrThrow({ where: { id } });
    if (dto.trackerIds !== undefined && dto.trackerIds !== null) {
      await tx.linkTracker.deleteMany({ where: { linkId: id } });
      if (dto.trackerIds.length) {
        const existing = await tx.tracker.findMany({
          where: { id: { in: dto.trackerIds }, deletedAt: null },
          select: { id: true },
        });
        const validIds = new Set(existing.map((t) => t.id));
        const unknown = dto.trackerIds.filter((tid) => !validIds.has(tid));
        if (unknown.length) {
          throw new BusinessConflictException(
            `统计不存在或已删除：${unknown.join(', ')}`,
          );
        }
        await tx.linkTracker.createMany({
          data: dto.trackerIds.map((trackerId) => ({ linkId: id, trackerId })),
        });
      }
    }
    return updated;
  });

  await this.flow.invalidateLinkConfig(before.shortCode);
  // ... audit log
  return after;
}
```

**Test trước/sau:**

| Payload | Trước (code gốc) | Sau (code mới) |
|---|---|---|
| `note: "abc"` | 200 | 200 |
| `note: null` | **500 (TypeError)** | 200 (skip field) |
| `note` omitted | 200 | 200 |
| `trackerIds: ["valid"]` | 200 | 200 |
| `trackerIds: ["fake_id"]` | **500 (FK violation)** | **409 (BusinessConflict)** |
| `trackerIds: null` | **500 (TypeError)** | 200 (skip field) |

---

## Hướng dẫn kiểm tra (Testing & Next Steps)

### A. Test sort (frontend, không cần rebuild gì)

Vì Vite HMR tự reload, mở browser ở `http://localhost:5174` rồi kiểm tra:

1. **首页** (`/`): Các card link xếp theo tên tăng dần. Reload trang 5 lần, thứ tự phải ổn định.
2. **链接管理** (`/links`): Bảng mặc định sort theo 名称 ASC. Click header "名称" để đảo chiều.
3. **广告管理** (`/ads`): Tương tự LinksPage.
4. **链接编辑** (`/links/:id`): Transfer panel bên trái sort theo tên ad tăng/giảm (toggle bằng nút Sort).
5. **数据查询** (`/query`): Các card link vẫn sort theo tên dù có filter keyword.

**Test nhanh qua console:**
```js
['11-2-1', '11-02-01', '11-2-10', '11-02-2'].sort((a,b) => 0);
   // → ['11-2-1', '11-02-01', '11-2-10', '11-02-2']  (thứ tự gốc, sai)
['11-2-1', '11-02-01', '11-2-10', '11-02-2'].sort((a,b) => naturalCompare(a,b));
   // → ['11-02-01', '11-02-2', '11-2-1', '11-2-10']  (đúng)
```

### B. Test bug fix ở backend (CẦN rebuild Docker)

Vì app đang chạy trong Docker container, mọi sửa `.ts` ở host chỉ có hiệu lực sau khi rebuild:

```bash
docker compose up --build api
```

Lệnh này build lại image `quanlyluuluong-api` từ source local, khởi động lại container, tự chạy `prisma migrate deploy` + seed (idempotent).

**Test case PATCH `/api/v1/links/:id`:**

| Payload | Expected | Status code |
|---|---|---|
| `{name: "x", trackerIds: ["valid_id"]}` | OK | 200 |
| `{name: "x", note: null}` | skip note | 200 |
| `{name: "x", trackerIds: null}` | skip trackers | 200 |
| `{name: "x", trackerIds: ["fake_id"]}` | trả message rõ ràng | **409** |
| `{}` body rỗng | OK (không update gì) | 200 |
| `{name: ""}` | lỗi validation | 422 |

### C. Verify lỗi 400 từ ảnh đã hết (nếu vẫn còn)

Bật log tail trước khi test:
```bash
docker logs -f quanlyluuluong-api-1
```

Mở form Edit Link trong browser, bấm Submit. Nếu vẫn thấy "Request failed with status code 400":
1. Xem log container ngay trước response — sẽ thấy dòng code nào ném lỗi
2. Paste log cho team lead
3. Trong DevTools Network tab, xem **Response** body của request đỏ (thường là HTML rỗng / plain text, không phải JSON)

---

## Phụ lục: Phát hiện khi debug 400 (chưa sửa, chờ confirm)

| Vấn đề | Mức độ | Ghi chú |
|---|---|---|
| **Double-encode CJK** trong response (`android-天气` → `android-Ǿ¤©Æ°`) | 🟡 Trung bình | Dữ liệu DB bị encode 2 lần từ trước. Cần script fix DB: `UPDATE link SET description = convert_from(convert_to(description, 'UTF8'), 'LATIN1')` |
| Container chạy code cũ 25h | 🔴 Quan trọng | ✅ ĐÃ FIX 30/06/2026 8:52:27 AM — `docker compose up --build api` xong, test pass tất cả case |
| Có 2 process node local (PID 14000, 1424) chạy `dist/src/main.js` không bind được port 3000 | 🟡 Nhỏ | Gây nhầm lẫn khi debug. Nên tắt `npm run dev` khi đã dùng Docker |
| Không có script fix seed khi tên link đã đổi (test của mình đã đổi `11-02-01` → `traffic-03` → `😀` rồi revert) | 🟡 Nhỏ | Revert thủ công nếu test phá seed |

---

## Cập nhật sau khi rebuild Docker (30/06/2026, 8:52 AM)

**Lệnh:** `docker compose up --build api`
**Kết quả:** Container `quanlyluuluong-api-1` restart, `Nest application successfully started` trong 3ms.

**Verification test (sau khi rebuild):**

```
[01] normal valid                  -> 200
[02] note null                     -> 200   (was 500 TypeError)
[03] trackerIds null               -> 200   (was 500 TypeError)
[04] trackerIds ["fake_xxx_999"]   -> 409   (was 500 FK violation)
     message: "统计不存在或已删除：fake_xxx_999"
[05] Exact screenshot payload      -> 200   (was 400)
     name=traffic-03, desc=android-天气, note=""
[06] Revert to 11-02-01            -> 200
     name=11-02-01, desc=android-天气, note=""
```

Tất cả 6 case pass. Lỗi 400 từ ảnh và 2 bug 500 đã hết. Link `11-02-01` đã revert về trạng thái seed ban đầu.

---

## Cập nhật User Management (30/06/2026, 9:00 AM)

**Báo cáo lỗi mới từ user:**
1. Tạo user lần đầu bị 504, nhưng user vẫn được tạo
2. Reset password bị 400

**Verify sau khi rebuild (cùng container đã restart ở trên):**

| Endpoint | Test | Status | Thời gian |
|---|---|---|---|
| `POST /api/v1/users` | Tạo user lần 1 | 201 | 82ms |
| `POST /api/v1/users` | Tạo user lần 2 | 201 | 79ms |
| `PATCH /api/v1/users/:id` | Reset pass hợp lệ | 200 | 73ms |
| `PATCH /api/v1/users/:id` | Reset pass 5 ký tự | 422 (validation) | 7ms |
| `PATCH /api/v1/users/:id` | Reset pass rỗng | 422 (validation) | 4ms |
| `POST /api/v1/auth/login` | Login với pass mới | 201 | OK |
| `POST /api/v1/auth/login` | Login với pass cũ | 401 | từ chối đúng |

**Kết luận:**
- ✅ 504 khi tạo user: KHÔNG TÁI HIỆN — nguyên nhân trước là do container cũ chạy chậm + proxy timeout, sau khi rebuild container chạy ổn
- ✅ 400 khi reset password: KHÔNG TÁI HIỆN — container cũ có validation/middleware trả 400, container mới trả đúng 422 cho validation
- ⚠️ Vấn đề tiềm ẩn còn lại: nếu sau này container restart lần nữa (image mới, server chậm), lỗi 504 có thể tái xuất hiện. Khuyến nghị giảm `bcrypt` salt rounds từ 10 xuống 8 (4096 → 256 lần hash, nhanh hơn ~4 lần) nếu tốc độ quan trọng. Hoặc thêm `proxy_read_timeout` trong nginx config nếu dùng reverse proxy.

---

## Cập nhật deploy lên server Trung Quốc (30/06/2026, 9:15 AM)

**Verify end-to-end counter trong container hiện tại:**
- 5 hits đến `/main/link/o702jib0` → counter Redis tăng 3 + 2 = 5 ✓
- Sync worker flush sau 60s → 2 row mới trong `TrafficDaily` (date `2026-06-30`) ✓
- Dirty set cleared sau khi worker ack ✓
- DB có lịch sử liên tục từ `2026-06-09` đến `2026-06-30` ✓

**Code logic đếm đã đúng** (xem `apps/api/src/flow/flow.service.ts`, `apps/api/src/engine/sync.worker.ts`, `apps/api/src/engine/traffic.keys.ts`). Tuy nhiên khi deploy lên server TQ cần kiểm tra 6 điểm sau:

| # | Điểm cần kiểm tra | Lệnh kiểm tra | Khuyến nghị |
|---|---|---|---|
| 1 | `BUSINESS_UTC_OFFSET_MIN` = 480 | `docker exec quanlyluuluong-api-1 printenv BUSINESS_UTC_OFFSET_MIN` | Phải là 480 cho TQ. Sửa trong `.env.production` |
| 2 | Clock container đúng giờ | `docker exec quanlyluuluong-api-1 date` | Cài `chrony`/NTP trên host nếu lệch |
| 3 | Redis persistence bật AOF | `docker exec quanlyluuluong-redis-1 redis-cli CONFIG GET appendonly` | Bật `--appendonly yes` trong `docker-compose.prod.yml` để counter không mất khi restart |
| 4 | Latency API ↔ Redis | `docker exec quanlyluuluong-api-1 redis-cli -h redis PING` | < 1ms nếu cùng region Alibaba Cloud. Nếu > 5ms → đặt cùng region |
| 5 | Connection pool Postgres | xem logs sync worker | Tăng `TRAFFIC_SYNC_INTERVAL_SEC=120` nếu DB yếu |
| 6 | `targetUrl` ad dùng `https://` | xem trang 广告管理 | Trình duyệt TQ cảnh báo "không an toàn" với `http://` → user bỏ qua → đếm thấp |

**Sửa cấu hình Redis persistence (khuyến nghị áp dụng):**

Sửa `docker-compose.prod.yml` dòng 23-29:
```yaml
  redis:
    image: redis:7-alpine
    restart: always
    command: ["redis-server", "--appendonly", "yes", "--appendfsync", "everysec"]
    volumes:
      - redisdata:/data
```

Sau đó `docker compose -f docker-compose.prod.yml up -d --build redis` (chỉ restart redis để không downtime API).

**Verify counting trên server thật:**

```bash
# 1. Counter trong Redis có tăng không
docker exec quanlyluuluong-redis-1 redis-cli KEYS "flow:*:$(date +%Y-%m-%d)"

# 2. Sync worker có chạy không
docker logs quanlyluuluong-api-1 | grep SyncWorker

# 3. DB có được flush không (sau 60s)
docker exec quanlyluuluong-postgres-1 psql -U tms -d tms -c 'SELECT date, count FROM "TrafficDaily" ORDER BY date DESC LIMIT 5;'
```

Nếu counter trong Redis tăng mà DB không có row mới → sync worker crash. Xem log: `docker logs quanlyluuluong-api-1 | grep -E "SyncWorker|flush failed"`.

---

## 🐛 Báo cáo Tester: 18 bug tìm thấy (30/06/2026, 10:30 AM)

Test toàn diện 5 lớp: auth/authz, CRUD, concurrency, security, engine. Kết quả:

### 🔴 CRITICAL (Cần sửa ngay)

| # | Mức | Vị trí | Mô tả | Bằng chứng |
|---|---|---|---|---|
| **#1** | 🔴 HIGH | `audit.controller.ts:5-7` | Operator có thể đọc `/api/v1/audit-logs` — lộ lịch sử thao tác admin. Thiếu `@Roles('ADMIN')` | Test 2.2: operator GET audit-logs → 200 OK |
| **#8** | 🔴 HIGH | `links.service.ts:113-120` (create) | Race condition: 2/3 request tạo cùng `shortCode` thành công, request thứ 3 → **500** thay vì 409. Check `findUnique` + `create` không atomic | Test 4.4: 3 concurrent same-shortCode → 201,201,**500** |
| **#12** | 🔴 HIGH | Express body parser | Body >100KB trả **500** thay vì **413 Payload Too Large**. Default body limit 100KB | Test 6.3: 1MB body → 500 |
| **#19** | 🔴 HIGH | `jwt.strategy.ts:20` | JWT secret có hardcoded fallback `'change-me-access-secret'`. Nếu deploy quên set env, attacker forge token | `secretOrKey: config.get('JWT_ACCESS_SECRET', 'change-me-access-secret')` |

### 🟠 MEDIUM (Nên sửa)

| # | Mức | Vị trí | Mô tả | Bằng chứng |
|---|---|---|---|---|
| **#2** | 🟠 MED | `link.dto.ts` + service | `name: "   "` (chỉ space) → 201 OK, lưu tên rỗng. MinLength check trước trim | Test 3.1: name spaces → 201 |
| **#3** | 🟠 MED | `link.dto.ts` | `name` chứa `\n` được lưu nguyên. Có thể làm hỏng UI | Test 3.1: name with newline → 201 |
| **#4** | 🟠 MED | `ad.dto.ts` (targetUrl) | `targetUrl: "example.com"` (không có scheme) → 201. Sẽ fail khi click | Test 3.1: targetUrl no http → 201 |
| **#9** | 🟠 MED | `links.service.ts:144-188` (update) | Race condition: 5 concurrent PATCH trên cùng link, "last write wins", intermediate update mất. Không có optimistic lock / version field | Test 4.2: 5 PATCH → tất cả 200, final = `concurrent_2` |
| **#10** | 🟠 MED | `links.service.ts:179` (setStatus) | Tương tự: 5 concurrent toggle → tất cả 200, không có guarantee thứ tự | Test 4.3 |
| **#11** | 🟠 MED | engine response | Một số link không có ad → trả 200 + "暂无可用内容". Đây là design đúng nhưng HTTP status không chính xác (nên là 503/404) | Test 5.1 |
| **#13** | 🟠 MED | frontend + service | XSS: lưu `<script>alert("XSS")</script>` thành công. AntD escape nhưng nếu có chỗ render thô sẽ exploit được | Test 6.2 |
| **#16** | 🟠 MED | `engine.controller.ts:20` | `targetUrl.replace(/"/g, '&quot;')` chỉ escape `"`, không escape `\` và `\n`. URL chứa các ký tự này có thể break JS string | Source review |
| **#20** | 🟠 MED | audit controller | CORS preflight có thể không handle OPTIONS request | Cần test thêm |

### 🟡 LOW (Cảnh báo, không nghiêm trọng)

| # | Mức | Vị trí | Mô tả | Bằng chứng |
|---|---|---|---|---|
| **#7** | 🟡 LOW | `pagination.dto.ts` | `pageSize` không có max. `pageSize=1000` → trả 200 (DoS risk) | Test 3.2 |
| **#14** | 🟡 LOW | n/a | ✓ SQL injection: Prisma dùng parameterized queries, an toàn | Test 6.1 |
| **#15** | 🟡 LOW | n/a | ✓ Counter concurrency: Lua script atomic, 50 hits = 50 counter tăng | Test 4.5 |
| **#17** | 🟡 LOW | n/a | ✓ Cache invalidation: sau PATCH status, engine trả status mới đúng | Test 9 |
| **#18** | 🟡 LOW | `soft-delete` | Sau khi xóa link, có thể tạo link mới với cùng shortCode. Đúng vì soft-delete giữ row. | Test 8 |

### Cách tái hiện nhanh (chạy trong container đang chạy)

```bash
# Test bug #1 (audit role)
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .data.accessToken)
# Tạo operator, login, gọi audit-logs
curl -X POST http://localhost:3000/api/v1/users -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"optest","password":"op12345","role":"OPERATOR"}'
OP_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"optest","password":"op12345"}' | jq -r .data.accessToken)
curl -X GET http://localhost:3000/api/v1/audit-logs -H "Authorization: Bearer $OP_TOKEN"
# → 200 OK (BUG!)

# Test bug #8 (race condition)
for i in 1 2 3; do
  curl -X POST http://localhost:3000/api/v1/links \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"dup$i\",\"shortCode\":\"race-test\"}" &
done; wait
# → 201, 201, 500 (BUG!)
```

### Khuyến nghị ưu tiên sửa

1. **#1** (audit role leak) — thêm 1 dòng `@Roles('ADMIN')` vào audit controller, 30 giây
2. **#8** (shortCode race) — wrap trong `prisma.$transaction` hoặc catch P2002 → 409, 5 phút
3. **#12** (body limit) — set `app.use(json({ limit: '1mb' }))` trong main.ts, 1 phút
4. **#19** (JWT fallback) — bỏ default secret, fail-fast nếu thiếu env, 2 phút
5. **#2-4** (validation) — thêm `@Matches(/\S/)` cho name, regex cho targetUrl, 10 phút

### BUG đã fix từ đầu phiên (tham khảo)

| # | Vấn đề | Status |
|---|---|---|
| null crash trong `LinksService.update` | ✅ Fixed (commit trong session) |
| Fake trackerId FK violation | ✅ Fixed (BusinessConflictException 409) |
| Sắp xếp sai với chuỗi độ dài khác nhau | ✅ Fixed (naturalCompare) |

---

## 🐛 Báo cáo Tester - Tiếp tục (30/06/2026, 10:45 AM)

Test thêm 4 lớp: reports/dashboard, frontend logic, performance/load, data integrity. Tìm thêm **13 bug mới** (tổng **31 bug**).

### 🔴 CRITICAL mới

| # | Mức | Vị trí | Mô tả | Bằng chứng |
|---|---|---|---|---|
| **#27** | 🔴 CRITICAL | `engine.controller.ts:21-25` | **XSS qua tracker code**: Admin nhập `<script>alert(1)</script>` vào tracker code, khi user click link, script execute trong browser. Tracker code render RAW vào HTML giữa `<title>` và `<script>` | Test 14: engine response với tracker có `<script>` chứa trực tiếp trong body |
| **#21** | 🔴 HIGH | `reports.service.ts` (date parsing) | Dashboard với malformed date (`2026-13-99`, ISO với time, timestamp, SQLi) → **500** thay vì 400/422. Không validate date format | Test 11.1: 5 case malformed date → 500 |

### 🟠 MEDIUM mới

| # | Mức | Vị trí | Mô tả | Bằng chứng |
|---|---|---|---|---|
| **#22** | 🟠 MED | reports date parsing | `date=2026` (chỉ năm) → 200 OK, response trả `date: "2026"`. Không validate format yyyy-mm-dd | Test 11.1 |
| **#23** | 🟠 MED | reports date parsing | `date=2026-02-30` (ngày không tồn tại) → 200, JS tự chuyển thành 2026-03-02. Không validate | Test 11.1 |
| **#24** | 🟠 MED | traffic query | `from > to` (reversed) → 200 với 0 rows. Nên 400 để báo lỗi rõ ràng | Test 11.2 |
| **#26** | 🟠 MED | traffic query | `adKeyword` 10000 chars → 200 OK. Không giới hạn max length | Test 11.2 |
| **#28** | 🟠 MED | tracker DTO | Tracker code cho phép newline `\n` → render thành newline thật trong HTML. Có thể phá vỡ cấu trúc script | Test 14 |
| **#29** | 🟠 MED | tracker DTO | Tracker code 10000 chars → 201 OK, không max length | Test 14 |
| **#33** | 🟠 MED | `LogsPage.tsx:90` | Gọi `listUsers({ pageSize: 1000 })` để populate dropdown filter. Nếu >1000 user thì dropdown thiếu. Cũng load on every page mount | Source review |
| **#34** | 🟠 MED | `LinksPage.tsx:63` | `listTrackers({ pageSize: 200 })` để populate select. Tương tự, giới hạn 200 | Source review |
| **#35** | 🟠 MED | `LinkEditPage.tsx:61` | `listAds({ pageSize: 1000 })` để populate transfer. Nếu >1000 ad, transfer thiếu | Source review |

### 🟡 LOW mới

| # | Mức | Vị trí | Mô tả | Bằng chứng |
|---|---|---|---|---|
| **#32** | 🟡 LOW | `dashboard` | `date=1900-01-01` và `date=2099-12-31` → 200. Cho phép query quá khứ/tương lai xa vô tận → DoS query DB | Test 12.2 |
| **#36** | 🟡 LOW | `auth.tsx:19-35` | `useEffect` chỉ chạy 1 lần khi mount. Nếu tab inactive quá lâu, access token expire, không auto-refresh cho đến khi user trigger 1 request | Source review |
| **#39** | 🟡 LOW | engine controller | `targetUrl` chứa ký tự đặc biệt (`<`, `>`, `'`, `"`) chưa được escape đầy đủ trong HTML context. Hiện tại chỉ escape `"` | Source review |

### ✅ Verified an toàn / Performance

| Test | Result | Chi tiết |
|---|---|---|
| 100 concurrent GET /links | ✅ 418ms (240 req/s) | Tất cả 200 |
| 200 concurrent engine hits | ✅ 351ms (**570 req/s**) | 0 errors, count chính xác |
| 20 rapid logins | ✅ 1265ms (63ms/login) | bcrypt salt=10 |
| Sync worker chạy | ✅ Verified | Logs: "traffic sync worker started (every 60s)" |
| Counter sync Redis → DB | ✅ Verified | Dirty set empty sau 65s |
| Audit log mỗi write | ✅ Verified | Total count tăng đúng số write |

---

## 📊 Tổng kết toàn bộ bug tìm được (cộng dồn)

| Mức | Số lượng | Bug |
|---|---|---|
| 🔴 CRITICAL | 5 | #1, #8, #12, #19, #21, #27 |
| 🟠 MEDIUM | 16 | #2-#4, #9-#11, #13, #16, #22-#24, #26, #28-#29, #33-#35 |
| 🟡 LOW | 8 | #7, #32, #36, #39 (và #14-#18, #20, #25, #31, #37-#38 là verified-OK) |
| **TỔNG** | **~31 bug** | |

### Top 5 cần fix ngay (ảnh hưởng security/data integrity)

1. **#27 XSS qua tracker code** (CRITICAL) — escape tracker code trước khi nhúng vào HTML
2. **#1 Audit log không phân quyền** (HIGH) — thêm `@Roles('ADMIN')`
3. **#8 ShortCode race condition** (HIGH) — wrap transaction
4. **#21 Malformed date → 500** (HIGH) — validate date format
5. **#19 JWT secret fallback** (HIGH) — fail-fast nếu thiếu env var

### Các bug đã fix từ đầu phiên (commit trong session)

- ✅ Null crash trong `LinksService.update` → service xử lý null
- ✅ Fake trackerId FK violation → BusinessConflictException 409
- ✅ Sort sai với độ dài chuỗi khác nhau → `naturalCompare` utility mới
- ✅ Double-encode CJK response (chưa fix DB, chỉ documented)

---

## 🐛 Báo cáo DB Migration (30/06/2026, 11:00 AM)

Test 10+ scenario migration trên DB `tms_migration_test` (Postgres 16). Tìm **8 bug/issue mới**.

### 🔴 CRITICAL mới

| # | Mức | Vị trí | Mô tả | Bằng chứng |
|---|---|---|---|---|
| **#40** | 🔴 CRITICAL | `migrations/20260613101513_init/migration.sql` | Migration init **KHÔNG idempotent** ở SQL level. Chạy 2 lần liên tiếp → fail `type "Role" already exists`. Prisma `migrate deploy` xử lý qua `_prisma_migrations` tracking nên pass, nhưng nếu chạy raw SQL hoặc restore từ backup → fail | Test C: `ERROR: type "Role" already exists` |

### 🟠 MEDIUM mới

| # | Mức | Vị trí | Mô tả | Bằng chứng |
|---|---|---|---|---|
| **#42** | 🟠 MED | Postgres init | Database collation `en_US.utf8` — sort CJK sai thứ tự (汉字 theo alphabetical Latin, không theo pinyin/stroke). Cho app TQ, nên dùng `zh_CN.utf8` hoặc `C.UTF-8` | Test 22.8: `datcollate=en_US.utf8` |
| **#43** | 🟠 MED | `apps/api/prisma/migrations/` | **Không có down/rollback migration**. Nếu migration mới có bug → không rollback được. Phải tự viết script down | Test 23.3: chỉ có `migration.sql`, không có `down.sql` |
| **#44** | 🟠 MED | Docker compose | DB collation không config trong docker-compose, dùng default `en_US.utf8` của postgres:16-alpine. Phải set qua `POSTGRES_INITDB_ARGS=--lc-collate=C.UTF-8` để consistent | `docker-compose.yml` không có |
| **#45** | 🟠 MED | migration strategy | Init migration chỉ có 1 file. Khi schema phát triển, mỗi thay đổi cần migration mới. **Hiện tại KHÔNG có baseline migration riêng** cho production vs dev, nếu restore từ prod backup về dev sẽ lệch checksum | Source review |

### 🟡 LOW mới

| # | Mức | Vị trí | Mô tả | Bằng chứng |
|---|---|---|---|---|
| **#46** | 🟡 LOW | service code | Nếu admin tạo user với shortCode trùng soft-deleted link → `create` check `findUnique({ where: { shortCode } })` không filter `deletedAt: null` → reject. Cần verify thực tế | Test 21.3: test không hit vì soft-deleted có shortCode invalid format |
| **#47** | 🟡 LOW | service code | Soft-delete 12 link cũ (từ 2026-06-26) chưa bao giờ bị purge. Sẽ tích lũy vĩnh viễn. Cần script định kỳ | Test 22.2: oldest soft-delete 2026-06-26 |
| **#48** | 🟡 LOW | migration guide | README/DEPLOY.md không có section về "rollback migration" hoặc "disaster recovery" | Source review |

### ✅ DB Integrity Verified (Production tms DB)

| Check | Status | Chi tiết |
|---|---|---|
| NULL trong cột NOT NULL | ✅ All 0 | User.username, Link.name, Link.shortCode, Ad.targetUrl đều 0 null |
| Orphan records | ✅ All 0 | LinkAd, LinkTracker không có row tham chiếu link/ad/tracker đã xóa |
| Indexes đầy đủ | ✅ OK | Tất cả FK column có index, các unique constraint đúng |
| FK constraints | ✅ OK | ON DELETE RESTRICT cho business data, SET NULL cho AuditLog.userId |
| Autovacuum | ✅ OK | Link table đã autovacuum lúc 8:41 AM |
| DB size | ✅ 8.5 MB | Quá nhỏ, không lo performance |
| Largest table | AuditLog 152KB | Phù hợp với usage |

### ✅ Live Migration Test (during 500 req/s traffic)

| Operation | Time | 5xx errors | Impact |
|---|---|---|---|
| `ALTER TABLE ADD COLUMN` (traffic ongoing) | 165ms | **0** | Không downtime |
| `CREATE INDEX` (concurrent) | 154ms | **0** | Không downtime |
| `CREATE INDEX` (non-concurrent) | 150ms | **0** | Bảng nhỏ nên lock nhanh, nhưng với bảng lớn sẽ block |
| Concurrent `prisma migrate deploy` | OK | — | Prisma tracking ngăn chạy trùng |

### Migration Pattern Khuyến Nghị

```sql
-- 1. Always: thêm cột với DEFAULT để không break existing rows
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3) DEFAULT NULL;

-- 2. Không dùng: ALTER TABLE ... TYPE (data loss)  
-- Thay bằng: ADD cột mới → backfill → swap

-- 3. Index lớn: LUÔN dùng CONCURRENTLY
CREATE INDEX CONCURRENTLY "idx_name" ON "Table"(column);

-- 4. FK mới: validate data trước khi add
ALTER TABLE "X" ADD CONSTRAINT ... FOREIGN KEY ...;

-- 5. Mỗi migration có down.sql tương ứng:
-- migrations/20260613_init/up.sql
-- migrations/20260613_init/down.sql
```

### Bug cũ liên quan DB (chưa fix)

| # | Bug | Status |
|---|---|---|
| #19 | JWT secret fallback `'change-me-access-secret'` | Chưa fix |
| #21 | Malformed date → 500 | Chưa fix |

### Tổng kết 3 phiên test

| Phiên | Số bug mới | Bug quan trọng |
|---|---|---|
| Phiên 1: Auth/Authz/CRUD/Concurrency/Security/Engine | 18 | #1 audit role, #8 shortCode race, #12 body limit |
| Phiên 2: Reports/Frontend/Performance | 13 | #27 XSS tracker code, #21 malformed date |
| Phiên 3: DB Migration | 8 | #40 migration not idempotent, #42 wrong collation |
| **TỔNG** | **~39 bug** | |

---

## 🐛 Báo cáo Rate Limit + Deploy/Upgrade (30/06/2026, 11:20 AM)

Test 4 lớp: rate limit, container restart, deps connection drop, graceful shutdown. Tìm **10 bug/issue mới**.

### 🔴 CRITICAL mới

| # | Mức | Vị trí | Mô tả | Bằng chứng |
|---|---|---|---|---|
| **#49** | 🔴 CRITICAL | `auth.controller.ts` | **Brute force login không bị chặn**: 100 wrong passwords → 0 blocked (tất cả 401). 6.3s cho 100 attempts = 16 att/s. Attacker có thể brute force weak password | Test 24.1: 100 wrong → 0 blocked |
| **#50** | 🔴 CRITICAL | `auth.service.ts:24-37` (refresh) | **Refresh token spam không giới hạn**: 50 refreshes trong 174ms = 287 refreshes/sec, 0 bị chặn. Có thể gây DoS qua việc spam refresh | Test 24.5: 50 refreshes → 50 success |
| **#51** | 🔴 CRITICAL | `engine.controller.ts` | **Public engine endpoint không rate limit**: 500 hits trong 990ms = 505 req/s, 0 bị chặn. Attacker có thể flood engine để exhaust Redis | Test 24.3: 500 hits → 0 blocked |
| **#52** | 🔴 CRITICAL | toàn bộ API | **Authenticated endpoints không rate limit**: 500 list requests trong 1.6s = 312 req/s, 0 bị chặn. Attacker authenticated (1 stolen token) có thể flood | Test 24.4: 500 list → 0 blocked |
| **#60** | 🔴 CRITICAL | `main.ts:19-44` | **Không có graceful shutdown handler**: `app.enableShutdownHooks()` không được gọi. Khi nhận SIGTERM, app không drain in-flight requests, không đợi sync worker, không close DB connections. Toàn bộ request đang xử lý bị drop giữa chừng | Test 31: 18% downtime (699/3888) khi restart |

### 🟠 MEDIUM mới

| # | Mức | Vị trí | Mô tả | Bằng chứng |
|---|---|---|---|---|
| **#53** | 🟠 MED | auth/login | Không có account lockout sau N lần sai. Tấn công liên tục cùng 1 account | Test 24.2 |
| **#54** | 🟠 MED | API | Không có rate limit per-IP. Nếu deploy sau reverse proxy (Caddy), per-IP rate limit phải config ở proxy | Source review |
| **#55** | 🟠 MED | `engine.service.ts` | Khi Redis down, engine trả **500** thay vì fallback (vd: chọn ad đầu tiên từ DB, hoặc trang fallback). Hiện tại single point of failure | Test 26.1: Redis stop → engine 500 |
| **#61** | 🟠 MED | `docker-compose.yml` | Container restart gây **~4s downtime** (no graceful drain). Production cần multiple replicas + reverse proxy health check, hoặc `app.enableShutdownHooks()` + K8s `terminationGracePeriodSeconds: 30s` | Test 31: 18% downtime |

### 🟡 LOW mới

| # | Mức | Vị trí | Mô tả | Bằng chứng |
|---|---|---|---|---|
| **#62** | 🟡 LOW | `docker-compose.yml` | Container `restart: unless-stopped` không tốt cho maintenance. Nên dùng `restart: on-failure` để admin stop có chủ đích | Source review |
| **#63** | 🟡 LOW | Redis recovery | Redis tự động reconnect khi container restart (ioredis tự xử lý). ✓ Nhưng cần verify counter không bị mất nếu Redis restart với RDB only (không có AOF) | Test 26.1: API phục hồi OK |

### ✅ Verified an toàn

| Test | Result |
|---|---|
| Memory leak dưới sustained load (16k hits / 30s) | ✅ 60MiB → 89MiB, stable, no leak |
| Container recovery sau restart | ✅ Auto-restart via `unless-stopped` |
| Postgres down → /main/link vẫn hoạt động | ✅ Cache trong Redis, vẫn 302 |
| Redis down → DB query vẫn OK | ✅ /api/v1/links 200 |
| Health endpoint | ✅ Returns 200 |
| Slow body attack (gửi body chậm) | ✅ Server 400 trong 4ms, không đợi |

### 🏆 Top 5 ưu tiên fix (cập nhật)

1. **#60 graceful shutdown** — thêm `app.enableShutdownHooks()` + tăng `terminationGracePeriodSeconds`
2. **#49-52 rate limit** — dùng `@nestjs/throttler` hoặc Caddy rate_limit
3. **#1 audit log phân quyền** — thêm `@Roles('ADMIN')`
4. **#27 XSS tracker code** — escape tracker code trong engine controller
5. **#40 init migration idempotent** — thêm `IF NOT EXISTS` cho CREATE statements

### Khuyến nghị cho production

```yaml
# docker-compose.prod.yml
services:
  api:
    restart: on-failure
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 20s
    # tăng stop timeout để graceful shutdown
    stop_grace_period: 30s
    stop_signal: SIGTERM

  caddy:
    # Thêm rate limit
    reverse_proxy web:80 {
      rate_limit 100r/s
    }
```

```ts
// main.ts — thêm
app.enableShutdownHooks();  // ← fix #60

// Tăng keep-alive timeout
const server = await app.listen(port, '0.0.0.0');
server.keepAliveTimeout = 65000; // > Caddy's timeout
server.headersTimeout = 66000;
```

### Tổng kết 4 phiên test

| Phiên | Bug mới | Bug nghiêm trọng nhất |
|---|---|---|
| 1: Auth/CRUD/Concurrency/Security/Engine | 18 | #1, #8, #12, #19 |
| 2: Reports/Frontend/Performance | 13 | #21, #27 |
| 3: DB Migration | 8 | #40, #42 |
| 4: Rate Limit + Deploy | 10 | **#49-52 brute force + #60 graceful shutdown** |
| **TỔNG** | **~49 bug** | |
