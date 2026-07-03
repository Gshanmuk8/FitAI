// Central error handler. Controllers should call next(err) rather than
// formatting their own error responses, so every error path looks the
// same to the frontend and gets logged in one place.
const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  logger.error(`${req.method} ${req.path} failed`, {
    requestId: req.id,
    status,
    error: err.message,
    stack: status === 500 ? err.stack : undefined, // full stack only for unexpected errors
  });

  const message = status === 500 ? 'Internal server error' : err.message;

  res.status(status).json({
    error: message,
    requestId: req.id,
  });
}

module.exports = { errorHandler };
