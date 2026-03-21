const path = require('path');
const Syllabus = require('../models/Syllabus');
const Topic = require('../models/Topic');
const GeneratedNotes = require('../models/GeneratedNotes');
const PDFDocument = require('pdfkit');

/**
 * GET /api/notes/download/:syllabusId
 * Generate and download a single PDF containing all generated notes for a syllabus.
 */
const downloadAllNotesPDF = async (req, res) => {
    try {
        const { syllabusId } = req.params;

        // Fetch syllabus
        const syllabus = await Syllabus.findById(syllabusId);
        if (!syllabus) {
            return res.status(404).json({ success: false, error: 'Syllabus not found' });
        }

        // Check public access if unauthenticated
        if (!req.user && !syllabus.isPublic) {
            return res.status(403).json({ success: false, error: 'This syllabus is private' });
        }

        // Fetch topics and their corresponding notes
        const topics = await Topic.find({ syllabusId }).sort({ order: 1 });
        const generatedNotes = await GeneratedNotes.find({ syllabusId });

        if (!generatedNotes || generatedNotes.length === 0) {
            return res.status(400).json({ success: false, error: 'No notes generated yet for this syllabus.' });
        }

        // Initialize PDF Document
        const safeTitle = syllabus.title.replace(/[^a-zA-Z0-9.-]/g, '_');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_Notes.pdf"`);

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        doc.pipe(res);

        // Title Page
        doc.fontSize(28).font('Helvetica-Bold').text(syllabus.title, { align: 'center', underline: true });
        doc.moveDown(1);
        doc.fontSize(14).font('Helvetica').text('AI Generated Study Notes', { align: 'center', color: '#6366f1' });
        
        const timestamp = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#64748b').text(`Exported on: ${timestamp}`, { align: 'center' });
        doc.moveDown(3);

        // Table of Contents
        doc.fontSize(18).fillColor('black').font('Helvetica-Bold').text('Table of Contents');
        doc.moveDown(0.5);
        
        let validTopicsCount = 0;
        for (const topic of topics) {
            const topicNotes = generatedNotes.find(n => n.topicId.toString() === topic._id.toString());
            if (topicNotes) {
                validTopicsCount++;
                doc.fontSize(12).font('Helvetica').text(`${validTopicsCount}. ${topic.name}`);
            }
        }

        if (validTopicsCount === 0) {
            doc.end();
            return;
        }

        // Loop through each topic and add its notes
        let topicIndex = 1;
        for (const topic of topics) {
            const notes = generatedNotes.find(n => n.topicId.toString() === topic._id.toString());
            if (!notes) continue; // Skip if no notes generated for this topic yet

            doc.addPage();
            
            // Topic Header
            doc.fontSize(22).font('Helvetica-Bold').fillColor('#4f46e5').text(`${topicIndex}. ${topic.name}`);
            doc.moveDown(1);
            topicIndex++;

            const addSection = (title, content, isList = false) => {
                if (!content || (Array.isArray(content) && content.length === 0)) return;
                
                doc.fontSize(16).fillColor('#1e293b').font('Helvetica-Bold').text(title);
                doc.moveDown(0.5);
                
                doc.fontSize(12).fillColor('#334155').font('Helvetica');
                if (isList) {
                    content.forEach(item => {
                        doc.text(`• ${item}`, { indent: 15, align: 'justify', lineGap: 3 });
                    });
                } else {
                    doc.text(content, { align: 'justify', lineGap: 3 });
                }
                doc.moveDown(1.5);
            };

            // Definition & Explanation
            addSection('Definition', notes.definition);
            addSection('Explanation', notes.explanation);

            // Key Terms
            if (notes.keyTerms && notes.keyTerms.length > 0) {
                doc.fontSize(16).fillColor('#1e293b').font('Helvetica-Bold').text('Key Terminology');
                doc.moveDown(0.5);
                notes.keyTerms.forEach(term => {
                    doc.fontSize(12).fillColor('#0f172a').font('Helvetica-Bold').text(`${term.term}:`, { continued: true });
                    doc.fillColor('#334155').font('Helvetica').text(` ${term.definition}`, { indent: 15, lineGap: 3 });
                });
                doc.moveDown(1.5);
            }

            // Examples
            if (notes.examples && notes.examples.length > 0) {
                doc.fontSize(16).fillColor('#1e293b').font('Helvetica-Bold').text('Examples');
                doc.moveDown(0.5);
                notes.examples.forEach(ex => {
                    doc.fontSize(12).fillColor('#0f172a').font('Helvetica-Bold').text(ex.title);
                    doc.fillColor('#334155').font('Helvetica').text(ex.content, { lineGap: 3, indent: 15 });
                    doc.moveDown(0.5);
                });
                doc.moveDown(1);
            }

            addSection('Important Points', notes.importantPoints, true);
            addSection('Real-world Applications', notes.realWorldApplications, true);
            addSection('Important Questions', notes.importantQuestions, true);

            // Flashcards
            if (notes.flashcards && notes.flashcards.length > 0) {
                doc.fontSize(16).fillColor('#1e293b').font('Helvetica-Bold').text('Flashcards');
                doc.moveDown(0.5);
                notes.flashcards.forEach(card => {
                    doc.fontSize(12).fillColor('#6366f1').font('Helvetica-Bold').text(`Q: ${card.question}`);
                    doc.fillColor('#334155').font('Helvetica').text(`A: ${card.answer}`, { lineGap: 3 });
                    doc.moveDown(0.5);
                });
                doc.moveDown(1);
            }
            
            addSection('Summary', notes.summary);
        }

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Failed to generate PDF' });
        }
    }
};

module.exports = { downloadAllNotesPDF };
