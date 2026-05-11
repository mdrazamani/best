import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateMeshTypeDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
