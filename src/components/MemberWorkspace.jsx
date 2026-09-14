import { useState, useEffect, useCallback, useRef } from "react";
import { Users, Plus, Download, Upload } from "lucide-react";
import Workspace from "../App";
import { Modal, Field } from "./Primitives";
import { STORE } from "../lib/seed";
import {
  MEMBERS_STORE,
  createMembers,
  validateMembers,
  emptyWorkspace,
  upgradeWorkspace,
} from "../lib/workspaces";
import { validateBackup, uid, download } from "../lib/portfolio";
function readMembers() {
  try {
    const existing = localStorage.getItem(MEMBERS_STORE);
    if (existing)
      return { data: validateMembers(JSON.parse(existing)), error: "" };
    const old = localStorage.getItem(STORE);
    return {
      data: createMembers(
        old ? validateBackup(upgradeWorkspace(JSON.parse(old))) : undefined,
      ),
      error: "",
    };
  } catch (e) {
    return {
      data: createMembers(),
      error:
        "Saved data could not be read and has not been overwritten. Restore a valid member backup to resume saving.",
    };
  }
}
export default function MemberWorkspace({ cloud, accountControls }) {
  const [loaded] = useState(readMembers),
    [localData, setLocalData] = useState(loaded.data),
    [error, setError] = useState(loaded.error),
    [blocked, setBlocked] = useState(!!loaded.error),
    [manage, setManage] = useState(false),
    [newName, setNewName] = useState(""),
    [rename, setRename] = useState(""),
    [formError, setFormError] = useState(""),
    [restore, setRestore] = useState(null);
  const data = cloud ? cloud.data : localData;
  const setData = cloud ? cloud.setData : setLocalData;
  const file = useRef();
  const member = data.members.find((m) => m.id === data.activeMemberId);
  const setWorkspace = useCallback(
    (next) =>
      setData((d) => ({
        ...d,
        members: d.members.map((m) =>
          m.id === data.activeMemberId
            ? {
                ...m,
                workspace:
                  typeof next === "function" ? next(m.workspace) : next,
              }
            : m,
        ),
      })),
    [data.activeMemberId, setData],
  );
  useEffect(() => {
    if (cloud || blocked) return;
    try {
      localStorage.setItem(MEMBERS_STORE, JSON.stringify(data));
      setError("");
    } catch (e) {
      setError(
        "Changes could not be saved on this device. Download an all-members backup before closing.",
      );
    }
  }, [data, blocked, cloud]);
  function add(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    if (data.members.some((m) => m.name.toLowerCase() === name.toLowerCase()))
      return setFormError("A member with this name already exists.");
    const id = uid();
    setData((d) => ({
      ...d,
      activeMemberId: id,
      members: [...d.members, { id, name, workspace: emptyWorkspace() }],
    }));
    setNewName("");
    setManage(false);
  }
  async function restoreFile(e) {
    try {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 30e6) throw Error("Backup exceeds 30 MB.");
      setRestore(validateMembers(JSON.parse(await f.text())));
    } catch (e) {
      setFormError(e.message);
    }
    e.target.value = "";
  }
  const controls = (
    <div className="member-controls">
      <Users size={15} />
      <select
        aria-label="Current member"
        value={member.id}
        onChange={(e) =>
          setData((d) => ({ ...d, activeMemberId: e.target.value }))
        }
      >
        {data.members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <button
        className="icon-button"
        aria-label="Manage members"
        title="Manage members"
        onClick={() => {
          setRename(member.name);
          setManage(true);
          setFormError("");
        }}
      >
        <Plus size={16} />
      </button>
    </div>
  );
  return (
    <>
      <Workspace
        key={member.id}
        state={member.workspace}
        setState={setWorkspace}
        saveError={cloud ? cloud.error : error}
        accountControls={accountControls}
        isCloud={!!cloud}
        syncStatus={cloud?.status}
        member={member}
        memberControls={controls}
      />
      {manage && (
        <Modal
          title="Members"
          subtitle={
            cloud
              ? "Profiles in your account · synced across your devices"
              : "Separate local profiles · each member has their own complete workspace"
          }
          onClose={() => setManage(false)}
        >
          <div className="form-body">
            <div className="member-list">
              {data.members.map((m) => (
                <button
                  key={m.id}
                  className={m.id === member.id ? "active" : ""}
                  onClick={() => {
                    setData((d) => ({ ...d, activeMemberId: m.id }));
                    setRename(m.name);
                  }}
                >
                  <span className="avatar">
                    {m.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <strong>{m.name}</strong>
                    <small>
                      {m.workspace.transactions.length} transactions ·{" "}
                      {m.workspace.watchlists.length} watchlists
                    </small>
                  </div>
                  {m.id === member.id && <span>Selected</span>}
                </button>
              ))}
            </div>
            <form className="member-form" onSubmit={add}>
              <Field label="New member name">
                <input
                  required
                  maxLength={60}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Alain"
                />
              </Field>
              <button className="primary">
                <Plus size={15} />
                Create member
              </button>
            </form>
            <form
              className="member-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!rename.trim()) return;
                setData((d) => ({
                  ...d,
                  members: d.members.map((m) =>
                    m.id === member.id ? { ...m, name: rename.trim() } : m,
                  ),
                }));
              }}
            >
              <Field label="Rename selected member">
                <input
                  required
                  maxLength={60}
                  value={rename}
                  onChange={(e) => setRename(e.target.value)}
                />
              </Field>
              <button className="button">Save name</button>
            </form>
            <div className="inline wrap member-backups">
              <button
                className="button"
                onClick={() =>
                  download(
                    "folio-all-members.json",
                    JSON.stringify(data, null, 2),
                  )
                }
              >
                <Download size={15} />
                Back up all members
              </button>
              <button className="button" onClick={() => file.current.click()}>
                <Upload size={15} />
                Restore all members
              </button>
              <input
                hidden
                ref={file}
                type="file"
                accept=".json,application/json"
                onChange={restoreFile}
              />
            </div>
            <p className="caption">
              {cloud
                ? "These profiles belong to your signed-in account. Each keeps separate portfolios, watchlists, notes and settings, synced across your devices."
                : "Local profiles keep portfolios, watchlists, notes and settings separate. Anyone using this browser can switch profiles; these are not private sign-in accounts."}
            </p>
            {formError && (
              <p role="alert" className="form-error">
                {formError}
              </p>
            )}
          </div>
        </Modal>
      )}
      {restore && (
        <Modal title="Restore all members?" onClose={() => setRestore(null)}>
          <div className="form-body">
            <p>
              This replaces all current members with the{" "}
              {restore.members.length} profiles in this backup. Save your
              current backup first if you want to keep it.
            </p>
          </div>
          <div className="modal-actions">
            <button className="button" onClick={() => setRestore(null)}>
              Cancel
            </button>
            <button
              className="primary"
              onClick={() => {
                setData(restore);
                setRestore(null);
                setManage(false);
                setBlocked(false);
              }}
            >
              Restore members
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
