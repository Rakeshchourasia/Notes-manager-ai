const multer = require('multer');
const path = require('path');

/**
 * Plain multer instance using memory storage.
 * The file lands in req.file.buffer (a Node.js Buffer).
 * We then manually call PutObjectCommand in the route handler,
 * giving us full control over the S3 request with no multer-s3 magic.
 *
 * Accepts PDF and TXT files up to 10 MB.
 */
const uploadToMemory = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'text/plain'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(file.mimetype) || ext === '.pdf' || ext === '.txt') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and TXT files are allowed'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

module.exports = uploadToMemory;
