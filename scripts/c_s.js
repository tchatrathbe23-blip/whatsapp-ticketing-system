const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// 🔥 AI function
async function chatWithAI(userMessage) {
  try {
    const result = await model.generateContent(userMessage);
    return result.response.text();
  } catch (error) {
    console.error('AI Error:', error);
    return "❌ AI error occurred.";
  }
}

// 🔥 Entry function (JUST SET MODE)
async function handleUserMessage(client, to, userState) {
  userState[to] = { step: 'ai_chat' };

  await client.sendText(
    to,
    "🤖 You are now connected with AI.\n\nType anything to chat.\nType 'exit' to stop."
  );
}

// 🔥 AI message handler (called from chatbot.js)
async function handleAIChat(client, message, userState) {
  const { from, body } = message;

  const text = (body || "").toLowerCase().trim();

  // exit condition
  if (text === 'exit') {
    userState[from] = { step: 'start' };

    await client.sendText(from, "👋 Exited AI mode. Type 'hi' to start again.");
    return;
  }

  try {
    await client.sendText(from, "⏳ Thinking...");

    const reply = await chatWithAI(body);

    await client.sendText(from, reply);

  } catch (err) {
    await client.sendText(from, "❌ AI failed.");
  }
}

module.exports = { handleUserMessage, handleAIChat };