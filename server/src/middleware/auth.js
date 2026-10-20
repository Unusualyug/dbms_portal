const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const HttpError = require('../utils/httpError');

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.access_token;
    if (!token) throw new HttpError(401, 'Please sign in to continue.');
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new HttpError(503, 'Authentication is not configured on the server.');
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'dbms-learning-portal', audience: 'dbms-learning-portal-users' });
    const user = await User.findById(payload.sub).select('name email role studentId isActive totalPoints semester classSection createdAt lastLogin profilePhotoUrl authVersion');
    if (!user || !user.isActive || user.role !== payload.role) throw new HttpError(401, 'Your session is no longer valid.');
    if (Number(payload.av || 0) !== Number(user.authVersion || 0)) throw new HttpError(401, 'Your password changed. Please sign in again.');
    if (payload.sid) {
      const session = await Session.findOne({ sessionId: payload.sid, studentId: user._id, endedAt: null }).select('_id');
      if (!session) throw new HttpError(401, 'This session has ended. Please sign in again.');
    }
    req.user = user;
    req.sessionId = payload.sid || null;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      return next(new HttpError(401, 'Your session expired. Please sign in again.'));
    }
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission to access this resource.'));
    next();
  };
}

module.exports = { requireAuth, requireRole };
