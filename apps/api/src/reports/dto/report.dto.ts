import { IsOptional, IsString } from 'class-validator';

export class DashboardQueryDto {
  /** yyyy-mm-dd; defaults to today */
  @IsOptional()
  @IsString()
  date?: string;
}

export class TrafficQueryDto {
  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;

  @IsOptional()
  @IsString()
  linkId?: string;

  @IsOptional()
  @IsString()
  adKeyword?: string;
}
