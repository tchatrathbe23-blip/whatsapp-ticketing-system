require('dotenv').config();
const axios = require('axios');
const wppconnect = require('@wppconnect-team/wppconnect');
const Booking = require('../models/Booking');
const connectDB = require('../config/db');
const { handleMessage } = require('./chatbot.logic');

connectDB(); // ✅ Connect DB first

const userState = {};
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';

/**
 * Real payment handler injected into the state machine.
 * 1. Saves the booking to MongoDB as PENDING
 * 2. Notifies the admin dashboard via Socket.io (through the server)
 * 3. Generates a Razorpay payment link and sends it to the user
 */
async function onConfirm(client, userId, state, sendBot) {
  const bookingId = 'BK' + Date.now();
  const { adults, children, date, total } = state.booking;

  // 1. Save booking as PENDING in MongoDB
  await Booking.create({
    userId,
    adults,
    children,
    date,
    bookingId,
    paymentStatus: 'pending'
  });

  // 2. Reset state immediately so user can start a new booking
  state.step = 'menu';
  state.booking = {};

  // 3. 🔴 Notify admin dashboard in real-time via the Express server
  //    chatbot.js runs as a separate process so it can't use global.io directly.
  //    We call a local-only endpoint on the Express server which emits the event.
  try {
    await axios.post(`${SERVER_URL}/internal/new-booking`, {
      booking: { userId, adults, children, date, bookingId, paymentStatus: 'pending' }
    });
  } catch (err) {
    // Non-critical — dashboard will still show the booking on next refresh
    console.warn('⚠️  Could not notify dashboard via socket:', err.message);
  }

  // 4. Generate Razorpay payment link
  try {
    const response = await axios.post(`${SERVER_URL}/api/create-payment-link`, {
      amount: total,
      reference_id: bookingId,
      contact: userId.split('@')[0].split(':')[0]
    });
    const paymentUrl = response.data.url;

    await sendBot(
      client,
      userId,
      `✅ Booking Reserved!\n🆔 ${bookingId}\n\n💳 *Please complete your payment to confirm your tickets:*\n${paymentUrl}`
    );
  } catch (err) {
    console.error('❌ Payment link error:', err.message);
    await sendBot(
      client,
      userId,
      `✅ Booking Saved!\n🆔 ${bookingId}\n\n⚠️ Payment link could not be generated right now. Please contact support.`
    );
  }
}

wppconnect.create({
  session: 'mySessionName',
  autoClose: 0,
  puppeteerOptions: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
}).then(client => {
  console.log('✅ WhatsApp BOT STARTED successfully');

  client.onMessage(async (message) => {
    try {
      await handleMessage(client, message, userState, { onConfirm });
    } catch (err) {
      console.error('❌ ERROR:', err);
    }
  });
}).catch(err => {
  console.error('❌ INIT ERROR:', err);
});
