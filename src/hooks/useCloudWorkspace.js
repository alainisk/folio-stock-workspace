import { useCallback, useEffect, useRef, useState } from "react";
import { readCloud, writeCloud, watchCloud } from "../lib/firebase";
import { mergeChanges, SyncConflict } from "../lib/cloud-data";
import { validateMembers } from "../lib/workspaces";

export default function useCloudWorkspace(db, user) {
  const [view, setView] = useState({
    data: null,
    status: "Loading your workspace…",
    error: "",
    ready: false,
    dirty: false,
    conflict: false,
  });
  const model = useRef({
    data: null,
    base: null,
    revision: 0,
    dirty: false,
    busy: false,
    stopped: false,
    ready: false,
  });
  const key = `folio.cloud.${user.uid}`;
  const publish = useCallback((extra = {}) => {
    const m = model.current;
    setView((v) => ({
      ...v,
      data: m.data,
      dirty: m.dirty,
      ready: m.ready,
      ...extra,
    }));
  }, []);
  const persist = useCallback(() => {
    const m = model.current;
    if (!m.data) return;
    try {
      if (!m.dirty) {
        localStorage.removeItem(key);
        return;
      }
      localStorage.setItem(
        key,
        JSON.stringify({
          data: m.data,
          base: m.base,
          revision: m.revision,
          dirty: m.dirty,
        }),
      );
    } catch {
      throw Error(
        "This device could not keep a recovery copy. Download a backup before closing if sync fails.",
      );
    }
  }, [key]);
  const sync = useCallback(async () => {
    const m = model.current;
    if (m.busy || m.stopped || !m.ready || m.conflict) return;
    if (!navigator.onLine) {
      publish({ status: "Offline · changes saved on this device" });
      return;
    }
    m.busy = true;
    try {
      publish({
        status: m.dirty ? "Saving…" : "Checking for changes…",
        error: "",
      });
      const remote = await readCloud(db, user.uid);
      if (m.stopped) return;
      if (remote.revision !== m.revision) {
        m.data = m.dirty
          ? validateMembers(mergeChanges(m.base, m.data, remote.data))
          : remote.data;
        m.base = remote.data;
        m.revision = remote.revision;
      }
      while (m.dirty && !m.stopped) {
        const pending = m.data;
        const revision = await writeCloud(db, user.uid, pending, m.revision);
        if (m.stopped) return;
        m.base = pending;
        m.revision = revision;
        m.dirty = m.data !== pending;
        persist();
      }
      persist();
      publish({ status: "Synced", error: "", conflict: false });
    } catch (e) {
      if (m.stopped) return;
      if (e.code === "sync/revision") {
        publish({ status: "Syncing changes from another device…" });
      } else {
        m.conflict = e instanceof SyncConflict;
        publish({
          status: m.conflict ? "Conflicting changes" : "Not synced",
          error: e.message,
          conflict: m.conflict,
        });
      }
    } finally {
      m.busy = false;
    }
  }, [db, user.uid, persist, publish]);
  useEffect(() => {
    const m = model.current;
    m.stopped = false;
    let unsub,
      active = true;
    (async () => {
      try {
        let cached = null;
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            cached = JSON.parse(raw);
            validateMembers(cached.data);
            if (cached.base) validateMembers(cached.base);
          }
        } catch {
          throw Error(
            "A saved recovery copy could not be read. Export your browser backup before clearing any storage.",
          );
        }
        const remote = await readCloud(db, user.uid);
        if (!active) return;
        m.base = remote.data;
        m.revision = remote.revision;
        m.data = remote.data;
        if (cached?.dirty) {
          m.data = cached.data;
          m.base = cached.base;
          m.revision = cached.revision;
          m.dirty = true;
        }
        m.ready = true;
        publish({ status: m.dirty ? "Pending changes" : "Synced", error: "" });
        unsub = watchCloud(
          db,
          user.uid,
          (revision) => {
            m.latestRevision = Math.max(m.latestRevision || 0, revision);
            if (revision !== m.revision) void sync();
          },
          (e) => publish({ status: "Not synced", error: e.message }),
        );
        if (m.dirty) void sync();
      } catch (e) {
        if (active)
          publish({
            status: "Unable to load your workspace",
            error: e.message,
          });
      }
    })();
    const timer = setInterval(() => {
      if (m.dirty || m.latestRevision > m.revision) void sync();
    }, 5000);
    const wake = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const before = (e) => {
      if (m.dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("beforeunload", before);
    return () => {
      active = false;
      m.stopped = true;
      unsub?.();
      clearInterval(timer);
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("beforeunload", before);
    };
  }, [db, user.uid, key, publish, sync]);
  const setData = useCallback(
    (next) => {
      const m = model.current;
      if (!m.ready) return;
      m.data = typeof next === "function" ? next(m.data) : next;
      m.dirty = true;
      let error = "";
      try {
        persist();
      } catch (e) {
        error = e.message;
      }
      publish({
        status: navigator.onLine
          ? "Changes pending"
          : "Offline · changes saved on this device",
        error,
      });
    },
    [persist, publish],
  );
  useEffect(() => {
    if (!view.dirty) return;
    const timer = setTimeout(sync, 600);
    return () => clearTimeout(timer);
  }, [view.data, view.dirty, sync]);
  const useRemote = async () => {
    const m = model.current;
    if (m.busy) return;
    m.busy = true;
    try {
      const remote = await readCloud(db, user.uid);
      m.data = remote.data;
      m.base = remote.data;
      m.revision = remote.revision;
      m.dirty = false;
      m.conflict = false;
      persist();
      publish({ status: "Synced", error: "", conflict: false });
    } catch (e) {
      publish({ error: e.message });
    } finally {
      m.busy = false;
    }
  };
  return { ...view, setData, sync, useRemote };
}
