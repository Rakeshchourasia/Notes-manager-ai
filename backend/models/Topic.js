const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    syllabusId: { type: mongoose.Schema.Types.ObjectId, ref: 'Syllabus', required: true },
    order: { type: Number, default: 0 },
    description: { type: String },
    hasNotes: { type: Boolean, default: false },
}, { timestamps: true });

topicSchema.index({ syllabusId: 1, order: 1 });

module.exports = mongoose.model('Topic', topicSchema);
