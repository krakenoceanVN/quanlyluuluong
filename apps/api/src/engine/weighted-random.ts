export interface Weighted {
  id: string;
  weight: number;
}

/**
 * Pick one candidate by weighted random.
 * - Weights <= 0 are treated as 0.
 * - If every weight is 0 (but candidates exist), falls back to a uniform pick.
 * - Returns null only when there are no candidates.
 *
 * @param rng injectable RNG in [0,1) for deterministic tests.
 */
export function pickWeighted<T extends Weighted>(
  candidates: T[],
  rng: () => number = Math.random,
): T | null {
  if (candidates.length === 0) return null;

  const weights = candidates.map((c) => (c.weight > 0 ? c.weight : 0));
  const total = weights.reduce((s, w) => s + w, 0);

  if (total <= 0) {
    // all weights zero → uniform
    return candidates[Math.floor(rng() * candidates.length)] ?? candidates[candidates.length - 1];
  }

  let r = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r < 0) return candidates[i];
  }
  // floating-point guard
  return candidates[candidates.length - 1];
}
