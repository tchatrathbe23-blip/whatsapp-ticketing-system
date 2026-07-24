require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const Razorpay = require("razorpay");
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const connectDB = require('./config/db');
const User = require('./models/User');
const Booking = require('./models/Booking'); // ✅ Fixed: Imported Booking Model!

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// 🔥 IMPORTANT
global.io = io;
connectDB();

// 🔧 MIDDLEWARE
app.use(cors());
app.use(express.json());

// 📦 ROUTES
app.use('/api/bookings', require('./routes/bookingRoutes'));

// ═══════════════════════════════════════════════════════════════
//  🔴 SOCKET BRIDGE — called by chatbot.js (separate process)
//     chatbot.js can't access global.io directly, so it HTTP-POSTs
//     here and the server re-emits the socket event.
// ═══════════════════════════════════════════════════════════════
app.post('/internal/new-booking', (req, res) => {
  const { booking } = req.body;
  if (booking) {
    global.io.emit('new_booking', booking);
    console.log(`📡 Emitted new_booking to dashboard: ${booking.bookingId}`);
  }
  res.sendStatus(200);
});

// ─── OTP & RESET TOKEN STORE (in-memory) ────────────────────
let otpStore = {};       // { email: { otp, expiresAt } }
let resetTokenStore = {}; // { token: { email, expiresAt } }

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

// 💳 RAZORPAY SETUP
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY,
  key_secret: process.env.RAZORPAY_SECRET
});

// Get Razorpay Key for Dashboard
app.get("/razorpay-key", (req, res) => {
  res.json({ key: process.env.RAZORPAY_KEY });
});

// Create Razorpay Order for Dashboard manual payment
app.post("/create-order", async (req, res) => {
  try {
    // Guard: ensure keys are configured
    if (!process.env.RAZORPAY_KEY || !process.env.RAZORPAY_SECRET) {
      return res.status(500).json({ message: "Razorpay credentials not configured on server." });
    }

    const { amount } = req.body;
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount provided." });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise, must be integer
      currency: "INR",
      receipt: "order_rcptid_" + Date.now()
    });
    res.json(order);
  } catch (err) {
    // Surface the real Razorpay error so it's visible in browser + logs
    const razorError = err?.error?.description || err?.message || "Failed to create order";
    console.error("Razorpay Order Creation Error:", JSON.stringify(err?.error || err));
    res.status(500).json({ message: razorError });
  }
});



// ═══════════════════════════════════════════════════════════════
//  💳 RAZORPAY WHATSAPP PAYMENT LINKS & WEBHOOKS
// ═══════════════════════════════════════════════════════════════

// 1. Generate Payment Link for Chatbot
app.post("/api/create-payment-link", async (req, res) => {
  try {
    const { amount, reference_id, contact } = req.body;
    
    // ✅ Fixed: Uses singular "paymentLink"
    const paymentLink = await razorpay.paymentLink.create({
      amount: amount * 100, // paise
      currency: "INR",
      accept_partial: false,
      reference_id: reference_id, // Link to Booking ID
      description: "Ticketing System Booking",
      customer: {
        contact: contact
      },
      notify: { sms: false, email: false },
      reminder_enable: true
    });
    
    res.json({ url: paymentLink.short_url });
  } catch (err) {
    console.error("Payment Link Error:", err);
    res.status(500).json({ message: "Failed to create link" });
  }
});

// 2. Listen for Successful Payments
app.post("/api/webhook", async (req, res) => {
  // Acknowledge receipt immediately so Razorpay doesn't retry
  res.status(200).send("OK");

  const event = req.body.event;

  if (event === "payment_link.paid") {
    // The reference_id is the BookingId we sent in earlier
    const bookingId = req.body.payload.payment_link.entity.reference_id;
    
    try {
      // Find the booking and mark it as paid
      await Booking.findOneAndUpdate(
        { bookingId: bookingId },
        { paymentStatus: 'paid' }
      );
      
      console.log(`✅ Payment received and saved in DB for booking: ${bookingId}`);

      // 🔴 Push real-time update to admin dashboard
      global.io.emit('booking_paid', { bookingId });
      console.log(`📡 Emitted booking_paid to dashboard: ${bookingId}`);
    } catch (err) {
      console.error("Webhook DB Update Error:", err);
    }
  }
});

// ═══════════════════════════════════════════════════════════════
//  🔐 REGISTRATION & LOGIN (React Dashboard)
// ═══════════════════════════════════════════════════════════════

app.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) return res.status(400).json({ message: "All fields are required" });
    if (password.length < 4) return res.status(400).json({ message: "Password must be at least 4 characters" });

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) return res.status(400).json({ message: "An account with this email already exists" });

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password
    });

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    console.log(`✅ New user registered: ${user.email}`);
    res.status(201).json({ token, name: user.name, email: user.email });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: "Invalid email or password" });

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({ token, name: user.name, email: user.email });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed. Please try again." });
  }
});

// ═══════════════════════════════════════════════════════════════
//  🔑 FORGOT PASSWORD FLOW
// ═══════════════════════════════════════════════════════════════

app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email address is required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "No account found with this email" });

    const otp = generateOTP();
    otpStore[email.toLowerCase()] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };

    console.log("═════════════════════════════════════════");
    console.log(`📧 OTP for ${email}: ${otp}`);
    console.log("═════════════════════════════════════════");

    const [localPart, domain] = email.split("@");
    const maskedEmail = localPart.slice(0, 2) + "***@" + domain;

    res.json({ message: "OTP sent", maskedEmail });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong." });
  }
});

app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required" });

  const key = email.toLowerCase();
  const stored = otpStore[key];

  if (!stored) return res.status(400).json({ message: "No OTP requested." });
  if (Date.now() > stored.expiresAt) {
    delete otpStore[key];
    return res.status(400).json({ message: "OTP has expired." });
  }
  if (stored.otp !== otp) return res.status(400).json({ message: "Invalid OTP." });

  delete otpStore[key];
  const resetToken = generateResetToken();
  resetTokenStore[resetToken] = { email: key, expiresAt: Date.now() + 10 * 60 * 1000 };

  res.json({ message: "OTP verified", resetToken });
});

app.post("/reset-password", async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) return res.status(400).json({ message: "Missing data" });

    const stored = resetTokenStore[resetToken];
    if (!stored || Date.now() > stored.expiresAt) return res.status(400).json({ message: "Invalid/expired link." });

    const user = await User.findOne({ email: stored.email });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = newPassword; 
    await user.save();
    delete resetTokenStore[resetToken];

    console.log(`✅ Password changed for ${stored.email}`);
    res.json({ message: "Password reset successfully." });
  } catch (err) {
    res.status(500).json({ message: "Failed to reset password." });
  }
});

// 🚀 START SERVER
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 5000;

  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
      process.exit(1);
    }
  });
}

module.exports = { app, server };
