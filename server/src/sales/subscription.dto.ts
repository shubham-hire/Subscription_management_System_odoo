import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SubscriptionLineDto {
  @Type(() => Number)
  @IsInt()
  product_id!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  variant_id?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'quantity must be a positive integer' })
  quantity!: number;

  /** Optional per-line tax override; defaults to the product's tax. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tax_id?: number;
}

export class CreateSubscriptionDto {
  @Type(() => Number)
  @IsInt()
  customer_id!: number;

  @Type(() => Number)
  @IsInt()
  plan_id!: number;

  @IsDateString({}, { message: 'start_date must be an ISO date' })
  start_date!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  payment_terms_days?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubscriptionLineDto)
  lines!: SubscriptionLineDto[];
}

export class UpdateLinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubscriptionLineDto)
  lines!: SubscriptionLineDto[];
}

export class ListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page_size?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) customer_id?: number;
}

export function paginated<T>(items: T[], total: number, page = 1, pageSize = 20) {
  return { items, total, page, page_size: pageSize };
}
