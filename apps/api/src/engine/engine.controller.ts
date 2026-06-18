import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { EngineService } from './engine.service';

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

function redirectPage(targetUrl: string, trackers: string[]): string {
  // thin page: fire trackers, then redirect
  const safe = targetUrl.replace(/"/g, '&quot;');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>跳转中…</title>${trackers.join('\n')}
<script>setTimeout(function(){location.replace("${safe}")},120);</script>
<noscript><meta http-equiv="refresh" content="0;url=${safe}"></noscript>
</head><body></body></html>`;
}

@Controller()
export class EngineController {
  constructor(private readonly engine: EngineService) {}

  @Get('health')
  health(@Res() res: Response) {
    res.status(200).json({ status: 'ok', ts: new Date().toISOString() });
  }

  @Get('main/link/:shortCode')
  async serve(@Param('shortCode') shortCode: string, @Res() res: Response) {
    const result = await this.engine.serve(shortCode);

    if (result.kind === 'notfound') {
      const p = htmlPage('<div class="box"><b>页面不存在</b><span>链接无效或已下线</span></div>', 404);
      res.status(p.status).type('html').send(p.html);
      return;
    }

    if (result.kind === 'fallback') {
      // still fire trackers so impressions are counted, then show fallback notice
      const trackers = result.trackers?.length ? result.trackers.join('\n') : '';
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
    res.status(200).type('html').send(redirectPage(result.targetUrl!, result.trackers));
  }
}
