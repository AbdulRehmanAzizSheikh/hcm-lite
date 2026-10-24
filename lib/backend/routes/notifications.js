const express = require('express');
const { requireAuth } = require('../middleware/auth');
const Notification = require('../models/Notification');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const items = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
  res.json(items);
}));

router.patch('/:id/read', asyncHandler(async (req, res) => {
  const n = await Notification.findOne({ _id: req.params.id, userId: req.user._id });
  if (!n) return res.status(404).json({ message: 'not found' });
  n.read = true;
  await n.save();
  res.json(n);
}));

router.patch('/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
  res.json({ success: true });
}));

module.exports = router;
