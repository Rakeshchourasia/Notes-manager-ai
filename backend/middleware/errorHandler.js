const errorHandler = (err, req, res, next) => {
    // Default to 500 if status code hasn't been set
    const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;

    console.error(`❌ [${req.method} ${req.originalUrl}] ${err.message}`);

    res.status(statusCode).json({
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

/**
 * Wrap async route handlers to catch errors automatically.
 * Can be used as a lighter alternative to express-async-handler.
 */
const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { errorHandler, asyncHandler };
