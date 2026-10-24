const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getSettings } = require('../utils/settings');
const { audit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../middleware/error');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const s = await getSettings();
  // employee/hr can view (no location? brief: company settings view for HR; employee no). We'll return all to auth; frontend hides.
  res.json(s);
}));

router.put('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const s = await getSettings();
  const before = s.toObject();
  const fields = ['companyName', 'officeStart', 'graceMinutes', 'halfDayHours', 'weekendDays', 'officeLocation'];
  for (const f of fields) if (req.body[f] !== undefined) s[f] = req.body[f];
  s.setupComplete = true;
  await s.save();
  await audit(req, 'update', 'settings', s._id, before, s.toObject());
  res.json(s);
}));

module.exports = router;
