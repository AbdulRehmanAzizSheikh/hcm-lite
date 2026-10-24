const mongoose = require('mongoose');
const s = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, role: String, prompt: String, response: String, toolCalls: mongoose.Schema.Types.Mixed, durationMs: Number }, { timestamps: true });
module.exports = mongoose.model('AiLog', s);
