import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      id?: string;
      path?: string;
      url?: string;
      originalUrl?: string;
      raw?: { url?: string };
      headers?: Record<string, string>;
      requestId?: string;
    }>();
    const requestId = request.requestId ?? request.id ?? request.headers?.['x-request-id'] ?? randomUUID();
    const path = request.path ?? request.url ?? request.originalUrl ?? request.raw?.url ?? '';

    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        meta: {
          requestId,
          path,
          timestamp: new Date().toISOString(),
          locale: 'fa'
        }
      }))
    );
  }
}
