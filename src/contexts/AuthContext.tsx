import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  clearSession,
  loadStoredSession,
  loadStoredUsers,
  saveSession,
  saveStoredUsers,
  toAuthUser,
  type AuthUser,
  type DemoAccount,
  type StoredUser,
} from "@/lib/auth";
import {
  getSupabaseSessionProfile,
  isLocalDemoFallbackEnabled,
  isSupabaseConfigured,
  loadAccessibleProfiles,
  signInWithSupabaseIdentifier,
  updateSupabasePasswordState,
} from "@/lib/supabase-app";

interface SignInInput {
  identifier: string;
  password: string;
}

interface SignInResult {
  ok: boolean;
  error?: string;
  requiresPasswordChange?: boolean;
  user?: AuthUser;
}

interface ChangePasswordResult {
  ok: boolean;
  error?: string;
}

type AuthMode = "local" | "supabase";

interface AuthContextValue {
  user: AuthUser | null;
  directoryUsers: AuthUser[];
  isReady: boolean;
  isAuthenticated: boolean;
  authMode: AuthMode;
  demoAccounts: DemoAccount[];
  signIn: (input: SignInInput) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<ChangePasswordResult>;
  refreshDirectoryUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toDemoAccount(user: StoredUser): DemoAccount {
  return {
    academicId: user.academicId,
    password: user.password,
    fullName: user.fullName,
    role: user.role,
    roleTitle: user.roleTitle,
    mustChangePassword: user.mustChangePassword,
  };
}

async function loadRemoteProfileIfAvailable() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  return await getSupabaseSessionProfile();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<StoredUser[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [directoryUsers, setDirectoryUsers] = useState<AuthUser[]>([]);
  const [authMode, setAuthMode] = useState<AuthMode>("local");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const storedUsers = loadStoredUsers();
    const localFallbackEnabled = isLocalDemoFallbackEnabled();

    const applyLocalSession = () => {
      if (!isMounted) {
        return;
      }

      setUsers(storedUsers);
      setDirectoryUsers(storedUsers.map(toAuthUser));
      setUser(loadStoredSession(storedUsers));
      setAuthMode("local");
      setIsReady(true);
    };

    const syncSession = async () => {
      const remoteProfile = await loadRemoteProfileIfAvailable();
      if (!isMounted) {
        return;
      }

      if (remoteProfile) {
        const accessibleProfiles = await loadAccessibleProfiles();
        if (!isMounted) {
          return;
        }

        setUsers(storedUsers);
        setUser(remoteProfile);
        setDirectoryUsers(accessibleProfiles.length > 0 ? accessibleProfiles : [remoteProfile]);
        setAuthMode("supabase");
        setIsReady(true);
        return;
      }

      if (isSupabaseConfigured() && !localFallbackEnabled) {
        if (!isMounted) {
          return;
        }

        setUsers(storedUsers);
        setUser(null);
        setDirectoryUsers([]);
        setAuthMode("supabase");
        setIsReady(true);
        return;
      }

      applyLocalSession();
    };

    setUsers(storedUsers);
    setDirectoryUsers(storedUsers.map(toAuthUser));
    void syncSession();

    if (!isSupabaseConfigured()) {
      return () => {
        isMounted = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void syncSession();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async ({ identifier, password }: SignInInput): Promise<SignInResult> => {
    const normalizedIdentifier = identifier.trim();
    const normalizedIdentifierLower = normalizedIdentifier.toLowerCase();
    const localFallbackEnabled = isLocalDemoFallbackEnabled();

    if (isSupabaseConfigured()) {
      const remoteResult = await signInWithSupabaseIdentifier({
        identifier: normalizedIdentifier,
        password,
      });

      if (remoteResult.ok && remoteResult.user) {
        const accessibleProfiles = await loadAccessibleProfiles();
        setUser(remoteResult.user);
        setDirectoryUsers(accessibleProfiles.length > 0 ? accessibleProfiles : [remoteResult.user]);
        setAuthMode("supabase");
        clearSession();

        return {
          ok: true,
          user: remoteResult.user,
          requiresPasswordChange: remoteResult.user.mustChangePassword,
        };
      }

      if (!localFallbackEnabled) {
        return remoteResult;
      }
    }

    const matchedUser = users.find(
      (candidate) =>
        candidate.academicId === normalizedIdentifier ||
        candidate.email.toLowerCase() === normalizedIdentifierLower,
    );

    if (!matchedUser) {
      return { ok: false, error: "الرقم الأكاديمي أو رقم الموظف غير موجود." };
    }

    if (matchedUser.password !== password) {
      return { ok: false, error: "كلمة المرور غير صحيحة." };
    }

    const safeUser = toAuthUser(matchedUser);
    setUser(safeUser);
    setDirectoryUsers(users.map(toAuthUser));
    setAuthMode("local");
    saveSession(matchedUser.id);

    return {
      ok: true,
      user: safeUser,
      requiresPasswordChange: matchedUser.mustChangePassword,
    };
  };

  const signOut = async () => {
    if (authMode === "supabase" && isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }

    setUser(null);
    setDirectoryUsers(isLocalDemoFallbackEnabled() ? users.map(toAuthUser) : []);
    setAuthMode(isSupabaseConfigured() && !isLocalDemoFallbackEnabled() ? "supabase" : "local");
    clearSession();
  };

  const refreshDirectoryUsers = async () => {
    if (authMode === "supabase" && isSupabaseConfigured()) {
      const accessibleProfiles = await loadAccessibleProfiles();
      setDirectoryUsers(accessibleProfiles);
      return;
    }

    if (isLocalDemoFallbackEnabled()) {
      setDirectoryUsers(users.map(toAuthUser));
    } else {
      setDirectoryUsers([]);
    }
  };

  const changePassword = async (newPassword: string): Promise<ChangePasswordResult> => {
    if (!user) {
      return { ok: false, error: "لا توجد جلسة مستخدم نشطة." };
    }

    if (authMode === "supabase" && isSupabaseConfigured()) {
      const result = await updateSupabasePasswordState(user.id, newPassword);
      if (!result.ok) {
        return result;
      }

      setUser({ ...user, mustChangePassword: false });
      setDirectoryUsers((current) =>
        current.map((candidate) =>
          candidate.id === user.id ? { ...candidate, mustChangePassword: false } : candidate,
        ),
      );
      return { ok: true };
    }

    const nextUsers = users.map((candidate) =>
      candidate.id === user.id
        ? { ...candidate, password: newPassword, mustChangePassword: false }
        : candidate,
    );

    const updatedUser = nextUsers.find((candidate) => candidate.id === user.id);
    if (!updatedUser) {
      return { ok: false, error: "تعذر تحديث كلمة المرور." };
    }

    setUsers(nextUsers);
    setDirectoryUsers(nextUsers.map(toAuthUser));
    saveStoredUsers(nextUsers);

    const safeUser = toAuthUser(updatedUser);
    setUser(safeUser);
    saveSession(updatedUser.id);

    return { ok: true };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        directoryUsers,
        isReady,
        isAuthenticated: !!user,
        authMode,
        demoAccounts: users.map(toDemoAccount),
        signIn,
        signOut,
        changePassword,
        refreshDirectoryUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
