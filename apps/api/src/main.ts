import 'reflect-metadata';
import { ValidationPipe, ValidationError } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
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

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

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

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${port}  (prefix /api/v1)`);
}

bootstrap();
