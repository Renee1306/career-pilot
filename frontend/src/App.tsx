import { NavLink, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import ApplicationDetail from "./pages/ApplicationDetail";
import Applications from "./pages/Applications";
import JobUnderstanding from "./pages/JobUnderstanding";
import Login from "./pages/Login";
import "./App.css";

function App() {
  const { session, signOut } = useAuth();

  return (
    <>
      <header>
        <strong>CareerPilot</strong>
        <nav>
          <NavLink to="/">Understand a Job</NavLink>
          <NavLink to="/applications">Applications</NavLink>
        </nav>
        {session && (
          <button type="button" onClick={signOut}>
            Sign out
          </button>
        )}
      </header>

      <main>
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
      </main>
    </>
  );
}

export default App;
