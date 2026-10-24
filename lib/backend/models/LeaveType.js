const mongoose = require('mongoose');
const s = new mongoose.Schema({ name: { type: String, required: true, trim: true }, code: { type: String, required: true, unique: true, trim: true }, annualQuota: { type: Number, default: 0 }, paid: { type: Boolean, default: true }, color: { type: String, default: '#3b82f6' } }, { timestamps: true });
module.exports = mongoose.model('LeaveType', s);
