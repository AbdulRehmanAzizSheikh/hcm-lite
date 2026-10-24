const AuditLog = require('../models/AuditLog');

async function audit(req, action, entity, entityId, before, after) {
  try {
    await AuditLog.create({
      actorId: req.user?._id,
      actorRole: req.user?.role,
      action, entity, entityId, before, after,
    });
  } catch (e) { console.error('audit fail', e.message); }
}

module.exports = { audit };
