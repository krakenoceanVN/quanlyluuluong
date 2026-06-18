import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { DashboardQueryDto, TrafficQueryDto } from './dto/report.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('dashboard')
  dashboard(@Query() q: DashboardQueryDto) {
    return this.service.dashboard(q.date);
  }

  @Get('traffic')
  traffic(@Query() q: TrafficQueryDto) {
    return this.service.traffic(q);
  }
}
