const { OpenAI } = require('openai');

// Initialize OpenAI-compatible client (works with Groq, xAI, OpenAI, etc.)
const openai = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1',
});

// Default model
const TEXT_MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';

/**
 * Sleep helper for retry backoff
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Clean AI response text and extract JSON
 */
const extractJSON = (text, type = 'object') => {
  let cleaned = text.trim();
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  // Try direct parse first
  const bracket = type === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const jsonMatch = cleaned.match(bracket);
  if (!jsonMatch) throw new Error(`AI returned invalid JSON ${type}. Please try again.`);

  let raw = jsonMatch[0];

  // Try parsing as-is
  try { return JSON.parse(raw); } catch (e) { /* continue to cleaning */ }

  // Clean common AI JSON mistakes:
  // 1. Replace smart/curly quotes with straight quotes
  raw = raw.replace(/[\u201C\u201D\u201E]/g, '"').replace(/[\u2018\u2019\u201A]/g, "'");
  // 2. Remove trailing commas before } or ]
  raw = raw.replace(/,\s*([}\]])/g, '$1');
  // 3. Remove control characters
  raw = raw.replace(/[\x00-\x1F\x7F]/g, (c) => c === '\n' || c === '\t' ? c : '');
  // 4. Fix unescaped newlines inside string values
  raw = raw.replace(/(["'])([^"']*?)\n([^"']*?)\1/g, (m, q, a, b) => `${q}${a} ${b}${q}`);

  try { return JSON.parse(raw); } catch (e) { /* continue */ }

  // 5. Last resort: try to fix unescaped colons/quotes in values by re-extracting key-value pairs
  //    Remove everything that's not valid JSON structure
  raw = raw.replace(/:\s*"([^"]*?)"\s*:/g, (match, val) => {
    // If there's a colon inside a value followed by another colon, the value has an unescaped colon
    return `: "${val}" :`;
  });

  try { return JSON.parse(raw); } catch (e) {
    throw new Error(`AI returned malformed JSON. Retrying may help. Parse error: ${e.message.substring(0, 100)}`);
  }
};

/**
 * Common completion wrapper with retry and exponential backoff
 */
const getCompletion = async (systemPrompt, userPrompt, retries = 3) => {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: TEXT_MODEL,
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      });
      return response.choices[0].message.content;
    } catch (err) {
      lastError = err;
      console.warn(`[aiService] Attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt < retries) {
        const waitMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await sleep(waitMs);
      }
    }
  }

  throw new Error(`AI request failed after ${retries} attempts: ${lastError?.message}`);
};

/**
 * Extract topics from raw syllabus text
 */
const extractTopics = async (syllabusText) => {
  const systemPrompt = `You are an expert academic syllabus analyzer.
Your ONLY output should be a valid JSON array of objects. Do not include markdown formatting or explanations.`;

  const userPrompt = `Given the following syllabus text, extract all the main topics/chapters/units.
Return ONLY a valid JSON array of objects in this exact format:
[
  {"name": "Topic Name", "description": "1-2 sentence description", "order": 1}
]

Extract 5-20 meaningful, distinct topics.

Syllabus Text:
${syllabusText.substring(0, 12000)}

Return ONLY the JSON array. No markdown, no explanation.`;

  const text = await getCompletion(systemPrompt, userPrompt);
  return extractJSON(text, 'array');
};

/**
 * Clean and validate a mermaid diagram string from AI output
 */
const cleanMermaidDiagram = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  let diagram = raw.trim();

  // Strip markdown code fences
  diagram = diagram.replace(/^```(?:mermaid)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  // Replace literal \n strings with real newlines
  diagram = diagram.replace(/\\n/g, '\n');

  // Validate it starts with a known mermaid keyword
  const validStarts = ['graph ', 'graph\n', 'flowchart ', 'flowchart\n', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'pie', 'mindmap', 'timeline'];
  const hasValidStart = validStarts.some(s => diagram.toLowerCase().startsWith(s.toLowerCase()));
  if (!hasValidStart) return '';

  return diagram;
};

const generateNotes = async (topicName, syllabusContext) => {
  const systemPrompt = `You are an expert academic tutor and notes writer.
Your ONLY output should be a valid JSON object. Do not include markdown formatting or explanations.

IMPORTANT for the mermaidDiagram field:
- Use REAL newline characters inside the JSON string (the JSON will have \\\\n escape sequences naturally)
- Do NOT wrap the mermaid code in markdown fences
- Use simple node labels without special characters like parentheses or brackets in text
- Keep the diagram simple with 4-8 nodes maximum`;

  const userPrompt = `Generate comprehensive study notes for: "${topicName}"
Context: "${syllabusContext ? syllabusContext.substring(0, 12000) : ''}"

Return ONLY a valid JSON object:
{
  "definition": "1-2 sentence definition",
  "explanation": "3-5 paragraph explanation for students",
  "keyTerms": [{"term": "Term", "definition": "Definition"}],
  "examples": [{"title": "Title", "content": "Explanation"}],
  "importantPoints": ["Point 1", "Point 2"],
  "summary": "3-5 sentence summary for quick revision",
  "mermaidDiagram": "graph TD\\nA[Main Topic] --> B[Subtopic 1]\\nA --> C[Subtopic 2]\\nB --> D[Detail 1]\\nC --> E[Detail 2]",
  "importantQuestions": ["Question 1?", "Question 2?"],
  "realWorldApplications": ["Application 1", "Application 2"],
  "flashcards": [{"question": "What is X?", "answer": "X is..."}]
}

Rules: keyTerms(4-6), examples(2-3), importantPoints(5-8), importantQuestions(3-5), realWorldApplications(2-3), flashcards(5-8).
The mermaidDiagram must be valid Mermaid.js syntax starting with "graph TD" or "flowchart TD".
Return ONLY the JSON object. No markdown, no explanation.`;

  const text = await getCompletion(systemPrompt, userPrompt);
  const result = extractJSON(text, 'object');

  // Clean up the mermaid diagram
  if (result.mermaidDiagram) {
    result.mermaidDiagram = cleanMermaidDiagram(result.mermaidDiagram);
  }

  return result;
};

/**
 * Chat with AI about a topic
 */
const chatWithAI = async (question, context, history = []) => {
  const systemPrompt = `You are a helpful AI study assistant for students. Provide direct, helpful answers. You have access to the conversation history below to maintain context across questions.${context ? `\n\nStudy Context:\n${context.substring(0, 2000)}` : ''}`;

  // Build messages array: system + history + new question
  const historyMessages = (history || []).slice(-6).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const response = await openai.chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0.7,
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: `${question}\n\nGive a clear, student-friendly answer in 150-300 words with examples where helpful.` },
    ],
  });
  return response.choices[0].message.content;
};

/**
 * Generate quiz questions from notes
 */
const generateQuiz = async (topicsContent) => {
  const systemPrompt = `You are an expert academic quiz creator. Your ONLY output should be a valid JSON array.`;
  const userPrompt = `Content:
${topicsContent.substring(0, 5000)}

Generate 10 multiple-choice questions based on the content. Return ONLY a JSON array:
[
  {
    "question": "Question?",
    "options": ["A", "B", "C", "D"],
    "correctIndex": 0,
    "explanation": "Why this is correct"
  }
]

Return ONLY the JSON array. No markdown.`;

  const text = await getCompletion(systemPrompt, userPrompt);
  return extractJSON(text, 'array');
};

/**
 * Generate flashcards for a topic
 */
const generateFlashcards = async (topicName, notesContent) => {
  const systemPrompt = `You are an expert flashcard creator. Your ONLY output should be a valid JSON array.`;
  const userPrompt = `Topic: ${topicName}
Content:
${notesContent.substring(0, 4000)}

Generate 8-12 study flashcards. Return ONLY a JSON array:
[
  {"question": "What is X?", "answer": "X is a concept that..."}
]

Each flashcard should test a different key concept. Keep answers concise (1-3 sentences).
Return ONLY the JSON array. No markdown.`;

  const text = await getCompletion(systemPrompt, userPrompt);
  return extractJSON(text, 'array');
};

/**
 * Summarize a topic for quick revision
 */
const summarizeTopic = async (topicName, notesContent) => {
  const systemPrompt = `You are an expert academic summarizer.`;
  const userPrompt = `Topic: ${topicName}
Full notes: ${notesContent.substring(0, 4000)}

Create a concise 5-7 bullet point quick revision summary. Use simple language a student can quickly scan before an exam. Return plain text, not JSON.`;

  return await getCompletion(systemPrompt, userPrompt);
};

/**
 * Translate notes object to target language
 */
const translateNotes = async (notesObj, targetLanguage) => {
  const systemPrompt = `You are an expert technical translator. Translate the provided JSON data into ${targetLanguage} while preserving exactly the same JSON structure and keys. Only modify the string values. DO NOT translate keys.`;
  
  // Filter out mongo fields
  const { _id, topicId, syllabusId, topicName, createdAt, updatedAt, __v, ...contentToTranslate } = notesObj;
  
  const userPrompt = `Target Language: ${targetLanguage}\n\nStrictly return ONLY a valid JSON object matching the input structure, but with values translated:\n\n${JSON.stringify(contentToTranslate, null, 2)}`;
  
  const text = await getCompletion(systemPrompt, userPrompt);
  return extractJSON(text, 'object');
};

module.exports = { extractTopics, generateNotes, chatWithAI, generateQuiz, generateFlashcards, summarizeTopic, translateNotes };
