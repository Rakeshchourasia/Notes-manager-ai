const express = require('express');
const router = express.Router();
const Syllabus = require('../models/Syllabus');
const Topic = require('../models/Topic');
const GeneratedNotes = require('../models/GeneratedNotes');

// GET /api/search?q=<query>
router.get('/', async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
        return res.json({ success: true, results: [] });
    }

    const userId = req.user._id;
    const regex = new RegExp(q, 'i');

    // Search syllabuses owned by or shared with user
    const syllabuses = await Syllabus.find({
        $or: [{ userId }, { isPublic: true }],
        title: regex,
    })
        .select('_id title status isPublic createdAt')
        .limit(10)
        .lean();

    // Search topics within user's syllabuses
    const userSyllabusIds = (
        await Syllabus.find({ userId }).select('_id').lean()
    ).map((s) => s._id);

    const topics = await Topic.find({
        syllabusId: { $in: userSyllabusIds },
        name: regex,
    })
        .select('_id name syllabusId')
        .limit(10)
        .lean();

    // Search generated notes content (definition / summary)
    const notes = await GeneratedNotes.find({
        topicId: {
            $in: (
                await Topic.find({ syllabusId: { $in: userSyllabusIds } }).select('_id').lean()
            ).map((t) => t._id),
        },
        $or: [{ definition: regex }, { summary: regex }],
    })
        .select('_id topicId definition')
        .limit(5)
        .lean();

    // Enrich topic results with syllabusId so frontend can navigate
    const results = [
        ...syllabuses.map((s) => ({
            type: 'syllabus',
            id: s._id,
            title: s.title,
            subtitle: `Syllabus · ${s.status}`,
            url: `/notes/${s._id}`,
        })),
        ...topics.map((t) => ({
            type: 'topic',
            id: t._id,
            title: t.name,
            subtitle: 'Topic',
            url: `/notes/${t.syllabusId}?topic=${t._id}`,
        })),
        ...notes.map((n) => ({
            type: 'note',
            id: n._id,
            title: n.definition ? n.definition.slice(0, 80) + '…' : 'Note snippet',
            subtitle: 'Inside notes',
            url: `/notes/${n.topicId}`,
        })),
    ];

    res.json({ success: true, results });
});

module.exports = router;
