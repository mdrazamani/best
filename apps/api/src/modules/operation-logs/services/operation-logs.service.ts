import { Injectable } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { OperationLogsRepository } from '../operation-logs.repository';

@Injectable()
export class OperationLogsService extends BaseService {
  constructor(private readonly operationLogsRepository: OperationLogsRepository) {
    super();
  }

  list(limit = 100) {
    const safeLimit = Math.max(1, Math.min(limit, 500));
    return this.operationLogsRepository.list(safeLimit);
  }

  log(data: {
    actorId: string;
    entityType: string;
    entityId: string;
    action: string;
    description?: string;
    orderId?: string;
    payload?: Record<string, unknown>;
  }) {
    return this.operationLogsRepository.create(data);
  }
}
