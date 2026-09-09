import { chromium } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1536, height: 1024 },
  deviceScaleFactor: 1,
});
await page.goto("http://localhost:5173");
await page
  .getByRole("button", { name: "View NVDA NASDAQ details", exact: true })
  .waitFor();
await page.evaluate(() => document.fonts.ready);
await page
  .locator(".refresh-status")
  .getByText(/Last checked/)
  .waitFor({ timeout: 25000 });
await page.screenshot({
  path: "docs/design/desktop.png",
  fullPage: true,
  animations: "disabled",
});
console.log(
  await page.evaluate(() => ({
    viewport: innerWidth,
    page: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
  })),
);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: "docs/design/mobile.png",
  fullPage: true,
  animations: "disabled",
});
console.log(
  await page.evaluate(() => ({
    viewport: innerWidth,
    page: document.documentElement.scrollWidth,
  })),
);
await page.setViewportSize({ width: 1536, height: 1024 });
await page
  .getByRole("button", { name: "View NVDA NASDAQ details", exact: true })
  .click();
await page
  .locator(".stock-chart .recharts-surface")
  .waitFor({ timeout: 25000 });
await page.screenshot({
  path: "docs/design/stock-detail.png",
  animations: "disabled",
});
await browser.close();
