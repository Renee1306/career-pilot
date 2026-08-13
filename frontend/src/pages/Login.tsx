import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { IconCheck, IconCompass, IconGithub, IconGoogle } from "../components/Icons";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";

type Mode = "sign_in" | "sign_up";
type OAuthProvider = "google" | "github";

export default function Login() {
  const { session } = useAuth();
  const [params] = useSearchParams();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "sign_up" ? "sign_up" : "sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  if (session) {
    // ProtectedRoute stashes the page the user was actually trying to open.
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== "/login" ? from : "/dashboard"} replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    const { error } =
      mode === "sign_in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (mode === "sign_up") {
      setInfo("Account created. Check your email to confirm, then sign in.");
    }
  };

  // Redirects the browser away on success (supabase-js does this itself), so there's no
  // "submitting -> done" transition to handle here - only a failure returns control to us,
  // e.g. because the provider isn't enabled for this Supabase project yet.
  const handleOAuth = async (provider: OAuthProvider) => {
    setError(null);
    setOauthLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setError(error.message);
      setOauthLoading(null);
    }
  };

  const isSignIn = mode === "sign_in";

  return (
    <div className="auth-layout">
      <div className="auth-panel">
        <div className="auth-form-wrap">
          <Link to="/" className="brand">
            <span className="brand-mark">
              <IconCompass size={19} />
            </span>
            CareerPilot
          </Link>

          <h1 className="auth-title">{isSignIn ? "Welcome back" : "Create your account"}</h1>
          <p className="muted" style={{ marginBottom: 26 }}>
            {isSignIn
              ? "Sign in to pick up your applications, resumes and prep where you left them."
              : "One account holds your resumes, tracked applications and job analyses."}
          </p>

          <div className="stack" style={{ gap: 10, marginBottom: 20 }}>
            <button
              type="button"
              className="btn btn-oauth btn-block"
              onClick={() => handleOAuth("google")}
              disabled={oauthLoading !== null || submitting}
            >
              <IconGoogle size={18} />
              {oauthLoading === "google" ? "Redirecting..." : "Continue with Google"}
            </button>
            <button
              type="button"
              className="btn btn-oauth btn-block"
              onClick={() => handleOAuth("github")}
              disabled={oauthLoading !== null || submitting}
            >
              <IconGithub size={18} />
              {oauthLoading === "github" ? "Redirecting..." : "Continue with GitHub"}
            </button>
          </div>

          <div className="auth-divider">
            <span>or continue with email</span>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete={isSignIn ? "current-password" : "new-password"}
                placeholder={isSignIn ? "Your password" : "At least 6 characters"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="alert">{error}</p>}
            {info && (
              <p className="badge badge-success" style={{ display: "block", padding: "10px 14px" }}>
                {info}
              </p>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg btn-block"
              style={{ marginTop: 8 }}
              disabled={submitting || oauthLoading !== null}
            >
              {submitting ? "Working..." : isSignIn ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="auth-switch">
            {isSignIn ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setMode(isSignIn ? "sign_up" : "sign_in");
                setError(null);
                setInfo(null);
              }}
            >
              {isSignIn ? "Create an account" : "Sign in instead"}
            </button>
          </p>

          <p className="auth-switch">
            <Link to="/" className="muted" style={{ fontWeight: 600 }}>
              ← Back to home
            </Link>
          </p>
        </div>
      </div>

      <aside className="auth-side">
        <div className="auth-side-quote">
          Every job post decoded, every resume tailored, every application accounted for.
        </div>

        <ul className="check-list">
          <li>
            <span className="auth-side-check">
              <IconCheck size={12} />
            </span>
            Plain-language breakdowns of what a role really asks for
          </li>
          <li>
            <span className="auth-side-check">
              <IconCheck size={12} />
            </span>
            Resume edits you review one at a time — nothing invented
          </li>
          <li>
            <span className="auth-side-check">
              <IconCheck size={12} />
            </span>
            A board that updates itself from your inbox
          </li>
          <li>
            <span className="auth-side-check">
              <IconCheck size={12} />
            </span>
            Interview questions grounded in your own experience
          </li>
        </ul>

        <div className="muted" style={{ position: "relative", fontSize: 12.5 }}>
          Your resumes and applications stay private to your account.
        </div>
      </aside>
    </div>
  );
}
