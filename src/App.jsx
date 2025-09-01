import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import SignIn from "./pages/SignIn.jsx";
import SignUp from "./pages/SignUp.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Mood from "./pages/Mood.jsx";
import Scan from "./pages/Scan.jsx";
import Streak from "./pages/Streak.jsx";
import CompletedTasks from "./pages/CompletedTasks.jsx"; // ✅ new
import RequireAuth from "./components/RequireAuth.jsx";
import Navbar from "./components/Navbar.jsx";
import Phase3A from "./features/mindspace/MindSpace.jsx";
import Phase3AAppShell from "./features/mindspace/MindSpace.jsx";
import TeacherDashboard from "./pages/TeacherDashboard.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />

      {/* ✅ Protected routes with Navbar + padding */}
      <Route
        path="/dashboard" 
        element={
          <RequireAuth>
            <div>
              <Navbar />
              <div className="pt-16">
                <Dashboard />
              </div>
            </div>
          </RequireAuth>
        }
      />
      <Route
        path="/mood"
        element={
          <RequireAuth>
            <div>
              <Navbar />
              <div className="pt-16">
                <Mood />
              </div>
            </div>
          </RequireAuth>
        }
      />
      <Route path="/mindspace" element={<Phase3AAppShell />} />
      <Route
        path="/streak"
        element={
          <RequireAuth>
            <div>
              <Navbar />
              <div className="pt-16">
                <Streak />
              </div>
            </div>
          </RequireAuth>
        }
      />
      <Route
        path="/completed-tasks" // ✅ new
        element={
          <RequireAuth>
            <div>
              <Navbar />
              <div className="pt-16">
                <CompletedTasks />
              </div>
            </div>
          </RequireAuth>
        }
      />
      <Route path="/Admin" element={<TeacherDashboard />} />

      {/* Redirect unknown routes */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
