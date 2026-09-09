import {
  currencies,
  markets,
  defaultMarket,
  instrumentKey,
  marketTimezone,
} from "./markets.js";
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const marketDate = (iso, exchange) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: marketTimezone(exchange),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
export const uid = () => crypto.randomUUID();
export const quoteKey = (
  portfolio,
  currency,
  symbol,
  exchange = defaultMarket(currency, symbol),
) => `${portfolio}:${currency}:${exchange}:${symbol}`;
export const money = (n, currency = "USD", signed = false) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        signDisplay: signed ? "exceptZero" : "auto",
      }).format(n);
export const percent = (n) =>
  n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
export const quantity = (n) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(n);
export const pct = (gain, base) =>
  gain != null && base > 0 ? (gain / base) * 100 : null;
export const scopeTransactions = (state, portfolio, currency) =>
  state.transactions.filter(
    (t) => t.portfolio === portfolio && t.currency === currency,
  );
export function positions(state, portfolio, currency) {
  const ts = scopeTransactions(state, portfolio, currency);
  return [...new Set(ts.map((t) => instrumentKey(t.symbol, t.exchange)))].map(
    (key) => {
      const rows = ts.filter(
          (t) => instrumentKey(t.symbol, t.exchange) === key,
        ),
        { symbol, exchange } = rows[0],
        buys = rows.filter((t) => t.type === "buy"),
        sells = rows.filter((t) => t.type === "sell");
      const lots = buys.map((b) => ({
        ...b,
        remaining: Math.max(
          0,
          b.shares -
            sells
              .filter((s) => s.lotId === b.id)
              .reduce((a, s) => a + s.shares, 0),
        ),
      }));
      const shares = lots.reduce((a, b) => a + b.remaining, 0),
        invested = lots.reduce(
          (a, b) => a + b.remaining * (b.price + b.fee / b.shares),
          0,
        );
      const totalOutlay = buys.reduce(
        (a, b) => a + b.shares * b.price + b.fee,
        0,
      );
      const quote =
        state.quotes[quoteKey(portfolio, currency, symbol, exchange)];
      const latestBuy = rows.reduce((a, l) => (l.date > a ? l.date : a), "");
      const usable = quote && marketDate(quote.asOf, exchange) >= latestBuy;
      const value =
        shares > 1e-8 ? (usable ? shares * quote.current : null) : 0;
      const realized = sells.reduce((a, s) => {
        const b = buys.find((b) => b.id === s.lotId);
        return a + s.shares * (s.price - b.price - b.fee / b.shares) - s.fee;
      }, 0);
      const dividends = rows
        .filter((t) => t.type === "dividend")
        .reduce((a, t) => a + t.amount, 0);
      const unrealized = value === null ? null : value - invested;
      const total =
        unrealized === null ? null : unrealized + realized + dividends;
      const day = usable ? marketDate(quote.asOf, exchange) : null;
      let daily = null,
        dailyBase = null;
      if (usable) {
        daily = 0;
        dailyBase = 0;
        for (const b of lots) {
          if (b.date > day) continue;
          const priorSells = sells
            .filter((s) => s.lotId === b.id && s.date < day)
            .reduce((a, s) => a + s.shares, 0);
          const daySells = sells.filter(
            (s) => s.lotId === b.id && s.date === day,
          );
          const startShares = b.shares - priorSells;
          const baseline = b.date === day ? b.price : quote.previous;
          const remaining =
            startShares - daySells.reduce((a, s) => a + s.shares, 0);
          daily +=
            remaining * (quote.current - baseline) +
            daySells.reduce(
              (a, s) => a + s.shares * (s.price - baseline) - s.fee,
              0,
            ) -
            (b.date === day ? b.fee : 0);
          dailyBase += startShares * baseline + (b.date === day ? b.fee : 0);
        }
        daily += rows
          .filter((t) => t.type === "dividend" && t.date === day)
          .reduce((a, t) => a + t.amount, 0);
      }
      return {
        key,
        exchange,
        initialInvestment: buys.reduce((a, b) => a + b.shares * b.price, 0),
        symbol,
        name: buys[0]?.name || rows[0]?.name || symbol,
        lots,
        shares,
        invested,
        totalOutlay,
        quote: usable ? quote : null,
        value,
        realized,
        dividends,
        unrealized,
        total,
        totalPct: pct(total, totalOutlay),
        unrealizedPct: pct(unrealized, invested),
        daily,
        dailyBase,
        dailyPct: pct(daily, dailyBase),
        priceChange: usable ? quote.current - quote.previous : null,
        priceChangePct: usable
          ? pct(quote.current - quote.previous, quote.previous)
          : null,
      };
    },
  );
}
export function summary(state, portfolio, currency) {
  const ps = positions(state, portfolio, currency),
    open = ps.filter((p) => p.shares > 1e-8),
    ts = scopeTransactions(state, portfolio, currency);
  const missing = open.some((p) => p.value === null);
  const sum = (k) => ps.reduce((a, p) => a + (p[k] || 0), 0);
  const quoteDays = [
    ...new Set(
      ps
        .filter((p) => p.dailyBase > 0)
        .map((p) => marketDate(p.quote.asOf, p.exchange)),
    ),
  ];
  const needsDailyPrice = ps.some(
    (p) =>
      p.daily === null &&
      (p.shares > 1e-8 ||
        ts.some(
          (t) =>
            t.symbol === p.symbol &&
            t.exchange === p.exchange &&
            t.date === today(),
        )),
  );
  const dailyReady = !missing && !needsDailyPrice && quoteDays.length <= 1;
  const value = missing ? null : sum("value"),
    total = missing ? null : sum("total"),
    daily = dailyReady ? sum("daily") : null;
  const netSpend = ts.reduce(
    (a, t) =>
      a +
      (t.type === "buy"
        ? t.shares * t.price + t.fee
        : t.type === "sell"
          ? -(t.shares * t.price - t.fee)
          : -t.amount),
    0,
  );
  return {
    positions: ps,
    open,
    missing,
    value,
    initialInvestment: sum("initialInvestment"),
    invested: sum("invested"),
    outlay: sum("totalOutlay"),
    total,
    totalPct: pct(total, sum("totalOutlay")),
    daily,
    dailyPct: pct(daily, sum("dailyBase")),
    realized: sum("realized"),
    dividends: sum("dividends"),
    cash: (state.budgets[currency] || 100000) - netSpend,
    quoteDay: quoteDays.length === 1 ? quoteDays[0] : null,
    mixedDays: quoteDays.length > 1,
  };
}
export function validateTransaction(t, state) {
  if (
    !["buy", "sell", "dividend"].includes(t.type) ||
    !["simulated", "actual"].includes(t.portfolio) ||
    !currencies.includes(t.currency) ||
    !markets.some((m) => m.code === t.exchange)
  )
    throw Error("Invalid transaction type, portfolio, or currency.");
  if (
    typeof t.notes !== "undefined" &&
    (typeof t.notes !== "string" || t.notes.length > 2000)
  )
    throw Error("Invalid transaction notes.");
  if (
    !/^[A-Z0-9.^-]{1,20}$/.test(t.symbol) ||
    typeof t.name !== "string" ||
    !t.name.trim() ||
    t.name.length > 120
  )
    throw Error("Enter a valid symbol and company name.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(t.date) ||
    Number.isNaN(Date.parse(t.date)) ||
    new Date(t.date).toISOString().slice(0, 10) !== t.date ||
    t.date > today()
  )
    throw Error("Enter a valid date that is not in the future.");
  if (t.type === "dividend") {
    if (!Number.isFinite(t.amount) || t.amount <= 0)
      throw Error("Dividend amount must be greater than zero.");
  } else {
    if (
      !Number.isFinite(t.shares) ||
      t.shares <= 0 ||
      t.shares > 1e12 ||
      !Number.isFinite(t.price) ||
      t.price <= 0 ||
      t.price > 1e12 ||
      !Number.isFinite(t.fee) ||
      t.fee < 0 ||
      t.fee > 1e12
    )
      throw Error(
        "Shares and price must be positive; fees cannot be negative.",
      );
    if (t.type === "sell") {
      const b = state.transactions.find(
        (b) =>
          b.id === t.lotId &&
          b.type === "buy" &&
          b.portfolio === t.portfolio &&
          b.currency === t.currency &&
          b.symbol === t.symbol &&
          b.exchange === t.exchange,
      );
      if (!b || t.date < b.date)
        throw Error(
          "Choose a purchase lot and a sale date on or after its purchase.",
        );
      const sold = state.transactions
        .filter((s) => s.type === "sell" && s.lotId === b.id)
        .reduce((a, s) => a + s.shares, 0);
      if (t.shares > b.shares - sold + 1e-8)
        throw Error("The sale exceeds the shares remaining in this lot.");
    }
  }
}
export function validateQuote(q) {
  if (
    !q ||
    !Number.isFinite(q.current) ||
    q.current <= 0 ||
    !Number.isFinite(q.previous) ||
    q.previous <= 0 ||
    !q.asOf ||
    !Number.isFinite(Date.parse(q.asOf)) ||
    Date.parse(q.asOf) > Date.now() + 60000 ||
    !["Manual", "Finnhub", "Sample", "Yahoo Finance"].includes(q.source)
  )
    throw Error(
      "Prices must be positive and the quote timestamp must be valid and not in the future.",
    );
}
export function validateBackup(s) {
  if (
    !s ||
    s.version !== 1 ||
    !Array.isArray(s.transactions) ||
    !s.quotes ||
    typeof s.quotes !== "object" ||
    !Array.isArray(s.watchlist) ||
    !Array.isArray(s.snapshots) ||
    !s.budgets ||
    typeof s.demo !== "boolean"
  )
    throw Error("This is not a valid Folio backup.");
  if (
    s.transactions.length > 50000 ||
    s.watchlist.length > 10000 ||
    s.snapshots.length > 50000
  )
    throw Error("This backup is too large.");
  if (
    !currencies.every((c) => Number.isFinite(s.budgets[c]) && s.budgets[c] > 0)
  )
    throw Error("Invalid simulation budget.");
  const checked = { transactions: [] };
  const ids = new Set();
  for (const t of s.transactions) {
    if (typeof t.id !== "string" || ids.has(t.id))
      throw Error("Duplicate or missing transaction ID.");
    validateTransaction(t, checked);
    checked.transactions.push(t);
    ids.add(t.id);
  }
  for (const [key, q] of Object.entries(s.quotes)) {
    if (
      !/^(simulated|actual):(USD|CAD|EUR):[A-Z0-9]{2,12}:[A-Z0-9.^-]{1,20}$/.test(
        key,
      )
    )
      throw Error("Invalid quote key.");
    validateQuote(q);
  }
  for (const w of s.watchlist) {
    if (
      typeof w.id !== "string" ||
      !["simulated", "actual"].includes(w.portfolio) ||
      !currencies.includes(w.currency) ||
      !markets.some((m) => m.code === w.exchange) ||
      !["above", "below"].includes(w.direction) ||
      typeof w.name !== "string" ||
      !w.name.trim() ||
      w.name.length > 120 ||
      !/^[A-Z0-9.^-]{1,20}$/.test(w.symbol) ||
      (w.target !== null && (!Number.isFinite(w.target) || w.target <= 0))
    )
      throw Error("Invalid watchlist entry.");
  }
  for (const p of s.snapshots) {
    if (
      !["simulated", "actual"].includes(p.portfolio) ||
      !currencies.includes(p.currency) ||
      !Number.isFinite(p.value) ||
      p.value < 0 ||
      !Number.isFinite(Date.parse(p.at)) ||
      typeof p.illustrative !== "boolean"
    )
      throw Error("Invalid performance snapshot.");
  }
  if (s.watchlists !== undefined) {
    if (
      !Array.isArray(s.watchlists) ||
      !s.watchlists.length ||
      s.watchlists.length > 100
    )
      throw Error("Invalid watchlists.");
    const ids = new Set();
    for (const l of s.watchlists) {
      if (
        typeof l.id !== "string" ||
        ids.has(l.id) ||
        typeof l.name !== "string" ||
        !l.name.trim() ||
        l.name.length > 60
      )
        throw Error("Invalid watchlist name or ID.");
      ids.add(l.id);
    }
    for (const w of s.watchlist) {
      if (!ids.has(w.listId)) throw Error("Watchlist group is missing.");
      if (
        !Number.isFinite(w.referenceShares) ||
        w.referenceShares <= 0 ||
        (w.referencePrice !== null &&
          (!Number.isFinite(w.referencePrice) || w.referencePrice <= 0))
      )
        throw Error("Invalid watchlist reference position.");
    }
  }
  if (s.stockNotes !== undefined) {
    if (
      !s.stockNotes ||
      typeof s.stockNotes !== "object" ||
      Array.isArray(s.stockNotes)
    )
      throw Error("Invalid stock notes.");
    for (const [k, v] of Object.entries(s.stockNotes)) {
      if (
        !/^(simulated|actual):(USD|CAD|EUR):[A-Z0-9]{2,12}:[A-Z0-9.^-]{1,20}$/.test(
          k,
        ) ||
        typeof v !== "string" ||
        v.length > 50000
      )
        throw Error("Invalid stock notes.");
    }
  }
  if (s.autoRefresh !== undefined && typeof s.autoRefresh !== "boolean")
    throw Error("Invalid refresh setting.");
  return s;
}
export function addSnapshot(s, portfolio, currency) {
  const m = summary(s, portfolio, currency);
  if (m.value === null) return s;
  const at = new Date().toISOString();
  return {
    ...s,
    snapshots: [
      ...s.snapshots.filter(
        (p) =>
          !(
            p.portfolio === portfolio &&
            p.currency === currency &&
            p.at.slice(0, 16) === at.slice(0, 16)
          ),
      ),
      { portfolio, currency, at, value: m.value, illustrative: false },
    ].slice(-5000),
  };
}
export function csv(rows) {
  const cell = (v) => {
    let x = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(x) && typeof v !== "number") x = "'" + x;
    return '"' + x.replaceAll('"', '""') + '"';
  };
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
export function download(name, body, type = "application/json") {
  const u = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
