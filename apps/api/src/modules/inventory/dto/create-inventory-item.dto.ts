import { Type } from 'class-transformer';
import { IsInt, IsString, Min } from 'class-validator';

export class CreateInventoryItemDto {
  @IsString()
  name!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;
}
