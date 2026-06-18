import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/** Custom URL suffix: lowercase letters, digits and hyphens, length 3-40. */
export const SHORT_CODE_RULE = /^[a-z0-9-]{3,40}$/;

export class CreateLinkDto {
  @IsString()
  @MinLength(1, { message: '名称不能为空' })
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  /** Optional custom URL suffix; auto-generated when omitted. */
  @IsOptional()
  @IsString()
  @Matches(SHORT_CODE_RULE, {
    message: '链接后缀仅可包含小写字母、数字、连字符，长度 3-40',
  })
  shortCode?: string;

  /** Trackers to bind on creation (optional, multi-select). */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  trackerIds?: string[];
}

export class UpdateLinkDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  trackerIds?: string[];
}

export class ToggleStatusDto {
  @IsBoolean()
  status!: boolean;
}

/** Replace the whole ad membership set of a link (transfer popup 提交). */
export class ReplaceLinkAdsDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  adIds!: string[];
}

/** Patch a single membership's config (weight/limit/note/status). */
export class UpdateLinkAdDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  weight?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dailyLimit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;

  @IsOptional()
  @IsBoolean()
  status?: boolean;
}
