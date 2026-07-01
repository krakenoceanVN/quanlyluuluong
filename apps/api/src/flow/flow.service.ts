import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { dirtyFlowSet, flowKey, linkConfigKey, todayKey } from '../engine/traffic.keys';

const FLOW_TTL_SEC = 48 * 3600;

/**
 * Single source of truth for "today" traffic counters.
 * Redis holds the live cumulative counter per membership; the worker mirrors it to TrafficDaily.
 */
@Injectable()
export class FlowService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // Seed the counter from its persisted value on first touch, then increment — atomically.
  private static readonly INCR_LUA = `
    if redis.call('EXISTS', KEYS[1]) == 0 then
      redis.call('SET', KEYS[1], ARGV[1])
    end
    local n = redis.call('INCR', KEYS[1])
    redis.call('EXPIRE', KEYS[1], ARGV[2])
    redis.call('SADD', KEYS[2], ARGV[3])
    return n`;

  /** Atomically increment today's counter and mark it dirty for the sync worker. */
  async increment(linkAdId: string): Promise<number> {
    const date = todayKey();
    const key = flowKey(linkAdId, date);

    // If the key is cold, recover the base value from TrafficDaily so we don't restart at 0.
    let base = 0;
    if ((await this.redis.client.exists(key)) === 0) {
      const row = await this.prisma.trafficDaily.findUnique({
        where: { linkAdId_date: { linkAdId, date: new Date(`${date}T00:00:00.000Z`) } },
      });
      base = row?.count ?? 0;
    }

    const n = (await this.redis.client.eval(
      FlowService.INCR_LUA,
      2,
      key,
      dirtyFlowSet(),
      String(base),
      String(FLOW_TTL_SEC),
      `${linkAdId}|${date}`,
    )) as number;
    return Number(n);
  }

  /** Current counter value for a membership today (Redis first, DB fallback). */
  async getToday(linkAdId: string): Promise<number> {
    const map = await this.getTodayMap([linkAdId]);
    return map.get(linkAdId) ?? 0;
  }

  /** Batch read of today's counters; falls back to TrafficDaily when Redis is cold. */
  async getTodayMap(linkAdIds: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>();
    if (linkAdIds.length === 0) return out;
    const date = todayKey();
    const vals = await this.redis.client.mget(linkAdIds.map((id) => flowKey(id, date)));
    const missing: string[] = [];
    linkAdIds.forEach((id, i) => {
      const v = vals[i];
      if (v === null || v === undefined) missing.push(id);
      else out.set(id, Number(v));
    });
    if (missing.length) {
      const rows = await this.prisma.trafficDaily.findMany({
        where: { linkAdId: { in: missing }, date: new Date(`${date}T00:00:00.000Z`) },
      });
      const dbMap = new Map(rows.map((r) => [r.linkAdId, r.count]));
      for (const id of missing) out.set(id, dbMap.get(id) ?? 0);
    }
    return out;
  }

  /** Invalidate cached link config after an admin edit. */
  async invalidateLinkConfig(shortCode: string): Promise<void> {
    await this.redis.client.del(linkConfigKey(shortCode));
  }
}
