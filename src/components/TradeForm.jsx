import { markets, currencies, defaultMarket } from "../lib/markets";
import { useState } from "react";
import { Modal, Field } from "./Primitives";
import { catalog } from "../lib/seed";
import {
  today,
  money,
  uid,
  validateTransaction,
  quoteKey,
  summary,
} from "../lib/portfolio";
export default function TradeForm({
  state,
  portfolio,
  currency: scopeCurrency,
  position,
  initialType = "buy",
  onSave,
  onClose,
}) {
  const [currency, setCurrency] = useState(scopeCurrency),
    [exchange, setExchange] = useState(
      position?.exchange || defaultMarket(scopeCurrency),
    );
  const [type, setType] = useState(initialType),
    [symbol, setSymbol] = useState(position?.symbol || ""),
    [name, setName] = useState(position?.name || ""),
    [date, setDate] = useState(today()),
    [shares, setShares] = useState(""),
    [price, setPrice] = useState(""),
    [fee, setFee] = useState("0"),
    [amount, setAmount] = useState(""),
    [notes, setNotes] = useState(""),
    [lotId, setLotId] = useState(
      position?.lots.find((l) => l.remaining > 0)?.id || "",
    ),
    [error, setError] = useState("");
  const lot = position?.lots.find((l) => l.id === lotId),
    total =
      Number(shares) * Number(price) + (type === "sell" ? -1 : 1) * Number(fee);
  function symbolChange(value) {
    const s = value.toUpperCase().replace(/\s/g, "");
    setSymbol(s);
    const c = catalog.find((c) => c.symbol === s);
    setName(c?.name || "");
  }

  function submit(e) {
    e.preventDefault();
    try {
      const t = {
        id: uid(),
        type,
        portfolio,
        currency,
        exchange,
        symbol: symbol.trim(),
        name: name.trim(),
        date,
        shares: Number(shares),
        price: Number(price),
        fee: Number(fee),
        amount: Number(amount),
        lotId,
        notes: notes.trim(),
      };
      validateTransaction(t, state);
      if (
        portfolio === "simulated" &&
        type === "buy" &&
        total > summary(state, portfolio, currency).cash + 1e-8
      )
        throw Error(
          "This purchase exceeds your simulation cash. Increase your starting balance in Settings.",
        );
      onSave(t);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Modal
      title={
        type === "buy"
          ? "Add a purchase"
          : type === "sell"
            ? "Record a sale"
            : "Record a dividend"
      }
      subtitle={`${portfolio === "simulated" ? "Simulated portfolio" : "Actual holdings"} · ${currency}`}
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <div className="form-body">
          {position?.lots.length > 0 && (
            <div className="segmented full">
              {["buy", "sell", "dividend"].map((t) => (
                <button
                  type="button"
                  key={t}
                  className={type === t ? "active" : ""}
                  onClick={() => {
                    setType(t);
                    setError("");
                  }}
                >
                  {t === "buy"
                    ? "Purchase"
                    : t === "sell"
                      ? "Sale"
                      : "Dividend"}
                </button>
              ))}
            </div>
          )}
          <div className="form-grid">
            <Field label="Market / exchange">
              <select
                aria-label="Market / exchange"
                value={exchange}
                disabled={!!position}
                onChange={(e) => {
                  setExchange(e.target.value);
                  setCurrency(
                    markets.find((m) => m.code === e.target.value).currency,
                  );
                }}
              >
                {markets.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Purchase currency">
              <select
                aria-label="Purchase currency"
                value={currency}
                disabled={!!position}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Stock symbol">
              <input
                aria-label="Stock symbol"
                required
                autoFocus
                list="symbols"
                placeholder="e.g. AAPL"
                value={symbol}
                disabled={!!position}
                onChange={(e) => symbolChange(e.target.value)}
                maxLength={20}
              />
              <datalist id="symbols">
                {catalog.map((c) => (
                  <option key={c.symbol} value={c.symbol}>
                    {c.name}
                  </option>
                ))}
              </datalist>
            </Field>
            <Field
              label={type === "buy" ? "Date of purchase" : "Transaction date"}
            >
              <input
                required
                type="date"
                max={today()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
            <Field label="Company name" className="span-2">
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Company name"
                maxLength={120}
              />
            </Field>
            {type === "sell" && (
              <Field label="Purchase lot" className="span-2">
                <select
                  required
                  value={lotId}
                  onChange={(e) => setLotId(e.target.value)}
                >
                  <option value="">Choose a lot</option>
                  {position?.lots
                    .filter((l) => l.remaining > 0)
                    .map((l) => (
                      <option value={l.id} key={l.id}>
                        {l.date} · {l.remaining} shares remaining ·{" "}
                        {money(l.price, currency)} each
                      </option>
                    ))}
                </select>
              </Field>
            )}
            {type === "dividend" ? (
              <Field
                label={`Dividend received (${currency})`}
                className="span-2"
              >
                <input
                  required
                  type="number"
                  min="0.01"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
            ) : (
              <>
                <Field label="Number of shares">
                  <input
                    required
                    type="number"
                    min="0.000001"
                    max={type === "sell" ? lot?.remaining : undefined}
                    step="any"
                    placeholder="0"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                  />
                </Field>
                <Field
                  label={`${type === "buy" ? "Purchase" : "Sale"} price per share (${currency})`}
                >
                  <input
                    required
                    type="number"
                    min="0.000001"
                    step="any"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </Field>
                <Field label={`Fees (${currency})`}>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                  />
                </Field>
              </>
            )}
            <Field label="Notes (optional)" className="span-2">
              <textarea
                rows="3"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Your investment thesis, strategy, or broker reference..."
                maxLength={2000}
              />
            </Field>
          </div>
          <div className="form-summary">
            <span>
              {type === "buy"
                ? "Total investment"
                : type === "sell"
                  ? "Net sale proceeds"
                  : "Dividend income"}
            </span>
            <strong>
              {money(type === "dividend" ? Number(amount) : total, currency)}
            </strong>
          </div>
          {portfolio === "simulated" && type === "buy" && (
            <p className="caption">
              Available simulation cash:{" "}
              {money(summary(state, portfolio, currency).cash, currency)}
            </p>
          )}
          {type === "buy" && (
            <p className="caption">
              <strong>
                Initial investment:{" "}
                {money(Number(shares) * Number(price), currency)}
              </strong>{" "}
              = {shares || 0} shares × {money(Number(price), currency)} purchase
              price. Fees: {money(Number(fee), currency)}.
            </p>
          )}
          <p className="caption">
            {portfolio === "actual"
              ? "Record a purchase you made through your broker. This app does not place orders."
              : "This transaction uses your simulated balance. No money is traded."}
          </p>
          {error && (
            <div role="alert" className="form-error">
              {error}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            {type === "buy"
              ? "Save purchase"
              : type === "sell"
                ? "Save sale"
                : "Save dividend"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
