export const SETTINGS_STORAGE_KEY = "academic-iqama.preferences";
export const USER_PREFERENCES_EVENT = "academic-iqama.preferences.changed";

export interface UserPreferences {
  emailNotifications: boolean;
  deadlineAlerts: boolean;
  weeklySummary: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  emailNotifications: true,
  deadlineAlerts: true,
  weeklySummary: false,
};

export interface UserPreferencesChangeEventDetail {
  userId: string | null;
  preferences: UserPreferences;
}

function getPreferencesStorageKey(userId?: string | null) {
  return userId ? `${SETTINGS_STORAGE_KEY}.${userId}` : SETTINGS_STORAGE_KEY;
}

export function loadUserPreferences(userId?: string | null): UserPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  const raw = window.localStorage.getItem(getPreferencesStorageKey(userId))
    ?? window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_PREFERENCES;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveUserPreferences(preferences: UserPreferences, userId?: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(getPreferencesStorageKey(userId), JSON.stringify(preferences));
  window.dispatchEvent(
    new CustomEvent<UserPreferencesChangeEventDetail>(USER_PREFERENCES_EVENT, {
      detail: {
        userId: userId ?? null,
        preferences,
      },
    }),
  );
}
