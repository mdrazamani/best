import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { createWriteStream, existsSync } from 'fs';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
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
  private runningBackupPromise:
    | Promise<{ success: boolean; backupId: string; sqlFilePath: string; excelDirectory: string; archiveFilePath: string }>
    | null = null;

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
    if (this.runningBackupPromise) {
      this.logger.warn('Backup requested while another backup is already running. Returning in-flight result.');
      return this.runningBackupPromise;
    }

    this.runningBackupPromise = this.runBackupInternal().finally(() => {
      this.runningBackupPromise = null;
    });

    return this.runningBackupPromise;
  }

  private async runBackupInternal() {
    const rootDir = this.configService.get<string>('BACKUP_DIRECTORY') ?? join(process.cwd(), 'backups');
    const timestamp = this.buildBackupTimestamp(this.configService.get<string>('BACKUP_TIMEZONE') ?? 'Asia/Tehran');
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
    this.assertSafeExcelFileName(fileName);
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
    try {
      await this.exportSqlWithPgDump(sqlPath);
      return;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`pg_dump unavailable/failed; using fallback SQL export. reason="${reason}"`);
    }

    await this.exportSqlFallback(sqlPath);
  }

  private async exportSqlWithPgDump(sqlPath: string) {
    const dbUrl = this.configService.get<string>('DATABASE_URL');
    if (!dbUrl) {
      throw new Error('DATABASE_URL is not configured');
    }
    const pgDumpBinary = this.configService.get<string>('PG_DUMP_PATH')?.trim() || 'pg_dump';

    await new Promise<void>((resolve, reject) => {
      const child = execFile(
        pgDumpBinary,
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

  private async exportSqlFallback(sqlPath: string) {
    const tables = await this.backupsRepository.listPublicTables();
    const lines: string[] = [];

    lines.push('-- BEST SQL backup (fallback mode without pg_dump)');
    lines.push(`-- created_at: ${new Date().toISOString()}`);
    lines.push('-- encoding: UTF8');
    lines.push('BEGIN;');
    lines.push('SET client_encoding = \'UTF8\';');
    lines.push('');

    for (const tableName of tables) {
      try {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
          this.logger.warn(`Skipped table with unsupported name in SQL fallback: ${tableName}`);
          continue;
        }

        const columns = await this.backupsRepository.listTableColumns(tableName);
        if (!columns.length) {
          continue;
        }

        const rows = await this.backupsRepository.readRowsByTable(tableName);
        if (!rows.length) {
          lines.push(`-- Table ${tableName}: empty`);
          continue;
        }

        const quotedTable = this.quoteIdentifier(tableName);
        const quotedColumns = columns.map((column) => this.quoteIdentifier(column)).join(', ');

        lines.push(`-- Table ${tableName}: ${rows.length} row(s)`);
        for (const row of rows) {
          const valuesSql = columns
            .map((column) => this.toSqlLiteral((row as Record<string, unknown>)[column]))
            .join(', ');
          lines.push(`INSERT INTO ${quotedTable} (${quotedColumns}) VALUES (${valuesSql});`);
        }
        lines.push('');
      } catch (error) {
        const message = this.toSingleLineMessage(error);
        this.logger.error(`Failed SQL fallback export for table "${tableName}": ${message}`);
        lines.push(`-- Table ${tableName}: skipped due to export error: ${this.escapeSqlString(message)}`);
        lines.push('');
      }
    }

    lines.push('COMMIT;');
    lines.push('');

    await writeFile(sqlPath, lines.join('\n'), 'utf8');
  }

  private async exportWorkbook(excelPath: string) {
    const tables = await this.backupsRepository.listPublicTables();
    const workbook = XLSX.utils.book_new();
    const usedSheetNames = new Set<string>();

    for (const tableName of tables) {
      try {
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
      } catch (error) {
        const message = this.toSingleLineMessage(error);
        this.logger.error(`Failed workbook export for table "${tableName}": ${message}`);
        const sheetName = this.uniqueSheetName(this.sanitizeSheetName(`${tableName}_error`), usedSheetNames);
        const errorSheet = XLSX.utils.json_to_sheet([{ table: tableName, error: message }]);
        XLSX.utils.book_append_sheet(workbook, errorSheet, sheetName);
        usedSheetNames.add(sheetName);
      }
    }

    if (!usedSheetNames.size) {
      const metaSheet = XLSX.utils.json_to_sheet([{ info: 'No tables were exported' }]);
      XLSX.utils.book_append_sheet(workbook, metaSheet, 'backup_meta');
    }

    XLSX.writeFile(workbook, excelPath, { compression: true });
  }

  private async createArchive(zipPath: string, sqlPath: string, excelPath: string) {
    const archiver = await this.getArchiverFactory();

    return new Promise<void>((resolve, reject) => {
      const output = createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      let settled = false;

      const finalizeOnce = (fn: () => void) => {
        if (settled) return;
        settled = true;
        fn();
      };

      output.on('close', () => finalizeOnce(() => resolve()));
      output.on('error', (error: Error) => finalizeOnce(() => reject(error)));
      archive.on('error', (error: Error) => finalizeOnce(() => reject(error)));
      archive.on('warning', (error: Error & { code?: string }) => {
        if (error?.code === 'ENOENT') {
          finalizeOnce(() => reject(new Error(`Archive input file missing: ${error.message}`)));
          return;
        }
        finalizeOnce(() => reject(error));
      });

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

    const dynamicImport = new Function('modulePath', 'return import(modulePath);') as (modulePath: string) => Promise<any>;
    const archiverModule = await dynamicImport('archiver');
    const defaultCandidate = (archiverModule as any).default;
    if (typeof defaultCandidate === 'function') {
      this.archiverFactory = defaultCandidate as (format: string, options?: any) => any;
      return this.archiverFactory;
    }

    const zipArchiveCtor = (archiverModule as any).ZipArchive;
    if (typeof zipArchiveCtor === 'function') {
      this.archiverFactory = (format: string, options?: any) => {
        if (format !== 'zip') {
          throw new Error(`Unsupported archive format: ${format}`);
        }
        return new zipArchiveCtor(options);
      };
      return this.archiverFactory;
    }

    throw new Error('Archiver module could not be loaded correctly');
  }

  private async resolveArchivePath(backupDir: string) {
    const files = await readdir(backupDir).catch(() => []);
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
    if (Array.isArray(value)) return this.safeJsonStringify(value);
    if (value && typeof value === 'object') return this.safeJsonStringify(value);
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

  private quoteIdentifier(identifier: string) {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private toSqlLiteral(value: unknown) {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (value instanceof Date) return `'${this.escapeSqlString(value.toISOString())}'`;
    if (Buffer.isBuffer(value)) return `'\\\\x${value.toString('hex')}'`;

    if (this.isDecimalLike(value)) {
      return value.toString();
    }

    if (Array.isArray(value)) {
      return `'${this.escapeSqlString(this.safeJsonStringify(value))}'`;
    }

    if (typeof value === 'object') {
      return `'${this.escapeSqlString(this.safeJsonStringify(value))}'`;
    }

    return `'${this.escapeSqlString(String(value))}'`;
  }

  private escapeSqlString(value: string) {
    return value.replace(/'/g, "''");
  }

  private isDecimalLike(value: unknown): value is { toString: () => string } {
    if (!value || typeof value !== 'object') return false;
    const ctorName = (value as any).constructor?.name;
    return ctorName === 'Decimal' && typeof (value as any).toString === 'function';
  }

  private safeJsonStringify(value: unknown) {
    const visited = new WeakSet<object>();

    return JSON.stringify(value, (_key, currentValue) => {
      if (typeof currentValue === 'bigint') return currentValue.toString();
      if (Buffer.isBuffer(currentValue)) return currentValue.toString('base64');

      if (currentValue && typeof currentValue === 'object') {
        if (visited.has(currentValue)) return '[Circular]';
        visited.add(currentValue);
      }

      return currentValue;
    });
  }

  private toSingleLineMessage(error: unknown) {
    const raw = error instanceof Error ? error.message : String(error);
    return raw.replace(/\s+/g, ' ').trim();
  }

  private buildBackupTimestamp(timezone: string) {
    const now = new Date();
    const defaultTimestamp = now.toISOString().replace(/[:.]/g, '-');

    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).formatToParts(now);

      const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value])) as Record<string, string>;
      const y = partMap.year;
      const m = partMap.month;
      const d = partMap.day;
      const h = partMap.hour;
      const min = partMap.minute;
      const s = partMap.second;

      if (!y || !m || !d || !h || !min || !s) {
        return defaultTimestamp;
      }

      const ms = String(now.getMilliseconds()).padStart(3, '0');
      return `${y}-${m}-${d}T${h}-${min}-${s}-${ms}`;
    } catch (error) {
      this.logger.warn(`Failed to build timezone-aware backup timestamp. fallback=UTC reason="${this.toSingleLineMessage(error)}"`);
      return defaultTimestamp;
    }
  }

  private assertSafeExcelFileName(fileName: string) {
    const normalized = fileName?.trim();
    if (!normalized) {
      throw new BadRequestException('نام فایل نامعتبر است.');
    }

    if (normalized.includes('/') || normalized.includes('\\') || normalized.includes('..')) {
      throw new BadRequestException('نام فایل نامعتبر است.');
    }

    if (!/^[A-Za-z0-9._-]+$/.test(normalized) || !normalized.toLowerCase().endsWith('.xlsx')) {
      throw new BadRequestException('نام فایل نامعتبر است.');
    }
  }
}


