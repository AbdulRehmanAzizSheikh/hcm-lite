const mongoose = require('mongoose');
const s = new mongoose.Schema({
  companyName: { type: String, default: '' },
  officeStart: { type: String, default: '09:00' },       // HH:mm
  graceMinutes: { type: Number, default: 15 },
  halfDayHours: { type: Number, default: 5 },
  weekendDays: { type: [Number], default: [0, 6] },     // 0 Sun .. 6 Sat
  officeLocation: { lat: { type: Number, default: null }, lng: { type: Number, default: null }, radius: { type: Number, default: 150 } },
  setupComplete: { type: Boolean, default: false },
}, { timestamps: true });
module.exports = mongoose.model('Settings', s);
