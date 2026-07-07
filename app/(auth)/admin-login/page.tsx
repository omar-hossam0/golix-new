"use client";

import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetApiState } from "@/lib/store/resetApiState";

type Step = "credentials" | "totp" | "backup";

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

export default function AdminLoginPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const [step, setStep] = useState<Step>("credentials");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const completeLogin = (apiUser: ApiUser, mfaSetupRequired = false) => {
    const user = mapApiUser(apiUser, identifier.trim());
    rememberAuthSession();
    resetApiState(dispatch);
    dispatch(loginSuccess({ user, role: user.role, mfaSetupRequired }));
    if (mfaSetupRequired && (user.role === "admin" || user.role === "coach")) {
      router.push(user.role === "admin" ? "/admin/settings" : "/coach/settings");
      return;
    }
    router.push(ROLE_ROUTES[user.role]);
  };

  const resetMfaChallenge = () => {
    setTempToken("");
    setTotpCode("");
    setBackupCode("");
    setPassword("");
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
    if (!identifier.trim() || !password) {
      setError("Enter the staff email or username and password.");
      return;
    }

    setError("");
    setIsLoading(true);

        try {
            dispatch(loginStart());
            const res = await fetch("/api/v1/auth/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildLoginBody(identifier, password)),
                credentials: "include",
            });

      const json = await res.json();

      if (!res.ok) {
        dispatch(loginFailure());
        setError(json.error?.message || "Invalid login credentials.");
        return;
      }

      if (json.data?.requires2FA) {
        setTempToken(json.data.tempToken);
        setPassword("");
        setTotpCode("");
        setBackupCode("");
        setStep("totp");
        dispatch(loginFailure());
        return;
      }

      const apiUser: ApiUser | undefined = json.data?.user;
      if (apiUser) {
        completeLogin(apiUser, Boolean(json.data?.mfaSetupRequired));
        return;
      }

      dispatch(loginFailure());
      setError("Unexpected login response.");
    } catch {
      dispatch(loginFailure());
      setError("Could not connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTotpVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!totpCode || totpCode.length !== 6) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    setError("");
    setIsLoading(true);

        try {
            const res = await fetch("/api/v1/auth/2fa/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tempToken, token: totpCode }),
                credentials: "include",
            });

      const json = await res.json();
      if (!res.ok) {
        handleMfaError(json.error?.message, "Invalid verification code.");
        return;
      }

      const apiUser: ApiUser | undefined = json.data?.user;
      if (apiUser) {
        completeLogin(apiUser);
      }
    } catch {
      setError("Could not connect to the server.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackupVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!backupCode) {
      setError("Enter a backup code.");
      return;
    }

    setError("");
    setIsLoading(true);

        try {
            const res = await fetch("/api/v1/auth/2fa/backup-verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tempToken, code: backupCode }),
                credentials: "include",
            });

      const json = await res.json();
      if (!res.ok) {
        handleMfaError(json.error?.message, "Invalid backup code.");
        return;
      }

      const apiUser: ApiUser | undefined = json.data?.user;
      if (apiUser) {
        completeLogin(apiUser);
      }
    } catch {
      setError("Could not connect to the server.");
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
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
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
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
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
                <input type="checkbox" defaultChecked />
                <span>Remember me</span>
              </label>
              <Link href="/forgot-password">Forgot password?</Link>
            </div>
            {error && (
              <p className="goalix-login-error">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" className="goalix-login-submit" disabled={isLoading}>
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
            </Button>
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
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, ""))}
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
            <Button type="submit" size="lg" className="goalix-login-submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
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
                value={backupCode}
                onChange={(event) => setBackupCode(event.target.value)}
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
            <Button type="submit" size="lg" className="goalix-login-submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify Backup Code"
              )}
            </Button>
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
