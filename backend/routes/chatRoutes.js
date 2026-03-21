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
        const notes = await GeneratedNotes.findOne({ topicId });
        if (notes) {
            context = `Topic: ${notes.topicName}\n\nDefinition: ${notes.definition}\n\nExplanation: ${notes.explanation}\n\nKey Points: ${notes.importantPoints.join(', ')}`;
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

    const content = allNotes.map(n =>
        `Topic: ${n.topicName}\nDefinition: ${n.definition}\nPoints: ${n.importantPoints.join(', ')}`
    ).join('\n\n');

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
