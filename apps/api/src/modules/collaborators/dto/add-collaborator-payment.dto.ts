import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AddCollaboratorPaymentDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ پرداخت باید عدد باشد.' })
  @Min(0.01, { message: 'مبلغ پرداخت باید بیشتر از صفر باشد.' })
  amount!: number;

  @IsOptional()
  @IsString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
