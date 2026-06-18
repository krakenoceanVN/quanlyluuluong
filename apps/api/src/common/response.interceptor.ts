import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/** Wraps every JSON response as { code, message, data }. Skips raw responses (engine HTML/redirects). */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T> | T> {
    const res = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((data) => {
        // Engine endpoints write directly to res (@Res) — don't re-wrap.
        if (res.headersSent || data === undefined) return data;
        return { code: 0, message: 'ok', data: data as T };
      }),
    );
  }
}
