import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeBeacon } from './fingerprint.util';

@Injectable()
export class FingerprintService {
  private readonly logger = new Logger(FingerprintService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ghi 1 lượt beacon. Trùng hash → chỉ tăng hits và cập nhật last*, nên mỗi fingerprint là duy nhất.
   * Dùng INSERT … ON CONFLICT (nguyên tử) thay vì upsert của Prisma để không bị đua khi nhiều
   * request cùng thiết bị tới đồng thời. KHÔNG bao giờ ném lỗi ra ngoài.
   * @returns 'new' | 'repeat' | 'ignored'
   */
  async record(
    query: Record<string, unknown>,
    userAgent: string | undefined,
  ): Promise<'new' | 'repeat' | 'ignored'> {
    const fp = normalizeBeacon(query, userAgent);
    if (!fp) return 'ignored';
    try {
      const rows = await this.prisma.$queryRaw<Array<{ inserted: boolean }>>`
        INSERT INTO "Fingerprint"
          ("id", "hash", "attrs", "userAgent", "hits", "firstLink", "lastLink", "lastSample", "firstSeen", "lastSeen")
        VALUES
          (${randomUUID()}, ${fp.hash}, ${JSON.stringify(fp.attrs)}::jsonb, ${fp.userAgent}, 1,
           ${fp.linkCode}, ${fp.linkCode}, ${JSON.stringify(fp.sample)}::jsonb, now(), now())
        ON CONFLICT ("hash") DO UPDATE SET
          "hits"       = "Fingerprint"."hits" + 1,
          "lastLink"   = EXCLUDED."lastLink",
          "lastSample" = EXCLUDED."lastSample",
          "lastSeen"   = now()
        RETURNING (xmax = 0) AS "inserted"`;
      return rows[0]?.inserted ? 'new' : 'repeat';
    } catch (e) {
      this.logger.warn(`fingerprint write failed: ${(e as Error).message}`);
      return 'ignored';
    }
  }
}
