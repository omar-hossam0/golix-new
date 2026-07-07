"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { useCurrentUser } from "@/lib/auth/auth-context";
import { adminApi } from "@/lib/store/api/adminApi";
import { calendarApi } from "@/lib/store/api/calendarApi";
import { useAppDispatch } from "@/lib/store/hooks";
import { getSocketBaseUrl } from "@/lib/api/baseUrl";

export function useRealtimeNotifications(enabled = true) {
  const dispatch = useAppDispatch();
  const { isAuthenticated } = useCurrentUser();

  useEffect(() => {
    if (!enabled || !isAuthenticated) return;

    const socket = io(getSocketBaseUrl(), {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
    });
    const refreshNotifications = () => {
      dispatch(calendarApi.util.invalidateTags(["Notifications"]));
      dispatch(adminApi.util.invalidateTags(["Notifications"]));
    };

    socket.on("connect", refreshNotifications);
    socket.on("notification:new", refreshNotifications);
    socket.on("notification:read", refreshNotifications);
    socket.on("notification:read_all", refreshNotifications);

    return () => {
      socket.disconnect();
    };
  }, [dispatch, enabled, isAuthenticated]);
}
