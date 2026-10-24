const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { HttpError } = require('./error');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'Authentication required'));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('-passwordHash');
    if (!user || !user.active) return next(new HttpError(401, 'Invalid session'));
    req.user = user;
    next();
  } catch (e) {
    next(new HttpError(401, 'Invalid or expired token'));
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new HttpError(403, 'Forbidden'));
    next();
  };
}

module.exports = { requireAuth, requireRole };
