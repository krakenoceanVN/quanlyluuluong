import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BusinessConflictException } from '../common/app.exceptions';
import { paginate, Paginated } from '../common/dto/pagination.dto';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(page: number, pageSize: number, keyword?: string): Promise<Paginated<unknown>> {
    const where: Prisma.UserWhereInput = {};
    if (keyword) where.username = { contains: keyword, mode: 'insensitive' };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: { id: true, username: true, role: true, createdAt: true },
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(rows, total, page, pageSize);
  }

  async create(dto: CreateUserDto, actorId: string) {
    const username = dto.username.trim();
    const exists = await this.prisma.user.findUnique({ where: { username } });
    if (exists) throw new BusinessConflictException('用户名已存在，请更换');
    const user = await this.prisma.user.create({
      data: { username, passwordHash: await bcrypt.hash(dto.password, 10), role: dto.role },
      select: { id: true, username: true, role: true, createdAt: true },
    });
    await this.audit.log({
      userId: actorId,
      module: '用户管理',
      action: 'create',
      detail: { id: user.id, username: user.username, role: user.role },
    });
    return user;
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const before = await this.prisma.user.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('用户不存在');
    const data: Prisma.UserUpdateInput = {};
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);
    const after = await this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, role: true, createdAt: true },
    });
    await this.audit.log({
      userId: actorId,
      module: '用户管理',
      action: 'update',
      detail: {
        id,
        username: before.username,
        ...(dto.role !== undefined ? { roleBefore: before.role, roleAfter: dto.role } : {}),
        ...(dto.password ? { passwordReset: true } : {}),
      },
    });
    return after;
  }

  async remove(id: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    if (id === actorId) throw new BusinessConflictException('不能删除当前登录的用户');
    if (user.role === 'ADMIN') {
      const admins = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (admins <= 1) throw new BusinessConflictException('必须保留至少一名管理员');
    }
    // keep audit logs but detach the user reference to satisfy FK
    await this.prisma.$transaction([
      this.prisma.auditLog.updateMany({ where: { userId: id }, data: { userId: null } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    await this.audit.log({
      userId: actorId,
      module: '用户管理',
      action: 'delete',
      detail: { id, username: user.username },
    });
    return { id };
  }
}
