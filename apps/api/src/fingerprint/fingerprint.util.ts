import { createHash } from 'crypto';

/**
 * Thuộc tính ỔN ĐỊNH của thiết bị — cùng 1 máy, cùng 1 trình duyệt thì giá trị không đổi giữa các lượt.
 * Chỉ các khóa này (+ User-Agent) được đưa vào hash để khử trùng lặp.
 */
export const STABLE_KEYS = [
  'wd', // navigator.webdriver
  'au', // dấu vết tự động hóa (phantom/nightmare/domAutomation)
  'sw',
  'sh', // kích thước màn hình
  'aw',
  'ah', // vùng khả dụng của màn hình
  'dpr', // devicePixelRatio
  'cd', // colorDepth
  'tp', // maxTouchPoints
  'te', // có sự kiện touch
  'hc', // hardwareConcurrency (số nhân CPU)
  'dm', // deviceMemory (GB)
  'tz', // múi giờ
  'lg', // danh sách ngôn ngữ
  'pf', // navigator.platform
  'pl', // số plugin
  'um', // userAgentData.mobile
  'ub', // userAgentData.brands
  'gv',
  'gr', // WebGL vendor / renderer
  'ch', // canvas hash
] as const;

/** Thuộc tính HAY ĐỔI giữa các lượt — chỉ lưu mẫu gần nhất, không đưa vào hash. */
export const VOLATILE_KEYS = [
  'iw',
  'ih', // kích thước cửa sổ
  'or', // hướng màn hình
  'ct', // loại mạng / rtt / downlink
  'np', // quyền thông báo
  'hl', // history.length
  'rf', // referrer
  'vs', // visibilityState
  't', // ms từ lúc mở trang
  'nt', // connect / TTFB (ms)
  'err', // beacon dự phòng khi script lỗi
] as const;

const MAX_VALUE_LEN = 200;
const MAX_UA_LEN = 512;
const LINK_CODE = /^[A-Za-z0-9_-]{1,32}$/;

export interface NormalizedBeacon {
  linkCode: string;
  userAgent: string;
  attrs: Record<string, string>;
  sample: Record<string, string>;
  hash: string;
}

/** Lấy 1 giá trị query dạng chuỗi, cắt độ dài; mảng (?a=1&a=2) → lấy phần tử đầu. */
function pick(q: Record<string, unknown>, key: string): string | undefined {
  let v = q[key];
  if (Array.isArray(v)) v = v[0];
  if (typeof v !== 'string' && typeof v !== 'number') return undefined;
  const s = String(v).trim();
  return s ? s.slice(0, MAX_VALUE_LEN) : undefined;
}

/**
 * Chuẩn hóa query của beacon thành 1 bản ghi fingerprint.
 * Trả null khi không đủ dữ liệu để coi là 1 thiết bị (sai link code, hoặc không có thuộc tính
 * ổn định nào — vd request không chạy JS, curl thử…).
 */
export function normalizeBeacon(
  query: Record<string, unknown>,
  userAgentHeader: string | undefined,
): NormalizedBeacon | null {
  const linkCode = pick(query, 'c');
  if (!linkCode || !LINK_CODE.test(linkCode)) return null;

  const attrs: Record<string, string> = {};
  for (const k of STABLE_KEYS) {
    const v = pick(query, k);
    if (v !== undefined) attrs[k] = v;
  }
  if (Object.keys(attrs).length === 0) return null;

  const sample: Record<string, string> = {};
  for (const k of VOLATILE_KEYS) {
    const v = pick(query, k);
    if (v !== undefined) sample[k] = v;
  }

  const userAgent = (userAgentHeader ?? '').slice(0, MAX_UA_LEN);
  // Khóa đã theo thứ tự cố định của STABLE_KEYS → chuỗi JSON ổn định, không phụ thuộc thứ tự query.
  const hash = createHash('sha256')
    .update(JSON.stringify({ ua: userAgent, ...attrs }))
    .digest('hex');

  return { linkCode, userAgent, attrs, sample, hash };
}
