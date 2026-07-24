const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

// ─── Museum context injected into every AI reply ──────────────────────────────
const MUSEUM_SYSTEM_PROMPT = `You are a helpful WhatsApp assistant for the City Museum.
Only answer questions related to THIS museum. Key facts:
- Name: City Museum
- Timings: Tuesday-Sunday, 10:00 AM - 6:00 PM (closed on Mondays)
- Location: Museum Road, City Centre
- Entry Fee: Adults Rs.100, Children (under 12) Rs.50, Infants (under 3) FREE
- Facilities: Cafeteria, Souvenir Shop, Wheelchair Access, Free Parking
- Contact: +91-XXXXXXXXXX | info@citymuseum.in
- Booking: Tickets can be booked directly via WhatsApp. Type 'hello bot' to start.
- Photography: Allowed in most areas; restricted in special exhibition halls.
- Groups of 10+: Get 15% group discount - contact us directly.

If asked something unrelated to the museum or booking, politely say you can only help with museum-related queries.
Keep replies concise and friendly. Use simple language. Do NOT use markdown symbols like ** or ##.`;

// 🔥 AI function — simple string format, compatible with all SDK versions
async function chatWithAI(userMessage) {
  try {
    const fullPrompt = `${MUSEUM_SYSTEM_PROMPT}\n\nVisitor: ${userMessage}\n\nAssistant:`;
    const result = await model.generateContent(fullPrompt);
    return result.response.text();
  } catch (error) {
    console.error('AI Error:', error);
    return '❌ AI error occurred.';
  }
}

// 🔥 Fetch upcoming events using Gemini
async function getUpcomingEvents() {
  try {
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const prompt = `You are the City Museum event coordinator. Today is ${today}.
List 4 upcoming museum exhibitions or events in the next 2 months.
Use this exact plain text format for each (no bullet points, no markdown):

[Emoji] [Event Name]
Date: [Date or Date Range]
Time: [Timing]
Hall: [Hall Name]
Entry: [Free or Included in ticket or Extra charge]

Put a blank line between each event. Be specific with realistic dates.`;

    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    console.error('Events AI Error:', error);
    return null;
  }
}

// 🔥 Entry function (JUST SET MODE)
async function handleUserMessage(client, to, userState, sendBot) {
  userState[to].step = 'ai_chat';
  const send = sendBot || (async (c, t, msg) => await c.sendText(t, msg));

  await send(
    client,
    to,
    "🤖 City Museum AI Assistant\n\nAsk me anything about the museum — timings, tickets, facilities, rules, or anything else!\n\nType 'exit' to go back to the main menu."
  );
}

// 🔥 AI message handler (called from chatbot.js)
async function handleAIChat(client, message, userState, sendBot) {
  const { from, body } = message;
  const text = (body || "").toLowerCase().trim();
  const send = sendBot || (async (c, t, msg) => await c.sendText(t, msg));

  // exit condition
  if (text === 'exit') {
    userState[from].step = 'menu';

    await send(
      client,
      from,
      "👋 Exited AI mode.\n\n1️⃣ Book Ticket\n2️⃣ Events\n3️⃣ Support"
    );
    return;
  }

  try {
    await send(client, from, "⏳ Thinking...");

    const reply = await chatWithAI(body);

    const exitInstruction = "\n\n*(Type 'exit' to go back)*";
    await send(client, from, reply + exitInstruction);

  } catch (err) {
    await send(client, from, "❌ AI failed.");
  }
}

module.exports = { handleUserMessage, handleAIChat, getUpcomingEvents };