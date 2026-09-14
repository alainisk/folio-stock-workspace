import { PERIOD_DAYS } from "../lib/periods";
import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Search, ArrowUpRight, ChevronRight, Plus } from "lucide-react";
import {
  money,
  percent,
  quantity,
  marketDate,
  quoteKey,
} from "../lib/portfolio";
import { Metric, Return, Company, Empty } from "./Primitives";
const colors = [
  "#6255df",
  "#8a7bec",
  "#b0a5f4",
  "#d2caf9",
  "#a5b4db",
  "#dbe2ef",
];
export function Metrics({ metrics: m, currency }) {
  return (
    <div className="metrics">
      <Metric
        label="Portfolio value"
        value={money(m.value, currency)}
        hint={`${m.open.length} open positions · ${currency}`}
      />
      <Metric
        label="Initial investment"
        value={money(m.initialInvestment, currency)}
        hint="Shares × purchase price · before fees"
      />
      <Metric
        label="Today's return"
        value={money(m.daily, currency, true)}
        change={percent(m.dailyPct)}
        hint={
          m.quoteDay ? `Session · ${m.quoteDay}` : "Awaiting consistent prices"
        }
        positive={m.daily == null ? undefined : m.daily >= 0}
      />
      <Metric
        label="Total return"
        value={money(m.total, currency, true)}
        change={percent(m.totalPct)}
        hint="Includes realized gains & dividends"
        positive={m.total == null ? undefined : m.total >= 0}
      />
    </div>
  );
}
export function Charts({ state, portfolio, currency, metrics: m }) {
  const [range, setRange] = useState("3M");
  const days = PERIOD_DAYS;
  const cutoff = Date.now() - days[range] * 86400000;
  const data = state.snapshots
    .filter(
      (s) =>
        s.portfolio === portfolio &&
        s.currency === currency &&
        Date.parse(s.at) >= cutoff,
    )
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const allocation = m.open
    .filter((p) => p.value !== null)
    .sort((a, b) => b.value - a.value);
  return (
    <div className="charts">
      <section className="panel performance">
        <div className="panel-head">
          <div>
            <h2>Portfolio performance</h2>
            <p>
              {data.some((p) => p.illustrative)
                ? "Illustrative history · sample portfolio"
                : "Recorded portfolio value · includes purchases & sales"}
            </p>
          </div>
          <div className="range" aria-label="Chart period">
            {Object.keys(days).map((r) => (
              <button
                key={r}
                className={range === r ? "active" : ""}
                aria-pressed={range === r}
                onClick={() => setRange(r)}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="area-chart">
          {data.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data}
                margin={{ top: 20, right: 12, left: -8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6255df" stopOpacity={0.19} />
                    <stop
                      offset="95%"
                      stopColor="#6255df"
                      stopOpacity={0.015}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="at"
                  minTickGap={64}
                  tickFormatter={(v) =>
                    range === "1D"
                      ? new Date(v).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : new Date(v).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                  }
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  dy={8}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  width={58}
                />
                <Tooltip
                  contentStyle={{
                    border: "1px solid var(--border)",
                    background: "var(--theme-surface, #fff)",
                    color: "var(--theme-text, #161a38)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  formatter={(v) => [money(v, currency), "Portfolio value"]}
                  labelFormatter={(v) => new Date(v).toLocaleString()}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#6255df"
                  strokeWidth={2.5}
                  fill="url(#areaFill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Empty
              title={
                data.length
                  ? "Your first snapshot is saved"
                  : "Your story starts here"
              }
              text="Update prices over time to build your portfolio chart. Historical returns are never invented."
            />
          )}
        </div>
      </section>
      <section className="panel allocation">
        <div className="panel-head">
          <div>
            <h2>Allocation</h2>
            <p>By current market value</p>
          </div>
          <ArrowUpRight size={17} className="muted" />
        </div>
        {allocation.length ? (
          <>
            <div className="donut-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocation}
                    dataKey="value"
                    innerRadius={54}
                    outerRadius={70}
                    paddingAngle={3}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {allocation.map((p, i) => (
                      <Cell key={p.key} fill={colors[i % colors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => money(v, currency)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <span>{m.open.length}</span>
                <small>positions</small>
              </div>
            </div>
            <div className="legend">
              {allocation.slice(0, 6).map((p, i) => (
                <div key={p.key}>
                  <i style={{ background: colors[i % colors.length] }} />
                  <span>
                    {p.symbol} <small>{p.exchange}</small>
                  </span>
                  <strong>
                    {(
                      (p.value / allocation.reduce((a, p) => a + p.value, 0)) *
                      100
                    ).toFixed(1)}
                    %
                  </strong>
                </div>
              ))}
            </div>
            {m.missing && (
              <p className="caption">Unpriced positions excluded.</p>
            )}
          </>
        ) : (
          <Empty
            title="Room to grow"
            text="Add your first position to see your allocation."
          />
        )}
      </section>
    </div>
  );
}
export function Holdings({
  positions,
  currency,
  onDetail,
  onAdd,
  expanded = false,
  title = "Holdings",
  isWatchlist = false,
  notes = {},
  showNotes = true,
  portfolio = "simulated",
  onNotes,
  rowActions,
}) {
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("value"),
    [filter, setFilter] = useState("all");
  const rows = positions
    .filter((p) => p.shares > 1e-8)
    .filter((p) =>
      `${p.symbol} ${p.name}`.toLowerCase().includes(query.toLowerCase()),
    )
    .filter(
      (p) =>
        filter === "all" || (filter === "gainers" ? p.total > 0 : p.total < 0),
    )
    .sort((a, b) =>
      sort === "symbol"
        ? a.symbol.localeCompare(b.symbol)
        : (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity),
    );
  return (
    <section className="panel holdings">
      <div className="panel-head holdings-head">
        <div className="inline">
          <h2>{title}</h2>
          <span className="count">
            {positions.filter((p) => p.shares > 1e-8).length} positions
          </span>
        </div>
        <div className="table-tools">
          <label className="search">
            <Search size={15} />
            <input
              aria-label={isWatchlist ? "Search watchlist" : "Search holdings"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                isWatchlist ? "Search watchlist..." : "Search holdings..."
              }
            />
          </label>
          <select
            aria-label={isWatchlist ? "Filter watchlist" : "Filter holdings"}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All positions</option>
            <option value="gainers">Gainers</option>
            <option value="losers">Losers</option>
          </select>
          <select
            aria-label={isWatchlist ? "Sort watchlist" : "Sort holdings"}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="value">Sort: Value</option>
            <option value="total">Sort: Return</option>
            <option value="symbol">Sort: Symbol</option>
          </select>
        </div>
      </div>
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Company / market</th>
                {expanded && (
                  <th>
                    {isWatchlist ? "Purchase / reference date" : "Purchased"}
                  </th>
                )}
                <th>{isWatchlist ? "Shares / tracked" : "Shares"}</th>
                <th>
                  {isWatchlist ? "Purchase / reference" : "Avg. purchase"}
                </th>
                <th>Initial investment</th>
                <th>Current price</th>
                {expanded && <th>Stock day change</th>}
                <th>Today's return</th>
                <th>Total return</th>
                <th>Value</th>
                {showNotes && <th>Notes</th>}
                {isWatchlist && <th>Alert / actions</th>}
                <th>
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.key} onClick={() => onDetail(p)}>
                  <td>
                    <button
                      className="company-button"
                      aria-label={`View ${p.symbol} ${p.exchange} details`}
                    >
                      <Company
                        symbol={p.symbol}
                        name={p.name}
                        exchange={p.exchange}
                      />
                    </button>
                  </td>
                  {expanded && (
                    <td>
                      {p.lots.length === 0
                        ? "—"
                        : p.lots.length === 1
                          ? p.lots[0].date
                          : `${p.lots.length} purchase lots`}
                    </td>
                  )}
                  <td>{quantity(p.shares)}</td>
                  <td>
                    {money(
                      p.invested == null ? null : p.invested / p.shares,
                      currency,
                    )}
                  </td>
                  <td>{money(p.initialInvestment, currency)}</td>
                  <td>
                    <strong>{money(p.quote?.current, currency)}</strong>
                    <small className="cell-note">
                      {p.quote
                        ? `${p.quote.source} · ${marketDate(p.quote.asOf, p.exchange)}`
                        : "Needs price"}
                    </small>
                  </td>
                  {expanded && (
                    <td>
                      <Return
                        value={p.priceChange}
                        pct={p.priceChangePct}
                        currency={currency}
                      />
                    </td>
                  )}
                  <td>
                    <Return
                      value={p.daily}
                      pct={p.dailyPct}
                      currency={currency}
                    />
                  </td>
                  <td>
                    <Return
                      value={p.total}
                      pct={p.totalPct}
                      currency={currency}
                    />
                  </td>
                  <td>
                    <strong>{money(p.value, currency)}</strong>
                    {p.watchOnly && (
                      <small className="cell-note">Tracking only</small>
                    )}
                  </td>
                  {showNotes && (
                    <td>
                      <button
                        className="text-button notes-cell"
                        onClick={(e) => {
                          e.stopPropagation();
                          (onNotes || onDetail)(p);
                        }}
                      >
                        {notes[
                          quoteKey(portfolio, currency, p.symbol, p.exchange)
                        ]
                          ?.replace(/<[^>]*>/g, "")
                          .trim()
                          ? "View notes"
                          : "Add note"}
                      </button>
                    </td>
                  )}
                  {isWatchlist && (
                    <td onClick={(e) => e.stopPropagation()}>
                      {p.target && (
                        <small
                          className={
                            p.quote &&
                            (p.direction === "below"
                              ? p.quote.current <= p.target
                              : p.quote.current >= p.target)
                              ? "alert-hit"
                              : "cell-note"
                          }
                        >
                          {p.quote &&
                          (p.direction === "below"
                            ? p.quote.current <= p.target
                            : p.quote.current >= p.target)
                            ? "Target reached · "
                            : ""}
                          {p.direction} {money(p.target, currency)}
                        </small>
                      )}
                      <div className="inline">{rowActions?.(p)}</div>
                    </td>
                  )}
                  <td>
                    <ChevronRight size={15} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title={
            query || filter !== "all"
              ? "No matching positions"
              : "Make your first move"
          }
          text={
            query || filter !== "all"
              ? "Try another search or filter."
              : "Record a purchase to start tracking your investment."
          }
          action={
            !query &&
            filter === "all" && (
              <button className="primary" onClick={onAdd}>
                <Plus size={16} />
                {isWatchlist ? "Add symbol" : "Add purchase"}
              </button>
            )
          }
        />
      )}
      {rows.length > 0 && (
        <div className="table-foot">
          Select a position to see purchase dates, individual lots, and all
          returns.
          <span>
            {isWatchlist
              ? "Tracking positions are not purchases"
              : "Average purchase includes fees"}
          </span>
        </div>
      )}
    </section>
  );
}
