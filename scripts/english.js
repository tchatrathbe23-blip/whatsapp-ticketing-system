const { handleVisitorSelection } = require('./no_of_visitor');
const { handleUserMessage } = require('./c_s');

const sendEnglishResponse = async (client, to) => {
  await client.sendText(
    to,
    `🎟️ Welcome to the Museum!

Please choose:
1️⃣ Book Ticket
2️⃣ Exhibitions & Events
3️⃣ Customer Support`
  );
};

const handleEnglishOptions = async (client, to, selectedOption) => {
  try {

    // 🔥 normalize input
    const option = selectedOption.toLowerCase().trim();

    switch (option) {

      case '1':
      case 'book_ticket':
        console.log('Handling book_ticket');
        await handleVisitorSelection(client, to);
        break;

      case '2':
      case 'exhibitions_events':
        console.log('Handling exhibitions');
        await client.sendText(
          to,
          '🎨 Exhibitions & Events:\nCheck our latest events on website!'
        );
        break;

      case '3':
      case 'customer_support':
        console.log('Handling support');
        await handleUserMessage(client, to);
        break;

      default:
        await client.sendText(
          to,
          '❌ Invalid option.\nPlease type 1, 2 or 3.'
        );
    }

  } catch (error) {
    console.error('Error handling English option:', error);
    await client.sendText(to, 'Something went wrong.');
  }
};

module.exports = { sendEnglishResponse, handleEnglishOptions };