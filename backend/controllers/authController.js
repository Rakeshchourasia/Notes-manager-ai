const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Generate JWT token
 */
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

/**
 * POST /api/auth/register
 * Register a new user
 */
const register = async (req, res) => {
    const { name, password } = req.body;
    const email = req.body.email?.trim()?.toLowerCase();

    if (!name || !email || !password) {
        res.status(400);
        throw new Error('Please provide name, email, and password');
    }

    if (password.length < 6) {
        res.status(400);
        throw new Error('Password must be at least 6 characters');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        res.status(400);
        throw new Error('A user with this email already exists');
    }

    const user = await User.create({ name, email, password });

    res.status(201).json({
        success: true,
        data: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        },
    });
};

/**
 * POST /api/auth/login
 * Login user and return JWT
 */
const login = async (req, res) => {
    const { password } = req.body;
    const email = req.body.email?.trim()?.toLowerCase();

    if (!email || !password) {
        res.status(400);
        throw new Error('Please provide email and password');
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
        res.status(401);
        throw new Error('Invalid email or password');
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
        res.status(401);
        throw new Error('Invalid email or password');
    }

    res.json({
        success: true,
        data: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: generateToken(user._id),
        },
    });
};

/**
 * GET /api/auth/me
 * Get current logged-in user profile
 */
const getMe = async (req, res) => {
    const user = await User.findById(req.user._id);
    res.json({
        success: true,
        data: {
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        },
    });
};

module.exports = { register, login, getMe };
