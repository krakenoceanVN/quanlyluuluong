import { Module } from '@nestjs/common';
import { EngineController } from './engine.controller';
import { EngineService } from './engine.service';
import { EngineStatsService } from './engine-stats.service';
import { SyncWorker } from './sync.worker';

@Module({
  controllers: [EngineController],
  providers: [EngineService, EngineStatsService, SyncWorker],
  exports: [EngineService, EngineStatsService],
})
export class EngineModule {}
