import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<any>();
    const request = ctx.getRequest<{ path?: string; headers?: Record<string, string> }>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : { message: 'خطاي داخلي سرور' };

    const message = typeof payload === 'string' ? payload : (payload as { message?: string | string[] }).message;

    response.status(status).send({
      success: false,
      error: {
        code: 'API_ERROR',
        statusCode: status,
        message: Array.isArray(message) ? message.join(' | ') : message ?? 'خطا',
        details: typeof payload === 'string' ? undefined : payload
      },
      meta: {
        requestId: request.headers?.['x-request-id'] ?? 'n/a',
        path: request.path ?? '',
        timestamp: new Date().toISOString(),
        locale: 'fa'
      }
    });
  }
}
