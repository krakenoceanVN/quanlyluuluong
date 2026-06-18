/** Centralised Redis key builders so engine + admin stay in sync. */

/** Daily flow counter for a link-ad membership. e.g. flow:<linkAdId>:2026-06-13 */
export const flowKey = (linkAdId: string, date: string) => `flow:${linkAdId}:${date}`;

/** Cached, ready-to-serve config for a link (by shortCode). */
export const linkConfigKey = (shortCode: string) => `link:cfg:${shortCode}`;

/** Set of linkAdIds with un-synced counter increments (worker drains this). */
export const dirtyFlowSet = () => `flow:dirty`;

/** yyyy-mm-dd in UTC for "today". */
export function todayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
