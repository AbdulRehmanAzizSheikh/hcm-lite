const express = require('express');
const jwt = require('jsonwebtoken');
const { requireAuth: requireAuthMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const Settings = require('../models/Settings');
const { getSettings } = require('../utils/settings');
const { HttpError } = require('../middleware/error');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/status', asyncHandler(async (req, res) => {
  const count = await User.countDocuments();
  const s = await getSettings();
  res.json({ setupComplete: s.setupComplete && count > 0, hasAdmin: count > 0 });
}));

router.post('/setup', asyncHandler(async (req, res) => {
  const existing = await User.countDocuments();
  if (existing > 0) throw new HttpError(400, 'Already set up');
  const { companyName, adminEmail, adminPassword } = req.body;
  if (!companyName || !adminEmail || !adminPassword) throw new HttpError(400, 'companyName, adminEmail, adminPassword required');
  const s = await getSettings();
  s.companyName = companyName;
  s.setupComplete = true;
  await s.save();
  const hash = await User.hashPassword(adminPassword);
  const user = await User.create({ email: adminEmail, passwordHash: hash, role: 'admin', mustChangePassword: false });
  res.json({ success: true, userId: user._id });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new HttpError(400, 'email and password required');
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user || !user.active) throw new HttpError(401, 'Invalid credentials');
  const ok = await user.comparePassword(password);
  if (!ok) throw new HttpError(401, 'Invalid credentials');
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  res.json({ token, user: { id: user._id, email: user.email, role: user.role, mustChangePassword: user.mustChangePassword, employeeId: user.employeeId } });
}));

router.get('/me', requireAuthMiddleware, asyncHandler(async (req, res) => {
  res.json({ user: req.user });
}));

router.post('/change-password', requireAuthMiddleware, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) throw new HttpError(400, 'newPassword min 6 chars');
  const user = await User.findById(req.user._id);
  if (currentPassword) {
    const ok = await user.comparePassword(currentPassword);
    if (!ok) throw new HttpError(401, 'Current password wrong');
  }
  user.passwordHash = await User.hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();
  res.json({ success: true });
}));

module.exports = router;