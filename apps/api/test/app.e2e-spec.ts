import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ResponseInterceptor } from '../src/common/response.interceptor';
import { HttpExceptionFilter } from '../src/common/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { SyncWorker } from '../src/engine/sync.worker';

/**
 * Full-flow e2e. Requires Postgres + Redis (see docker-compose) and a migrated DB.
 * Run with: DISABLE_SYNC_WORKER=1 npm run test:e2e -w apps/api
 */
describe('Traffic flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const uniq = Date.now();

  beforeAll(async () => {
    process.env.DISABLE_SYNC_WORKER = '1';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: [
        { path: 'main/link/:shortCode', method: 0 },
        { path: 'health', method: 0 },
      ],
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    prisma = app.get(PrismaService);

    // ensure an admin exists (seed may already have created it)
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    token = login.body?.data?.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('logs in', () => {
    expect(token).toBeTruthy();
  });

  it('create tracker → link(+tracker) → ad → add ad → engine increments counter', async () => {
    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

    const tracker = await auth(request(app.getHttpServer()).post('/api/v1/trackers')).send({
      name: `e2e-tracker-${uniq}`,
      description: '51la',
      code: '<script>/*t*/</script>',
    });
    expect(tracker.status).toBe(201);
    const trackerId = tracker.body.data.id;

    const link = await auth(request(app.getHttpServer()).post('/api/v1/links')).send({
      name: `e2e-link-${uniq}`,
      description: 'e2e',
      trackerIds: [trackerId],
    });
    expect(link.status).toBe(201);
    const linkId = link.body.data.id;
    const shortCode = link.body.data.shortCode;

    const ad = await auth(request(app.getHttpServer()).post('/api/v1/ads')).send({
      name: `e2e-ad-${uniq}`,
      targetUrl: 'https://example.com/landing',
    });
    expect(ad.status).toBe(201);
    const adId = ad.body.data.id;

    const put = await auth(request(app.getHttpServer()).put(`/api/v1/links/${linkId}/ads`)).send({
      items: [{ adId, weight: 50, dailyLimit: 50000 }],
    });
    expect(put.status).toBe(200);
    expect(put.body.data).toHaveLength(1);
    const linkAdId = put.body.data[0].linkAdId;

    // hit the public engine a few times
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer()).get(`/main/link/${shortCode}`);
    }

    // counter should reflect the hits
    const after = await auth(request(app.getHttpServer()).get(`/api/v1/links/${linkId}/ads`));
    expect(after.body.data[0].today).toBeGreaterThanOrEqual(5);

    // worker flush persists to DB
    const worker = app.get(SyncWorker);
    await worker.flush();
    const row = await prisma.trafficDaily.findFirst({ where: { linkAdId } });
    expect(row?.count).toBeGreaterThanOrEqual(5);

    // delete constraint: ad still in link → 409
    const del = await auth(request(app.getHttpServer()).delete(`/api/v1/ads/${adId}`));
    expect(del.status).toBe(409);
  });
});
