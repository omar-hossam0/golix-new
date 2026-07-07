import { useState } from "react";
import { useCurrentUser } from "@/lib/auth/auth-context";
import {
  useGetNotificationsQuery,
  useGetUnreadNotificationsCountQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from "@/lib/store/api/calendarApi";
import type { UserRole } from "@/lib/types";

export function useDashboardNotifications(role: UserRole) {
  const authState = useCurrentUser();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  
  const notificationsEnabled =
    authState.isAuthenticated && authState.role === role;

  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    isError: notificationsError,
    refetch: refetchNotifications,
  } = useGetNotificationsQuery(undefined, {
    skip: !notificationsEnabled || !notificationsOpen,
    pollingInterval: 120000,
    skipPollingIfUnfocused: true,
    refetchOnReconnect: true,
  });

  const { data: unreadCountFromApi } = useGetUnreadNotificationsCountQuery(undefined, {
    skip: !notificationsEnabled,
    pollingInterval: 120000,
    skipPollingIfUnfocused: true,
    refetchOnReconnect: true,
  });

  const [markNotificationRead] = useMarkNotificationReadMutation();
  const [markAllNotificationsRead, markAllNotificationsReadState] = useMarkAllNotificationsReadMutation();

  const notifications = notificationsData?.data ?? [];
  const unreadCount = typeof unreadCountFromApi === "number"
    ? unreadCountFromApi
    : notifications.filter((item) => !item.is_read).length;

  return {
    notificationsOpen,
    setNotificationsOpen,
    notificationsEnabled,
    notifications,
    notificationsLoading,
    notificationsError,
    refetchNotifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    markAllNotificationsReadState,
  };
}
