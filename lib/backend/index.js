require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./config/db');
const { errorHandler } = require('./middleware/error');
const { getSettings } = require('./utils/settings');
const User = require('./models/User');

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

// routes
app.use('/auth', require('./routes/auth'));
app.use('/settings', require('./routes/settings'));
app.use('/departments', require('./routes/departments'));
app.use('/designations', require('./routes/designations'));
app.use('/leave-types', require('./routes/leaveTypes'));
app.use('/holidays', require('./routes/holidays'));
app.use('/users', require('./routes/users'));
app.use('/employees', require('./routes/employees'));
app.use('/attendance', require('./routes/attendance'));
app.use('/leaves', require('./routes/leaves'));
app.use('/payroll', require('./routes/payroll'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/announcements', require('./routes/announcements'));
app.use('/notifications', require('./routes/notifications'));
app.use('/audit', require('./routes/audit'));
app.use('/ai', require('./routes/ai'));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  await connectDB();
  await getSettings();
  // env-based first admin
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const count = await User.countDocuments({ role: 'admin' });
    if (count === 0) {
      const hash = await User.hashPassword(process.env.ADMIN_PASSWORD);
      await User.create({ email: process.env.ADMIN_EMAIL.toLowerCase(), passwordHash: hash, role: 'admin', mustChangePassword: false });
      const s = await (require('./models/Settings')).findOne();
      if (s && !s.setupComplete) { s.setupComplete = true; if (!s.companyName) s.companyName = process.env.APP_NAME || 'HCM Lite'; await s.save(); }
      console.log('Created admin from env');
    }
  }
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

if (require.main === module) { bootstrap().catch((e) => { console.error(e); process.exit(1); }); }
module.exports = app;
module.exports.bootstrap = bootstrap;
module.exports.connectDB = connectDB;
