import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize = 10;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '搜索关键词过长' })
  keyword?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export function paginate<T>(items: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { items, total, page, pageSize };
}
