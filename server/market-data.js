import { markets } from "../src/lib/markets.js";
export const PERIODS = {
  "1D": { range: "1d", interval: "1m" },
  "1W": { range: "5d", interval: "5m" },
  "1M": { range: "1mo", interval: "30m" },
  "3M": { range: "3mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1d" },
  "1Y": { range: "1y", interval: "1d" },
  "3Y": { range: "5y", interval: "1wk", years: 3 },
  "5Y": { range: "5y", interval: "1wk" },
  "10Y": { range: "10y", interval: "1mo" },
  ALL: { range: "max", interval: "1mo" },
};
const suffixes = {
  TSX: ".TO",
  TSXV: ".V",
  CSE: ".CN",
  XETRA: ".DE",
  EPA: ".PA",
  AMS: ".AS",
  EBR: ".BR",
  ELI: ".LS",
  MIL: ".MI",
  BME: ".MC",
  HEL: ".HE",
};
export function providerSymbol(symbol, exchange) {
  if (
    !/^[A-Z0-9.^-]{1,20}$/.test(symbol) ||
    !markets.some((m) => m.code === exchange)
  )
    throw Error("Invalid stock symbol or exchange.");
  const suffix = suffixes[exchange];
  if (suffix) {
    const known = Object.values(suffixes).find((s) => symbol.endsWith(s));
    if (known && known !== suffix)
      throw Error("The ticker suffix does not match the selected exchange.");
    return symbol.endsWith(suffix) ? symbol : symbol + suffix;
  }
  return symbol.replace(/\.([A-Z])$/, "-$1");
}
const cache = new Map(),
  pending = new Map();
export async function chart(
  symbol,
  exchange,
  currency,
  period = "1D",
  fetcher = fetch,
) {
  const config = PERIODS[period];
  if (!config) throw Error("Unsupported chart period.");
  const ticker = providerSymbol(symbol, exchange),
    key = `${ticker}:${currency}:${period}`;
  const saved = cache.get(key);
  if (saved && Date.now() - saved.at < 60000) return saved.data;
  if (pending.has(key)) return pending.get(key);
  const promise = (async () => {
    const query = new URLSearchParams({
      interval: config.interval,
      range: config.range,
      includePrePost: "false",
    });
    const response = await fetcher(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?${query}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Folio local portfolio)",
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!response.ok)
      throw Error(
        response.status === 429
          ? "Yahoo Finance rate limit. Your last saved prices are retained."
          : "Market data is temporarily unavailable.",
      );
    const json = await response.json(),
      r = json.chart?.result?.[0];
    if (!r || json.chart?.error)
      throw Error(
        "No market data found for this symbol on the selected exchange.",
      );
    const meta = r.meta;
    if (meta.currency !== currency)
      throw Error(
        `This listing is quoted in ${meta.currency}, not ${currency}. Select the matching listing and currency; no FX conversion is applied.`,
      );
    const allowedExchanges = {
      NASDAQ: ["NMS", "NGM", "NCM", "NAS"],
      NYSE: ["NYQ"],
      NYSEARCA: ["PCX"],
      OTC: ["PNK", "OQB", "OQX", "OQM"],
      TSX: ["TOR"],
      TSXV: ["VAN"],
      CSE: ["CNQ"],
      XETRA: ["GER"],
      EPA: ["PAR"],
      AMS: ["AMS"],
      EBR: ["BRU"],
      ELI: ["LIS"],
      MIL: ["MIL"],
      BME: ["MCE"],
      HEL: ["HEL"],
    };
    if (
      allowedExchanges[exchange] &&
      !allowedExchanges[exchange].includes(meta.exchangeName)
    )
      throw Error(
        `Provider resolved ${meta.fullExchangeName || meta.exchangeName}, not ${exchange}. Check the listing before updating its price.`,
      );
    const cutoff = config.years
      ? Date.now() - config.years * 365.25 * 86400000
      : 0;
    const points = (r.timestamp || [])
      .map((t, i) => ({
        at: new Date(t * 1000).toISOString(),
        value: r.indicators?.quote?.[0]?.close?.[i],
      }))
      .filter(
        (p) =>
          Number.isFinite(p.value) && p.value > 0 && Date.parse(p.at) >= cutoff,
      );
    const data = {
      symbol,
      exchange,
      providerSymbol: ticker,
      currency,
      source: "Yahoo Finance",
      asOf: new Date(meta.regularMarketTime * 1000).toISOString(),
      current: meta.regularMarketPrice,
      previous: meta.previousClose ?? meta.chartPreviousClose,
      name: meta.longName || meta.shortName || symbol,
      points,
      period,
      interval: config.interval,
      fetchedAt: new Date().toISOString(),
      exchangeName: meta.fullExchangeName,
    };
    if (
      !Number.isFinite(data.current) ||
      data.current <= 0 ||
      !Number.isFinite(data.previous) ||
      data.previous <= 0
    )
      throw Error("The provider did not return usable prices.");
    cache.set(key, { at: Date.now(), data });
    if (cache.size > 1000) cache.delete(cache.keys().next().value);
    return data;
  })();
  pending.set(key, promise);
  try {
    return await promise;
  } finally {
    pending.delete(key);
  }
}
