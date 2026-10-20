const mongoose = require('mongoose');

function notFound(req, res) {
  res.status(404).json({ error: 'Route not found.' });
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  if (res.headersSent) return next(error);
  let status = error.status || 500;
  let message = error.message || 'Unexpected server error.';
  if (error instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = 'Some submitted data is invalid.';
  } else if (error.code === 11000) {
    status = 409;
    message = 'A record with that unique value already exists.';
  } else if (error.name === 'CastError') {
    status = 400;
    message = 'The requested identifier is invalid.';
  }
  if (process.env.NODE_ENV !== 'production') console.error(error);
  const response = { error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Server error. Please try again later.' : message };
  if (error.details && status < 500) response.details = error.details;
  res.status(status).json(response);
}

module.exports = { notFound, errorHandler };
