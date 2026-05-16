import { Injectable } from '@nestjs/common';
import { BaseService } from '../../../common/services/base.service';
import { RolesRepository } from '../roles.repository';

const SYSTEM_ROLE_KEYS = ['manager', 'assistant'] as const;
type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

@Injectable()
export class RolesService extends BaseService {
  constructor(private readonly rolesRepository: RolesRepository) {
    super();
  }

  async list() {
    const roles = await this.rolesRepository.findAll();
    const order = new Map<string, number>(SYSTEM_ROLE_KEYS.map((key, idx) => [key, idx]));

    return roles
      .filter((role) => order.has(role.key))
      .sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999));
  }

  findByKey(key: string) {
    return this.rolesRepository.findByKey(key);
  }

  getSystemRoleKeys(): readonly SystemRoleKey[] {
    return SYSTEM_ROLE_KEYS;
  }

  async ensureSystemRoles() {
    const manager = await this.rolesRepository.upsert({
      key: 'manager',
      name: '\u0645\u062f\u06cc\u0631',
      description: '\u062f\u0633\u062a\u0631\u0633\u06cc \u06a9\u0627\u0645\u0644 \u0633\u06cc\u0633\u062a\u0645',
      isSystem: true
    });

    await this.rolesRepository.upsert({
      key: 'assistant',
      name: '\u062f\u0633\u062a\u06cc\u0627\u0631',
      description: '\u062f\u0633\u062a\u0631\u0633\u06cc \u0645\u062d\u062f\u0648\u062f \u0628\u0631\u0627\u06cc \u0627\u0645\u0648\u0631 \u0627\u062c\u0631\u0627\u06cc\u06cc',
      isSystem: true
    });

    const deprecatedRoles = await this.rolesRepository.findExceptKeys([...SYSTEM_ROLE_KEYS]);
    for (const role of deprecatedRoles) {
      await this.rolesRepository.migrateUsersBetweenRoles(role.id, manager.id);
      await this.rolesRepository.deleteByKey(role.key);
    }
  }
}
