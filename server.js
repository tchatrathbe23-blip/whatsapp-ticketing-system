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

// 🩺 HEALTH CHECKS
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'WhatsApp Ticketing API is running' });
});
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 📱 WHATSAPP QR DISPLAY
let latestQr = null;
let botStatus = 'Initializing...';

app.post('/internal/qr', (req, res) => {
  if (req.body.qr) {
    latestQr = req.body.qr;
    botStatus = 'Awaiting QR Scan';
  }
  if (req.body.status) {
    botStatus = req.body.status;
    if (req.body.status === 'isLogged' || req.body.status === 'inChat') {
      latestQr = null;
    }
  }
  res.sendStatus(200);
});

app.get('/qr', (req, res) => {
  if (botStatus === 'isLogged' || botStatus === 'inChat') {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>WhatsApp Bot Status</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="font-family:sans-serif;text-align:center;padding:50px;background:#f0f2f5;">
        <div style="background:white;padding:30px;border-radius:12px;max-width:400px;margin:auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <h2 style="color:#25D366;margin-top:0;">✅ WhatsApp Connected!</h2>
          <p style="color:#555;">Bot is active and logged in.</p>
        </div>
      </body>
      </html>
    `);
  }
  if (!latestQr) {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>WhatsApp QR Code</title><meta http-equiv="refresh" content="5"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
      <body style="font-family:sans-serif;text-align:center;padding:50px;background:#f0f2f5;">
        <div style="background:white;padding:30px;border-radius:12px;max-width:400px;margin:auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <h2>Status: ${botStatus}</h2>
          <p style="color:#666;">Generating QR code... Page will refresh automatically.</p>
        </div>
      </body>
      </html>
    `);
  }
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Scan WhatsApp QR Code</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="font-family:sans-serif;text-align:center;padding:50px;background:#f0f2f5;">
      <div style="background:white;padding:30px;border-radius:12px;max-width:400px;margin:auto;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
        <h2 style="margin-top:0;">Scan with WhatsApp</h2>
        <p style="color:#555;font-size:14px;">Open WhatsApp &gt; Settings / Menu &gt; <b>Linked Devices</b> &gt; Link a Device</p>
        <img src="${latestQr}" style="width:260px;height:260px;border-radius:8px;border:1px solid #eee;" />
        <p style="font-size:12px;color:#888;margin-top:15px;">Page will update when connected.</p>
      </div>
    </body>
    </html>
  `);
});

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
//  🌐 GOOGLE OAUTH LOGIN / SIGNUP
// ═══════════════════════════════════════════════════════════════

app.post("/google-login", async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ message: "Google credential token is required" });
    }

    // Verify token with Google OAuth TokenInfo endpoint
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
    if (!googleRes.ok) {
      const errData = await googleRes.json().catch(() => ({}));
      return res.status(401).json({ message: errData.error_description || "Invalid Google token" });
    }

    const payload = await googleRes.json();
    const { email, name, sub: googleId, picture: avatar } = payload;

    if (!email) {
      return res.status(400).json({ message: "Unable to retrieve email from Google account" });
    }

    let user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      user = await User.create({
        name: name || email.split('@')[0],
        email: email.toLowerCase().trim(),
        googleId,
        avatar
      });
      console.log(`✅ New user registered via Google: ${user.email}`);
    } else {
      if (!user.googleId) {
        user.googleId = googleId;
        if (avatar) user.avatar = avatar;
        await user.save();
      }
      console.log(`✅ User logged in via Google: ${user.email}`);
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({ token, name: user.name, email: user.email, avatar: user.avatar });
  } catch (err) {
    console.error("Google Auth error:", err.message);
    res.status(500).json({ message: "Google authentication failed. Please try again." });
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
  const PORT = process.env.PORT || 10000;

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
      process.exit(1);
    }
  });
}

module.exports = { app, server };
