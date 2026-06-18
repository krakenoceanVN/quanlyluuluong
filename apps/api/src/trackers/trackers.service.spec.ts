import { TrackersService } from './trackers.service';
import { BusinessConflictException } from '../common/app.exceptions';

describe('TrackersService delete constraint', () => {
  const audit = { log: jest.fn() };
  const flow = { invalidateLinkConfig: jest.fn() };

  it('throws 409 when the tracker is still used by a link', async () => {
    const prisma = {
      tracker: { findFirst: jest.fn(async () => ({ id: 't1', name: 'tk' })), update: jest.fn() },
      linkTracker: { count: jest.fn(async () => 2) },
    };
    const svc = new TrackersService(prisma as never, audit as never, flow as never);
    await expect(svc.remove('t1', 'u1')).rejects.toBeInstanceOf(BusinessConflictException);
    expect(prisma.tracker.update).not.toHaveBeenCalled();
  });

  it('soft-deletes when unused', async () => {
    const prisma = {
      tracker: {
        findFirst: jest.fn(async () => ({ id: 't1', name: 'tk' })),
        update: jest.fn(async () => ({ id: 't1' })),
      },
      linkTracker: { count: jest.fn(async () => 0) },
    };
    const svc = new TrackersService(prisma as never, audit as never, flow as never);
    await expect(svc.remove('t1', 'u1')).resolves.toEqual({ id: 't1' });
    expect(prisma.tracker.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { deletedAt: expect.any(Date) },
    });
  });
});
