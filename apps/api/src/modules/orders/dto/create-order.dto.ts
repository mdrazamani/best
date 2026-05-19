import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDefined, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class OrderLineItemDto {
  @IsString({ message: 'شناسه نوع توری معتبر نیست.' })
  meshTypeId!: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'عرض باید عدد باشد.' })
  width!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'ارتفاع باید عدد باشد.' })
  height!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'تعداد باید عدد باشد.' })
  quantity!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'قیمت واحد باید عدد باشد.' })
  unitPrice!: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString({ message: 'شناسه همکار معتبر نیست.' })
  collaboratorId?: string | null;

  @IsOptional()
  @IsString({ message: 'شناسه مشتری معتبر نیست.' })
  customerId?: string | null;

  @IsDefined({ message: 'نوع کار الزامی است.' })
  @IsIn(['NEW_CONSTRUCTION', 'REPAIR'], { message: 'نوع کار نامعتبر است.' })
  workType!: 'NEW_CONSTRUCTION' | 'REPAIR';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'عرض باید عدد باشد.' })
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'ارتفاع باید عدد باشد.' })
  height?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'تعداد باید عدد باشد.' })
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'قیمت واحد باید عدد باشد.' })
  unitPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'مبلغ کل باید عدد باشد.' })
  totalPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'تخفیف باید عدد باشد.' })
  @Min(0, { message: 'تخفیف نمی‌تواند منفی باشد.' })
  discountAmount?: number;

  @IsOptional()
  @IsArray({ message: 'ردیف‌های سفارش باید آرایه باشند.' })
  @ValidateNested({ each: true })
  @Type(() => OrderLineItemDto)
  lineItems?: OrderLineItemDto[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['RECEIVED', 'IN_PROGRESS', 'READY_IN_WAREHOUSE', 'DELIVERED', 'CANCELLED'], {
    message: 'مرحله سفارش نامعتبر است.'
  })
  stage?: 'RECEIVED' | 'IN_PROGRESS' | 'READY_IN_WAREHOUSE' | 'DELIVERED' | 'CANCELLED';

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
