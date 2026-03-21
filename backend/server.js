const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const seedAdmin = require('./config/seedAdmin');
const { errorHandler } = require('./middleware/errorHandler');
const { protect } = require('./middleware/auth');
const { generalRateLimiter, aiRateLimiter, authRateLimiter } = require('./middleware/rateLimiter');

// Load env vars
dotenv.config();

const app = express();

// Connect to MongoDB
connectDB().then(() => seedAdmin());

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRateLimiter, require('./routes/authRoutes'));
app.use('/api/syllabus', generalRateLimiter, protect, require('./routes/syllabusRoutes'));
app.use('/api/notes', aiRateLimiter, protect, require('./routes/notesRoutes'));
app.use('/api/progress', generalRateLimiter, protect, require('./routes/progressRoutes'));
app.use('/api/chat', aiRateLimiter, protect, require('./routes/chatRoutes'));
app.use('/api/shared', generalRateLimiter, require('./routes/sharedRoutes'));
app.use('/api/search', generalRateLimiter, protect, require('./routes/searchRoutes'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 API: http://localhost:${PORT}/api`);
});
