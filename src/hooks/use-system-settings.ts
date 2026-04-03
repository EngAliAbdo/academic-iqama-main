import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  isLocalDemoFallbackEnabled,
  loadSupabaseSystemSettings,
  updateSupabaseSystemSettings,
} from "@/lib/supabase-app";
import {
  dispatchSystemSettingsActivity,
  loadSystemSettings,
  saveSystemSettings,
  SYSTEM_SETTINGS_STORAGE_KEY,
  SYSTEM_SETTINGS_UPDATED_EVENT,
  type SystemSettings,
} from "@/lib/system-settings";

type SettingsStorageMode = "local" | "supabase";

export function useSystemSettings() {
  const { authMode, user } = useAuth();
  const [settings, setSettings] = useState<SystemSettings>(() => loadSystemSettings());
  const [storageMode, setStorageMode] = useState<SettingsStorageMode>("local");
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const syncLocalSettings = () => {
      setSettings(loadSystemSettings());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === SYSTEM_SETTINGS_STORAGE_KEY) {
        syncLocalSettings();
      }
    };

    window.addEventListener(SYSTEM_SETTINGS_UPDATED_EVENT, syncLocalSettings);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(SYSTEM_SETTINGS_UPDATED_EVENT, syncLocalSettings);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const localFallbackEnabled = isLocalDemoFallbackEnabled();

    const syncSettings = async () => {
      if (authMode !== "supabase" || !user) {
        if (!isMounted) {
          return;
        }

        setSettings(loadSystemSettings());
        setStorageMode("local");
        return;
      }

      setIsSyncing(true);
      const remoteSettings = await loadSupabaseSystemSettings();

      if (!isMounted) {
        return;
      }

      if (remoteSettings) {
        const snapshot = saveSystemSettings(remoteSettings);
        setSettings(snapshot);
        setStorageMode("supabase");
        setIsSyncing(false);
        return;
      }

      if (!localFallbackEnabled) {
        setStorageMode("supabase");
        setIsSyncing(false);
        return;
      }

      setSettings(loadSystemSettings());
      setStorageMode("local");
      setIsSyncing(false);
    };

    void syncSettings();

    return () => {
      isMounted = false;
    };
  }, [authMode, user]);

  const updateSettings = async (nextSettings: Partial<SystemSettings>) => {
    const previousSettings = settings;
    const merged = saveSystemSettings({ ...settings, ...nextSettings });
    const localFallbackEnabled = isLocalDemoFallbackEnabled();

    if (authMode === "supabase" && user) {
      const remoteSettings = await updateSupabaseSystemSettings(merged, user.id);
      if (remoteSettings) {
        const snapshot = saveSystemSettings(remoteSettings);
        setSettings(snapshot);
        setStorageMode("supabase");

        if (JSON.stringify(previousSettings) !== JSON.stringify(snapshot)) {
          dispatchSystemSettingsActivity({
            actorId: user.id,
            actorName: user.fullName,
            actorRole: user.role,
            occurredAt: new Date().toISOString(),
            previousSettings,
            nextSettings: snapshot,
            storageMode: "supabase",
          });
        }

        return snapshot;
      }

      if (!localFallbackEnabled) {
        setStorageMode("supabase");
        return previousSettings;
      }
    }

    setSettings(merged);
    setStorageMode("local");

    if (JSON.stringify(previousSettings) !== JSON.stringify(merged)) {
      dispatchSystemSettingsActivity({
        actorId: user?.id ?? null,
        actorName: user?.fullName ?? "النظام",
        actorRole: user?.role ?? "system",
        occurredAt: new Date().toISOString(),
        previousSettings,
        nextSettings: merged,
        storageMode: "local",
      });
    }

    return merged;
  };

  return {
    settings,
    storageMode,
    isSyncing,
    updateSettings,
  };
}
