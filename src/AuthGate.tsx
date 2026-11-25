import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  getSessionUserId,
  loadUsers,
  saveUsers,
  setSessionUserId,
  type UserProfile,
} from "./auth";
import "./auth.css";

type Props = { children: (user: UserProfile, users: UserProfile[], onSaveUsers: (users: UserProfile[]) => void) => ReactNode };
type PasswordPair = { password: string; confirmation: string };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "TS";
}

export default function AuthGate({ children }: Props) {
  const [users, setUsers] = useState(loadUsers);
  const [sessionId, setSessionId] = useState(getSessionUserId);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupPasswords, setSetupPasswords] = useState<Record<string, PasswordPair>>({});

  const currentUser = useMemo(
    () => users.find((user) => user.id === sessionId) || null,
    [sessionId, users],
  );
  const needsInitialSetup = users.some((user) => !user.password && !user.mustChangePassword);

  function updateUser(next: UserProfile) {
    const nextUsers = users.map((user) => user.id === next.id ? next : user);
    setUsers(nextUsers);
    saveUsers(nextUsers);
  }

  function updateUsers(nextUsers: UserProfile[]) {
    if (currentUser?.role !== "admin") return;
    setUsers(nextUsers);
    saveUsers(nextUsers);
  }

  function login(event: FormEvent) {
    event.preventDefault();
    const normalized = username.trim().toLowerCase();
    const match = users.find((user) => user.password && user.username.toLowerCase() === normalized && user.password === password);
    if (!match) {
      setError("The username or password is incorrect.");
      return;
    }
    setError("");
    setSessionUserId(match.id);
    setSessionId(match.id);
  }

  function updateSetupPassword(userId: string, field: keyof PasswordPair, value: string) {
    setSetupPasswords((current) => {
      const currentFields = current[userId] ?? { password: "", confirmation: "" };
      return { ...current, [userId]: { ...currentFields, [field]: value } };
    });
  }

  function finishInitialSetup(event: FormEvent) {
    event.preventDefault();
    const passwords = users.map((user) => setupPasswords[user.id] ?? { password: "", confirmation: "" });
    if (passwords.some(({ password }) => password.length < 8)) {
      setError("Choose a password of at least 8 characters for every account.");
      return;
    }
    if (passwords.some(({ password, confirmation }) => password !== confirmation)) {
      setError("Each account's password and confirmation must match.");
      return;
    }
    if (new Set(passwords.map(({ password }) => password)).size !== users.length) {
      setError("Use a different password for each account.");
      return;
    }
    const configuredUsers = users.map((user, index) => ({
      ...user,
      password: passwords[index].password,
      mustChangePassword: false,
    }));
    saveUsers(configuredUsers);
    setUsers(configuredUsers);
    setError("");
  }

  function finishPasswordSetup(event: FormEvent) {
    event.preventDefault();
    if (!currentUser) return;
    if (newPassword.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    if (newPassword === currentUser.password) {
      setError("Choose a password different from your current password.");
      return;
    }
    updateUser({ ...currentUser, password: newPassword, mustChangePassword: false, temporaryPasswordIssued: false });
    setError("");
  }

  if (needsInitialSetup) {
    return <main className="auth-shell">
      <section className="auth-card auth-card-setup">
        <div className="auth-brand"><span>ts</span><div><strong>TECHSPIRE IT</strong><small>QUOTATION BUILDER</small></div></div>
        <div className="auth-heading"><small>FIRST-TIME SETUP</small><h1>Create account passwords</h1><p>Set a separate password for each person. These are saved on this computer.</p></div>
        <form onSubmit={finishInitialSetup} className="auth-form">
          {users.map((user) => {
            const fields = setupPasswords[user.id] ?? { password: "", confirmation: "" };
            return <fieldset className="account-password-set" key={user.id}>
              <legend>{user.fullName} <span>({user.username})</span></legend>
              <label>New password<input type="password" value={fields.password} onChange={(event) => updateSetupPassword(user.id, "password", event.target.value)} autoComplete="new-password" /></label>
              <label>Confirm password<input type="password" value={fields.confirmation} onChange={(event) => updateSetupPassword(user.id, "confirmation", event.target.value)} autoComplete="new-password" /></label>
            </fieldset>;
          })}
          {error && <p className="auth-error">{error}</p>}
          <button type="submit">Save passwords and continue</button>
        </form>
        <p className="auth-help">Use different passwords, with at least 8 characters each.</p>
      </section>
    </main>;
  }

  if (!currentUser) {
    return <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><span>ts</span><div><strong>TECHSPIRE IT</strong><small>QUOTATION BUILDER</small></div></div>
        <div className="auth-heading"><small>SECURE LOCAL WORKSPACE</small><h1>Welcome back</h1><p>Sign in to create, manage and approve quotations.</p></div>
        <form onSubmit={login} className="auth-form">
          <label>Username<input autoFocus value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit">Sign in</button>
        </form>
        <p className="auth-help">If you can’t sign in, ask the account administrator to reset your local account.</p>
      </section>
    </main>;
  }

  if (currentUser.mustChangePassword) {
    return <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand"><span>ts</span><div><strong>TECHSPIRE IT</strong><small>QUOTATION BUILDER</small></div></div>
        <div className="auth-heading"><small>FIRST SIGN-IN</small><h1>Secure your account</h1><p>Hello {currentUser.fullName}. Create your private password before continuing.</p></div>
        <form onSubmit={finishPasswordSetup} className="auth-form">
          <label>New password<input autoFocus type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" /></label>
          <label>Confirm password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" /></label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit">Save password and continue</button>
        </form>
      </section>
    </main>;
  }

  return <div className="authenticated-app">
    <div className="session-bar">
      <button className="session-profile" onClick={() => setProfileOpen(true)} title="Edit profile in Settings">
        <span className="session-avatar">{initials(currentUser.fullName)}</span>
        <span><strong>{currentUser.fullName}</strong><small>{currentUser.jobTitle}</small></span>
      </button>
      <button className="session-signout" onClick={() => { setSessionUserId(null); setSessionId(null); }}>Sign out</button>
    </div>
    {children(currentUser, users, updateUsers)}
    {profileOpen && <ProfileDialog user={currentUser} onSave={(next) => { updateUser(next); setProfileOpen(false); }} onClose={() => setProfileOpen(false)} />}
  </div>;
}

function ProfileDialog({ user, onSave, onClose }: { user: UserProfile; onSave: (user: UserProfile) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(user);
  return <div className="profile-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="profile-dialog" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}>
      <header><div><small>SETTINGS / MY PROFILE</small><h2>Personal profile</h2><p>These details identify you inside Techspire quotations.</p></div><button type="button" onClick={onClose} aria-label="Close">×</button></header>
      <div className="profile-grid">
        <label>Full name<input required value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} /></label>
        <label>Role<input value={draft.jobTitle} onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })} /></label>
        <label>Email address<input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
        <label>Mobile number<input value={draft.mobile} onChange={(event) => setDraft({ ...draft, mobile: event.target.value })} /></label>
        <label className="profile-wide">Username<input value={draft.username} disabled /></label>
      </div>
      <footer><button type="button" onClick={onClose}>Cancel</button><button type="submit">Save profile</button></footer>
    </form>
  </div>;
}
