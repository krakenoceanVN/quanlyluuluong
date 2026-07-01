import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { engineStatKey, todayKey } from './traffic.keys';

/** Các kết quả có thể xảy ra cho một lượt gọi /main/link/:code. */
export type EngineOutcome = 'redirect' | 'fallback' | 'notfound' | 'throttled';

const STAT_TTL_SEC = 48 * 3600;

/**
 * Đo "traffic rơi ở đâu": mỗi lượt gọi engine được cộng vào đúng ô.
 * - redirect  = phục vụ được (đã đếm flow)
 * - fallback  = link/quảng cáo hết hàng hoặc chạm 限流 → không đếm flow
 * - notfound  = link không tồn tại / đã tắt
 * - throttled = bị chặn 429 trước khi vào engine
 * Dùng chung "ngày" nghiệp vụ (UTC+8) với bộ đếm flow để đối chiếu trực tiếp.
 */
@Injectable()
export class EngineStatsService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /** Cộng 1 lượt cho 1 kết quả. KHÔNG bao giờ ném lỗi → không chặn phục vụ (#55). */
  async bump(shortCode: string, outcome: EngineOutcome): Promise<void> {
    if (!shortCode) return;
    const key = engineStatKey(shortCode, todayKey());
    try {
      await this.redis.client.multi().hincrby(key, outcome, 1).expire(key, STAT_TTL_SEC).exec();
    } catch {
      /* Redis lỗi thì bỏ qua đo đạc, không ảnh hưởng redirect */
    }
  }

  /** Bảng kết quả theo từng link cho 1 ngày (mặc định hôm nay, giờ nghiệp vụ). */
  async read(date: string = todayKey()) {
    const links = await this.prisma.link.findMany({
      where: { deletedAt: null },
      select: { shortCode: true, name: true },
      orderBy: { name: 'asc' },
    });

    let raws: Array<Record<string, string>> = [];
    try {
      const pipe = this.redis.client.pipeline();
      for (const l of links) pipe.hgetall(engineStatKey(l.shortCode, date));
      const res = await pipe.exec();
      raws = (res ?? []).map(([, v]) => (v as Record<string, string>) ?? {});
    } catch {
      raws = links.map(() => ({}));
    }

    const rows = links.map((l, i) => {
      const h = raws[i] ?? {};
      const redirect = Number(h.redirect ?? 0);
      const fallback = Number(h.fallback ?? 0);
      const notfound = Number(h.notfound ?? 0);
      const throttled = Number(h.throttled ?? 0);
      const total = redirect + fallback + notfound + throttled;
      const lost = fallback + notfound + throttled;
      return {
        shortCode: l.shortCode,
        name: l.name,
        redirect,
        fallback,
        notfound,
        throttled,
        total,
        lost,
        // tỉ lệ phục vụ được / tổng lượt engine nhận (0..1)
        servedRate: total ? Number((redirect / total).toFixed(4)) : 0,
      };
    });

    return { date, rows };
  }
}
