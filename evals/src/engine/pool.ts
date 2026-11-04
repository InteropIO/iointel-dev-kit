/** Runs `worker` over `items` with at most `concurrency` at once, keeping results in input order. */
export async function runPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const lanes = Math.max(1, Math.min(concurrency, items.length));
  const runners = Array.from({ length: lanes }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]!);
    }
  });
  await Promise.all(runners);
  return results;
}
