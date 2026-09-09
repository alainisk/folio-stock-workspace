export const currencies = ["USD", "CAD", "EUR"];
export const markets = [
  { code: "NASDAQ", name: "NASDAQ · United States", currency: "USD" },
  { code: "NYSE", name: "NYSE · United States", currency: "USD" },
  { code: "NYSEARCA", name: "NYSE Arca · United States", currency: "USD" },
  { code: "OTC", name: "OTC · United States", currency: "USD" },
  { code: "TSX", name: "Toronto Stock Exchange · Canada", currency: "CAD" },
  { code: "TSXV", name: "TSX Venture · Canada", currency: "CAD" },
  {
    code: "CSE",
    name: "Canadian Securities Exchange · Canada",
    currency: "CAD",
  },
  { code: "XETRA", name: "Xetra · Germany", currency: "EUR" },
  { code: "EPA", name: "Euronext Paris · France", currency: "EUR" },
  { code: "AMS", name: "Euronext Amsterdam · Netherlands", currency: "EUR" },
  { code: "EBR", name: "Euronext Brussels · Belgium", currency: "EUR" },
  { code: "ELI", name: "Euronext Lisbon · Portugal", currency: "EUR" },
  { code: "MIL", name: "Borsa Italiana · Italy", currency: "EUR" },
  { code: "BME", name: "Madrid Stock Exchange · Spain", currency: "EUR" },
  { code: "HEL", name: "Nasdaq Helsinki · Finland", currency: "EUR" },
];
export const defaultMarket = (currency, symbol = "") =>
  currency === "CAD"
    ? "TSX"
    : currency === "EUR"
      ? "XETRA"
      : symbol === "V"
        ? "NYSE"
        : "NASDAQ";
export const instrumentKey = (symbol, exchange) => `${exchange}|${symbol}`;
export const parseInstrument = (key) => {
  const [exchange, symbol] = key.split("|");
  return { exchange, symbol };
};
export const marketName = (code) =>
  markets.find((m) => m.code === code)?.name || code;
export function migrate(s) {
  if (!s || s.version !== 1) return s;
  const next = {
    ...s,
    budgets: { ...s.budgets, EUR: s.budgets?.EUR ?? 100000 },
    transactions: s.transactions?.map((t) => ({
      ...t,
      exchange: t.exchange || defaultMarket(t.currency, t.symbol),
    })),
    watchlist: s.watchlist?.map((w) => ({
      ...w,
      exchange: w.exchange || defaultMarket(w.currency, w.symbol),
    })),
    quotes: {},
  };
  for (const [k, q] of Object.entries(s.quotes || {})) {
    const parts = k.split(":");
    if (parts.length === 3) {
      const [p, c, symbol] = parts;
      next.quotes[`${p}:${c}:${defaultMarket(c, symbol)}:${symbol}`] = q;
    } else next.quotes[k] = q;
  }
  return next;
}
export const marketTimezone = (exchange) =>
  ({
    XETRA: "Europe/Berlin",
    EPA: "Europe/Paris",
    AMS: "Europe/Amsterdam",
    EBR: "Europe/Brussels",
    ELI: "Europe/Lisbon",
    MIL: "Europe/Rome",
    BME: "Europe/Madrid",
    HEL: "Europe/Helsinki",
    TSX: "America/Toronto",
    TSXV: "America/Toronto",
    CSE: "America/Toronto",
  })[exchange] || "America/New_York";
