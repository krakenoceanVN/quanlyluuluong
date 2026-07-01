import { Module } from '@nestjs/common';
import { EngineModule } from '../engine/engine.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [EngineModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
