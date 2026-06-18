import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { TrackersService } from './trackers.service';
import { CreateTrackerDto, UpdateTrackerDto } from './dto/tracker.dto';

@UseGuards(JwtAuthGuard)
@Controller('trackers')
export class TrackersController {
  constructor(private readonly service: TrackersService) {}

  @Get()
  list(@Query() q: PaginationQueryDto) {
    return this.service.list(q.page, q.pageSize, q.keyword);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTrackerDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTrackerDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user.userId);
  }
}
