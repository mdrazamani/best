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
        name: '\u0645\u062f\u06cc\u0631 \u0627\u0635\u0644\u06cc',
        description: '\u062f\u0633\u062a\u0631\u0633\u06cc \u06a9\u0627\u0645\u0644 \u0633\u06cc\u0633\u062a\u0645',
        isSystem: true
      });
    }

    const customer = await this.rolesRepository.findByKey('customer');
    if (!customer) {
      await this.rolesRepository.create({
        key: 'customer',
        name: '\u0645\u0634\u062a\u0631\u06cc',
        description: '\u0646\u0642\u0634 \u067e\u06cc\u0634\u200c\u0641\u0631\u0636',
        isSystem: true
      });
    }

    const manager = await this.rolesRepository.findByKey('manager');
    if (!manager) {
      await this.rolesRepository.create({
        key: 'manager',
        name: '\u0645\u062f\u06cc\u0631',
        description: '\u0645\u062f\u06cc\u0631 \u0633\u06cc\u0633\u062a\u0645',
        isSystem: false
      });
    }
  }
}
