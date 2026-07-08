"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { GoalixAuthShell } from "@/components/auth/GoalixAuthShell";
import { useAppDispatch } from "@/lib/store/hooks";
import { loginFailure, loginStart, loginSuccess } from "@/lib/store/slices/authSlice";
import { ROLE_ROUTES } from "@/lib/constants";
import type { UserRole } from "@/lib/types";
import { rememberAuthSession } from "@/lib/auth/session";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetApiState } from "@/lib/store/resetApiState";
import { CSRF_HEADER_NAME, ensureCsrfToken, isCsrfRejectedError, refreshCsrfToken } from "@/lib/api/csrf";

type Step = "credentials" | "totp" | "backup";

const AUTH_REQUEST_TIMEOUT_MS = 20_000;
const COOKIE_COMMIT_DELAY_MS = 100;
const HARD_NAVIGATION_FALLBACK_MS = 1_200;

type ApiUser = {
  id: string;
  username?: string | null;
  email?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  role: UserRole;
  avatar_url?: string | null;
  phone?: string | null;
  totpEnabled?: boolean;
  totp_enabled?: boolean;
  created_at?: string | null;
};

type AuthPayload = {
  success?: boolean;
  data?: {
    requires2FA?: boolean;
    tempToken?: string;
    user?: ApiUser;
    mfaSetupRequired?: boolean;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

function buildLoginBody(identifier: string, password: string) {
  const value = identifier.trim();

  if (value.includes("@")) {
    return { email: value, password };
  }

  return { username: value, password };
}

function mapApiUser(apiUser: ApiUser, fallbackName: string) {
  return {
    id: apiUser.id,
    email: apiUser.email ?? "",
    username: apiUser.username ?? undefined,
    fullName: apiUser.full_name ?? apiUser.fullName ?? apiUser.username ?? fallbackName,
    role: apiUser.role,
    avatarUrl: apiUser.avatar_url ?? "",
    phone: apiUser.phone ?? "",
    totpEnabled: Boolean(apiUser.totpEnabled ?? apiUser.totp_enabled),
    createdAt: apiUser.created_at ?? new Date().toISOString(),
  };
}

function isExpiredMfaChallenge(message?: string) {
  return /invalid or expired 2fa token|invalid token purpose/i.test(message ?? "");
}

function isInvalidTotpCode(message?: string) {
  return /invalid totp code/i.test(message ?? "");
}

function getAuthErrorMessage(payload: AuthPayload | null, fallback: string) {
  return payload?.error?.message || fallback;
}

async function readAuthPayload(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return null;

  try {
    return (await response.json()) as AuthPayload;
  } catch {
    return null;
  }
}

async function postAuthJson(path: string, body: unknown, retryCsrf = true) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), AUTH_REQUEST_TIMEOUT_MS);

  try {
    const headers = new Headers({ "Content-Type": "application/json" });
    const csrfToken = await ensureCsrfToken();
    if (csrfToken) headers.set(CSRF_HEADER_NAME, csrfToken);

    const response = await fetch(path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await readAuthPayload(response);

    if (retryCsrf && isCsrfRejectedError({ status: response.status, data: payload })) {
      await refreshCsrfToken();
      return postAuthJson(path, body, false);
    }

    return { response, payload };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The login request timed out. Check your connection and try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export default function AdminLoginPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const totpCodeRef = useRef<HTMLInputElement>(null);
  const backupCodeRef = useRef<HTMLInputElement>(null);
  const identifierSnapshotRef = useRef("");

  const [step, setStep] = useState<Step>("credentials");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigateAfterCookieCommit = (destination: string) => {
    window.setTimeout(() => {
      router.replace(destination);

      window.setTimeout(() => {
        if (window.location.pathname !== destination) {
          window.location.assign(destination);
        }
      }, HARD_NAVIGATION_FALLBACK_MS);
    }, COOKIE_COMMIT_DELAY_MS);
  };

  const completeLogin = (apiUser: ApiUser, mfaSetupRequired = false) => {
    const user = mapApiUser(apiUser, identifierSnapshotRef.current);
    rememberAuthSession();
    resetApiState(dispatch);
    dispatch(loginSuccess({ user, role: user.role, mfaSetupRequired }));
    if (mfaSetupRequired && (user.role === "admin" || user.role === "coach")) {
      navigateAfterCookieCommit(user.role === "admin" ? "/admin/settings" : "/coach/settings");
      return;
    }
    navigateAfterCookieCommit(ROLE_ROUTES[user.role]);
  };

  const resetMfaChallenge = () => {
    setTempToken("");
    if (totpCodeRef.current) totpCodeRef.current.value = "";
    if (backupCodeRef.current) backupCodeRef.current.value = "";
    if (passwordRef.current) passwordRef.current.value = "";
    setStep("credentials");
  };

  const handleMfaError = (message: string | undefined, fallback: string) => {
    if (isExpiredMfaChallenge(message)) {
      resetMfaChallenge();
      setError("Your verification session expired. Log in again to get a fresh 2FA challenge.");
      return;
    }

    if (isInvalidTotpCode(message)) {
      setError("This code does not match the active authenticator device. Try the newest Goalix entry or use a backup code.");
      return;
    }

    setError(message || fallback);
  };

  const handleCredentials = async (event: React.FormEvent) => {
    event.preventDefault();
    const identifier = identifierRef.current?.value.trim() ?? "";
    const password = passwordRef.current?.value ?? "";

    if (!identifier || !password) {
      setError("Enter the staff email or username and password.");
      return;
    }
    identifierSnapshotRef.current = identifier;

    setError("");
    setIsLoading(true);

    try {
      dispatch(loginStart());
      const { response, payload } = await postAuthJson("/api/v1/auth/admin/login", {
        ...buildLoginBody(identifier, password),
        rememberMe,
      });

      if (!response.ok) {
        dispatch(loginFailure());
        setError(getAuthErrorMessage(payload, "Invalid login credentials."));
        return;
      }

      if (payload?.data?.requires2FA) {
        setTempToken(payload.data.tempToken || "");
        if (passwordRef.current) passwordRef.current.value = "";
        if (totpCodeRef.current) totpCodeRef.current.value = "";
        if (backupCodeRef.current) backupCodeRef.current.value = "";
        setStep("totp");
        dispatch(loginFailure());
        return;
      }

      const apiUser = payload?.data?.user;
      if (apiUser) {
        completeLogin(apiUser, Boolean(payload?.data?.mfaSetupRequired));
        return;
      }

      dispatch(loginFailure());
      setError("Unexpected login response.");
    } catch (err) {
      dispatch(loginFailure());
      setError(err instanceof Error ? err.message : "Could not connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTotpVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    const totpCode = totpCodeRef.current?.value ?? "";
    if (!totpCode || totpCode.length !== 6) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const { response, payload } = await postAuthJson("/api/v1/auth/2fa/verify", {
        tempToken,
        token: totpCode,
      });

      if (!response.ok) {
        handleMfaError(payload?.error?.message, "Invalid verification code.");
        return;
      }

      const apiUser = payload?.data?.user;
      if (apiUser) {
        completeLogin(apiUser);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackupVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    const backupCode = backupCodeRef.current?.value ?? "";
    if (!backupCode) {
      setError("Enter a backup code.");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const { response, payload } = await postAuthJson("/api/v1/auth/2fa/backup-verify", {
        tempToken,
        code: backupCode,
      });

      if (!response.ok) {
        handleMfaError(payload?.error?.message, "Invalid backup code.");
        return;
      }

      const apiUser = payload?.data?.user;
      if (apiUser) {
        completeLogin(apiUser);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  const title = step === "credentials" ? "Welcome Back" : step === "totp" ? "Verify access" : "Backup code";
  const description =
    step === "credentials"
      ? "Log in to your staff GOALIX account."
      : step === "totp"
        ? "Enter the 6-digit code from your authenticator app."
        : "Use one of your saved backup codes.";

  return (
    <GoalixAuthShell>
      <div className="goalix-login-card">
        <div className="goalix-login-card-head">
          <div className="goalix-login-card-icon">
            {step === "credentials" ? <ShieldCheck size={24} /> : <KeyRound size={24} />}
          </div>
          <span>Staff portal</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>

        {step === "credentials" && (
          <form onSubmit={handleCredentials} className="goalix-login-form">
            <div className="goalix-login-field">
              <Label htmlFor="staff-identifier">Staff email / username</Label>
              <div className="goalix-login-password">
                <UserCheck aria-hidden="true" />
                <Input
                  id="staff-identifier"
                  type="text"
                  placeholder="admin/coach email or username"
                  ref={identifierRef}
                  autoComplete="username"
                  required
                />
              </div>
            </div>
            <div className="goalix-login-field">
              <Label htmlFor="staff-password">Password</Label>
              <div className="goalix-login-password">
                <LockKeyhole aria-hidden="true" />
                <Input
                  id="staff-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  ref={passwordRef}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="goalix-login-form-row">
              <label>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>Remember me</span>
              </label>
              <Link href="/forgot-password">Forgot password?</Link>
            </div>
            {error && (
              <p className="goalix-login-error">
                {error}
              </p>
            )}
            <button type="submit" className="goalix-login-submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Log In
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            <p className="goalix-login-alt-link">
              Player or parent?{" "}
              <Link href="/login">
                Use academy login
              </Link>
            </p>
            <p className="goalix-login-secure">
              Admin and coach sessions stay protected with secure cookies and 2FA support.
            </p>
          </form>
        )}

        {step === "totp" && (
          <form onSubmit={handleTotpVerify} className="goalix-login-form">
            <div className="goalix-login-field">
              <Label htmlFor="totp-code">Verification Code</Label>
              <Input
                id="totp-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                ref={totpCodeRef}
                onInput={(event) => {
                  event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "");
                }}
                autoFocus
                autoComplete="one-time-code"
                required
                className="goalix-login-code-input"
              />
            </div>
            {error && (
              <p className="goalix-login-error">
                {error}
              </p>
            )}
            <button type="submit" className="goalix-login-submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </button>
            <button
              type="button"
              className="goalix-login-secondary-button"
              onClick={() => {
                setError("");
                setStep("backup");
              }}
            >
              Use backup code instead
            </button>
          </form>
        )}

        {step === "backup" && (
          <form onSubmit={handleBackupVerify} className="goalix-login-form">
            <div className="goalix-login-field">
              <Label htmlFor="backup-code">Backup Code</Label>
              <Input
                id="backup-code"
                type="text"
                placeholder="xxxxxxxx"
                ref={backupCodeRef}
                autoFocus
                required
                className="goalix-login-code-input"
              />
            </div>
            {error && (
              <p className="goalix-login-error">
                {error}
              </p>
            )}
            <button type="submit" className="goalix-login-submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Backup Code"
              )}
            </button>
            <button
              type="button"
              className="goalix-login-secondary-button"
              onClick={() => {
                setError("");
                setStep("totp");
              }}
            >
              Use authenticator code instead
            </button>
          </form>
        )}
      </div>
    </GoalixAuthShell>
  );
}
