# Codex Work Log - 30/06/2026

## Summary

Da xu ly cac nhom van de chinh:

- Sua luong counter Redis -> DB de tranh mat dirty marker khi co click moi trong luc sync.
- Giu cau hinh ngay nghiep vu theo UTC+8 (`BUSINESS_UTC_OFFSET_MIN=480`) nhu user xac nhan.
- Cho phep `weight` va `dailyLimit` bang `0`; them quang cao moi mac dinh la `0`.
- Sua sap xep theo ten lien ket/quang cao bang natural sort.
- Sua mot so loi cap nhat lien ket/user va them debug log API frontend.
- Them bao cao `REPORT.md`.

## Files Changed

### Counter / Traffic

- `apps/api/src/flow/flow.service.ts`
  - Dua `INCR` va `SADD flow:dirty` vao cung Lua script.
  - Dam bao tang counter va danh dau dirty la atomic.

- `apps/api/src/engine/sync.worker.ts`
  - Them Lua ACK de chi xoa dirty marker neu gia tri Redis hien tai van bang count vua ghi DB.
  - Neu counter thay doi trong luc flush, dirty marker duoc giu lai cho lan sync tiep theo.

- `apps/api/src/engine/sync.worker.spec.ts`
  - Them test cho case flush binh thuong.
  - Them test cho case counter thay doi trong luc flush.

### Link / Ads Config

- `apps/api/src/links/dto/link.dto.ts`
  - Cho phep `weight` va `dailyLimit` bang `0`.

- `apps/api/src/links/links.service.ts`
  - Sap xep link theo `name`.
  - Sap xep ads trong link theo ten ad.
  - Sua update ghi chu ad de dong bo dung `ad.description`.
  - Xu ly update link an toan hon voi `null` va validate tracker ids.

- `apps/web/src/pages/LinkEditPage.tsx`
  - Quang cao moi mac dinh `weight = 0`, `dailyLimit = 0`.
  - De trong input so duoc luu thanh `0`.
  - Cap nhat text huong dan tren UI.
  - Dung natural sort trong transfer panel.

### Reports / Sorting

- `apps/api/src/reports/reports.service.ts`
  - Sap xep dashboard va traffic query theo ten link.
  - Sap xep ads theo ten ad.

- `apps/web/src/utils/sort.ts`
  - Them `naturalCompare`.
  - Them `sortByCode`.

- `apps/web/src/pages/HomePage.tsx`
  - Sap xep card link theo ten bang natural sort.

- `apps/web/src/pages/LinksPage.tsx`
  - Sap xep cot ten bang natural sort.
  - Dat default sort asc.

- `apps/web/src/pages/AdsPage.tsx`
  - Sap xep cot ten bang natural sort.
  - Dat default sort asc.

- `apps/web/src/pages/QueryPage.tsx`
  - Sap xep danh sach link theo ten truoc khi filter.

### User / API UX

- `apps/api/src/users/users.service.ts`
  - Khong cho request tao/sua/xoa user phai cho audit log xong moi tra response.
  - Giam nguy co 504 nhung thao tac DB da thanh cong.

- `apps/web/src/pages/UsersPage.tsx`
  - Them validate reset password tren UI khi dang edit user.

- `apps/web/src/api/client.ts`
  - Them console error cho response 4xx/5xx de debug status, method, URL va body.

### Documentation

- `REPORT.md`
  - Bao cao chi tiet cac thay doi, bug da sua va cach verify.

- `codex.md`
  - File nay, ghi lai tom tat cong viec va vi tri file da thao tac.

## Verification Run

Da chay va pass:

- `npm.cmd run build -w apps/api`
- `npm.cmd run test -w apps/api`
- `npm.cmd run build -w apps/web`
- `npm.cmd run lint -w apps/web`

Ghi chu:

- `npm.cmd run lint -w apps/api` van fail do cac warning Prettier cu o file khong lien quan.
- Warning API lint con lai khong phai do file counter test moi.

## Git / Push Status

Chua commit/push duoc vi sandbox khong co quyen ghi vao `.git/index.lock`.

Lenh da thu:

```bash
git add -A
```

Ket qua:

```text
fatal: Unable to create '.git/index.lock': Permission denied
```

Can approve quyen ghi `.git` va push network de chay tiep:

```bash
git add -A
git commit -m "Commit 30/6/2026"
git push origin main
```
