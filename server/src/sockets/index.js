const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');

function cookieToken(header = '') {
  const row = header.split(';').map((part) => part.trim()).find((part) => part.startsWith('access_token='));
  if (!row) return null;
  try { return decodeURIComponent(row.slice('access_token='.length)); } catch { return null; }
}

function initSockets(httpServer, app) {
  const { Server } = require('socket.io');
  const allowed = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((value) => value.trim()).filter(Boolean);
  const isAllowedOrigin = (origin) => allowed.includes(origin) || /^https:\/\/\d+-[a-z0-9-]+\.e2b\.app$/i.test(origin || '');
  const io = new Server(httpServer, {
    cors: { origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)), credentials: true, methods: ['GET', 'POST'] },
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e5,
  });
  app.set('io', io);
  io.use(async (socket, next) => {
    try {
      const token = cookieToken(socket.handshake.headers.cookie || '');
      if (!token || !process.env.JWT_SECRET) return next(new Error('unauthorized'));
      const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'dbms-learning-portal', audience: 'dbms-learning-portal-users' });
      const user = await User.findById(payload.sub).select('_id role isActive name authVersion');
      if (!user || !user.isActive || user.role !== payload.role || Number(payload.av || 0) !== Number(user.authVersion || 0)) return next(new Error('unauthorized'));
      const session = await Session.findOne({ sessionId: payload.sid, studentId: user._id, endedAt: null }).select('_id');
      if (!session) return next(new Error('unauthorized'));
      socket.data.user = { id: String(user._id), role: user.role, name: user.name };
      socket.data.sessionId = payload.sid;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });
  io.on('connection', (socket) => {
    const { user, sessionId } = socket.data;
    if (user.role === 'admin') socket.join('admins');
    if (user.role === 'student') socket.join(`student:${user.id}`);
    let lastPulse = 0;
    socket.on('client:heartbeat', async () => {
      const nowMs = Date.now();
      if (nowMs - lastPulse < 5000) return;
      lastPulse = nowMs;
      const now = new Date(nowMs);
      const activeSession = await Session.updateOne({ sessionId, studentId: user.id, endedAt: null }, { $set: { lastHeartbeatAt: now } });
      if (activeSession.matchedCount !== 1) {
        socket.disconnect(true);
        return;
      }
      await User.updateOne({ _id: user.id, isActive: true }, { $set: { lastActive: now } });
      if (user.role === 'student') {
        const threshold = Math.max(30, Number(process.env.ONLINE_THRESHOLD_SECONDS) || 90);
        const onlineCount = await Session.distinct('studentId', { role: 'student', endedAt: null, lastHeartbeatAt: { $gte: new Date(nowMs - threshold * 1000) } }).then((ids) => ids.length);
        io.to('admins').emit('admin:presence', { onlineCount, studentId: user.id, lastHeartbeatAt: now });
      }
    });
    socket.on('disconnect', () => {
      if (user.role === 'student') io.to('admins').emit('admin:presence:stale', { studentId: user.id });
    });
  });
  return io;
}

module.exports = { initSockets };
