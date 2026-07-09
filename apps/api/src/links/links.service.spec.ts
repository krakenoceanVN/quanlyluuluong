import { LinksService } from './links.service';
import { BusinessConflictException } from '../common/app.exceptions';

describe('LinksService delete constraint', () => {
  const audit = { log: jest.fn() };
  const flow = { invalidateLinkConfig: jest.fn() };

  it('throws 409 when the link still contains ads', async () => {
    const prisma = {
      link: {
        findFirst: jest.fn(async () => ({
          id: 'l1',
          name: '11-02',
          shortCode: 'abc',
          _count: { linkAds: 2 },
        })),
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
        findFirst: jest.fn(async () => ({
          id: 'l1',
          name: '11-02',
          shortCode: 'abc',
          _count: { linkAds: 0 },
        })),
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

describe('LinksService replaceAds keeps traffic history', () => {
  const audit = { log: jest.fn() };
  const flow = { invalidateLinkConfig: jest.fn(), getTodayMap: jest.fn(async () => new Map()) };

  it('soft-deletes dropped memberships instead of deleting TrafficDaily', async () => {
    const tx = {
      linkAd: {
        updateMany: jest.fn(async () => ({ count: 1 })),
        upsert: jest.fn(async () => ({ id: 'm2' })),
      },
      trafficDaily: { deleteMany: jest.fn() },
      ad: { update: jest.fn() },
    };
    const prisma = {
      link: {
        findFirst: jest.fn(async () => ({ id: 'l1', name: '11-02', shortCode: 'abc' })),
      },
      ad: { findMany: jest.fn(async () => [{ id: 'a2' }]) },
      linkAd: {
        // membership hiện tại: a1 (sẽ bị gỡ) — request chỉ giữ a2
        findMany: jest.fn(async () => [{ id: 'm1', adId: 'a1' }]),
      },
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    };
    const svc = new LinksService(prisma as never, audit as never, flow as never);
    // getAds được gọi cuối cùng — cho trả rỗng
    jest.spyOn(svc, 'getAds').mockResolvedValue([]);

    await svc.replaceAds(
      'l1',
      { items: [{ adId: 'a2', weight: 50, dailyLimit: 1000 }] } as never,
      'u1',
    );

    // membership bị gỡ → chỉ đánh dấu deletedAt, KHÔNG xóa lịch sử traffic
    expect(tx.linkAd.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['m1'] } },
      data: { deletedAt: expect.any(Date) },
    });
    expect(tx.trafficDaily.deleteMany).not.toHaveBeenCalled();
    // membership giữ/thêm → upsert với deletedAt: null (hồi sinh nếu từng bị gỡ)
    expect(tx.linkAd.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { linkId_adId: { linkId: 'l1', adId: 'a2' } },
        update: expect.objectContaining({ deletedAt: null }),
      }),
    );
    expect(flow.invalidateLinkConfig).toHaveBeenCalledWith('abc');
  });
});
