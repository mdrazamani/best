import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { MeshTypesRepository } from '../mesh-types.repository';
import { OperationLogsService } from '../../operation-logs/services/operation-logs.service';
import { CreateMeshTypeDto } from '../dto/create-mesh-type.dto';
import { UpdateMeshTypeDto } from '../dto/update-mesh-type.dto';

@Injectable()
export class MeshTypesService extends BaseService {
  constructor(
    private readonly meshTypesRepository: MeshTypesRepository,
    private readonly operationLogsService: OperationLogsService
  ) {
    super();
  }

  list(q?: string) {
    return this.meshTypesRepository.list(q?.trim());
  }

  async create(actorId: string, dto: CreateMeshTypeDto) {
    const created = await this.meshTypesRepository.create({
      title: dto.title.trim(),
      description: dto.description?.trim(),
      isActive: dto.isActive,
      createdById: actorId
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'MeshType',
      entityId: created.id,
      action: 'CREATE',
      description: 'Mesh type created'
    });

    return created;
  }

  async update(actorId: string, id: string, dto: UpdateMeshTypeDto) {
    const existing = await this.meshTypesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('نوع توري پيدا نشد.');
    }

    const updated = await this.meshTypesRepository.update(id, {
      title: dto.title?.trim(),
      description: dto.description === undefined ? undefined : dto.description?.trim() ?? null,
      isActive: dto.isActive
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'MeshType',
      entityId: updated.id,
      action: 'UPDATE',
      description: 'Mesh type updated'
    });

    return updated;
  }

  async remove(actorId: string, id: string) {
    const existing = await this.meshTypesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('نوع توری پیدا نشد.');
    }

    await this.meshTypesRepository.softDelete(id);

    await this.operationLogsService.log({
      actorId,
      entityType: 'MeshType',
      entityId: id,
      action: 'DELETE',
      description: 'Soft delete mesh type'
    });

    return { success: true };
  }
}
