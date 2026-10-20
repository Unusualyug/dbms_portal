const mongoose = require('mongoose');
const HttpError = require('../utils/httpError');

function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState !== 1) return next(new HttpError(503, 'Database is not connected. Configure MONGODB_URI and run the course seed script.'));
  next();
}
module.exports = requireDatabase;
