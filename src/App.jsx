import useAutoRefresh from "./hooks/useAutoRefresh";
import { upgradeWorkspace } from "./lib/workspaces";
import { watchPositions } from "./lib/watchlists";
import Watchlists from "./components/Watchlists";
import { currencies, instrumentKey, migrate } from "./lib/markets";
import { useState, useEffect, useMemo } from "react";
import {
  Home,
  ChartNoAxesColumnIncreasing,
  Star,
  BookOpen,
  Settings as SettingsIcon,
  Monitor,
  ChevronRight,
  Plus,
  Upload,
  Info,
  RefreshCw,
  Check,
  Menu,
  X,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import { initialState, STORE } from "./lib/seed";
import {
  summary,
  quoteKey,
  positions,
  addSnapshot,
  money,
  percent,
  download,
  csv,
  validateBackup,
  today,
} from "./lib/portfolio";
import { Metrics, Charts, Holdings } from "./components/Dashboard";
import { Modal } from "./components/Primitives";
import TradeForm from "./components/TradeForm";
import PositionDetail from "./components/PositionDetail";
import PriceForm from "./components/PriceForm";
import { Journal, Settings } from "./components/WorkspaceViews";
const nav = [
  ["Overview", Home],
  ["Holdings", ChartNoAxesColumnIncreasing],
  ["Watchlist", Star],
  ["Trade journal", BookOpen],
  ["Settings", SettingsIcon],
];
export default function App({
  state,
  setState,
  saveError,
  member,
  memberControls,
}) {
  const [page, setPage] = useState("Overview"),
    [portfolio, setPortfolio] = useState("simulated"),
    [currency, setCurrency] = useState("USD"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [provider, setProvider] = useState(null),
    [mobile, setMobile] = useState(false);
  const m = useMemo(
    () => summary(state, portfolio, currency),
    [state, portfolio, currency],
  );
  const refreshStatus = useAutoRefresh(state, setState);
  const watched = modal?.watchId
    ? state.watchlist.find((w) => w.id === modal.watchId)
    : null;
  const detailPosition = watched
    ? watchPositions(state, portfolio, currency, watched.listId).find(
        (p) => p.watchId === watched.id,
      )
    : m.positions.find((p) => p.key === modal?.key);
  const saveStockNotes = (p, html) =>
    setState((current) => ({
      ...current,
      stockNotes: {
        ...current.stockNotes,
        [quoteKey(portfolio, currency, p.symbol, p.exchange)]: html,
      },
    }));
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setProvider)
      .catch(() => setProvider({ configured: false }));
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 6000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  function change(next, message) {
    setState(next);
    if (message) setToast(message);
  }
  function saveTrade(t) {
    change(
      addSnapshot(
        { ...state, transactions: [...state.transactions, t] },
        t.portfolio,
        t.currency,
      ),
      `${t.type === "buy" ? "Purchase" : t.type === "sell" ? "Sale" : "Dividend"} recorded`,
    );
    setCurrency(t.currency);
    setModal(null);
  }
  function savePrices(q, error) {
    change(
      addSnapshot(
        { ...state, quotes: { ...state.quotes, ...q } },
        portfolio,
        currency,
      ),
      error
        ? `Some prices updated. ${error}`
        : "Prices updated and performance snapshot saved",
    );
    setModal(null);
  }
  function openPrice(symbol) {
    setModal({
      type: "prices",
      symbols: symbol
        ? [symbol]
        : [
            ...new Set([
              ...m.open.map((p) => p.key),
              ...state.watchlist
                .filter(
                  (w) => w.portfolio === portfolio && w.currency === currency,
                )
                .map((w) => instrumentKey(w.symbol, w.exchange)),
            ]),
          ],
    });
  }
  function openBuy(position) {
    setModal({
      type: "trade",
      initialType: "buy",
      position: position?.lots
        ? position
        : position
          ? { ...position, lots: [] }
          : undefined,
    });
  }
  function exportData() {
    const rows = [
      [
        "Portfolio",
        "Currency",
        "Market / exchange",
        "Symbol",
        "Company name",
        "Date of purchase",
        "Shares purchased",
        "Shares remaining",
        "Purchase price",
        "Initial investment (shares x purchase price)",
        "Purchase fees",
        "Total purchase investment",
        "Current price",
        "Quote source",
        "Quote timestamp",
        "Stock daily change",
        "Stock daily change %",
        "Investment daily P/L (position)",
        "Investment daily P/L % (position)",
        "Lifetime investment P/L (position)",
        "Lifetime investment P/L % (position)",
        "Remaining market value (position)",
      ],
    ];
    for (const p of m.positions) {
      for (const l of p.lots)
        rows.push([
          portfolio,
          currency,
          p.exchange,
          p.symbol,
          p.name,
          l.date,
          l.shares,
          l.remaining,
          l.price,
          l.shares * l.price,
          l.fee,
          l.shares * l.price + l.fee,
          p.quote?.current,
          p.quote?.source,
          p.quote?.asOf,
          p.priceChange,
          p.priceChangePct,
          p.daily,
          p.dailyPct,
          p.total,
          p.totalPct,
          p.value,
        ]);
    }
    download(
      `folio-${portfolio}-${currency}-${today()}.csv`,
      csv(rows),
      "text/csv;charset=utf-8",
    );
    setToast(
      "Holdings exported. Position totals repeat across purchase lots; do not sum those columns.",
    );
  }
  const demo = portfolio === "simulated" && currency === "USD" && state.demo;
  const manual = m.open.some((p) => p.quote?.source === "Manual"),
    sample = m.open.some((p) => p.quote?.source === "Sample");
  const subtitle =
    page === "Overview"
      ? "A little perspective on every position."
      : page === "Holdings"
        ? "The details behind every investment."
        : page === "Watchlist"
          ? "Follow your ideas before you invest."
          : page === "Trade journal"
            ? "Your decisions, recorded. Your progress, visible."
            : "Make this workspace your own.";
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Overview");
          }}
        >
          <span>F</span>Folio<span className="brand-dot">.</span>
        </a>
        <nav aria-label="Main navigation">
          {nav.map(([label, Icon]) => (
            <button
              key={label}
              className={page === label ? "selected" : ""}
              aria-current={page === label ? "page" : undefined}
              onClick={() => {
                setPage(label);
                setMobile(false);
              }}
            >
              <Icon size={19} strokeWidth={1.7} />
              {label}
              {page === label && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-icon">
            <Monitor size={18} />
          </div>
          <div>
            <strong>Local workspace</strong>
            <span>{member.name}’s workspace</span>
          </div>
          <ChevronRight size={15} />
        </div>
      </aside>
      {mobile && (
        <button
          aria-label="Close navigation"
          className="mobile-scrim"
          onClick={() => setMobile(false)}
        />
      )}
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            {memberControls}
            <select
              aria-label="Portfolio currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <span className="avatar" title={`${member.name} workspace`}>
              {member.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <h1>
                {page === "Overview"
                  ? "Your portfolio, at a glance."
                  : page === "Holdings"
                    ? "Every position. In perspective."
                    : page}
              </h1>
              <p>{subtitle}</p>
            </div>
            <div className="heading-actions">
              <button className="button" onClick={exportData}>
                <Upload size={16} />
                Export
              </button>
              <button className="primary" onClick={() => openBuy()}>
                <Plus size={18} />
                Add purchase
              </button>
            </div>
          </div>
          <div className="portfolio-row">
            <div className="segmented" aria-label="Portfolio type">
              <button
                aria-pressed={portfolio === "simulated"}
                className={portfolio === "simulated" ? "active" : ""}
                onClick={() => setPortfolio("simulated")}
              >
                Simulated
              </button>
              <button
                aria-pressed={portfolio === "actual"}
                className={portfolio === "actual" ? "active" : ""}
                onClick={() => setPortfolio("actual")}
              >
                Actual holdings
              </button>
            </div>
            {portfolio === "simulated" && (
              <span className="buying-power">
                <Wallet size={14} />
                Available cash <strong>{money(m.cash, currency)}</strong>
              </span>
            )}
          </div>
          {saveError && (
            <div className="error-banner" role="alert">
              {saveError}
              <button
                onClick={() =>
                  download("folio-emergency-backup.json", JSON.stringify(state))
                }
              >
                Download backup now
              </button>
            </div>
          )}
          {page !== "Settings" && (
            <div className="data-banner">
              <div>
                <Info size={16} />
                <span>
                  {demo ? (
                    <>
                      <strong>
                        {sample ? "Sample portfolio" : "Sample purchases"}
                      </strong>
                      <span className="banner-divider">·</span>
                      {sample
                        ? "Illustrative prices, not live market data"
                        : "Web quotes · example transactions"}
                    </>
                  ) : (
                    <>
                      <strong>
                        {sample
                          ? "Sample prices"
                          : manual
                            ? "Manual prices"
                            : "Your portfolio"}
                      </strong>
                      <span className="banner-divider">·</span>
                      {m.missing
                        ? "Add prices to calculate your returns"
                        : sample
                          ? "Illustrative prices, not live market data"
                          : manual
                            ? "Returns use your last saved quotes"
                            : provider?.configured
                              ? "Update prices to fetch the latest available quotes"
                              : "Manual price updates available"}
                    </>
                  )}
                </span>
              </div>
              <button onClick={() => openPrice()}>
                <RefreshCw size={15} />
                Update prices
              </button>
            </div>
          )}
          {m.mixedDays && page !== "Settings" && (
            <div className="warning-banner">
              Quotes span different trading sessions. Update all prices to the
              same session to calculate a portfolio daily return.
            </div>
          )}
          {page !== "Settings" && (
            <div className="refresh-status">
              <span>
                <i className={refreshStatus.busy ? "refreshing" : ""} />
                {refreshStatus.busy
                  ? "Updating web prices..."
                  : state.autoRefresh
                    ? "Automatic web updates · every 15 minutes"
                    : "Automatic updates paused"}
                {state.lastRefresh &&
                  ` · Last checked ${new Date(state.lastRefresh).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
              </span>
              <button
                className="text-button"
                disabled={refreshStatus.busy}
                onClick={refreshStatus.refresh}
              >
                <RefreshCw size={13} />
                Refresh now
              </button>
            </div>
          )}
          {refreshStatus.errors.length > 0 && (
            <details className="warning-banner">
              <summary>
                {refreshStatus.errors.length} price update(s) could not be
                completed. Last saved prices retained.
              </summary>
              {refreshStatus.errors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </details>
          )}
          {(page === "Overview" || page === "Holdings") && (
            <>
              <Metrics metrics={m} currency={currency} />
              {page === "Overview" && (
                <Charts
                  state={state}
                  portfolio={portfolio}
                  currency={currency}
                  metrics={m}
                />
              )}
              <Holdings
                positions={m.positions}
                currency={currency}
                expanded={page === "Holdings"}
                onAdd={() => openBuy()}
                onDetail={(p) => setModal({ type: "detail", key: p.key })}
                showNotes={page !== "Overview"}
                notes={state.stockNotes}
                portfolio={portfolio}
              />
              {page === "Holdings" && (
                <div className="realized-strip">
                  <span>
                    Realized gains{" "}
                    <strong
                      className={m.realized >= 0 ? "positive" : "negative"}
                    >
                      {money(m.realized, currency, true)}
                    </strong>
                  </span>
                  <span>
                    Dividend income{" "}
                    <strong>{money(m.dividends, currency)}</strong>
                  </span>
                  <span>
                    All purchase outlays{" "}
                    <strong>{money(m.outlay, currency)}</strong>
                  </span>
                </div>
              )}
            </>
          )}
          {page === "Watchlist" && (
            <Watchlists
              state={state}
              portfolio={portfolio}
              currency={currency}
              onChange={change}
              onDetail={(p) =>
                setModal({ type: "detail", key: p.key, watchId: p.watchId })
              }
              onBuy={(p) => openBuy(p.watchOnly ? { ...p, lots: [] } : p)}
            />
          )}
          {page === "Trade journal" && (
            <Journal
              state={state}
              portfolio={portfolio}
              currency={currency}
              onDelete={(t) => {
                if (
                  state.transactions.some(
                    (s) => s.type === "sell" && s.lotId === t.id,
                  )
                ) {
                  setToast(
                    "Delete the sales linked to this purchase first, so the ledger stays consistent.",
                  );
                  return;
                }
                setModal({
                  type: "confirm",
                  title: "Delete this transaction?",
                  text: `Remove the ${t.symbol} ${t.type} dated ${t.date}. Your balances and returns will be recalculated. Existing historical snapshots are retained.`,
                  action: () => {
                    change(
                      addSnapshot(
                        {
                          ...state,
                          transactions: state.transactions.filter(
                            (x) => x.id !== t.id,
                          ),
                        },
                        portfolio,
                        currency,
                      ),
                      "Transaction deleted",
                    );
                    setModal(null);
                  },
                });
              }}
            />
          )}
          {page === "Settings" && (
            <Settings
              state={state}
              provider={provider}
              onChange={change}
              memberName={member.name}
              onRestore={(s) =>
                setModal({
                  type: "confirm",
                  title: "Restore this backup?",
                  text: `Replace this workspace with ${s.transactions.length} transactions and ${s.watchlist.length} watchlist entries from the backup. Download your current backup first if you want to keep it.`,
                  action: () => {
                    change(upgradeWorkspace(s), "Backup restored");
                    setModal(null);
                  },
                })
              }
              onClear={() =>
                setModal({
                  type: "confirm",
                  title: "Clear your simulated portfolio?",
                  text: "This removes every simulated transaction, price, watchlist entry, and performance snapshot in USD, CAD, and EUR. Actual holdings are kept.",
                  action: () => {
                    change(
                      {
                        ...state,
                        demo: false,
                        transactions: state.transactions.filter(
                          (t) => t.portfolio !== "simulated",
                        ),
                        quotes: Object.fromEntries(
                          Object.entries(state.quotes).filter(
                            ([k]) => !k.startsWith("simulated:"),
                          ),
                        ),
                        watchlist: state.watchlist.filter(
                          (w) => w.portfolio !== "simulated",
                        ),
                        snapshots: state.snapshots.filter(
                          (s) => s.portfolio !== "simulated",
                        ),
                      },
                      "Simulation cleared. Ready for your first investment.",
                    );
                    setModal(null);
                  },
                })
              }
            />
          )}
          <footer>
            <span>
              <span className={`saved-dot ${saveError ? "failed" : ""}`}>
                <Check size={10} />
              </span>
              {saveError ? "Changes not saved" : "Saved on this device"}
            </span>
            <span>
              Folio · Your personal stock workspace
              <span className="footer-sep">|</span>
              {currency} · Exchange-local dates
            </span>
          </footer>
        </div>
      </main>
      {modal?.type === "trade" && (
        <TradeForm
          state={state}
          portfolio={portfolio}
          currency={currency}
          position={modal.position}
          initialType={modal.initialType}
          onSave={saveTrade}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "detail" && detailPosition && (
        <PositionDetail
          position={detailPosition}
          currency={currency}
          onClose={() => setModal(null)}
          onQuote={() => openPrice(modal.key)}
          notes={
            state.stockNotes[
              quoteKey(
                portfolio,
                currency,
                detailPosition.symbol,
                detailPosition.exchange,
              )
            ] || ""
          }
          onNotesChange={(html) => saveStockNotes(detailPosition, html)}
          watchOnly={detailPosition.watchOnly}
          onTrade={(type) =>
            setModal({
              type: "trade",
              initialType: type,
              position: detailPosition?.watchOnly
                ? { ...detailPosition, lots: [] }
                : detailPosition,
            })
          }
        />
      )}
      {modal?.type === "prices" && (
        <PriceForm
          state={state}
          portfolio={portfolio}
          currency={currency}
          symbols={modal.symbols}
          provider={provider}
          onSave={savePrices}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "confirm" && (
        <Modal title={modal.title} onClose={() => setModal(null)}>
          <div className="form-body">
            <p>{modal.text}</p>
          </div>
          <div className="modal-actions">
            <button className="button" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button className="primary" onClick={modal.action}>
              Confirm
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
