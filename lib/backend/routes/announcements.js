const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const Announcement = require('../models/Announcement');
const { audit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../middleware/error');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const items = await Announcement.find().sort({ createdAt: -1 }).limit(50);
  res.json(items);
}));

router.post('/', requireRole('admin', 'hr'), asyncHandler(async (req, res) => {
  const { title, body } = req.body;
  if (!title || !body) throw new HttpError(400, 'title,body required');
  const item = await Announcement.create({ title, body, authorId: req.user._id });
  await audit(req, 'post_announcement', 'announcement', item._id, null, item.toObject());
  res.status(201).json(item);
}));

router.delete('/:id', requireRole('admin', 'hr'), asyncHandler(async (req, res) => {
  await Announcement.findByIdAndDelete(req.params.id);
  res.json({ success: true });
}));

module.exports = router;
