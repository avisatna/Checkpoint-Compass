const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCheckpoint } = require('../dist/checkpointSchema.js');

const validCheckpoint = {
  schemaVersion: 2,
  timestamp: '2026-09-06T00:00:00.000Z',
  intent: 'Add validation',
  codeDiff: '+ validateConfig();',
  files: ['src/config.ts'],
  unresolved: [],
  agentLogs: []
};

test('accepts a valid checkpoint', () => {
  assert.equal(validateCheckpoint(validCheckpoint), true);
});

test('rejects a checkpoint without intent', () => {
  const invalid = { ...validCheckpoint, intent: '' };
  assert.equal(validateCheckpoint(invalid), false);
});

test('rejects unknown fields', () => {
  const invalid = { ...validCheckpoint, unexpected: true };
  assert.equal(validateCheckpoint(invalid), false);
});

test('rejects an invalid timestamp', () => {
  const invalid = { ...validCheckpoint, timestamp: 'not-a-date' };
  assert.equal(validateCheckpoint(invalid), false);
});

test('accepts reasoning and an Entire checkpoint reference', () => {
  const enriched = {
    ...validCheckpoint,
    agentSteps: ['Added request validation'],
    assumptions: ['The client accepts a 400 response'],
    failures: ['End-to-end environment is unavailable'],
    unresolved: ['Confirm error copy'],
    entire: {
      source: 'entire-cli',
      checkpointId: 'a3b2c4d5e6f7',
      capturedAt: '2026-09-06T00:00:00.000Z',
      branch: 'main'
    }
  };
  assert.equal(validateCheckpoint(enriched), true);
});
