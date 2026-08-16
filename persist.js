const BEST_URL = "/api/kv/nightstall:best";

export async function loadBest(fetcher = fetch) {
  try {
    const response = await fetcher(BEST_URL);
    if (!response.ok) return 0;
    const value = Number(await response.text());
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export async function saveBest(score, currentBest, fetcher = fetch) {
  const nextBest = Math.max(score, currentBest);
  if (nextBest <= currentBest) return currentBest;
  try {
    await fetcher(BEST_URL, { method: "PUT", body: String(nextBest) });
  } catch {
    // The game remains playable in static previews without the host KV API.
  }
  return nextBest;
}
