import { pickWeighted } from './weighted-random';

describe('pickWeighted', () => {
  it('returns null for no candidates', () => {
    expect(pickWeighted([])).toBeNull();
  });

  it('always returns the only candidate', () => {
    const only = { id: 'a', weight: 7 };
    for (let i = 0; i < 100; i++) expect(pickWeighted([only], Math.random)).toBe(only);
  });

  it('distributes approximately proportional to weights over 10,000 samples', () => {
    const candidates = [
      { id: 'a', weight: 70 },
      { id: 'b', weight: 20 },
      { id: 'c', weight: 10 },
    ];
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    const N = 10000;
    for (let i = 0; i < N; i++) {
      const chosen = pickWeighted(candidates)!;
      counts[chosen.id]++;
    }
    expect(counts.a / N).toBeCloseTo(0.7, 1);
    expect(counts.b / N).toBeCloseTo(0.2, 1);
    expect(counts.c / N).toBeCloseTo(0.1, 1);
  });

  it('honours a deterministic RNG', () => {
    const candidates = [
      { id: 'a', weight: 50 },
      { id: 'b', weight: 50 },
    ];
    // total = 100; r = 0.25*100 = 25 → first bucket
    expect(pickWeighted(candidates, () => 0.25)!.id).toBe('a');
    // r = 0.75*100 = 75 → second bucket
    expect(pickWeighted(candidates, () => 0.75)!.id).toBe('b');
  });

  it('treats non-positive weights as zero and uniformly picks when all are zero', () => {
    const candidates = [
      { id: 'a', weight: 0 },
      { id: 'b', weight: -5 },
    ];
    const chosen = pickWeighted(candidates, () => 0.4)!;
    expect(['a', 'b']).toContain(chosen.id);
  });
});
