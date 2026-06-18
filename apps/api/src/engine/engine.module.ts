import { Module } from '@nestjs/common';
import { EngineController } from './engine.controller';
import { EngineService } from './engine.service';
import { SyncWorker } from './sync.worker';

@Module({
  controllers: [EngineController],
  providers: [EngineService, SyncWorker],
  exports: [EngineService],
})
export class EngineModule {}
