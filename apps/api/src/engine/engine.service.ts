import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { FlowService } from '../flow/flow.service';
import { linkConfigKey } from './traffic.keys';
import { pickWeighted } from './weighted-random';

interface AdConfig {
  linkAdId: string;
  adId: string;
  targetUrl: string;
  weight: number;
  dailyLimit: number;
  status: boolean; // membership status
  adStatus: boolean; // ad status
}

interface LinkConfig {
  linkId: string;
  shortCode: string;
  status: boolean;
  trackers: string[];
  ads: AdConfig[];
}

export interface ServeResult {
  kind: 'redirect' | 'notfound' | 'fallback';
  targetUrl?: string;
  trackers?: string[];
}

@Injectable()
export class EngineService {
  private readonly logger = new Logger('Engine');

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly flow: FlowService,
    private readonly config: ConfigService,
  ) {}

  /** Load link config from Redis cache, falling back to DB and caching the result. */
  private async getConfig(shortCode: string): Promise<LinkConfig | null> {
    const key = linkConfigKey(shortCode);
    const cached = await this.redis.client.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as LinkConfig;
      } catch {
        /* fall through to DB */
      }
    }

    const link = await this.prisma.link.findFirst({
      where: { shortCode, deletedAt: null },
      include: {
        linkAds: { include: { ad: true } },
        trackers: { include: { tracker: true } },
      },
    });
    if (!link) return null;

    const cfg: LinkConfig = {
      linkId: link.id,
      shortCode: link.shortCode,
      status: link.status,
      trackers: link.trackers.map((t) => t.tracker.code).filter((c) => !!c),
      ads: link.linkAds.map((m) => ({
        linkAdId: m.id,
        adId: m.adId,
        targetUrl: m.ad.targetUrl,
        weight: m.weight,
        dailyLimit: m.dailyLimit,
        status: m.status,
        adStatus: m.ad.status,
      })),
    };

    const ttl = Number(this.config.get('LINK_CACHE_TTL_SEC', 30));
    await this.redis.client.set(key, JSON.stringify(cfg), 'EX', ttl);
    return cfg;
  }

  /**
   * Core distribution: choose an ad for a short code.
   * Steps mirror the spec: validate link → filter eligible (status + under daily limit)
   * → weighted random → increment counter → return redirect (+ trackers) or fallback.
   */
  async serve(shortCode: string, rng: () => number = Math.random): Promise<ServeResult> {
    const cfg = await this.getConfig(shortCode);
    if (!cfg || !cfg.status) return { kind: 'notfound' };

    // candidate filter: membership on + ad on
    const enabled = cfg.ads.filter((a) => a.status && a.adStatus);
    if (enabled.length === 0) return { kind: 'fallback', trackers: cfg.trackers };

    // read today's counters and drop those at/over their daily limit
    const flowMap = await this.flow.getTodayMap(enabled.map((a) => a.linkAdId));
    const candidates = enabled.filter((a) => {
      if (a.dailyLimit <= 0) return true; // 0 = unlimited
      return (flowMap.get(a.linkAdId) ?? 0) < a.dailyLimit;
    });

    if (candidates.length === 0) return { kind: 'fallback', trackers: cfg.trackers };

    const chosen = pickWeighted(
      candidates.map((c) => ({ id: c.linkAdId, weight: c.weight, ref: c })),
      rng,
    );
    if (!chosen) return { kind: 'fallback', trackers: cfg.trackers };

    await this.flow.increment(chosen.id);

    return { kind: 'redirect', targetUrl: chosen.ref.targetUrl, trackers: cfg.trackers };
  }
}
