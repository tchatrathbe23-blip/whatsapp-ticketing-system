require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function run() {
  try {
    const result = await model.generateContent("hello");
    console.log(result.response.text());
  } catch (err) {
    console.error("Error:", err.status, err.statusText, err.message);
  }
}
run();
