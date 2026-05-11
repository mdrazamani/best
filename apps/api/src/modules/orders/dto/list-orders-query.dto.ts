import { IsOptional, IsString } from 'class-validator';

export class ListOrdersQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsString()
  workType?: string;

  @IsOptional()
  @IsString()
  meshTypeId?: string;

  @IsOptional()
  @IsString()
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
