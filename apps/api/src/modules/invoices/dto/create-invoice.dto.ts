import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  orderId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  paidAmount?: number;

  @IsOptional()
  @IsIn(['UNPAID', 'PARTIAL', 'PAID'])
  status?: 'UNPAID' | 'PARTIAL' | 'PAID';

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
