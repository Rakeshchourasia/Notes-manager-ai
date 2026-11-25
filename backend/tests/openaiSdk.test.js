/**
 * openaiSdk.test.js
 *
 * Contract test for the openai dependency upgrade.
 *
 * The OpenAI API spec dropped the Assistants, Conversations and Evals
 * endpoints. backend/services/aiService.js only uses Chat Completions, which is
 * retained, so upgrading the SDK must not change the request it sends.
 *
 * Runs without network access:
 *   node --test tests/openaiSdk.test.js
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

describe('OpenAI SDK upgrade contract', () => {

  test('SDK is on the v7+ line where the deprecated endpoints are removed', () => {
    const { VERSION } = require('openai/version');
    const major = Number(String(VERSION).split('.')[0]);
    assert.ok(
      Number.isFinite(major) && major >= 7,
      `expected openai >= 7.x, found ${VERSION}`
    );
  });

  test('extractTopics still calls chat.completions.create with the same request body', async () => {
    const Module = require('node:module');
    const originalLoad = Module._load;
    const calls = [];

    class FakeOpenAI {
      constructor() {
        this.chat = {
          completions: {
            create: async (body) => {
              calls.push(body);
              return { choices: [{ message: { content: '[{"name":"Intro","description":"d","order":1}]' } }] };
            },
          },
        };
      }
    }

    // Intercept `require('openai')` only while the service is reloaded, so no
    // network client is constructed for this test.
    Module._load = function (request) {
      if (request === 'openai') return { OpenAI: FakeOpenAI };
      return originalLoad.apply(this, arguments);
    };

    const servicePath = require.resolve('../services/aiService');
    delete require.cache[servicePath];
    const savedKey = process.env.AI_API_KEY;
    const savedModel = process.env.AI_MODEL;
    process.env.AI_API_KEY = 'test-key';

    try {
      const svc = require('../services/aiService');
      const topics = await svc.extractTopics('Unit 1: Introduction to testing');

      assert.ok(Array.isArray(topics), 'extractTopics should still return an array');
      assert.equal(calls.length, 1, 'exactly one chat completion should be requested');

      const body = calls[0];
      assert.equal(body.model, savedModel || 'llama-3.3-70b-versatile');
      assert.equal(body.temperature, 0.1);
      assert.ok(Array.isArray(body.messages) && body.messages.length === 2);
      assert.equal(body.max_tokens, 800);
      assert.equal(body.response_format, undefined, 'extractTopics does not request JSON mode');
    } finally {
      Module._load = originalLoad;
      delete require.cache[servicePath];
      process.env.AI_API_KEY = savedKey;
      if (savedModel === undefined) delete process.env.AI_MODEL;
      else process.env.AI_MODEL = savedModel;
    }
  });
});
