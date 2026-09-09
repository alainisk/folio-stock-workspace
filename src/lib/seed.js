import { defaultMarket } from "./markets.js";
import { quoteKey, today } from "./portfolio.js";
export const catalog = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    sector: "Technology",
    price: 232.98,
    previous: 230.45,
    color: "#343b4a",
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    sector: "Technology",
    price: 178.52,
    previous: 175.21,
    color: "#72a939",
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    sector: "Technology",
    price: 512.34,
    previous: 508.9,
    color: "#468bd6",
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    sector: "Communication",
    price: 207.63,
    previous: 209.14,
    color: "#df655b",
  },
  {
    symbol: "AMZN",
    name: "Amazon.com, Inc.",
    sector: "Consumer",
    price: 229.18,
    previous: 231.4,
    color: "#dc9a36",
  },
  {
    symbol: "V",
    name: "Visa Inc.",
    sector: "Financials",
    price: 348.72,
    previous: 346.12,
    color: "#4761ae",
  },
  {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    sector: "Consumer",
    price: 332.1,
    previous: 339.55,
    color: "#c65360",
  },
  {
    symbol: "META",
    name: "Meta Platforms, Inc.",
    sector: "Communication",
    price: 738.4,
    previous: 733.12,
    color: "#4780d8",
  },
  {
    symbol: "RY.TO",
    name: "Royal Bank of Canada",
    sector: "Financials",
    color: "#3c62b1",
  },
  {
    symbol: "SHOP.TO",
    name: "Shopify Inc.",
    sector: "Technology",
    color: "#84a34c",
  },
];
export function initialState() {
  const amounts = [
    [45, 198.5],
    [80, 132.2],
    [25, 445.0],
    [30, 180.4],
    [24, 215.8],
    [15, 318.7],
  ];
  const now = new Date(),
    quotes = {};
  const transactions = catalog.slice(0, 6).map((s, i) => {
    quotes[quoteKey("simulated", "USD", s.symbol)] = {
      current: s.price,
      previous: s.previous,
      source: "Sample",
      asOf: now.toISOString(),
    };
    const d = new Date(now);
    d.setDate(d.getDate() - 100 + i * 7);
    return {
      id: `sample-${i}`,
      type: "buy",
      portfolio: "simulated",
      currency: "USD",
      symbol: s.symbol,
      exchange: defaultMarket("USD", s.symbol),
      name: s.name,
      date: d.toISOString().slice(0, 10),
      shares: amounts[i][0],
      price: amounts[i][1],
      fee: 0,
      notes: "Illustrative sample purchase. Replace with your own simulation.",
    };
  });
  const total = catalog
    .slice(0, 6)
    .reduce((a, s, i) => a + s.price * amounts[i][0], 0);
  const snapshots = Array.from({ length: 91 }, (_, i) => {
    const at = new Date(now);
    at.setDate(at.getDate() - 90 + i);
    return {
      portfolio: "simulated",
      currency: "USD",
      at: at.toISOString(),
      value:
        i === 90
          ? total
          : total *
            (0.76 +
              (0.24 * i) / 90 +
              0.018 * Math.sin(i * 0.7) +
              0.009 * Math.cos(i * 1.8)),
      illustrative: true,
    };
  });
  return {
    version: 1,
    demo: true,
    transactions,
    quotes,
    watchlist: [
      {
        id: "watch-tsla",
        portfolio: "simulated",
        currency: "USD",
        symbol: "TSLA",
        exchange: "NASDAQ",
        name: "Tesla, Inc.",
        target: 310,
        direction: "below",
      },
    ],
    snapshots,
    budgets: { USD: 100000, CAD: 100000, EUR: 100000 },
  };
}
export const STORE = "folio.workspace.v1";
