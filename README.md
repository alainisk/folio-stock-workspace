# Folio — Stock workspace

A local stock simulation and investment tracker. React + Vite frontend, Express quote proxy, browser-local data. It records transactions; it does not place brokerage orders.

## Start

Requires Node.js 20.19+ (or 22.12+).

```sh
npm install
npm run dev
```

Open http://localhost:5173. Keep the terminal running. Use the same browser and address each time: localStorage is origin-specific. `localhost` and `127.0.0.1` have separate workspaces.

For the production build:

```sh
npm run build
npm start
```

## Deploy on Render (Free tier)

Render deploy flow:

1. Create a repository on GitHub (if not already).
2. Push this project to `main`.
3. In Render, choose **New → Web Service** and connect this repo.
4. Keep these settings:
   - **Environment**: `Node`
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/status`
   - **Plan**: `Free`
5. Render will auto-detect `render.yaml` if present and deploy with these values.

If you hit sleeping instance behavior on free tier, your app is still working; requests wake it up on demand.
For cleaner always-on behavior without redesigning architecture, switch to **Railway Hobby** after this:

1. Open Railway and create a new project from this same GitHub repo.
2. Select **Hobby** plan (`$5/mo`) for your service.
3. Use the same commands:
   - `npm run build`
   - `npm start`
4. Keep your port on `process.env.PORT` (already wired in `server/index.js`).

## Included

- Separate simulated and actual portfolios. Actual starts empty; simulated USD starts with clearly labeled illustrative sample positions and history.
- CAD, EUR and USD, each with separate totals and simulation balances. No implicit FX conversion.
- Exchange selection per purchase, with 15 US, Canadian and European markets. The suggested currency follows the selected market, but the purchase currency is independently selectable. Position identity is exchange + ticker + currency + portfolio.
- Symbol, company, market, purchase date, fractional shares, purchase price, initial investment, fees and total cost.
- Initial investment = original shares purchased × purchase price, **excluding fees**. At position/portfolio level this is the sum of all original purchases, including shares subsequently sold. Remaining share cost is separately available in the details.
- Current price, per-share day change, daily investment return, lifetime return (all in dollars/euros and percentages), realized gains, unrealized gains and dividends.
- Purchases, lot-specific partial/full sales, dividends and a searchable trade journal. Remove an incorrect transaction in the journal and re-enter it; a purchase cannot be removed while linked sales exist.
- Portfolio snapshots and stock price charts with 1D, 1W, 1M, 3M, 6M, 1Y, 3Y, 5Y, 10Y and ALL filters. Stock charts use available provider history.
- Multiple named watchlists with the same stock details, charts, search, sorting, notes and price updates as holdings. Optional reference shares and price show hypothetical returns without creating purchases.
- Separate local member profiles, each with their own portfolios, watchlists, notes, settings and backups. These are device profiles, not authenticated private accounts.
- Rich-text stock notes with headings, bold, italic, lists and clickable links. Notes are shared across holdings and watchlists for the same member, portfolio, currency and exchange listing; imported HTML is sanitized.
- Manual quote updates with dates, previous close, provenance and validation. Selected symbols only: unselected quotes retain timestamps.
- CSV export and validated JSON backup/restore. CSV position totals repeat per purchase lot and are labeled as position totals; do not sum those repeated columns.
- Responsive mobile layout, accessible dialogs and local persistence error handling. Existing v1 USD/CAD records migrate to exchange-aware records and add a EUR balance; migrated market assignments are defaults and should be checked against the actual venue.

## Automatic web quotes

Quotes refresh on opening the app and every 15 minutes while it is running, with catch-up after sleep or reconnecting. Only the selected member is refreshed; other members catch up when selected. Settings can disable automatic refresh, and Update prices also supports manual values and on-demand web updates.

The server uses Yahoo Finance's public chart endpoint, without an API key, for supported US, Canadian and European listings. It validates currency and exchange, caches briefly, limits concurrent requests and preserves existing prices on partial failures. Last-check status and individual quote timestamps are visible. Provider data may be delayed or unavailable; this is an unofficial endpoint without a service guarantee. Live retrieval was verified for AAPL/NASDAQ/USD, RY/TSX/CAD and SAP/XETRA/EUR.

Polling does not run after the app/browser or local server is closed. This app does not execute brokerage orders.

## Return calculations

- Initial investment = shares × purchase price, excluding fees.
- Purchase cost = initial investment + purchase fees.
- Market value = remaining shares × last usable price.
- Remaining cost includes proportional purchase fees for the selected lots.
- Realized gain = net sale proceeds − cost allocated to sold shares.
- Lifetime return = remaining unrealized gains + realized gains + dividends.
- Lifetime return % = lifetime return / total purchase outlays including fees. This is a simple return on cumulative investment; it is not annualized, time-weighted, tax reporting, or FX-adjusted.
- Stock day change = current price − previous close.
- Investment daily P/L uses previous close for carried positions and purchase price for same-session buys, includes that session's sale movements, fees and dividends, and excludes shares sold before that session. The denominator is starting exposure plus same-day purchase exposure and fees.
- Daily date follows the quote timestamp in the selected exchange's time zone. An old quote is not labeled live; mixed-session quote dates suppress portfolio daily totals. Quotes dated before subsequent transactions are not used to value remaining holdings.
- Charts show recorded portfolio **market value**, not investment return: purchases and sales change the chart. 1D is the last 24 hours of recorded snapshots, not a downloaded intraday history. Fewer than two points shows an explanatory empty state. The sample chart is explicitly illustrative and is removed when web updates first establish recorded values. Actual portfolio history is never generated. Stock-detail charts separately display available historical stock prices; they are not portfolio returns.

Splits, transfers, broker corrections and taxes are not automated. Alerts are checked on-screen when prices are updated; no background or push notifications. Data is saved in the current browser, not a cloud account. Download backups before clearing browser data or restoring a different workspace.

## Verify

```sh
npm test
npx playwright install chromium
npm run dev
# In a second terminal:
npm run test:browser
npm run screenshots
```

Financial tests cover fees, selected lots, same-session buys/sales, dividends, missing/stale quotes, separate currencies/exchanges, initial principal, time zones, import validation and CSV escaping. Browser checks cover EUR/Xetra purchases, quotes, sales, dividends, persistence, watchlist alerts, export, restore, all ten chart ranges, named watchlists, member separation, rich notes, unsafe imported HTML, exact 15-minute scheduling and mobile navigation.

Design brief and verification: `docs/design/design-system.md`, `docs/design/verification.md`.
