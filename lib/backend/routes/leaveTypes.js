const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const LeaveType = require('../models/LeaveType');
const { audit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../middleware/error');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const items = await LeaveType.find().sort({ name: 1 });
  res.json(items);
}));

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const item = await LeaveType.create(req.body);
  await audit(req, 'create', 'leaveType', item._id, null, item.toObject());
  res.status(201).json(item);
}));

router.put('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const item = await LeaveType.findById(req.params.id);
  if (!item) throw new HttpError(404, 'not found');
  const before = item.toObject();
  Object.assign(item, req.body);
  await item.save();
  await audit(req, 'update', 'leaveType', item._id, before, item.toObject());
  res.json(item);
}));

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const item = await LeaveType.findByIdAndDelete(req.params.id);
  if (!item) throw new HttpError(404, 'not found');
  res.json({ success: true });
}));

module.exports = router;
