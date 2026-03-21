const mongoose = require('mongoose');

const generatedNotesSchema = new mongoose.Schema({
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true, unique: true },
    syllabusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Syllabus', required: true },
    topicName: { type: String, required: true },
    definition: { type: String },
    explanation: { type: String },
    keyTerms: [{ term: String, definition: String }],
    examples: [{ title: String, content: String }],
    importantPoints: [String],
    summary: { type: String },
    mermaidDiagram: { type: String },
    markdownContent: { type: String },
    importantQuestions: [String],
    realWorldApplications: [String],
    flashcards: [{ question: String, answer: String }],
}, { timestamps: true });

generatedNotesSchema.index({ syllabusId: 1 });

module.exports = mongoose.model('GeneratedNotes', generatedNotesSchema);
