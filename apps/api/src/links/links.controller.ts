import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { LinksService } from './links.service';
import {
  CreateLinkDto,
  ReplaceLinkAdsDto,
  ToggleStatusDto,
  UpdateLinkAdDto,
  UpdateLinkDto,
} from './dto/link.dto';

@UseGuards(JwtAuthGuard)
@Controller('links')
export class LinksController {
  constructor(private readonly service: LinksService) {}

  @Get()
  list(@Query() q: PaginationQueryDto) {
    return this.service.list(q.page, q.pageSize, q.keyword);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateLinkDto, @CurrentUser() user: AuthUser) {
    return this.service.create(dto, user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLinkDto, @CurrentUser() user: AuthUser) {
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

  // ── membership (link ↔ ad) ──
  @Get(':id/ads')
  getAds(@Param('id') id: string) {
    return this.service.getAds(id);
  }

  @Put(':id/ads')
  replaceAds(
    @Param('id') id: string,
    @Body() dto: ReplaceLinkAdsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.replaceAds(id, dto, user.userId);
  }

  @Patch(':id/ads/:adId')
  updateAd(
    @Param('id') id: string,
    @Param('adId') adId: string,
    @Body() dto: UpdateLinkAdDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.service.updateAd(id, adId, dto, user.userId);
  }
}
