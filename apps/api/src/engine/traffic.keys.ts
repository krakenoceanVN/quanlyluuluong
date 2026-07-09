/** Centralised Redis key builders so engine + admin stay in sync. */

/** Daily flow counter for a link-ad membership. e.g. flow:<linkAdId>:2026-06-13 */
export const flowKey = (linkAdId: string, date: string) => `flow:${linkAdId}:${date}`;

/** Cached, ready-to-serve config for a link (by shortCode). */
export const linkConfigKey = (shortCode: string) => `link:cfg:${shortCode}`;

/** Set of linkAdIds with un-synced counter increments (worker drains this). */
export const dirtyFlowSet = () => `flow:dirty`;

/**
 * Bộ đếm kết quả engine theo shortCode + ngày nghiệp vụ.
 * Hash với các field: redirect / fallback / notfound / throttled.
 * e.g. stat:engine:o702jib0:2026-07-01
 */
export const engineStatKey = (shortCode: string, date: string) =>
  `stat:engine:${shortCode}:${date}`;

/**
 * Lệch múi giờ nghiệp vụ (phút) để chốt "ngày" theo giờ địa phương, KHÔNG theo UTC.
 * Mặc định UTC+8 (giờ Trung Quốc) = 480 — ngày đổi lúc 24h giờ TQ.
 * (UTC+7 Việt Nam = 420). Cấu hình qua biến môi trường BUSINESS_UTC_OFFSET_MIN.
 */
export const BUSINESS_UTC_OFFSET_MIN = Number(process.env.BUSINESS_UTC_OFFSET_MIN ?? 480);

/** yyyy-mm-dd theo múi giờ nghiệp vụ cho "hôm nay". */
export function todayKey(d: Date = new Date()): string {
  return new Date(d.getTime() + BUSINESS_UTC_OFFSET_MIN * 60000).toISOString().slice(0, 10);
}

/** Đổi chuỗi ngày nghiệp vụ (yyyy-mm-dd) → mốc Date để lưu/truy vấn DB (nhãn ngày, ổn định 2 chiều). */
export function businessDateToUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}
