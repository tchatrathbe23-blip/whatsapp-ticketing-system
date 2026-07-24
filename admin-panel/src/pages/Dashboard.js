import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import "./App.css";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import AuthFlow from "../components/AuthFlow";
import BookingTable from "../components/BookingTable";
import { BookingBarChart, VisitorPieChart } from "../components/AnalyticsCharts";

// ─── Toast helper ──────────────────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span>{t.message}</span>
          <button className="toast-close" onClick={() => onDismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData]               = useState([]);
  const [dateFilter, setDateFilter]   = useState("");
  const [token, setToken]             = useState(localStorage.getItem("token") || "");
  const [paidBookings, setPaidBookings] = useState({});
  const [activePage, setActivePage]   = useState("Dashboard");
  // Socket.io state
  const [isConnected, setIsConnected] = useState(false);
  const [newBookingIds, setNewBookingIds] = useState(new Set());
  const [toasts, setToasts] = useState([]);
  const socketRef = useRef(null);
  const toastIdRef = useRef(0);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
  const isAuthenticated = Boolean(token);

  // ─── Toast helpers ───────────────────────────────────────────────────────────
  const addToast = useCallback((message, type = "info") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ─── API helpers ─────────────────────────────────────────────────────────────
  const fetchData = async (date = "") => {
    if (!token) return;
    try {
      const res = await axios.get(
        `${BACKEND_URL}/api/bookings/all${date ? `?date=${date}` : ""}`,
        { headers: { Authorization: token } }
      );
      setData(res.data);
    } catch (err) {
      console.error("Error fetching data", err);
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        localStorage.removeItem("token");
        setToken("");
      }
    }
  };

  // ─── Auth handlers ───────────────────────────────────────────────────────────
  const handleLoginSuccess = (authToken) => {
    localStorage.setItem("token", authToken);
    setToken(authToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken("");
    setData([]);
    setDateFilter("");
    setActivePage("Dashboard");
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  };

  // ─── Socket.io connection ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return; // Only connect when logged in

    const socket = io(BACKEND_URL, { transports: ["websocket", "polling"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      console.log("🔴 Socket connected:", socket.id);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
      console.log("🔴 Socket disconnected");
    });

    // ── New booking created via chatbot ──────────────────────────────────────
    socket.on("new_booking", (booking) => {
      // Prepend new booking to the top of the list
      setData((prev) => {
        // Avoid duplicates (webhook may fire twice in rare cases)
        const exists = prev.some((b) => b.bookingId === booking.bookingId);
        if (exists) return prev;
        return [booking, ...prev];
      });

      // Flash the row for 4 seconds
      setNewBookingIds((prev) => new Set([...prev, booking.bookingId]));
      setTimeout(() => {
        setNewBookingIds((prev) => {
          const next = new Set(prev);
          next.delete(booking.bookingId);
          return next;
        });
      }, 4000);

      addToast(`🔔 New booking: ${booking.bookingId}`, "new");
    });

    // ── Payment confirmed via Razorpay webhook ───────────────────────────────
    socket.on("booking_paid", ({ bookingId }) => {
      setData((prev) =>
        prev.map((b) =>
          b.bookingId === bookingId ? { ...b, paymentStatus: "paid" } : b
        )
      );
      setPaidBookings((prev) => ({ ...prev, [bookingId]: true }));
      addToast(`✅ Payment confirmed: ${bookingId}`, "paid");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token, BACKEND_URL, addToast]);

  // ─── Initial data load ───────────────────────────────────────────────────────
  useEffect(() => {
    if (token) fetchData();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 💵 Mark booking as paid (cash / offline payment at counter) ─────────────
  const handleMarkPaid = async (bookingId) => {
    try {
      await axios.patch(
        `${BACKEND_URL}/api/bookings/${bookingId}/mark-paid`,
        {},
        { headers: { Authorization: token } }
      );
      // Optimistic UI update (socket event also fires, but this is instant)
      setData((prev) =>
        prev.map((b) => b.bookingId === bookingId ? { ...b, paymentStatus: 'paid' } : b)
      );
      setPaidBookings((prev) => ({ ...prev, [bookingId]: true }));
      addToast(`💵 Booking ${bookingId} marked as paid!`, 'paid');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to mark as paid.';
      addToast(`❌ ${msg}`, 'info');
    }
  };

  // ─── 🔗 Resend / regenerate a fresh payment link ────────────────────────────
  const handleResendLink = async (bookingId) => {
    try {
      const { data } = await axios.post(
        `${BACKEND_URL}/api/bookings/${bookingId}/resend-link`,
        {},
        { headers: { Authorization: token } }
      );
      // Copy to clipboard and notify admin
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(data.url);
        addToast(`🔗 Payment link copied! Share it with the customer.`, 'new');
      } else {
        // Fallback: show in a prompt so admin can manually copy
        window.prompt('Copy this payment link and share it with the customer:', data.url);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to generate link.';
      addToast(`❌ ${msg}`, 'info');
    }
  };

  // ─── Stats ────────────────────────────────────────────────────────────────────
  const totalRevenue  = data.reduce((sum, b) => sum + (b.adults * 100 + b.children * 50), 0);
  const totalAdults   = data.reduce((sum, b) => sum + b.adults, 0);
  const totalChildren = data.reduce((sum, b) => sum + b.children, 0);

  if (!isAuthenticated) {
    return <AuthFlow BACKEND_URL={BACKEND_URL} onLoginSuccess={handleLoginSuccess} />;
  }

  // ─── Page renderer ────────────────────────────────────────────────────────────
  const renderPageContent = () => {
    switch (activePage) {
      case "Dashboard":
        return (
          <>
            {/* STAT CARDS */}
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-icon-wrap stat-icon-blue">📦</div>
                <div className="stat-label">Total Bookings</div>
                <div className="stat-value">{data.length}</div>
                <div className="stat-sub">All time</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrap stat-icon-green">💰</div>
                <div className="stat-label">Total Revenue</div>
                <div className="stat-value">₹{totalRevenue}</div>
                <div className="stat-sub">Adults + Children</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrap stat-icon-purple">👨</div>
                <div className="stat-label">Adults</div>
                <div className="stat-value">{totalAdults}</div>
                <div className="stat-sub">@ ₹100 each</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrap stat-icon-orange">👶</div>
                <div className="stat-label">Children</div>
                <div className="stat-value">{totalChildren}</div>
                <div className="stat-sub">@ ₹50 each</div>
              </div>
            </div>

            {/* CHARTS */}
            <div className="charts-row">
              <div className="chart-card">
                <h3 className="section-title">Bookings per date</h3>
                <BookingBarChart data={data} />
              </div>
              <div className="chart-card">
                <h3 className="section-title">Visitor split</h3>
                <VisitorPieChart data={data} />
              </div>
            </div>

            {/* BOOKINGS TABLE */}
            <BookingTable
              data={data}
              paidBookings={paidBookings}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              fetchData={fetchData}
              handleMarkPaid={handleMarkPaid}
              handleResendLink={handleResendLink}
              newBookingIds={newBookingIds}
            />
          </>
        );

      case "Bookings":
        return (
          <>
            <div className="page-heading">
              <h2 className="page-title">📋 All Bookings</h2>
              <p className="page-desc">Manage and view all booking records</p>
            </div>
            <BookingTable
              data={data}
              paidBookings={paidBookings}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              fetchData={fetchData}
              handleMarkPaid={handleMarkPaid}
              handleResendLink={handleResendLink}
              newBookingIds={newBookingIds}
            />
          </>
        );

      case "Revenue":
        return (
          <>
            <div className="page-heading">
              <h2 className="page-title">💰 Revenue Overview</h2>
              <p className="page-desc">Track your earnings and financial metrics</p>
            </div>
            <div className="stats-row">
              <div className="stat-card">
                <div className="stat-icon-wrap stat-icon-green">💰</div>
                <div className="stat-label">Total Revenue</div>
                <div className="stat-value">₹{totalRevenue}</div>
                <div className="stat-sub">From all bookings</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrap stat-icon-blue">👨</div>
                <div className="stat-label">Adult Revenue</div>
                <div className="stat-value">₹{totalAdults * 100}</div>
                <div className="stat-sub">{totalAdults} adults × ₹100</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrap stat-icon-orange">👶</div>
                <div className="stat-label">Children Revenue</div>
                <div className="stat-value">₹{totalChildren * 50}</div>
                <div className="stat-sub">{totalChildren} children × ₹50</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrap stat-icon-purple">📈</div>
                <div className="stat-label">Avg per Booking</div>
                <div className="stat-value">
                  ₹{data.length ? Math.round(totalRevenue / data.length) : 0}
                </div>
                <div className="stat-sub">Per booking average</div>
              </div>
            </div>
            <div className="chart-card" style={{ maxWidth: 700 }}>
              <h3 className="section-title">Revenue by Date</h3>
              <BookingBarChart data={data} />
            </div>
          </>
        );

      case "Visitors":
        return (
          <>
            <div className="page-heading">
              <h2 className="page-title">👥 Visitor Analytics</h2>
              <p className="page-desc">Breakdown of adults and children visitors</p>
            </div>
            <div className="stats-row" style={{ maxWidth: 600 }}>
              <div className="stat-card">
                <div className="stat-icon-wrap stat-icon-blue">👨</div>
                <div className="stat-label">Total Adults</div>
                <div className="stat-value">{totalAdults}</div>
                <div className="stat-sub">@ ₹100 each</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrap stat-icon-orange">👶</div>
                <div className="stat-label">Total Children</div>
                <div className="stat-value">{totalChildren}</div>
                <div className="stat-sub">@ ₹50 each</div>
              </div>
            </div>
            <div className="chart-card" style={{ maxWidth: 400 }}>
              <h3 className="section-title">Visitor Split</h3>
              <VisitorPieChart data={data} />
            </div>
          </>
        );

      case "Settings":
        return (
          <>
            <div className="page-heading">
              <h2 className="page-title">⚙️ Settings</h2>
              <p className="page-desc">Configure your admin preferences</p>
            </div>
            <div className="settings-grid">
              <div className="settings-card">
                <h4 className="settings-card-title">Profile</h4>
                <div className="settings-item">
                  <span className="settings-label">Username</span>
                  <span className="settings-value">admin</span>
                </div>
                <div className="settings-item">
                  <span className="settings-label">Role</span>
                  <span className="settings-value">Administrator</span>
                </div>
                <div className="settings-item">
                  <span className="settings-label">Email</span>
                  <span className="settings-value">admin@bookingadmin.com</span>
                </div>
              </div>
              <div className="settings-card">
                <h4 className="settings-card-title">Preferences</h4>
                <div className="settings-item">
                  <span className="settings-label">Real-time Sync</span>
                  <span className={`settings-toggle ${isConnected ? "on" : "off"}`}>
                    {isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <div className="settings-item">
                  <span className="settings-label">Auto-refresh</span>
                  <span className="settings-toggle on">Enabled</span>
                </div>
                <div className="settings-item">
                  <span className="settings-label">Currency</span>
                  <span className="settings-value">₹ INR</span>
                </div>
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="layout">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <div className="main">
        {/* Pass live status badge to Header */}
        <Header onLogout={handleLogout} isConnected={isConnected} />

        <div className="content">
          {renderPageContent()}
        </div>
      </div>

      {/* Floating toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
