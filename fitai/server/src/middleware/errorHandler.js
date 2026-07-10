// Central error handler. Controllers should call next(err) rather than
// formatting their own error responses, so every error path looks the
// same to the frontend and gets logged in one place.
const logger = require('../utils/logger');

function errorHandler(err, req, res, _next) {
  // Multer size/shape violations carry a .code but no .status — without
  // this they'd be logged and returned as opaque 500s for a user mistake.
  if (err.name === 'MulterError') {
    err.status = 413;
    err.message = err.code === 'LIMIT_FILE_SIZE'
      ? 'That image is too large — please use a photo under 8MB.'
      : 'Could not accept that upload.';
  }
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
