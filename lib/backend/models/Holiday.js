const mongoose = require('mongoose');
const s = new mongoose.Schema({ name: { type: String, required: true, trim: true }, date: { type: Date, required: true }, recurring: { type: Boolean, default: false } }, { timestamps: true });
module.exports = mongoose.model('Holiday', s);
