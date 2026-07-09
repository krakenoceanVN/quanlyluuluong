-- Soft-delete membership Link↔Ad: gỡ quảng cáo khỏi link chỉ đánh dấu deletedAt,
-- KHÔNG xóa LinkAd/TrafficDaily → lịch sử báo cáo các ngày cũ giữ nguyên.
ALTER TABLE "LinkAd" ADD COLUMN "deletedAt" TIMESTAMP(3);
