import { Injectable } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { RolesRepository } from '../roles.repository';

@Injectable()
export class RolesService extends BaseService {
  constructor(private readonly rolesRepository: RolesRepository) {
    super();
  }

  list() {
    return this.rolesRepository.findAll();
  }

  findByKey(key: string) {
    return this.rolesRepository.findByKey(key);
  }

  async ensureSystemRoles() {
    const superAdmin = await this.rolesRepository.findByKey('super_admin');
    if (!superAdmin) {
      await this.rolesRepository.create({
        key: 'super_admin',
        name: '???? ????',
        description: '?????? ???? ?????',
        isSystem: true
      });
    }

    const customer = await this.rolesRepository.findByKey('customer');
    if (!customer) {
      await this.rolesRepository.create({
        key: 'customer',
        name: '?????',
        description: '??? ???????',
        isSystem: true
      });
    }

    const manager = await this.rolesRepository.findByKey('manager');
    if (!manager) {
      await this.rolesRepository.create({
        key: 'manager',
        name: '????',
        description: '???? ?????',
        isSystem: false
      });
    }
  }
}
