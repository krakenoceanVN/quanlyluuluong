import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/** Normalises all errors into { code, message, data, fields? }. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (res.headersSent) return;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    let fields: Record<string, string[]> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        if (typeof b.message === 'string') message = b.message;
        else if (Array.isArray(b.message)) message = b.message.join('; ');
        if (b.fields && typeof b.fields === 'object') fields = b.fields as Record<string, string[]>;
      }
    } else if (exception instanceof Error) {
      // #12: lỗi có status sẵn (vd body-parser 413 PayloadTooLarge) → giữ đúng status
      const withStatus = exception as Error & { status?: number; statusCode?: number; type?: string };
      const s = withStatus.status ?? withStatus.statusCode;
      if (typeof s === 'number' && s >= 400 && s < 600) {
        status = s;
        message =
          withStatus.type === 'entity.too.large' || s === 413
            ? '请求体过大（超过限制）'
            : exception.message;
      } else {
        this.logger.error(exception.message, exception.stack);
      }
    }

    res.status(status).json({
      code: status,
      message,
      data: null,
      ...(fields ? { fields } : {}),
    });
  }
}
