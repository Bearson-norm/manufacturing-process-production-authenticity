/**
 * Map items to promises with at most `concurrency` requests in flight.
 * Avoids net::ERR_INSUFFICIENT_RESOURCES when firing hundreds of parallel fetches.
 *
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
export async function mapLimit(items, concurrency, fn) {
  if (!items.length) return [];
  const c = Math.max(1, Math.floor(concurrency));
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    for (;;) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(c, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
