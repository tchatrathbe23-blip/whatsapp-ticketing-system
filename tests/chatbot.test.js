/**
 * chatbot.test.js
 *
 * Unit tests for the WhatsApp chatbot logic.
 *
 * Strategy: We test chatbot.logic.js — the pure state-machine layer —
 * using a mock client that records every message sent.
 * No wppconnect, no browser, no DB required for these tests.
 *
 * Run:  npm run test:chatbot
 *   or: npm test  (runs both suites via glob)
 */

process.env.NODE_ENV = 'test';
process.env.GOOGLE_API_KEY = 'test-dummy-key'; // prevent c_s.js from failing on import

const test = require('node:test');
const assert = require('node:assert/strict');

// ── Mock the Gemini AI so handleAIChat doesn't hit the network ────────────────
const Module = require('module');

// Patch @google/generative-ai before chatbot.logic.js loads c_s.js
const mockGenerateContent = async (msg) => ({
  response: { text: () => `AI echo: ${msg}` }
});
require.cache[require.resolve('@google/generative-ai')] = {
  id: require.resolve('@google/generative-ai'),
  filename: require.resolve('@google/generative-ai'),
  loaded: true,
  exports: {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return { generateContent: mockGenerateContent };
      }
    }
  }
};

// Now it's safe to import the logic module
const { handleMessage, lastBotMessages } = require('../scripts/chatbot.logic');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a lightweight mock WhatsApp client.
 * Records every outbound message so tests can assert on them.
 */
function makeMockClient() {
  const sent = [];
  return {
    sent,
    sendText: async (to, text) => {
      sent.push({ to, text });
    }
  };
}

/**
 * Build a minimal incoming message object.
 */
function makeMsg(from, body, { isGroupMsg = false } = {}) {
  return { from, body, isGroupMsg };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test('Chatbot Logic Unit Tests', async (t) => {

  // ── 1. QR / Boot context: state machine initialises correctly ──────────────
  await t.test('Fresh session: ignores unknown user without greeting', async () => {
    const client = makeMockClient();
    const userState = {};

    const result = await handleMessage(client, makeMsg('911234567890@c.us', 'hi there'), userState);

    assert.equal(result, 'UNKNOWN_USER', 'Should reject unknown user');
    assert.equal(client.sent.length, 0, 'No message should be sent');
    assert.deepEqual(userState, {}, 'State should remain empty');
  });

  // ── 2. Greeting → menu shown ───────────────────────────────────────────────
  await t.test('Greeting "hello bot" initiates session and shows menu', async () => {
    const client = makeMockClient();
    const userState = {};

    const result = await handleMessage(client, makeMsg('911111111111@c.us', 'hello bot'), userState);

    assert.equal(result, 'MENU_SHOWN');
    assert.equal(client.sent.length, 1, 'Exactly one message sent');
    assert.ok(client.sent[0].text.includes('1️⃣ Book Ticket'), 'Menu contains Book Ticket option');
    assert.ok(client.sent[0].text.includes('3️⃣ Support'), 'Menu contains Support option');
    assert.equal(userState['911111111111@c.us'].step, 'menu', 'State should advance to menu');
  });

  // ── 3. Group messages are ignored ─────────────────────────────────────────
  await t.test('Group messages are silently ignored', async () => {
    const client = makeMockClient();
    const userState = {};

    const result = await handleMessage(
      client,
      makeMsg('919999999999-1234567890@g.us', 'hello bot', { isGroupMsg: true }),
      userState
    );

    assert.equal(result, 'GROUP_MSG');
    assert.equal(client.sent.length, 0);
  });

  // ── 4. Loop prevention ─────────────────────────────────────────────────────
  await t.test('Loop prevention: ignores messages that the bot itself just sent', async () => {
    const client = makeMockClient();
    const userState = {};
    const userId = '912222222222@c.us';

    // Simulate bot having sent a message to this user
    const echoBody = '👋 Welcome!\n\n1️⃣ Book Ticket\n2️⃣ Events\n3️⃣ Support';
    lastBotMessages.set(userId + '|' + echoBody.toLowerCase().trim(), Date.now());

    const result = await handleMessage(client, makeMsg(userId, echoBody), userState);

    assert.equal(result, 'LOOP_PREVENTED', 'Should detect loop');
    assert.equal(client.sent.length, 0, 'Must not send any message back');
  });

  // ── 5. Full booking flow ───────────────────────────────────────────────────
  await t.test('Full booking flow: adults → children → date → summary', async () => {
    const client = makeMockClient();
    const userState = {};
    const userId = '913333333333@c.us';

    // Greet
    await handleMessage(client, makeMsg(userId, 'hello bot'), userState);
    // Select booking
    let result = await handleMessage(client, makeMsg(userId, '1'), userState);
    assert.equal(result, 'BOOKING_START');
    assert.equal(userState[userId].step, 'adults');

    // Enter adults
    result = await handleMessage(client, makeMsg(userId, '2'), userState);
    assert.equal(result, 'ADULTS_SET');
    assert.equal(userState[userId].booking.adults, 2);
    assert.equal(userState[userId].step, 'children');

    // Enter children
    result = await handleMessage(client, makeMsg(userId, '1'), userState);
    assert.equal(result, 'CHILDREN_SET');
    assert.equal(userState[userId].booking.children, 1);
    assert.equal(userState[userId].step, 'date');

    // Enter date
    result = await handleMessage(client, makeMsg(userId, '2025-12-25'), userState);
    assert.equal(result, 'DATE_SET');
    // Total = (2 adults × ₹100) + (1 child × ₹50) = ₹250
    assert.equal(userState[userId].booking.total, 250);
    assert.equal(userState[userId].step, 'payment');

    // Verify the summary message contains all key details
    const summaryMsg = client.sent.at(-1).text;
    assert.ok(summaryMsg.includes('Adults: 2'), 'Summary shows adults');
    assert.ok(summaryMsg.includes('Children: 1'), 'Summary shows children');
    assert.ok(summaryMsg.includes('₹250'), 'Summary shows correct total');
  });

  // ── 6. Adults validation ───────────────────────────────────────────────────
  await t.test('Booking: rejects non-numeric adult count', async () => {
    const client = makeMockClient();
    const userState = { '914444444444@c.us': { step: 'adults', booking: {} } };

    const result = await handleMessage(client, makeMsg('914444444444@c.us', 'abc'), userState);

    assert.equal(result, 'INVALID_ADULTS');
    assert.ok(client.sent[0].text.includes('❌'), 'Error message shown');
    assert.equal(userState['914444444444@c.us'].step, 'adults', 'Step should NOT advance');
  });

  // ── 7. Cancel booking ─────────────────────────────────────────────────────
  await t.test('Booking: cancel resets state to menu', async () => {
    const client = makeMockClient();
    const userId = '915555555555@c.us';
    const userState = {
      [userId]: { step: 'payment', booking: { adults: 2, children: 0, date: '2025-01-01', total: 200 } }
    };

    const result = await handleMessage(client, makeMsg(userId, 'cancel'), userState);

    assert.equal(result, 'BOOKING_CANCELLED');
    assert.equal(userState[userId].step, 'menu', 'State resets to menu');
    assert.deepEqual(userState[userId].booking, {}, 'Booking data cleared');
  });

  // ── 8. Events option ──────────────────────────────────────────────────────
  await t.test('Menu option 2 shows events message', async () => {
    const client = makeMockClient();
    const userId = '916666666666@c.us';
    const userState = { [userId]: { step: 'menu', booking: {} } };

    const result = await handleMessage(client, makeMsg(userId, '2'), userState);

    assert.equal(result, 'EVENTS_SHOWN');
    assert.ok(client.sent[0].text.includes('Events'), 'Events message shown');
  });

  // ── 9. AI Support mode activated ──────────────────────────────────────────
  await t.test('Menu option 3 activates AI support mode', async () => {
    const client = makeMockClient();
    const userId = '917777777777@c.us';
    const userState = { [userId]: { step: 'menu', booking: {} } };

    const result = await handleMessage(client, makeMsg(userId, '3'), userState);

    assert.equal(result, 'AI_SUPPORT_STARTED');
    assert.equal(userState[userId].step, 'ai_chat', 'State advances to ai_chat');
    assert.ok(client.sent[0].text.includes('AI'), 'AI greeting sent');
  });

  // ── 10. AI mode exit ──────────────────────────────────────────────────────
  await t.test('Typing "exit" in AI mode returns user to menu', async () => {
    const client = makeMockClient();
    const userId = '918888888888@c.us';
    const userState = { [userId]: { step: 'ai_chat', booking: {} } };

    // Delegate to handleAIChat → exit branch
    await handleMessage(client, makeMsg(userId, 'exit'), userState);

    assert.equal(userState[userId].step, 'menu', 'State resets to menu');
    assert.ok(client.sent[0].text.includes('Exited'), 'Exit confirmation sent');
  });

  // ── 11. Ticket price calculation ──────────────────────────────────────────
  await t.test('Ticket price: adults=3, children=2 → ₹400', async () => {
    const client = makeMockClient();
    const userId = '919000000001@c.us';
    const userState = {};

    // Run through the flow to the date step
    await handleMessage(client, makeMsg(userId, 'hello bot'), userState);
    await handleMessage(client, makeMsg(userId, '1'), userState);
    await handleMessage(client, makeMsg(userId, '3'), userState);  // 3 adults
    await handleMessage(client, makeMsg(userId, '2'), userState);  // 2 children
    await handleMessage(client, makeMsg(userId, '2025-06-15'), userState);

    // (3 × 100) + (2 × 50) = 400
    assert.equal(userState[userId].booking.total, 400);
  });

  // ── 12. status@broadcast is silently ignored ──────────────────────────────
  await t.test('status@broadcast messages are ignored', async () => {
    const client = makeMockClient();
    const userState = {};

    const result = await handleMessage(
      client,
      makeMsg('status@broadcast', 'some status update'),
      userState
    );

    assert.equal(result, 'STATUS_BROADCAST');
    assert.equal(client.sent.length, 0);
  });
});
