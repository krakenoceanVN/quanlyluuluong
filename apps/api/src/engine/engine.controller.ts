import { Controller, Get, Param, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { EngineService } from './engine.service';
import { EngineStatsService } from './engine-stats.service';

function htmlPage(body: string, status = 200): { status: number; html: string } {
  return {
    status,
    html: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>流量管理系统</title>
<style>body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#eef0f5;
color:#2a3040;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
.box{text-align:center}.box b{display:block;font-size:18px;margin-bottom:6px}
.box span{color:#8a91a5;font-size:13px}</style></head><body>${body}</body></html>`,
  };
}

/** Chỉ chấp nhận URL http(s) hoặc protocol-relative (//...) — chặn javascript:, data:… */
const SAFE_SRC = /^(https?:)?\/\/[^\s"'<>]+$/i;
/** Một khối <script ...>...</script> (ngoài hoặc nội tuyến). */
const SCRIPT_BLOCK = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const SRC_ATTR = /\bsrc\s*=\s*["']([^"']+)["']/i;
/** Thuộc tính sự kiện on* (onload/onerror…) — strip để chặn XSS lộ liễu. */
const ON_ATTR = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

/**
 * Mã thống kê bên thứ 3 (51la…) do ADMIN nhập — vốn LÀ script bên thứ ba nhúng vào trang.
 * Giữ đúng thứ SDK cần để chạy:
 *   - <script src="..."> nguồn an toàn, GIỮ NGUYÊN thuộc tính (id, charset, data-attr, async…)
 *     vì nhiều SDK tự init dựa vào các thuộc tính này (vd id="LA_COLLECT").
 *   - <script>...</script> nội tuyến (vd LA.init({...})) — 51la v6 bắt buộc.
 * Chặn: src không phải http/https/protocol-relative, và mọi thuộc tính sự kiện on*.
 * (Cho phép JS nội tuyến = tin tưởng input ADMIN, đúng bản chất tính năng nhúng tracker.)
 */
function sanitizeTrackers(trackers: string[]): string {
  const out: string[] = [];
  for (const code of trackers) {
    let m: RegExpExecArray | null;
    SCRIPT_BLOCK.lastIndex = 0;
    while ((m = SCRIPT_BLOCK.exec(code)) !== null) {
      const rawAttrs = m[1] ?? '';
      const body = m[2] ?? '';
      const src = SRC_ATTR.exec(rawAttrs)?.[1]?.trim();
      if (src && !SAFE_SRC.test(src)) continue; // src không an toàn → bỏ cả khối
      const attrs = rawAttrs.replace(ON_ATTR, '').replace(/\s+/g, ' ').trim();
      out.push(`<script${attrs ? ` ${attrs}` : ''}>${body}</script>`);
    }
  }
  return out.join('\n');
}

/** Escape cho ngữ cảnh thuộc tính HTML. */
function attrEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Thời gian chờ của trang trung gian trước khi chuyển tới quảng cáo. */
export interface RedirectTiming {
  /** Sau khi trang tải xong (mọi script thống kê đã tải) chờ thêm bấy nhiêu ms để chúng kịp gửi dữ liệu. */
  afterLoadMs: number;
  /** Trần tuyệt đối: quá mốc này thì chuyển luôn dù script thống kê chưa tải xong (mạng chậm, host bị chặn…). */
  maxWaitMs: number;
}

export const DEFAULT_REDIRECT_TIMING: RedirectTiming = { afterLoadMs: 300, maxWaitMs: 1500 };

/** Đọc số ms từ env, kẹp trong [0, 10000]; sai định dạng → giá trị mặc định. */
export function readTimingMs(raw: unknown, fallback: number): number {
  const n = Number(raw);
  if (raw === undefined || raw === null || raw === '' || !Number.isFinite(n)) return fallback;
  return Math.min(10000, Math.max(0, Math.round(n)));
}

export function redirectPage(
  targetUrl: string,
  trackers: string[],
  timing: RedirectTiming = DEFAULT_REDIRECT_TIMING,
): string {
  // JSON.stringify → chuỗi JS an toàn (xử lý ", \, xuống dòng) — fix #16/#39.
  // Thêm escape "<" để URL chứa "</script>" không thể đóng thẻ script sớm.
  const jsSafe = JSON.stringify(targetUrl).replace(/</g, '\\u003c');
  const attrSafe = attrEscape(targetUrl);
  const after = Math.max(0, Math.round(timing.afterLoadMs));
  const max = Math.max(0, Math.round(timing.maxWaitMs));
  // Trước đây cố định 120ms → SDK thống kê (51la…) thường chưa kịp gửi dữ liệu đã bị chuyển trang.
  // Nay: chờ sự kiện load (script đồng bộ + script chèn động như hm.js đều đã tải) + `after` ms,
  // nhưng không bao giờ quá `max` ms kể từ lúc chạy tới đây.
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>跳转中…</title>${sanitizeTrackers(trackers)}
<script>(function(){var d=0;function go(){if(d)return;d=1;location.replace(${jsSafe})}
setTimeout(go,${max});
function arm(){setTimeout(go,${after})}
if(document.readyState==='complete')arm();else window.addEventListener('load',arm);})();</script>
<noscript><meta http-equiv="refresh" content="0;url=${attrSafe}"></noscript>
</head><body></body></html>`;
}

@Controller()
export class EngineController {
  private readonly timing: RedirectTiming;

  constructor(
    private readonly engine: EngineService,
    private readonly stats: EngineStatsService,
    config: ConfigService,
  ) {
    this.timing = {
      afterLoadMs: readTimingMs(
        config.get('REDIRECT_AFTER_LOAD_MS'),
        DEFAULT_REDIRECT_TIMING.afterLoadMs,
      ),
      maxWaitMs: readTimingMs(
        config.get('REDIRECT_MAX_WAIT_MS'),
        DEFAULT_REDIRECT_TIMING.maxWaitMs,
      ),
    };
  }

  @SkipThrottle()
  @Get('health')
  health(@Res() res: Response) {
    res.status(200).json({ status: 'ok', ts: new Date().toISOString() });
  }

  // #51: chặn 1 IP flood engine (600/60s ≈ 10/s/IP) — người dùng thật không ảnh hưởng
  @Throttle({ default: { limit: 600, ttl: 60000 } })
  @Get('main/link/:shortCode')
  async serve(@Param('shortCode') shortCode: string, @Res() res: Response) {
    const result = await this.engine.serve(shortCode);

    // Đo kết quả để nhìn thấy "traffic rơi ở đâu" (fire-and-forget, không thêm độ trễ).
    void this.stats.bump(shortCode, result.kind);

    if (result.kind === 'notfound') {
      const p = htmlPage(
        '<div class="box"><b>页面不存在</b><span>链接无效或已下线</span></div>',
        404,
      );
      res.status(p.status).type('html').send(p.html);
      return;
    }

    if (result.kind === 'fallback') {
      // still fire trackers so impressions are counted, then show fallback notice
      const trackers = result.trackers?.length ? sanitizeTrackers(result.trackers) : '';
      const p = htmlPage(
        `${trackers}<div class="box"><b>暂无可用内容</b><span>请稍后再试</span></div>`,
        200,
      );
      res.status(p.status).type('html').send(p.html);
      return;
    }

    // redirect
    if (!result.trackers || result.trackers.length === 0) {
      res.redirect(302, result.targetUrl!);
      return;
    }
    res
      .status(200)
      .type('html')
      .send(redirectPage(result.targetUrl!, result.trackers, this.timing));
  }
}
