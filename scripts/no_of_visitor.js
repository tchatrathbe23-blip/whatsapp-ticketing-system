const Booking = require('../models/Booking');

// STEP 1: START FLOW
const handleVisitorSelection = async (client, to, userState) => {
  userState[to] = { step: 'awaiting_adults' };

  await client.sendText(to, '👨 How many adults will be visiting?');
};

// STEP 2: HANDLE FLOW
const handleVisitorFlow = async (client, message, userState) => {
  const { from, body } = message;
  const text = (body || "").trim();

  const state = userState[from];
  if (!state) return;

  // =============================
  // STEP 1: ADULTS
  // =============================
  if (state.step === 'awaiting_adults') {
    const adults = parseInt(text, 10);

    if (!isNaN(adults) && adults > 0) {
      userState[from] = { step: 'awaiting_children', adults };

      await client.sendText(
        from,
        `✅ ${adults} adult(s) selected.\n👶 How many children?`
      );
    } else {
      await client.sendText(from, '❌ Enter valid number of adults.');
    }
  }

  // =============================
  // STEP 2: CHILDREN + SAVE DB 🔥
  // =============================
  else if (state.step === 'awaiting_children') {
    const children = parseInt(text, 10);

    if (!isNaN(children) && children >= 0) {
      const adults = state.adults;

      try {
        // 🔥 SAVE TO DATABASE
        await Booking.create({
          userId: from,
          adults,
          children,
          date: new Date().toISOString().split('T')[0]
        });

        await client.sendText(
          from,
          `🎟️ Booking Confirmed!\n\n👨 Adults: ${adults}\n👶 Children: ${children}\n📅 Date: ${new Date().toISOString().split('T')[0]}`
        );

      } catch (err) {
        console.error("❌ DB Error:", err);
        await client.sendText(from, '❌ Booking failed. Try again.');
      }

      // 🔁 RESET STATE
      userState[from] = { step: 'start' };
    } else {
      await client.sendText(from, '❌ Enter valid number of children.');
    }
  }
};

module.exports = { handleVisitorSelection, handleVisitorFlow };