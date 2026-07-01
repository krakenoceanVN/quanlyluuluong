export function naturalCompare(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g;
  const at = a.match(re) ?? [];
  const bt = b.match(re) ?? [];
  const len = Math.min(at.length, bt.length);
  for (let i = 0; i < len; i++) {
    const av = at[i];
    const bv = bt[i];
    const an = /^\d/.test(av);
    const bn = /^\d/.test(bv);
    if (an && bn) {
      const diff = Number(av) - Number(bv);
      if (diff) return diff;
    } else if (av !== bv) {
      return av < bv ? -1 : 1;
    }
  }
  return at.length - bt.length;
}

export function sortByCode<T>(
  rows: readonly T[],
  key: keyof T,
  dir: 'asc' | 'desc' = 'asc',
): T[] {
  const sign = dir === 'asc' ? 1 : -1;
  return rows
    .slice()
    .sort((a, b) => sign * naturalCompare(String(a[key] ?? ''), String(b[key] ?? '')));
}
