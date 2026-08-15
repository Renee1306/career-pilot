import { Suspense, lazy } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Topbar from "./components/Topbar";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import "./App.css";

/* The public pages load eagerly - they're the first paint for a cold visitor. Everything
   behind auth is code-split, so the landing page doesn't ship the resume-builder editor
   (by far the heaviest route) to someone who has not signed in yet. */
const Dashboard = lazy(() => import("./pages/Dashboard"));
const JobUnderstanding = lazy(() => import("./pages/JobUnderstanding"));
const Applications = lazy(() => import("./pages/Applications"));
const ApplicationDetail = lazy(() => import("./pages/ApplicationDetail"));
const ResumeLibrary = lazy(() => import("./pages/ResumeLibrary"));
const ResumeEditor = lazy(() => import("./pages/ResumeEditor"));

/** The signed-in product shell. A layout route rather than a per-page wrapper, so the
 *  top nav mounts once and survives navigation between product pages - the public
 *  Landing/Login routes sit outside it and render their own chrome. */
function AppChrome() {
  return (
    <ProtectedRoute>
      <div className="app-shell">
        <Topbar />
        <main className="main-content">
          <Suspense fallback={<div className="spinner spinner-page" role="status" aria-label="Loading" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />

      <Route element={<AppChrome />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/job-analysis" element={<JobUnderstanding />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/applications/:applicationId" element={<ApplicationDetail />} />
        <Route path="/resume-builder" element={<ResumeLibrary />} />
        <Route path="/resume-builder/:documentId" element={<ResumeEditor />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
