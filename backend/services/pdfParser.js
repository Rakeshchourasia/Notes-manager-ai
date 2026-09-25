const pdf = require('pdf-parse');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { PDFExtract } = require('pdf.js-extract');

/**
 * Sleep helper for retry backoff
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extract text from a PDF.
 *
 * @param {string|Buffer} filePathOrBuffer  — absolute file path OR a Buffer containing PDF bytes
 *
 * Strategy:
 *  1. pdf-parse  — fast, works for standard Unicode/English PDFs
 *  2. pdf.js-extract — highly robust, parses structural XRef correctly
 */
const extractTextFromPDF = async (filePathOrBuffer) => {
    // Normalise: always work with a Buffer for pdf-parse
    const isBuffer = Buffer.isBuffer(filePathOrBuffer);
    const filePath = isBuffer ? null : filePathOrBuffer;

    // --- Attempt 1: pdf-parse ---
    let extractedText = '';
    try {
        const dataBuffer = isBuffer ? filePathOrBuffer : fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        if (data && data.text) {
            // Remove null bytes, keep actual content
            const cleaned = data.text.replace(/\0/g, '').replace(/\s+/g, ' ').trim();
            if (cleaned.length > 30) {
                extractedText = data.text; // keep original whitespace for structure
            }
        }
    } catch (pdfErr) {
        console.warn('[pdfParser] pdf-parse failed:', pdfErr.message, 'falling back to pdf.js-extract');
    }

    // --- Attempt 2: pdf.js-extract fallback ---
    if (!extractedText) {
        // pdf.js-extract only accepts file paths; write a temp file if we have a Buffer
        let tempPath = null;
        try {
            if (isBuffer) {
                tempPath = path.join(os.tmpdir(), `pdf_tmp_${Date.now()}.pdf`);
                fs.writeFileSync(tempPath, filePathOrBuffer);
            }

            const extractPath = tempPath || filePath;
            const pdfExtract = new PDFExtract();
            const data = await pdfExtract.extract(extractPath, { disableWorker: true, disableFontFace: true });
            if (data && data.pages) {
                let text = '';
                data.pages.forEach(page => {
                    page.content.forEach(c => text += c.str + ' ');
                    text += '\n'; // Soft line breaks between pages
                });

                const cleaned = text.replace(/\0/g, '').replace(/\s+/g, ' ').trim();
                if (cleaned.length > 30) {
                    extractedText = text;
                }
            }
        } catch (extractErr) {
            console.warn('[pdfParser] pdf.js-extract failed:', extractErr.message);
        } finally {
            if (tempPath) { try { fs.unlinkSync(tempPath); } catch (_) {} }
        }
    }

    if (extractedText) {
        return extractedText;
    }

    throw new Error(
        'The PDF appears to contain no extractable text or is a scanned image. ' +
        'Please use the "Paste Text" tab and type/paste your syllabus text manually.'
    );
};

const extractTopicsFromText = (text) => {
    // Basic fallback topic extraction from plain text using regex patterns or standard lines
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5 && l.length < 150);
    const topics = [];

    const headingPatterns = [
        /^(unit|chapter|module|topic|section|इकाई|अध्याय)\s*[\d:.]+\s*[-:]?\s*(.+)/i,
        /^[\d]+[.)]\s+(.+)/,
        /^[A-Z][A-Z\s\-']{3,60}$/,
    ];

    lines.forEach((line) => {
        for (const pattern of headingPatterns) {
            const match = line.match(pattern);
            if (match) {
                const name = (match[2] || match[1] || match[0]).trim();
                topics.push({ name, description: '', order: topics.length + 1 });
                break;
            }
        }
    });

    // If strict patterns failed to find anything, fallback to first unique meaningful lines
    if (topics.length === 0) {
        const uniqueLines = [...new Set(lines)].filter(l => !l.toLowerCase().includes('syllabus') && !l.toLowerCase().includes('source:'));
        uniqueLines.slice(0, 15).forEach((line, i) => {
             // clean up starting dashes
             const cleanLine = line.replace(/^[-*•>]\s*/, '').trim();
             topics.push({ name: cleanLine, description: '', order: i + 1 });
        });
    }

    return topics.slice(0, 20);
};

module.exports = { extractTextFromPDF, extractTopicsFromText };
