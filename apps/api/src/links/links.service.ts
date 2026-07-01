import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FlowService } from '../flow/flow.service';
import { BusinessConflictException } from '../common/app.exceptions';
import { paginate, Paginated } from '../common/dto/pagination.dto';
import { CreateLinkDto, ReplaceLinkAdsDto, UpdateLinkAdDto, UpdateLinkDto } from './dto/link.dto';

@Injectable()
export class LinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly flow: FlowService,
  ) {}

  private async genShortCode(): Promise<string> {
    for (let i = 0; i < 10; i++) {
      const code = randomBytes(6).toString('base64url').slice(0, 8).toLowerCase();
      const exists = await this.prisma.link.findUnique({ where: { shortCode: code } });
      if (!exists) return code;
    }
    throw new Error('failed to generate unique short code');
  }

  async list(page: number, pageSize: number, keyword?: string): Promise<Paginated<unknown>> {
    const where: Prisma.LinkWhereInput = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
        { note: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.link.findMany({
        where,
        orderBy: [{ name: 'asc' }, { createdAt: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { linkAds: true } } },
      }),
      this.prisma.link.count({ where }),
    ]);
    const items = rows.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      note: l.note,
      shortCode: l.shortCode,
      url: this.publicUrl(l.shortCode),
      status: l.status,
      adCount: l._count.linkAds,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
    }));
    return paginate(items, total, page, pageSize);
  }

  private publicUrl(shortCode: string): string {
    const domain = (process.env.PUBLIC_LINK_DOMAIN ?? 'http://localhost:3000').replace(/\/$/, '');
    return `${domain}/main/link/${shortCode}`;
  }

  /** Full detail: link + memberships (with ad info & today flow) + bound trackers. */
  async findOne(id: string) {
    const link = await this.prisma.link.findFirst({
      where: { id, deletedAt: null },
      include: {
        linkAds: {
          orderBy: [{ ad: { name: 'asc' } }, { sortOrder: 'asc' }],
          include: { ad: true },
        },
        trackers: { include: { tracker: true } },
      },
    });
    if (!link) throw new NotFoundException('链接不存在');

    const flowMap = await this.flow.getTodayMap(link.linkAds.map((m) => m.id));
    return {
      id: link.id,
      name: link.name,
      description: link.description,
      note: link.note,
      shortCode: link.shortCode,
      url: this.publicUrl(link.shortCode),
      status: link.status,
      trackers: link.trackers.map((t) => ({
        id: t.tracker.id,
        name: t.tracker.name,
        description: t.tracker.description,
      })),
      ads: link.linkAds.map((m) => ({
        linkAdId: m.id,
        adId: m.adId,
        name: m.ad.name,
        targetUrl: m.ad.targetUrl,
        weight: m.weight,
        dailyLimit: m.dailyLimit,
        // 备注 = thuộc tính của quảng cáo (đồng bộ với 描述 ở 广告管理), không lưu theo từng link
        note: m.ad.description,
        status: m.status,
        adStatus: m.ad.status,
        today: flowMap.get(m.id) ?? 0,
        sortOrder: m.sortOrder,
      })),
    };
  }

  async create(dto: CreateLinkDto, userId: string) {
    const name = dto.name.trim();
    let shortCode = dto.shortCode?.trim().toLowerCase();
    if (shortCode) {
      const taken = await this.prisma.link.findUnique({ where: { shortCode } });
      if (taken) throw new BusinessConflictException('链接后缀已被占用，请更换');
    } else {
      shortCode = await this.genShortCode();
    }
    const link = await this.prisma.link.create({
      data: {
        name,
        description: dto.description ?? '',
        note: dto.note ?? '',
        shortCode,
        trackers: dto.trackerIds?.length
          ? { create: dto.trackerIds.map((trackerId) => ({ trackerId })) }
          : undefined,
      },
    });
    await this.audit.log({
      userId,
      module: '链接管理',
      action: 'create',
      detail: { id: link.id, name, trackerCount: dto.trackerIds?.length ?? 0 },
    });
    return { ...link, url: this.publicUrl(link.shortCode) };
  }

  async update(id: string, dto: UpdateLinkDto, userId: string) {
    const before = await this.prisma.link.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('链接不存在');

    const data: Prisma.LinkUpdateInput = {};
    if (dto.name !== undefined && dto.name !== null) data.name = dto.name.trim();
    if (dto.description !== undefined && dto.description !== null) data.description = dto.description;
    if (dto.note !== undefined && dto.note !== null) data.note = dto.note;

    const after = await this.prisma.$transaction(async (tx) => {
      const updated = Object.keys(data).length
        ? await tx.link.update({ where: { id }, data })
        : await tx.link.findUniqueOrThrow({ where: { id } });
      if (dto.trackerIds !== undefined && dto.trackerIds !== null) {
        await tx.linkTracker.deleteMany({ where: { linkId: id } });
        if (dto.trackerIds.length) {
          const existing = await tx.tracker.findMany({
            where: { id: { in: dto.trackerIds }, deletedAt: null },
            select: { id: true },
          });
          const validIds = new Set(existing.map((t) => t.id));
          const unknown = dto.trackerIds.filter((tid) => !validIds.has(tid));
          if (unknown.length) {
            throw new BusinessConflictException(
              `统计不存在或已删除：${unknown.join(', ')}`,
            );
          }
          await tx.linkTracker.createMany({
            data: dto.trackerIds.map((trackerId) => ({ linkId: id, trackerId })),
          });
        }
      }
      return updated;
    });

    await this.flow.invalidateLinkConfig(before.shortCode);
    await this.audit.log({
      userId,
      module: '链接管理',
      action: 'update',
      detail: {
        id,
        before: { name: before.name, description: before.description, note: before.note },
        after: { name: after.name, description: after.description, note: after.note },
      },
    });
    return after;
  }

  async setStatus(id: string, status: boolean, userId: string) {
    const link = await this.prisma.link.findFirst({ where: { id, deletedAt: null } });
    if (!link) throw new NotFoundException('链接不存在');
    const after = await this.prisma.link.update({ where: { id }, data: { status } });
    await this.flow.invalidateLinkConfig(link.shortCode);
    await this.audit.log({
      userId,
      module: '链接管理',
      action: status ? 'online' : 'offline',
      detail: { id, name: link.name, status },
    });
    return after;
  }

  async remove(id: string, userId: string) {
    const link = await this.prisma.link.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { linkAds: true } } },
    });
    if (!link) throw new NotFoundException('链接不存在');
    if (link._count.linkAds > 0) {
      throw new BusinessConflictException('仅可删除不包含广告的链接');
    }
    await this.prisma.$transaction([
      this.prisma.linkTracker.deleteMany({ where: { linkId: id } }),
      this.prisma.link.update({ where: { id }, data: { deletedAt: new Date() } }),
    ]);
    await this.flow.invalidateLinkConfig(link.shortCode);
    await this.audit.log({
      userId,
      module: '链接管理',
      action: 'delete',
      detail: { id, name: link.name },
    });
    return { id };
  }

  /** Memberships of a link with today flow (used by the link-edit grid). */
  async getAds(linkId: string) {
    const link = await this.prisma.link.findFirst({ where: { id: linkId, deletedAt: null } });
    if (!link) throw new NotFoundException('链接不存在');
    const memberships = await this.prisma.linkAd.findMany({
      where: { linkId },
      orderBy: [{ ad: { name: 'asc' } }, { sortOrder: 'asc' }],
      include: { ad: true },
    });
    const flowMap = await this.flow.getTodayMap(memberships.map((m) => m.id));
    return memberships.map((m) => ({
      linkAdId: m.id,
      adId: m.adId,
      name: m.ad.name,
      targetUrl: m.ad.targetUrl,
      weight: m.weight,
      dailyLimit: m.dailyLimit,
      // 备注 = ad.description (đồng bộ với 广告管理)
      note: m.ad.description,
      status: m.status,
      today: flowMap.get(m.id) ?? 0,
    }));
  }

  /**
   * Replace whole membership set with full config (transfer 提交).
   * weight/dailyLimit bắt buộc & > 0 (validate ở DTO). note ghi vào ad.description (đồng bộ theo quảng cáo).
   */
  async replaceAds(linkId: string, dto: ReplaceLinkAdsDto, userId: string) {
    const link = await this.prisma.link.findFirst({ where: { id: linkId, deletedAt: null } });
    if (!link) throw new NotFoundException('链接不存在');

    const reqIds = dto.items.map((it) => it.adId);
    const validAds = await this.prisma.ad.findMany({
      where: { id: { in: reqIds }, deletedAt: null },
      select: { id: true },
    });
    const validIds = new Set(validAds.map((a) => a.id));
    const items = dto.items.filter((it) => validIds.has(it.adId));

    const current = await this.prisma.linkAd.findMany({ where: { linkId } });
    const keepIds = new Set(items.map((it) => it.adId));
    const toRemove = current.filter((m) => !keepIds.has(m.adId));

    await this.prisma.$transaction(async (tx) => {
      // remove dropped memberships (+ their traffic to satisfy FK)
      if (toRemove.length) {
        await tx.trafficDaily.deleteMany({
          where: { linkAdId: { in: toRemove.map((m) => m.id) } },
        });
        await tx.linkAd.deleteMany({ where: { id: { in: toRemove.map((m) => m.id) } } });
      }
      // upsert each kept/added membership with its config
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await tx.linkAd.upsert({
          where: { linkId_adId: { linkId, adId: it.adId } },
          create: {
            linkId,
            adId: it.adId,
            weight: it.weight,
            dailyLimit: it.dailyLimit,
            status: it.status ?? true,
            sortOrder: i,
          },
          update: {
            weight: it.weight,
            dailyLimit: it.dailyLimit,
            ...(it.status !== undefined ? { status: it.status } : {}),
            sortOrder: i,
          },
        });
        // 备注 = ad.description (đồng bộ theo quảng cáo)
        if (it.note !== undefined) {
          await tx.ad.update({ where: { id: it.adId }, data: { description: it.note.trim() } });
        }
      }
    });

    await this.flow.invalidateLinkConfig(link.shortCode);
    await this.audit.log({
      userId,
      module: '链接管理',
      action: 'replace-ads',
      detail: { linkId, name: link.name, count: items.length, removed: toRemove.length },
    });
    return this.getAds(linkId);
  }

  /** Patch a single membership's weight/limit/note/status. */
  async updateAd(linkId: string, adId: string, dto: UpdateLinkAdDto, userId: string) {
    const link = await this.prisma.link.findFirst({ where: { id: linkId, deletedAt: null } });
    if (!link) throw new NotFoundException('链接不存在');
    const before = await this.prisma.linkAd.findUnique({
      where: { linkId_adId: { linkId, adId } },
      include: { ad: true },
    });
    if (!before) throw new NotFoundException('该广告不在此广告单内');

    const after = await this.prisma.linkAd.update({
      where: { linkId_adId: { linkId, adId } },
      data: {
        ...(dto.weight !== undefined ? { weight: dto.weight } : {}),
        ...(dto.dailyLimit !== undefined ? { dailyLimit: dto.dailyLimit } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    if (dto.note !== undefined) {
      await this.prisma.ad.update({
        where: { id: adId },
        data: { description: dto.note.trim() },
      });
    }

    await this.flow.invalidateLinkConfig(link.shortCode);
    await this.audit.log({
      userId,
      module: '链接管理',
      action: 'update-ad',
      detail: {
        linkId,
        adId,
        adName: before.ad.name,
        before: {
          weight: before.weight,
          dailyLimit: before.dailyLimit,
          note: before.ad.description,
          status: before.status,
        },
        after: {
          weight: after.weight,
          dailyLimit: after.dailyLimit,
          note: dto.note !== undefined ? dto.note.trim() : before.ad.description,
          status: after.status,
        },
      },
    });
    return after;
  }
}
