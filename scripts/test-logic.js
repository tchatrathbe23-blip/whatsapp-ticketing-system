const { handleMessage } = require('./chatbot.logic');
const userState = {};
const mockClient = {
  sendText: async (to, text) => {
    console.log(`[Mock Client] Sent to ${to}: ${text}`);
    return true;
  }
};

const msg = {
  from: '919876543210@c.us',
  body: 'hello bot',
  fromMe: false,
  isGroupMsg: false,
  type: 'chat'
};

async function test() {
  console.log("Testing hello bot...");
  const res = await handleMessage(mockClient, msg, userState);
  console.log("Result:", res);
  console.log("State:", userState);
}

test();
