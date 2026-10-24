const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const Designation = require('../models/Designation');
const { audit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../middleware/error');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const filter = req.query.departmentId ? { departmentId: req.query.departmentId } : {};
  const items = await Designation.find(filter).populate('departmentId').sort({ name: 1 });
  res.json(items);
}));

router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const item = await Designation.create(req.body);
  await audit(req, 'create', 'designation', item._id, null, item.toObject());
  res.status(201).json(item);
}));

router.put('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const item = await Designation.findById(req.params.id);
  if (!item) throw new HttpError(404, 'not found');
  const before = item.toObject();
  Object.assign(item, req.body);
  await item.save();
  await audit(req, 'update', 'designation', item._id, before, item.toObject());
  res.json(item);
}));

router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  const item = await Designation.findByIdAndDelete(req.params.id);
  if (!item) throw new HttpError(404, 'not found');
  res.json({ success: true });
}));

module.exports = router;
