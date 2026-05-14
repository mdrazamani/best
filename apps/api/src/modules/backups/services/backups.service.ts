import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { createWriteStream, existsSync } from 'fs';
import { mkdir, readdir, readFile } from 'fs/promises';
import { join } from 'path';
import cron, { type ScheduledTask } from 'node-cron';
import * as XLSX from 'xlsx';
import { BaseService } from '../../../common/services/base.service';
import { BackupsRepository } from '../backups.repository';

@Injectable()
export class BackupsService extends BaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupsService.name);
  private nightlyTask: ScheduledTask | null = null;
  private archiverFactory: ((format: string, options?: any) => any) | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly backupsRepository: BackupsRepository
  ) {
    super();
  }

  async onModuleInit() {
    await this.ensureDefaultSettings();
    await this.setupScheduler();
  }

  onModuleDestroy() {
    this.nightlyTask?.stop();
    this.nightlyTask = null;
  }

  async listLogs() {
    const logs = await this.backupsRepository.listLogs();
    return Promise.all(
      logs.map(async (log) => ({
        ...log,
        excelFiles: existsSync(log.excelDirectory) ? await readdir(log.excelDirectory) : []
      }))
    );
  }

  async getSettings() {
    const setting = await this.backupsRepository.getIntervalSetting();
    return {
      backupIntervalMinutes: Number(setting?.value ?? '1440'),
      cron: this.configService.get<string>('BACKUP_CRON') ?? '0 0 * * *',
      timezone: this.configService.get<string>('BACKUP_TIMEZONE') ?? 'Asia/Tehran'
    };
  }

  async updateSettings(minutes: number) {
    const safeValue = String(Math.max(15, Math.floor(minutes || 1440)));
    await this.backupsRepository.upsertIntervalSetting(safeValue);
    await this.setupScheduler();
    return this.getSettings();
  }

  async runBackup() {
    const rootDir = this.configService.get<string>('BACKUP_DIRECTORY') ?? join(process.cwd(), 'backups');
    const tehranNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
    const timestamp = tehranNow.toISOString().replace(/[:.]/g, '-');
    const backupDir = join(rootDir, timestamp);
    const excelDir = join(backupDir, 'excel');
    const sqlPath = join(backupDir, 'database.sql');
    const excelPath = join(excelDir, 'database-tables.xlsx');
    const zipPath = join(backupDir, `backup-${timestamp}.zip`);

    await mkdir(excelDir, { recursive: true });

    try {
      await this.exportSql(sqlPath);
      await this.exportWorkbook(excelPath);
      await this.createArchive(zipPath, sqlPath, excelPath);

      const log = await this.backupsRepository.createLog({
        backupDir,
        sqlFilePath: sqlPath,
        excelDirectory: excelDir,
        status: 'SUCCESS',
        message: 'Nightly backup created'
      });

      return {
        success: true,
        backupId: log.id,
        sqlFilePath: log.sqlFilePath,
        excelDirectory: log.excelDirectory,
        archiveFilePath: zipPath
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.backupsRepository.createLog({
        backupDir,
        sqlFilePath: sqlPath,
        excelDirectory: excelDir,
        status: 'FAILED',
        message
      });
      throw error;
    }
  }

  async readArchive(logId: string) {
    const log = await this.backupsRepository.findLogById(logId);
    if (!log) {
      throw new NotFoundException('بکاپ پیدا نشد.');
    }

    const zipPath = await this.resolveArchivePath(log.backupDir);

    if (!existsSync(zipPath)) {
      const excelFiles = existsSync(log.excelDirectory) ? await readdir(log.excelDirectory) : [];
      const excelPath = excelFiles.find((file) => file.toLowerCase().endsWith('.xlsx'));
      if (!excelPath || !existsSync(log.sqlFilePath)) {
        throw new NotFoundException('آرشیو بکاپ قابل دریافت نیست.');
      }
      await this.createArchive(zipPath, log.sqlFilePath, join(log.excelDirectory, excelPath));
    }

    return {
      fileName: `backup-${log.id}.zip`,
      contentType: 'application/zip',
      buffer: await readFile(zipPath)
    };
  }

  async readSql(logId: string) {
    const log = await this.backupsRepository.findLogById(logId);
    if (!log || !existsSync(log.sqlFilePath)) {
      throw new NotFoundException('فایل SQL پیدا نشد.');
    }

    return {
      fileName: 'database.sql',
      contentType: 'application/sql',
      buffer: await readFile(log.sqlFilePath)
    };
  }

  async readExcel(logId: string, fileName: string) {
    const log = await this.backupsRepository.findLogById(logId);
    if (!log) {
      throw new NotFoundException('بکاپ پیدا نشد.');
    }

    const fullPath = join(log.excelDirectory, fileName);
    if (!existsSync(fullPath)) {
      throw new NotFoundException('فایل اکسل پیدا نشد.');
    }

    return {
      fileName,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: await readFile(fullPath)
    };
  }

  private async setupScheduler() {
    this.nightlyTask?.stop();
    this.nightlyTask = null;

    const setting = await this.backupsRepository.getIntervalSetting();
    const intervalMinutes = Number(setting?.value ?? '1440');
    const computedCron =
      intervalMinutes >= 1440
        ? '0 0 * * *'
        : intervalMinutes >= 60
        ? `0 */${Math.min(23, Math.max(1, Math.floor(intervalMinutes / 60)))} * * *`
        : `*/${Math.max(1, Math.min(59, intervalMinutes))} * * * *`;

    const cronExpr = this.configService.get<string>('BACKUP_CRON') ?? computedCron;
    const timezone = this.configService.get<string>('BACKUP_TIMEZONE') ?? 'Asia/Tehran';

    if (!cron.validate(cronExpr)) {
      throw new Error(`Invalid BACKUP_CRON expression: ${cronExpr}`);
    }

    this.nightlyTask = cron.schedule(
      cronExpr,
      () => {
        this.runBackup().catch((error) => this.logger.error(`Nightly backup failed: ${String(error)}`));
      },
      { timezone }
    );

    this.logger.log(`Backup scheduler started: cron="${cronExpr}" timezone="${timezone}"`);
  }

  private async ensureDefaultSettings() {
    const settings = await this.backupsRepository.getIntervalSetting();
    if (!settings) {
      const defaultValue = this.configService.get<string>('BACKUP_INTERVAL_MINUTES') ?? '1440';
      await this.backupsRepository.upsertIntervalSetting(defaultValue);
    }
  }

  private async exportSql(sqlPath: string) {
    const dbUrl = this.configService.get<string>('DATABASE_URL');
    if (!dbUrl) {
      throw new Error('DATABASE_URL is not configured');
    }

    await new Promise<void>((resolve, reject) => {
      const child = execFile(
        'pg_dump',
        [
          '--dbname',
          dbUrl,
          '--format=p',
          '--encoding=UTF8',
          '--no-owner',
          '--no-privileges',
          '--clean',
          '--if-exists',
          '--file',
          sqlPath
        ],
        {
          env: {
            ...process.env,
            PGCLIENTENCODING: 'UTF8'
          }
        }
      );

      let stderr = '';
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk);
      });
      child.on('error', (error) => reject(error));
      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(stderr || `pg_dump failed with code ${code}`));
      });
    });
  }

  private async exportWorkbook(excelPath: string) {
    const tables = await this.backupsRepository.listPublicTables();
    const workbook = XLSX.utils.book_new();
    const usedSheetNames = new Set<string>();

    for (const tableName of tables) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
        this.logger.warn(`Skipped table with unsupported name: ${tableName}`);
        continue;
      }

      const rows = await this.backupsRepository.readRowsByTable(tableName);
      const normalizedRows = rows.map((row) => this.normalizeRow(row));
      const sheet = normalizedRows.length ? XLSX.utils.json_to_sheet(normalizedRows) : XLSX.utils.aoa_to_sheet([[]]);
      const sheetName = this.uniqueSheetName(this.sanitizeSheetName(tableName), usedSheetNames);

      XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
      usedSheetNames.add(sheetName);
    }

    XLSX.writeFile(workbook, excelPath, { compression: true });
  }

  private async createArchive(zipPath: string, sqlPath: string, excelPath: string) {
    const archiver = await this.getArchiverFactory();

    return new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      output.on('error', (error: Error) => reject(error));
      archive.on('error', (error: Error) => reject(error));

      archive.pipe(output);
      archive.file(sqlPath, { name: 'database.sql' });
      archive.file(excelPath, { name: 'database-tables.xlsx' });
      void archive.finalize();
    });
  }

  private async getArchiverFactory() {
    if (this.archiverFactory) {
      return this.archiverFactory;
    }

    const module = await import('archiver');
    const candidate = (module as any).default ?? module;
    this.archiverFactory = candidate;
    return candidate;
  }

  private async resolveArchivePath(backupDir: string) {
    const files = await readdir(backupDir);
    const zip = files.find((file) => file.toLowerCase().endsWith('.zip'));
    return join(backupDir, zip ?? 'backup.zip');
  }

  private normalizeRow(row: Record<string, unknown>) {
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, this.normalizeValue(value)]));
  }

  private normalizeValue(value: unknown): unknown {
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Date) return value.toISOString();
    if (Buffer.isBuffer(value)) return value.toString('base64');
    if (Array.isArray(value)) return JSON.stringify(value);
    if (value && typeof value === 'object') return JSON.stringify(value);
    return value;
  }

  private sanitizeSheetName(value: string) {
    const sanitized = value.replace(/[\\/?*\[\]:]/g, '_').trim();
    return sanitized.slice(0, 31) || 'Sheet';
  }

  private uniqueSheetName(baseName: string, used: Set<string>) {
    if (!used.has(baseName)) return baseName;

    let counter = 1;
    while (counter < 1000) {
      const suffix = `_${counter}`;
      const candidate = `${baseName.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
      if (!used.has(candidate)) return candidate;
      counter += 1;
    }

    return `${baseName.slice(0, 27)}_999`;
  }
}
