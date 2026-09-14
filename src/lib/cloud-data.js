import { validateMembers } from "./workspaces.js";

// Firestore commits are capped at 10 MiB. Leave room for document metadata.
export const MAX_CLOUD_BYTES = 6_000_000;
export function serializeWorkspace(data) {
  validateMembers(data);
  const payload = JSON.stringify(data);
  if (new TextEncoder().encode(payload).length > MAX_CLOUD_BYTES)
    throw Error(
      "This workspace exceeds the 6 MB sync limit. Download a backup before reducing its history. Your changes remain on this device.",
    );
  // UTF-16 chunks are at most 600 KB in UTF-8, below Firestore's 1 MiB document cap.
  const chunks = [];
  for (let start = 0; start < payload.length;) {
    let end = Math.min(start + 150000, payload.length);
    const last = payload.charCodeAt(end - 1);
    if (end < payload.length && last >= 0xd800 && last <= 0xdbff) end--;
    chunks.push(payload.slice(start, end));
    start = end;
  }
  return chunks;
}
export function deserializeWorkspace(chunks) {
  return validateMembers(JSON.parse(chunks.join("")));
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export class SyncConflict extends Error {
  constructor() {
    super(
      "This workspace changed on another device. Download your pending changes before loading the cloud version.",
    );
    this.name = "SyncConflict";
  }
}
// Merge independent edits; conflicting edits to the same value require an explicit choice.
export function mergeChanges(base, local, remote, field = "") {
  if (equal(local, base)) return remote;
  if (equal(remote, base) || equal(local, remote)) return local;
  // Refresh metadata and downloaded prices can change simultaneously on open devices.
  if (
    field === "lastRefresh" &&
    [local, remote].every(
      (v) => typeof v === "string" && Number.isFinite(Date.parse(v)),
    )
  )
    return Date.parse(local) > Date.parse(remote) ? local : remote;
  if (local?.source === "Yahoo Finance" && remote?.source === "Yahoo Finance")
    return Date.parse(local.asOf) > Date.parse(remote.asOf) ? local : remote;
  if (field === "snapshots" && Array.isArray(local) && Array.isArray(remote)) {
    const snapshots = new Map();
    const realScopes = new Set(
      [...local, ...remote]
        .filter((s) => !s.illustrative)
        .map((s) => `${s.portfolio}:${s.currency}`),
    );
    for (const s of [...local, ...remote].sort((a, b) =>
      a.at.localeCompare(b.at),
    )) {
      const scope = `${s.portfolio}:${s.currency}`;
      if (s.illustrative && realScopes.has(scope)) continue;
      snapshots.set(`${scope}:${s.at.slice(0, 16)}`, s);
    }
    return [...snapshots.values()]
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(-5000);
  }
  if (
    [base, local, remote].every(
      (v) => v && !Array.isArray(v) && typeof v === "object",
    )
  ) {
    const out = {};
    for (const k of new Set([
      ...Object.keys(base),
      ...Object.keys(local),
      ...Object.keys(remote),
    ])) {
      const v = mergeChanges(base[k], local[k], remote[k], k);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (
    [base, local, remote].every(
      (v) => Array.isArray(v) && v.every((x) => x && typeof x.id === "string"),
    )
  ) {
    const maps = [base, local, remote].map(
      (a) => new Map(a.map((x) => [x.id, x])),
    );
    const out = [];
    for (const id of new Set([
      ...remote.map((x) => x.id),
      ...local.map((x) => x.id),
      ...base.map((x) => x.id),
    ])) {
      const v = mergeChanges(...maps.map((m) => m.get(id)));
      if (v !== undefined) out.push(v);
    }
    return out;
  }
  throw new SyncConflict();
}
