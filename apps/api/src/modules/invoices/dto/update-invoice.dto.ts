import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateInvoiceDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsIn(['UNPAID', 'PARTIAL', 'PAID'])
  status?: 'UNPAID' | 'PARTIAL' | 'PAID';

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsIn(['COLLABORATOR'])
  payerType?: 'COLLABORATOR';

  @IsOptional()
  @IsString()
  payerId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
