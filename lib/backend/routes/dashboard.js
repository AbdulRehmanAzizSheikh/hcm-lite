const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveType = require('../models/LeaveType');
const PayrollRun = require('../models/PayrollRun');
const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');
const { getSettings } = require('../utils/settings');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../middleware/error');

const router = express.Router();
router.use(requireAuth);

router.get('/admin', requireRole('admin'), asyncHandler(async (req, res) => {
  const { from, to, departmentId } = req.query;
  const empFilter = { status: { $ne: 'exited' } };
  if (departmentId) empFilter.departmentId = departmentId;
  const emps = await Employee.find(empFilter).populate('departmentId');
  const headcount = emps.length;
  const byDept = {};
  for (const e of emps) byDept[e.departmentId?.name || 'Unassigned'] = (byDept[e.departmentId?.name || 'Unassigned'] || 0) + 1;
  const gender = {};
  for (const e of emps) gender[e.gender || 'unspecified'] = (gender[e.gender || 'unspecified'] || 0) + 1;

  // attrition YTD
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const exits = await Employee.countDocuments({ status: 'exited', exitDate: { $gte: yearStart } });

  // payroll cost
  const runs = await PayrollRun.find({ status: 'finalized' }).sort({ month: -1 });
  const latest = runs[0];
  const payrollCost = latest ? latest.totals.gross : 0;
  const avgSalary = emps.length ? emps.reduce((a, e) => a + ((e.salary?.basic || 0) * 1.5 + (e.salary?.allowances || 0)), 0) / emps.length : 0;

  // payroll cost by dept from latest run
  const payrollByDept = {};
  if (latest) {
    for (const l of latest.lines) {
      payrollByDept[l.department || 'Unassigned'] = (payrollByDept[l.department || 'Unassigned'] || 0) + l.gross;
    }
  }

  // tenure buckets
  const now = new Date();
  const tenure = { '<1y': 0, '1-3y': 0, '3-5y': 0, '5y+': 0 };
  for (const e of emps) {
    const yrs = (now - new Date(e.joinDate)) / (365.25 * 86400000);
    if (yrs < 1) tenure['<1y']++;
    else if (yrs < 3) tenure['1-3y']++;
    else if (yrs < 5) tenure['3-5y']++;
    else tenure['5y+']++;
  }

  const recentAudit = await AuditLog.find().sort({ createdAt: -1 }).limit(10).populate('actorId', 'email role');

  res.json({ headcount, exitsYTD: exits, attritionRate: headcount ? (exits / headcount * 100).toFixed(1) : 0, payrollCost, avgSalary: Math.round(avgSalary), byDept, gender, tenure, payrollByDept, recentAudit, latestMonth: latest?.month });
}));

router.get('/hr', requireRole('admin', 'hr'), asyncHandler(async (req, res) => {
  const { departmentId } = req.query;
  const today = new Date().toISOString().slice(0, 10);
  const empFilter = { status: { $ne: 'exited' } };
  if (departmentId) empFilter.departmentId = departmentId;
  const emps = await Employee.find(empFilter);
  const headcount = emps.length;

  const todayRecs = await Attendance.find({ date: today });
  const present = todayRecs.filter(r => ['present', 'late', 'missing_checkout'].includes(r.status)).length;
  const late = todayRecs.filter(r => r.status === 'late').length;
  const onLeaveToday = await LeaveRequest.countDocuments({ status: 'approved', startDate: { $lte: new Date(today) }, endDate: { $gte: new Date(today) } });

  const pendingApprovals = await LeaveRequest.countDocuments({ status: 'pending' }) + await Attendance.countDocuments({ 'correction.requested': true, 'correction.status': 'pending' });

  // attendance trend last 14 days
  const trend = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const recs = await Attendance.find({ date: key });
    const p = recs.filter(r => ['present', 'late', 'missing_checkout', 'half_day'].includes(r.status)).length;
    trend.push({ date: key, present: p, total: recs.length });
  }

  // absenteeism by dept this month
  const prefix = new Date().toISOString().slice(0, 7);
  const monthRecs = await Attendance.find({ date: { $regex: '^' + prefix } });
  const absentByDept = {};
  for (const r of monthRecs) {
    if (r.status === 'absent') {
      const emp = emps.find(e => String(e._id) === String(r.employeeId));
      const dept = 'dept';
      absentByDept[dept] = (absentByDept[dept] || 0) + 1;
    }
  }
  // better: group by employee's dept
  const empMap = new Map(emps.map(e => [String(e._id), e]));
  const deptAbsent = {};
  for (const r of monthRecs) {
    if (r.status === 'absent') {
      const emp = empMap.get(String(r.employeeId));
      const dep = emp?.departmentId ? String(emp.departmentId) : 'none';
      deptAbsent[dep] = (deptAbsent[dep] || 0) + 1;
    }
  }

  // leave by type this year
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const approvedLeaves = await LeaveRequest.find({ status: 'approved', startDate: { $gte: yearStart } }).populate('leaveTypeId');
  const leaveByType = {};
  for (const l of approvedLeaves) {
    const name = l.leaveTypeId?.name || 'Unknown';
    leaveByType[name] = (leaveByType[name] || 0) + (l.workingDays || l.days);
  }

  // top 5 late comers this month
  const lateRecs = await Attendance.find({ date: { $regex: '^' + prefix }, status: 'late' });
  const lateCounts = {};
  for (const r of lateRecs) lateCounts[String(r.employeeId)] = (lateCounts[String(r.employeeId)] || 0) + 1;
  const topLate = Object.entries(lateCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => {
    const emp = empMap.get(id);
    return { employeeId: id, name: emp ? `${emp.firstName} ${emp.lastName}` : id, count };
  });

  res.json({ headcount, presentToday: present, lateToday: late, onLeaveToday, pendingApprovals, trend, leaveByType, topLate });
}));

router.get('/employee', asyncHandler(async (req, res) => {
  if (req.user.role !== 'employee') throw new HttpError(403, 'employee only');
  const empId = req.user.employeeId;
  const emp = await Employee.findById(empId).populate('departmentId designationId');
  // hours this week
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekRecs = await Attendance.find({ employeeId: empId, date: { $gte: weekStartStr } });
  const hoursThisWeek = weekRecs.reduce((a, r) => a + (r.workMinutes || 0), 0) / 60;
  // late count this month
  const prefix = now.toISOString().slice(0, 7);
  const lateCount = await Attendance.countDocuments({ employeeId: empId, date: { $regex: '^' + prefix }, status: 'late' });
  // leave balance
  const types = await LeaveType.find();
  const year = now.getFullYear();
  const ys = new Date(Date.UTC(year, 0, 1)); const ye = new Date(Date.UTC(year, 11, 31));
  const approved = await LeaveRequest.find({ employeeId: empId, status: 'approved', startDate: { $gte: ys }, endDate: { $lte: ye } }).populate('leaveTypeId');
  const usedByType = {};
  for (const lr of approved) usedByType[lr.leaveTypeId?.code] = (usedByType[lr.leaveTypeId?.code] || 0) + (lr.workingDays || lr.days);
  const balances = types.map(t => ({ name: t.name, code: t.code, quota: t.annualQuota, used: usedByType[t.code] || 0, remaining: t.annualQuota ? t.annualQuota - (usedByType[t.code] || 0) : null }));
  // last payslip
  const lastRun = await PayrollRun.findOne({ status: 'finalized', 'lines.employeeId': empId }).sort({ month: -1 });
  const lastPayslip = lastRun ? lastRun.lines.find(l => String(l.employeeId) === String(empId)) : null;
  const announcements = await (require('../models/Announcement')).find().sort({ createdAt: -1 }).limit(5);
  res.json({ employee: emp, hoursThisWeek: Math.round(hoursThisWeek * 10) / 10, lateCountThisMonth: lateCount, balances, lastPayslip: lastPayslip ? { month: lastRun.month, net: lastPayslip.net } : null, announcements });
}));

module.exports = router;
