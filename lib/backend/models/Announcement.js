const mongoose = require('mongoose');
const s = new mongoose.Schema({ title: { type: String, required: true }, body: { type: String, required: true }, authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, targetRoles: { type: [String], default: ['admin', 'hr', 'employee'] } }, { timestamps: true });
module.exports = mongoose.model('Announcement', s);
