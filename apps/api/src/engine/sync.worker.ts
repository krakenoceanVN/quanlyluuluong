import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { dirtyFlowSet, flowKey } from './traffic.keys';

/**
 * Periodically mirrors Redis live counters into TrafficDaily.
 * Counters are written as absolute values, so the operation is idempotent and
 * a missed cycle simply re-persists the same number next time.
 */
@Injectable()
export class SyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('SyncWorker');
  private timer?: NodeJS.Timeout;
  private running = false;

  private static readonly ACK_LUA = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      return redis.call('SREM', KEYS[2], ARGV[2])
    end
    return 0`;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (process.env.DISABLE_SYNC_WORKER === '1') return;
    const sec = Number(this.config.get('TRAFFIC_SYNC_INTERVAL_SEC', 60));
    this.timer = setInterval(() => void this.flush(), Math.max(5, sec) * 1000);
    this.logger.log(`traffic sync worker started (every ${sec}s)`);
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    // #60: flush lần cuối khi tắt để không mất số đếm chưa đồng bộ
    if (process.env.DISABLE_SYNC_WORKER !== '1') {
      try {
        await this.flush();
      } catch {
        /* ignore on shutdown */
      }
    }
  }

  /** Drain the dirty set and upsert each counter. Exposed for tests. */
  async flush(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let synced = 0;
    try {
      const members = await this.redis.client.smembers(dirtyFlowSet());
      for (const member of members) {
        const [linkAdId, date] = member.split('|');
        if (!linkAdId || !date) {
          await this.redis.client.srem(dirtyFlowSet(), member);
          continue;
        }
        const raw = await this.redis.client.get(flowKey(linkAdId, date));
        const count = Number(raw ?? 0);
        // membership may have been deleted; guard with upsert that requires existing row via try/catch
        try {
          await this.prisma.trafficDaily.upsert({
            where: { linkAdId_date: { linkAdId, date: new Date(`${date}T00:00:00.000Z`) } },
            update: { count },
            create: { linkAdId, date: new Date(`${date}T00:00:00.000Z`), count },
          });
          synced++;
        } catch (e) {
          // linkAd no longer exists → drop the counter quietly
          this.logger.warn(`skip sync ${member}: ${(e as Error).message}`);
        }
        await this.redis.client.eval(
          SyncWorker.ACK_LUA,
          2,
          flowKey(linkAdId, date),
          dirtyFlowSet(),
          String(count),
          member,
        );
      }
    } catch (e) {
      this.logger.error(`flush failed: ${(e as Error).message}`);
    } finally {
      this.running = false;
    }
    return synced;
  }
}
