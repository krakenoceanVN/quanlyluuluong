import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FlowService } from '../flow/flow.service';
import { todayKey } from '../engine/traffic.keys';

function asUtcDate(d: string): Date {
  return new Date(`${d}T00:00:00.000Z`);
}
function addDays(d: string, delta: number): string {
  const date = asUtcDate(d);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flow: FlowService,
  ) {}

  /** Counts for a set of memberships on a specific date (Redis if today, else DB). */
  private async flowForDate(linkAdIds: string[], date: string): Promise<Map<string, number>> {
    if (linkAdIds.length === 0) return new Map();
    if (date === todayKey()) return this.flow.getTodayMap(linkAdIds);
    const rows = await this.prisma.trafficDaily.findMany({
      where: { linkAdId: { in: linkAdIds }, date: asUtcDate(date) },
    });
    const map = new Map<string, number>();
    for (const id of linkAdIds) map.set(id, 0);
    for (const r of rows) map.set(r.linkAdId, r.count);
    return map;
  }

  /** 首页 dashboard for a given date: online links with their ad rows. */
  async dashboard(date?: string) {
    const day = date ?? todayKey();
    const yesterday = addDays(day, -1);

    const links = await this.prisma.link.findMany({
      where: { deletedAt: null, status: true },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      include: {
        linkAds: {
          orderBy: [{ ad: { name: 'asc' } }, { sortOrder: 'asc' }],
          include: { ad: true },
        },
      },
    });

    const allMembershipIds = links.flatMap((l) => l.linkAds.map((m) => m.id));
    const todayMap = await this.flowForDate(allMembershipIds, day);
    const yesterdayMap = await this.flowForDate(allMembershipIds, yesterday);

    const domain = (process.env.PUBLIC_LINK_DOMAIN ?? 'http://localhost:3000').replace(/\/$/, '');

    return {
      date: day,
      links: links.map((l) => {
        // rows = cấu hình hiện tại (membership active); TỔNG thì cộng cả membership đã gỡ
        // trong ngày để số hôm nay/hôm qua khớp lượng traffic đã phục vụ thật.
        const active = l.linkAds.filter((m) => !m.deletedAt);
        const ads = active.map((m, i) => ({
          seq: i + 1,
          linkAdId: m.id,
          adId: m.adId,
          name: m.ad.name,
          targetUrl: m.ad.targetUrl,
          weight: m.weight,
          dailyLimit: m.dailyLimit,
          today: todayMap.get(m.id) ?? 0,
          status: m.status,
          note: m.ad.description, // đồng bộ với 描述 (广告管理)
        }));
        return {
          id: l.id,
          name: l.name,
          url: `${domain}/main/link/${l.shortCode}`,
          yesterdayTotal: l.linkAds.reduce((s, m) => s + (yesterdayMap.get(m.id) ?? 0), 0),
          todayTotal: l.linkAds.reduce((s, m) => s + (todayMap.get(m.id) ?? 0), 0),
          ads,
        };
      }),
    };
  }

  /** 数据查询: grouped-by-link traffic in a date range + per-day series. */
  async traffic(q: { from?: string; to?: string; linkId?: string; adKeyword?: string }) {
    const to = q.to ?? todayKey();
    const from = q.from ?? addDays(to, -6);

    const linkWhere: Prisma.LinkWhereInput = { deletedAt: null };
    if (q.linkId) linkWhere.id = q.linkId;

    const links = await this.prisma.link.findMany({
      where: linkWhere,
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
      include: {
        linkAds: {
          orderBy: [{ ad: { name: 'asc' } }, { sortOrder: 'asc' }],
          include: { ad: true },
        },
      },
    });

    const result = [];
    for (const l of links) {
      let memberships = l.linkAds;
      if (q.adKeyword) {
        const kw = q.adKeyword.toLowerCase();
        memberships = memberships.filter((m) => m.ad.name.toLowerCase().includes(kw));
      }
      if (q.adKeyword && memberships.length === 0) continue;

      const ids = memberships.map((m) => m.id);
      const rows = ids.length
        ? await this.prisma.trafficDaily.findMany({
            where: {
              linkAdId: { in: ids },
              date: { gte: asUtcDate(from), lte: asUtcDate(to) },
            },
          })
        : [];

      // include today's live counter if range covers today
      const liveMap =
        to >= todayKey() && from <= todayKey() ? await this.flow.getTodayMap(ids) : new Map();

      const totalByMember = new Map<string, number>();
      const byDate = new Map<string, number>();
      for (const r of rows) {
        const dk = r.date.toISOString().slice(0, 10);
        if (dk === todayKey() && liveMap.has(r.linkAdId)) continue; // prefer live below
        totalByMember.set(r.linkAdId, (totalByMember.get(r.linkAdId) ?? 0) + r.count);
        byDate.set(dk, (byDate.get(dk) ?? 0) + r.count);
      }
      if (liveMap.size) {
        const tk = todayKey();
        for (const [id, v] of liveMap) {
          totalByMember.set(id, (totalByMember.get(id) ?? 0) + (v as number));
          byDate.set(tk, (byDate.get(tk) ?? 0) + (v as number));
        }
      }

      const series: { date: string; count: number }[] = [];
      for (let d = from; d <= to; d = addDays(d, 1)) {
        series.push({ date: d, count: byDate.get(d) ?? 0 });
      }

      // ── Kỳ lùi 1 ngày (cùng độ dài): [from-1, to-1] ──
      const prevFrom = addDays(from, -1);
      const prevTo = addDays(to, -1);
      const prevRows = ids.length
        ? await this.prisma.trafficDaily.findMany({
            where: {
              linkAdId: { in: ids },
              date: { gte: asUtcDate(prevFrom), lte: asUtcDate(prevTo) },
            },
          })
        : [];
      const prevLive =
        prevTo >= todayKey() && prevFrom <= todayKey()
          ? await this.flow.getTodayMap(ids)
          : new Map();
      const prevByMember = new Map<string, number>();
      for (const r of prevRows) {
        const dk = r.date.toISOString().slice(0, 10);
        if (dk === todayKey() && prevLive.has(r.linkAdId)) continue;
        prevByMember.set(r.linkAdId, (prevByMember.get(r.linkAdId) ?? 0) + r.count);
      }
      for (const [id, v] of prevLive) {
        prevByMember.set(id, (prevByMember.get(id) ?? 0) + (v as number));
      }

      // Tổng cộng CẢ membership đã gỡ (số liệu quá khứ bất biến); chỉ ẩn dòng
      // đã gỡ khi nó không có traffic nào trong kỳ xem.
      const rangeTotal = memberships.reduce((s, m) => s + (totalByMember.get(m.id) ?? 0), 0);
      const prevRangeTotal = memberships.reduce((s, m) => s + (prevByMember.get(m.id) ?? 0), 0);
      const visible = memberships.filter(
        (m) =>
          !m.deletedAt || (totalByMember.get(m.id) ?? 0) > 0 || (prevByMember.get(m.id) ?? 0) > 0,
      );

      const domain = (process.env.PUBLIC_LINK_DOMAIN ?? 'http://localhost:3000').replace(/\/$/, '');
      result.push({
        id: l.id,
        name: l.name,
        url: `${domain}/main/link/${l.shortCode}`,
        rangeTotal,
        prevRangeTotal,
        ads: visible.map((m, i) => ({
          seq: i + 1,
          adId: m.adId,
          name: m.ad.name,
          targetUrl: m.ad.targetUrl,
          weight: m.weight,
          dailyLimit: m.dailyLimit,
          status: m.status,
          removed: !!m.deletedAt, // đã gỡ khỏi link nhưng còn số liệu trong kỳ
          note: m.ad.description, // đồng bộ với 描述 (广告管理)
          total: totalByMember.get(m.id) ?? 0,
          prevTotal: prevByMember.get(m.id) ?? 0,
        })),
        series,
      });
    }

    return { from, to, prevFrom: addDays(from, -1), prevTo: addDays(to, -1), links: result };
  }
}
