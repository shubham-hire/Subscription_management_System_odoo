import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(1, { message: 'name is required' })
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email must be a valid email' })
  email!: string;

  @IsString()
  @MinLength(9, { message: 'password must be at least 9 characters' })
  password!: string;

  /** AUTH-08: only the admin creates staff — role defaults to staff. */
  @IsOptional()
  @IsIn(['staff', 'admin'], { message: 'role must be staff or admin' })
  role?: 'staff' | 'admin';
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'name cannot be empty' })
  name?: string;

  /** AUTH-11: deactivate without deleting history. */
  @IsOptional()
  @Type(() => Boolean)
  is_active?: boolean;
}

export class UserListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page_size?: number;
  @IsOptional() @IsString() search?: string;
}

export function paginated<T>(items: T[], total: number, page = 1, pageSize = 20) {
  return { items, total, page, page_size: pageSize };
}
