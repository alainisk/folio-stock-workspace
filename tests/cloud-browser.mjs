// Explicit integration check against a configured Firebase project. Uses disposable users
// and removes only their generated documents/accounts in finally.
import { chromium, expect } from "@playwright/test";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  deleteUser,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  terminate,
} from "firebase/firestore";
import { readCloud, writeCloud } from "../src/lib/firebase.js";
import { createMembers } from "../src/lib/workspaces.js";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const url = process.env.FOLIO_QA_URL;
if (!url)
  throw Error(
    "Set FOLIO_QA_URL to the app to test. This creates and cleans up disposable Firebase accounts.",
  );
const config = await fetch(`${url}/api/firebase-config`).then((r) => r.json());
const entries = [];
let browser;
const errors = [];
try {
  for (let i = 0; i < 2; i++) {
    const app = initializeApp(config, `qa-${randomUUID()}`),
      auth = getAuth(app),
      db = getFirestore(app);
    const email = `folio-qa-${randomUUID()}@example.com`,
      password = `Qa!${randomUUID()}`;
    const { user } = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    entries.push({ app, auth, db, user, email, password });
  }
  const [a, b] = entries;
  browser = await chromium.launch({ channel: "chrome", headless: true });
  const desktop = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
  const p = await desktop.newPage(),
    q = await mobile.newPage();
  for (const page of [p, q]) {
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/history?**", (r) =>
      r.fulfill({ json: { points: [] } }),
    );
    await page.route("**/api/quote?**", (r) =>
      r.fulfill({ status: 502, json: { error: "QA uses saved quotes" } }),
    );
  }
  const seed = createMembers();
  seed.members[0].workspace.autoRefresh = false;
  await p.addInitScript((data) => {
    if (!localStorage.getItem("folio.members.v2"))
      localStorage.setItem("folio.members.v2", JSON.stringify(data));
  }, seed);
  async function login(page, entry) {
    await page.goto(url);
    await page.getByLabel("Email", { exact: true }).fill(entry.email);
    await page.getByLabel("Password", { exact: true }).fill(entry.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
  }
  await login(p, a);
  await p.getByRole("button", { name: "Import this browser’s data" }).click();
  await expect(p.locator(".sync-status")).toHaveText("Synced", {
    timeout: 30000,
  });
  assert.equal(
    (await readCloud(a.db, a.user.uid)).data.members[0].workspace.transactions
      .length,
    seed.members[0].workspace.transactions.length,
  );
  await login(q, a);
  await expect(
    q.getByRole("heading", { name: "Your portfolio, at a glance." }),
  ).toBeVisible({ timeout: 30000 });
  // Desktop changes arrive on a separate mobile session.
  await p.getByRole("button", { name: "Manage members" }).click();
  await p.getByLabel("New member name").fill("Cross-device QA");
  await p.getByRole("button", { name: "Create member", exact: true }).click();
  await expect(q.getByLabel("Current member")).toContainText(
    "Cross-device QA",
    { timeout: 30000 },
  );
  // A mobile edit survives going offline, then uploads on reconnect.
  await mobile.setOffline(true);
  await q.getByRole("button", { name: "Manage members" }).click();
  await q.getByLabel("Rename selected member").fill("Mobile offline edit");
  await q.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(q.locator(".sync-status")).toContainText("Offline");
  await mobile.setOffline(false);
  await expect(p.getByLabel("Current member")).toContainText(
    "Mobile offline edit",
    { timeout: 30000 },
  );
  await q
    .getByRole("button", { name: "Close dialog" })
    .click()
    .catch(() => {});
  await p.getByLabel("Current member").selectOption("me");
  await expect(q.getByLabel("Current member")).toHaveValue("me", {
    timeout: 30000,
  });
  await p.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(
    p.getByRole("button", { name: "Export", exact: true }),
  ).toHaveCSS("background-color", "rgb(27, 32, 49)");
  await p.screenshot({ path: "/private/tmp/folio-dashboard-dark.png" });
  await p.reload();
  await expect(
    p.getByRole("button", { name: "Switch to light mode" }),
  ).toBeVisible();
  await p.getByRole("button", { name: "Switch to light mode" }).click();
  await p.screenshot({ path: "/private/tmp/folio-dashboard-light.png" });
  await q.screenshot({ path: "/private/tmp/folio-dashboard-mobile.png" });
  assert.equal(
    await q.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await q.setViewportSize({ width: 834, height: 1112 });
  await q.screenshot({ path: "/private/tmp/folio-dashboard-tablet.png" });
  assert.equal(
    await q.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  // CAS prevents a stale device from replacing a newer cloud revision.
  const saved = await readCloud(a.db, a.user.uid);
  await assert.rejects(
    writeCloud(a.db, a.user.uid, saved.data, saved.revision - 1),
    (e) => e.code === "sync/revision",
  );
  const other = doc(b.db, "folioWorkspaces", a.user.uid);
  await assert.rejects(getDoc(other), (e) => e.code === "permission-denied");
  await assert.rejects(
    setDoc(other, { revision: 1 }),
    (e) => e.code === "permission-denied",
  );
  const guestApp = initializeApp(config, `guest-${randomUUID()}`),
    guestDb = getFirestore(guestApp);
  try {
    await assert.rejects(
      getDoc(doc(guestDb, "folioWorkspaces", a.user.uid)),
      (e) => e.code === "permission-denied",
    );
  } finally {
    await terminate(guestDb);
    await deleteApp(guestApp);
  }
  await assert.rejects(
    setDoc(doc(a.db, "folioWorkspaces", a.user.uid), { revision: -1 }),
    (e) => e.code === "permission-denied",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: local import, desktop/mobile live sync, offline recovery, theme persistence, desktop/mobile/tablet rendering, stale-write rejection, account isolation, anonymous denial, invalid data denial.",
  );
} finally {
  await browser?.close();
  for (const { app, db, user } of entries) {
    const chunks = await getDocs(
      collection(db, "folioWorkspaces", user.uid, "chunks"),
    );
    await Promise.all(chunks.docs.map((d) => deleteDoc(d.ref)));
    await deleteDoc(doc(db, "folioWorkspaces", user.uid));
    await deleteUser(user);
    await terminate(db);
    await deleteApp(app);
  }
}
