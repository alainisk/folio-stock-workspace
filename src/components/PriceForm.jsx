import { parseInstrument } from "../lib/markets";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Modal, Field } from "./Primitives";
import { quoteKey, validateQuote } from "../lib/portfolio";
const localTime = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export default function PriceForm({
  state,
  portfolio,
  currency,
  symbols,
  provider,
  onSave,
  onClose,
}) {
  const [rows, setRows] = useState(
    symbols.map((key) => {
      const { symbol, exchange } = parseInstrument(key);
      const q = state.quotes[quoteKey(portfolio, currency, symbol, exchange)];
      return {
        key,
        symbol,
        exchange,
        current: q?.current ?? "",
        previous: q?.previous ?? "",
        enabled: false,
      };
    }),
  );
  const [asOf, setAsOf] = useState(localTime()),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const change = (index, key, value) =>
    setRows(
      rows.map((r, i) =>
        i === index ? { ...r, [key]: value, enabled: true } : r,
      ),
    );
  function submit(e) {
    e.preventDefault();
    try {
      const selected = rows.filter((r) => r.enabled);
      if (!selected.length)
        throw Error("Select at least one symbol to update.");
      const quotes = Object.fromEntries(
        selected.map((r) => {
          const q = {
            current: Number(r.current),
            previous: Number(r.previous),
            asOf: new Date(asOf).toISOString(),
            source: "Manual",
          };
          validateQuote(q);
          return [quoteKey(portfolio, currency, r.symbol, r.exchange), q];
        }),
      );
      onSave(quotes);
    } catch (e) {
      setError(e.message);
    }
  }
  async function refresh() {
    setBusy(true);
    setError("");
    const quotes = {},
      errors = [];
    for (const r of rows) {
      try {
        const response = await fetch(
          `/api/quote?symbol=${encodeURIComponent(r.symbol)}&exchange=${encodeURIComponent(r.exchange)}&currency=${currency}`,
        );
        const q = await response.json();
        if (!response.ok) throw Error(q.error);
        validateQuote(q);
        quotes[quoteKey(portfolio, currency, r.symbol, r.exchange)] = q;
      } catch (e) {
        errors.push(`${r.symbol}: ${e.message}`);
      }
    }
    setBusy(false);
    if (Object.keys(quotes).length) onSave(quotes, errors.join(" "));
    else setError(errors.join(" "));
  }
  return (
    <Modal
      title="Update market prices"
      subtitle={`${currency} · ${portfolio === "simulated" ? "Simulated portfolio" : "Actual holdings"}`}
      onClose={busy ? () => {} : onClose}
      wide
    >
      <form onSubmit={submit}>
        <div className="form-body">
          <div className="info-box">
            Enter the latest price and the previous trading session's closing
            price. Only selected symbols are updated; unchanged quotes keep
            their original timestamps.
          </div>
          <div className="table-scroll">
            <table className="price-table">
              <thead>
                <tr>
                  <th>Update</th>
                  <th>Symbol</th>
                  <th>Current price</th>
                  <th>Previous close</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Update ${r.symbol} ${r.exchange}`}
                        checked={r.enabled}
                        onChange={(e) =>
                          setRows(
                            rows.map((x, j) =>
                              j === i ? { ...x, enabled: e.target.checked } : x,
                            ),
                          )
                        }
                      />
                    </td>
                    <td>
                      <strong>{r.symbol}</strong>
                      <small className="cell-note">{r.exchange}</small>
                    </td>
                    <td>
                      <input
                        aria-label={`${r.symbol} ${r.exchange} current price`}
                        type="number"
                        min="0.000001"
                        step="any"
                        required={r.enabled}
                        value={r.current}
                        onChange={(e) => change(i, "current", e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        aria-label={`${r.symbol} ${r.exchange} previous close`}
                        type="number"
                        min="0.000001"
                        step="any"
                        required={r.enabled}
                        value={r.previous}
                        onChange={(e) => change(i, "previous", e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!rows.length && <p>Add a purchase or watchlist symbol first.</p>}
          <Field label="Quote date & time (your local time)">
            <input
              type="datetime-local"
              required
              value={asOf}
              max={localTime()}
              onChange={(e) => setAsOf(e.target.value)}
            />
          </Field>
          <div className="provider-row">
            <div>
              <strong>Automatic prices · Yahoo Finance</strong>
              <p>
                {provider?.configured
                  ? "Connected. Quotes retain the provider timestamp."
                  : "Web data is unavailable. You can still enter prices manually."}
              </p>
            </div>
            <button
              type="button"
              className="button"
              disabled={busy || !rows.length || !provider?.configured}
              onClick={refresh}
            >
              <RefreshCw size={15} className={busy ? "spin" : ""} />
              {busy ? "Fetching..." : "Fetch quotes"}
            </button>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button
            className="button"
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="primary" disabled={busy || !rows.length}>
            Save selected prices
          </button>
        </div>
      </form>
    </Modal>
  );
}
