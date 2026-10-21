class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, _next) => {
  let statusCode = err.statusCode || 500;
  let message = err.isOperational ? err.message : 'Internal server error';

  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON in request body. Please send valid JSON.';
  }

  const rawMsg = String(err?.message || '');
  if (
    rawMsg.includes('EMAXCONN') ||
    rawMsg.includes('max client connections reached') ||
    rawMsg.includes('Connection pool timeout') ||
    rawMsg.includes('Error in connector') ||
    rawMsg.includes('Invalid `prisma.')
  ) {
    console.error('[Prisma/Database Connection Error]:', err);
    statusCode = 503;
    message = 'The system is experiencing unusually high traffic. Please retry in a few moments.';
  } else if (message === 'Internal server error') {
    console.error('Unhandled error:', err);
  }

  res.status(statusCode).json({ message, ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }) });
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { AppError, errorHandler, asyncHandler };
