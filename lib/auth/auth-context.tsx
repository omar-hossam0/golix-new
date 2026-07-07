"use client";

import React, { createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  loginStart,
  loginSuccess,
  loginFailure,
  logout as logoutAction,
} from "@/lib/store/slices/authSlice";
import { ROLE_ROUTES } from "@/lib/constants";
import type { UserRole } from "@/lib/types";
import { forgetAuthSession, rememberAuthSession } from "@/lib/auth/session";
import { getApiBaseUrl } from "@/lib/api/baseUrl";
import { CSRF_HEADER_NAME, ensureCsrfToken } from "@/lib/api/csrf";
import { resetApiState } from "@/lib/store/resetApiState";
import { mapApiUser } from "@/lib/auth/mapApiUser";

const API_BASE = getApiBaseUrl();

interface AuthContextType {
  login: (username: string, password: string, role: "player" | "parent", rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const currentRole = useAppSelector((state) => state.auth.role);
  const router = useRouter();

  const login = useCallback(
    async (username: string, password: string, role: "player" | "parent", rememberMe?: boolean) => {
      dispatch(loginStart());

      try {
        const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, role, rememberMe }),
          credentials: "include",
        });

        if (res.ok) {
          const json = await res.json();
          const apiUser = json.data?.user;

          if (apiUser) {
            const user = mapApiUser(apiUser);
            rememberAuthSession();
            resetApiState(dispatch);
            dispatch(loginSuccess({ user, role: user.role }));
            router.push(ROLE_ROUTES[user.role]);
            return;
          }
        }

        // Backend returned an error response
        dispatch(loginFailure());
        throw new Error("Invalid credentials");
      } catch (err) {
        dispatch(loginFailure());
        throw err;
      }
    },
    [dispatch, router]
  );

  const logout = useCallback(() => {
    const redirectTo = currentRole === "admin" || currentRole === "coach" ? "/admin-login" : "/login";
    void (async () => {
      const csrfToken = await ensureCsrfToken();
      const headers = new Headers();
      if (csrfToken) headers.set(CSRF_HEADER_NAME, csrfToken);

      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: "POST",
        headers,
        credentials: "include",
      });
    })().catch(() => {});
    forgetAuthSession();
    resetApiState(dispatch);
    dispatch(logoutAction());
    router.push(redirectTo);
  }, [currentRole, dispatch, router]);

  const switchRole = useCallback(
    (role: UserRole) => {
      router.push(ROLE_ROUTES[role]);
    },
    [router]
  );

  return (
    <AuthContext.Provider value={{ login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useCurrentUser() {
  return useAppSelector((state) => state.auth);
}
