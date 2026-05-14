import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class OrderLineItemDto {
  @IsString()
  meshTypeId!: string;

  @Type(() => Number)
  @IsNumber()
  width!: number;

  @Type(() => Number)
  @IsNumber()
  height!: number;

  @Type(() => Number)
  @IsNumber()
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  unitPrice!: number;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  collaboratorId?: string;

  @IsString()
  customerId!: string;

  @IsIn(['NEW_CONSTRUCTION', 'REPAIR'])
  workType!: 'NEW_CONSTRUCTION' | 'REPAIR';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  extraAmount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineItemDto)
  lineItems?: OrderLineItemDto[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['RECEIVED', 'STARTED', 'IN_PROGRESS', 'READY_IN_WAREHOUSE', 'DELIVERED', 'CANCELLED'])
  stage?: 'RECEIVED' | 'STARTED' | 'IN_PROGRESS' | 'READY_IN_WAREHOUSE' | 'DELIVERED' | 'CANCELLED';

  @IsOptional()
  @IsString()
  stageNote?: string;

  @IsOptional()
  @IsString()
  expectedCompletionDate?: string;

  @IsOptional()
  @IsBoolean()
  createInitialInvoice?: boolean;
}
