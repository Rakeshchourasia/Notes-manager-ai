const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes — verify JWT token and attach user to request
 */
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        res.status(401);
        return next(new Error('Not authorized — no token provided'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) {
            res.status(401);
            return next(new Error('Not authorized — user not found'));
        }

        next();
    } catch (err) {
        res.status(401);
        return next(new Error('Not authorized — invalid token'));
    }
};

/**
 * Admin-only middleware — must be used after protect
 */
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        return next();
    }
    res.status(403);
    return next(new Error('Admin access required'));
};

module.exports = { protect, adminOnly };
