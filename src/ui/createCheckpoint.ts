import * as vscode from 'vscode';
import { Checkpoint, EntireCheckpointReference } from '../checkpointSchema';
import { createWebviewHtml } from './webview';

export function showCreateCheckpointPanel(
  intent: string,
  diff: string,
  files: string[],
  entireMessage: string,
  onSave: (draft: CheckpointDraft) => Promise<void>
): void {
  const panel = vscode.window.createWebviewPanel('checkpointCompass.create', 'Create Checkpoint', vscode.ViewColumn.One, { enableScripts: true });
  const escapedDiff = diff.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  panel.webview.html = createWebviewHtml(panel.webview, 'Create Checkpoint', `
    <p><small>Files: ${files.length ? files.join(', ') : 'No changed files detected'}</small></p>
    <label for="intent">Intent</label><textarea id="intent" readonly>${escapeHtml(intent)}</textarea>
    <label for="diff">Diff preview</label><pre id="diff">${escapedDiff || 'No diff from HEAD.'}</pre>
    <p><strong>Entire context:</strong> ${escapeHtml(entireMessage)}</p>
    <label for="steps">What the agent or developer attempted (one item per line)</label><textarea id="steps" placeholder="Added parser validation&#10;Ran the unit suite"></textarea>
    <label for="assumptions">Assumptions to verify (one item per line)</label><textarea id="assumptions" placeholder="Existing API consumers accept the new validation error"></textarea>
    <label for="failures">What failed or remains incomplete (one item per line)</label><textarea id="failures" placeholder="Integration test environment is not configured"></textarea>
    <label for="unresolved">Unresolved requirements or risks (one item per line)</label><textarea id="unresolved" placeholder="Confirm release behavior with the platform team"></textarea>
    <label for="notes">Additional notes (optional)</label><textarea id="notes" placeholder="Context for the next reviewer or agent..."></textarea>
    <button id="save">Save checkpoint</button><p id="status"></p>
  `, `
    const vscode = acquireVsCodeApi();
    document.getElementById('save').addEventListener('click', () => { vscode.postMessage({ type: 'save', notes: document.getElementById('notes').value, steps: document.getElementById('steps').value, assumptions: document.getElementById('assumptions').value, failures: document.getElementById('failures').value, unresolved: document.getElementById('unresolved').value }); });
    window.addEventListener('message', event => { document.getElementById('status').textContent = event.data.message; });
  `);
  panel.webview.onDidReceiveMessage(async (message) => {
    if (message.type !== 'save') return;
    try {
      await onSave({ notes: stringValue(message.notes), steps: stringValue(message.steps), assumptions: stringValue(message.assumptions), failures: stringValue(message.failures), unresolved: stringValue(message.unresolved) });
      await panel.webview.postMessage({ message: 'Checkpoint saved.' });
      setTimeout(() => panel.dispose(), 500);
    } catch (error) {
      await panel.webview.postMessage({ message: `Could not save checkpoint: ${error instanceof Error ? error.message : String(error)}` });
    }
  });
}

export interface CheckpointDraft {
  notes: string;
  steps: string;
  assumptions: string;
  failures: string;
  unresolved: string;
}

export function makeCheckpoint(intent: string, diff: string, files: string[], draft: CheckpointDraft, entire?: EntireCheckpointReference): Checkpoint {
  return {
    schemaVersion: 2,
    timestamp: new Date().toISOString(),
    intent: intent.trim(),
    codeDiff: diff,
    files,
    ...(draft.notes.trim() ? { notes: draft.notes.trim() } : {}),
    unresolved: listFromLines(draft.unresolved),
    agentSteps: listFromLines(draft.steps),
    assumptions: listFromLines(draft.assumptions),
    failures: listFromLines(draft.failures),
    agentLogs: [],
    ...(entire ? { entire } : {})
  };
}

function listFromLines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
