const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
    topicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Topic',
        required: true,
        unique: true
    },
    syllabusId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Syllabus',
        required: true
    },
    questions: [
        {
            question: String,
            options: [String],
            correctIndex: Number,
            explanation: String
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('Quiz', quizSchema);
