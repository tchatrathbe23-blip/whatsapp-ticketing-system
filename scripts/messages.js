/**
 * messages.js
 *
 * Centralized translation strings for the WhatsApp chatbot.
 * Supports English ('en') and Hindi ('hi').
 *
 * Usage:
 *   const { T, getUpcomingDates } = require('./messages');
 *   await sendBot(client, userId, T(state.lang, 'adultsPrompt'));
 *   await sendBot(client, userId, T(state.lang, 'summary', 2, 1, '2024-08-15', 250));
 */

const MESSAGES = {
  en: {
    // ── Language selection (shown before anything else) ──
    langSelect:
      '🌐 Welcome! Please choose your language:\n\n' +
      '1️⃣  English\n' +
      '2️⃣  हिंदी (Hindi)',

    invalidLang: '❌ Please reply with *1* for English or *2* for Hindi.',

    // ── Main menu ──
    welcome:
      '👋 Welcome to the Museum!\n\n' +
      '1️⃣  Book Ticket\n' +
      '2️⃣  Exhibitions & Events\n' +
      '3️⃣  Support (AI)\n\n' +
      '✏️  Type *lang* to Change Language',

    invalidMenu: '❌ Please reply *1*, *2*, or *3*.',

    // ── Booking flow ──
    adultsPrompt:  '👨 How many adults? (Enter 0 or more)\n\n✏️ Type *back* to go to the previous step.',
    invalidAdults: '❌ Please enter a valid whole number greater than 0.',

    childrenPrompt:  '👶 How many children? (Enter 0 if none)\n\n✏️ Type *back* to go to the previous step.',
    invalidChildren: '❌ Please enter a valid whole number (0 or more).',

    // datePrompt is a function — receives (d0, d1, d2) YYYY-MM-DD strings
    datePrompt: (d0, d1, d2) =>
      `📅 Choose your visit date:\n\n` +
      `1️⃣  Today        —  ${d0}\n` +
      `2️⃣  Tomorrow     —  ${d1}\n` +
      `3️⃣  Day After    —  ${d2}\n\n` +
      `✏️  Or type a custom date in format *YYYY-MM-DD*\n` +
      `✏️  Type *back* to go to the previous step.`,

    invalidDate:
      '❌ Invalid selection.\n' +
      'Pick *1*, *2*, *3* for quick dates,\n' +
      'or type a date like *2024-08-15*.',

    // summary is a function — receives (adults, children, date, total)
    summary: (adults, children, date, total) =>
      `🧾 *Booking Summary*\n\n` +
      `👨 Adults:    ${adults}\n` +
      `👶 Children:  ${children}\n` +
      `📅 Date:      ${date}\n` +
      `💰 Total:     ₹${total}\n\n` +
      `Type *confirm* to generate payment link\n` +
      `Type *cancel* to abort\n\n` +
      `✏️ Type *back* to go to the previous step.`,

    eventsMsg:
      '🎨 Exciting exhibitions & events are coming soon!\n' +
      'Visit our website for the latest schedule.',

    cancelMsg:
      '❌ Booking cancelled.\n\n' +
      'Type *hello bot* anytime to start again.',
  },

  hi: {
    // ── Language selection ──
    langSelect:
      '🌐 Welcome! Please choose your language:\n\n' +
      '1️⃣  English\n' +
      '2️⃣  हिंदी (Hindi)',

    invalidLang: '❌ कृपया *1* (English) या *2* (हिंदी) दर्ज करें।',

    // ── Main menu ──
    welcome:
      '👋 संग्रहालय में आपका स्वागत है!\n\n' +
      '1️⃣  टिकट बुक करें\n' +
      '2️⃣  प्रदर्शनियाँ और कार्यक्रम\n' +
      '3️⃣  सहायता (AI)\n\n' +
      '✏️  भाषा बदलने के लिए *lang* टाइप करें',

    invalidMenu: '❌ कृपया *1*, *2*, या *3* दर्ज करें।',

    // ── Booking flow ──
    adultsPrompt:  '👨 कितने वयस्क? (कोई नहीं हो तो 0 दर्ज करें)\n\n✏️ पीछे जाने के लिए *back* टाइप करें।',
    invalidAdults: '❌ कृपया एक वैध संख्या दर्ज करें (0 से अधिक)।',

    childrenPrompt:  '👶 कितने बच्चे? (कोई नहीं हो तो 0 दर्ज करें)\n\n✏️ पीछे जाने के लिए *back* टाइप करें।',
    invalidChildren: '❌ कृपया एक वैध संख्या दर्ज करें (0 या अधिक)।',

    datePrompt: (d0, d1, d2) =>
      `📅 यात्रा की तारीख चुनें:\n\n` +
      `1️⃣  आज           —  ${d0}\n` +
      `2️⃣  कल            —  ${d1}\n` +
      `3️⃣  परसों         —  ${d2}\n\n` +
      `✏️  या खुद तारीख लिखें: *YYYY-MM-DD* फ़ॉर्मेट में\n` +
      `✏️  पीछे जाने के लिए *back* टाइप करें।`,

    invalidDate:
      '❌ अमान्य चयन।\n' +
      'त्वरित तारीख के लिए *1*, *2*, *3* चुनें,\n' +
      'या *2024-08-15* जैसी तारीख लिखें।',

    summary: (adults, children, date, total) =>
      `🧾 *बुकिंग सारांश*\n\n` +
      `👨 वयस्क:     ${adults}\n` +
      `👶 बच्चे:     ${children}\n` +
      `📅 तारीख:    ${date}\n` +
      `💰 कुल:      ₹${total}\n\n` +
      `*confirm* टाइप करें — पेमेंट लिंक पाने के लिए\n` +
      `*cancel* टाइप करें  — रद्द करने के लिए\n\n` +
      `✏️ पीछे जाने के लिए *back* टाइप करें।`,

    eventsMsg:
      '🎨 रोमांचक प्रदर्शनियाँ और कार्यक्रम जल्द आ रहे हैं!\n' +
      'नवीनतम जानकारी के लिए हमारी वेबसाइट देखें।',

    cancelMsg:
      '❌ बुकिंग रद्द कर दी गई।\n\n' +
      'दोबारा शुरू करने के लिए *hello bot* लिखें।',
  }
};

/**
 * Translate a message key for the given language.
 * Falls back to English if the key is missing.
 * Supports function-type messages (passes remaining args to the function).
 *
 * @param {'en'|'hi'} lang
 * @param {string}    key
 * @param {...any}    args  - forwarded to function-type messages
 * @returns {string}
 */
function T(lang, key, ...args) {
  const bucket = MESSAGES[lang] || MESSAGES['en'];
  const val = bucket[key] !== undefined ? bucket[key] : MESSAGES['en'][key];
  if (val === undefined) {
    console.warn(`[messages] Missing key "${key}" for lang "${lang}"`);
    return '';
  }
  return typeof val === 'function' ? val(...args) : val;
}

/**
 * Return today + next 2 days as YYYY-MM-DD strings (local time).
 * @returns {[string, string, string]}
 */
function getUpcomingDates() {
  const pad = n => String(n).padStart(2, '0');
  const fmt = d =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = new Date();
  return [
    fmt(today),
    fmt(new Date(today.getTime() + 86_400_000)),
    fmt(new Date(today.getTime() + 2 * 86_400_000))
  ];
}

module.exports = { T, MESSAGES, getUpcomingDates };
