/**
 * Rate limiting middleware for AI endpoints.
 * Uses a simple in-memory token bucket per IP.
 * For production, use express-rate-limit with a Redis store.
 */

const rateLimitStore = new Map();

const WINDOW_MS = 60 * 1000; // 1 minute
const CLEANUP_INTERVAL = 5 * 60 * 1000; // Clean up every 5 minutes

// Periodically clean expired entries
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore) {
        if (now - data.windowStart > WINDOW_MS * 2) {
            rateLimitStore.delete(key);
        }
    }
}, CLEANUP_INTERVAL);

/**
 * Create a rate limiter middleware
 * @param {number} maxRequests - Max requests per window
 * @param {number} windowMs - Window size in milliseconds (default: 1 minute)
 */
const createRateLimiter = (maxRequests = 20, windowMs = WINDOW_MS) => {
    return (req, res, next) => {
        const key = `${req.ip}:${req.baseUrl}`;
        const now = Date.now();

        let record = rateLimitStore.get(key);

        if (!record || now - record.windowStart > windowMs) {
            record = { count: 1, windowStart: now };
            rateLimitStore.set(key, record);
            return next();
        }

        record.count++;

        if (record.count > maxRequests) {
            const retryAfter = Math.ceil((windowMs - (now - record.windowStart)) / 1000);
            res.set('Retry-After', String(retryAfter));
            return res.status(429).json({
                error: 'Too many requests. Please slow down.',
                retryAfter,
            });
        }

        next();
    };
};

// Pre-configured limiters
const aiRateLimiter = createRateLimiter(10, 60 * 1000);    // 10 AI requests per minute
const generalRateLimiter = createRateLimiter(60, 60 * 1000); // 60 general requests per minute
const authRateLimiter = createRateLimiter(10, 60 * 1000);   // 10 auth attempts per minute

module.exports = { createRateLimiter, aiRateLimiter, generalRateLimiter, authRateLimiter };
