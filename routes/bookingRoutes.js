const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');

const Booking = require('../models/Booking');
const auth = require('./middleware/auth');

// ─────────────────────────────────────────────────────────────────────────────
//  🔐 GET /all  —  fetch all bookings (with optional date filter)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/all', auth, async (req, res) => {
  try {
    const { date } = req.query;
    let filter = {};

    if (date) {
      // date from type="date" input comes as YYYY-MM-DD (e.g., "2024-04-08")
      const [year, month, day] = date.split('-');
      const d = parseInt(day, 10);   // remove leading zero
      const m = parseInt(month, 10); // remove leading zero

      // Build a regex that matches common date formats:
      // "2024-04-08", "08-04-2024", "08/04/2024", "04/08/2024",
      // "8/4/2024", "8-4-2024", "2024/04/08", etc.
      filter.date = {
        $regex: new RegExp(
          `^${year}[-/]0?${m}[-/]0?${d}$` + '|' +
          `^0?${d}[-/]0?${m}[-/]${year}$` + '|' +
          `^0?${m}[-/]0?${d}[-/]${year}$` + '|' +
          `^0?${d}[-/]0?${m}[-/]${year.slice(2)}$`
        )
      };
    }

    const data = await Booking.find(filter).sort({ createdAt: -1 });
    res.json(data);

  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).send("Server error");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  💵 PATCH /:bookingId/mark-paid
//
//  Admin manually marks a booking as paid — used when:
//    • Customer pays cash at the ticket counter
//    • Offline / in-person payment collection
//
//  Also emits a real-time socket event so every open dashboard tab updates.
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:bookingId/mark-paid', auth, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findOneAndUpdate(
      { bookingId },
      { paymentStatus: 'paid' },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }

    // Push real-time update to all connected dashboard tabs
    if (global.io) {
      global.io.emit('booking_paid', { bookingId });
      console.log(`📡 Emitted booking_paid (manual mark) for: ${bookingId}`);
    }

    res.json({ message: 'Booking marked as paid.', booking });
  } catch (err) {
    console.error('Mark-paid error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
//  🔗 POST /:bookingId/resend-link
//
//  Generate a fresh Razorpay payment link for a pending booking — used when:
//    • The original link expired
//    • The customer never received or lost the original link
//
//  The admin copies the returned URL and shares it with the customer.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:bookingId/resend-link', auth, async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findOne({ bookingId });
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found.' });
    }
    if (booking.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'This booking is already paid.' });
    }

    if (!process.env.RAZORPAY_KEY || !process.env.RAZORPAY_SECRET) {
      return res.status(500).json({ message: 'Razorpay credentials not configured.' });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY,
      key_secret: process.env.RAZORPAY_SECRET
    });

    const amount = booking.adults * 100 + booking.children * 50;

    const paymentLink = await razorpay.paymentLink.create({
      amount: amount * 100,           // convert to paise
      currency: 'INR',
      accept_partial: false,
      // Append timestamp so Razorpay treats it as a unique fresh link
      reference_id: `${bookingId}-r${Date.now()}`,
      description: `Museum Booking – ${bookingId}`,
      customer: {
        contact: booking.userId.split('@')[0].split(':')[0]
      },
      notify: { sms: false, email: false },
      reminder_enable: true
    });

    console.log(`🔗 Fresh payment link generated for: ${bookingId}`);
    res.json({ url: paymentLink.short_url });

  } catch (err) {
    console.error('Resend-link error:', err);
    res.status(500).json({ message: 'Failed to generate payment link.' });
  }
});

module.exports = router;
