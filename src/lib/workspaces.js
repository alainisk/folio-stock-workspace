import { initialState } from "./seed.js";
import { migrate } from "./markets.js";
import { validateBackup } from "./portfolio.js";
export const MEMBERS_STORE = "folio.members.v2";
export function upgradeWorkspace(value) {
  const s = migrate(value);
  const watchlists = s.watchlists || [
    { id: "general", name: "General" },
    { id: "too-late", name: "Too Late" },
    { id: "too-early", name: "Too Early" },
    { id: "now", name: "Now" },
  ];
  return {
    ...s,
    watchlists,
    watchlist: s.watchlist.map((w) => ({
      ...w,
      listId: w.listId || "general",
      referenceShares: w.referenceShares ?? 1,
      referencePrice: w.referencePrice ?? null,
      referenceDate: w.referenceDate || null,
    })),
    stockNotes: s.stockNotes || {},
    autoRefresh: s.autoRefresh ?? true,
    lastRefresh: s.lastRefresh || null,
  };
}
export function emptyWorkspace() {
  return upgradeWorkspace({
    version: 1,
    demo: false,
    transactions: [],
    quotes: {},
    watchlist: [],
    snapshots: [],
    budgets: { USD: 100000, CAD: 100000, EUR: 100000 },
  });
}
export function createMembers(workspace = initialState()) {
  return {
    version: 2,
    activeMemberId: "me",
    members: [{ id: "me", name: "Me", workspace: upgradeWorkspace(workspace) }],
  };
}
export function validateMembers(value) {
  if (
    !value ||
    value.version !== 2 ||
    !Array.isArray(value.members) ||
    !value.members.length ||
    value.members.length > 100
  )
    throw Error("Invalid member workspace backup.");
  const ids = new Set();
  for (const m of value.members) {
    if (
      typeof m.id !== "string" ||
      ids.has(m.id) ||
      typeof m.name !== "string" ||
      !m.name.trim() ||
      m.name.length > 60
    )
      throw Error("Invalid or duplicate member.");
    ids.add(m.id);
    validateBackup(m.workspace);
  }
  if (!ids.has(value.activeMemberId))
    throw Error("The selected member is missing.");
  return value;
}
