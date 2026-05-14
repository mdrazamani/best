import { Inject } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export abstract class BaseRepository {
  @Inject(PrismaService)
  protected readonly prisma!: PrismaService;
}
