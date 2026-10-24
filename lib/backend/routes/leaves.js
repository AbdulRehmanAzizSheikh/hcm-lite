const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const LeaveType = require('../models/LeaveType');
const Employee = require('../models/Employee');
const { getSettings } = require('../utils/settings');
const { countWorkingDays, isWorkingDay, parseDate } = require('../utils/date');
const { audit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../middleware/error');
const Notification = require('../models/Notification');

const router = express.Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role === 'employee') filter.employeeId = req.user.employeeId;
  else if (req.query.employeeId) filter.employeeId = req.query.employeeId;
  if (req.query.status) filter.status = req.query.status;
  const items = await LeaveRequest.find(filter).populate('employeeId', 'firstName lastName employeeCode').populate('leaveTypeId').sort({ createdAt: -1 }).limit(500);
  res.json(items);
}));

router.get('/balance/:employeeId', asyncHandler(async (req, res) => {
  if (req.user.role === 'employee' && String(req.user.employeeId) !== req.params.employeeId) throw new HttpError(403, 'Forbidden');
  const year = Number(req.query.year) || new Date().getFullYear();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const types = await LeaveType.find();
  const approved = await LeaveRequest.find({ employeeId: req.params.employeeId, status: 'approved', startDate: { $gte: start }, endDate: { $lte: end } }).populate('leaveTypeId');
  const usedByType = {};
  for (const lr of approved) {
    const code = lr.leaveTypeId?.code;
    usedByType[code] = (usedByType[code] || 0) + (lr.workingDays || lr.days);
  }
  const balances = types.map(t => ({
    leaveType: t,
    quota: t.annualQuota,
    used: usedByType[t.code] || 0,
    remaining: t.annualQuota === 0 ? null : t.annualQuota - (usedByType[t.code] || 0),
  }));
  res.json({ year, balances });
}));

router.post('/', asyncHandler(async (req, res) => {
  const empId = req.user.role === 'employee' ? req.user.employeeId : req.body.employeeId;
  if (!empId) throw new HttpError(400, 'employeeId required');
  const { leaveTypeId, startDate, endDate, reason } = req.body;
  if (!leaveTypeId || !startDate || !endDate) throw new HttpError(400, 'leaveTypeId, startDate, endDate required');
  const lt = await LeaveType.findById(leaveTypeId);
  if (!lt) throw new HttpError(404, 'leave type not found');
  const settings = await getSettings();
  const s = parseDate(startDate);
  const e = parseDate(endDate);
  if (e < s) throw new HttpError(400, 'endDate before startDate');

  // working days count
  const wd = await countWorkingDays(s, e, settings.weekendDays);
  if (wd === 0) throw new HttpError(422, 'no working days in range');

  // overlap check
  const overlap = await LeaveRequest.findOne({
    employeeId: empId, status: { $in: ['pending', 'approved'] },
    startDate: { $lte: e }, endDate: { $gte: s },
  });
  if (overlap) throw new HttpError(422, 'overlapping leave request');

  // balance check (paid types with quota)
  if (lt.annualQuota > 0) {
    const year = s.getUTCFullYear();
    const ys = new Date(Date.UTC(year, 0, 1));
    const ye = new Date(Date.UTC(year, 11, 31));
    const approved = await LeaveRequest.find({ employeeId: empId, status: 'approved', leaveTypeId, startDate: { $gte: ys }, endDate: { $lte: ye } });
    const used = approved.reduce((a, b) => a + (b.workingDays || b.days), 0);
    if (used + wd > lt.annualQuota) throw new HttpError(422, 'insufficient leave balance');
  }

  const lr = await LeaveRequest.create({
    employeeId: empId, leaveTypeId, startDate: s, endDate: e, days: Math.round((e - s) / 86400000) + 1, workingDays: wd, reason: reason || '', status: 'pending',
  });
  // notify HR
  const hrs = await User.find({ role: 'hr' });
  for (const h of hrs) await Notification.create({ userId: h._id, type: 'leave', title: 'New leave request', body: reason || 'Leave applied', link: '/leaves' });
  await audit(req, 'apply_leave', 'leave', lr._id, null, lr.toObject());
  res.status(201).json(lr);
}));

router.patch('/:id/approve', requireRole('hr', 'admin'), asyncHandler(async (req, res) => {
  const lr = await LeaveRequest.findById(req.params.id);
  if (!lr) throw new HttpError(404, 'not found');
  if (lr.status !== 'pending') throw new HttpError(400, 'not pending');
  lr.status = 'approved';
  lr.approvedBy = req.user._id;
  lr.approvedAt = new Date();
  lr.comment = req.body.comment || '';
  await lr.save();
  // notify employee
  const emp = await Employee.findById(lr.employeeId);
  if (emp?.userId) await Notification.create({ userId: emp.userId, type: 'leave', title: 'Leave approved', body: lr.comment || 'Your leave was approved' });
  await audit(req, 'approve_leave', 'leave', lr._id, null, lr.toObject());
  res.json(lr);
}));

router.patch('/:id/reject', requireRole('hr', 'admin'), asyncHandler(async (req, res) => {
  const lr = await LeaveRequest.findById(req.params.id);
  if (!lr) throw new HttpError(404, 'not found');
  if (lr.status !== 'pending') throw new HttpError(400, 'not pending');
  lr.status = 'rejected';
  lr.approvedBy = req.user._id;
  lr.approvedAt = new Date();
  lr.comment = req.body.comment || '';
  await lr.save();
  const emp = await Employee.findById(lr.employeeId);
  if (emp?.userId) await Notification.create({ userId: emp.userId, type: 'leave', title: 'Leave rejected', body: lr.comment || 'Your leave was rejected' });
  await audit(req, 'reject_leave', 'leave', lr._id, null, lr.toObject());
  res.json(lr);
}));

router.patch('/:id/cancel', asyncHandler(async (req, res) => {
  const lr = await LeaveRequest.findById(req.params.id);
  if (!lr) throw new HttpError(404, 'not found');
  if (req.user.role === 'employee' && String(req.user.employeeId) !== String(lr.employeeId)) throw new HttpError(403, 'Forbidden');
  if (lr.status === 'approved') {
    // allow cancel? brief says cancel leave. We'll allow cancel pending/approved future
  }
  lr.status = 'cancelled';
  await lr.save();
  await audit(req, 'cancel_leave', 'leave', lr._id, null, lr.toObject());
  res.json(lr);
}));

module.exports = router;
