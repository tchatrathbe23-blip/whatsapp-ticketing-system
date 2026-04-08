const express = require('express');
const router = express.Router();

const Booking = require('../models/Booking');
const auth = require('./middleware/auth');

// 🔐 PROTECTED ROUTE
router.get('/all', auth, async (req, res) => {
  try {
    const { date } = req.query;

    let filter = {};

    if (date) {
      // date from type="date" input comes as YYYY-MM-DD (e.g., "2024-04-08")
      const [year, month, day] = date.split('-');
      const d = parseInt(day, 10);   // remove leading zero
      const m = parseInt(month, 10); // remove leading zero

      // Build a regex that matches common date formats:
      // "2024-04-08", "08-04-2024", "08/04/2024", "04/08/2024",
      // "8/4/2024", "8-4-2024", "2024/04/08", "April 8, 2024", etc.
      filter.date = {
        $regex: new RegExp(
          // YYYY-MM-DD or YYYY/MM/DD (with or without leading zeros)
          `^${year}[-/]0?${m}[-/]0?${d}$` +
          '|' +
          // DD-MM-YYYY or DD/MM/YYYY (with or without leading zeros)
          `^0?${d}[-/]0?${m}[-/]${year}$` +
          '|' +
          // MM-DD-YYYY or MM/DD/YYYY (with or without leading zeros)
          `^0?${m}[-/]0?${d}[-/]${year}$` +
          '|' +
          // DD-MM-YY or DD/MM/YY
          `^0?${d}[-/]0?${m}[-/]${year.slice(2)}$`
        )
      };
    }

    const data = await Booking.find(filter).sort({ createdAt: -1 });

    res.json(data);

  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).send("Server error");
  }
});

module.exports = router;
