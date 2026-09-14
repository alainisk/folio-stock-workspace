import { localWorkspaceFixture } from "./local-workspace-fixture.mjs";
import { chromium, expect } from "@playwright/test";
import { createMembers } from "../src/lib/workspaces.js";
const b = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
});
const page = await b.newPage({ viewport: { width: 1536, height: 1024 } });
await localWorkspaceFixture(page);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const seed = createMembers();
seed.members[0].workspace.autoRefresh = false;
await page.addInitScript((data) => {
  if (!localStorage.getItem("folio.members.v2"))
    localStorage.setItem("folio.members.v2", JSON.stringify(data));
}, seed);
let quoteRequests = 0;
await page.route("**/api/quote?**", async (route) => {
  quoteRequests++;
  const u = new URL(route.request().url());
  await route.fulfill({
    json: {
      symbol: u.searchParams.get("symbol"),
      exchange: u.searchParams.get("exchange"),
      currency: u.searchParams.get("currency"),
      current: 300,
      previous: 295,
      source: "Yahoo Finance",
      asOf: new Date().toISOString(),
    },
  });
});
await page.route("**/api/history?**", async (route) => {
  const u = new URL(route.request().url());
  await route.fulfill({
    json: {
      symbol: u.searchParams.get("symbol"),
      currency: u.searchParams.get("currency"),
      points: [
        { at: "2026-09-01T15:00:00Z", value: 290 },
        { at: "2026-09-02T15:00:00Z", value: 295 },
        { at: "2026-09-03T15:00:00Z", value: 300 },
      ],
    },
  });
});
const btn = (name) => page.getByRole("button", { name, exact: true });
await page.goto(process.env.FOLIO_QA_URL || "http://localhost:5173");
const periods = ["1D", "1W", "1M", "3M", "6M", "1Y", "3Y", "5Y", "10Y", "ALL"];
for (const p of periods) await expect(btn(p)).toBeVisible();
await btn("View AAPL NASDAQ details").click();
const dialog = page.getByRole("dialog");
await expect(
  dialog.getByRole("heading", { name: "Stock performance" }),
).toBeVisible();
for (const p of periods) {
  await dialog.getByRole("button", { name: p, exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: p, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
}
const editor = page.getByRole("textbox", { name: "Stock notes editor" });
await editor.fill("My investment thesis");
await editor.press("ControlOrMeta+a");
await btn("Bold").click();
await expect(editor.locator("strong")).toHaveText("My investment thesis");
await btn("Insert link").click();
await page
  .getByRole("textbox", { name: "Link URL" })
  .fill("https://example.com/research");
await btn("Apply link").click();
await btn("Read notes").click();
await expect(
  dialog.getByRole("link", { name: "My investment thesis" }),
).toHaveAttribute("href", "https://example.com/research");
await btn("Close dialog").click();
await btn("Watchlist").click();
await btn("New watchlist").click();
await page.getByLabel("Watchlist name").fill("Research");
await btn("Save watchlist").click();
await btn("Add symbol").first().click();
await page.getByLabel("Symbol", { exact: true }).fill("AAPL");
await page
  .getByRole("dialog")
  .getByRole("button", { name: "Add symbol", exact: true })
  .click();
await btn("View AAPL NASDAQ details").click();
await expect(
  page.getByRole("link", { name: "My investment thesis" }),
).toBeVisible();
await expect(page.getByRole("dialog")).toContainText(
  "Lifetime investment return",
);
await btn("Close dialog").click();
await btn("Edit AAPL watchlist entry").click();
await page.getByLabel("Watchlist", { exact: true }).selectOption("now");
await btn("Save changes").click();
await expect(btn("View AAPL NASDAQ details")).toBeVisible();
await btn("Rename watchlist").click();
await page.getByLabel("Watchlist name").fill("Buy candidates");
await btn("Save watchlist").click();
await expect(
  page.getByRole("heading", { name: "Buy candidates watchlist" }),
).toBeVisible();
await btn("Manage members").click();
await page.getByLabel("New member name").fill("Second member");
await btn("Create member").click();
await expect(
  page.getByRole("heading", { name: "Make your first move" }),
).toBeVisible();
await btn("Watchlist").click();
await expect(page.getByRole("button", { name: /Research/ })).toHaveCount(0);
await page.getByLabel("Current member").selectOption("me");
await btn("View AAPL NASDAQ details").click();
await expect(
  page.getByRole("link", { name: "My investment thesis" }),
).toBeVisible();
await btn("Close dialog").click();
await btn("Settings").click();
await page.getByLabel("Automatic price updates").check();
await expect.poll(() => quoteRequests).toBeGreaterThan(0);
await btn("Overview").click();
await expect(page.locator(".refresh-status")).toContainText("Last checked");
await expect(page.locator("table")).toContainText("Yahoo Finance");
await page.reload();
await btn("View AAPL NASDAQ details").click();
await expect(
  page.getByRole("link", { name: "My investment thesis" }),
).toBeVisible();
await btn("Close dialog").click();
await page.setViewportSize({ width: 390, height: 844 });
await expect(btn("Open navigation")).toBeVisible();
await btn("View AAPL NASDAQ details").click();
await expect(
  page.getByRole("dialog").getByRole("button", { name: "10Y", exact: true }),
).toBeVisible();
await btn("Close dialog").click();
const size = await page.evaluate(() => [
  innerWidth,
  document.documentElement.scrollWidth,
]);
expect(size[0]).toBe(size[1]);
if (errors.length) throw Error(errors.join("\n"));
console.log(
  "PASS: all chart periods, stock detail history, bold notes and live links, shared holdings/watchlist notes, named watchlist create/move/rename, member isolation, automatic web refresh, persistence, and mobile detail.",
);
await b.close();
