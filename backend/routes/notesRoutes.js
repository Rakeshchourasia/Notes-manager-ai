const express = require('express');
const router = express.Router();
const GeneratedNotes = require('../models/GeneratedNotes');
const Topic = require('../models/Topic');
const Syllabus = require('../models/Syllabus');
const Quiz = require('../models/Quiz');
const { generateNotes, generateQuiz, translateNotes } = require('../services/aiService');
const { downloadAllNotesPDF } = require('../controllers/pdfController');

// POST /api/notes/generate/:topicId
router.post('/generate/:topicId', async (req, res) => {
    const topic = await Topic.findById(req.params.topicId);
    if (!topic) {
        res.status(404);
        throw new Error('Topic not found');
    }

    const syllabus = await Syllabus.findById(topic.syllabusId);
    const syllabusContext = syllabus ? syllabus.rawText : '';

    // Check if notes already exist
    const existing = await GeneratedNotes.findOne({ topicId: topic._id });
    if (existing) {
        return res.json({ success: true, data: existing, cached: true });
    }

    const notesData = await generateNotes(topic.name, syllabusContext);

    const notes = await GeneratedNotes.create({
        topicId: topic._id,
        syllabusId: topic.syllabusId,
        topicName: topic.name,
        definition: notesData.definition || '',
        explanation: notesData.explanation || '',
        keyTerms: notesData.keyTerms || [],
        examples: notesData.examples || [],
        importantPoints: notesData.importantPoints || [],
        summary: notesData.summary || '',
        mermaidDiagram: notesData.mermaidDiagram || '',
        importantQuestions: notesData.importantQuestions || [],
        realWorldApplications: notesData.realWorldApplications || [],
        flashcards: notesData.flashcards || [],
    });

    // Update topic
    topic.hasNotes = true;
    await topic.save();

    // Update syllabus counter
    if (syllabus) {
        syllabus.generatedTopics = (syllabus.generatedTopics || 0) + 1;
        await syllabus.save();
    }

    res.status(201).json({ success: true, data: notes });
});

// GET /api/notes/:topicId
router.get('/:topicId', async (req, res) => {
    const notes = await GeneratedNotes.findOne({ topicId: req.params.topicId });
    if (!notes) {
        res.status(404);
        throw new Error('Notes not found for this topic. Please generate them first.');
    }
    res.json({ success: true, data: notes });
});

// GET /api/notes/syllabus/:syllabusId (all notes for a syllabus)
router.get('/syllabus/:syllabusId', async (req, res) => {
    const notes = await GeneratedNotes.find({ syllabusId: req.params.syllabusId })
        .populate('topicId', 'name order');
    res.json({ success: true, data: notes });
});

// GET /api/notes/download/:syllabusId (download all notes as PDF)
router.get('/download/:syllabusId', downloadAllNotesPDF);

// POST /api/notes/generate-all/:syllabusId — batch generate notes for all topics
router.post('/generate-all/:syllabusId', async (req, res) => {
    const syllabus = await Syllabus.findById(req.params.syllabusId).populate('topics');
    if (!syllabus) {
        res.status(404);
        throw new Error('Syllabus not found');
    }

    const syllabusContext = syllabus.rawText;
    const results = [];
    let generated = 0;

    const MAX_BATCH = 4;
    let attempted = 0;

    for (const topic of syllabus.topics) {
        if (attempted >= MAX_BATCH) break; // prevent 3-min timeout
        
        // Skip topics that already have notes
        const existing = await GeneratedNotes.findOne({ topicId: topic._id });
        if (existing) {
            results.push({ topicId: topic._id, topicName: topic.name, status: 'cached' });
            continue;
        }

        attempted++;
        try {
            const notesData = await generateNotes(topic.name, syllabusContext);
            await GeneratedNotes.create({
                topicId: topic._id,
                syllabusId: syllabus._id,
                topicName: topic.name,
                definition: notesData.definition || '',
                explanation: notesData.explanation || '',
                keyTerms: notesData.keyTerms || [],
                examples: notesData.examples || [],
                importantPoints: notesData.importantPoints || [],
                summary: notesData.summary || '',
                mermaidDiagram: notesData.mermaidDiagram || '',
                importantQuestions: notesData.importantQuestions || [],
                realWorldApplications: notesData.realWorldApplications || [],
                flashcards: notesData.flashcards || [],
            });

            topic.hasNotes = true;
            await topic.save();
            generated++;
            results.push({ topicId: topic._id, topicName: topic.name, status: 'generated' });
        } catch (err) {
            results.push({ topicId: topic._id, topicName: topic.name, status: 'error', error: err.message });
        }
    }

    // Update syllabus counter
    syllabus.generatedTopics = (syllabus.generatedTopics || 0) + generated;
    await syllabus.save();

    const remaining = syllabus.topics.length - syllabus.topics.filter(t => t.hasNotes).length - generated;

    res.json({ 
        success: true, 
        generated, 
        total: syllabus.topics.length, 
        remaining: Math.max(0, remaining),
        results 
    });
});

// PUT /api/notes/regenerate/:topicId — regenerate notes (overwrites existing)
router.put('/regenerate/:topicId', async (req, res) => {
    const topic = await Topic.findById(req.params.topicId);
    if (!topic) {
        res.status(404);
        throw new Error('Topic not found');
    }

    const syllabus = await Syllabus.findById(topic.syllabusId);
    const syllabusContext = syllabus ? syllabus.rawText : '';

    const notesData = await generateNotes(topic.name, syllabusContext);

    const notes = await GeneratedNotes.findOneAndUpdate(
        { topicId: topic._id },
        {
            topicName: topic.name,
            definition: notesData.definition || '',
            explanation: notesData.explanation || '',
            keyTerms: notesData.keyTerms || [],
            examples: notesData.examples || [],
            importantPoints: notesData.importantPoints || [],
            summary: notesData.summary || '',
            mermaidDiagram: notesData.mermaidDiagram || '',
            importantQuestions: notesData.importantQuestions || [],
            realWorldApplications: notesData.realWorldApplications || [],
            flashcards: notesData.flashcards || [],
        },
        { upsert: true, new: true }
    );

    topic.hasNotes = true;
    await topic.save();

    res.json({ success: true, data: notes });
});
// POST /api/notes/quiz/:topicId - Generate or fetch quiz for a topic
router.post('/quiz/:topicId', async (req, res) => {
    const topicId = req.params.topicId;
    const existingQuiz = await Quiz.findOne({ topicId });
    if (existingQuiz) {
        return res.json({ success: true, data: existingQuiz, cached: true });
    }

    const topic = await Topic.findById(topicId);
    if (!topic) {
        res.status(404);
        throw new Error('Topic not found');
    }

    const notes = await GeneratedNotes.findOne({ topicId });
    if (!notes) {
        res.status(400);
        throw new Error('Notes must be generated before taking a quiz.');
    }

    const contentToQuiz = `
        Topic: ${topic.name}
        Definition: ${notes.definition}
        Explanation: ${notes.explanation}
        Important Points: ${notes.importantPoints.join(', ')}
        Summary: ${notes.summary}
    `;

    const quizQuestions = await generateQuiz(contentToQuiz);

    const newQuiz = await Quiz.findOneAndReplace(
        { topicId: topic._id },
        {
            topicId: topic._id,
            syllabusId: topic.syllabusId,
            questions: quizQuestions
        },
        { upsert: true, returnDocument: 'after' }
    );

    res.status(201).json({ success: true, data: newQuiz });
});

// GET /api/notes/quiz/:topicId
router.get('/quiz/:topicId', async (req, res) => {
    const quiz = await Quiz.findOne({ topicId: req.params.topicId });
    if (!quiz) {
        res.status(404);
        throw new Error('Quiz not found for this topic');
    }
    res.json({ success: true, data: quiz });
});

// POST /api/notes/translate/:topicId
router.post('/translate/:topicId', async (req, res) => {
    const { targetLanguage } = req.body;
    if (!targetLanguage) {
        res.status(400);
        throw new Error('Target language is required');
    }

    const notes = await GeneratedNotes.findOne({ topicId: req.params.topicId });
    if (!notes) {
        res.status(404);
        throw new Error('Notes not found for this topic');
    }

    const translatedData = await translateNotes(notes.toObject(), targetLanguage);
    res.json({ success: true, data: translatedData });
});

module.exports = router;
