import React, { useState } from "react";

export default function BookingTable({
  data,
  paidBookings,
  dateFilter,
  setDateFilter,
  fetchData,
  handleMarkPaid,
  handleResendLink,
  newBookingIds = new Set()   // IDs of recently arrived bookings (socket push)
}) {
  // Per-row loading state so each button shows a spinner independently
  const [loading, setLoading] = useState({}); // { [bookingId]: 'marking' | 'resending' }

  const withLoading = async (bookingId, type, action) => {
    setLoading((prev) => ({ ...prev, [bookingId]: type }));
    try {
      await action();
    } finally {
      setLoading((prev) => { const n = { ...prev }; delete n[bookingId]; return n; });
    }
  };

  return (
    <div>
      <div className="section-header">
        <h3 className="section-title">All Bookings</h3>
        <div className="date-filter">
          <input
            type="date"
            className="date-input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
          <button
            className="filter-btn"
            onClick={() => fetchData(dateFilter)}
          >
            🔍 Search
          </button>
          {dateFilter && (
            <button
              className="filter-btn clear-btn"
              onClick={() => { setDateFilter(""); fetchData(""); }}
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      <div className="booking-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>User</th>
              <th>Adults</th>
              <th>Children</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-state">
                  No bookings found
                </td>
              </tr>
            ) : (
              data.map((b, i) => {
                const amount  = b.adults * 100 + b.children * 50;
                const isPaid  = b.paymentStatus === 'paid' || paidBookings[b.bookingId];
                const isNew   = newBookingIds.has(b.bookingId);
                const rowLoad = loading[b.bookingId]; // 'marking' | 'resending' | undefined

                return (
                  <tr key={i} className={isNew ? "new-booking-flash" : ""}>
                    <td>
                      <span className="booking-id">{b.bookingId}</span>
                    </td>
                    <td className="user-cell">{b.userId}</td>
                    <td>{b.adults}</td>
                    <td>{b.children}</td>
                    <td>{b.date}</td>
                    <td className="amount">₹{amount}</td>
                    <td>
                      <span className={`status-badge ${isPaid ? "status-confirmed" : "status-pending"}`}>
                        {isPaid ? "Paid" : "Pending"}
                      </span>
                    </td>
                    <td>
                      {isPaid ? (
                        /* Already paid — nothing more to do */
                        <span className="paid-label">✓ Paid</span>
                      ) : (
                        /* Two admin actions for pending bookings */
                        <div className="action-btns">

                          {/* 💵 Mark as Paid — cash / counter payment */}
                          <button
                            className="action-btn action-btn--mark"
                            title="Mark as paid (cash / counter payment)"
                            disabled={!!rowLoad}
                            onClick={() =>
                              withLoading(b.bookingId, 'marking', () => handleMarkPaid(b.bookingId))
                            }
                          >
                            {rowLoad === 'marking' ? (
                              <span className="btn-spinner" />
                            ) : '💵 Mark Paid'}
                          </button>

                          {/* 🔗 Resend payment link — expired / lost link */}
                          <button
                            className="action-btn action-btn--resend"
                            title="Generate a fresh payment link and copy to clipboard"
                            disabled={!!rowLoad}
                            onClick={() =>
                              withLoading(b.bookingId, 'resending', () => handleResendLink(b.bookingId))
                            }
                          >
                            {rowLoad === 'resending' ? (
                              <span className="btn-spinner" />
                            ) : '🔗 Resend Link'}
                          </button>

                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
