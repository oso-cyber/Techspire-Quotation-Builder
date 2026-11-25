import { useState, type FormEvent } from "react";
import { createId, type Section } from "./domain";
import {
  USER_PRESET_LOCKED_PAGES,
  type UserProfile,
  type UserRole,
} from "./auth";

const manageablePages: Array<{ section: Section; label: string }> = [
  { section: "dashboard", label: "Dashboard" },
  { section: "builder", label: "New quotation" },
  { section: "packages", label: "Packages" },
  { section: "templates", label: "Quotation templates" },
  { section: "clients", label: "Clients" },
  { section: "my-quotes", label: "My quotations" },
  { section: "settings", label: "Settings" },
];

type NewAccount = {
  username: string;
  fullName: string;
  jobTitle: string;
  email: string;
  mobile: string;
  password: string;
  role: UserRole;
  lockedPages: Section[];
};

const emptyAccount: NewAccount = {
  username: "",
  fullName: "",
  jobTitle: "",
  email: "",
  mobile: "",
  password: "",
  role: "user",
  lockedPages: [...USER_PRESET_LOCKED_PAGES],
};

function PagePermissions({ lockedPages, onChange }: {
  lockedPages: Section[];
  onChange: (lockedPages: Section[]) => void;
}) {
  return <fieldset className="users-page-locks">
    <legend>Page access</legend>
    <p>Check a page to allow access. Backup &amp; restore, Quotation history, and Users &amp; permissions are reserved for admins.</p>
    {manageablePages.map(({ section, label }) => <label className="check-field" key={section}>
      <input type="checkbox" checked={!lockedPages.includes(section)} onChange={(event) =>
        onChange(event.target.checked ? lockedPages.filter((page) => page !== section) : [...lockedPages, section])
      } />
      <span>{label}</span>
    </label>)}
    <button type="button" className="button button-secondary button-compact" onClick={() => onChange([...USER_PRESET_LOCKED_PAGES])}>Reset to User preset</button>
  </fieldset>;
}

export function UsersPage({
  users,
  currentUserId,
  onSaveUsers,
}: {
  users: UserProfile[];
  currentUserId: string;
  onSaveUsers: (users: UserProfile[]) => void;
}) {
  const [selectedId, setSelectedId] = useState(users[0]?.id ?? "");
  const [draftsById, setDraftsById] = useState<Record<string, UserProfile>>({});
  const [newAccount, setNewAccount] = useState<NewAccount>(emptyAccount);
  const [error, setError] = useState("");
  const selected = users.find((user) => user.id === selectedId);
  const draft = selected
    ? draftsById[selected.id] ?? selected
    : null;

  function setDraft(next: UserProfile) {
    setDraftsById((current) => ({ ...current, [next.id]: next }));
  }

  function changeRole(role: UserRole) {
    if (!draft) return;
    setDraft({
      ...draft,
      role,
      lockedPages: role === "admin"
        ? []
        : draft.role === "admin" ? [...USER_PRESET_LOCKED_PAGES] : [...(draft.lockedPages ?? [])],
    });
  }

  function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    if (selected?.role === "admin" && draft.role !== "admin" &&
      users.filter((user) => user.role === "admin").length === 1) {
      setError("At least one administrator account must remain.");
      return;
    }
    onSaveUsers(users.map((user) => user.id === draft.id ? draft : user));
    setDraftsById((current) => {
      const remaining = { ...current };
      delete remaining[draft.id];
      return remaining;
    });
    setError("");
  }

  function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const username = newAccount.username.trim();
    if (!username) {
      setError("Enter a username.");
      return;
    }
    if (users.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
      setError("That username is already in use.");
      return;
    }
    if (newAccount.password.length < 8) {
      setError("Set an initial password of at least 8 characters.");
      return;
    }
    const user: UserProfile = {
      id: createId(),
      username,
      password: newAccount.password,
      mustChangePassword: true,
      temporaryPasswordIssued: true,
      role: newAccount.role,
      fullName: newAccount.fullName.trim(),
      jobTitle: newAccount.jobTitle.trim(),
      email: newAccount.email.trim(),
      mobile: newAccount.mobile.trim(),
      lockedPages: newAccount.role === "admin" ? [] : newAccount.lockedPages,
    };
    onSaveUsers([...users, user]);
    setSelectedId(user.id);
    setNewAccount(emptyAccount);
    setError("");
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">ACCESS CONTROL</div><h1>Users & permissions</h1><p>Create accounts, choose an access preset, and lock individual pages for regular users.</p></div></div>
    <div className="users-admin-layout">
      <section className="panel users-list-panel">
        <div className="panel-heading"><div><h2>Accounts</h2><p>{users.length} local users</p></div></div>
        <div className="users-list">{users.map((user) =>
          <button type="button" className={`user-list-item ${selectedId === user.id ? "selected" : ""}`} key={user.id} onClick={() => setSelectedId(user.id)}>
            <span className="user-list-avatar">{user.fullName.slice(0, 1).toUpperCase()}</span>
            <span><b>{user.fullName}</b><small>{user.username} · {user.role === "admin" ? "Admin" : "User"}</small></span>
          </button>,
        )}</div>
      </section>

      <div className="users-edit-column">
        {draft && <section className="panel users-edit-panel">
          <div className="panel-heading"><div><h2>Edit account</h2><p>{draft.id === currentUserId ? "Your own account" : "Account access and page visibility"}</p></div></div>
          <form className="users-form" onSubmit={saveAccount}>
            <label className="field"><span>Full name</span><input required value={draft.fullName} onChange={(event) => setDraft({ ...draft, fullName: event.target.value })} /></label>
            <label className="field"><span>Username</span><input disabled value={draft.username} /></label>
            <label className="field"><span>Job title</span><input value={draft.jobTitle} onChange={(event) => setDraft({ ...draft, jobTitle: event.target.value })} /></label>
            <label className="field"><span>Email</span><input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} /></label>
            <label className="field"><span>Mobile</span><input value={draft.mobile} onChange={(event) => setDraft({ ...draft, mobile: event.target.value })} /></label>
            <label className="field"><span>Access preset</span><select value={draft.role === "admin" ? "admin" : "user"} onChange={(event) => changeRole(event.target.value as UserRole)}><option value="user">User</option><option value="admin">Admin</option></select></label>
            {draft.role === "admin"
              ? <p className="users-permission-note">Admin preset: full access to every page and user management.</p>
              : <PagePermissions lockedPages={draft.lockedPages ?? USER_PRESET_LOCKED_PAGES} onChange={(lockedPages) => setDraft({ ...draft, lockedPages })} />}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <div className="users-form-actions"><button className="button button-primary">Save account</button></div>
          </form>
        </section>}

        <section className="panel users-edit-panel">
          <div className="panel-heading"><div><h2>Add a user</h2><p>New accounts must change this initial password on first sign-in.</p></div></div>
          <form className="users-form" onSubmit={addAccount}>
            <label className="field"><span>Full name</span><input required value={newAccount.fullName} onChange={(event) => setNewAccount({ ...newAccount, fullName: event.target.value })} /></label>
            <label className="field"><span>Username</span><input required autoComplete="off" value={newAccount.username} onChange={(event) => setNewAccount({ ...newAccount, username: event.target.value })} /></label>
            <label className="field"><span>Job title</span><input value={newAccount.jobTitle} onChange={(event) => setNewAccount({ ...newAccount, jobTitle: event.target.value })} /></label>
            <label className="field"><span>Email</span><input type="email" value={newAccount.email} onChange={(event) => setNewAccount({ ...newAccount, email: event.target.value })} /></label>
            <label className="field"><span>Mobile</span><input value={newAccount.mobile} onChange={(event) => setNewAccount({ ...newAccount, mobile: event.target.value })} /></label>
            <label className="field"><span>Access preset</span><select value={newAccount.role} onChange={(event) => setNewAccount({ ...newAccount, role: event.target.value as UserRole })}><option value="user">User</option><option value="admin">Admin</option></select></label>
            <label className="field users-wide"><span>Initial password</span><input type="password" required minLength={8} autoComplete="new-password" value={newAccount.password} onChange={(event) => setNewAccount({ ...newAccount, password: event.target.value })} /></label>
            {newAccount.role === "user" && <PagePermissions lockedPages={newAccount.lockedPages} onChange={(lockedPages) => setNewAccount({ ...newAccount, lockedPages })} />}
            {error && <p className="auth-error users-wide" role="alert">{error}</p>}
            <div className="users-form-actions users-wide"><button className="button button-primary">Create account</button></div>
          </form>
        </section>
      </div>
    </div>
    <p className="users-security-note">Accounts and permissions are stored locally on this computer. This local app does not provide server-enforced authentication.</p>
  </>;
}
