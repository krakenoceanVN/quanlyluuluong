import { LinksService } from './links.service';
import { BusinessConflictException } from '../common/app.exceptions';

describe('LinksService delete constraint', () => {
  const audit = { log: jest.fn() };
  const flow = { invalidateLinkConfig: jest.fn() };

  it('throws 409 when the link still contains ads', async () => {
    const prisma = {
      link: {
        findFirst: jest.fn(async () => ({ id: 'l1', name: '11-02', shortCode: 'abc', _count: { linkAds: 2 } })),
        update: jest.fn(),
      },
    };
    const svc = new LinksService(prisma as never, audit as never, flow as never);
    await expect(svc.remove('l1', 'u1')).rejects.toBeInstanceOf(BusinessConflictException);
    expect(prisma.link.update).not.toHaveBeenCalled();
  });

  it('soft-deletes an empty link', async () => {
    const prisma = {
      link: {
        findFirst: jest.fn(async () => ({ id: 'l1', name: '11-02', shortCode: 'abc', _count: { linkAds: 0 } })),
        update: jest.fn(async () => ({ id: 'l1' })),
      },
      linkTracker: { deleteMany: jest.fn(async () => ({ count: 0 })) },
      $transaction: jest.fn(async (ops: unknown) => ops),
    };
    const svc = new LinksService(prisma as never, audit as never, flow as never);
    await expect(svc.remove('l1', 'u1')).resolves.toEqual({ id: 'l1' });
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(flow.invalidateLinkConfig).toHaveBeenCalledWith('abc');
  });
});
