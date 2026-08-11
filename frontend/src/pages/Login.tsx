import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const { session } = useAuth();
  const [mode, setMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) {
    return <Navigate to="/" replace />;
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

  return (
    <div className="login-shell">
      <div className="login-hero">
        <div className="login-horizon" aria-hidden="true" />
        <p className="login-callsign">CAREERPILOT</p>
        <h1 className="login-wordmark">
          Chart your <em>next</em> role.
        </h1>
        <p className="login-sub">
          Understand the job, tailor the resume, track the flight from application to offer.
        </p>
      </div>

      <div className="login-panel">
        <div className="card" style={{ width: 360 }}>
          <h2 style={{ marginBottom: 4 }}>{mode === "sign_in" ? "Sign in" : "Create account"}</h2>
          <p className="muted" style={{ marginBottom: 20 }}>
            {mode === "sign_in" ? "Welcome back to the cockpit." : "Set up your flight deck."}
          </p>
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className="input"
                type="email"
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
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="alert">{error}</p>}
            {info && <p className="muted">{info}</p>}
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={submitting}>
              {mode === "sign_in" ? "Sign in" : "Sign up"}
            </button>
          </form>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ width: "100%", marginTop: 12, border: "none" }}
            onClick={() => setMode(mode === "sign_in" ? "sign_up" : "sign_in")}
          >
            {mode === "sign_in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
