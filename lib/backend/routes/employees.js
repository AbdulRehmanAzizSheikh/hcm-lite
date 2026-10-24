const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { requireAuth, requireRole } = require('../middleware/auth');
const Employee = require('../models/Employee');
const User = require('../models/User');
const Department = require('../models/Department');
const Designation = require('../models/Designation');
const { audit } = require('../utils/audit');
const asyncHandler = require('../utils/asyncHandler');
const { HttpError } = require('../middleware/error');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function canViewAll(user) { return user.role === 'admin' || user.role === 'hr'; }

router.use(requireAuth);

// list
router.get('/', asyncHandler(async (req, res) => {
  const { q, departmentId, status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (req.user.role === 'employee') {
    if (!req.user.employeeId) return res.json({ items: [], total: 0 });
    filter._id = req.user.employeeId;
  }
  if (departmentId) filter.departmentId = departmentId;
  if (status) filter.status = status;
  if (q) {
    const regex = new RegExp(q, 'i');
    filter.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }, { employeeCode: regex }];
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Employee.find(filter).populate('departmentId designationId').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Employee.countDocuments(filter),
  ]);
  res.json({ items, total, page: Number(page), limit: Number(limit) });
}));

// get one (360)
router.get('/:id', asyncHandler(async (req, res) => {
  if (req.user.role === 'employee' && String(req.user.employeeId) !== req.params.id) throw new HttpError(403, 'Forbidden');
  const emp = await Employee.findById(req.params.id).populate('departmentId designationId managerId userId');
  if (!emp) throw new HttpError(404, 'not found');
  res.json(emp);
}));

// register employee (creates login)
router.post('/', requireRole('hr', 'admin'), asyncHandler(async (req, res) => {
  const b = req.body;
  if (!b.firstName || !b.lastName || !b.email || !b.employeeCode || !b.joinDate) throw new HttpError(400, 'missing required fields');
  const exists = await Employee.findOne({ $or: [{ email: b.email.toLowerCase() }, { employeeCode: b.employeeCode }] });
  if (exists) throw new HttpError(409, 'employee code or email exists');
  const emp = await Employee.create({
    employeeCode: b.employeeCode, firstName: b.firstName, lastName: b.lastName,
    email: b.email.toLowerCase(), phone: b.phone || '', address: b.address || '',
    gender: b.gender || '', departmentId: b.departmentId || null, designationId: b.designationId || null,
    joinDate: new Date(b.joinDate), status: b.status || 'active', salary: b.salary || {},
  });
  // create login
  const tempPwd = b.password || 'Temp@1234';
  const hash = await User.hashPassword(tempPwd);
  const user = await User.create({ email: emp.email, passwordHash: hash, role: 'employee', employeeId: emp._id, mustChangePassword: true });
  emp.userId = user._id;
  await emp.save();
  await audit(req, 'create', 'employee', emp._id, null, emp.toObject());
  res.status(201).json({ employee: emp, tempPassword: tempPwd });
}));

// update
router.put('/:id', asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.params.id);
  if (!emp) throw new HttpError(404, 'not found');
  if (req.user.role === 'employee') {
    if (String(req.user.employeeId) !== req.params.id) throw new HttpError(403, 'Forbidden');
    // only phone/address
    if (req.body.phone !== undefined) emp.phone = req.body.phone;
    if (req.body.address !== undefined) emp.address = req.body.address;
  } else {
    const before = emp.toObject();
    const allowed = ['firstName', 'lastName', 'phone', 'address', 'gender', 'departmentId', 'designationId', 'joinDate', 'exitDate', 'status', 'employeeCode', 'email'];
    for (const f of allowed) if (req.body[f] !== undefined) {
      if (f === 'joinDate' || f === 'exitDate') emp[f] = req.body[f] ? new Date(req.body[f]) : null;
      else emp[f] = req.body[f];
    }
    await audit(req, 'update', 'employee', emp._id, before, emp.toObject());
  }
  await emp.save();
  res.json(emp);
}));

// salary structure
router.put('/:id/salary', requireRole('hr', 'admin'), asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.params.id);
  if (!emp) throw new HttpError(404, 'not found');
  const before = emp.salary;
  emp.salary = { ...emp.salary.toObject?.() || emp.salary, ...req.body };
  // auto compute hra/medical if basic given? brief: Gross = 1.5*basic (HRA 40%, medical 10%). We'll store components.
  if (req.body.basic !== undefined) {
    const basic = Number(req.body.basic);
    emp.salary.basic = basic;
    if (req.body.hra === undefined) emp.salary.hra = Math.round(basic * 0.4);
    if (req.body.medical === undefined) emp.salary.medical = Math.round(basic * 0.1);
  }
  if (req.body.allowances !== undefined) emp.salary.allowances = Number(req.body.allowances);
  await emp.save();
  await audit(req, 'update', 'salary', emp._id, before, emp.salary);
  res.json(emp);
}));

// CSV dry-run / import
router.post('/import', requireRole('hr', 'admin'), upload.single('file'), asyncHandler(async (req, res) => {
  const dryRun = req.query.dryRun !== 'false';
  if (!req.file) throw new HttpError(400, 'file required');
  const text = req.file.buffer.toString('utf8');
  const rows = await parseCsv(text);
  const errors = [];
  const valid = [];
  const seenCodes = new Set();
  const seenEmails = new Set();
  // existing
  const existingEmps = await Employee.find({}, 'employeeCode email');
  const existingCodes = new Set(existingEmps.map(e => e.employeeCode));
  const existingEmails = new Set(existingEmps.map(e => e.email));
  const depts = await Department.find();
  const deptMap = new Map(depts.map(d => [d.name.toLowerCase(), d._id]));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const rowNum = i + 2;
    const rowErrors = [];
    // required
    if (!r.employeeCode) rowErrors.push({ row: rowNum, field: 'employeeCode', reason: 'required' });
    if (!r.firstName) rowErrors.push({ row: rowNum, field: 'firstName', reason: 'required' });
    if (!r.lastName) rowErrors.push({ row: rowNum, field: 'lastName', reason: 'required' });
    if (!r.email) rowErrors.push({ row: rowNum, field: 'email', reason: 'required' });
    if (!r.joinDate) rowErrors.push({ row: rowNum, field: 'joinDate', reason: 'required' });
    if (!r.salary || Number(r.salary) <= 0) rowErrors.push({ row: rowNum, field: 'salary', reason: 'must be > 0' });
    // unique
    if (r.employeeCode) {
      if (existingCodes.has(r.employeeCode) || seenCodes.has(r.employeeCode)) rowErrors.push({ row: rowNum, field: 'employeeCode', reason: 'duplicate code' });
      seenCodes.add(r.employeeCode);
    }
    if (r.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) rowErrors.push({ row: rowNum, field: 'email', reason: 'invalid email' });
      if (existingEmails.has(r.email.toLowerCase()) || seenEmails.has(r.email.toLowerCase())) rowErrors.push({ row: rowNum, field: 'email', reason: 'duplicate email' });
      seenEmails.add(r.email.toLowerCase());
    }
    if (r.joinDate && isNaN(Date.parse(r.joinDate))) rowErrors.push({ row: rowNum, field: 'joinDate', reason: 'invalid ISO date' });
    if (r.department && !deptMap.has(r.department.toLowerCase())) rowErrors.push({ row: rowNum, field: 'department', reason: 'unknown department' });

    if (rowErrors.length) errors.push(...rowErrors);
    else valid.push({ row: r, rowNum });
  }

  if (dryRun) {
    return res.json({ dryRun: true, total: rows.length, valid: valid.length, errors });
  }

  // commit
  const created = [];
  for (const v of valid) {
    const r = v.row;
    const emp = await Employee.create({
      employeeCode: r.employeeCode,
      firstName: r.firstName,
      lastName: r.lastName,
      email: r.email.toLowerCase(),
      phone: r.phone || '',
      departmentId: r.department ? deptMap.get(r.department.toLowerCase()) : null,
      joinDate: new Date(r.joinDate),
      status: 'active',
      salary: { basic: Number(r.salary), hra: Math.round(Number(r.salary) * 0.4), medical: Math.round(Number(r.salary) * 0.1), allowances: Number(r.allowances || 0) },
    });
    const tempPwd = 'Temp@1234';
    const hash = await User.hashPassword(tempPwd);
    const user = await User.create({ email: emp.email, passwordHash: hash, role: 'employee', employeeId: emp._id, mustChangePassword: true });
    emp.userId = user._id;
    await emp.save();
    created.push(emp._id);
  }
  await audit(req, 'import', 'employee', null, null, { count: created.length });
  res.json({ dryRun: false, created: created.length, errors });
}));

// export CSV
router.get('/export', requireRole('hr', 'admin'), asyncHandler(async (req, res) => {
  const emps = await Employee.find().populate('departmentId designationId');
  const header = 'employeeCode,firstName,lastName,email,phone,department,designation,status,joinDate,basic,hra,medical,allowances\n';
  const lines = emps.map(e => [
    e.employeeCode, e.firstName, e.lastName, e.email, e.phone,
    e.departmentId?.name || '', e.designationId?.name || '', e.status,
    e.joinDate ? e.joinDate.toISOString().slice(0, 10) : '',
    e.salary?.basic || 0, e.salary?.hra || 0, e.salary?.medical || 0, e.salary?.allowances || 0,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="employees.csv"');
  res.send(header + lines.join('\n'));
}));

function parseCsv(text) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from([text]);
    stream.pipe(csv()).on('data', (d) => results.push(d)).on('end', () => resolve(results)).on('error', reject);
  });
}

module.exports = router;
