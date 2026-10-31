import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { IsMoneyString } from '../common/validation';

export class VariantDto {
  @IsString()
  @MinLength(1, { message: 'attribute is required' })
  attribute!: string;

  @IsString()
  @MinLength(1, { message: 'value is required' })
  value!: string;

  @Transform(({ value }) => String(value))
  @IsMoneyString('price_extra must be a decimal amount, zero or more')
  price_extra!: string;
}

export class ProductDto {
  @IsString()
  @MinLength(1, { message: 'name is required' })
  name!: string;

  @IsString()
  @MinLength(1, { message: 'type is required' })
  type!: string;

  @Transform(({ value }) => String(value))
  @IsMoneyString('sales_price must be a decimal amount, zero or more')
  sales_price!: string;

  @Transform(({ value }) => String(value))
  @IsMoneyString('cost_price must be a decimal amount, zero or more')
  cost_price!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tax_id?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants?: VariantDto[];
}

export class VariantCreateDto {
  @Type(() => Number)
  @IsInt()
  product_id!: number;

  @ValidateNested()
  @Type(() => VariantDto)
  variant!: VariantDto;
}

export class PlanDto {
  @IsString()
  @MinLength(1, { message: 'name is required' })
  name!: string;

  @Transform(({ value }) => String(value))
  @IsMoneyString('price must be a decimal amount, zero or more')
  price!: string;

  @IsIn(['daily', 'weekly', 'monthly', 'yearly'], { message: 'billing_period must be daily, weekly, monthly or yearly' })
  billing_period!: 'daily' | 'weekly' | 'monthly' | 'yearly';

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'min_quantity must be at least 1' })
  min_quantity!: number;

  @Type(() => Date)
  @IsDate()
  available_from!: Date;

  @Type(() => Date)
  @IsDate()
  available_to!: Date;

  @IsOptional() @IsBoolean() auto_close?: boolean;
  @IsOptional() @IsBoolean() closable?: boolean;
  @IsOptional() @IsBoolean() pausable?: boolean;
  @IsOptional() @IsBoolean() renewable?: boolean;
}

export class TaxDto {
  @IsString()
  @MinLength(1, { message: 'name is required' })
  name!: string;

  @Type(() => Number)
  @Min(0, { message: 'percentage must be between 0 and 100' })
  percentage!: number; // upper bound enforced in service (needs strict 0..100 message)

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class DiscountDto {
  @IsString()
  @MinLength(1, { message: 'name is required' })
  name!: string;

  @IsIn(['fixed', 'percentage'], { message: 'type must be fixed or percentage' })
  type!: 'fixed' | 'percentage';

  @Transform(({ value }) => String(value))
  @IsMoneyString('value must be a decimal amount')
  value!: string;

  @IsOptional()
  @Transform(({ value }) => String(value))
  @IsMoneyString('min_purchase must be a decimal amount, zero or more')
  min_purchase?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_quantity?: number;

  @Type(() => Date)
  @IsDate()
  start_date!: Date;

  @Type(() => Date)
  @IsDate()
  end_date!: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_uses?: number;

  @IsIn(['product', 'subscription'], { message: 'scope must be product or subscription' })
  scope!: 'product' | 'subscription';

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  product_ids?: number[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class ListQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page_size?: number;
  @IsOptional() @IsString() search?: string;
}

export function paginated<T>(items: T[], total: number, page = 1, pageSize = 20) {
  return { items, total, page, page_size: pageSize };
}
