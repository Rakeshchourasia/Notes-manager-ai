const express = require('express');
const router = express.Router();
const GeneratedNotes = require('../models/GeneratedNotes');
const { chatWithAI, generateQuiz, generateFlashcards } = require('../services/aiService');

// POST /api/chat
router.post('/', async (req, res) => {
    const { question, topicId, syllabusContext, history } = req.body;

    if (!question || question.trim().length === 0) {
        res.status(400);
        throw new Error('Question is required');
    }

    let context = syllabusContext || '';
    if (topicId) {
        const notes = await GeneratedNotes.findOne({ topicId })
            // FIX Bug 4: only fetch the fields we actually need — excludes 'explanation'
            // which can be 1000+ chars and is not needed for focused chat answers
            .select('topicName definition importantPoints');
        if (notes) {
            context = `Topic: ${notes.topicName}\nDefinition: ${notes.definition}\nKey Points: ${notes.importantPoints.join(', ')}`;
        }
    }

    const answer = await chatWithAI(question, context, history || []);
    res.json({ success: true, answer });
});

// POST /api/chat/quiz/:syllabusId
router.post('/quiz/:syllabusId', async (req, res) => {
    const allNotes = await GeneratedNotes.find({ syllabusId: req.params.syllabusId })
        .select('topicName definition importantPoints summary');

    if (!allNotes.length) {
        res.status(400);
        throw new Error('No notes found. Please generate notes first.');
    }

    // FIX Bug 5: cap total quiz content at 5000 chars to prevent runaway token usage
    // when a syllabus has many topics (was unlimited — could easily hit 20000+ chars)
    let content = allNotes.map(n =>
        `Topic: ${n.topicName}\nDefinition: ${n.definition}\nPoints: ${n.importantPoints.join(', ')}`
    ).join('\n\n');
    content = content.substring(0, 5000);

    const quiz = await generateQuiz(content);
    res.json({ success: true, data: quiz });
});

// POST /api/chat/flashcards/:topicId
router.post('/flashcards/:topicId', async (req, res) => {
    const notes = await GeneratedNotes.findOne({ topicId: req.params.topicId });
    if (!notes) {
        res.status(400);
        throw new Error('Notes not found. Generate notes first.');
    }

    const content = `Topic: ${notes.topicName}\nDefinition: ${notes.definition}\nExplanation: ${notes.explanation}\nKey Points: ${notes.importantPoints.join(', ')}`;
    const flashcards = await generateFlashcards(notes.topicName, content);

    // Store flashcards in the notes document
    notes.flashcards = flashcards;
    await notes.save();

    res.json({ success: true, data: flashcards });
});

module.exports = router;
