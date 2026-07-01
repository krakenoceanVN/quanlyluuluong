import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { EngineStatsService } from './engine-stats.service';

/** Trích shortCode từ path công khai /main/link/:code (có hoặc không prefix). */
const ENGINE_PATH = /\/main\/link\/([^/?#]+)/;

/**
 * ThrottlerGuard mặc định + đếm số lượt bị chặn (429) cho engine, để thống kê
 * "traffic rơi do throttle". Chỉ đếm cho path /main/link/:code; endpoint khác
 * (auth, admin…) vẫn ném 429 như bình thường mà không đếm.
 */
@Injectable()
export class ThrottleCountGuard extends ThrottlerGuard {
  constructor(
    // Phải áp lại token Inject vì subclass khai báo lại constructor (decorator base không kế thừa).
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly stats: EngineStatsService,
  ) {
    super(options, storageService, reflector);
  }

  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    try {
      const req = context
        .switchToHttp()
        .getRequest<{ params?: Record<string, string>; originalUrl?: string; url?: string }>();
      const shortCode =
        req?.params?.shortCode ?? ENGINE_PATH.exec(req?.originalUrl ?? req?.url ?? '')?.[1];
      if (shortCode) await this.stats.bump(shortCode, 'throttled');
    } catch {
      /* đo đạc lỗi cũng không được cản việc trả 429 */
    }
    return super.throwThrottlingException(context, detail);
  }
}
