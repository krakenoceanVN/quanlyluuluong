import { IsOptional, IsString, MaxLength } from 'class-validator';
import { IsYmd } from '../../common/validation';

export class DashboardQueryDto {
  @IsOptional()
  @IsYmd()
  date?: string;
}

export class TrafficQueryDto {
  @IsOptional()
  @IsYmd()
  from?: string;

  @IsOptional()
  @IsYmd()
  to?: string;

  @IsOptional()
  @IsString()
  linkId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '广告关键词过长' })
  adKeyword?: string;
}
