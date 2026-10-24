const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const { getSettings } = require('../utils/settings');
const { isWorkingDay } = require('../utils/date');
const { audit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../middleware/error');
const geolib = require('geolib');

const router = express.Router();
router.use(requireAuth);

function todayStr() { return new Date().toISOString().slice(0, 10); }

function computeStatus(checkIn, checkOut, settings) {
  const [hh, mm] = settings.officeStart.split(':').map(Number);
  const startMinutes = hh * 60 + mm + settings.graceMinutes;
  const inMin = checkIn.getUTCHours() * 60 + checkIn.getUTCMinutes();
  const late = inMin > startMinutes;
  const lateMinutes = late ? inMin - (hh * 60 + mm) : 0;
  let status = late ? 'late' : 'present';
  if (checkOut) {
    const mins = (checkOut - checkIn) / 60000;
    if (mins < settings.halfDayHours * 60) status = 'half_day';
  }
  return { status, lateMinutes };
}

// check-in
router.post('/check-in', asyncHandler(async (req, res) => {
  const empId = req.user.role === 'employee' ? req.user.employeeId : req.body.employeeId;
  if (!empId) throw new HttpError(400, 'employeeId required');
  // camera location check
  const { source = 'web', location } = req.body;
  if (source === 'camera') {
    const s = await getSettings();
    if (!s.officeLocation.lat) throw new HttpError(400, 'office location not set');
    if (!location || location.accuracy > 100) throw new HttpError(400, 'GPS accuracy too poor');
    const dist = geolib.getDistance({ latitude: location.lat, longitude: location.lng }, { latitude: s.officeLocation.lat, longitude: s.officeLocation.lng });
    if (dist > s.officeLocation.radius) throw new HttpError(400, 'outside office radius');
  }

  const date = todayStr();
  const existing = await Attendance.findOne({ employeeId: empId, date });
  if (existing) throw new HttpError(409, 'already checked in today');
  const settings = await getSettings();
  const checkIn = new Date();
  const { status, lateMinutes } = computeStatus(checkIn, null, settings);
  const rec = await Attendance.create({
    employeeId: empId, date, checkIn, status, source, location: location || {}, lateMinutes,
  });
  await audit(req, 'checkin', 'attendance', rec._id, null, rec.toObject());
  res.status(201).json(rec);
}));

// check-out
router.post('/check-out', asyncHandler(async (req, res) => {
  const empId = req.user.role === 'employee' ? req.user.employeeId : req.body.employeeId;
  const date = todayStr();
  const rec = await Attendance.findOne({ employeeId: empId, date });
  if (!rec) throw new HttpError(404, 'no check-in today');
  if (rec.checkOut) throw new HttpError(409, 'already checked out');
  rec.checkOut = new Date();
  const settings = await getSettings();
  const { status, lateMinutes } = computeStatus(rec.checkIn, rec.checkOut, settings);
  rec.status = status;
  rec.lateMinutes = lateMinutes;
  rec.workMinutes = Math.round((rec.checkOut - rec.checkIn) / 60000);
  await rec.save();
  await audit(req, 'checkout', 'attendance', rec._id, null, rec.toObject());
  res.json(rec);
}));

// list / filter
router.get('/', asyncHandler(async (req, res) => {
  const { employeeId, from, to, departmentId } = req.query;
  const filter = {};
  if (req.user.role === 'employee') filter.employeeId = req.user.employeeId;
  else if (employeeId) filter.employeeId = employeeId;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }
  // department filter
  if (departmentId && req.user.role !== 'employee') {
    const emps = await Employee.find({ departmentId }).select('_id');
    filter.employeeId = { $in: emps.map(e => e._id) };
  }
  const items = await Attendance.find(filter).populate('employeeId', 'firstName lastName employeeCode departmentId').sort({ date: -1, createdAt: -1 }).limit(500);
  res.json(items);
}));

// daily board
router.get('/board', requireRole('admin', 'hr'), asyncHandler(async (req, res) => {
  const date = req.query.date || todayStr();
  const emps = await Employee.find({ status: { $ne: 'exited' } }).populate('departmentId');
  const recs = await Attendance.find({ date });
  const map = new Map(recs.map(r => [String(r.employeeId), r]));
  const leaveEmps = await LeaveRequest.find({ status: 'approved', startDate: { $lte: new Date(date) }, endDate: { $gte: new Date(date) } });
  const onLeave = new Set(leaveEmps.map(l => String(l.employeeId)));
  const board = emps.map(e => ({
    employee: e,
    attendance: map.get(String(e._id)) || null,
    onLeave: onLeave.has(String(e._id)),
  }));
  res.json({ date, board });
}));

// employee calendar
router.get('/calendar/:employeeId', asyncHandler(async (req, res) => {
  if (req.user.role === 'employee' && String(req.user.employeeId) !== req.params.employeeId) throw new HttpError(403, 'Forbidden');
  const { month } = req.query; // YYYY-MM
  const prefix = month || new Date().toISOString().slice(0, 7);
  const items = await Attendance.find({ employeeId: req.params.employeeId, date: { $regex: '^' + prefix } });
  res.json(items);
}));

// request correction
router.post('/:id/correct', asyncHandler(async (req, res) => {
  const rec = await Attendance.findById(req.params.id);
  if (!rec) throw new HttpError(404, 'not found');
  if (req.user.role === 'employee' && String(req.user.employeeId) !== String(rec.employeeId)) throw new HttpError(403, 'Forbidden');
  const { reason, proposedCheckIn, proposedCheckOut } = req.body;
  if (!reason) throw new HttpError(400, 'reason required');
  rec.correction = {
    requested: true, reason, requestedAt: new Date(), status: 'pending',
    proposedCheckIn: proposedCheckIn ? new Date(proposedCheckIn) : undefined,
    proposedCheckOut: proposedCheckOut ? new Date(proposedCheckOut) : undefined,
  };
  await rec.save();
  // notify HRs
  const hrs = await User.find({ role: 'hr' });
  const Notification = require('../models/Notification');
  for (const h of hrs) await Notification.create({ userId: h._id, type: 'correction', title: 'Attendance correction requested', body: reason });
  await audit(req, 'request_correction', 'attendance', rec._id, null, rec.correction);
  res.json(rec);
}));

// approve/reject correction (hr/admin)
router.patch('/:id/correct', requireRole('hr', 'admin'), asyncHandler(async (req, res) => {
  const rec = await Attendance.findById(req.params.id);
  if (!rec || !rec.correction?.requested) throw new HttpError(404, 'no correction request');
  const { status, comment } = req.body;
  if (!['approved', 'rejected'].includes(status)) throw new HttpError(400, 'status approved/rejected');
  rec.correction.status = status;
  rec.correction.reviewedBy = req.user._id;
  rec.correction.reviewedAt = new Date();
  rec.correction.comment = comment || '';
  if (status === 'approved') {
    if (rec.correction.proposedCheckIn) rec.checkIn = rec.correction.proposedCheckIn;
    if (rec.correction.proposedCheckOut) rec.checkOut = rec.correction.proposedCheckOut;
    const settings = await getSettings();
    const { status: st, lateMinutes } = (function () {
      const ci = rec.checkIn, co = rec.checkOut;
      const [hh, mm] = settings.officeStart.split(':').map(Number);
      const inMin = ci.getUTCHours() * 60 + ci.getUTCMinutes();
      const late = inMin > (hh * 60 + mm + settings.graceMinutes);
      const lateMinutes = late ? inMin - (hh * 60 + mm) : 0;
      let status = late ? 'late' : 'present';
      if (co) {
        const mins = (co - ci) / 60000;
        if (mins < settings.halfDayHours * 60) status = 'half_day';
      }
      return { status, lateMinutes };
    })();
    rec.status = st;
    rec.lateMinutes = lateMinutes;
    if (rec.checkOut) rec.workMinutes = Math.round((rec.checkOut - rec.checkIn) / 60000);
  }
  await rec.save();
  await audit(req, status === 'approved' ? 'approve_correction' : 'reject_correction', 'attendance', rec._id, null, rec.toObject());
  res.json(rec);
}));

module.exports = router;
