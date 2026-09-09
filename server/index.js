import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chart } from "./market-data.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = express();
app.get("/api/status", (_req, res) =>
  res.json({
    provider: "Yahoo Finance",
    configured: true,
    markets: ["US", "Canada", "Europe"],
    refreshMinutes: 15,
    mode: "public-web-data",
  }),
);
const params = (req) => ({
  symbol: String(req.query.symbol || "").toUpperCase(),
  exchange: String(req.query.exchange || "NASDAQ"),
  currency: String(req.query.currency || "USD"),
});
app.get("/api/quote", async (req, res) => {
  try {
    const { symbol, exchange, currency } = params(req);
    const { points, ...quote } = await chart(symbol, exchange, currency, "1D");
    res.json(quote);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
app.get("/api/history", async (req, res) => {
  try {
    const { symbol, exchange, currency } = params(req);
    res.json(
      await chart(symbol, exchange, currency, String(req.query.period || "3M")),
    );
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(root, "dist/index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    root,
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT) || 5173;
app.listen(port, "0.0.0.0", () =>
  console.log(`Folio is ready at http://localhost:${port}`),
);
