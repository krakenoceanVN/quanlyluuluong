import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTrackerDto {
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
  code?: string;
}

export class UpdateTrackerDto {
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
  code?: string;
}
