import test from "node:test";
import assert from "node:assert/strict";
import {
  upgradeWorkspace,
  createMembers,
  emptyWorkspace,
  validateMembers,
} from "../src/lib/workspaces.js";
import { initialState } from "../src/lib/seed.js";
import {
  REFRESH_MS,
  refreshDue,
  fetchPrices,
  applyPrices,
} from "../src/lib/refresh.js";
import { quoteKey, validateBackup } from "../src/lib/portfolio.js";
import { providerSymbol, chart, PERIODS } from "../server/market-data.js";
import { watchPositions } from "../src/lib/watchlists.js";
test("15-minute refresh threshold is exact", () => {
  const now = Date.now();
  assert.equal(REFRESH_MS, 900000);
  assert.equal(refreshDue(new Date(now - 899999).toISOString(), now), false);
  assert.equal(refreshDue(new Date(now - 900000).toISOString(), now), true);
});
test("workspace migration preserves original trades and adds named watchlists", () => {
  const s = initialState(),
    u = upgradeWorkspace(s);
  assert.deepEqual(u.transactions, s.transactions);
  assert.deepEqual(
    u.watchlists.map((l) => l.name),
    ["General", "Too Late", "Too Early", "Now"],
  );
  assert.equal(u.watchlist[0].listId, "general");
  assert.doesNotThrow(() => validateBackup(u));
});
test("members own independent arrays, notes, budgets and watchlists", () => {
  const a = emptyWorkspace(),
    b = emptyWorkspace();
  a.stockNotes["simulated:USD:NASDAQ:AAPL"] = "<p>private idea</p>";
  a.watchlists.push({ id: "a", name: "Only A" });
  assert.deepEqual(b.stockNotes, {});
  assert.equal(b.watchlists.length, 4);
  const m = createMembers();
  m.members.push({ id: "two", name: "Second", workspace: b });
  assert.doesNotThrow(() => validateMembers(m));
});
test("all ten chart periods are supported", () =>
  assert.deepEqual(Object.keys(PERIODS), [
    "1D",
    "1W",
    "1M",
    "3M",
    "6M",
    "1Y",
    "3Y",
    "5Y",
    "10Y",
    "ALL",
  ]));
test("provider symbols match local exchange and reject mismatched suffixes", () => {
  assert.equal(providerSymbol("RY", "TSX"), "RY.TO");
  assert.equal(providerSymbol("SAP", "XETRA"), "SAP.DE");
  assert.equal(providerSymbol("MC", "EPA"), "MC.PA");
  assert.throws(() => providerSymbol("RY.TO", "XETRA"));
});
test("watchlist reference returns are hypothetical and never create transactions", () => {
  const s = emptyWorkspace();
  s.watchlist.push({
    id: "w",
    symbol: "SAP",
    exchange: "XETRA",
    currency: "EUR",
    portfolio: "actual",
    listId: "now",
    name: "SAP SE",
    referenceShares: 10,
    referencePrice: 100,
    referenceDate: "2026-01-01",
    target: null,
    direction: "below",
  });
  s.quotes[quoteKey("actual", "EUR", "SAP", "XETRA")] = {
    current: 120,
    previous: 110,
    asOf: new Date().toISOString(),
    source: "Yahoo Finance",
  };
  const p = watchPositions(s, "actual", "EUR", "now")[0];
  assert.equal(p.watchOnly, true);
  assert.equal(p.initialInvestment, 1000);
  assert.equal(p.total, 200);
  assert.equal(p.daily, 100);
  assert.equal(s.transactions.length, 0);
});
test("automatic refresh deduplicates instruments and isolates failed quotes", async () => {
  const s = emptyWorkspace();
  s.watchlist = [
    {
      id: "w1",
      symbol: "AAPL",
      exchange: "NASDAQ",
      currency: "USD",
      portfolio: "actual",
      listId: "now",
    },
    {
      id: "w2",
      symbol: "AAPL",
      exchange: "NASDAQ",
      currency: "USD",
      portfolio: "simulated",
      listId: "general",
    },
    {
      id: "w3",
      symbol: "FAIL",
      exchange: "NASDAQ",
      currency: "USD",
      portfolio: "actual",
      listId: "general",
    },
  ];
  let calls = 0;
  const fetcher = async (url) => {
    calls++;
    return {
      ok: !url.includes("FAIL"),
      json: async () =>
        url.includes("FAIL")
          ? { error: "unavailable" }
          : {
              current: 120,
              previous: 110,
              asOf: new Date().toISOString(),
              source: "Yahoo Finance",
              currency: "USD",
            },
    };
  };
  const r = await fetchPrices(s, { fetcher });
  assert.equal(calls, 2);
  assert.equal(Object.keys(r.quotes).length, 2);
  assert.equal(r.errors.length, 1);
});
test("late refresh results never resurrect a removed stock", () => {
  const s = emptyWorkspace(),
    next = applyPrices(s, {
      [quoteKey("actual", "USD", "AAPL", "NASDAQ")]: {
        current: 200,
        previous: 190,
        asOf: new Date().toISOString(),
        source: "Yahoo Finance",
      },
    });
  assert.deepEqual(next.quotes, {});
});
test("market data rejects wrong currency before using web prices", async () => {
  const fake = async () => ({
    ok: true,
    json: async () => ({ chart: { result: [{ meta: { currency: "USD" } }] } }),
  });
  await assert.rejects(
    () => chart("UNIQUE", "NASDAQ", "EUR", "1D", fake),
    /quoted in USD, not EUR/,
  );
});
test("market data rejects a different exchange", async () => {
  const fake = async () => ({
    ok: true,
    json: async () => ({
      chart: {
        result: [
          {
            meta: {
              currency: "USD",
              exchangeName: "NYQ",
              fullExchangeName: "NYSE",
            },
          },
        ],
      },
    }),
  });
  await assert.rejects(
    () => chart("DIFFERENT", "NASDAQ", "USD", "1D", fake),
    /not NASDAQ/,
  );
});

test("web refresh replaces illustrative history without a false market jump", () => {
  const s = upgradeWorkspace(initialState());
  const key = quoteKey("simulated", "USD", "AAPL", "NASDAQ");
  const result = applyPrices(s, {
    [key]: { ...s.quotes[key], source: "Yahoo Finance" },
  });
  assert.ok(s.snapshots.some((p) => p.illustrative));
  assert.ok(
    !result.snapshots.some(
      (p) =>
        p.illustrative && p.portfolio === "simulated" && p.currency === "USD",
    ),
  );
  assert.ok(result.snapshots.some((p) => !p.illustrative));
});
