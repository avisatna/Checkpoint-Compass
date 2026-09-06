import * as vscode from 'vscode';
import { Checkpoint } from '../checkpointSchema';
import { createWebviewHtml } from './webview';

export function showCreateCheckpointPanel(
  extensionUri: vscode.Uri,
  intent: string,
  diff: string,
  files: string[],
  onSave: (notes: string) => Promise<void>
): void {
  const panel = vscode.window.createWebviewPanel('checkpointCompass.create', 'Create Checkpoint', vscode.ViewColumn.One, { enableScripts: true });
  const escapedDiff = diff.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  panel.webview.html = createWebviewHtml(panel.webview, 'Create Checkpoint', `
    <p><small>Files: ${files.length ? files.join(', ') : 'No changed files detected'}</small></p>
    <label for="intent">Intent</label><textarea id="intent" readonly>${escapeHtml(intent)}</textarea>
    <label for="diff">Diff preview</label><pre id="diff">${escapedDiff || 'No diff from HEAD.'}</pre>
    <label for="notes">Notes (optional)</label><textarea id="notes" placeholder="Add unresolved assumptions or context..."></textarea>
    <button id="save">Save checkpoint</button><p id="status"></p>
  `, `
    const vscode = acquireVsCodeApi();
    document.getElementById('save').addEventListener('click', () => { vscode.postMessage({ type: 'save', notes: document.getElementById('notes').value }); });
    window.addEventListener('message', event => { document.getElementById('status').textContent = event.data.message; });
  `);
  panel.webview.onDidReceiveMessage(async (message) => {
    if (message.type !== 'save') return;
    try {
      await onSave(typeof message.notes === 'string' ? message.notes : '');
      await panel.webview.postMessage({ message: 'Checkpoint saved.' });
      setTimeout(() => panel.dispose(), 500);
    } catch (error) {
      await panel.webview.postMessage({ message: `Could not save checkpoint: ${error instanceof Error ? error.message : String(error)}` });
    }
  });
}

export function makeCheckpoint(intent: string, diff: string, files: string[], notes: string): Checkpoint {
  return {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    intent: intent.trim(),
    codeDiff: diff,
    files,
    ...(notes.trim() ? { notes: notes.trim() } : {}),
    unresolved: [],
    agentLogs: []
  };
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}
