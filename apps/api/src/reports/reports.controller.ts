import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EngineStatsService } from '../engine/engine-stats.service';
import { ReportsService } from './reports.service';
import { DashboardQueryDto, TrafficQueryDto } from './dto/report.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class ReportsController {
  constructor(
    private readonly service: ReportsService,
    private readonly engineStats: EngineStatsService,
  ) {}

  @Get('dashboard')
  dashboard(@Query() q: DashboardQueryDto) {
    return this.service.dashboard(q.date);
  }

  @Get('traffic')
  traffic(@Query() q: TrafficQueryDto) {
    return this.service.traffic(q);
  }

  /**
   * Bảng "traffic rơi ở đâu" theo từng link cho 1 ngày (mặc định hôm nay, giờ nghiệp vụ):
   * redirect (phục vụ được) vs fallback / notfound / throttled (không phục vụ được).
   */
  @Get('engine-stats')
  engineStatsReport(@Query() q: DashboardQueryDto) {
    return this.engineStats.read(q.date);
  }
}
