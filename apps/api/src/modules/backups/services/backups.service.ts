import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { createWriteStream, existsSync } from 'fs';
import { mkdir, readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import cron, { type ScheduledTask } from 'node-cron';
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
      this.logger.warn('درخواست بکاپ جدید ثبت شد، اما یک بکاپ دیگر در حال اجرا است. نتیجه همان اجرای فعلی برگردانده می‌شود.');
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
        message: 'بکاپ با موفقیت ایجاد شد.'
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

    try {
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
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('دانلود آرشیو بکاپ در سرور انجام نشد. لطفا دوباره تلاش کنید.');
    }
  }

  async readSql(logId: string) {
    const log = await this.backupsRepository.findLogById(logId);
    if (!log || !existsSync(log.sqlFilePath)) {
      throw new NotFoundException('فایل SQL پیدا نشد.');
    }

    try {
      return {
        fileName: 'database.sql',
        contentType: 'application/sql',
        buffer: await readFile(log.sqlFilePath)
      };
    } catch {
      throw new BadRequestException('دانلود فایل SQL در سرور انجام نشد. لطفا دوباره تلاش کنید.');
    }
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

    try {
      return {
        fileName,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: await readFile(fullPath)
      };
    } catch {
      throw new BadRequestException('دانلود فایل اکسل در سرور انجام نشد. لطفا دوباره تلاش کنید.');
    }
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
      throw new Error(`عبارت BACKUP_CRON نامعتبر است: ${cronExpr}`);
    }

    this.nightlyTask = cron.schedule(
      cronExpr,
      () => {
        this.runBackup().catch((error) => this.logger.error(`اجرای زمان‌بندی‌شده بکاپ با خطا مواجه شد: ${String(error)}`));
      },
      { timezone }
    );

    this.logger.log(`زمان‌بندی بکاپ فعال شد: cron="${cronExpr}" timezone="${timezone}"`);
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
      this.logger.warn(`اجرای pg_dump ممکن نبود؛ خروجی SQL با روش جایگزین تولید می‌شود. دلیل: "${reason}"`);
    }

    await this.exportSqlFallback(sqlPath);
  }

  private async exportSqlWithPgDump(sqlPath: string) {
    const dbUrl = this.configService.get<string>('DATABASE_URL');
    if (!dbUrl) {
      throw new Error('تنظیم DATABASE_URL انجام نشده است.');
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
        reject(new Error(stderr || `اجرای pg_dump با کد خطا ${code} متوقف شد.`));
      });
    });
  }

  private async exportSqlFallback(sqlPath: string) {
    const tables = await this.backupsRepository.listPublicTables();
    const lines: string[] = [];

    lines.push('-- خروجی SQL بکاپ (حالت جایگزین بدون pg_dump)');
    lines.push(`-- created_at: ${new Date().toISOString()}`);
    lines.push('-- encoding: UTF8');
    lines.push('BEGIN;');
    lines.push('SET client_encoding = \'UTF8\';');
    lines.push('');

    for (const tableName of tables) {
      try {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
          this.logger.warn(`جدول با نام پشتیبانی‌نشده در خروجی SQL جایگزین نادیده گرفته شد: ${tableName}`);
          continue;
        }

        const columns = await this.backupsRepository.listTableColumns(tableName);
        if (!columns.length) {
          continue;
        }

        const rows = await this.backupsRepository.readRowsByTable(tableName);
        if (!rows.length) {
          lines.push(`-- جدول ${tableName}: خالی`);
          continue;
        }

        const quotedTable = this.quoteIdentifier(tableName);
        const quotedColumns = columns.map((column) => this.quoteIdentifier(column)).join(', ');

        lines.push(`-- جدول ${tableName}: ${rows.length} ردیف`);
        for (const row of rows) {
          const valuesSql = columns
            .map((column) => this.toSqlLiteral((row as Record<string, unknown>)[column]))
            .join(', ');
          lines.push(`INSERT INTO ${quotedTable} (${quotedColumns}) VALUES (${valuesSql});`);
        }
        lines.push('');
      } catch (error) {
        const message = this.toSingleLineMessage(error);
        this.logger.error(`خروجی SQL جایگزین برای جدول "${tableName}" با خطا مواجه شد: ${message}`);
        lines.push(`-- جدول ${tableName}: به دلیل خطای خروجی‌گیری رد شد: ${this.escapeSqlString(message)}`);
        lines.push('');
      }
    }

    lines.push('COMMIT;');
    lines.push('');

    await writeFile(sqlPath, lines.join('\n'), 'utf8');
  }

  private async exportWorkbook(excelPath: string) {
    const tables = await this.backupsRepository.listPublicTables();
    const usedSheetNames = new Set<string>();
    const sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }> = [];

    for (const tableName of tables) {
      try {
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
          this.logger.warn(`جدول با نام نامعتبر در خروجی اکسل نادیده گرفته شد: ${tableName}`);
          continue;
        }

        const rows = await this.backupsRepository.readRowsByTable(tableName);
        const normalizedRows = rows.map((row) => this.normalizeRow(row));
        const sheetName = this.uniqueSheetName(this.sanitizeSheetName(tableName), usedSheetNames);

        sheets.push({ name: sheetName, rows: normalizedRows });
        usedSheetNames.add(sheetName);
      } catch (error) {
        const message = this.toSingleLineMessage(error);
        this.logger.error(`خروجی اکسل برای جدول "${tableName}" با خطا مواجه شد: ${message}`);
        const sheetName = this.uniqueSheetName(this.sanitizeSheetName(`${tableName}_error`), usedSheetNames);
        sheets.push({ name: sheetName, rows: [{ table: tableName, error: message }] });
        usedSheetNames.add(sheetName);
      }
    }

    if (!usedSheetNames.size) {
      sheets.push({ name: 'meta', rows: [{ info: 'هیچ جدولی برای خروجی پیدا نشد' }] });
    }

    await this.writeXlsxWorkbook(excelPath, sheets);
  }

  private async writeXlsxWorkbook(excelPath: string, sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }>) {
    const archiver = await this.getArchiverFactory();

    return new Promise<void>((resolve, reject) => {
      const output = createWriteStream(excelPath);
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

      archive.pipe(output);
      archive.append(this.buildContentTypesXml(sheets.length), { name: '[Content_Types].xml' });
      archive.append(this.buildPackageRelsXml(), { name: '_rels/.rels' });
      archive.append(this.buildWorkbookXml(sheets), { name: 'xl/workbook.xml' });
      archive.append(this.buildWorkbookRelsXml(sheets.length), { name: 'xl/_rels/workbook.xml.rels' });
      archive.append(this.buildWorkbookStylesXml(), { name: 'xl/styles.xml' });

      sheets.forEach((sheet, index) => {
        archive.append(this.buildWorksheetXml(sheet.rows), { name: `xl/worksheets/sheet${index + 1}.xml` });
      });

      void archive.finalize();
    });
  }

  private buildContentTypesXml(sheetCount: number) {
    const worksheetOverrides = Array.from({ length: sheetCount }, (_value, index) => {
      const id = index + 1;
      return `<Override PartName="/xl/worksheets/sheet${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${worksheetOverrides}
</Types>`;
  }

  private buildPackageRelsXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  }

  private buildWorkbookXml(sheets: Array<{ name: string }>) {
    const sheetEntries = sheets
      .map((sheet, index) => `<sheet name="${this.escapeXmlAttribute(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
      .join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetEntries}</sheets>
</workbook>`;
  }

  private buildWorkbookRelsXml(sheetCount: number) {
    const sheetRels = Array.from({ length: sheetCount }, (_value, index) => {
      const id = index + 1;
      return `<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${id}.xml"/>`;
    }).join('');
    const stylesRelId = sheetCount + 1;

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="rId${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  }

  private buildWorkbookStylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>`;
  }

  private buildWorksheetXml(rows: Array<Record<string, unknown>>) {
    const headers = this.collectWorksheetHeaders(rows);
    const sheetRows = rows.length ? [headers, ...rows.map((row) => headers.map((header) => row[header]))] : [];
    const xmlRows = sheetRows
      .map((row, rowIndex) => {
        const rowNumber = rowIndex + 1;
        const cells = row
          .map((value, columnIndex) => this.buildWorksheetCell(value, this.columnName(columnIndex + 1), rowNumber))
          .join('');
        return `<row r="${rowNumber}">${cells}</row>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${xmlRows}</sheetData>
</worksheet>`;
  }

  private collectWorksheetHeaders(rows: Array<Record<string, unknown>>) {
    return Array.from(rows.reduce((headers, row) => {
      Object.keys(row).forEach((key) => headers.add(key));
      return headers;
    }, new Set<string>()));
  }

  private buildWorksheetCell(value: unknown, column: string, rowNumber: number) {
    const ref = `${column}${rowNumber}`;
    if (value === null || value === undefined || value === '') {
      return `<c r="${ref}"/>`;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `<c r="${ref}"><v>${value}</v></c>`;
    }
    if (typeof value === 'boolean') {
      return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
    }

    return `<c r="${ref}" t="inlineStr"><is><t>${this.escapeXmlText(String(value))}</t></is></c>`;
  }

  private columnName(index: number) {
    let value = index;
    let name = '';
    while (value > 0) {
      const remainder = (value - 1) % 26;
      name = String.fromCharCode(65 + remainder) + name;
      value = Math.floor((value - 1) / 26);
    }
    return name;
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
          finalizeOnce(() => reject(new Error(`فایل ورودی برای ساخت آرشیو پیدا نشد: ${error.message}`)));
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
          throw new Error(`فرمت آرشیو پشتیبانی نمی‌شود: ${format}`);
        }
        return new zipArchiveCtor(options);
      };
      return this.archiverFactory;
    }

    throw new Error('ماژول Archiver به‌درستی بارگذاری نشد.');
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

  private escapeXmlText(value: string) {
    return this.removeInvalidXmlCharacters(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private escapeXmlAttribute(value: string) {
    return this.escapeXmlText(value)
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private removeInvalidXmlCharacters(value: string) {
    return value.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD]/g, '');
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
      this.logger.warn(`ساخت زمان بکاپ با تایم‌زون انجام نشد و زمان UTC جایگزین شد. دلیل: "${this.toSingleLineMessage(error)}"`);
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


