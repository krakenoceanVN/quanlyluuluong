import { IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @MinLength(3, { message: '用户名至少 3 个字符' })
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_.-]+$/, { message: '用户名仅可包含字母、数字、_ . -' })
  username!: string;

  @IsString()
  @MinLength(6, { message: '密码至少 6 个字符' })
  @MaxLength(100)
  password!: string;

  @IsEnum(Role, { message: '角色无效' })
  role!: Role;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(Role, { message: '角色无效' })
  role?: Role;

  /** Optional: reset password */
  @IsOptional()
  @IsString()
  @MinLength(6, { message: '密码至少 6 个字符' })
  @MaxLength(100)
  password?: string;
}
