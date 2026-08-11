import { NavLink, Route, Routes } from "react-router-dom";
import ApplicationDetail from "./pages/ApplicationDetail";
import Applications from "./pages/Applications";
import JobUnderstanding from "./pages/JobUnderstanding";
import "./App.css";

function App() {
  return (
    <>
      <header>
        <strong>CareerPilot</strong>
        <nav>
          <NavLink to="/">Understand a Job</NavLink>
          <NavLink to="/applications">Applications</NavLink>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<JobUnderstanding />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/applications/:applicationId" element={<ApplicationDetail />} />
        </Routes>
      </main>
    </>
  );
}

export default App;
