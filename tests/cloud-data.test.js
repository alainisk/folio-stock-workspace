import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeChanges,
  SyncConflict,
  serializeWorkspace,
  deserializeWorkspace,
} from "../src/lib/cloud-data.js";
import { createMembers, emptyWorkspace } from "../src/lib/workspaces.js";
test("independent devices preserve separate edits and added transactions", () => {
  const base = {
    notes: { A: "old", B: "old" },
    transactions: [{ id: "one", amount: 1 }],
  };
  const a = structuredClone(base),
    b = structuredClone(base);
  a.notes.A = "desktop";
  b.notes.B = "phone";
  a.transactions.push({ id: "two", amount: 2 });
  b.transactions.push({ id: "three", amount: 3 });
  const merged = mergeChanges(base, a, b);
  assert.deepEqual(merged.notes, { A: "desktop", B: "phone" });
  assert.deepEqual(
    new Set(merged.transactions.map((t) => t.id)),
    new Set(["one", "two", "three"]),
  );
});
test("competing edits and deletion versus modification are never silently overwritten", () => {
  assert.throws(() => mergeChanges({ n: 1 }, { n: 2 }, { n: 3 }), SyncConflict);
  assert.throws(
    () => mergeChanges([{ id: "a", n: 1 }], [], [{ id: "a", n: 2 }]),
    SyncConflict,
  );
  assert.deepEqual(
    mergeChanges([{ id: "a", n: 1 }], [], [{ id: "a", n: 1 }]),
    [],
  );
});
test("cloud serialization round trips unicode across chunk boundaries", () => {
  const data = createMembers(emptyWorkspace());
  data.members[0].workspace.stockNotes = Object.fromEntries(
    Array.from({ length: 8 }, (_, i) => [
      `simulated:USD:NASDAQ:T${i}`,
      "💜".repeat(20000),
    ]),
  );
  const chunks = serializeWorkspace(data);
  assert.ok(chunks.length > 1);
  assert.deepEqual(deserializeWorkspace(chunks), data);
  assert.throws(() => deserializeWorkspace(['{"version":1}']));
});
test("simultaneous automatic refreshes merge without a user-edit conflict", () => {
  const base = {
    lastRefresh: "2026-09-13T10:00:00Z",
    snapshots: [],
    quotes: {
      A: { source: "Yahoo Finance", asOf: "2026-09-13T10:00:00Z", current: 10 },
    },
  };
  const local = {
    lastRefresh: "2026-09-13T10:15:01Z",
    snapshots: [
      {
        portfolio: "actual",
        currency: "USD",
        at: "2026-09-13T10:15:01Z",
        value: 11,
      },
    ],
    quotes: {
      A: { source: "Yahoo Finance", asOf: "2026-09-13T10:15:00Z", current: 11 },
    },
  };
  const remote = {
    lastRefresh: "2026-09-13T10:15:02Z",
    snapshots: [
      {
        portfolio: "actual",
        currency: "USD",
        at: "2026-09-13T10:15:02Z",
        value: 12,
      },
    ],
    quotes: {
      A: { source: "Yahoo Finance", asOf: "2026-09-13T10:15:01Z", current: 12 },
    },
  };
  const merged = mergeChanges(base, local, remote);
  assert.equal(merged.lastRefresh, remote.lastRefresh);
  assert.equal(merged.quotes.A.current, 12);
  assert.equal(merged.snapshots.length, 1);
  assert.equal(merged.snapshots[0].value, 12);
  assert.throws(
    () =>
      mergeChanges(
        { source: "Manual", current: 10 },
        { source: "Manual", current: 11 },
        { source: "Manual", current: 12 },
      ),
    SyncConflict,
  );
});
