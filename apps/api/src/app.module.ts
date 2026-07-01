import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { FlowModule } from './flow/flow.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TrackersModule } from './trackers/trackers.module';
import { AdsModule } from './ads/ads.module';
import { LinksModule } from './links/links.module';
import { ReportsModule } from './reports/reports.module';
import { EngineModule } from './engine/engine.module';

@Module({
  imports: [
    // Load .env from the api folder first, then fall back to the repo-root .env,
    // so the app works whether started from apps/api or the monorepo root.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    // Rate limit mặc định: 200 request / 60s / IP (chống flood #52). Auth & engine có mức riêng.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),
    PrismaModule,
    RedisModule,
    FlowModule,
    AuditModule,
    AuthModule,
    UsersModule,
    TrackersModule,
    AdsModule,
    LinksModule,
    ReportsModule,
    EngineModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
