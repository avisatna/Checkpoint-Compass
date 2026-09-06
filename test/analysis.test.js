const test = require('node:test');
const assert = require('node:assert/strict');
const { compareIntent, findTodoMarkers } = require('../dist/analysis.js');

test('reports intent keywords absent from the diff', () => {
  const issues = compareIntent({
    schemaVersion: 2,
    timestamp: '2026-09-06T00:00:00.000Z',
    intent: 'Add auth and validation',
    codeDiff: 'diff --git a/src/auth.ts b/src/auth.ts\n@@ -1,0 +1,1 @@\n+export function authenticate() {}\n',
    files: ['src/auth.ts'],
    unresolved: [],
    agentLogs: []
  });
  assert.equal(issues.length, 2);
  assert.ok(issues.some((issue) => /validation/.test(issue.issue)));
});

test('finds TODO and FIXME markers with line numbers', () => {
  const risks = findTodoMarkers(['src/example.ts'], (file) => file === 'src/example.ts' ? 'const a = 1;\n// TODO: remove this\n// FIXME: handle error' : undefined);
  assert.deepEqual(risks, [
    'src/example.ts line 2: // TODO: remove this',
    'src/example.ts line 3: // FIXME: handle error'
  ]);
});

test('flags a checkpoint that cannot hand off Entire reasoning', () => {
  const issues = compareIntent({
    schemaVersion: 2,
    timestamp: '2026-09-06T00:00:00.000Z',
    intent: 'Add auth',
    codeDiff: '+ const auth = true;',
    files: ['src/auth.ts'],
    unresolved: [],
    agentLogs: []
  });
  assert.equal(issues.length, 1);
  assert.match(issues[0].issue, /No Entire Checkpoint/);
});
