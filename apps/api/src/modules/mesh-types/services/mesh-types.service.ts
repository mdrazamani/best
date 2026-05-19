import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { MeshTypesRepository } from '../mesh-types.repository';
import { OperationLogsService } from '../../operation-logs/services/operation-logs.service';
import { CreateMeshTypeDto } from '../dto/create-mesh-type.dto';
import { UpdateMeshTypeDto } from '../dto/update-mesh-type.dto';
import { clampMoneyNonNegative, toMoneyNumber } from '../../../common/utils/accounting.util';

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
    const hasDefault = await this.meshTypesRepository.findDefaultActive();
    const shouldDefault = dto.isDefault === true || !hasDefault;
    if (shouldDefault) {
      await this.meshTypesRepository.clearDefault();
    }

    const created = await this.meshTypesRepository.create({
      title: dto.title.trim(),
      description: dto.description?.trim(),
      isActive: dto.isActive,
      unitPrice: toMoneyNumber(clampMoneyNonNegative(dto.unitPrice ?? 0)),
      isDefault: shouldDefault,
      createdById: actorId
    });

    await this.operationLogsService.log({
      actorId,
      entityType: 'MeshType',
      entityId: created.id,
      action: 'CREATE',
      description: 'ایجاد نوع توری'
    });

    return created;
  }

  async update(actorId: string, id: string, dto: UpdateMeshTypeDto) {
    const existing = await this.meshTypesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('نوع توري پيدا نشد.');
    }

    if (dto.isDefault === true) {
      await this.meshTypesRepository.clearDefault(id);
    }

    const updated = await this.meshTypesRepository.update(id, {
      title: dto.title?.trim(),
      description: dto.description === undefined ? undefined : dto.description?.trim() ?? null,
      isActive: dto.isActive,
      unitPrice: dto.unitPrice === undefined ? undefined : toMoneyNumber(clampMoneyNonNegative(dto.unitPrice)),
      isDefault: dto.isDefault
    });

    if (updated.isDefault === false || updated.isActive === false) {
      const hasDefault = await this.meshTypesRepository.findDefaultActive();
      if (!hasDefault) {
        const fallback = await this.meshTypesRepository.findFirstActive();
        if (fallback) {
          await this.meshTypesRepository.clearDefault(fallback.id);
          await this.meshTypesRepository.update(fallback.id, { isDefault: true });
        }
      }
    }

    await this.operationLogsService.log({
      actorId,
      entityType: 'MeshType',
      entityId: updated.id,
      action: 'UPDATE',
      description: 'ویرایش نوع توری'
    });

    return updated;
  }

  async remove(actorId: string, id: string) {
    const existing = await this.meshTypesRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('نوع توری پیدا نشد.');
    }

    const removedWasDefault = existing.isDefault;
    await this.meshTypesRepository.softDelete(id);

    if (removedWasDefault) {
      const fallback = await this.meshTypesRepository.findFirstActive(id);
      if (fallback) {
        await this.meshTypesRepository.clearDefault(fallback.id);
        await this.meshTypesRepository.update(fallback.id, { isDefault: true });
      }
    }

    await this.operationLogsService.log({
      actorId,
      entityType: 'MeshType',
      entityId: id,
      action: 'DELETE',
      description: 'حذف نوع توری'
    });

    return { success: true };
  }
}
