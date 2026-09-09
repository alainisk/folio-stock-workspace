import StockChart from "./StockChart";
import RichNotes from "./RichNotes";
import { Modal, Company, Return } from "./Primitives";
import { money, quantity, percent } from "../lib/portfolio";
export default function PositionDetail({
  position: p,
  currency,
  onClose,
  onTrade,
  onQuote,
  notes,
  onNotesChange,
  watchOnly = false,
}) {
  return (
    <Modal
      title={`${p.symbol} · Position details`}
      subtitle={`${p.name} · ${p.exchange} · ${currency}`}
      onClose={onClose}
      wide
    >
      <div className="form-body">
        <Company symbol={p.symbol} name={p.name} exchange={p.exchange} />
        <StockChart
          symbol={p.symbol}
          exchange={p.exchange}
          currency={currency}
          updatedAt={p.quote?.asOf}
        />
        {watchOnly && (
          <div className="info-box">
            Watchlist reference position · these figures track a hypothetical
            investment. No purchase has been recorded. Use Add purchase to
            create an actual or simulated holding.
          </div>
        )}
        <div className="detail-stats">
          <div>
            <span>Initial investment</span>
            <strong>{money(p.initialInvestment, currency)}</strong>
            <small className="cell-note">
              Shares × purchase price · before fees
            </small>
          </div>
          <div>
            <span>Market value</span>
            <strong>{money(p.value, currency)}</strong>
          </div>
          <div>
            <span>Cost of remaining shares</span>
            <strong>{money(p.invested, currency)}</strong>
          </div>
          <div>
            <span>Stock daily change / share</span>
            <Return
              value={p.priceChange}
              pct={p.priceChangePct}
              currency={currency}
            />
          </div>
          <div>
            <span>Investment daily return</span>
            <Return value={p.daily} pct={p.dailyPct} currency={currency} />
          </div>
          <div>
            <span>Unrealized return</span>
            <Return
              value={p.unrealized}
              pct={p.unrealizedPct}
              currency={currency}
            />
          </div>
          <div>
            <span>Realized return</span>
            <Return value={p.realized} currency={currency} />
          </div>
          <div>
            <span>Dividends received</span>
            <strong>{money(p.dividends, currency)}</strong>
          </div>
          <div>
            <span>Lifetime investment return</span>
            <Return value={p.total} pct={p.totalPct} currency={currency} />
          </div>
        </div>
        <h3>{watchOnly ? "Tracking reference" : "Purchase lots"}</h3>
        <div className="table-scroll">
          <table className="lot-table">
            <thead>
              <tr>
                <th>Purchase date</th>
                <th>Purchased</th>
                <th>Remaining</th>
                <th>Price / share</th>
                <th>Initial investment</th>
                <th>Fees</th>
                <th>Total investment</th>
              </tr>
            </thead>
            <tbody>
              {p.lots.map((l) => (
                <tr key={l.id}>
                  <td>{l.date}</td>
                  <td>{quantity(l.shares)}</td>
                  <td>{quantity(l.remaining)}</td>
                  <td>{money(l.price, currency)}</td>
                  <td>{money(l.shares * l.price, currency)}</td>
                  <td>{money(l.fee, currency)}</td>
                  <td>{money(l.price * l.shares + l.fee, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="info-box">
          {p.quote ? (
            <>
              <strong>
                {p.quote.source} price · {money(p.quote.current, currency)}
              </strong>
              <br />
              As of {new Date(p.quote.asOf).toLocaleString()}. Daily returns
              refer to this quote's trading session. Purchase-day returns start
              at your purchase price.
            </>
          ) : (
            "Add a current price and previous close to calculate returns. Quotes dated before your latest purchase are not used."
          )}
        </div>
        <RichNotes value={notes} onChange={onNotesChange} />
      </div>
      <div className="modal-actions">
        <button className="button" onClick={onQuote}>
          Update price
        </button>
        {!watchOnly && (
          <button className="button" onClick={() => onTrade("dividend")}>
            Add dividend
          </button>
        )}
        {!watchOnly && p.shares > 0 && (
          <button className="button" onClick={() => onTrade("sell")}>
            Record sale
          </button>
        )}
        <button className="primary" onClick={() => onTrade("buy")}>
          {watchOnly ? "Add purchase" : "Buy more"}
        </button>
      </div>
    </Modal>
  );
}
