import { SyncWorker } from './sync.worker';
import { dirtyFlowSet, flowKey } from './traffic.keys';

function makeWorker(store: Record<string, string>, dirty: Set<string>, onUpsert?: () => void) {
  const redis = {
    client: {
      smembers: jest.fn(async () => Array.from(dirty)),
      get: jest.fn(async (key: string) => store[key] ?? null),
      srem: jest.fn(async (_key: string, member: string) => {
        dirty.delete(member);
        return 1;
      }),
      eval: jest.fn(
        async (
          _script: string,
          _keys: number,
          flow: string,
          set: string,
          count: string,
          member: string,
        ) => {
          if (set !== dirtyFlowSet()) return 0;
          if (store[flow] === count) {
            dirty.delete(member);
            return 1;
          }
          return 0;
        },
      ),
    },
  };
  const prisma = {
    trafficDaily: {
      upsert: jest.fn(async () => {
        onUpsert?.();
      }),
    },
  };
  const config = { get: jest.fn((_key: string, fallback: unknown) => fallback) };
  return {
    worker: new SyncWorker(redis as never, prisma as never, config as never),
    redis,
    prisma,
  };
}

describe('SyncWorker.flush', () => {
  const date = '2026-06-30';
  const linkAdId = 'm1';
  const member = `${linkAdId}|${date}`;
  const key = flowKey(linkAdId, date);

  it('removes a dirty marker after the same count is persisted', async () => {
    const store = { [key]: '5' };
    const dirty = new Set([member]);
    const { worker } = makeWorker(store, dirty);

    await worker.flush();

    expect(dirty.has(member)).toBe(false);
  });

  it('keeps a dirty marker when the counter changes during flush', async () => {
    const store = { [key]: '5' };
    const dirty = new Set([member]);
    const { worker } = makeWorker(store, dirty, () => {
      store[key] = '6';
    });

    await worker.flush();

    expect(dirty.has(member)).toBe(true);
  });
});
