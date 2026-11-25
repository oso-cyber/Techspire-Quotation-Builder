import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { canAccessSection, loadUsers, saveUsers, USER_PRESET_LOCKED_PAGES } from "./auth";

let values: Map<string, string>;

beforeEach(() => {
  values = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
});

afterEach(() => vi.unstubAllGlobals());

it("seeds all three accounts without a shared password", () => {
  const users = loadUsers();

  expect(users).toHaveLength(3);
  expect(users.every((user) => user.password === "")).toBe(true);
  expect(users.every((user) => user.role === "admin")).toBe(true);
});

it("clears unclaimed legacy temporary passwords for first-run setup", () => {
  const legacyUsers = loadUsers().map((user) => ({
    ...user,
    password: "legacy-password",
    mustChangePassword: true,
  }));
  saveUsers(legacyUsers);
  localStorage.setItem("techspire-auth-session-v1", "nishan-gounder");

  const migratedUsers = loadUsers();

  expect(migratedUsers.every((user) => user.password === "")).toBe(true);
  expect(localStorage.getItem("techspire-auth-session-v1")).toBeNull();
});

it("preserves passwords already configured by users", () => {
  const configuredUsers = loadUsers().map((user, index) => ({
    ...user,
    password: `private-${index}-password`,
  }));
  saveUsers(configuredUsers);

  expect(loadUsers()).toEqual(configuredUsers.map((user) => ({ ...user, lockedPages: [] })));
});

it("migrates existing non-admin seeded accounts to the confirmed admin preset", () => {
  const legacyUsers = loadUsers().map((user) =>
    user.id === "vijay" ? { ...user, role: "sales_manager" as const } : user,
  );
  saveUsers(legacyUsers);

  expect(loadUsers().find((user) => user.id === "vijay")?.role).toBe("admin");
});

it("applies the User preset to legacy non-admin accounts without saved page settings", () => {
  const users = loadUsers();
  const newLegacyUser = {
    ...users[0],
    id: "legacy-user",
    username: "legacy",
    password: "private-password",
    role: "sales_manager" as const,
    lockedPages: undefined,
  };
  saveUsers([...users, newLegacyUser]);

  const migratedUser = loadUsers().find((user) => user.id === "legacy-user");

  expect(migratedUser?.role).toBe("user");
  expect(migratedUser?.lockedPages).toEqual(USER_PRESET_LOCKED_PAGES);
});

it("preserves assigned roles, page locks and new-account passwords after restart", () => {
  const [nishan, praveen, vijay] = loadUsers();
  const accounts = [
    { ...nishan, password: "private-admin-password", lockedPages: [] },
    { ...praveen, password: "private-user-password", role: "user" as const, lockedPages: ["clients" as const] },
    { ...vijay, id: "new-user", password: "initial-password", role: "user" as const,
      mustChangePassword: true, temporaryPasswordIssued: true, lockedPages: [...USER_PRESET_LOCKED_PAGES] },
  ];
  saveUsers(accounts);
  expect(loadUsers()).toEqual(accounts);
});

it("applies User preset locks and keeps those pages accessible to admins", () => {
  const users = loadUsers();
  const regularUser = {
    ...users[0],
    id: "new-user",
    role: "user" as const,
    lockedPages: [...USER_PRESET_LOCKED_PAGES],
  };
  const admin = users[0];

  expect(canAccessSection(regularUser, "packages")).toBe(false);
  expect(canAccessSection(regularUser, "settings")).toBe(false);
  expect(canAccessSection(regularUser, "builder")).toBe(true);
  expect(canAccessSection(regularUser, "users")).toBe(false);
  expect(canAccessSection(regularUser, "history")).toBe(false);
  expect(canAccessSection({ ...regularUser, lockedPages: [] }, "backup")).toBe(false);
  expect(canAccessSection({ ...regularUser, lockedPages: [] }, "packages")).toBe(true);
  expect(canAccessSection(admin, "packages")).toBe(true);
  expect(canAccessSection(admin, "backup")).toBe(true);
  expect(canAccessSection(admin, "users")).toBe(true);
  expect(canAccessSection(admin, "history")).toBe(true);
});
