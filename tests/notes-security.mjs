import { chromium, expect } from "@playwright/test";
import { createMembers } from "../src/lib/workspaces.js";
const b = await chromium.launch();
const p = await b.newPage();
const seed = createMembers();
seed.members[0].workspace.autoRefresh = false;
seed.members[0].workspace.stockNotes["simulated:USD:NASDAQ:AAPL"] =
  '<p onclick="window.bad=1">Keep this note</p><img src=x onerror="window.bad=1"><script>window.bad=1</script><a href="javascript:window.bad=1">Unsafe link</a><a href="https://example.com">Safe link</a>';
await p.addInitScript(
  (d) => localStorage.setItem("folio.members.v2", JSON.stringify(d)),
  seed,
);
await p.goto("http://localhost:5173");
await p
  .getByRole("button", { name: "View AAPL NASDAQ details", exact: true })
  .click();
await expect(p.locator(".rich-preview")).toContainText("Keep this note");
expect(
  await p
    .locator(
      '.rich-preview script,.rich-preview img,.rich-preview [onclick],.rich-preview a[href^="javascript:"]',
    )
    .count(),
).toBe(0);
await expect(p.getByRole("link", { name: "Safe link" })).toHaveAttribute(
  "href",
  "https://example.com",
);
expect(await p.evaluate(() => window.bad)).toBeUndefined();
console.log(
  "PASS: imported rich notes remove scripts, event handlers, images and javascript links while preserving safe live links.",
);
await b.close();
