import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import { Cloud, LogOut, Download, RefreshCw } from "lucide-react";
import { loadFirebase } from "../lib/firebase";
import {
  createMembers,
  emptyWorkspace,
  validateMembers,
  MEMBERS_STORE,
  upgradeWorkspace,
} from "../lib/workspaces";
import { STORE } from "../lib/seed";
import { validateBackup, download } from "../lib/portfolio";
import useCloudWorkspace from "../hooks/useCloudWorkspace";
import MemberWorkspace from "./MemberWorkspace";
import ThemeToggle from "./ThemeToggle";

function AuthScreen({ auth, setupError, onRetry }) {
  const [mode, setMode] = useState("signin"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    if (!auth) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "signup")
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      else if (mode === "reset") {
        await sendPasswordResetEmail(auth, email.trim());
        setMessage(
          "If an account exists for this email, a password reset link has been sent.",
        );
      } else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      const messages = {
        "auth/invalid-credential": "The email or password is incorrect.",
        "auth/email-already-in-use":
          "An account already uses this email. Sign in or reset your password.",
        "auth/weak-password":
          "Choose a stronger password with at least 8 characters.",
        "auth/too-many-requests":
          "Too many attempts. Please wait and try again.",
        "auth/network-request-failed":
          "Check your internet connection and try again.",
      };
      setError(
        messages[e.code] || "Sign-in could not be completed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <div className="auth-theme">
        <ThemeToggle />
      </div>
      <section className="auth-card">
        <img src="/apple-touch-icon.png" width="52" height="52" alt="Folio" />
        <p className="auth-eyebrow">YOUR WORKSPACE, EVERYWHERE</p>
        <h1>
          {mode === "signup"
            ? "Make room for your portfolio."
            : mode === "reset"
              ? "Reset your password."
              : "Welcome to Folio."}
        </h1>
        <p>
          Sign in with the same account on your phone, tablet and desktop. Your
          portfolios, watchlists and notes stay together.
        </p>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {mode !== "reset" && (
            <label>
              Password
              <input
                type="password"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                minLength={mode === "signup" ? 8 : undefined}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {(error || setupError) && (
            <p role="alert" className="form-error">
              {error || setupError}
            </p>
          )}
          {message && <p role="status">{message}</p>}
          <button className="primary" disabled={!auth || busy}>
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : mode === "reset"
                  ? "Send reset link"
                  : "Sign in"}
          </button>
        </form>
        {setupError && (
          <button className="button" onClick={onRetry}>
            Retry connection
          </button>
        )}
        <div className="auth-links">
          <button
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setError("");
              setMessage("");
            }}
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "Create an account"}
          </button>
          <button
            onClick={() => {
              setMode(mode === "reset" ? "signin" : "reset");
              setError("");
              setMessage("");
            }}
          >
            {mode === "reset" ? "Back to sign in" : "Forgot password?"}
          </button>
        </div>
        <p className="caption">
          Existing browser data stays on this device until you choose to import
          it after signing in.
        </p>
      </section>
    </main>
  );
}
function legacyData() {
  const raw = localStorage.getItem(MEMBERS_STORE);
  if (raw) return validateMembers(JSON.parse(raw));
  const old = localStorage.getItem(STORE);
  return old
    ? createMembers(validateBackup(upgradeWorkspace(JSON.parse(old))))
    : null;
}
function AccountWorkspace({ client, user }) {
  const cloud = useCloudWorkspace(client.db, user);
  const [local] = useState(() => {
    try {
      return { data: legacyData() };
    } catch (e) {
      return { error: e.message };
    }
  });
  const [importError, setImportError] = useState("");
  const backup = () =>
    download("folio-pending-changes.json", JSON.stringify(cloud.data, null, 2));
  async function logout() {
    if (cloud.dirty) return;
    try {
      await signOut(client.auth);
      localStorage.removeItem(`folio.cloud.${user.uid}`);
    } catch (e) {
      setImportError(e.message);
    }
  }
  const account = (
    <div className="account-strip">
      <span
        className={`sync-status ${cloud.error ? "sync-error" : ""}`}
        role="status"
      >
        <Cloud size={15} />
        {cloud.status}
      </span>
      <span className="account-email" title={user.email}>
        {user.email}
      </span>
      {cloud.error && (
        <button className="text-button" onClick={cloud.sync}>
          <RefreshCw size={14} />
          Retry sync
        </button>
      )}
      <button
        className="text-button"
        disabled={cloud.dirty}
        title={
          cloud.dirty
            ? "Wait for sync or resolve pending changes before signing out"
            : "Sign out"
        }
        onClick={logout}
      >
        <LogOut size={14} />
        Sign out
      </button>
    </div>
  );
  if (!cloud.ready)
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Opening your workspace…</h1>
          <p role="status">{cloud.error || cloud.status}</p>
          {cloud.error && (
            <button className="button" onClick={() => location.reload()}>
              Retry
            </button>
          )}
          <button className="text-button" onClick={logout}>
            Sign out
          </button>
        </section>
      </main>
    );
  if (!cloud.data)
    return (
      <main className="auth-page">
        <div className="auth-theme">
          <ThemeToggle />
        </div>
        <section className="auth-card">
          <h1>Your workspace is ready.</h1>
          <p>
            Choose how to start. Once saved, this workspace will be available on
            every device where you sign in.
          </p>
          {local.data && (
            <button
              className="primary"
              onClick={() => cloud.setData(local.data)}
            >
              Import this browser’s data
            </button>
          )}
          <button
            className="button"
            onClick={() => cloud.setData(createMembers(emptyWorkspace()))}
          >
            Start with an empty workspace
          </button>
          {local.error && (
            <p role="alert">
              Your old browser data could not be read. Keep it and restore a
              JSON backup from Settings.
            </p>
          )}
          {account}
        </section>
      </main>
    );
  return (
    <>
      <MemberWorkspace cloud={cloud} accountControls={account} />
      {(cloud.conflict || importError) && (
        <div className="sync-notice" role="alert">
          <strong>
            {cloud.conflict ? "Changes need your attention" : importError}
          </strong>
          {cloud.conflict && (
            <>
              <p>
                Another device edited the same information. Save a copy of your
                pending changes, then load the cloud version. You can restore
                the backup from Settings if needed.
              </p>
              <button className="button" onClick={backup}>
                <Download size={14} />
                Download pending changes
              </button>
              <button
                className="button"
                onClick={() => {
                  backup();
                  void cloud.useRemote();
                }}
              >
                Download & load cloud version
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
export default function CloudApp() {
  const [client, setClient] = useState(null),
    [user, setUser] = useState(undefined),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true,
      unsubscribe;
    loadFirebase()
      .then((c) => {
        if (!active) return;
        setClient(c);
        unsubscribe = onAuthStateChanged(c.auth, (u) => {
          setUser(u);
          setError("");
        });
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setUser(null);
        }
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [attempt]);
  if (user === undefined)
    return (
      <main className="auth-page">
        <p role="status">Connecting to your workspace…</p>
      </main>
    );
  return user && client ? (
    <AccountWorkspace key={user.uid} client={client} user={user} />
  ) : (
    <AuthScreen
      auth={client?.auth}
      setupError={error}
      onRetry={() => {
        setError("");
        setUser(undefined);
        setAttempt((a) => a + 1);
      }}
    />
  );
}
