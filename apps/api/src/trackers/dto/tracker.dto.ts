import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { NAME_RULE, trimStr } from '../../common/validation';

export class CreateTrackerDto {
  @Transform(trimStr)
  @IsString()
  @MinLength(1, { message: '名称不能为空' })
  @MaxLength(100)
  @Matches(NAME_RULE, { message: '名称不能包含 < > 或控制字符' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  // #29: giới hạn độ dài mã thống kê
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: '统计代码过长（上限 5000 字符）' })
  code?: string;
}

export class UpdateTrackerDto {
  @IsOptional()
  @Transform(trimStr)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(NAME_RULE, { message: '名称不能包含 < > 或控制字符' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: '统计代码过长（上限 5000 字符）' })
  code?: string;
}
