import { useState } from "react";
import { Plus, Pencil, Trash2, Star, Download } from "lucide-react";
import { Field, Modal } from "./Primitives";
import { Holdings } from "./Dashboard";
import { catalog } from "../lib/seed";
import { markets, defaultMarket } from "../lib/markets";
import { watchPositions } from "../lib/watchlists";
import { uid, today, money, download, csv } from "../lib/portfolio";
export default function Watchlists({
  state,
  portfolio,
  currency,
  onChange,
  onDetail,
  onBuy,
}) {
  const [selected, setSelected] = useState(state.watchlists[0].id),
    [modal, setModal] = useState(null),
    [error, setError] = useState("");
  const active =
      state.watchlists.find((l) => l.id === selected) || state.watchlists[0],
    rows = watchPositions(state, portfolio, currency, active.id);
  const [listName, setListName] = useState(""),
    [form, setForm] = useState({});
  const field = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  function addStock() {
    setForm({
      symbol: "",
      name: "",
      exchange: defaultMarket(currency),
      referenceShares: 1,
      referencePrice: "",
      referenceDate: today(),
      target: "",
      direction: "below",
      listId: active.id,
    });
    setError("");
    setModal("stock");
  }
  function edit(p) {
    const w = state.watchlist.find((w) => w.id === p.watchId);
    setForm({
      ...w,
      referencePrice: w.referencePrice ?? "",
      target: w.target ?? "",
      referenceDate: w.referenceDate || today(),
    });
    setError("");
    setModal("stock");
  }
  function saveStock(e) {
    e.preventDefault();
    const symbol = form.symbol.trim().toUpperCase();
    if (!/^[A-Z0-9.^-]{1,20}$/.test(symbol))
      return setError("Enter a valid stock symbol.");
    if (
      state.watchlist.some(
        (w) =>
          w.id !== form.id &&
          w.listId === form.listId &&
          w.portfolio === portfolio &&
          w.currency === currency &&
          w.symbol === symbol &&
          w.exchange === form.exchange,
      )
    )
      return setError("This listing is already in that watchlist.");
    const w = {
      ...form,
      id: form.id || uid(),
      symbol,
      name: form.name.trim(),
      portfolio,
      currency,
      referenceShares: Number(form.referenceShares),
      referencePrice: form.referencePrice ? Number(form.referencePrice) : null,
      target: form.target ? Number(form.target) : null,
    };
    onChange(
      {
        ...state,
        watchlist: form.id
          ? state.watchlist.map((x) => (x.id === w.id ? w : x))
          : [...state.watchlist, w],
      },
      "Watchlist saved",
    );
    setSelected(form.listId);
    setModal(null);
  }
  function saveList(e) {
    e.preventDefault();
    const name = listName.trim();
    if (
      state.watchlists.some(
        (l) =>
          l.name.toLowerCase() === name.toLowerCase() &&
          (modal === "new-list" || l.id !== active.id),
      )
    )
      return setError("A watchlist with that name already exists.");
    if (modal === "new-list") {
      const id = uid();
      onChange(
        { ...state, watchlists: [...state.watchlists, { id, name }] },
        "Watchlist created",
      );
      setSelected(id);
    } else
      onChange(
        {
          ...state,
          watchlists: state.watchlists.map((l) =>
            l.id === active.id ? { ...l, name } : l,
          ),
        },
        "Watchlist renamed",
      );
    setModal(null);
  }
  function exportList() {
    download(
      `folio-watchlist-${active.name}-${currency}.csv`,
      csv([
        [
          "Watchlist",
          "Symbol",
          "Exchange",
          "Currency",
          "Shares / tracking quantity",
          "Reference investment",
          "Current price",
          "Daily P/L",
          "Total P/L",
          "Owned holding",
        ],
        ...rows.map((p) => [
          active.name,
          p.symbol,
          p.exchange,
          currency,
          p.shares,
          p.initialInvestment,
          p.quote?.current,
          p.daily,
          p.total,
          !p.watchOnly,
        ]),
      ]),
      "text/csv;charset=utf-8",
    );
  }
  return (
    <>
      <section className="watchlist-bar">
        <div className="watchlist-tabs" aria-label="Named watchlists">
          {state.watchlists.map((l) => (
            <button
              key={l.id}
              className={l.id === active.id ? "active" : ""}
              aria-pressed={l.id === active.id}
              onClick={() => setSelected(l.id)}
            >
              <Star size={14} />
              {l.name}
              <span>
                {
                  state.watchlist.filter(
                    (w) =>
                      w.listId === l.id &&
                      w.portfolio === portfolio &&
                      w.currency === currency,
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="inline">
          <button
            className="button"
            onClick={() => {
              setListName("");
              setError("");
              setModal("new-list");
            }}
          >
            <Plus size={14} />
            New watchlist
          </button>
          <button
            className="icon-button"
            aria-label="Rename watchlist"
            onClick={() => {
              setListName(active.name);
              setError("");
              setModal("rename-list");
            }}
          >
            <Pencil size={15} />
          </button>
          <button
            className="icon-button"
            aria-label="Delete watchlist"
            disabled={state.watchlists.length === 1}
            onClick={() => setModal("delete-list")}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </section>
      <div className="watchlist-summary">
        <p>
          <strong>{active.name}</strong> · {currency} · Owned stocks use your
          holding figures. Unowned stocks use your optional tracking quantity
          and reference price.
        </p>
        <div className="inline">
          <button className="button" onClick={exportList}>
            <Download size={14} />
            Export list
          </button>
          <button className="primary" onClick={addStock}>
            <Plus size={16} />
            Add symbol
          </button>
        </div>
      </div>
      <Holdings
        key={`${active.id}:${portfolio}:${currency}`}
        positions={rows}
        currency={currency}
        expanded
        onDetail={onDetail}
        onAdd={addStock}
        title={`${active.name} watchlist`}
        isWatchlist
        notes={state.stockNotes}
        portfolio={portfolio}
        onNotes={onDetail}
        rowActions={(p) => (
          <>
            <button className="text-button" onClick={() => onBuy(p)}>
              Buy
            </button>
            <button
              className="icon-button"
              aria-label={`Edit ${p.symbol} watchlist entry`}
              onClick={() => edit(p)}
            >
              <Pencil size={14} />
            </button>
            <button
              className="icon-button"
              aria-label={`Remove ${p.symbol} from watchlist`}
              onClick={() => setModal({ remove: p.watchId, symbol: p.symbol })}
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      />
      {(modal === "new-list" || modal === "rename-list") && (
        <Modal
          title={
            modal === "new-list" ? "Create a watchlist" : "Rename watchlist"
          }
          onClose={() => setModal(null)}
        >
          <form onSubmit={saveList}>
            <div className="form-body">
              <Field label="Watchlist name">
                <input
                  autoFocus
                  required
                  value={listName}
                  maxLength={60}
                  onChange={(e) => setListName(e.target.value)}
                  placeholder="e.g. Too Early"
                />
              </Field>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="button"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="primary">Save watchlist</button>
            </div>
          </form>
        </Modal>
      )}
      {modal === "stock" && (
        <Modal
          title={form.id ? "Edit watchlist stock" : "Add to watchlist"}
          subtitle={`${active.name} · ${currency}`}
          onClose={() => setModal(null)}
        >
          <form onSubmit={saveStock}>
            <div className="form-body form-grid">
              <Field label="Watchlist">
                <select
                  aria-label="Watchlist"
                  value={form.listId}
                  onChange={(e) => field("listId", e.target.value)}
                >
                  {state.watchlists.map((l) => (
                    <option value={l.id} key={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Market / exchange">
                <select
                  aria-label="Market / exchange"
                  value={form.exchange}
                  onChange={(e) => field("exchange", e.target.value)}
                >
                  {markets.map((m) => (
                    <option value={m.code} key={m.code}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Symbol">
                <input
                  aria-label="Symbol"
                  required
                  list="watch-symbols"
                  value={form.symbol}
                  onChange={(e) => {
                    const symbol = e.target.value.toUpperCase();
                    setForm((f) => ({
                      ...f,
                      symbol,
                      name:
                        catalog.find((c) => c.symbol === symbol)?.name || "",
                    }));
                  }}
                />
                <datalist id="watch-symbols">
                  {catalog.map((c) => (
                    <option value={c.symbol} key={c.symbol}>
                      {c.name}
                    </option>
                  ))}
                </datalist>
              </Field>
              <Field label="Company name">
                <input
                  required
                  maxLength={120}
                  value={form.name}
                  onChange={(e) => field("name", e.target.value)}
                />
              </Field>
              <Field label="Tracking quantity">
                <input
                  required
                  type="number"
                  min="0.000001"
                  step="any"
                  value={form.referenceShares}
                  onChange={(e) => field("referenceShares", e.target.value)}
                />
              </Field>
              <Field label={`Reference price (${currency}, optional)`}>
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  value={form.referencePrice}
                  onChange={(e) => field("referencePrice", e.target.value)}
                />
              </Field>
              <Field label="Reference date">
                <input
                  type="date"
                  value={form.referenceDate}
                  max={today()}
                  onChange={(e) => field("referenceDate", e.target.value)}
                />
              </Field>
              <Field label="Alert when price is">
                <select
                  aria-label="Alert when price is"
                  value={form.direction}
                  onChange={(e) => field("direction", e.target.value)}
                >
                  <option value="below">At or below</option>
                  <option value="above">At or above</option>
                </select>
              </Field>
              <Field label={`Target price (${currency}, optional)`}>
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  value={form.target}
                  onChange={(e) => field("target", e.target.value)}
                />
              </Field>
              <p className="caption span-2">
                Tracking figures help evaluate an idea; they do not create a
                purchase or spend simulation cash. Notes and charts are
                available by opening the stock.
              </p>
              {error && (
                <p className="form-error span-2" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="button"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="primary">
                {form.id ? "Save changes" : "Add symbol"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {(modal === "delete-list" || modal?.remove) && (
        <Modal
          title={
            modal === "delete-list"
              ? "Delete this watchlist?"
              : "Remove this stock?"
          }
          onClose={() => setModal(null)}
        >
          <div className="form-body">
            <p>
              {modal === "delete-list"
                ? `Remove ${active.name} and its watchlist entries. Holdings, transactions, and stock notes are kept.`
                : `Remove ${modal.symbol} from this watchlist. Your holdings and stock notes are kept.`}
            </p>
          </div>
          <div className="modal-actions">
            <button className="button" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="primary"
              onClick={() => {
                if (modal === "delete-list") {
                  onChange(
                    {
                      ...state,
                      watchlists: state.watchlists.filter(
                        (l) => l.id !== active.id,
                      ),
                      watchlist: state.watchlist.filter(
                        (w) => w.listId !== active.id,
                      ),
                    },
                    "Watchlist deleted",
                  );
                  setSelected(
                    state.watchlists.find((l) => l.id !== active.id).id,
                  );
                } else
                  onChange(
                    {
                      ...state,
                      watchlist: state.watchlist.filter(
                        (w) => w.id !== modal.remove,
                      ),
                    },
                    "Stock removed from watchlist",
                  );
                setModal(null);
              }}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
