const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'hr', 'employee'], required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  active: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.methods.comparePassword = function (pwd) {
  return bcrypt.compare(pwd, this.passwordHash);
};

userSchema.statics.hashPassword = async function (pwd) {
  return bcrypt.hash(pwd, 10);
};

module.exports = mongoose.model('User', userSchema);
