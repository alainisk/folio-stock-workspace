import { positions, quoteKey, pct } from "./portfolio.js";
import { instrumentKey } from "./markets.js";
export function watchPositions(state, portfolio, currency, listId) {
  const owned = positions(state, portfolio, currency);
  return state.watchlist
    .filter(
      (w) =>
        w.portfolio === portfolio &&
        w.currency === currency &&
        w.listId === listId,
    )
    .map((w) => {
      const key = instrumentKey(w.symbol, w.exchange),
        holding = owned.find((p) => p.key === key && p.shares > 1e-8),
        quote =
          state.quotes[quoteKey(portfolio, currency, w.symbol, w.exchange)];
      if (holding)
        return {
          ...holding,
          watchId: w.id,
          watchOnly: false,
          target: w.target,
          direction: w.direction,
        };
      const shares = w.referenceShares || 1,
        basis = w.referencePrice,
        initial = basis ? shares * basis : null,
        value = quote ? shares * quote.current : null,
        total = value !== null && initial !== null ? value - initial : null,
        daily = quote ? shares * (quote.current - quote.previous) : null;
      return {
        key,
        symbol: w.symbol,
        name: w.name,
        exchange: w.exchange,
        watchId: w.id,
        watchOnly: true,
        target: w.target,
        direction: w.direction,
        shares,
        quote,
        lots: basis
          ? [
              {
                id: w.id,
                date: w.referenceDate || "—",
                shares,
                remaining: shares,
                price: basis,
                fee: 0,
              },
            ]
          : [],
        initialInvestment: initial,
        invested: initial,
        totalOutlay: initial,
        value,
        total,
        totalPct: pct(total, initial),
        unrealized: total,
        unrealizedPct: pct(total, initial),
        realized: 0,
        dividends: 0,
        daily,
        dailyPct: quote
          ? pct(quote.current - quote.previous, quote.previous)
          : null,
        priceChange: quote ? quote.current - quote.previous : null,
        priceChangePct: quote
          ? pct(quote.current - quote.previous, quote.previous)
          : null,
      };
    });
}
