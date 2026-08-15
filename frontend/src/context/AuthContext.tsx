import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { prefetchPickerData } from "../lib/api";
import { supabase } from "../lib/supabaseClient";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session && import.meta.env.VITE_DEV_AUTO_LOGIN === "true") {
        // Dev-only: skip the login screen by signing in as a fixed dev account.
        // Remove VITE_DEV_AUTO_LOGIN from .env before shipping/demoing real auth.
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email: import.meta.env.VITE_DEV_EMAIL,
          password: import.meta.env.VITE_DEV_PASSWORD,
        });
        if (error) console.warn("Dev auto-login failed:", error.message);
        setSession(signInData?.session ?? null);
        setLoading(false);
        if (signInData?.session) prefetchPickerData();
        return;
      }
      setSession(data.session);
      setLoading(false);
      if (data.session) prefetchPickerData();
    });

    // Also fires on a fresh sign-in with no page reload (e.g. from the Login page), and again on
    // token refresh - createListCache's load() is a no-op once something's already cached or in
    // flight, so calling this more than once here costs nothing.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) prefetchPickerData();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return <AuthContext.Provider value={{ session, loading, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
