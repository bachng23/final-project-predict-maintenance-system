"use client";

import { useState, type FormEvent } from "react";

type LoginState = "idle" | "loading" | "error";

// TODO (frontend): wire onSubmit to POST /api/v1/auth/login, store token, redirect to /
export function LoginPage({
  onSubmit,
}: {
  onSubmit?: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<LoginState>("idle");
  const [errorMsg, setErrorMsg] = useState("Invalid username or password.");
  const [touchedUser, setTouchedUser] = useState(false);
  const [touchedPass, setTouchedPass] = useState(false);

  const userError = touchedUser && !username.trim();
  const passError = touchedPass && !password;
  const formError = state === "error";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouchedUser(true);
    setTouchedPass(true);

    if (!username.trim() || !password) {
      setErrorMsg("Please fill out all required fields.");
      setState("error");
      return;
    }

    setState("loading");
    try {
      await onSubmit?.(username.trim(), password);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Invalid username or password.");
      setState("error");
    }
  }

  function clearFieldError() {
    if (state === "error") setState("idle");
  }

  return (
    <>
      {/* Ambient backdrop blobs */}
      <div
        style={{
          position: "fixed",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "rgba(59,166,241,0.10)",
          filter: "blur(80px)",
          top: -160,
          left: -160,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "fixed",
          width: 400,
          height: 400,
          borderRadius: "50%",
          background: "rgba(193,225,247,0.32)",
          filter: "blur(80px)",
          bottom: -140,
          right: -120,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Shell */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 400,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "var(--color-slate-text)",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              position: "relative",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.10)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="8" stroke="#ffffff" strokeWidth="1.7" />
              <circle cx="12" cy="12" r="2.8" fill="#ffffff" />
            </svg>
            <span
              style={{
                position: "absolute",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--color-chartwell-blue)",
                top: 6,
                right: 6,
                boxShadow: "0 0 0 2.5px #fff",
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--color-slate-text)", lineHeight: 1.1 }}>
              Marco<span style={{ color: "var(--color-chartwell-blue)" }}>.</span>ai
            </div>
            <div style={{ fontSize: 13, color: "var(--color-ash-gray)", marginTop: 4 }}>
              Predictive Maintenance Intelligence
            </div>
          </div>
        </div>

        {/* System status pill */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 12px 4px 8px",
            background: "var(--color-cloud-white)",
            border: "1px solid var(--color-stone-border)",
            borderRadius: 9999,
            fontSize: 11.5,
            color: "var(--color-ash-gray)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
          }}
        >
          <PulsingDot />
          All systems operational
        </div>

        {/* Card */}
        <div
          style={{
            width: "100%",
            background: "var(--color-cloud-white)",
            border: "1px solid var(--color-stone-border)",
            borderRadius: 10,
            boxShadow: "0 4px 16px rgba(0,0,0,0.05)",
            padding: "28px 28px 24px",
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.016em", color: "var(--color-slate-text)", margin: "0 0 4px" }}>
              Sign in
            </h1>
            <p style={{ fontSize: 13, color: "var(--color-ash-gray)", margin: 0 }}>
              Use your operator or engineer credentials.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Form-level error */}
            {formError && (
              <div
                style={{
                  background: "var(--color-rose-tint)",
                  border: "1px solid #fecdd3",
                  borderRadius: 6,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  color: "var(--color-rose)",
                  fontSize: 12.5,
                  lineHeight: 1.45,
                }}
                role="alert"
              >
                <svg style={{ flexShrink: 0, marginTop: 1 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Username */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="username" style={{ fontSize: 12, fontWeight: 500, color: "var(--color-slate-text)" }}>
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                placeholder="Enter your username"
                spellCheck={false}
                autoCapitalize="off"
                value={username}
                onChange={(e) => { setUsername(e.target.value); clearFieldError(); }}
                onBlur={() => setTouchedUser(true)}
                style={{
                  height: 38,
                  padding: "0 12px",
                  border: `1px solid ${userError || formError ? "var(--color-rose)" : "#d6d3d1"}`,
                  borderRadius: 6,
                  background: userError || formError ? "var(--color-rose-tint)" : "var(--color-cloud-white)",
                  color: "var(--color-slate-text)",
                  fontFamily: "inherit",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              {userError && (
                <span style={{ fontSize: 11.5, color: "var(--color-rose)" }}>Please enter your username.</span>
              )}
            </div>

            {/* Password */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="password" style={{ fontSize: 12, fontWeight: 500, color: "var(--color-slate-text)" }}>
                Password
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearFieldError(); }}
                  onBlur={() => setTouchedPass(true)}
                  style={{
                    flex: 1,
                    height: 38,
                    padding: "0 40px 0 12px",
                    border: `1px solid ${passError || formError ? "var(--color-rose)" : "#d6d3d1"}`,
                    borderRadius: 6,
                    background: passError || formError ? "var(--color-rose-tint)" : "var(--color-cloud-white)",
                    color: "var(--color-slate-text)",
                    fontFamily: "inherit",
                    fontSize: 14,
                    outline: "none",
                    width: "100%",
                  }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: "absolute",
                    right: 4,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: 0,
                    cursor: "pointer",
                    width: 30,
                    height: 30,
                    display: "grid",
                    placeItems: "center",
                    color: "var(--color-ash-gray)",
                    borderRadius: 4,
                    padding: 0,
                  }}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.06 10.06 0 0 1 12 19c-6.5 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A10 10 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="2" y1="2" x2="22" y2="22" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {passError && (
                <span style={{ fontSize: 11.5, color: "var(--color-rose)" }}>Please enter your password.</span>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={state === "loading"}
              style={{
                width: "100%",
                height: 40,
                background: "var(--color-chartwell-blue)",
                color: "#fff",
                border: 0,
                borderRadius: 9999,
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 500,
                cursor: state === "loading" ? "progress" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: state === "loading" ? 0.7 : 1,
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
              }}
            >
              {state === "loading" && <Spinner />}
              {state === "loading" ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Footer */}
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid var(--color-stone-border)",
              textAlign: "center",
              color: "var(--color-ash-gray)",
              fontSize: 12.5,
            }}
          >
            Contact your administrator to request access.
          </div>
        </div>

        {/* Meta line */}
        <div style={{ fontSize: 11.5, color: "#a8a29e", letterSpacing: "0.02em", display: "flex", gap: 14, alignItems: "center" }}>
          <span>v3.4.1</span>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#d6d3d1", display: "inline-block" }} />
          <span style={{ color: "var(--color-ash-gray)" }}>Marco.ai</span>
        </div>
      </div>
    </>
  );
}

function PulsingDot() {
  return (
    <span style={{ position: "relative", width: 7, height: 7, display: "inline-block" }}>
      <style>{`
        @keyframes pdm-pulse {
          from { transform: scale(1); opacity: 0.5; }
          to   { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "var(--color-emerald)", display: "block" }} />
      <span style={{
        position: "absolute",
        inset: -2,
        borderRadius: "50%",
        background: "var(--color-emerald)",
        opacity: 0.4,
        display: "block",
        animation: "pdm-pulse 1.6s ease-out infinite",
      }} />
    </span>
  );
}

function Spinner() {
  return (
    <>
      <style>{`
        @keyframes pdm-spin { to { transform: rotate(360deg); } }
      `}</style>
      <span style={{
        width: 14,
        height: 14,
        borderRadius: "50%",
        border: "2px solid rgba(255,255,255,0.45)",
        borderTopColor: "#fff",
        animation: "pdm-spin 0.7s linear infinite",
        display: "inline-block",
      }} />
    </>
  );
}
