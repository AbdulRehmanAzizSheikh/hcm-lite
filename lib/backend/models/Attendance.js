const mongoose = require('mongoose');
const s = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  checkIn: { type: Date },
  checkOut: { type: Date },
  status: { type: String, enum: ['present', 'late', 'half_day', 'absent', 'missing_checkout', 'on_leave'], default: 'present' },
  source: { type: String, enum: ['web', 'camera'], default: 'web' },
  location: { lat: Number, lng: Number, accuracy: Number },
  lateMinutes: { type: Number, default: 0 },
  workMinutes: { type: Number, default: 0 },
  correction: {
    requested: { type: Boolean, default: false },
    reason: { type: String, default: '' },
    requestedAt: { type: Date },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    comment: { type: String, default: '' },
  },
}, { timestamps: true });
s.index({ employeeId: 1, date: 1 }, { unique: true });
module.exports = mongoose.model('Attendance', s);
