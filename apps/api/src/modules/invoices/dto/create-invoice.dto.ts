import { Type } from 'class-transformer';
import { IsDefined, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsDefined({ message: 'انتخاب سفارش الزامی است.' })
  @IsString({ message: 'شناسه سفارش معتبر نیست.' })
  @IsNotEmpty({ message: 'انتخاب سفارش الزامی است.' })
  orderId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ فاکتور باید عدد باشد.' })
  amount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'تخفیف باید عدد باشد.' })
  @Min(0, { message: 'تخفیف نمی‌تواند منفی باشد.' })
  discountAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ افزوده باید عدد باشد.' })
  @Min(0, { message: 'مبلغ افزوده نمی‌تواند منفی باشد.' })
  extraAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ پرداختی باید عدد باشد.' })
  paidAmount?: number;

  @IsOptional()
  @IsIn(['UNPAID', 'PARTIAL', 'PAID'], { message: 'وضعیت فاکتور نامعتبر است.' })
  status?: 'UNPAID' | 'PARTIAL' | 'PAID';

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsIn(['CUSTOMER', 'COLLABORATOR'], { message: 'نوع پرداخت‌کننده نامعتبر است.' })
  payerType?: 'CUSTOMER' | 'COLLABORATOR';

  @IsOptional()
  @IsString()
  payerId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
