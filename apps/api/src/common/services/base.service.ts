import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class BaseService {
  protected nowIso() {
    return new Date().toISOString();
  }
}
