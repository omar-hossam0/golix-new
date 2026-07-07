"use client";

import Image from "next/image";
import Link from "next/link";

type GoalixAuthShellProps = {
  children: React.ReactNode;
};

const navLinks = [
  { label: "AI in Sport", href: "/#ai-in-sport" },
  { label: "How GOALIX Works", href: "/#how-goalix-works" },
  { label: "Product Suite", href: "/#product-suite" },
  { label: "Clubs & Coaches", href: "/#clubs-coaches" },
  { label: "Ecosystem", href: "/#goalix-ecosystem" },
];

export function GoalixAuthShell({ children }: GoalixAuthShellProps) {
  return (
    <div className="goalix-login-system">
      {/* ─── Top Navbar ─── */}
      <nav
        className="goalix-login-story-header"
        style={{
          position: "relative",
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 48px",
          fontFamily: "var(--font-inter),sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <Link href="/" aria-label="Goalix home" className="goalix-login-logo">
            <Image src="/Logo.png" alt="Goalix" width={1536} height={1024} priority style={{ width: "110px", height: "auto", objectFit: "contain" }} />
          </Link>
          <div
            className="goalix-login-nav-links"
            style={{ display: "flex", gap: 36 }}
          >
            {navLinks.map((link, index) => (
              <div
                key={link.href}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                <a
                  href={link.href}
                  style={{
                    fontSize: 14,
                    color: index === 0 ? "#cfff04" : "#e2e8f0",
                    textDecoration: "none",
                    fontWeight: index === 0 ? 600 : 400,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 0",
                  }}
                >
                  {link.label}
                  {index > 0 && (
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                      <path
                        d="M1 1L5 5L9 1"
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </a>
                {index === 0 && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: -2,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      width: "100%",
                    }}
                  >
                    <div
                      style={{
                        width: "120%",
                        height: 1,
                        background:
                          "linear-gradient(90deg, transparent, #cfff04, transparent)",
                        opacity: 0.7,
                      }}
                    />
                    <div
                      style={{
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: "#cfff04",
                        marginTop: 4,
                        boxShadow: "0 0 6px #cfff04",
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="goalix-login-actions">
          <Link href="/login" className="goalix-login-cta">
            Log in
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <polyline points="12 5 19 12 12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
        {/* Mobile menu action buttons */}
        <div className="goalix-login-mobile-actions">
          <input
            id="goalix-login-menu-toggle"
            className="goalix-login-menu-toggle"
            type="checkbox"
            aria-label="Toggle menu"
          />
          <label className="goalix-login-hamburger-btn" htmlFor="goalix-login-menu-toggle">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line className="goalix-login-menu-line goalix-login-menu-line-top" x1="3" y1="6" x2="21" y2="6" />
              <line className="goalix-login-menu-line goalix-login-menu-line-middle" x1="3" y1="12" x2="21" y2="12" />
              <line className="goalix-login-menu-line goalix-login-menu-line-bottom" x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </label>
        </div>

        {/* Mobile dropdown menu overlay */}
        <div className="goalix-login-mobile-dropdown">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="goalix-login-mobile-dropdown-link"
            >
              {link.label}
            </a>
          ))}
        </div>
      </nav>

      {/* ─── Left: story panel ─── */}
      <section className="goalix-login-story" aria-label="Goalix showcase">
        <div className="goalix-login-story-bg" />
        <div className="goalix-login-grid-overlay" aria-hidden="true" />

        {/* All content in one wrapper for compact layout */}
        <div className="goalix-login-story-content">
          {/* Hero copy - compact block */}
          <div className="goalix-login-copy">
            <h1>
              Smarter
              <br />
              <span>decisions.</span> Better
              <br />
              <span>results.</span>
            </h1>
            <p>
              AI-powered football insights
              <br />
              for <em>winning</em> teams.
            </p>
          </div>
        </div>

        {/* Live Match Analysis strip */}
        <div className="goalix-login-live-strip">
          <span className="goalix-login-live-icon">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ display: "block" }}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 15 15" />
              <line x1="12" y1="2" x2="12" y2="5" />
              <path d="M17 2l4 4" />
              <path d="M7 2l-4 4" />
            </svg>
          </span>
          <div>
            <strong>Live Match Analysis</strong>
            <p>Real-time data. Actionable insights.</p>
          </div>
          <em className="goalix-login-live-dot">
            ● <span>Live</span>
          </em>
        </div>
      </section>

      {/* ─── Right: form panel ─── */}
      <section className="goalix-login-panel-shell">
        {/*
          Wave SVG — pixel-perfect S-curve matching the reference mockup.
          ViewBox: 200×900. The white fill covers the right panel.
          Curve anatomy (matching reference):
            Top    → x=130 at y=0
            Bulge1 → x=48  at y=225  (left, near Email field)
            Mid    → x=166 at y=450  (right, near Password field)
            Bulge2 → x=78  at y=675  (left, near Log In button)
            Bottom → x=130 at y=900
          Each segment uses matched tangents for C¹ continuity.
        */}
        <svg
          className="goalix-login-wave"
          viewBox="0 0 200 900"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M 130 0
               C 130 75, 180 150, 180 225
               C 180 300, 135 375, 135 450
               C 135 525, 180 600, 180 675
               C 180 750, 130 825, 130 900
               L 200 900 L 200 0 Z"
            fill="#ffffff"
          />
        </svg>
        <div className="goalix-login-mobile-brand">
          <Image
            src="/Logo.png"
            alt="Goalix"
            width={1536}
            height={1024}
            priority
            style={{ width: "130px", height: "auto" }}
          />
          <Link href="/">Home</Link>
        </div>
        {children}
      </section>
    </div>
  );
}
