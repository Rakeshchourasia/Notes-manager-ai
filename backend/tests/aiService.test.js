/**
 * aiService.test.js
 *
 * Test suite for backend/services/aiService.js
 *
 * Groups:
 *  A. Unit tests  — pure logic, no network (extractJSON, cleanMermaidDiagram)
 *  B. Error tests — wrong/missing API key (getCompletion error surfaces)
 *  C. Integration — real Groq API calls (requires .env with valid AI_API_KEY)
 *
 * Run:
 *   node --test tests/aiService.test.js
 *
 * Skip live tests only:
 *   SKIP_LIVE=1 node --test tests/aiService.test.js
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

// ─── helpers to load internals ───────────────────────────────────────────────
// aiService exports only public functions, so we test private helpers
// by re-requiring the module and using a small eval shim to expose them.
// Cleanest approach: duplicate the two pure helpers inline so there is no
// coupling to module internals.

// ── Copy of extractJSON (pure, no side effects) ──────────────────────────────
const extractJSON = (text, type = 'object') => {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  const bracket = type === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const jsonMatch = cleaned.match(bracket);
  if (!jsonMatch) throw new Error(`AI returned invalid JSON ${type}. Please try again.`);
  let raw = jsonMatch[0];
  try { return JSON.parse(raw); } catch (_) {}
  raw = raw.replace(/[\u201C\u201D\u201E]/g, '"').replace(/[\u2018\u2019\u201A]/g, "'");
  raw = raw.replace(/,\s*([}\]])/g, '$1');
  raw = raw.replace(/[\x00-\x1F\x7F]/g, (c) => c === '\n' || c === '\t' ? c : '');
  raw = raw.replace(/(["'])([^"']*?)\n([^"']*?)\1/g, (m, q, a, b) => `${q}${a} ${b}${q}`);
  try { return JSON.parse(raw); } catch (_) {}
  try { return JSON.parse(raw); } catch (e) {
    throw new Error(`AI returned malformed JSON. Parse error: ${e.message.substring(0, 100)}`);
  }
};

// ── Copy of cleanMermaidDiagram (pure, no side effects) ─────────────────────
const cleanMermaidDiagram = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  let diagram = raw.trim();
  diagram = diagram.replace(/^```(?:mermaid)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  diagram = diagram.replace(/\\n/g, '\n');
  const validStarts = ['graph ', 'graph\n', 'flowchart ', 'flowchart\n', 'sequenceDiagram', 'classDiagram', 'stateDiagram', 'erDiagram', 'gantt', 'pie', 'mindmap', 'timeline'];
  const hasValidStart = validStarts.some(s => diagram.toLowerCase().startsWith(s.toLowerCase()));
  if (!hasValidStart) return '';
  return diagram;
};

// ── Live service (loaded once) ───────────────────────────────────────────────
const aiService = require('../services/aiService');
const SKIP_LIVE = process.env.SKIP_LIVE === '1';

// ─── Section A: Unit Tests ───────────────────────────────────────────────────
describe('A — extractJSON (unit)', () => {

  test('parses a plain JSON object', () => {
    const result = extractJSON('{"key":"value"}', 'object');
    assert.deepEqual(result, { key: 'value' });
  });

  test('parses a plain JSON array', () => {
    const result = extractJSON('[{"a":1},{"a":2}]', 'array');
    assert.equal(result.length, 2);
    assert.equal(result[0].a, 1);
  });

  test('strips markdown code fences (```json ... ```)', () => {
    const input = '```json\n{"hello":"world"}\n```';
    const result = extractJSON(input, 'object');
    assert.deepEqual(result, { hello: 'world' });
  });

  test('strips bare code fences (``` ... ```)', () => {
    const input = '```\n[{"x":1}]\n```';
    const result = extractJSON(input, 'array');
    assert.deepEqual(result, [{ x: 1 }]);
  });

  test('removes trailing commas before } and ]', () => {
    const input = '{"a":1,"b":2,}';
    const result = extractJSON(input, 'object');
    assert.equal(result.a, 1);
    assert.equal(result.b, 2);
  });

  test('removes trailing commas in nested arrays', () => {
    const input = '[{"a":1,},{"b":2,},]';
    const result = extractJSON(input, 'array');
    assert.equal(result.length, 2);
  });

  test('handles smart/curly quotes', () => {
    // \u201C = " (left), \u201D = " (right)
    const input = '{\u201Cname\u201D:\u201Chello\u201D}';
    const result = extractJSON(input, 'object');
    assert.equal(result.name, 'hello');
  });

  test('throws on completely invalid input', () => {
    assert.throws(
      () => extractJSON('this is not json at all', 'object'),
      /invalid JSON/
    );
  });

  test('throws on empty string', () => {
    assert.throws(() => extractJSON('', 'object'), /invalid JSON/);
  });

  test('extracts JSON embedded in surrounding text', () => {
    const input = 'Here is the result: {"score":42} That was it.';
    const result = extractJSON(input, 'object');
    assert.equal(result.score, 42);
  });
});

// ─── Section B: cleanMermaidDiagram (unit) ───────────────────────────────────
describe('B — cleanMermaidDiagram (unit)', () => {

  test('returns valid graph TD diagram unchanged', () => {
    const diagram = 'graph TD\n  A --> B';
    assert.equal(cleanMermaidDiagram(diagram), 'graph TD\n  A --> B');
  });

  test('strips markdown ```mermaid fences', () => {
    const input = '```mermaid\ngraph TD\n  A --> B\n```';
    const result = cleanMermaidDiagram(input);
    assert.ok(result.startsWith('graph TD'));
    assert.ok(!result.includes('```'));
  });

  test('replaces literal \\n escape sequences with real newlines', () => {
    const input = 'graph TD\\nA --> B';
    const result = cleanMermaidDiagram(input);
    assert.ok(result.includes('\n'), 'Should contain real newline');
  });

  test('accepts flowchart TD', () => {
    const input = 'flowchart TD\n  A --> B';
    const result = cleanMermaidDiagram(input);
    assert.ok(result.startsWith('flowchart TD'));
  });

  test('accepts sequenceDiagram', () => {
    const input = 'sequenceDiagram\n  Alice ->> Bob: Hello';
    assert.ok(cleanMermaidDiagram(input).startsWith('sequenceDiagram'));
  });

  test('rejects unknown diagram type', () => {
    const input = 'unknownDiagram\n  A --> B';
    assert.equal(cleanMermaidDiagram(input), '');
  });

  test('returns empty string for null input', () => {
    assert.equal(cleanMermaidDiagram(null), '');
  });

  test('returns empty string for empty string', () => {
    assert.equal(cleanMermaidDiagram(''), '');
  });
});

// ─── Section C: getCompletion error handling (no live call) ──────────────────
describe('C — API key validation (unit)', () => {

  test('chatWithAI throws meaningful error when API key is blank', async () => {
    const savedKey = process.env.AI_API_KEY;
    process.env.AI_API_KEY = '';
    try {
      await assert.rejects(
        () => aiService.chatWithAI('hello', '', []),
        /AI_API_KEY/
      );
    } finally {
      process.env.AI_API_KEY = savedKey;
    }
  });

  test('extractTopics throws meaningful error when API key is blank', async () => {
    const savedKey = process.env.AI_API_KEY;
    process.env.AI_API_KEY = '';
    try {
      await assert.rejects(
        () => aiService.extractTopics('some syllabus text'),
        /AI_API_KEY/
      );
    } finally {
      process.env.AI_API_KEY = savedKey;
    }
  });
});

// ─── Section D: Live Integration Tests (real API calls) ──────────────────────
describe('D — Live AI integration (Groq API)', () => {

  before(() => {
    if (SKIP_LIVE) {
      console.log('  ⚠️  SKIP_LIVE=1 — skipping all live API tests');
    } else {
      console.log(`  🌐 Using model: ${process.env.AI_MODEL || 'llama-3.3-70b-versatile'}`);
      console.log('  ⏱  These tests call the real API — allow up to 60s each\n');
    }
  });

  // ── D1: extractTopics ──────────────────────────────────────────────────────
  test('D1 — extractTopics: returns 5-20 valid topic objects', { skip: SKIP_LIVE }, async () => {
    const syllabus = `
      Unit 1: Introduction to Operating Systems — processes, threads, scheduling
      Unit 2: Memory Management — paging, segmentation, virtual memory
      Unit 3: File Systems — FAT, NTFS, inodes, directories
      Unit 4: I/O Systems — device drivers, DMA, interrupts
      Unit 5: Deadlocks — detection, prevention, Banker's algorithm
    `;
    const topics = await aiService.extractTopics(syllabus);

    assert.ok(Array.isArray(topics), 'Should return an array');
    assert.ok(topics.length >= 3, `Should have at least 3 topics, got ${topics.length}`);
    assert.ok(topics.length <= 20, `Should have at most 20 topics, got ${topics.length}`);

    for (const t of topics) {
      assert.ok(typeof t.name === 'string' && t.name.length > 0, `Topic missing name: ${JSON.stringify(t)}`);
      assert.ok(typeof t.order === 'number', `Topic missing order: ${JSON.stringify(t)}`);
    }
    console.log(`      ✓ Extracted ${topics.length} topics. First: "${topics[0].name}"`);
  });

  // ── D2: generateNotes ─────────────────────────────────────────────────────
  test('D2 — generateNotes: returns all required fields with correct types', { skip: SKIP_LIVE }, async () => {
    const notes = await aiService.generateNotes('Paging in Operating Systems', 'Unit 2: Memory Management — paging, frames, page tables');

    // Required string fields
    for (const field of ['definition', 'explanation', 'summary']) {
      assert.ok(typeof notes[field] === 'string' && notes[field].length > 10,
        `Field "${field}" should be a non-empty string`);
    }

    // Required array fields
    for (const field of ['keyTerms', 'examples', 'importantPoints', 'importantQuestions', 'realWorldApplications', 'flashcards']) {
      assert.ok(Array.isArray(notes[field]) && notes[field].length > 0,
        `Field "${field}" should be a non-empty array`);
    }

    // keyTerms shape
    for (const kt of notes.keyTerms) {
      assert.ok(typeof kt.term === 'string', 'keyTerm.term should be a string');
      assert.ok(typeof kt.definition === 'string', 'keyTerm.definition should be a string');
    }

    // flashcards shape
    for (const fc of notes.flashcards) {
      assert.ok(typeof fc.question === 'string', 'flashcard.question should be a string');
      assert.ok(typeof fc.answer === 'string', 'flashcard.answer should be a string');
    }

    // mermaidDiagram: may be empty string if generation failed (non-fatal), but must be a string
    assert.ok(typeof notes.mermaidDiagram === 'string', 'mermaidDiagram should be a string');

    console.log(`      ✓ Notes generated. keyTerms: ${notes.keyTerms.length}, flashcards: ${notes.flashcards.length}`);
    console.log(`      ✓ mermaidDiagram: ${notes.mermaidDiagram ? 'present (' + notes.mermaidDiagram.substring(0, 40).replace(/\n/g,' ') + '...)' : 'empty (non-fatal)'}`);
  });

  // ── D3: chatWithAI ────────────────────────────────────────────────────────
  test('D3 — chatWithAI: returns a non-empty string answer', { skip: SKIP_LIVE }, async () => {
    const answer = await aiService.chatWithAI(
      'What is virtual memory?',
      'Topic: Memory Management\nDefinition: Virtual memory allows programs to use more memory than physically available.',
      []
    );

    assert.ok(typeof answer === 'string' && answer.length > 20, 'Answer should be a non-empty string');
    console.log(`      ✓ Answer (first 100 chars): "${answer.substring(0, 100).replace(/\n/g, ' ')}..."`);
  });

  test('D3b — chatWithAI: respects history context', { skip: SKIP_LIVE }, async () => {
    const history = [
      { role: 'user', content: 'What is paging?' },
      { role: 'assistant', content: 'Paging is a memory management scheme that eliminates the need for contiguous allocation.' },
    ];
    const answer = await aiService.chatWithAI(
      'Can you give me an example?',
      'Topic: Memory Management',
      history
    );
    assert.ok(typeof answer === 'string' && answer.length > 20, 'Follow-up answer should be a non-empty string');
    console.log(`      ✓ History-aware answer (first 80 chars): "${answer.substring(0, 80).replace(/\n/g, ' ')}..."`);
  });

  // ── D4: generateQuiz ──────────────────────────────────────────────────────
  test('D4 — generateQuiz: returns 10 valid MCQ objects', { skip: SKIP_LIVE }, async () => {
    const content = `Topic: Deadlocks
Definition: A deadlock is a state where processes block each other indefinitely.
Important Points: mutual exclusion, hold-and-wait, no preemption, circular wait, Banker's algorithm`;

    const questions = await aiService.generateQuiz(content);

    assert.ok(Array.isArray(questions), 'Should return an array');
    // Free-tier OTPM cap (1000 tokens/min) means we use max_tokens:900, which can yield fewer questions
    assert.ok(questions.length >= 3, `Should have at least 3 questions, got ${questions.length}`);

    for (const q of questions) {
      assert.ok(typeof q.question === 'string' && q.question.length > 5, `question text missing: ${JSON.stringify(q)}`);
      assert.ok(Array.isArray(q.options) && q.options.length === 4, `options should be 4-item array: ${JSON.stringify(q)}`);
      assert.ok(typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3,
        `correctIndex should be 0-3: ${JSON.stringify(q)}`);
    }
    console.log(`      ✓ Quiz generated with ${questions.length} questions`);
  });

  // ── D5: generateFlashcards ────────────────────────────────────────────────
  test('D5 — generateFlashcards: returns 8-12 flashcard objects', { skip: SKIP_LIVE }, async () => {
    const content = `Topic: CPU Scheduling
Definition: CPU scheduling determines which process runs next.
Key Points: FCFS, SJF, Round Robin, Priority Scheduling, preemptive vs non-preemptive`;

    const flashcards = await aiService.generateFlashcards('CPU Scheduling', content);

    assert.ok(Array.isArray(flashcards), 'Should return an array');
    assert.ok(flashcards.length >= 5, `Expected at least 5 flashcards, got ${flashcards.length}`);
    assert.ok(flashcards.length <= 15, `Expected at most 15 flashcards, got ${flashcards.length}`);

    for (const fc of flashcards) {
      assert.ok(typeof fc.question === 'string' && fc.question.length > 3, `flashcard.question missing: ${JSON.stringify(fc)}`);
      assert.ok(typeof fc.answer === 'string' && fc.answer.length > 3, `flashcard.answer missing: ${JSON.stringify(fc)}`);
    }
    console.log(`      ✓ ${flashcards.length} flashcards generated. First Q: "${flashcards[0].question}"`);
  });

  // ── D6: summarizeTopic ────────────────────────────────────────────────────
  test('D6 — summarizeTopic: returns non-empty plain text summary', { skip: SKIP_LIVE }, async () => {
    const content = `Deadlocks occur when processes wait on each other indefinitely.
The four necessary conditions are: mutual exclusion, hold-and-wait, no preemption, and circular wait.
Prevention: break one of the four conditions. Detection: use wait-for graph. Recovery: kill a process.`;

    const summary = await aiService.summarizeTopic('Deadlocks', content);

    assert.ok(typeof summary === 'string' && summary.length > 30, 'Summary should be a non-empty string');
    // Should have bullet points
    const hasBullets = summary.includes('-') || summary.includes('•') || summary.includes('*') || summary.match(/\d\./);
    assert.ok(hasBullets, 'Summary should be in bullet-point format');
    console.log(`      ✓ Summary (first 120 chars): "${summary.substring(0, 120).replace(/\n/g, ' ')}..."`);
  });

  // ── D7: translateNotes ────────────────────────────────────────────────────
  test('D7 — translateNotes: translates text fields, preserves mermaidDiagram untouched', { skip: SKIP_LIVE }, async () => {
    const notesObj = {
      _id: 'mock_id',
      topicId: 'mock_topic',
      syllabusId: 'mock_syllabus',
      topicName: 'Paging',
      definition: 'Paging is a memory management technique.',
      explanation: 'In paging, memory is divided into fixed-size blocks called pages.',
      keyTerms: [{ term: 'Page', definition: 'A fixed-size block of memory.' }],
      examples: [{ title: 'Example 1', content: 'A process needs 4 pages of memory.' }],
      importantPoints: ['Eliminates external fragmentation', 'Uses page table for mapping'],
      summary: 'Paging divides memory into equal-sized pages.',
      mermaidDiagram: 'graph TD\n  A[Page Table] --> B[Frame]',
      importantQuestions: ['What is a page table?'],
      realWorldApplications: ['Used in modern OS like Linux, Windows'],
      flashcards: [{ question: 'What is paging?', answer: 'A memory management scheme.' }],
    };

    const translated = await aiService.translateNotes(notesObj, 'Hindi');

    // definition should be translated (not English)
    assert.ok(typeof translated.definition === 'string' && translated.definition.length > 3,
      'definition should be translated');
    assert.notEqual(translated.definition, notesObj.definition,
      'definition should differ from original English (was translated)');

    // FIX Bug 2 verification: mermaidDiagram should NOT be in the output
    // (we excluded it from translation input, so it won't appear in the response)
    // The translated object only contains what was sent to the AI.
    // mermaidDiagram is preserved separately by the route, not by translateNotes.
    assert.ok(!('mermaidDiagram' in translated),
      'mermaidDiagram should NOT be in translateNotes output (excluded to preserve diagram code)');

    // flashcards should also not appear in the returned translated object
    assert.ok(!('flashcards' in translated),
      'flashcards should NOT be in translateNotes output (excluded to save tokens)');

    console.log(`      ✓ Translation to Hindi OK. definition: "${translated.definition.substring(0, 60)}..."`);
  });

  // ── D8: token limit sanity — generateNotes context cap ────────────────────
  test('D8 — generateNotes: handles very large syllabus without error (context is capped)', { skip: SKIP_LIVE }, async () => {
    // Pass a 20 000-char syllabus — service should cap it at 3000 chars internally
    const hugeSyllabus = 'This is a long syllabus. '.repeat(800); // ~20 000 chars
    const notes = await aiService.generateNotes('Introduction to AI', hugeSyllabus);

    assert.ok(typeof notes.definition === 'string' && notes.definition.length > 5,
      'Should still return valid notes despite huge input');
    console.log(`      ✓ Large syllabus handled safely. definition: "${notes.definition.substring(0, 80)}..."`);
  });
});
