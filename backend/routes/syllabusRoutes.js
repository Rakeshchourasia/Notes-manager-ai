const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Syllabus = require('../models/Syllabus');
const Topic = require('../models/Topic');
const { extractTextFromPDF } = require('../services/pdfParser');
const { extractTopics } = require('../services/aiService');

// Multer config — use absolute destination path
const uploadsDir = path.join(__dirname, '../uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        // Sanitize filename to avoid issues with spaces / special chars
        const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${safeName}`);
    },
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'text/plain'];
        // Some browsers send PDF as 'application/octet-stream' — check extension too
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(file.mimetype) || ext === '.pdf' || ext === '.txt') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and TXT files are allowed'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Helper: get absolute file path from multer file object (works with multer v1 & v2)
const getFilePath = (file) => {
    if (file.path && path.isAbsolute(file.path)) return file.path;
    if (file.destination && file.filename) return path.join(file.destination, file.filename);
    // fallback
    return path.join(uploadsDir, file.filename);
};

// POST /api/syllabus/upload
router.post('/upload', upload.single('syllabus'), async (req, res) => {
    const { title, pastedText, examDate } = req.body;

    let rawText = pastedText || '';
    let fileType = 'paste';
    let fileUrl = null;

    let pdfWarning = null; // warning to include in response if PDF extraction degraded

    if (req.file) {
        const filePath = getFilePath(req.file);
        fileType = (req.file.mimetype === 'application/pdf' ||
            path.extname(req.file.originalname).toLowerCase() === '.pdf') ? 'pdf' : 'text';
        fileUrl = `/uploads/${req.file.filename}`;

        if (fileType === 'pdf') {
            try {
                rawText = await extractTextFromPDF(filePath);
            } catch (parseErr) {
                console.warn('PDF extraction failed, using title as fallback context:', parseErr.message);
                // GRACEFUL FALLBACK: Use the title to generate topics instead of crashing.
                // This handles encrypted/encoded Hindi PDFs and Gemini quota issues.
                pdfWarning = 'Could not extract text from PDF — AI will generate topics based on your title.';
                rawText = `Subject/Syllabus: ${title || 'Unknown Subject'}\n` +
                    `Source: ${req.file.originalname}\n` +
                    `Please generate relevant academic topics for this subject.`;
            }
        } else {
            try {
                rawText = fs.readFileSync(filePath, 'utf-8');
            } catch (readErr) {
                try { fs.unlinkSync(filePath); } catch (_) { }
                res.status(400);
                throw new Error(`Failed to read text file: ${readErr.message}`);
            }
        }
    }

    if (!rawText || rawText.trim().length < 10) {
        res.status(400);
        throw new Error('Please provide a title and upload a file, or paste your syllabus text.');
    }

    const syllabus = await Syllabus.create({
        title: title || 'Untitled Syllabus',
        rawText,
        fileUrl,
        fileType,
        status: 'processing',
        userId: req.user._id,
        examDate: examDate ? new Date(examDate) : null,
    });

    // Extract topics using AI
    let topicsData = [];
    let aiError = null;
    try {
        topicsData = await extractTopics(rawText);
    } catch (err) {
        aiError = err.message;
        console.error('AI extraction failed, using text fallback:', err.message);
        const { extractTopicsFromText } = require('../services/pdfParser');
        topicsData = extractTopicsFromText(rawText);
    }

    if (!topicsData || topicsData.length === 0) {
        // Last resort: create numbered placeholder topics from the title
        // This happens when both AI and regex extraction fail (e.g. quota + encoded PDF)
        const subjectName = title || 'Main Subject';
        if (aiError) pdfWarning = (pdfWarning ? pdfWarning + ' ' : '') +
            'AI API error — placeholder topics created. Please check your API key and try again.';
        topicsData = Array.from({ length: 5 }, (_, i) => ({
            name: `${subjectName} — Topic ${i + 1}`,
            description: `Study topic ${i + 1} for ${subjectName}`,
            order: i + 1,
        }));
    }

    // Save topics
    // Save topics with robust key checking in case AI json has variations
    const savedTopics = await Promise.all(
        topicsData.map((t, i) => Topic.create({
            name: t.name || t.topicName || t.Topic || t.title || t['Topic Name'] || t.topic || `${title || 'Unknown Subject'} — Topic ${i + 1}`,
            syllabusId: syllabus._id,
            order: t.order || t.id || i + 1,
            description: t.description || t.desc || '',
        }))
    );

    syllabus.topics = savedTopics.map(t => t._id);
    syllabus.totalTopics = savedTopics.length;
    syllabus.status = 'completed';
    await syllabus.save();

    res.status(201).json({
        success: true,
        warning: pdfWarning || null,
        data: {
            ...syllabus.toObject(),
            topics: savedTopics,
        },
    });
});

// GET /api/syllabus
router.get('/', async (req, res) => {
    const syllabuses = await Syllabus.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .select('-rawText')
        .limit(50);
    res.json({ success: true, data: syllabuses });
});

// GET /api/syllabus/:id
router.get('/:id', async (req, res) => {
    const syllabus = await Syllabus.findById(req.params.id).populate('topics');
    if (!syllabus) {
        res.status(404);
        throw new Error('Syllabus not found');
    }
    res.json({ success: true, data: syllabus });
});

// PUT /api/syllabus/:id/public
router.put('/:id/public', async (req, res) => {
    const syllabus = await Syllabus.findById(req.params.id);
    if (!syllabus) {
        res.status(404);
        throw new Error('Syllabus not found');
    }
    if (syllabus.userId.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized to modify this syllabus');
    }
    syllabus.isPublic = !syllabus.isPublic;
    await syllabus.save();
    res.json({ success: true, isPublic: syllabus.isPublic });
});

// DELETE /api/syllabus/:id
router.delete('/:id', async (req, res) => {
    const syllabus = await Syllabus.findById(req.params.id);
    if (!syllabus) {
        res.status(404);
        throw new Error('Syllabus not found');
    }
    if (syllabus.userId.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('Not authorized to delete this syllabus');
    }
    await Topic.deleteMany({ syllabusId: syllabus._id });
    await syllabus.deleteOne();
    res.json({ success: true, message: 'Syllabus deleted' });
});

module.exports = router;
