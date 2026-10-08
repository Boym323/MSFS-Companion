export function reconnectDelay(failures: number): number {
  const safe = Number.isFinite(failures) ? Math.max(0, Math.min(Math.floor(failures), 5)) : 0;
  return Math.min(15000, 1500 * 2 ** safe);
}