const mongoose = require('mongoose');
const s = new mongoose.Schema({ actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, actorRole: String, action: { type: String, required: true }, entity: { type: String, required: true }, entityId: { type: mongoose.Schema.Types.ObjectId }, before: mongoose.Schema.Types.Mixed, after: mongoose.Schema.Types.Mixed }, { timestamps: true });
module.exports = mongoose.model('AuditLog', s);
