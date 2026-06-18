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
import { AdsService } from './ads.service';
import { CreateAdDto, ToggleStatusDto, UpdateAdDto } from './dto/ad.dto';

@UseGuards(JwtAuthGuard)
@Controller('ads')
export class AdsController {
  constructor(private readonly service: AdsService) {}

  @Get()
  list(@Query() q: PaginationQueryDto) {
    return this.service.list(q.page, q.pageSize, q.keyword);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/links')
  links(@Param('id') id: string) {
    return this.service.linksContaining(id);
  }

  @Post()
  create(@Body() dto: CreateAdDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAdDto, @CurrentUser() user: AuthUser) {
    return this.service.update(id, dto, user.userId);
  }

  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: ToggleStatusDto, @CurrentUser() user: AuthUser) {
    return this.service.setStatus(id, dto.status, user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.service.remove(id, user.userId);
  }
}
