const mongoose = require('mongoose');
const s = new mongoose.Schema({ name: { type: String, required: true, unique: true, trim: true }, code: { type: String, trim: true }, description: { type: String, default: '' } }, { timestamps: true });
module.exports = mongoose.model('Department', s);
