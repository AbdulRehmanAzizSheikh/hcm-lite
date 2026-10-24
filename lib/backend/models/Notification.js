const mongoose = require('mongoose');
const s = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, type: { type: String, default: 'info' }, title: { type: String, required: true }, body: { type: String, default: '' }, read: { type: Boolean, default: false }, link: { type: String, default: '' } }, { timestamps: true });
module.exports = mongoose.model('Notification', s);
