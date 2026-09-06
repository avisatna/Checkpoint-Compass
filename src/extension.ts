import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { assertValidCheckpoint, Checkpoint } from './checkpointSchema';
import { buildRiskDashboard, compareIntent, findTodoMarkers, renderComparisonTable, renderMarkdownComparison } from './analysis';
import { filesFromDiff, getChangedFiles, getDiff, runGit } from './git';
import { discoverEntire, readEntireContext } from './entire';
import { createWebviewHtml } from './ui/webview';
import { makeCheckpoint, showCreateCheckpointPanel } from './ui/createCheckpoint';

const execFileAsync = promisify(execFile);

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('checkpointCompass.createCheckpoint', createCheckpoint),
    vscode.commands.registerCommand('checkpointCompass.compareIntent', compareIntentCommand),
    vscode.commands.registerCommand('checkpointCompass.generateReport', generateReportCommand),
    vscode.commands.registerCommand('checkpointCompass.createHandoff', createHandoffCommand),
    vscode.commands.registerCommand('checkpointCompass.openEntireContext', openEntireContextCommand)
  );
}

async function createCheckpoint(): Promise<void> {
  const workspace = getWorkspacePath();
  if (!workspace) return;
  const intent = await vscode.window.showInputBox({ prompt: 'What should this change accomplish?', placeHolder: 'e.g. Add validation for imported configuration', ignoreFocusOut: true });
  if (!intent?.trim()) return;
  try {
    const diff = await getDiff(workspace);
    const files = [...new Set([...filesFromDiff(diff), ...(await getChangedFiles(workspace))])];
    const entire = await discoverEntire(workspace);
    showCreateCheckpointPanel(intent, diff, files, entire.message, async (draft) => {
      const checkpoint = makeCheckpoint(intent, diff, files, draft, entire.latest);
      await saveCheckpoint(workspace, checkpoint);
      vscode.window.showInformationMessage('Checkpoint Compass: checkpoint saved.');
    });
  } catch (error) {
    showError('Could not capture the current Git state', error);
  }
}

async function compareIntentCommand(): Promise<void> {
  const workspace = getWorkspacePath();
  if (!workspace) return;
  try {
    const checkpoint = await loadLatestCheckpoint(workspace);
    const entireContext = await readEntireContext(workspace, checkpoint.entire);
    const issues = compareIntent(checkpoint, entireContext.available);
    const risks = await collectRisks(workspace, checkpoint);
    const riskPath = await saveRiskDashboard(workspace, checkpoint, risks);
    const panel = vscode.window.createWebviewPanel('checkpointCompass.compare', 'Compare to Intent', vscode.ViewColumn.One, { enableScripts: false });
    const entireSection = checkpoint.entire
      ? `<h2>Entire Checkpoint Context</h2><p>${escapeHtml(entireContext.message)}</p>${entireContext.text ? `<pre>${escapeHtml(entireContext.text)}</pre>` : ''}`
      : '<h2>Entire Checkpoint Context</h2><p>No Entire checkpoint is linked. The local record still contains manually captured reasoning, but the original agent session cannot be restored.</p>';
    panel.webview.html = createWebviewHtml(panel.webview, 'Compare Implementation to Intent', `<p><strong>Intent:</strong> ${escapeHtml(checkpoint.intent)}</p><p><strong>Risk dashboard:</strong> ${escapeHtml(path.basename(riskPath))}</p>${renderComparisonTable(issues)}${entireSection}<h2>Risk Dashboard</h2><pre>${escapeHtml(buildRiskDashboard(checkpoint, risks))}</pre>`);
  } catch (error) {
    showError('Could not compare the latest checkpoint', error);
  }
}

async function generateReportCommand(): Promise<void> {
  const workspace = getWorkspacePath();
  if (!workspace) return;
  try {
    const checkpoint = await loadLatestCheckpoint(workspace);
    const entireContext = await readEntireContext(workspace, checkpoint.entire);
    const issues = compareIntent(checkpoint, entireContext.available);
    const risks = await collectRisks(workspace, checkpoint);
    const riskDashboard = buildRiskDashboard(checkpoint, risks);
    const coverage = await testSnapshot(workspace);
    const entireSummary = checkpoint.entire
      ? `- Entire checkpoint: ${checkpoint.entire.checkpointId}\n- Entire context: ${entireContext.message}`
      : '- Entire checkpoint: Not linked';
    const report = `# Checkpoint Compass Release-Readiness Report\n\n- Checkpoint: ${checkpoint.timestamp}\n- Intent: ${checkpoint.intent}\n${entireSummary}\n\n## Intent vs. Implementation\n\n${renderMarkdownComparison(issues)}\n\n## Reasoning and Handoff Context\n\n### Attempts\n\n${formatList(checkpoint.agentSteps)}\n\n### Assumptions\n\n${formatList(checkpoint.assumptions)}\n\n### Failures or incomplete work\n\n${formatList(checkpoint.failures)}\n\n### Unresolved items\n\n${formatList(checkpoint.unresolved)}\n\n## Risk Dashboard\n\n${riskDashboard.replace(/^## Risks.*\n\n/, '')}\n## Test Coverage Snapshot\n\n${coverage}\n`;
    const reportPath = path.join(workspace, '.checkpoints', `${fileStem(checkpoint.timestamp)}-report.md`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, report, 'utf8');
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(reportPath));
    await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  } catch (error) {
    showError('Could not generate the release-readiness report', error);
  }
}

async function createHandoffCommand(): Promise<void> {
  const workspace = getWorkspacePath();
  if (!workspace) return;
  try {
    const checkpoint = await loadLatestCheckpoint(workspace);
    const entireContext = await readEntireContext(workspace, checkpoint.entire);
    const issues = compareIntent(checkpoint, entireContext.available);
    const risks = await collectRisks(workspace, checkpoint);
    const resumeInstructions = checkpoint.entire
      ? `1. Inspect the original reasoning: \`entire checkpoint explain --checkpoint ${checkpoint.entire.checkpointId} --full --no-pager\`\n2. Restore the latest saved session for the branch: \`entire session resume ${checkpoint.entire.branch ?? '<branch>'}\`\n3. Review the unresolved items and risks below before making changes.`
      : 'No Entire Checkpoint is linked. Review this handoff file and create a new Entire-tracked agent session before continuing.';
    const handoff = `# Checkpoint Compass Handoff\n\n## Goal\n\n${checkpoint.intent}\n\n## What changed\n\n${checkpoint.files.length ? checkpoint.files.map((file) => `- ${file}`).join('\n') : '- No files recorded.'}\n\n## What was attempted\n\n${formatList(checkpoint.agentSteps)}\n\n## Assumptions\n\n${formatList(checkpoint.assumptions)}\n\n## Failures or incomplete work\n\n${formatList(checkpoint.failures)}\n\n## Unresolved items\n\n${formatList(checkpoint.unresolved)}\n\n## Review findings\n\n${renderMarkdownComparison(issues)}\n\n## Risks\n\n${buildRiskDashboard(checkpoint, risks).replace(/^## Risks.*\n\n/, '')}\n\n## Continue with Entire\n\n${resumeInstructions}\n\n## Entire context status\n\n${entireContext.message}\n`;
    const handoffPath = path.join(workspace, '.checkpoints', `${fileStem(checkpoint.timestamp)}-handoff.md`);
    await fs.mkdir(path.dirname(handoffPath), { recursive: true });
    await fs.writeFile(handoffPath, handoff, 'utf8');
    await showMarkdown(handoffPath);
  } catch (error) {
    showError('Could not create the handoff document', error);
  }
}

async function openEntireContextCommand(): Promise<void> {
  const workspace = getWorkspacePath();
  if (!workspace) return;
  try {
    const checkpoint = await loadLatestCheckpoint(workspace);
    if (!checkpoint.entire) {
      vscode.window.showWarningMessage('The latest Checkpoint Compass record is not linked to an Entire checkpoint. Enable Entire and create a committed agent checkpoint first.');
      return;
    }
    const entireContext = await readEntireContext(workspace, checkpoint.entire);
    if (!entireContext.available || !entireContext.text) {
      vscode.window.showWarningMessage(entireContext.message);
      return;
    }
    const document = await vscode.workspace.openTextDocument({ content: entireContext.text, language: 'markdown' });
    await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  } catch (error) {
    showError('Could not open Entire checkpoint context', error);
  }
}

async function loadLatestCheckpoint(workspace: string): Promise<Checkpoint> {
  const directory = path.join(workspace, '.checkpoints');
  const files = (await fs.readdir(directory)).filter((file) => file.endsWith('.cp.json')).sort().reverse();
  if (!files[0]) throw new Error('No checkpoint found. Create a checkpoint first.');
  const checkpoint = JSON.parse(await fs.readFile(path.join(directory, files[0]), 'utf8')) as unknown;
  assertValidCheckpoint(checkpoint);
  return checkpoint;
}

async function saveCheckpoint(workspace: string, checkpoint: Checkpoint): Promise<string> {
  assertValidCheckpoint(checkpoint);
  const directory = path.join(workspace, '.checkpoints');
  await fs.mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${fileStem(checkpoint.timestamp)}.cp.json`);
  await fs.writeFile(filePath, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  return filePath;
}

async function collectRisks(workspace: string, checkpoint: Checkpoint): Promise<string[]> {
  const statusFiles = await getChangedFiles(workspace).catch(() => []);
  const files = [...new Set([...checkpoint.files, ...statusFiles])].filter((file) => !file.includes('node_modules'));
  return findTodoMarkers(files, (file) => {
    try { return require('node:fs').readFileSync(path.join(workspace, file), 'utf8'); } catch { return undefined; }
  });
}

async function saveRiskDashboard(workspace: string, checkpoint: Checkpoint, risks: string[]): Promise<string> {
  const riskPath = path.join(workspace, '.checkpoints', `${fileStem(checkpoint.timestamp)}-risk.md`);
  await fs.mkdir(path.dirname(riskPath), { recursive: true });
  await fs.writeFile(riskPath, buildRiskDashboard(checkpoint, risks), 'utf8');
  return riskPath;
}

async function showMarkdown(filePath: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
}

async function testSnapshot(workspace: string): Promise<string> {
  try {
    const result = await execFileAsync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['test', '--', '--json'], { cwd: workspace, timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
    return summarizeTestOutput(`${result.stdout}\n${result.stderr}`);
  } catch (error) {
    const output = error && typeof error === 'object' && 'stdout' in error ? String((error as { stdout?: unknown }).stdout ?? '') : '';
    return `Tests did not complete successfully. ${summarizeTestOutput(output)}`;
  }
}

function summarizeTestOutput(output: string): string {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.slice(-8).join('\n') || 'No test output was available.';
}

function getWorkspacePath(): string | undefined {
  const workspace = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspace) vscode.window.showErrorMessage('Open a workspace folder before using Checkpoint Compass.');
  return workspace;
}

function fileStem(timestamp: string): string {
  return timestamp.replace(/[:.]/g, '-').replace(/Z$/, 'Z');
}

function formatList(items?: string[]): string {
  return items?.length ? items.map((item) => `- ${item}`).join('\n') : '- Not recorded.';
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function showError(prefix: string, error: unknown): void {
  vscode.window.showErrorMessage(`${prefix}: ${error instanceof Error ? error.message : String(error)}`);
}

export function deactivate(): void { /* no resources to release */ }
