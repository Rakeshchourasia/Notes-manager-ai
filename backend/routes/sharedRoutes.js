const express = require('express');
const router = express.Router();
const Syllabus = require('../models/Syllabus');
const Topic = require('../models/Topic');
const GeneratedNotes = require('../models/GeneratedNotes');
const { downloadAllNotesPDF } = require('../controllers/pdfController');

// GET /api/shared/syllabus/:id
router.get('/syllabus/:id', async (req, res) => {
    try {
        const syllabus = await Syllabus.findById(req.params.id).populate('topics');
        if (!syllabus) {
            return res.status(404).json({ success: false, error: 'Syllabus not found' });
        }
        if (!syllabus.isPublic) {
            return res.status(403).json({ success: false, error: 'This syllabus is private' });
        }
        res.json({ success: true, data: syllabus });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/shared/notes/:topicId
router.get('/notes/:topicId', async (req, res) => {
    try {
        const topicId = req.params.topicId;
        const topic = await Topic.findById(topicId);
        if (!topic) {
            return res.status(404).json({ success: false, error: 'Topic not found' });
        }
        
        const syllabus = await Syllabus.findById(topic.syllabusId);
        if (!syllabus || !syllabus.isPublic) {
            return res.status(403).json({ success: false, error: 'This syllabus is private' });
        }

        const notes = await GeneratedNotes.findOne({ topicId });
        if (!notes) {
            return res.status(404).json({ success: false, error: 'Notes not found' });
        }
        
        res.json({ success: true, data: notes });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/shared/notes/download/:syllabusId
router.get('/notes/download/:syllabusId', downloadAllNotesPDF);

module.exports = router;
