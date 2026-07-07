"use client";

import { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "./store";
import { authInitialized, loginSuccess, logout } from "./slices/authSlice";
import { hasAuthSessionMarker } from "@/lib/auth/session";
import { refreshAuthSession } from "@/lib/auth/refreshSession";
import { resetApiState } from "./resetApiState";
import { mapApiUser } from "@/lib/auth/mapApiUser";

/** Rehydrates auth state from the httpOnly refresh cookie only. */
function SessionRefresher() {
  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    if (!hasAuthSessionMarker()) {
      resetApiState(store.dispatch);
      store.dispatch(logout());
      return;
    }
    const restoreSession = async () => {
      if (!hasAuthSessionMarker()) {
        window.clearTimeout(timeout);
        store.dispatch(authInitialized());
        return;
      }

      try {
        const result = await refreshAuthSession(controller.signal);
        if (!result.ok) {
          if (result.unauthorized) {
            resetApiState(store.dispatch);
            store.dispatch(logout());
          } else {
            store.dispatch(authInitialized());
          }
          return;
        }

        const user = mapApiUser(result.user);
        resetApiState(store.dispatch);
        store.dispatch(loginSuccess({ user, role: user.role }));
      } catch {
        store.dispatch(authInitialized());
      } finally {
        window.clearTimeout(timeout);
        store.dispatch(authInitialized());
      }
    };

    void restoreSession();

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  return null;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <SessionRefresher />
      {children}
    </Provider>
  );
}
