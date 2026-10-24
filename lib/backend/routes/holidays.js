const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const Holiday = require('../models/Holiday');
const { audit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../middleware/error');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const items = await Holiday.find().sort({ date: 1 });
  res.json(items);
}));

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const item = await Holiday.create(req.body);
  await audit(req, 'create', 'holiday', item._id, null, item.toObject());
  res.status(201).json(item);
}));

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const item = await Holiday.findByIdAndDelete(req.params.id);
  if (!item) throw new HttpError(404, 'not found');
  res.json({ success: true });
}));

module.exports = router;
