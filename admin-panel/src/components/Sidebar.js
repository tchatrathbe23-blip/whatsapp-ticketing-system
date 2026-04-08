import { useState } from "react";

const navItems = [
  { icon: "📊", label: "Dashboard" },
  { icon: "📋", label: "Bookings" },
  { icon: "💰", label: "Revenue" },
  { icon: "👥", label: "Visitors" },
  { icon: "⚙️", label: "Settings" },
];

export default function Sidebar({ activePage, onNavigate }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-logo">
        <div className="logo-icon">B</div>
        {!collapsed && <span className="logo-text">BookingAdmin</span>}
      </div>

      <button className="toggle-btn" onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? "→" : "←"}
      </button>

      <nav className="nav">
        {navItems.map(({ icon, label }) => (
          <div
            key={label}
            className={`nav-item ${activePage === label ? "active" : ""}`}
            onClick={() => onNavigate(label)}
            title={collapsed ? label : ""}
          >
            <span className="nav-icon">{icon}</span>
            {!collapsed && <span className="nav-label">{label}</span>}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {!collapsed && (
          <div className="sidebar-footer-text">© 2026 BookingAdmin</div>
        )}
      </div>
    </div>
  );
}
