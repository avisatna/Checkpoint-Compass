import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { assertValidCheckpoint, Checkpoint } from './checkpointSchema';
import { buildRiskDashboard, compareIntent, findTodoMarkers, renderComparisonTable, renderMarkdownComparison } from './analysis';
import { filesFromDiff, getChangedFiles, getDiff, runGit } from './git';
import { createWebviewHtml } from './ui/webview';
import { makeCheckpoint, showCreateCheckpointPanel } from './ui/createCheckpoint';

const execFileAsync = promisify(execFile);

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('checkpointCompass.createCheckpoint', createCheckpoint),
    vscode.commands.registerCommand('checkpointCompass.compareIntent', compareIntentCommand),
    vscode.commands.registerCommand('checkpointCompass.generateReport', generateReportCommand)
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
    showCreateCheckpointPanel(vscode.Uri.file(workspace), intent, diff, files, async (notes) => {
      const checkpoint = makeCheckpoint(intent, diff, files, notes);
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
    const issues = compareIntent(checkpoint);
    const risks = await collectRisks(workspace, checkpoint);
    const riskPath = await saveRiskDashboard(workspace, checkpoint, risks);
    const panel = vscode.window.createWebviewPanel('checkpointCompass.compare', 'Compare to Intent', vscode.ViewColumn.One, { enableScripts: false });
    panel.webview.html = createWebviewHtml(panel.webview, 'Compare Implementation to Intent', `<p><strong>Intent:</strong> ${escapeHtml(checkpoint.intent)}</p><p><strong>Risk dashboard:</strong> ${escapeHtml(path.basename(riskPath))}</p>${renderComparisonTable(issues)}<h2>Risk Dashboard</h2><pre>${escapeHtml(buildRiskDashboard(checkpoint, risks))}</pre>`);
  } catch (error) {
    showError('Could not compare the latest checkpoint', error);
  }
}

async function generateReportCommand(): Promise<void> {
  const workspace = getWorkspacePath();
  if (!workspace) return;
  try {
    const checkpoint = await loadLatestCheckpoint(workspace);
    const issues = compareIntent(checkpoint);
    const risks = await collectRisks(workspace, checkpoint);
    const riskDashboard = buildRiskDashboard(checkpoint, risks);
    const coverage = await testSnapshot(workspace);
    const report = `# Checkpoint Compass Release-Readiness Report\n\n- Checkpoint: ${checkpoint.timestamp}\n- Intent: ${checkpoint.intent}\n\n## Intent vs. Implementation\n\n${renderMarkdownComparison(issues)}\n\n## Risk Dashboard\n\n${riskDashboard.replace(/^## Risks.*\n\n/, '')}\n## Test Coverage Snapshot\n\n${coverage}\n`;
    const reportPath = path.join(workspace, '.checkpoints', `${fileStem(checkpoint.timestamp)}-report.md`);
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, report, 'utf8');
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(reportPath));
    await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
  } catch (error) {
    showError('Could not generate the release-readiness report', error);
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

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function showError(prefix: string, error: unknown): void {
  vscode.window.showErrorMessage(`${prefix}: ${error instanceof Error ? error.message : String(error)}`);
}

export function deactivate(): void { /* no resources to release */ }
