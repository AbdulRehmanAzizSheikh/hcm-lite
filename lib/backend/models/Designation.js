const mongoose = require('mongoose');
const s = new mongoose.Schema({ name: { type: String, required: true, trim: true }, departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' }, level: { type: Number, default: 1 } }, { timestamps: true });
module.exports = mongoose.model('Designation', s);
