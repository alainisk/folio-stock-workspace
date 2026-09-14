import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  doc,
  runTransaction,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { serializeWorkspace, deserializeWorkspace } from "./cloud-data.js";

let loading;
export function loadFirebase() {
  return (loading ||= (async () => {
    const response = await fetch("/api/firebase-config");
    if (!response.ok)
      throw Error(
        "Cloud sign-in is not configured yet. Please try again shortly.",
      );
    const config = await response.json();
    const app = initializeApp(config);
    const auth = getAuth(app),
      db = getFirestore(app);
    if (
      import.meta.env.DEV &&
      import.meta.env.VITE_FIREBASE_EMULATORS === "true"
    ) {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
      connectFirestoreEmulator(db, "127.0.0.1", 8085);
    }
    return { auth, db };
  })().catch((error) => {
    loading = null;
    throw error;
  }));
}
const root = (db, uid) => doc(db, "folioWorkspaces", uid);
const chunkRef = (db, uid, i) =>
  doc(db, "folioWorkspaces", uid, "chunks", String(i));
export async function readCloud(db, uid) {
  return runTransaction(db, async (tx) => {
    const meta = await tx.get(root(db, uid));
    if (!meta.exists()) return { data: null, revision: 0 };
    const { revision, chunkCount } = meta.data();
    if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > 50)
      throw Error("The saved cloud workspace is invalid.");
    const chunks = await Promise.all(
      Array.from({ length: chunkCount }, (_, i) =>
        tx.get(chunkRef(db, uid, i)),
      ),
    );
    if (chunks.some((c) => !c.exists()))
      throw Error("The cloud backup is incomplete. Please retry.");
    return {
      data: deserializeWorkspace(chunks.map((c) => c.data().value)),
      revision,
    };
  });
}
export async function writeCloud(db, uid, data, expectedRevision) {
  const chunks = serializeWorkspace(data);
  return runTransaction(db, async (tx) => {
    const ref = root(db, uid),
      previous = await tx.get(ref);
    const revision = previous.exists() ? previous.data().revision : 0;
    if (revision !== expectedRevision) {
      const e = Error("Cloud revision changed");
      e.code = "sync/revision";
      throw e;
    }
    chunks.forEach((value, i) => tx.set(chunkRef(db, uid, i), { value }));
    for (let i = chunks.length; i < (previous.data()?.chunkCount || 0); i++)
      tx.delete(chunkRef(db, uid, i));
    tx.set(ref, {
      revision: revision + 1,
      chunkCount: chunks.length,
      schemaVersion: 2,
      updatedAt: serverTimestamp(),
    });
    return revision + 1;
  });
}
export function watchCloud(db, uid, onChange, onError) {
  return onSnapshot(
    root(db, uid),
    (snapshot) => {
      if (!snapshot.metadata.hasPendingWrites)
        onChange(snapshot.data()?.revision || 0);
    },
    onError,
  );
}
