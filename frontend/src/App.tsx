import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Sidebar from "./components/Sidebar";
import { useAuth } from "./context/AuthContext";
import ApplicationDetail from "./pages/ApplicationDetail";
import Applications from "./pages/Applications";
import JobUnderstanding from "./pages/JobUnderstanding";
import Login from "./pages/Login";
import "./App.css";

function AppLayout({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) return <>{children}</>;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <JobUnderstanding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications"
          element={
            <ProtectedRoute>
              <Applications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications/:applicationId"
          element={
            <ProtectedRoute>
              <ApplicationDetail />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AppLayout>
  );
}

export default App;
