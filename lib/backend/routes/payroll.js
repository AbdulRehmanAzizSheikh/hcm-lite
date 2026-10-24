const express = require('express');
const PDFDocument = require('pdfkit');
const { requireAuth, requireRole } = require('../middleware/auth');
const PayrollRun = require('../models/PayrollRun');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveType = require('../models/LeaveType');
const { getSettings } = require('../utils/settings');
const { countWorkingDays, parseDate } = require('../utils/date');
const { monthlyTax } = require('../utils/tax');
const { audit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../middleware/error');

const router = express.Router();
router.use(requireAuth);

function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start, end };
}

async function buildDraft(month, workingDaysOverride) {
  const settings = await getSettings();
  const { start, end } = monthRange(month);
  const monthWorkingDays = workingDaysOverride || await countWorkingDays(start, end, settings.weekendDays);
  const emps = await Employee.find({ status: { $ne: 'exited' } }).populate('departmentId');
  // approved leaves in month
  const leaves = await LeaveRequest.find({ status: 'approved', startDate: { $lte: end }, endDate: { $gte: start } }).populate('leaveTypeId');
  const unpaidTypeIds = new Set((await LeaveType.find({ paid: false })).map(t => String(t._id)));

  const lines = [];
  let totalGross = 0, totalNet = 0, totalTax = 0, totalDed = 0;

  for (const emp of emps) {
    // prorate join/exit
    const join = emp.joinDate > start ? emp.joinDate : start;
    const exit = emp.exitDate && emp.exitDate < end ? emp.exitDate : end;
    if (join > end) continue;
    const empWorkingDays = await countWorkingDays(join, exit, settings.weekendDays);
    if (empWorkingDays <= 0) continue;

    const basic = emp.salary?.basic || 0;
    const hra = emp.salary?.hra || Math.round(basic * 0.4);
    const medical = emp.salary?.medical || Math.round(basic * 0.1);
    const allowances = emp.salary?.allowances || 0;
    const gross = basic + hra + medical + allowances;

    const perDay = monthWorkingDays > 0 ? gross / monthWorkingDays : 0;

    // attendance
    const atts = await Attendance.find({ employeeId: emp._id, date: { $gte: month + '-01', $lte: month + '-31' } });
    const attMap = new Map(atts.map(a => [a.date, a]));
    let absentDays = 0;
    let halfDays = 0;
    // iterate working days after join
    const d = new Date(join);
    const e = new Date(exit);
    // count absent: working day with no attendance and no approved leave covering
    const empLeaves = leaves.filter(l => String(l.employeeId) === String(emp._id));
    function onApprovedLeave(dateStr) {
      const dt = parseDate(dateStr);
      return empLeaves.some(l => l.startDate <= dt && l.endDate >= dt);
    }
    const cur = new Date(join);
    while (cur <= e) {
      const key = cur.toISOString().slice(0, 10);
      const isWd = await (async () => {
        if (settings.weekendDays.includes(cur.getUTCDay())) return false;
        // holiday check
        const Holiday = require('../models/Holiday');
        const hs = await Holiday.find();
        return !hs.some(h => new Date(h.date).toISOString().slice(0, 10) === key || (h.recurring && new Date(h.date).getUTCMonth() === cur.getUTCMonth() && new Date(h.date).getUTCDate() === cur.getUTCDate()));
      })();
      if (isWd) {
        const rec = attMap.get(key);
        if (!rec) {
          if (!onApprovedLeave(key)) absentDays++;
        } else if (rec.status === 'half_day') halfDays++;
        else if (rec.status === 'missing_checkout') { /* treat as present */ }
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    // unpaid leave days
    let unpaidDays = 0;
    for (const l of empLeaves) {
      if (unpaidTypeIds.has(String(l.leaveTypeId?._id))) {
        // intersect with month
        const ls = l.startDate > start ? l.startDate : start;
        const le = l.endDate < end ? l.endDate : end;
        if (le >= ls) unpaidDays += await countWorkingDays(ls, le, settings.weekendDays);
      }
    }

    const deductionDays = absentDays + unpaidDays + 0.5 * halfDays;
    const deduction = Math.round(deductionDays * perDay * 100) / 100;
    const tax = Math.round(monthlyTax(gross) * 100) / 100;
    const net = Math.round((gross - deduction - tax) * 100) / 100;

    lines.push({
      employeeId: emp._id, employeeCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      department: emp.departmentId?.name || '',
      basic, hra, medical, allowances, gross,
      workingDays: monthWorkingDays, perDay: Math.round(perDay * 100) / 100,
      absentDays, halfDays, unpaidDays, deduction, tax, net,
    });
    totalGross += gross; totalNet += net; totalTax += tax; totalDed += deduction;
  }

  return {
    month, status: 'draft', workingDays: monthWorkingDays, lines,
    totals: { gross: Math.round(totalGross * 100) / 100, net: Math.round(totalNet * 100) / 100, tax: Math.round(totalTax * 100) / 100, deduction: Math.round(totalDed * 100) / 100 },
    createdBy: null,
  };
}

router.post('/', requireRole('hr', 'admin'), asyncHandler(async (req, res) => {
  const { month, workingDays } = req.body;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) throw new HttpError(400, 'month YYYY-MM required');
  const existing = await PayrollRun.findOne({ month });
  if (existing) {
    if (existing.status === 'finalized') throw new HttpError(409, 'payroll finalized for this month');
    // return existing draft
    return res.json(existing);
  }
  const data = await buildDraft(month, workingDays);
  data.createdBy = req.user._id;
  const run = await PayrollRun.create(data);
  await audit(req, 'create_payroll', 'payroll', run._id, null, { month });
  res.status(201).json(run);
}));

router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const runs = await PayrollRun.find().sort({ month: -1 });
  res.json(runs);
}));

router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const run = await PayrollRun.findById(req.params.id);
  if (!run) throw new HttpError(404, 'not found');
  res.json(run);
}));

router.patch('/:id/finalize', requireRole('admin'), asyncHandler(async (req, res) => {
  const run = await PayrollRun.findById(req.params.id);
  if (!run) throw new HttpError(404, 'not found');
  if (run.status === 'finalized') throw new HttpError(400, 'already finalized');
  run.status = 'finalized';
  run.finalizedBy = req.user._id;
  run.finalizedAt = new Date();
  await run.save();
  // notify employees
  const Notification = require('../models/Notification');
  const emps = await Employee.find({ _id: { $in: run.lines.map(l => l.employeeId) } });
  for (const e of emps) {
    if (e.userId) await Notification.create({ userId: e.userId, type: 'payslip', title: 'Payslip available', body: `Payslip for ${run.month} is ready`, link: `/payroll/${run._id}` });
  }
  await audit(req, 'finalize_payroll', 'payroll', run._id, null, { month: run.month });
  res.json(run);
}));

// payslip pdf
router.get('/:id/payslip/:employeeId', asyncHandler(async (req, res) => {
  const run = await PayrollRun.findById(req.params.id);
  if (!run) throw new HttpError(404, 'not found');
  if (req.user.role === 'employee' && String(req.user.employeeId) !== req.params.employeeId) throw new HttpError(403, 'Forbidden');
  const line = run.lines.find(l => String(l.employeeId) === req.params.employeeId);
  if (!line) throw new HttpError(404, 'line not found');
  const emp = await Employee.findById(req.params.employeeId);
  const settings = await getSettings();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="payslip-${run.month}-${line.employeeCode}.pdf"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  doc.fontSize(18).text(settings.companyName || 'HCM Lite', { align: 'center' });
  doc.fontSize(12).text(`Payslip for ${run.month}`, { align: 'center' });
  doc.moveDown();
  doc.text(`Employee: ${line.employeeName} (${line.employeeCode})`);
  doc.text(`Department: ${line.department}`);
  doc.text(`Status: ${run.status}`);
  doc.moveDown();
  doc.text('Earnings');
  doc.text(`Basic: ${line.basic}`);
  doc.text(`HRA: ${line.hra}`);
  doc.text(`Medical: ${line.medical}`);
  doc.text(`Allowances: ${line.allowances}`);
  doc.text(`Gross: ${line.gross}`);
  doc.moveDown();
  doc.text('Deductions');
  doc.text(`Absent days: ${line.absentDays}  Half days: ${line.halfDays}  Unpaid: ${line.unpaidDays}`);
  doc.text(`Per day: ${line.perDay}`);
  doc.text(`Deduction: ${line.deduction}`);
  doc.text(`Tax: ${line.tax}`);
  doc.moveDown();
  doc.fontSize(14).text(`Net Pay: ${line.net}`, { bold: true });
  doc.end();
}));

module.exports = router;
