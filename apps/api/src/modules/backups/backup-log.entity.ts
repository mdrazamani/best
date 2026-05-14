export type BackupLogEntity = {
  id: string;
  backupDir: string;
  sqlFilePath: string;
  excelDirectory: string;
  status: string;
  createdAt: Date;
};
