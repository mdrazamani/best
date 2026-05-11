import { Type } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsNumber } from 'class-validator';

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
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['RECEIVED', 'STARTED', 'IN_PROGRESS', 'READY_IN_WAREHOUSE', 'DELIVERED', 'CANCELLED'])
  stage?: 'RECEIVED' | 'STARTED' | 'IN_PROGRESS' | 'READY_IN_WAREHOUSE' | 'DELIVERED' | 'CANCELLED';

  @IsOptional()
  @IsString()
  stageNote?: string;
}
