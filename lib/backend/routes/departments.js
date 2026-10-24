const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const Department = require('../models/Department');
const { audit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../middleware/error');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const items = await Department.find().sort({ name: 1 });
  res.json(items);
}));

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const { name, code, description } = req.body;
  if (!name) throw new HttpError(400, 'name required');
  const item = await Department.create({ name, code, description });
  await audit(req, 'create', 'department', item._id, null, item.toObject());
  res.status(201).json(item);
}));

router.put('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const item = await Department.findById(req.params.id);
  if (!item) throw new HttpError(404, 'not found');
  const before = item.toObject();
  Object.assign(item, req.body);
  await item.save();
  await audit(req, 'update', 'department', item._id, before, item.toObject());
  res.json(item);
}));

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const item = await Department.findByIdAndDelete(req.params.id);
  if (!item) throw new HttpError(404, 'not found');
  await audit(req, 'delete', 'department', item._id, item.toObject(), null);
  res.json({ success: true });
}));

module.exports = router;
