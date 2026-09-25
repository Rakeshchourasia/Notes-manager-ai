const express = require('express');
const router = express.Router();
const Syllabus = require('../models/Syllabus');
const Topic = require('../models/Topic');
const { extractTextFromPDF } = require('../services/pdfParser');
const { extractTopics } = require('../services/aiService');
const uploadToMemory = require('../middleware/s3Upload');
const { uploadToS3, deleteFromS3, getS3Url } = require('../services/s3Service');

// POST /api/syllabus/upload
router.post('/upload', uploadToMemory.single('syllabus'), async (req, res) => {
    const { title, examDate } = req.body;

    // Sanitize pasted text: strip HTML tags and limit length
    let rawText = (req.body.pastedText || '').replace(/<[^>]*>/g, '').trim().substring(0, 50000);
    let fileType = 'paste';
    let fileUrl = null;
    let s3Key = null;

    let pdfWarning = null;

    if (req.file) {
        // req.file.buffer contains the full file (multer.memoryStorage)
        const fileBuffer = req.file.buffer;
        const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
        s3Key = `uploads/${Date.now()}-${safeName}`;

        fileType = (req.file.mimetype === 'application/pdf' ||
            req.file.originalname.toLowerCase().endsWith('.pdf')) ? 'pdf' : 'text';

        if (fileType === 'pdf') {
            // Step 1: Upload the PDF to S3 first
            try {
                await uploadToS3(fileBuffer, s3Key, req.file.mimetype);
                console.log(`[S3] Uploaded: ${s3Key}`);
            } catch (uploadErr) {
                // If S3 upload fails, log it and try to parse directly from the buffer in memory
                console.warn('[S3] Upload failed, parsing from memory buffer directly:', uploadErr.message);
                s3Key = null; // nothing to delete later
            }

            // Step 2: Parse text — directly from the in-memory buffer (no need to download back from S3)
            try {
                rawText = await extractTextFromPDF(fileBuffer);
            } catch (parseErr) {
                console.warn('PDF extraction failed, using title as fallback context:', parseErr.message);
                pdfWarning = 'Could not extract text from PDF — AI will generate topics based on your title.';
                rawText = `Subject/Syllabus: ${title || 'Unknown Subject'}\n` +
                    `Source: ${req.file.originalname}\n` +
                    `Please generate relevant academic topics for this subject.`;
            } finally {
                // Delete from S3 — we already have the text, no need to keep the raw PDF
                if (s3Key) {
                    try { await deleteFromS3(s3Key); } catch (_) {}
                }
                fileUrl = null; // PDF no longer lives in S3
            }
        } else {
            // TXT file: read directly from buffer — no S3 upload needed
            rawText = fileBuffer.toString('utf-8').substring(0, 50000);
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
        const subjectName = title || 'Main Subject';
        if (aiError) pdfWarning = (pdfWarning ? pdfWarning + ' ' : '') +
            'AI API error — placeholder topics created. Please check your API key and try again.';
        topicsData = Array.from({ length: 5 }, (_, i) => ({
            name: `${subjectName} — Topic ${i + 1}`,
            description: `Study topic ${i + 1} for ${subjectName}`,
            order: i + 1,
        }));
    }

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
