import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../../common/repositories/base.repository';

@Injectable()
export class BackupsRepository extends BaseRepository {
  listLogs() {
    return this.prisma.backupLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  createLog(data: { backupDir: string; sqlFilePath: string; excelDirectory: string; status: string; message?: string }) {
    return this.prisma.backupLog.create({
      data
    });
  }

  findLogById(id: string) {
    return this.prisma.backupLog.findUnique({ where: { id } });
  }

  getIntervalSetting() {
    return this.prisma.appSetting.findUnique({ where: { key: 'backup_interval_minutes' } });
  }

  upsertIntervalSetting(value: string) {
    return this.prisma.appSetting.upsert({
      where: { key: 'backup_interval_minutes' },
      update: { value },
      create: {
        key: 'backup_interval_minutes',
        value
      }
    });
  }

  async listPublicTables() {
    const rows = await this.prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT tablename AS table_name
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;

    return rows.map((row) => row.table_name);
  }

  readRowsByTable(tableName: string) {
    return this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM "${tableName}"`);
  }
}
