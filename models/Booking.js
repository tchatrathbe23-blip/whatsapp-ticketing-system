const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: String,
  adults: Number,
  children: Number,
  date: String,
  bookingId: String,
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid'],
    default: 'pending'     // Defaults to pending until Webhook says otherwise
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Booking', bookingSchema);
