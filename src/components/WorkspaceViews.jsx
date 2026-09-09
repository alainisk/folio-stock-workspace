import { upgradeWorkspace } from "../lib/workspaces";
import {
  markets,
  currencies,
  defaultMarket,
  instrumentKey,
  migrate,
} from "../lib/markets";
import { useState, useRef } from "react";
import {
  Plus,
  Trash2,
  Download,
  Upload,
  ShieldCheck,
  ExternalLink,
  Bell,
  Search,
} from "lucide-react";
import { Empty, Company, Return, Field, Modal } from "./Primitives";
import {
  money,
  percent,
  quantity,
  quoteKey,
  uid,
  marketDate,
  download,
  validateBackup,
  scopeTransactions,
  csv,
} from "../lib/portfolio";
import { catalog } from "../lib/seed";
export function Journal({ state, portfolio, currency, onDelete }) {
  const [query, setQuery] = useState(""),
    [type, setType] = useState("all");
  const rows = scopeTransactions(state, portfolio, currency)
    .filter(
      (t) =>
        (type === "all" || t.type === type) &&
        `${t.symbol} ${t.name} ${t.notes}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Trade journal</h2>
          <p>Every purchase, sale, and dividend in one place.</p>
        </div>
        <div className="table-tools">
          <label className="search">
            <Search size={15} />
            <input
              aria-label="Search journal"
              placeholder="Search trades or notes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Transaction type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="all">All transactions</option>
            <option value="buy">Purchases</option>
            <option value="sell">Sales</option>
            <option value="dividend">Dividends</option>
          </select>
        </div>
      </div>
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Company</th>
                <th>Type</th>
                <th>Shares</th>
                <th>Price</th>
                <th>Fees</th>
                <th>Total</th>
                <th>Notes</th>
                <th>Correct</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>
                    <Company {...t} small />
                  </td>
                  <td>
                    <span className={`type-tag ${t.type}`}>
                      {t.type === "buy"
                        ? "Purchase"
                        : t.type === "sell"
                          ? "Sale"
                          : "Dividend"}
                    </span>
                  </td>
                  <td>{t.type === "dividend" ? "—" : quantity(t.shares)}</td>
                  <td>
                    {t.type === "dividend" ? "—" : money(t.price, currency)}
                  </td>
                  <td>
                    {t.type === "dividend" ? "—" : money(t.fee, currency)}
                  </td>
                  <td>
                    {money(
                      t.type === "dividend"
                        ? t.amount
                        : t.shares * t.price +
                            (t.type === "sell" ? -t.fee : t.fee),
                      currency,
                    )}
                  </td>
                  <td className="notes">{t.notes || "—"}</td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Delete ${t.symbol} ${t.type} on ${t.date}`}
                      onClick={() => onDelete(t)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="A fresh page"
          text="Your recorded transactions will appear here."
        />
      )}
    </section>
  );
}
export function Settings({
  state,
  onChange,
  provider,
  onClear,
  onRestore,
  memberName,
}) {
  const [usd, setUsd] = useState(state.budgets.USD),
    [cad, setCad] = useState(state.budgets.CAD),
    [eur, setEur] = useState(state.budgets.EUR),
    [error, setError] = useState("");
  const input = useRef();
  async function restore(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 15e6) throw Error("Backup must be smaller than 15 MB.");
      const s = validateBackup(upgradeWorkspace(JSON.parse(await file.text())));
      onRestore(s);
    } catch (e) {
      setError(e.message);
    }
    e.target.value = "";
  }
  return (
    <div className="settings-grid">
      <section className="panel settings-panel">
        <ShieldCheck className="section-icon" />
        <h2>{memberName}’s workspace</h2>
        <p>
          This member’s portfolios, watchlists and notes are saved in this
          browser on this device. Download a backup to keep a separate copy or
          move your workspace to another browser.
        </p>
        <div className="inline wrap">
          <button
            className="button"
            onClick={() =>
              download(
                `folio-backup-${new Date().toISOString().slice(0, 10)}.json`,
                JSON.stringify(state, null, 2),
              )
            }
          >
            <Download size={16} />
            Download backup
          </button>
          <button className="button" onClick={() => input.current.click()}>
            <Upload size={16} />
            Restore backup
          </button>
          <input
            ref={input}
            hidden
            type="file"
            accept=".json,application/json"
            onChange={restore}
          />
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </section>
      <section className="panel settings-panel">
        <h2>Market data</h2>
        <div className="connection">
          <i className="connected" />
          Yahoo Finance web prices
        </div>
        <p>
          Automatic quotes and stock price history for supported US, Canadian,
          and European listings. Returned exchange and currency are checked
          before prices are applied.
        </p>
        <label className="auto-toggle">
          <input
            aria-label="Automatic price updates"
            type="checkbox"
            checked={state.autoRefresh}
            onChange={(e) =>
              onChange(
                { ...state, autoRefresh: e.target.checked },
                e.target.checked
                  ? "Automatic updates enabled"
                  : "Automatic updates paused",
              )
            }
          />
          <span>Update prices automatically every 15 minutes</span>
        </label>
        <p>
          Refreshes while this member’s workspace is open, and catches up after
          sleep or reconnecting. Prices may be delayed by the source. Your last
          valid quotes are kept if a refresh fails.
        </p>
        <a
          className="text-button"
          href="https://finance.yahoo.com"
          target="_blank"
          rel="noreferrer"
        >
          View Yahoo Finance <ExternalLink size={13} />
        </a>
      </section>
      <section className="panel settings-panel">
        <h2>Simulation starting balance</h2>
        <p>
          Separate virtual cash balances for each currency. Available cash
          reflects purchases, fees, sale proceeds, and dividends.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onChange(
              {
                ...state,
                budgets: {
                  USD: Number(usd),
                  CAD: Number(cad),
                  EUR: Number(eur),
                },
              },
              "Simulation balances saved",
            );
          }}
        >
          <div className="form-grid">
            <Field label="USD starting balance">
              <input
                type="number"
                required
                min="1"
                max="1000000000000"
                step="any"
                value={usd}
                onChange={(e) => setUsd(e.target.value)}
              />
            </Field>
            <Field label="CAD starting balance">
              <input
                type="number"
                required
                min="1"
                max="1000000000000"
                step="any"
                value={cad}
                onChange={(e) => setCad(e.target.value)}
              />
            </Field>
            <Field label="EUR starting balance">
              <input
                type="number"
                required
                min="1"
                max="1000000000000"
                step="any"
                value={eur}
                onChange={(e) => setEur(e.target.value)}
              />
            </Field>
          </div>
          <button className="primary">Save balances</button>
        </form>
      </section>
      <section className="panel settings-panel">
        <h2>Start with a clean simulation</h2>
        <p>
          Remove all simulated purchases, sales, watchlist entries, prices, and
          history. Actual holdings are kept. Your starting balances are
          retained.
        </p>
        <button className="button danger" onClick={onClear}>
          Clear simulated portfolio
        </button>
      </section>
      <section className="panel settings-panel methodology">
        <h2>How returns are calculated</h2>
        <div className="method-grid">
          <div>
            <h3>Investment & market value</h3>
            <p>
              Initial investment = shares × purchase price. Total purchase cost
              = initial investment + fees. Remaining cost uses the selected
              purchase lots. Market value = remaining shares × current price.
            </p>
          </div>
          <div>
            <h3>Daily returns</h3>
            <p>
              Stock day change = current price − previous close. Investment
              daily return includes share movements, same-session sales, fees
              and dividends. Shares bought in that session use their purchase
              price as the baseline. Percentage = daily return ÷ starting
              exposure (plus same-day purchases and their fees).
            </p>
          </div>
          <div>
            <h3>Total returns</h3>
            <p>
              Lifetime return = unrealized gains + realized gains after fees +
              dividends. Total return % divides by all purchase outlays. This is
              a simple investment return, not an annualized or time-weighted
              return.
            </p>
          </div>
          <div>
            <h3>Price dates & currencies</h3>
            <p>
              Daily means the quote's date in its exchange's time zone, which
              may be an earlier trading day. Mixed quote dates or missing prices
              suppress portfolio daily totals. Each position is identified by
              exchange, symbol and currency. USD, CAD and EUR stay separate; no
              FX conversion is assumed. Splits and broker adjustments must be
              recorded manually. Taxes are excluded.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
