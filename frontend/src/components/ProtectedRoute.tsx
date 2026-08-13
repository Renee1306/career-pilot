import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="spinner spinner-page" role="status" aria-label="Loading" />;
  }

  // `from` lets the login screen bounce the user back to whatever they were opening,
  // which matters for deep links (an emailed /applications/:id, say).
  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
