import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { IsMoneyString } from '../common/validation';

export const PAYMENT_METHODS = ['cash', 'card', 'upi', 'bank_transfer', 'cheque'] as const;

export class PaymentDto {
  @IsIn(PAYMENT_METHODS, { message: 'method must be cash, card, upi, bank_transfer or cheque' })
  method!: (typeof PAYMENT_METHODS)[number];

  @Transform(({ value }) => String(value))
  @IsMoneyString('amount must be above zero')
  amount!: string;

  @IsDateString({}, { message: 'date must be an ISO date' })
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class InvoiceListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page_size?: number;
  @IsOptional()
  @IsIn(['draft', 'confirmed', 'paid', 'cancelled'])
  status?: 'draft' | 'confirmed' | 'paid' | 'cancelled';
  @IsOptional() @IsIn(['true', 'false']) overdue?: 'true' | 'false';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) customer_id?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) subscription_id?: number;
}

export function paginated<T>(items: T[], total: number, page = 1, pageSize = 20) {
  return { items, total, page, page_size: pageSize };
}
