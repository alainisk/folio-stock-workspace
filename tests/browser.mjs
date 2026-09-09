import { createMembers } from "../src/lib/workspaces.js";
import { chromium, expect } from "@playwright/test";
import { initialState } from "../src/lib/seed.js";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const starting = createMembers();
starting.members[0].workspace.autoRefresh = false;
await page.addInitScript((d) => {
  if (!localStorage.getItem("folio.members.v2"))
    localStorage.setItem("folio.members.v2", JSON.stringify(d));
}, starting);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const button = (name) => page.getByRole("button", { name, exact: true });
const metrics = () => page.locator(".metrics").innerText();
await page.goto("http://localhost:5173");
await expect(button("1D")).toBeVisible();
await button("1D").click();
await expect(button("1D")).toHaveAttribute("aria-pressed", "true");
await button("3M").click();
await button("Actual holdings").click();
await button("Add purchase").first().click();
await page
  .getByLabel("Market / exchange", { exact: true })
  .selectOption("XETRA");
await expect(page.getByLabel("Purchase currency", { exact: true })).toHaveValue(
  "EUR",
);
await page.getByLabel("Stock symbol", { exact: true }).fill("SAP");
await page.getByLabel("Company name", { exact: true }).fill("SAP SE");
await page.getByLabel("Number of shares", { exact: true }).fill("10");
await page
  .getByLabel("Purchase price per share (EUR)", { exact: true })
  .fill("100");
await page.getByLabel("Fees (EUR)", { exact: true }).fill("5");
await expect(
  page.getByText("Initial investment: €1,000.00", { exact: false }),
).toBeVisible();
await button("Save purchase").click();
await expect(
  page.getByRole("combobox", { name: "Portfolio currency" }),
).toHaveValue("EUR");
await expect(button("View SAP XETRA details")).toBeVisible();
await button("Update prices").click();
await page.getByLabel("SAP XETRA current price", { exact: true }).fill("120");
await page.getByLabel("SAP XETRA previous close", { exact: true }).fill("110");
await button("Save selected prices").click();
await expect(page.locator(".metrics")).toContainText("€1,200.00");
await expect(page.locator(".metrics")).toContainText("€1,000.00");
await expect(page.locator(".metrics")).toContainText("+€195.00");
await button("View SAP XETRA details").click();
await button("Record sale").click();
await page.getByLabel("Number of shares", { exact: true }).fill("4");
await page
  .getByLabel("Sale price per share (EUR)", { exact: true })
  .fill("115");
await page.getByLabel("Fees (EUR)", { exact: true }).fill("2");
await button("Save sale").click();
await expect(page.locator(".metrics")).toContainText("€720.00");
await expect(page.locator(".metrics")).toContainText("+€173.00");
await button("View SAP XETRA details").click();
await button("Add dividend").click();
await page.getByLabel("Dividend received (EUR)", { exact: true }).fill("20");
await button("Save dividend").click();
await expect(page.locator(".metrics")).toContainText("+€193.00");
await page.reload();
await button("Actual holdings").click();
await page
  .getByRole("combobox", { name: "Portfolio currency" })
  .selectOption("EUR");
await expect(page.locator(".metrics")).toContainText("+€193.00");
await page
  .getByRole("combobox", { name: "Portfolio currency" })
  .selectOption("CAD");
await expect(
  page.getByRole("heading", { name: "Make your first move" }),
).toBeVisible();
await page
  .getByRole("combobox", { name: "Portfolio currency" })
  .selectOption("EUR");
await button("Watchlist").click();
await button("Add symbol").first().click();
await page.getByLabel("Market / exchange", { exact: true }).selectOption("EPA");
await page.getByLabel("Symbol", { exact: true }).fill("MC");
await page.getByLabel("Company name", { exact: true }).fill("LVMH");
await page
  .getByLabel("Target price (EUR, optional)", { exact: true })
  .fill("500");
await page
  .getByRole("dialog")
  .getByRole("button", { name: "Add symbol", exact: true })
  .click();
await button("View MC EPA details").click();
await button("Update price").click();
await page.getByLabel("MC EPA current price", { exact: true }).fill("480");
await page.getByLabel("MC EPA previous close", { exact: true }).fill("490");
await button("Save selected prices").click();
await expect(page.getByText(/Target reached/)).toBeVisible();
await button("Holdings").click();
await expect(
  page.getByRole("columnheader", { name: "Initial investment", exact: true }),
).toBeVisible();
const dl = page.waitForEvent("download");
await button("Export").click();
const d = await dl;
if (!d.suggestedFilename().endsWith(".csv")) throw Error("CSV export missing");
await button("Settings").click();
await page.locator("input[type=file]").setInputFiles({
  name: "clean.json",
  mimeType: "application/json",
  buffer: Buffer.from(JSON.stringify(initialState())),
});
await button("Confirm").click();
await button("Overview").click();
await button("Actual holdings").click();
await expect(
  page.getByRole("heading", { name: "Make your first move" }),
).toBeVisible();
await page
  .getByRole("combobox", { name: "Portfolio currency" })
  .selectOption("USD");
await button("Simulated").click();
await expect(button("View NVDA NASDAQ details")).toBeVisible();
await page.setViewportSize({ width: 390, height: 844 });
await expect(button("Open navigation")).toBeVisible();
await button("Open navigation").click();
await page
  .getByRole("navigation")
  .getByRole("button", { name: "Holdings", exact: true })
  .click();
await expect(
  page.getByRole("heading", { name: "Every position. In perspective." }),
).toBeVisible();
const dims = await page.evaluate(() => ({
  width: innerWidth,
  scroll: document.documentElement.scrollWidth,
}));
if (dims.width !== dims.scroll)
  throw Error(`Mobile overflow: ${JSON.stringify(dims)}`);
if (errors.length) throw Error(errors.join("\n"));
console.log(
  "PASS: 1D chart, EUR/market purchase, initial investment, manual quote, sale, dividend, persistence, CAD separation, watchlist target, CSV export, backup restore, mobile navigation. No browser errors.",
);
await browser.close();
