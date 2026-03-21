const mongoose = require('mongoose');

const syllabusSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    rawText: { type: String, required: true },
    fileUrl: { type: String },
    fileType: { type: String, enum: ['pdf', 'text', 'paste'], default: 'text' },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'error'], default: 'pending' },
    topics: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }],
    userId: { type: String, default: 'guest' },
    totalTopics: { type: Number, default: 0 },
    generatedTopics: {
        type: Number,
        default: 0
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    examDate: {
        type: Date,
        default: null
    }
}, { timestamps: true });

syllabusSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Syllabus', syllabusSchema);
