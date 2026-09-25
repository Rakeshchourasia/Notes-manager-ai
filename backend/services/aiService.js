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

  // 5. Last resort: fix unescaped colons/quotes in values
  raw = raw.replace(/:\s*"([^"]*?)"\s*:/g, (match, val) => {
    return `: "${val}" :`;
  });

  try { return JSON.parse(raw); } catch (e) { /* continue to truncation repair */ }

  // 6. Truncation repair — the AI was cut off mid-response (token limit hit).
  //    Strategy: walk the string tracking open brackets/strings and close them.
  const repaired = repairTruncatedJSON(raw);
  try { return JSON.parse(repaired); } catch (e) {
    throw new Error(`AI returned malformed JSON. Retrying may help. Parse error: ${e.message.substring(0, 100)}`);
  }
};

/**
 * Attempt to close a JSON string that was cut off by a token limit.
 * Walks the raw string character-by-character tracking open structures,
 * then appends the necessary closing characters.
 */
const repairTruncatedJSON = (raw) => {
  let result = raw;
  // Remove trailing commas that appear right before truncation
  result = result.replace(/,\s*$/, '');

  const stack = []; // tracks '{' and '['
  let inString = false;
  let escaped = false;

  for (let i = 0; i < result.length; i++) {
    const ch = result[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }

  // Close any open string
  if (inString) result += '"';

  // Remove any dangling key without a value: ,"key" or ,"key":
  result = result.replace(/,\s*"[^"]*"\s*:?\s*$/, '');
  result = result.replace(/,\s*"[^"]*"\s*$/, '');

  // Close open structures in reverse order
  while (stack.length > 0) {
    const open = stack.pop();
    result += open === '{' ? '}' : ']';
  }

  return result;
};

/**
 * Common completion wrapper with retry and exponential backoff.
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {number} retries
 * @param {number|null} maxTokens - cap output tokens to control cost; null = model default
 * @param {Array}  messages       - optional full messages array (overrides system/user prompts)
 */
const getCompletion = async (systemPrompt, userPrompt, retries = 3, maxTokens = null, messages = null, jsonMode = false) => {
  let lastError;

  // Validate API key is configured
  if (!process.env.AI_API_KEY || process.env.AI_API_KEY.trim() === '') {
    throw new Error('AI_API_KEY is not set in your .env file. Please add your API key.');
  }

  const resolvedMessages = messages || [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const requestBody = {
        model: TEXT_MODEL,
        temperature: 0.1,
        messages: resolvedMessages,
      };
      // Only set max_tokens if explicitly provided — avoids errors on models that don't support it
      if (maxTokens) requestBody.max_tokens = maxTokens;
      // Enable JSON mode if requested and supported by the model (forces valid JSON output)
      if (jsonMode) requestBody.response_format = { type: 'json_object' };

      const response = await openai.chat.completions.create(requestBody);
      return response.choices[0].message.content;
    } catch (err) {
      lastError = err;

      // Surface clear, actionable errors immediately without retry
      const status = err?.status || err?.response?.status;
      if (status === 401) {
        throw new Error('Invalid API key. Check AI_API_KEY in your .env file.');
      }
      if (status === 429) {
        const msg = err?.message?.toLowerCase() || '';
        if (msg.includes('quota')) {
          throw new Error('AI quota exceeded. Check your billing or switch to a free model.');
        }
        // OTPM (Output Tokens Per Minute) limit hit — wait 62s for the window to reset
        if (msg.includes('output tokens per minute') || msg.includes('otpm')) {
          console.warn(`[aiService] OTPM limit hit — waiting 62s for the token window to reset...`);
          await sleep(62000);
          continue; // retry immediately after wait
        }
        // Standard rate limit — retry with backoff
      }
      if (status === 503 && attempt >= retries) {
        throw new Error('AI service is temporarily unavailable. Please try again later.');
      }

      console.warn(`[aiService] Attempt ${attempt}/${retries} failed (status=${status || 'N/A'}): ${err.message}`);
      if (attempt < retries) {
        const waitMs = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        console.log(`[aiService] Retrying in ${Math.round(waitMs / 1000)}s...`);
        await sleep(waitMs);
      }
    }
  }

  throw new Error(`AI request failed after ${retries} attempts: ${lastError?.message}`);
};

/**
 * Extract topics from raw syllabus text.
 * Token budget: ~500 input (system) + ~8000 context + ~800 output = ~9300 tokens max
 */
const extractTopics = async (syllabusText) => {
  // FIX Bug 3 (partial): cap syllabus context at 8000 chars (was 12000)
  const context = syllabusText.substring(0, 8000);

  const systemPrompt = `You are an expert academic syllabus analyzer.
Your ONLY output should be a valid JSON array of objects. Do not include markdown formatting or explanations.`;

  const userPrompt = `Given the following syllabus text, extract all the main topics/chapters/units.
Return ONLY a valid JSON array of objects in this exact format:
[
  {"name": "Topic Name", "description": "1-2 sentence description", "order": 1}
]

Extract 5-20 meaningful, distinct topics.

Syllabus Text:
${context}

Return ONLY the JSON array. No markdown, no explanation.`;

  // max_tokens: 800 covers up to 20 topics comfortably
  const text = await getCompletion(systemPrompt, userPrompt, 3, 800);
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

/**
 * Generate a mermaid diagram for a topic as a SEPARATE call.
 * FIX Bug 7: Previously embedded inside the notes JSON, causing frequent parse failures
 * because Mermaid newlines/special chars break JSON strings. Now isolated.
 * Token budget: ~200 input + 300 output = ~500 tokens
 */
const generateMermaidDiagram = async (topicName) => {
  const systemPrompt = `You are a Mermaid.js diagram expert. Output ONLY the raw mermaid diagram text. No JSON, no markdown fences, no explanation.`;

  const userPrompt = `Create a simple Mermaid.js flowchart for: "${topicName}"
Rules:
- Start with "graph TD"
- 4-7 nodes maximum
- Simple labels only (no parentheses, brackets, or special chars inside node labels)
- Use --> for connections

Output ONLY the mermaid diagram. Example:
graph TD
  A[Main Topic] --> B[Subtopic 1]
  A --> C[Subtopic 2]
  B --> D[Detail 1]
  C --> E[Detail 2]`;

  try {
    // max_tokens: 300 is plenty for a small diagram
    const raw = await getCompletion(systemPrompt, userPrompt, 2, 300);
    return cleanMermaidDiagram(raw);
  } catch (err) {
    // Non-fatal: notes are still useful without a diagram
    console.warn(`[aiService] Mermaid generation failed for "${topicName}": ${err.message}`);
    return '';
  }
};

/**
 * Generate comprehensive study notes for a topic.
 * FIX Bug 3: Syllabus context capped at 3000 chars (was 12000) — only enough for relevant context.
 * FIX Bug 7: mermaidDiagram generated in a separate call to avoid JSON parse failures.
 * Token budget: ~600 input + ~3000 context + ~1800 output = ~5400 tokens
 */
const generateNotes = async (topicName, syllabusContext) => {
  // Only send a focused excerpt of the syllabus for context
  const contextSnippet = syllabusContext ? syllabusContext.substring(0, 3000) : '';

  const systemPrompt = `You are an expert academic tutor and notes writer.
Your ONLY output must be a single valid JSON object with NO additional text, markdown, or explanation.`;

  const userPrompt = `Generate comprehensive study notes for the topic: "${topicName}"
${contextSnippet ? `Syllabus context: "${contextSnippet}"` : ''}

Return ONLY this JSON structure (no markdown, no extra text):
{
  "definition": "clear 1-2 sentence definition",
  "explanation": "2-3 paragraph explanation (keep concise)",
  "keyTerms": [{"term": "Term", "definition": "Definition"}],
  "examples": [{"title": "Title", "content": "Brief explanation"}],
  "importantPoints": ["Point 1", "Point 2", "Point 3"],
  "summary": "2-3 sentence summary",
  "importantQuestions": ["Question 1?", "Question 2?"],
  "realWorldApplications": ["Application 1", "Application 2"],
  "flashcards": [{"question": "What is X?", "answer": "X is..."}]
}

Keep values SHORT to fit within the token limit:
- keyTerms: exactly 4, each definition under 15 words
- examples: exactly 2, content under 20 words each
- importantPoints: exactly 5, each under 12 words
- importantQuestions: exactly 3
- realWorldApplications: exactly 2, each under 15 words
- flashcards: exactly 5, answers under 15 words each
- explanation: max 150 words total
- summary: max 60 words

Return ONLY the JSON object.`;

  // 2000 tokens gives the AI enough room to complete the full JSON without truncation.
  // (Previously 950 was too tight — the response was cut off mid-JSON.)
  const text = await getCompletion(systemPrompt, userPrompt, 3, 2000, null, true);
  const result = extractJSON(text, 'object');

  // Generate mermaid diagram separately to avoid embedding it inside JSON (causes parse failures)
  result.mermaidDiagram = await generateMermaidDiagram(topicName);

  return result;
};

/**
 * Chat with AI about a topic.
 * FIX Bug 1: Now routes through getCompletion for retry logic and proper error handling.
 * Token budget: ~300 system + ~400 context + history(4×~100) + ~150 question + ~400 output = ~1650 tokens
 */
const chatWithAI = async (question, context, history = []) => {
  const systemPrompt = `You are a helpful AI study assistant for students. Provide direct, helpful answers.${
    context ? `\n\nStudy Context:\n${context.substring(0, 1500)}` : ''
  }`;

  // FIX token: trim history to last 4 messages (was 6) to reduce input tokens
  const historyMessages = (history || []).slice(-4).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content).substring(0, 500), // cap each history message
  }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: `${question}\n\nGive a clear, student-friendly answer in 100-200 words with an example where helpful.` },
  ];

  // FIX Bug 1: use getCompletion so we get retry + API key validation + error messages
  // max_tokens: 400 keeps answers focused (was unlimited)
  return await getCompletion(null, null, 3, 400, messages);
};

/**
 * Generate quiz questions from notes content.
 * Token budget: ~100 input + ~5000 content + ~1200 output = ~6300 tokens
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

  // max_tokens: 900 — fits within Groq free-tier OTPM limit (10 short MCQs)
  const text = await getCompletion(systemPrompt, userPrompt, 3, 900);
  return extractJSON(text, 'array');
};

/**
 * Generate flashcards for a topic.
 * FIX token: content cap reduced from 4000 to 2500 chars.
 * Token budget: ~100 + ~2500 content + ~900 output = ~3500 tokens
 */
const generateFlashcards = async (topicName, notesContent) => {
  const systemPrompt = `You are an expert flashcard creator. Your ONLY output should be a valid JSON array.`;
  const userPrompt = `Topic: ${topicName}
Content:
${notesContent.substring(0, 2500)}

Generate 8-12 study flashcards. Return ONLY a JSON array:
[
  {"question": "What is X?", "answer": "X is a concept that..."}
]

Each flashcard should test a different key concept. Keep answers concise (1-3 sentences).
Return ONLY the JSON array. No markdown.`;

  // max_tokens: 900 covers 12 flashcards comfortably
  const text = await getCompletion(systemPrompt, userPrompt, 3, 900);
  return extractJSON(text, 'array');
};

/**
 * Summarize a topic for quick revision.
 * FIX token: content cap reduced from 4000 to 2000 chars.
 * Token budget: ~100 + ~2000 content + ~300 output = ~2400 tokens
 */
const summarizeTopic = async (topicName, notesContent) => {
  const systemPrompt = `You are an expert academic summarizer.`;
  const userPrompt = `Topic: ${topicName}
Full notes: ${notesContent.substring(0, 2000)}

Create a concise 5-7 bullet point quick revision summary. Use simple language a student can quickly scan before an exam. Return plain text, not JSON.`;

  // max_tokens: 300 is plenty for a bullet-point summary
  return await getCompletion(systemPrompt, userPrompt, 3, 300);
};

/**
 * Translate notes object to target language.
 * FIX Bug 2: Excludes mermaidDiagram (it's code, not translatable text) and flashcards
 * (already included in notes, translating again wastes tokens).
 * Only translates: definition, explanation, keyTerms, examples, importantPoints,
 * summary, importantQuestions, realWorldApplications.
 * Token budget: ~200 system + ~1500 content + ~1500 output = ~3200 tokens
 */
const translateNotes = async (notesObj, targetLanguage) => {
  const systemPrompt = `You are an expert technical translator. Translate the provided JSON data into ${targetLanguage} while preserving exactly the same JSON structure and keys. Only modify the string values. DO NOT translate keys.`;

  // FIX Bug 2: Exclude fields that should NOT be translated:
  // - mermaidDiagram: it's code — translating it breaks syntax
  // - flashcards: already in the notes object, saves tokens
  // - _id, topicId, syllabusId, topicName, createdAt, updatedAt, __v: Mongo metadata
  const {
    _id, topicId, syllabusId, topicName, createdAt, updatedAt, __v,
    mermaidDiagram,  // FIX: excluded — diagram code must not be translated
    flashcards,      // FIX: excluded — saves ~300 tokens, already stored separately
    ...contentToTranslate
  } = notesObj;

  const userPrompt = `Target Language: ${targetLanguage}\n\nStrictly return ONLY a valid JSON object matching the input structure, but with values translated:\n\n${JSON.stringify(contentToTranslate, null, 2)}`;

  // max_tokens: 900 — fits within Groq free-tier OTPM limit; translatable fields are concise
  const text = await getCompletion(systemPrompt, userPrompt, 3, 900);
  return extractJSON(text, 'object');
};

module.exports = { extractTopics, generateNotes, chatWithAI, generateQuiz, generateFlashcards, summarizeTopic, translateNotes };
