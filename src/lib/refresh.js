import {
  quoteKey,
  validateQuote,
  addSnapshot,
  positions,
} from "./portfolio.js";
export const REFRESH_MS = 15 * 60 * 1000;
export function refreshDue(lastRefresh, now = Date.now()) {
  return !lastRefresh || now - Date.parse(lastRefresh) >= REFRESH_MS;
}
export function quoteTargets(state) {
  const targets = new Map();
  for (const portfolio of ["simulated", "actual"])
    for (const currency of ["USD", "CAD", "EUR"]) {
      for (const p of positions(state, portfolio, currency))
        if (p.shares > 1e-8)
          targets.set(quoteKey(portfolio, currency, p.symbol, p.exchange), {
            portfolio,
            currency,
            symbol: p.symbol,
            exchange: p.exchange,
          });
    }
  for (const w of state.watchlist)
    targets.set(quoteKey(w.portfolio, w.currency, w.symbol, w.exchange), w);
  return [...targets.values()];
}
export async function fetchPrices(state, { signal, fetcher = fetch } = {}) {
  const groups = new Map();
  for (const t of quoteTargets(state)) {
    const id = `${t.currency}:${t.exchange}:${t.symbol}`;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(t);
  }
  const quotes = {},
    errors = [];
  // Limit concurrency to three and share quotes across portfolios/lists.
  const queue = [...groups.values()];
  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const group = queue[cursor++],
        t = group[0];
      if (signal?.aborted) return;
      try {
        const query = new URLSearchParams({
          symbol: t.symbol,
          exchange: t.exchange,
          currency: t.currency,
        });
        const response = await fetcher(`/api/quote?${query}`, { signal });
        const q = await response.json();
        if (!response.ok) throw Error(q.error || "Quote request failed");
        validateQuote(q);
        if (q.currency !== t.currency)
          throw Error("Quote currency does not match this position.");
        for (const item of group)
          quotes[
            quoteKey(item.portfolio, item.currency, item.symbol, item.exchange)
          ] = q;
      } catch (e) {
        if (e.name !== "AbortError")
          errors.push(`${t.symbol} (${t.exchange}): ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));
  return { quotes, errors };
}
export function applyPrices(state, quotes) {
  // Discard responses for stocks removed while a request was in flight.
  const activeKeys = new Set(
    quoteTargets(state).map((t) =>
      quoteKey(t.portfolio, t.currency, t.symbol, t.exchange),
    ),
  );
  const valid = Object.fromEntries(
    Object.entries(quotes).filter(
      ([k, q]) =>
        activeKeys.has(k) &&
        (!state.quotes[k] ||
          state.quotes[k].source === "Sample" ||
          Date.parse(q.asOf) >= Date.parse(state.quotes[k].asOf)),
    ),
  );
  let next = {
    ...state,
    quotes: { ...state.quotes, ...valid },
    lastRefresh: new Date().toISOString(),
  };
  const scopes = new Set(
    Object.keys(valid).map((k) => k.split(":").slice(0, 2).join(":")),
  );
  next.snapshots = next.snapshots.filter(
    (s) => !s.illustrative || !scopes.has(`${s.portfolio}:${s.currency}`),
  );
  for (const s of scopes) {
    const [portfolio, currency] = s.split(":");
    next = addSnapshot(next, portfolio, currency);
  }
  return next;
}
