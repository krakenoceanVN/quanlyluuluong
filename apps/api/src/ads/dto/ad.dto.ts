import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { NAME_RULE, trimStr } from '../../common/validation';

export class CreateAdDto {
  @Transform(trimStr)
  @IsString()
  @MinLength(1, { message: '名称不能为空' })
  @MaxLength(100)
  @Matches(NAME_RULE, { message: '名称不能包含 < > 或控制字符' })
  name!: string;

  @IsUrl(
    { require_protocol: true, require_tld: false },
    { message: '投放链接需为合法 URL（含 http/https）' },
  )
  targetUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class UpdateAdDto {
  @IsOptional()
  @Transform(trimStr)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  @Matches(NAME_RULE, { message: '名称不能包含 < > 或控制字符' })
  name?: string;

  @IsOptional()
  @IsUrl(
    { require_protocol: true, require_tld: false },
    { message: '投放链接需为合法 URL（含 http/https）' },
  )
  targetUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class ToggleStatusDto {
  @IsBoolean()
  status!: boolean;
}
