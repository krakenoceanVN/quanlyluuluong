import { AdsService } from './ads.service';
import { BusinessConflictException } from '../common/app.exceptions';

describe('AdsService delete constraint', () => {
  const audit = { log: jest.fn() };
  const flow = { invalidateLinkConfig: jest.fn() };

  it('throws 409 when the ad is still inside a link', async () => {
    const prisma = {
      ad: { findFirst: jest.fn(async () => ({ id: 'a1', name: 'sm-1' })), update: jest.fn() },
      linkAd: { count: jest.fn(async () => 1), findMany: jest.fn(async () => []) },
    };
    const svc = new AdsService(prisma as never, audit as never, flow as never);
    await expect(svc.remove('a1', 'u1')).rejects.toBeInstanceOf(BusinessConflictException);
    expect(prisma.ad.update).not.toHaveBeenCalled();
  });

  it('soft-deletes when not used', async () => {
    const prisma = {
      ad: {
        findFirst: jest.fn(async () => ({ id: 'a1', name: 'sm-1' })),
        update: jest.fn(async () => ({ id: 'a1' })),
      },
      linkAd: { count: jest.fn(async () => 0), findMany: jest.fn(async () => []) },
    };
    const svc = new AdsService(prisma as never, audit as never, flow as never);
    await expect(svc.remove('a1', 'u1')).resolves.toEqual({ id: 'a1' });
    expect(prisma.ad.update).toHaveBeenCalled();
  });
});
