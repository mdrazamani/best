import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class OrderLineItemDto {
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

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  collaboratorId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsIn(['NEW_CONSTRUCTION', 'REPAIR'])
  workType?: 'NEW_CONSTRUCTION' | 'REPAIR';

  @IsOptional()
  @IsString()
  meshTypeId?: string;

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
}
