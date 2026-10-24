const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', asyncHandler(async (req, res) => {
  const items = await AuditLog.find().sort({ createdAt: -1 }).limit(200).populate('actorId', 'email role');
  res.json(items);
}));

module.exports = router;
