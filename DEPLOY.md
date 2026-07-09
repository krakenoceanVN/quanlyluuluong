# Triển khai lên Alibaba Cloud ECS (máy ảo) + tên miền + HTTPS

Hướng dẫn deploy bằng Docker trên **một** máy ảo ECS, dùng **Caddy** tự động cấp & gia hạn
chứng chỉ HTTPS (Let's Encrypt). Chỉ Caddy mở ra internet (80/443); PostgreSQL/Redis/API/Web
chạy nội bộ, không lộ ra ngoài.

```
Internet → Caddy (80/443, HTTPS) → web (nginx, SPA + proxy /api,/main) → api → postgres / redis
```

---

## 0. Chuẩn bị

- **ECS**: Ubuntu 22.04 (hoặc tương đương), ≥ 2 vCPU / 2GB RAM.
- **Tên miền**: tạo bản ghi **A** trỏ về **IP công khai** của ECS (vd `traffic.yourdomain.com → 1.2.3.4`).
- **Security Group của ECS**: mở **inbound 80** và **443** (và 22 để SSH). KHÔNG mở 5432/6379/3000.

## 1. Cài Docker trên ECS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER      # đăng xuất/đăng nhập lại để áp dụng
docker compose version             # kiểm tra đã có compose v2
```
> Nếu ở Trung Quốc đại lục mạng chậm, cân nhắc cấu hình registry mirror của Alibaba cho Docker.

## 2. Đưa mã nguồn lên ECS

Cách A — copy file zip (đã loại node_modules/dist):
```bash
scp quanlyluuluong-source.zip <user>@<ECS-IP>:~
ssh <user>@<ECS-IP>
unzip quanlyluuluong-source.zip && cd quanlyluuluong
```
Cách B — git clone từ repo riêng của bạn.

## 3. Cấu hình biến môi trường production

```bash
cp .env.production.example .env.production
nano .env.production
```
Bắt buộc điền:
- `DOMAIN` = tên miền (không kèm http), vd `traffic.yourdomain.com`
- `PUBLIC_LINK_DOMAIN` = `https://traffic.yourdomain.com`
- `ACME_EMAIL` = email của bạn
- `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_PASSWORD` = chuỗi mạnh

Sinh secret ngẫu nhiên nhanh:
```bash
openssl rand -hex 32      # chạy vài lần cho mỗi secret
```

## 4. Khởi chạy

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```
Lần đầu Caddy sẽ tự xin chứng chỉ (mất ~1 phút; cần domain đã trỏ đúng IP và cổng 80/443 mở).

Kiểm tra:
```bash
docker compose -f docker-compose.prod.yml ps          # tất cả Up/healthy
docker compose -f docker-compose.prod.yml logs -f caddy   # xem quá trình cấp cert
curl -I https://traffic.yourdomain.com                # HTTP/2 200
```

Mở trình duyệt: `https://traffic.yourdomain.com` → đăng nhập `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
Engine link công khai: `https://traffic.yourdomain.com/main/link/<shortCode>`.

## 5. Vận hành

```bash
# xem log
docker compose -f docker-compose.prod.yml logs -f api

# cập nhật code mới (sau khi git pull / upload lại)
docker compose -f docker-compose.prod.yml up -d --build

# dừng / khởi động lại
docker compose -f docker-compose.prod.yml stop
docker compose -f docker-compose.prod.yml start

# sao lưu database — service "backup" TỰ ĐỘNG pg_dump vào ./backups mỗi 24h
# (giữ BACKUP_KEEP_DAYS ngày, mặc định 14). Xem log:
docker compose -f docker-compose.prod.yml logs backup
# muốn tạo bản sao lưu tay ngay lập tức:
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U tms tms > backup_$(date +%F).sql

# phục hồi (từ bản tự động: gunzip -c backups/<file>.sql.gz | ...)
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres psql -U tms -d tms
```

## 6. Checklist bảo mật (BẮT BUỘC)

- [ ] Đã đổi `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_PASSWORD`.
- [ ] Security Group **chỉ** mở 80/443 (+22). Không mở 5432/6379/3000.
- [ ] `PUBLIC_LINK_DOMAIN` dùng `https://` + tên miền thật.
- [ ] Đã thử đăng nhập và truy cập một link `/main/link/...`.
- [ ] Backup tự động đã chạy (`docker compose -f docker-compose.prod.yml logs backup` thấy `[backup] OK`). File nằm trên cùng ổ đĩa — nên cron đẩy `./backups` lên OSS/S3 hoặc snapshot đĩa ECS.
- [ ] (Khuyến nghị) đặt ECS sau Alibaba SLB/WAF nếu cần chịu tải / chống tấn công lớn.

## 7. Sự cố thường gặp

| Triệu chứng | Nguyên nhân & cách xử lý |
|---|---|
| Caddy không lấy được cert | Domain chưa trỏ đúng IP, hoặc cổng 80/443 chưa mở trong Security Group. Xem `logs caddy`. |
| Vào web báo lỗi gọi API | Kiểm tra `web` và `api` đều Up; `VITE_API_BASE_URL` phải là `/api/v1` (đã đặt sẵn). |
| Link `/main/...` ra sai domain | Sửa `PUBLIC_LINK_DOMAIN` rồi `up -d` lại; cache link tự hết hạn sau `LINK_CACHE_TTL_SEC`. |
| Muốn đổi mật khẩu admin sau khi seed | Hiện chưa có UI đổi mật khẩu — đổi tạm trong DB, hoặc yêu cầu bổ sung tính năng. |

> Lưu ý: hiện chưa có chức năng **đổi mật khẩu trong giao diện**. Nếu cần, mình có thể bổ sung
> endpoint `PATCH /auth/password` + form trong UI.
