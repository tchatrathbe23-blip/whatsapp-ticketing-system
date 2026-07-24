require('dotenv').config();
const wppconnect = require('@wppconnect-team/wppconnect');
const connectDB = require('../config/db');
const { handleMessage } = require('./chatbot.logic');

connectDB(); // ✅ Connect DB first

const userState = {};

wppconnect.create({
  session: 'mySessionName',
  autoClose: 0,
  puppeteerOptions: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  },
}).then(client => {
  console.log('✅ WhatsApp BOT STARTED successfully');

  client.onAnyMessage(async (message) => {
    try {
      await handleMessage(client, message, userState);
    } catch (err) {
      console.error('❌ ERROR:', err);
    }
  });
}).catch(err => {
  console.error('❌ INIT ERROR:', err);
});
