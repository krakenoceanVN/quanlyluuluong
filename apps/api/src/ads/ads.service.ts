import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FlowService } from '../flow/flow.service';
import { BusinessConflictException } from '../common/app.exceptions';
import { paginate, Paginated } from '../common/dto/pagination.dto';
import { CreateAdDto, UpdateAdDto } from './dto/ad.dto';

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly flow: FlowService,
  ) {}

  /** Number of active (non-deleted) links that contain this ad. */
  private async usageCount(adId: string): Promise<number> {
    return this.prisma.linkAd.count({ where: { adId, link: { deletedAt: null } } });
  }

  /** Invalidate cached config of every active link that contains this ad. */
  private async invalidateContainingLinks(adId: string): Promise<void> {
    const rows = await this.prisma.linkAd.findMany({
      where: { adId, link: { deletedAt: null } },
      select: { link: { select: { shortCode: true } } },
    });
    await Promise.all(rows.map((r) => this.flow.invalidateLinkConfig(r.link.shortCode)));
  }

  async list(page: number, pageSize: number, keyword?: string): Promise<Paginated<unknown>> {
    const where: Prisma.AdWhereInput = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { targetUrl: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.ad.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.ad.count({ where }),
    ]);
    const items = await Promise.all(
      rows.map(async (a) => ({ ...a, usageCount: await this.usageCount(a.id) })),
    );
    return paginate(items, total, page, pageSize);
  }

  /** Links that contain a given ad (for the 广告单数 drill-down). */
  async linksContaining(adId: string) {
    const rows = await this.prisma.linkAd.findMany({
      where: { adId, link: { deletedAt: null } },
      include: { link: { select: { id: true, name: true, description: true, status: true } } },
    });
    return rows.map((r) => r.link);
  }

  async findOne(id: string) {
    const a = await this.prisma.ad.findFirst({ where: { id, deletedAt: null } });
    if (!a) throw new NotFoundException('广告不存在');
    return { ...a, usageCount: await this.usageCount(id) };
  }

  async create(dto: CreateAdDto, userId: string) {
    const a = await this.prisma.ad.create({
      data: {
        name: dto.name.trim(),
        targetUrl: dto.targetUrl.trim(),
        description: dto.description ?? '',
      },
    });
    await this.audit.log({
      userId,
      module: '广告管理',
      action: 'create',
      detail: { id: a.id, name: a.name },
    });
    return a;
  }

  async update(id: string, dto: UpdateAdDto, userId: string) {
    const before = await this.prisma.ad.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('广告不存在');
    const after = await this.prisma.ad.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.targetUrl !== undefined ? { targetUrl: dto.targetUrl.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      },
    });
    await this.invalidateContainingLinks(id);
    await this.audit.log({
      userId,
      module: '广告管理',
      action: 'update',
      detail: {
        id,
        before: { name: before.name, targetUrl: before.targetUrl, description: before.description },
        after: { name: after.name, targetUrl: after.targetUrl, description: after.description },
      },
    });
    return after;
  }

  async setStatus(id: string, status: boolean, userId: string) {
    const a = await this.prisma.ad.findFirst({ where: { id, deletedAt: null } });
    if (!a) throw new NotFoundException('广告不存在');
    const after = await this.prisma.ad.update({ where: { id }, data: { status } });
    await this.invalidateContainingLinks(id);
    await this.audit.log({
      userId,
      module: '广告管理',
      action: status ? 'online' : 'offline',
      detail: { id, name: a.name, status },
    });
    return after;
  }

  async remove(id: string, userId: string) {
    const a = await this.prisma.ad.findFirst({ where: { id, deletedAt: null } });
    if (!a) throw new NotFoundException('广告不存在');
    if ((await this.usageCount(id)) > 0) {
      throw new BusinessConflictException('该广告仍在广告单内，先移出后才可删除');
    }
    await this.prisma.ad.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId,
      module: '广告管理',
      action: 'delete',
      detail: { id, name: a.name },
    });
    return { id };
  }
}
