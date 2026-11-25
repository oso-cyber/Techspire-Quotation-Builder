import type { Section } from "./domain";

export type UserRole = "admin" | "user" | "sales_manager";

export type UserProfile = {
  id: string;
  username: string;
  password: string;
  mustChangePassword: boolean;
  temporaryPasswordIssued?: boolean;
  role: UserRole;
  fullName: string;
  jobTitle: string;
  email: string;
  mobile: string;
  lockedPages?: Section[];
  avatar?: string;
};

const USERS_KEY = "techspire-auth-users-v1";
const SESSION_KEY = "techspire-auth-session-v1";
export const USER_PRESET_LOCKED_PAGES: Section[] = ["packages", "settings"];

const seededUsers: UserProfile[] = [
  {
    id: "nishan-gounder",
    username: "nishan",
    password: "",
    mustChangePassword: false,
    role: "admin",
    fullName: "Nishan Gounder",
    jobTitle: "Sales Director",
    email: "nishan@onesourceict.co.za",
    mobile: "0795244496",
  },
  {
    id: "praveen-gounder",
    username: "praveen",
    password: "",
    mustChangePassword: false,
    role: "admin",
    fullName: "Praveen Gounder",
    jobTitle: "OPS Director",
    email: "praveen@osict.co.za",
    mobile: "0734082231",
  },
  {
    id: "vijay",
    username: "vijay",
    password: "",
    mustChangePassword: false,
    role: "admin",
    fullName: "Vijay",
    jobTitle: "Sales Manager",
    email: "",
    mobile: "",
  },
];

export function loadUsers(): UserProfile[] {
  try {
    const stored = JSON.parse(localStorage.getItem(USERS_KEY) || "null") as UserProfile[] | null;
    if (Array.isArray(stored) && stored.length) {
      const migrated = stored.map((user) =>
        (() => {
          const isSeed = seededUsers.some(({ id }) => id === user.id);
          const role: UserRole = user.role === "admin" || (isSeed && !Array.isArray(user.lockedPages))
            ? "admin" : "user";
          const resetLegacyPassword = isSeed && user.mustChangePassword && !user.temporaryPasswordIssued;
          return {
            ...user,
            password: resetLegacyPassword ? "" : user.password ?? "",
            mustChangePassword: resetLegacyPassword ? false : user.mustChangePassword,
            role,
            lockedPages: role === "admin"
              ? []
              : Array.isArray(user.lockedPages) ? user.lockedPages : [...USER_PRESET_LOCKED_PAGES],
          };
        })(),
      )
      if (JSON.stringify(migrated) !== JSON.stringify(stored)) {
        localStorage.setItem(USERS_KEY, JSON.stringify(migrated))
      }
      if (migrated.some((user) => !user.password)) {
        localStorage.removeItem(SESSION_KEY)
      }

      return migrated
    }
  } catch {
    // Recover from malformed local data by recreating the seed accounts.
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(seededUsers));
  localStorage.removeItem(SESSION_KEY);
  return seededUsers.map((user) => ({ ...user }));
}

export function canAccessSection(user: UserProfile, section: Section) {
  if (section === "users" || section === "history" || section === "backup") return user.role === "admin";
  return user.role === "admin" || !(user.lockedPages ?? USER_PRESET_LOCKED_PAGES).includes(section);
}

export function saveUsers(users: UserProfile[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function getSessionUserId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionUserId(id: string | null) {
  if (id) localStorage.setItem(SESSION_KEY, id);
  else localStorage.removeItem(SESSION_KEY);
}
