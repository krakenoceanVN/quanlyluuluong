import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateAdDto {
  @IsString()
  @MinLength(1, { message: '名称不能为空' })
  @MaxLength(100)
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
  @IsString()
  @MinLength(1)
  @MaxLength(100)
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
