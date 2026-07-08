"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { GoalixAuthShell } from "@/components/auth/GoalixAuthShell";
import { useAuth } from "@/lib/auth/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<"player" | "parent">("player");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please enter your username and password.");
      return;
    }
    if (username.includes("@")) {
      setError("Staff accounts use the staff login page.");
      router.push("/admin-login");
      return;
    }
    setError("");
    setIsLoading(true);
    try {
      await login(username.trim(), password, role, rememberMe);
    } catch {
      setError("Invalid username, password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <GoalixAuthShell>
      <div className="goalix-login-card">
        <div className="goalix-login-card-head">
          <h1>
            Welcome <span>Back</span>
          </h1>
          <p>Log in to your GOALIX account</p>
        </div>

        <form onSubmit={handleSubmit} className="goalix-login-form">
          <div className="goalix-login-role-switch" aria-label="Account type">
            <button
              type="button"
              className={role === "player" ? "is-active" : ""}
              onClick={() => {
                setRole("player");
                setError("");
              }}
              aria-pressed={role === "player"}
            >
              <UserRound size={16} aria-hidden="true" />
              <span>Player</span>
            </button>
            <button
              type="button"
              className={role === "parent" ? "is-active" : ""}
              onClick={() => {
                setRole("parent");
                setError("");
              }}
              aria-pressed={role === "parent"}
            >
              <UsersRound size={16} aria-hidden="true" />
              <span>Parent</span>
            </button>
          </div>

          {/* Username Field */}
          <div className="goalix-login-field">
            <label htmlFor="username">Username</label>
            <div className="goalix-login-input-wrapper">
              <UserRound size={18} aria-hidden="true" />
              <input
                id="username"
                type="text"
                placeholder={
                  role === "parent" ? "parent.username" : "player.username"
                }
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="goalix-login-field">
            <label htmlFor="password">Password</label>
            <div className="goalix-login-input-wrapper">
              <Lock size={18} aria-hidden="true" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="goalix-login-eye-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Remember Me / Forgot Password */}
          <div className="goalix-login-form-row">
            <label>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Remember me</span>
            </label>
            <Link href="/forgot-password">Forgot password?</Link>
          </div>

          {error && <p className="goalix-login-error">{error}</p>}

          {/* Submit Button */}
          <button
            type="submit"
            className="goalix-login-submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="goalix-spin" size={18} />
                Signing in...
              </>
            ) : (
              <>
                Log In
                <ArrowRight size={18} />
              </>
            )}
          </button>

          {/* Secure Badge */}
          <p className="goalix-login-secure">
            <ShieldCheck size={14} />
            <span>
              Your data is <strong>secure</strong> with enterprise-grade
              encryption.
            </span>
          </p>
        </form>
      </div>
    </GoalixAuthShell>
  );
}
