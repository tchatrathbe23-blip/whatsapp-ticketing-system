require('dotenv').config();
const axios = require('axios');
const wppconnect = require('@wppconnect-team/wppconnect');
const Booking = require('../models/Booking');
const connectDB = require('../config/db');
   // Adjust path if needed

connectDB(); // ✅ connect DB FIRST

const lastBotMessages = new Map();

function normalize(text) {
  return text.toLowerCase().trim();
}

function rememberBot(userId, text) {
  const key = userId + "|" + normalize(text);
  lastBotMessages.set(key, Date.now());
}

const MY_NUMBER = '919888063069@c.us';
const userState = {};

async function sendBot(client, userId, text) {
  rememberBot(userId, text); // 🔥 track message text
  return await client.sendText(userId, text);
}

wppconnect.create({
  session: 'mySessionName',
  autoClose: 0,
   puppeteerOptions: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
  catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
    console.log('\n\n✅ CLICK THIS LINK FOR A PERFECT QR CODE:');
    console.log('https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=' + encodeURIComponent(urlCode));
    console.log('\n\n');
  }  
}).then(client => {
  console.log('✅ WhatsApp BOT STARTED successfully');

  client.onAnyMessage(async (message) => {
    try {
      const key = message.from + "|" + message.body?.toLowerCase().trim();
      if (lastBotMessages.has(key)) {
        lastBotMessages.delete(key);
        return; // 🔥 STOP LOOP HERE
      }

      if (!message.body) return;
      if (message.isGroupMsg) return;
      if (message.from === 'status@broadcast') return;

      const userId = message.from;
      if (userId !== MY_NUMBER) return;

      const text = message.body.toLowerCase().trim();
      console.log('📩', userId, ':', text);

      if (!userState[userId]) {
        userState[userId] = { step: 'start', booking: {} };
      }

      const state = userState[userId];

      if (text === 'hi' || text === 'hello') {
        state.step = 'menu';
        await sendBot(client, userId, '👋 Welcome!\n\n1️⃣ Book Ticket\n2️⃣ Events\n3️⃣ Support');
        return;
      }

      if (state.step === 'menu') {
        if (text === '1') {
          state.step = 'adults';
          await sendBot(client, userId, '👨 Enter number of adults:');
          return;
        }
        if (text === '2') {
          await sendBot(client, userId, '🎨 Events coming soon!');
          return;
        }
        if (text === '3') {
          await sendBot(client, userId, '🤝 Support will contact you.');
          return;
        }
        return;
      }

      if (state.step === 'adults') {
        const adults = parseInt(text, 10);
        if (isNaN(adults) || adults <= 0) {
          await sendBot(client, userId, '❌ Please enter a valid number (example: 2)');
          return;
        }
        state.booking.adults = adults;
        state.step = 'children';
        await sendBot(client, userId, '👶 Enter number of children (or 0):');
        return;
      }

      if (state.step === 'children') {
        const children = parseInt(text, 10);
        if (isNaN(children) || children < 0) {
          await sendBot(client, userId, '❌ Invalid number');
          return;
        }
        state.booking.children = children;
        state.step = 'date';
        await sendBot(client, userId, '📅 Enter date (YYYY-MM-DD):');
        return;
      }

      if (state.step === 'date') {
        state.booking.date = text;
        const total = state.booking.adults * 100 + state.booking.children * 50;
        state.booking.total = total;
        state.step = 'payment';

        await sendBot(client, userId,
          `🧾 Booking Summary:\n\n👨 Adults: ${state.booking.adults}\n👶 Children: ${state.booking.children}\n📅 Date: ${state.booking.date}\n💰 Total: ₹${total}\n\nType *confirm* to generate your payment link or *cancel*`
        );
        return;
      }

      if (state.step === 'payment') {
        if (text === 'confirm') {
          const bookingId = 'BK' + Date.now();
          const total = state.booking.total;
          
          // 1. Create the booking as PENDING in database
          await Booking.create({
            userId,
            adults: state.booking.adults,
            children: state.booking.children,
            date: state.booking.date,
            bookingId,
            paymentStatus: 'pending'
          });
          
          // 2. Ask Backend to generate a Razorpay Link
          try {
            const response = await axios.post('http://localhost:5000/api/create-payment-link', {
              amount: total,
              reference_id: bookingId,
              contact: userId.replace('@c.us', '') // Get phone number
            });
            const paymentUrl = response.data.url;
            state.step = 'menu';
            state.booking = {};
            
            await sendBot(client, userId,
              `✅ Booking Reserved!\n🆔 ${bookingId}\n\n💳 *Please complete your payment to confirm your tickets:*\n${paymentUrl}`
            );
          } catch (err) {
             console.error(err);
             await sendBot(client, userId, "❌ Error generating payment link. Please try again.");
          }
          return;
        }
        
        if (text === 'cancel') {
          state.step = 'menu';
          state.booking = {};
          await sendBot(client, userId, '❌ Booking cancelled');
          return;
        }
      }
    } catch (err) {
      console.error('❌ ERROR:', err);
    }
  });
}).catch(err => {
  console.error('❌ INIT ERROR:', err);
});
