export type UserRole = "student" | "teacher" | "admin";

export interface AuthUser {
  id: string;
  academicId: string;
  email: string;
  fullName: string;
  role: UserRole;
  department: string;
  roleTitle: string;
  level?: string;
  semester?: string;
  mustChangePassword: boolean;
}

export interface StoredUser extends AuthUser {
  password: string;
}

export interface DemoAccount {
  academicId: string;
  password: string;
  fullName: string;
  role: UserRole;
  roleTitle: string;
  mustChangePassword: boolean;
}

export const AUTH_USERS_STORAGE_KEY = "academic-iqama.auth.users";
export const AUTH_SESSION_STORAGE_KEY = "academic-iqama.auth.session";

export const DEFAULT_DEMO_USERS: StoredUser[] = [
  {
    id: "student-1",
    academicId: "202312345",
    email: "student@university.edu",
    fullName: "أحمد محمد العتيبي",
    role: "student",
    department: "تقنية المعلومات",
    roleTitle: "طالب - المستوى الرابع",
    level: "المستوى الرابع",
    semester: "الفصل الثاني",
    password: "123456",
    mustChangePassword: true,
  },
  {
    id: "teacher-1",
    academicId: "9001001",
    email: "teacher@university.edu",
    fullName: "د. سارة خالد القحطاني",
    role: "teacher",
    department: "تقنية المعلومات",
    roleTitle: "عضو هيئة تدريس - شبكات الحاسوب",
    level: "المستوى الرابع",
    semester: "الفصل الثاني",
    password: "Teacher@123",
    mustChangePassword: false,
  },
  {
    id: "admin-1",
    academicId: "1000001",
    email: "admin@university.edu",
    fullName: "فهد عبدالله الشمري",
    role: "admin",
    department: "عمادة القبول والتسجيل",
    roleTitle: "مسؤول النظام",
    password: "Admin@123",
    mustChangePassword: false,
  },
];

export function getRoleLabel(role: UserRole) {
  return {
    student: "بوابة الطالب",
    teacher: "بوابة المعلم",
    admin: "بوابة الإدارة",
  }[role];
}

export function getRoleHome(role: UserRole) {
  return {
    student: "/student",
    teacher: "/teacher",
    admin: "/admin",
  }[role];
}

export function toAuthUser(user: StoredUser): AuthUser {
  const { password, ...safeUser } = user;
  void password;
  return safeUser;
}

function cloneDefaultUsers() {
  return DEFAULT_DEMO_USERS.map((user) => ({ ...user }));
}

export function loadStoredUsers() {
  if (typeof window === "undefined") {
    return cloneDefaultUsers();
  }

  const raw = localStorage.getItem(AUTH_USERS_STORAGE_KEY);
  if (!raw) {
    const defaults = cloneDefaultUsers();
    localStorage.setItem(AUTH_USERS_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as StoredUser[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error("Invalid auth users");
    }
    return parsed;
  } catch {
    const defaults = cloneDefaultUsers();
    localStorage.setItem(AUTH_USERS_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
}

export function saveStoredUsers(users: StoredUser[]) {
  localStorage.setItem(AUTH_USERS_STORAGE_KEY, JSON.stringify(users));
}

export function loadStoredSession(users: StoredUser[]) {
  if (typeof window === "undefined") {
    return null;
  }

  const sessionId = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!sessionId) {
    return null;
  }

  const matchedUser = users.find((user) => user.id === sessionId);
  return matchedUser ? toAuthUser(matchedUser) : null;
}

export function saveSession(userId: string) {
  localStorage.setItem(AUTH_SESSION_STORAGE_KEY, userId);
}

export function clearSession() {
  localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
}
