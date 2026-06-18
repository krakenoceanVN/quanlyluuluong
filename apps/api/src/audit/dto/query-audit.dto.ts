import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class QueryAuditDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  /** ISO date (yyyy-mm-dd) inclusive lower bound */
  @IsOptional()
  @IsString()
  from?: string;

  /** ISO date (yyyy-mm-dd) inclusive upper bound */
  @IsOptional()
  @IsString()
  to?: string;
}
