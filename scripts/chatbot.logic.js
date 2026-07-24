/**
 * chatbot.logic.js
 *
 * Pure business-logic layer for the WhatsApp chatbot state machine.
 * No wppconnect dependency — fully unit-testable with a mock client.
 *
 * The `onConfirm` option allows the payment/DB layer to be injected
 * so production uses the real Razorpay+MongoDB code while tests
 * use a lightweight stub.
 *
 * v2 changes:
 *  - Multilingual support (English + Hindi) via messages.js
 *  - Language selection step before the main menu
 *  - Date step now offers quick-select (Today / Tomorrow / Day After)
 *    in addition to manual YYYY-MM-DD entry — closest WhatsApp equivalent
 *    to a calendar picker
 *
 * @param {object}   client     - wppconnect client (or mock in tests)
 * @param {object}   message    - { from, body, isGroupMsg }
 * @param {object}   userState  - shared in-memory session store
 * @param {object}   [options]
 * @param {Function} [options.onConfirm] - async (client, userId, state, sendBot) => void
 * @returns {Promise<string>} Key describing what action was taken.
 */

const { handleUserMessage, handleAIChat, getUpcomingEvents } = require('./c_s');
const { T, getUpcomingDates } = require('./messages');

// ─── Loop-prevention store ────────────────────────────────────────────────────
const lastBotMessages = new Map();

function normalize(text) {
  return text.toLowerCase().trim();
}

/**
 * Track a message that WE sent so we can ignore the echo from wppconnect.
 */
function rememberBot(userId, text) {
  const key = userId + '|' + normalize(text);
  lastBotMessages.set(key, Date.now());
}

/**
 * Send a message via the client and mark it as bot-sent for loop prevention.
 */
async function sendBot(client, userId, text) {
  rememberBot(userId, text);
  return await client.sendText(userId, text);
}

// ─── State machine ────────────────────────────────────────────────────────────

// Record the time the bot started so we ignore historical synced messages
const BOT_START_TIME = Math.floor(Date.now() / 1000);

async function handleMessage(client, message, userState, options = {}) {
  const { onConfirm } = options;

  // ── Guard clauses ──────────────────────────────────────────────────────────
  
  // 1. Ignore historical messages synced during startup
  const msgTime = message.timestamp || message.t || 0;
  if (msgTime > 0 && msgTime < BOT_START_TIME) {
    return 'HISTORICAL_MESSAGE_IGNORED';
  }

  // 2. Loop prevention: Ignore automated messages just sent by the bot itself
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

  // Create a new session if needed (default language: English)
  if (!userState[userId]) {
    userState[userId] = { step: 'start', lang: 'en', booking: {} };
  }
  const state = userState[userId];

  // ── Global Back Navigation ──────────────────────────────────────────────────
  if (text === 'back') {
    if (state.step === 'adults') {
      state.step = 'menu';
      await sendBot(client, userId, T(state.lang, 'welcome'));
      return 'WENT_BACK_TO_MENU';
    }
    // Note: '0' is valid for children, so only 'back' works here
    if (state.step === 'children' && text === 'back') {
      state.step = 'adults';
      await sendBot(client, userId, T(state.lang, 'adultsPrompt'));
      return 'WENT_BACK_TO_ADULTS';
    }
    if (state.step === 'date') {
      state.step = 'children';
      await sendBot(client, userId, T(state.lang, 'childrenPrompt'));
      return 'WENT_BACK_TO_CHILDREN';
    }
    if (state.step === 'payment') {
      state.step = 'date';
      const [d0, d1, d2] = getUpcomingDates();
      await sendBot(client, userId, T(state.lang, 'datePrompt', d0, d1, d2));
      return 'WENT_BACK_TO_DATE';
    }
  }

  // ── Delegate to AI support handler ────────────────────────────────────────
  if (state.step === 'ai_chat') {
    await handleAIChat(client, message, userState, sendBot);
    return 'AI_CHAT';
  }

  // ── Greeting → language selection ─────────────────────────────────────────
  //    langSelect message is always English (before the user has chosen)
  if (text.startsWith('hello bot')) {
    state.step = 'lang_select';
    state.lang = 'en';
    state.booking = {};
    await sendBot(client, userId, T('en', 'langSelect'));
    return 'LANG_SELECT_SHOWN';
  }

  // ── Language selection ─────────────────────────────────────────────────────
  if (state.step === 'lang_select') {
    if (text === '1') {
      state.lang = 'en';
    } else if (text === '2') {
      state.lang = 'hi';
    } else {
      await sendBot(client, userId, T(state.lang, 'invalidLang'));
      return 'INVALID_LANG';
    }
    state.step = 'menu';
    await sendBot(client, userId, T(state.lang, 'welcome'));
    return 'MENU_SHOWN';
  }

  // ── Language Toggle from Menu ──────────────────────────────────────────────
  if (state.step === 'menu' && text === 'lang') {
    state.step = 'lang_select';
    await sendBot(client, userId, T('en', 'langSelect'));
    return 'WENT_BACK_TO_LANG';
  }

  // ── Main menu selection ────────────────────────────────────────────────────
  if (state.step === 'menu') {
    if (text === '1') {
      state.step = 'adults';
      await sendBot(client, userId, T(state.lang, 'adultsPrompt'));
      return 'BOOKING_START';
    }
    if (text === '2') {
      // Show a loading message, then fetch live events from AI
      await sendBot(client, userId, '⏳ Fetching upcoming events...');
      const events = await getUpcomingEvents();
      if (events) {
        await sendBot(
          client,
          userId,
          `🎪 *Upcoming Exhibitions & Events*\n\n${events}\n\n📲 To book tickets, type *1* from the main menu.`
        );
      } else {
        await sendBot(client, userId, T(state.lang, 'eventsMsg'));
      }
      return 'EVENTS_SHOWN';
    }
    if (text === '3') {
      await handleUserMessage(client, userId, userState, sendBot);
      return 'AI_SUPPORT_STARTED';
    }
    await sendBot(client, userId, T(state.lang, 'invalidMenu'));
    return 'INVALID_MENU';
  }

  // ── Booking: adults ────────────────────────────────────────────────────────
  if (state.step === 'adults') {
    const adults = parseInt(text, 10);
    if (isNaN(adults) || adults < 0) {
      await sendBot(client, userId, T(state.lang, 'invalidAdults'));
      return 'INVALID_ADULTS';
    }
    state.booking.adults = adults;
    state.step = 'children';
    await sendBot(client, userId, T(state.lang, 'childrenPrompt'));
    return 'ADULTS_SET';
  }

  // ── Booking: children ─────────────────────────────────────────────────────
  if (state.step === 'children') {
    const children = parseInt(text, 10);
    if (isNaN(children) || children < 0) {
      await sendBot(client, userId, T(state.lang, 'invalidChildren'));
      return 'INVALID_CHILDREN';
    }
    
    // Ensure they didn't select 0 adults AND 0 children
    if (state.booking.adults === 0 && children === 0) {
      const msg = state.lang === 'hi' 
        ? "⚠️ कृपया कम से कम 1 व्यक्ति का चयन करें। आइए फिर से कोशिश करते हैं।\n\n" 
        : "⚠️ You must select at least 1 person. Let's try again.\n\n";
      await sendBot(client, userId, msg + T(state.lang, 'adultsPrompt'));
      state.step = 'adults';
      return 'ZERO_PERSONS_ERROR';
    }

    state.booking.children = children;
    state.step = 'date';

    // Send the calendar-style quick-select message
    const [d0, d1, d2] = getUpcomingDates();
    await sendBot(client, userId, T(state.lang, 'datePrompt', d0, d1, d2));
    return 'CHILDREN_SET';
  }

  // ── Booking: date (quick-select 1/2/3 or typed YYYY-MM-DD) ───────────────
  //
  //  WhatsApp has no native calendar widget, so we offer:
  //    1 = Today
  //    2 = Tomorrow
  //    3 = Day After Tomorrow
  //    or a manually typed YYYY-MM-DD date
  //
  if (state.step === 'date') {
    const [d0, d1, d2] = getUpcomingDates();
    let chosenDate = null;

    if (text === '1') {
      chosenDate = d0;
    } else if (text === '2') {
      chosenDate = d1;
    } else if (text === '3') {
      chosenDate = d2;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      // Basic sanity: ensure it's a real date
      const parsed = new Date(text);
      if (!isNaN(parsed.getTime())) {
        chosenDate = text;
      }
    }

    if (!chosenDate) {
      await sendBot(client, userId, T(state.lang, 'invalidDate'));
      return 'INVALID_DATE';
    }

    state.booking.date = chosenDate;
    const total = state.booking.adults * 100 + state.booking.children * 50;
    state.booking.total = total;
    state.step = 'payment';

    await sendBot(
      client,
      userId,
      T(state.lang, 'summary', state.booking.adults, state.booking.children, chosenDate, total)
    );
    return 'DATE_SET';
  }

  // ── Booking: payment confirmation ─────────────────────────────────────────
  if (state.step === 'payment') {
    if (text === 'confirm') {
      if (typeof onConfirm === 'function') {
        // Production: calls the real DB + Razorpay handler injected by chatbot.js
        await onConfirm(client, userId, state, sendBot);
      }
      // Return this key whether or not onConfirm was provided (tests use it)
      return 'PAYMENT_CONFIRMED';
    }

    if (text === 'cancel') {
      state.step = 'menu';
      state.booking = {};
      await sendBot(client, userId, T(state.lang, 'cancelMsg'));
      return 'BOOKING_CANCELLED';
    }
  }

  return 'UNHANDLED';
}

module.exports = { handleMessage, sendBot, rememberBot, lastBotMessages };
