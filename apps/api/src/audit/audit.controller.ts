import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { paginate } from '../common/dto/pagination.dto';
import { QueryAuditDto } from './dto/query-audit.dto';

// #1: nhật ký chỉ ADMIN được xem
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Query() q: QueryAuditDto) {
    const where: Prisma.AuditLogWhereInput = {};
    if (q.module) where.module = q.module;
    if (q.userId) where.userId = q.userId;
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = new Date(`${q.from}T00:00:00.000Z`);
      if (q.to) where.createdAt.lte = new Date(`${q.to}T23:59:59.999Z`);
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { user: { select: { username: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return paginate(
      items.map((l) => ({
        id: l.id,
        time: l.createdAt,
        operator: l.user?.username ?? 'system',
        module: l.module,
        action: l.action,
        detail: l.detail,
      })),
      total,
      q.page,
      q.pageSize,
    );
  }
}
