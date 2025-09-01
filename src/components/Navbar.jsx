// src/components/Navbar.jsx
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabase.jsx";

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/mood", label: "Mood" },
    { path: "/mindspace", label: "MindSpace" },
    { path: "/streak", label: "Streaks" },
    { path: "/completed-tasks", label: "Completed Tasks" },
  ];

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center p-4 bg-gray-100 shadow">
      {/* Left: nav links */}
      <div className="flex gap-4">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`px-3 py-2 rounded-xl font-medium transition ${
              location.pathname === item.path
                ? "bg-blue-600 text-white"
                : "text-gray-700 hover:bg-gray-200"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Right: logout */}
      <button
        onClick={handleLogout}
        className="px-3 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600"
      >
        Logout
      </button>
    </nav>
  );
};

export default Navbar;
