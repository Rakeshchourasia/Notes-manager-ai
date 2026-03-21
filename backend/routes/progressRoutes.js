const express = require('express');
const router = express.Router();
const StudyProgress = require('../models/StudyProgress');

// GET /api/progress/:syllabusId
router.get('/:syllabusId', async (req, res) => {
    let progress = await StudyProgress.findOne({
        syllabusId: req.params.syllabusId,
        userId: req.user._id,
    });
    if (!progress) {
        progress = await StudyProgress.create({
            syllabusId: req.params.syllabusId,
            userId: req.user._id,
        });
    }
    res.json({ success: true, data: progress });
});

// PUT /api/progress/:syllabusId/complete/:topicId
router.put('/:syllabusId/complete/:topicId', async (req, res) => {
    const progress = await StudyProgress.findOneAndUpdate(
        { syllabusId: req.params.syllabusId, userId: req.user._id },
        {
            $addToSet: { completedTopics: req.params.topicId },
            lastAccessedTopic: req.params.topicId,
        },
        { upsert: true, new: true }
    );
    res.json({ success: true, data: progress });
});

// PUT /api/progress/:syllabusId/bookmark/:topicId
router.put('/:syllabusId/bookmark/:topicId', async (req, res) => {
    const progress = await StudyProgress.findOne({
        syllabusId: req.params.syllabusId, userId: req.user._id
    });

    const alreadyBookmarked = progress && progress.bookmarkedTopics.includes(req.params.topicId);

    const updated = await StudyProgress.findOneAndUpdate(
        { syllabusId: req.params.syllabusId, userId: req.user._id },
        alreadyBookmarked
            ? { $pull: { bookmarkedTopics: req.params.topicId } }
            : { $addToSet: { bookmarkedTopics: req.params.topicId } },
        { upsert: true, new: true }
    );
    res.json({ success: true, data: updated, bookmarked: !alreadyBookmarked });
});

// POST /api/progress/:syllabusId/quiz-score
router.post('/:syllabusId/quiz-score', async (req, res) => {
    const { topicId, score, total } = req.body;
    const progress = await StudyProgress.findOneAndUpdate(
        { syllabusId: req.params.syllabusId, userId: req.user._id },
        { $push: { quizScores: { topicId, score, total } } },
        { upsert: true, new: true }
    );
    res.json({ success: true, data: progress });
});

module.exports = router;
