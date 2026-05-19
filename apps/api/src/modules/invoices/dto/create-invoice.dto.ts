import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsDefined, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsDefined({ message: 'حداقل یک سفارش باید انتخاب شود.' })
  @IsArray({ message: 'لیست سفارش‌ها نامعتبر است.' })
  @ArrayNotEmpty({ message: 'حداقل یک سفارش باید انتخاب شود.' })
  @IsString({ each: true, message: 'شناسه سفارش معتبر نیست.' })
  orderIds!: string[];

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
  @IsNumber({}, { message: 'پرداخت اولیه باید عدد باشد.' })
  @Min(0, { message: 'پرداخت اولیه نمی‌تواند منفی باشد.' })
  initialPaidAmount?: number;

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
