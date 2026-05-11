import { PrismaService } from '../../infrastructure/database/prisma.service';

export abstract class BaseRepository {
  constructor(protected readonly prisma: PrismaService) {}
}
