const mongoose = require('mongoose');

const studyProgressSchema = new mongoose.Schema({
    userId: { type: String, default: 'guest' },
    syllabusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Syllabus', required: true },
    completedTopics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
    bookmarkedTopics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
    quizScores: [{
        topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
        score: Number,
        total: Number,
        attemptedAt: { type: Date, default: Date.now },
    }],
    lastAccessedTopic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
}, { timestamps: true });

studyProgressSchema.index({ userId: 1, syllabusId: 1 }, { unique: true });

module.exports = mongoose.model('StudyProgress', studyProgressSchema);
