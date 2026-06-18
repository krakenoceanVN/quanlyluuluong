import { EngineService } from './engine.service';

function makeConfig(ads: unknown[], status = true) {
  return JSON.stringify({
    linkId: 'l1',
    shortCode: 'abc',
    status,
    trackers: [],
    ads,
  });
}

describe('EngineService.serve', () => {
  let redisStore: Record<string, string>;
  let flow: { getTodayMap: jest.Mock; increment: jest.Mock };
  let prisma: { link: { findFirst: jest.Mock } };
  let service: EngineService;

  beforeEach(() => {
    redisStore = {};
    const redis = {
      client: {
        get: jest.fn(async (k: string) => redisStore[k] ?? null),
        set: jest.fn(async (k: string, v: string) => {
          redisStore[k] = v;
        }),
      },
    };
    flow = { getTodayMap: jest.fn(async () => new Map()), increment: jest.fn(async () => 1) };
    prisma = { link: { findFirst: jest.fn(async () => null) } };
    const config = { get: jest.fn((_k: string, d: unknown) => d) };
    service = new EngineService(
      prisma as never,
      redis as never,
      flow as never,
      config as never,
    );
  });

  it('returns notfound when the link does not exist', async () => {
    const res = await service.serve('missing');
    expect(res.kind).toBe('notfound');
  });

  it('returns notfound when the link is offline', async () => {
    redisStore['link:cfg:abc'] = makeConfig([], false);
    const res = await service.serve('abc');
    expect(res.kind).toBe('notfound');
  });

  it('redistributes all traffic to the remaining ad when one hits its daily limit', async () => {
    redisStore['link:cfg:abc'] = makeConfig([
      { linkAdId: 'm1', adId: 'a1', targetUrl: 'https://one', weight: 50, dailyLimit: 100, status: true, adStatus: true },
      { linkAdId: 'm2', adId: 'a2', targetUrl: 'https://two', weight: 50, dailyLimit: 100, status: true, adStatus: true },
    ]);
    // m1 is capped, m2 has room
    flow.getTodayMap.mockResolvedValue(new Map([['m1', 100], ['m2', 0]]));

    for (let i = 0; i < 50; i++) {
      const res = await service.serve('abc');
      expect(res.kind).toBe('redirect');
      expect(res.targetUrl).toBe('https://two');
    }
    expect(flow.increment).toHaveBeenCalledWith('m2');
    expect(flow.increment).not.toHaveBeenCalledWith('m1');
  });

  it('returns fallback when every ad is at its limit', async () => {
    redisStore['link:cfg:abc'] = makeConfig([
      { linkAdId: 'm1', adId: 'a1', targetUrl: 'https://one', weight: 50, dailyLimit: 100, status: true, adStatus: true },
    ]);
    flow.getTodayMap.mockResolvedValue(new Map([['m1', 100]]));
    const res = await service.serve('abc');
    expect(res.kind).toBe('fallback');
    expect(flow.increment).not.toHaveBeenCalled();
  });

  it('skips memberships/ads that are turned off', async () => {
    redisStore['link:cfg:abc'] = makeConfig([
      { linkAdId: 'm1', adId: 'a1', targetUrl: 'https://off-membership', weight: 50, dailyLimit: 0, status: false, adStatus: true },
      { linkAdId: 'm2', adId: 'a2', targetUrl: 'https://off-ad', weight: 50, dailyLimit: 0, status: true, adStatus: false },
      { linkAdId: 'm3', adId: 'a3', targetUrl: 'https://live', weight: 50, dailyLimit: 0, status: true, adStatus: true },
    ]);
    flow.getTodayMap.mockResolvedValue(new Map([['m3', 0]]));
    const res = await service.serve('abc');
    expect(res.kind).toBe('redirect');
    expect(res.targetUrl).toBe('https://live');
    expect(flow.increment).toHaveBeenCalledWith('m3');
  });
});
