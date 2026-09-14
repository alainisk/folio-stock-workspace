import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { RefreshCw } from "lucide-react";
import { PERIODS } from "../lib/periods";
import { money, percent } from "../lib/portfolio";
import { Empty } from "./Primitives";
export default function StockChart({ symbol, exchange, currency, updatedAt }) {
  const [range, setRange] = useState("3M"),
    [result, setResult] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setResult(null);
    const query = new URLSearchParams({
      symbol,
      exchange,
      currency,
      period: range,
    });
    fetch(`/api/history?${query}`, { signal: abort.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw Error(data.error || "History could not be loaded");
        if (data.currency !== currency)
          throw Error("History currency does not match this listing");
        return data;
      })
      .then(setResult)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [symbol, exchange, currency, range, retry, updatedAt]);
  const points = result?.points || [],
    first = points[0]?.value,
    last = points.at(-1)?.value,
    change = first && last ? ((last - first) / first) * 100 : null;
  return (
    <section className="panel stock-chart">
      <div className="panel-head">
        <div>
          <h2>Stock performance</h2>
          <p>
            {symbol} · {exchange} · {currency} share price
            {change !== null && (
              <span className={change >= 0 ? "positive" : "negative"}>
                {" "}
                · {percent(change)} in view
              </span>
            )}
          </p>
        </div>
        <div className="range" aria-label="Stock chart period">
          {PERIODS.map((r) => (
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
      <div className="stock-chart-canvas">
        {loading ? (
          <div className="chart-loading" role="status">
            <RefreshCw className="spin" size={22} />
            <p>Loading market history...</p>
          </div>
        ) : error ? (
          <Empty
            title="History unavailable"
            text={error}
            action={
              <button className="button" onClick={() => setRetry((r) => r + 1)}>
                Try again
              </button>
            }
          />
        ) : points.length < 2 ? (
          <Empty
            title="Not enough history for this period"
            text="Try a longer period. History begins when this listing started trading."
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={points}
              margin={{ left: 5, right: 18, top: 12, bottom: 8 }}
            >
              <defs>
                <linearGradient id="stockPriceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6255df" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#6255df" stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="at"
                minTickGap={55}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: "var(--muted)" }}
                tickFormatter={(s) =>
                  range === "1D"
                    ? new Date(s).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : new Date(s).toLocaleDateString([], {
                        month: "short",
                        ...(range.endsWith("Y") || range === "ALL"
                          ? { year: "2-digit" }
                          : { day: "numeric" }),
                      })
                }
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v) => money(v, currency)}
                axisLine={false}
                tickLine={false}
                width={77}
                tick={{ fontSize: 10, fill: "var(--muted)" }}
              />
              <Tooltip
                contentStyle={{
                  border: "1px solid var(--border)",
                  background: "var(--theme-surface, #fff)",
                  color: "var(--theme-text, #161a38)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(s) => new Date(s).toLocaleString()}
                formatter={(v) => [money(v, currency), "Share price"]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#6255df"
                strokeWidth={2}
                fill="url(#stockPriceFill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="table-foot">
        {result
          ? `Yahoo Finance · ${points.length} observations · Price history, not investment P/L`
          : "Web price history"}
        <span>
          Prices may be delayed ·{" "}
          {range === "ALL" ? "All available history" : range}
        </span>
      </div>
    </section>
  );
}
