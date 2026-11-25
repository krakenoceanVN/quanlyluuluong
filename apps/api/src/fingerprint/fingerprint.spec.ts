import { normalizeBeacon } from './fingerprint.util';
import { FingerprintService } from './fingerprint.service';

const UA =
  'Mozilla/5.0 (Linux; Android 12; ALN-AL00 Build/HUAWEIALN-AL00; wv) AppleWebKit/537.36 Chrome/132.0 Mobile Safari/537.36';

/** Một thiết bị mẫu như beacon thật gửi về. */
function device(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    c: 'ue4f6aag',
    wd: '0',
    sw: '412',
    sh: '915',
    dpr: '3.5',
    hc: '8',
    dm: '8',
    tz: 'Asia/Shanghai',
    gr: 'Mali-G78',
    ch: '1ve280k',
    iw: '412',
    ih: '800',
    t: '35',
    ct: '4g/150/10',
    ...extra,
  };
}

describe('normalizeBeacon', () => {
  it('builds stable attrs, volatile sample and a 64-char hash', () => {
    const fp = normalizeBeacon(device(), UA)!;
    expect(fp.linkCode).toBe('ue4f6aag');
    expect(fp.attrs).toMatchObject({ sw: '412', gr: 'Mali-G78', ch: '1ve280k' });
    expect(fp.attrs).not.toHaveProperty('t');
    expect(fp.sample).toMatchObject({ iw: '412', t: '35', ct: '4g/150/10' });
    expect(fp.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('gives the same hash when only volatile values change (same device revisiting)', () => {
    const a = normalizeBeacon(device(), UA)!;
    const b = normalizeBeacon(
      device({ t: '900', ih: '640', ct: 'wifi/20/50', c: 'other_link' }),
      UA,
    )!;
    expect(b.hash).toBe(a.hash);
  });

  it('does not depend on query key order', () => {
    const q = device();
    const reversed = Object.fromEntries(Object.entries(q).reverse());
    expect(normalizeBeacon(reversed, UA)!.hash).toBe(normalizeBeacon(q, UA)!.hash);
  });

  it('gives a different hash when a stable value or the UA differs', () => {
    const base = normalizeBeacon(device(), UA)!.hash;
    expect(normalizeBeacon(device({ ch: 'zzz' }), UA)!.hash).not.toBe(base);
    expect(normalizeBeacon(device({ gr: 'SwiftShader' }), UA)!.hash).not.toBe(base);
    expect(normalizeBeacon(device(), UA + ' X')!.hash).not.toBe(base);
  });

  it('ignores beacons without a valid link code or without any device attribute', () => {
    expect(normalizeBeacon(device({ c: undefined }), UA)).toBeNull();
    expect(normalizeBeacon(device({ c: '../../etc' }), UA)).toBeNull();
    expect(normalizeBeacon({ c: 'ue4f6aag', r: '123' }, UA)).toBeNull();
  });

  it('drops unknown keys, takes the first of repeated params and caps lengths', () => {
    const fp = normalizeBeacon(
      device({ evil: 'x', sw: ['412', '999'], gr: 'g'.repeat(1000) }),
      'u'.repeat(2000),
    )!;
    expect(fp.attrs).not.toHaveProperty('evil');
    expect(fp.sample).not.toHaveProperty('evil');
    expect(fp.attrs.sw).toBe('412');
    expect(fp.attrs.gr).toHaveLength(200);
    expect(fp.userAgent).toHaveLength(512);
  });
});

describe('FingerprintService.record', () => {
  function make(queryRaw: jest.Mock) {
    return new FingerprintService({ $queryRaw: queryRaw } as never);
  }

  it('reports new vs repeat from the upsert result', async () => {
    const q = jest
      .fn()
      .mockResolvedValueOnce([{ inserted: true }])
      .mockResolvedValueOnce([{ inserted: false }]);
    const svc = make(q);
    await expect(svc.record(device(), UA)).resolves.toBe('new');
    await expect(svc.record(device(), UA)).resolves.toBe('repeat');
    expect(q).toHaveBeenCalledTimes(2);
  });

  it('does not touch the DB for unusable beacons', async () => {
    const q = jest.fn();
    await expect(make(q).record({ c: 'ue4f6aag' }, UA)).resolves.toBe('ignored');
    expect(q).not.toHaveBeenCalled();
  });

  it('never throws when the DB write fails', async () => {
    const q = jest.fn().mockRejectedValue(new Error('db down'));
    await expect(make(q).record(device(), UA)).resolves.toBe('ignored');
  });
});
