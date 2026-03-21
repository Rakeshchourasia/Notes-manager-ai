const User = require('../models/User');

/**
 * Seed a default admin user if none exists.
 * Called once on server startup.
 *
 * Default admin credentials:
 *   Email:    admin@noteai.com
 *   Password: admin123
 */
const seedAdmin = async () => {
    try {
        const adminExists = await User.findOne({ role: 'admin' });
        if (adminExists) return;

        await User.create({
            name: 'Admin',
            email: 'admin@noteai.com',
            password: 'admin123',
            role: 'admin',
        });
        console.log('✅ Default admin seeded: admin@noteai.com / admin123');
    } catch (err) {
        // Ignore duplicate key errors (race condition on cold start)
        if (err.code !== 11000) {
            console.error('⚠️ Admin seed error:', err.message);
        }
    }
};

module.exports = seedAdmin;
