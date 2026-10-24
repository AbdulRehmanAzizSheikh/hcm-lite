const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  employeeCode: { type: String, required: true, unique: true, trim: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  gender: { type: String, enum: ['male', 'female', 'other', ''], default: '' },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Designation' },
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  joinDate: { type: Date, required: true },
  exitDate: { type: Date, default: null },
  status: { type: String, enum: ['active', 'probation', 'exited'], default: 'active' },
  salary: {
    basic: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    medical: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

employeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

employeeSchema.set('toJSON', { virtuals: true });
employeeSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Employee', employeeSchema);
