export const PILOT_UA =
  "NextTransactionPilot/1.0 (+western sydney industrial research; public sources only)";

export async function fetchText(
  url: string,
  accept = "text/html,application/xhtml+xml"
): Promise<string> {
  const headers = { "User-Agent": PILOT_UA, Accept: accept };
  const res = await fetch(url, { headers, cache: "no-store" });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1500));
    const retry = await fetch(url, { headers, cache: "no-store" });
    if (!retry.ok) throw new Error(`HTTP ${retry.status} for ${url}`);
    return retry.text();
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

export async function fetchJson<T>(url: string): Promise<T> {
  const text = await fetchText(url, "application/json");
  return JSON.parse(text) as T;
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
