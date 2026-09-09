# Folio verification — September 9, 2026

Build passed. All 31 unit tests and four browser suites passed. Live market retrieval verified for AAPL (NASDAQ/USD), RY (TSX/CAD), SAP (XETRA/EUR), plus available long-range history. Browser suites use deterministic market fixtures for reproducibility; the screenshot capture uses the live endpoint.

## Functional evidence

- Purchase, manual quote, partial sale, dividend, fee calculations, initial principal, persistence, currency separation, export and restore pass.
- All ten periods are selectable in portfolio and position charts.
- Named watchlist creation, movement and rename, stock-detail reuse, shared notes and local member isolation pass.
- Rich notes preserve bold text and clickable safe links; imported scripts, event handlers and unsafe links are removed.
- Controlled browser clock confirms no scheduled requests before 15 minutes and requests begin at 15 minutes.
- Sample history is removed when web prices first establish actual recorded values, preventing a false historical spike.

## Visual comparison and fidelity ledger

Compared the generated concept to final desktop, mobile and stock-detail screenshots by opening the image files for visual inspection.

| Comparison | Final result |
| --- | --- |
| Structure | Retains left navigation, top workspace controls, four metric cards, chart/allocation row and full-width holdings table. |
| Palette | White canvas, pale gray navigation, indigo controls and green/red returns follow the concept. |
| Typography | Navy headings, prominent metric values and quieter supporting labels preserve the hierarchy. |
| Chart treatment | Stock chart uses the same indigo line/area, subtle grid, rounded card and segmented period controls. |
| Tables and controls | Shared borders, spacing and button styling extend consistently to watchlists and dialogs. |
| Responsive layout | At 390px, navigation collapses, metrics form two columns, charts stack and tables scroll internally. Document width equals viewport width at both 390px and 1536px. |

Intentional deviations: ten chart periods, member selection, refresh status, initial investment, exchange labels and notes were added to satisfy the expanded request. Letter badges replace logo artwork. Portfolio history displays a truthful first-snapshot state until enough recorded observations exist; the concept's illustrative curve is not used as real history. Final implementation follows the concept's design system, not pixel-for-pixel mockup content.

Browser method: Codex in-app browser used for the running app and accessibility-state verification. Its resized/full-page screenshot output was clipped, so Playwright Chromium was used for reliable 1536×1024 and 390×844 captures and automated interactions.

Screenshots: [Desktop](desktop.png), [Mobile](mobile.png), [Position detail](stock-detail.png). Reference: [Concept](concept.png).

## Boundaries

Members are separate local device profiles without login or access control. Data does not sync across devices. Automatic refresh runs for the selected member while the app and server are open; inactive members catch up when selected. Yahoo Finance is an unofficial public endpoint and quotes may be delayed or unavailable. Portfolio charts accumulate recorded market values; stock charts use available historical prices. No orders, background push alerts, tax reporting or automated corporate-action adjustments are provided.
