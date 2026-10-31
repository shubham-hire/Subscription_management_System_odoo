import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Emails are normalized before validation: trimmed and lowercased (§9.3). */
export class EmailDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email must be a valid email' })
  email!: string;
}

export class SignupDto extends EmailDto {
  @IsString()
  @IsNotEmpty({ message: 'name is required' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  @MaxLength(200)
  password!: string;
}

export class LoginDto extends EmailDto {
  @IsString()
  @IsNotEmpty({ message: 'password is required' })
  @MaxLength(200)
  password!: string;
}

/** AUTH-03: ≥9 chars, uppercase, lowercase, special — returns the first failed rule. */
export function passwordRule(value: string): string | null {
  if (value.length < 9) return 'Password must be at least 9 characters';
  if (!/[A-Z]/.test(value)) return 'Password must contain an uppercase letter';
  if (!/[a-z]/.test(value)) return 'Password must contain a lowercase letter';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Password must contain a special character';
  return null;
}
