const AUTH_SESSION_KEY = "goalix:auth-session";

export function hasAuthSessionMarker() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(AUTH_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberAuthSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AUTH_SESSION_KEY, "1");
  } catch {
    // The secure cookie still keeps the session valid when storage is unavailable.
  }
}

export function forgetAuthSession() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // Nothing else is required when storage is unavailable.
  }
}
