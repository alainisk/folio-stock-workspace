import { localWorkspaceFixture } from "./local-workspace-fixture.mjs";
import { chromium, expect } from "@playwright/test";
import { createMembers } from "../src/lib/workspaces.js";
const b = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
});
const p = await b.newPage();
await localWorkspaceFixture(p);
const start = new Date();
await p.clock.install({ time: start });
const data = createMembers();
data.members[0].workspace.lastRefresh = start.toISOString();
await p.addInitScript(
  (d) => localStorage.setItem("folio.members.v2", JSON.stringify(d)),
  data,
);
let calls = 0;
await p.route("**/api/quote?**", async (r) => {
  calls++;
  const u = new URL(r.request().url());
  await r.fulfill({
    json: {
      current: 300,
      previous: 290,
      asOf: start.toISOString(),
      currency: u.searchParams.get("currency"),
      source: "Yahoo Finance",
    },
  });
});
await p.goto(process.env.FOLIO_QA_URL || "http://localhost:5173");
await p
  .getByRole("heading", { name: "Your portfolio, at a glance." })
  .waitFor();
await p.clock.fastForward(899000);
expect(calls).toBe(0);
await p.clock.fastForward(1000);
await expect.poll(() => calls).toBeGreaterThan(0);
console.log(
  "PASS: no scheduled web requests before 15 minutes; automatic requests begin at 15 minutes.",
);
await b.close();
