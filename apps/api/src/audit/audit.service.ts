import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  userId?: string | null;
  module: string;
  action: string;
  detail?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  /** Records a write operation. Never throws — audit failure must not break the request. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId ?? null,
          module: entry.module,
          action: entry.action,
          detail: entry.detail ?? Prisma.JsonNull,
        },
      });
    } catch (e) {
      this.logger.error(`failed to write audit log: ${(e as Error).message}`);
    }
  }
}
