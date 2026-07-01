import 'reflect-metadata';
import { ValidationPipe, ValidationError } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/response.interceptor';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { UnprocessableEntityException } from './common/app.exceptions';

function flattenErrors(errors: ValidationError[], parent = ''): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const e of errors) {
    const key = parent ? `${parent}.${e.property}` : e.property;
    if (e.constraints) out[key] = Object.values(e.constraints);
    if (e.children?.length) Object.assign(out, flattenErrors(e.children, key));
  }
  return out;
}

/** #19: từ chối khởi động ở production nếu JWT secret thiếu hoặc còn giá trị mẫu. */
function assertSecrets() {
  const weak = (s?: string) => !s || /change-me|CHANGE_ME/.test(s);
  if (process.env.NODE_ENV === 'production') {
    if (weak(process.env.JWT_ACCESS_SECRET) || weak(process.env.JWT_REFRESH_SECRET)) {
      throw new Error(
        'JWT_ACCESS_SECRET / JWT_REFRESH_SECRET chưa được đặt an toàn (đang trống hoặc là giá trị mẫu). ' +
          'Hãy đặt secret ngẫu nhiên mạnh trước khi chạy production.',
      );
    }
  }
}

async function bootstrap() {
  assertSecrets();

  // #12: tự parse body với giới hạn 1MB → vượt sẽ ném 413 (thay vì 500)
  const app = await NestFactory.create(AppModule, { cors: true, bodyParser: false });
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // #52/#50: lấy IP thật khi chạy sau reverse proxy (Caddy) → rate-limit & log đúng
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  // /api/v1 for everything except the public traffic engine (/main/link/:code)
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'main/link/:shortCode', method: 0 /* GET */ }, { path: 'health', method: 0 }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      exceptionFactory: (errors) =>
        new UnprocessableEntityException('参数校验失败', flattenErrors(errors)),
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // #60: dọn dẹp gọn gàng khi nhận SIGTERM (đóng DB/Redis, flush worker qua onModuleDestroy)
  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 3000);
  const server = await app.listen(port, '0.0.0.0');
  // keep-alive dài hơn timeout của reverse proxy để tránh rớt kết nối
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${port}  (prefix /api/v1)`);
}

bootstrap();
