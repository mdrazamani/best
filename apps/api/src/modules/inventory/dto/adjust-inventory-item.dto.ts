import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AdjustInventoryItemDto {
  @IsIn(['INCREASE', 'DECREASE'])
  type!: 'INCREASE' | 'DECREASE';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
