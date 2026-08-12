import { Route, Routes } from "react-router-dom";
import Chatbot from "./components/Chatbot";
import ProtectedRoute from "./components/ProtectedRoute";
import Topbar from "./components/Topbar";
import { useAuth } from "./context/AuthContext";
import { ChatScopeProvider } from "./context/ChatContext";
import ApplicationDetail from "./pages/ApplicationDetail";
import Applications from "./pages/Applications";
import JobUnderstanding from "./pages/JobUnderstanding";
import Login from "./pages/Login";
import ResumeEditor from "./pages/ResumeEditor";
import ResumeLibrary from "./pages/ResumeLibrary";
import "./App.css";

function AppLayout({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  if (!session) return <>{children}</>;

  return (
    <div className="app-shell">
      <Topbar />
      <main className="main-content">{children}</main>
      <Chatbot />
    </div>
  );
}

function App() {
  return (
    <ChatScopeProvider>
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
          <Route
            path="/resume-builder"
            element={
              <ProtectedRoute>
                <ResumeLibrary />
              </ProtectedRoute>
            }
          />
          <Route
            path="/resume-builder/:documentId"
            element={
              <ProtectedRoute>
                <ResumeEditor />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AppLayout>
    </ChatScopeProvider>
  );
}

export default App;
