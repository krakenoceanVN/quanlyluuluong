import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FlowService } from '../flow/flow.service';
import { BusinessConflictException } from '../common/app.exceptions';
import { paginate, Paginated } from '../common/dto/pagination.dto';
import { CreateTrackerDto, UpdateTrackerDto } from './dto/tracker.dto';

@Injectable()
export class TrackersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly flow: FlowService,
  ) {}

  /** Count of active links currently using a tracker. */
  private async usageCount(trackerId: string): Promise<number> {
    return this.prisma.linkTracker.count({
      where: { trackerId, link: { deletedAt: null } },
    });
  }

  /** Invalidate cached config of every active link bound to this tracker. */
  private async invalidateBoundLinks(trackerId: string): Promise<void> {
    const rows = await this.prisma.linkTracker.findMany({
      where: { trackerId, link: { deletedAt: null } },
      select: { link: { select: { shortCode: true } } },
    });
    await Promise.all(rows.map((r) => this.flow.invalidateLinkConfig(r.link.shortCode)));
  }

  async list(page: number, pageSize: number, keyword?: string): Promise<Paginated<unknown>> {
    const where: Prisma.TrackerWhereInput = { deletedAt: null };
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.tracker.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { links: true } } },
      }),
      this.prisma.tracker.count({ where }),
    ]);
    // _count.links includes deleted-link rows; recompute accurate active usage
    const items = await Promise.all(
      rows.map(async (t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        code: t.code,
        usageCount: await this.usageCount(t.id),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    );
    return paginate(items, total, page, pageSize);
  }

  async findOne(id: string) {
    const t = await this.prisma.tracker.findFirst({ where: { id, deletedAt: null } });
    if (!t) throw new NotFoundException('统计不存在');
    return { ...t, usageCount: await this.usageCount(id) };
  }

  async create(dto: CreateTrackerDto, userId: string) {
    const t = await this.prisma.tracker.create({
      data: { name: dto.name.trim(), description: dto.description ?? '', code: dto.code ?? '' },
    });
    await this.audit.log({
      userId,
      module: '统计管理',
      action: 'create',
      detail: { id: t.id, name: t.name },
    });
    return t;
  }

  async update(id: string, dto: UpdateTrackerDto, userId: string) {
    const before = await this.prisma.tracker.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw new NotFoundException('统计不存在');
    const after = await this.prisma.tracker.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
      },
    });
    await this.invalidateBoundLinks(id);
    await this.audit.log({
      userId,
      module: '统计管理',
      action: 'update',
      detail: {
        id,
        before: { name: before.name, description: before.description, code: before.code },
        after: { name: after.name, description: after.description, code: after.code },
      },
    });
    return after;
  }

  async remove(id: string, userId: string) {
    const t = await this.prisma.tracker.findFirst({ where: { id, deletedAt: null } });
    if (!t) throw new NotFoundException('统计不存在');
    if ((await this.usageCount(id)) > 0) {
      throw new BusinessConflictException('该统计仍被广告单使用，无法删除');
    }
    await this.prisma.tracker.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      userId,
      module: '统计管理',
      action: 'delete',
      detail: { id, name: t.name },
    });
    return { id };
  }
}
