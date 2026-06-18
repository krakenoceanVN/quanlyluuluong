import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { FlowModule } from './flow/flow.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
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
    PrismaModule,
    RedisModule,
    FlowModule,
    AuditModule,
    AuthModule,
    TrackersModule,
    AdsModule,
    LinksModule,
    ReportsModule,
    EngineModule,
  ],
})
export class AppModule {}
