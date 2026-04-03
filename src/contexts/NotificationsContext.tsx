import { createContext, useContext, type ReactNode } from "react";
import { useNotifications, type Notification, type NotificationType } from "@/hooks/use-notifications";

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  getByType: (type: NotificationType | "all") => Notification[];
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const value = useNotifications();
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotificationsContext() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotificationsContext must be used within NotificationsProvider");
  return ctx;
}
