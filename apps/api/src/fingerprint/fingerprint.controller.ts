import { All, Controller, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { FingerprintService } from './fingerprint.service';

@Controller()
export class FingerprintController {
  constructor(private readonly fingerprints: FingerprintService) {}

  /**
   * Beacon chống gian lận do mã thống kê trên trang trung gian gửi về
   * (navigator.sendBeacon = POST, dự phòng new Image() = GET). Dữ liệu nằm trong query string.
   * Luôn trả 204 ngay, không lộ kết quả ghi.
   */
  @Throttle({ default: { limit: 600, ttl: 60000 } })
  @All('main/beacon')
  async beacon(@Req() req: Request, @Res() res: Response) {
    await this.fingerprints.record(req.query as Record<string, unknown>, req.get('user-agent'));
    res.status(204).set('Cache-Control', 'no-store').end();
  }
}
