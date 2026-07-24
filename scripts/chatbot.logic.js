/**
 * chatbot.logic.js
 *
 * Pure business-logic layer for the WhatsApp chatbot.
 * No wppconnect, no DB imports — only state-machine rules.
 * This separation makes the chatbot fully unit-testable.
 */

const { handleUserMessage, handleAIChat } = require('./c_s');

// ─── Loop-prevention store ────────────────────────────────────────────────────
const lastBotMessages = new Map();

function normalize(text) {
  return text.toLowerCase().trim();
}

/**
 * Track a message that WE sent so we can ignore the echo if wppconnect
 * delivers it back via onAnyMessage.
 */
function rememberBot(userId, text) {
  const key = userId + '|' + normalize(text);
  lastBotMessages.set(key, Date.now());
}

/**
 * Send a message via the client and mark it as "bot-sent" for loop prevention.
 * @param {object} client  - wppconnect client (or a mock in tests)
 * @param {string} userId
 * @param {string} text
 */
async function sendBot(client, userId, text) {
  rememberBot(userId, text);
  return await client.sendText(userId, text);
}

// ─── State machine ────────────────────────────────────────────────────────────

/**
 * Process one incoming WhatsApp message through the booking state machine.
 *
 * @param {object} client     - wppconnect client (or mock)
 * @param {object} message    - { from, body, isGroupMsg }
 * @param {object} userState  - shared in-memory session store
 * @returns {Promise<string|null>} The key describing what action was taken,
 *                                 useful for assertions in tests.
 */
async function handleMessage(client, message, userState) {
  // ── Guard clauses ──────────────────────────────────────────────────────────
  const key = message.from + '|' + (message.body || '').toLowerCase().trim();
  if (lastBotMessages.has(key)) {
    lastBotMessages.delete(key);
    return 'LOOP_PREVENTED';
  }
  if (!message.body) return 'NO_BODY';
  if (message.isGroupMsg) return 'GROUP_MSG';
  if (message.from === 'status@broadcast') return 'STATUS_BROADCAST';

  const userId = message.from;
  const text = message.body.toLowerCase().trim();

  // Only respond to known users OR users saying the magic greeting
  if (!userState[userId] && !text.startsWith('hello bot')) {
    return 'UNKNOWN_USER';
  }

  // Create a new session if needed
  if (!userState[userId]) {
    userState[userId] = { step: 'start', booking: {} };
  }
  const state = userState[userId];

  // ── Delegate to AI support handler ─────────────────────────────────────────
  if (state.step === 'ai_chat') {
    await handleAIChat(client, message, userState, sendBot);
    return 'AI_CHAT';
  }

  // ── Greeting → show main menu ───────────────────────────────────────────────
  if (text.startsWith('hello bot')) {
    state.step = 'menu';
    await sendBot(client, userId, '👋 Welcome!\n\n1️⃣ Book Ticket\n2️⃣ Events\n3️⃣ Support');
    return 'MENU_SHOWN';
  }

  // ── Main menu selection ─────────────────────────────────────────────────────
  if (state.step === 'menu') {
    if (text === '1') {
      state.step = 'adults';
      await sendBot(client, userId, '👨 Enter number of adults:');
      return 'BOOKING_START';
    }
    if (text === '2') {
      await sendBot(client, userId, '🎨 Events coming soon!');
      return 'EVENTS_SHOWN';
    }
    if (text === '3') {
      await handleUserMessage(client, userId, userState, sendBot);
      return 'AI_SUPPORT_STARTED';
    }
    return 'INVALID_MENU';
  }

  // ── Booking: adults ─────────────────────────────────────────────────────────
  if (state.step === 'adults') {
    const adults = parseInt(text, 10);
    if (isNaN(adults) || adults <= 0) {
      await sendBot(client, userId, '❌ Please enter a valid number (example: 2)');
      return 'INVALID_ADULTS';
    }
    state.booking.adults = adults;
    state.step = 'children';
    await sendBot(client, userId, '👶 Enter number of children (or 0):');
    return 'ADULTS_SET';
  }

  // ── Booking: children ──────────────────────────────────────────────────────
  if (state.step === 'children') {
    const children = parseInt(text, 10);
    if (isNaN(children) || children < 0) {
      await sendBot(client, userId, '❌ Invalid number');
      return 'INVALID_CHILDREN';
    }
    state.booking.children = children;
    state.step = 'date';
    await sendBot(client, userId, '📅 Enter date (YYYY-MM-DD):');
    return 'CHILDREN_SET';
  }

  // ── Booking: date ──────────────────────────────────────────────────────────
  if (state.step === 'date') {
    state.booking.date = text;
    const total = state.booking.adults * 100 + state.booking.children * 50;
    state.booking.total = total;
    state.step = 'payment';
    await sendBot(
      client,
      userId,
      `🧾 Booking Summary:\n\n👨 Adults: ${state.booking.adults}\n👶 Children: ${state.booking.children}\n📅 Date: ${state.booking.date}\n💰 Total: ₹${total}\n\nType *confirm* to generate your payment link or *cancel*`
    );
    return 'DATE_SET';
  }

  // ── Booking: payment confirmation ──────────────────────────────────────────
  if (state.step === 'payment') {
    if (text === 'confirm') {
      // In tests the payment API call is mocked; in production chatbot.js
      // overlays this with the real Razorpay call.
      return 'PAYMENT_CONFIRMED';
    }
    if (text === 'cancel') {
      state.step = 'menu';
      state.booking = {};
      await sendBot(client, userId, '❌ Booking cancelled');
      return 'BOOKING_CANCELLED';
    }
  }

  return 'UNHANDLED';
}

module.exports = { handleMessage, sendBot, rememberBot, lastBotMessages };
