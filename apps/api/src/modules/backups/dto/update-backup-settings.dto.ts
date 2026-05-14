import { IsNumber } from 'class-validator';

export class UpdateBackupSettingsDto {
  @IsNumber()
  backupIntervalMinutes!: number;
}
