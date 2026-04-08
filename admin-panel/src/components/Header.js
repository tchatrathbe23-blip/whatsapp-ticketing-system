import { useState, useEffect } from "react";

export default function Header({ onLogout }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.body.className = dark ? "dark" : "light";
  }, [dark]);

  return (
    <div className="header">
      <div className="header-breadcrumb">
        <span className="breadcrumb-root">BookingAdmin</span>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Dashboard</span>
      </div>

      <div className="header-right">
        <div className="header-badge">Admin</div>
        <button className="theme-btn" onClick={() => setDark(!dark)}>
          {dark ? "☀️ Light" : "🌙 Dark"}
        </button>
        <button className="logout-btn" onClick={onLogout}>
          🚪 Logout
        </button>
      </div>
    </div>
  );
}
