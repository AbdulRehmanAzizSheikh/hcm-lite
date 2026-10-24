const mongoose = require('mongoose');
const lineSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  employeeCode: String,
  employeeName: String,
  department: String,
  basic: Number, hra: Number, medical: Number, allowances: Number,
  gross: Number,
  workingDays: Number,
  perDay: Number,
  absentDays: Number, halfDays: Number, unpaidDays: Number,
  deduction: Number,
  tax: Number,
  net: Number,
}, { _id: false });
const s = new mongoose.Schema({
  month: { type: String, required: true, unique: true }, // YYYY-MM
  status: { type: String, enum: ['draft', 'finalized'], default: 'draft' },
  workingDays: { type: Number, default: 22 },
  lines: [lineSchema],
  totals: { gross: Number, net: Number, tax: Number, deduction: Number },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  finalizedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  finalizedAt: { type: Date },
}, { timestamps: true });
module.exports = mongoose.model('PayrollRun', s);
