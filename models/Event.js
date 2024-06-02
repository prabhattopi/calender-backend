// models/Event.js
const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  title: String,
  description: String,
  participants: [String],
  date: Date,
  time: String,
  duration: Number,
  sessionNotes: String,
  googleEventId: String,
});

module.exports = mongoose.model('Event', EventSchema);
