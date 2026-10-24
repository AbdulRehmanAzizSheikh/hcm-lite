const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const { audit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../middleware/error');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

router.get('/', asyncHandler(async (req, res) => {
  const items = await User.find().select('-passwordHash').populate('employeeId').sort({ createdAt: -1 });
  res.json(items);
}));

router.post('/', asyncHandler(async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password || !role) throw new HttpError(400, 'email,password,role required');
  if (!['hr', 'admin'].includes(role)) throw new HttpError(400, 'role must be hr or admin');
  const exists = await User.findOne({ email: email.toLowerCase() });
  if (exists) throw new HttpError(409, 'email exists');
  const hash = await User.hashPassword(password);
  const user = await User.create({ email, passwordHash: hash, role, mustChangePassword: true });
  await audit(req, 'create', 'user', user._id, null, { email, role });
  res.status(201).json({ id: user._id, email: user.email, role: user.role });
}));

router.patch('/:id/deactivate', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'not found');
  const before = { active: user.active };
  user.active = false;
  await user.save();
  await audit(req, 'deactivate', 'user', user._id, before, { active: false });
  res.json({ success: true });
}));

router.patch('/:id/reset-password', asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, 'not found');
  const pwd = req.body.password || 'Temp@1234';
  user.passwordHash = await User.hashPassword(pwd);
  user.mustChangePassword = true;
  await user.save();
  res.json({ success: true, tempPassword: pwd });
}));

module.exports = router;
