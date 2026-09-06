import { Checkpoint } from './checkpointSchema';
import { addedLines, DiffLine, filesFromDiff } from './git';

export interface ComparisonIssue {
  file: string;
  line: number;
  issue: string;
  suggestion: string;
}

const STOP_WORDS = new Set('a an and are as at be by for from in into is it of on or that the to with this implement add create make ensure should support update use'.split(' '));

export function intentKeywords(intent: string): string[] {
  return [...new Set((intent.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) ?? []).filter((word) => !STOP_WORDS.has(word)))];
}

export function compareIntent(checkpoint: Checkpoint): ComparisonIssue[] {
  const keywords = intentKeywords(checkpoint.intent);
  const searchableDiff = checkpoint.codeDiff.toLowerCase();
  const changed = addedLines(checkpoint.codeDiff);
  const fallbackFile = checkpoint.files[0] || filesFromDiff(checkpoint.codeDiff)[0] || '(no changed file)';
  const issues: ComparisonIssue[] = [];

  for (const keyword of keywords) {
    if (!searchableDiff.includes(keyword)) {
      issues.push({
        file: fallbackFile,
        line: changed[0]?.line || 1,
        issue: `Intent keyword “${keyword}” was not found in the implementation diff.`,
        suggestion: `Verify that the implementation covers “${keyword}”, or clarify the intent.`
      });
    }
  }

  if (changed.length === 0 && checkpoint.codeDiff.trim().length === 0) {
    issues.push({
      file: fallbackFile,
      line: 1,
      issue: 'The checkpoint contains no implementation diff.',
      suggestion: 'Make the intended changes and create a new checkpoint.'
    });
  }
  return issues;
}

export function findTodoMarkers(files: string[], readFile: (file: string) => string | undefined): string[] {
  const risks: string[] = [];
  for (const file of files) {
    const content = readFile(file);
    if (content === undefined) continue;
    content.split(/\r?\n/).forEach((line, index) => {
      if (/\bTODO\b|\bFIXME\b/i.test(line)) risks.push(`${file} line ${index + 1}: ${line.trim()}`);
    });
  }
  return risks;
}

export function buildRiskDashboard(checkpoint: Checkpoint, risks: string[], generatedAt = new Date().toISOString()): string {
  const entries = [
    ...checkpoint.unresolved.map((entry) => `Unresolved assumption: ${entry}`),
    ...risks
  ];
  return `## Risks for ${checkpoint.timestamp}\n\n_Generated ${generatedAt}_\n\n${entries.length ? entries.map((entry) => `- ${entry}`).join('\n') : '- No unresolved assumptions or TODO/FIXME markers detected.'}\n`;
}

export function renderComparisonTable(issues: ComparisonIssue[]): string {
  if (issues.length === 0) return '<p class="ok">No intent mismatches detected by the MVP keyword check.</p>';
  return `<table><thead><tr><th>File</th><th>Line</th><th>Issue</th><th>Suggestion</th></tr></thead><tbody>${issues.map((item) => `<tr><td>${escapeHtml(item.file)}</td><td>${item.line}</td><td>${escapeHtml(item.issue)}</td><td>${escapeHtml(item.suggestion)}</td></tr>`).join('')}</tbody></table>`;
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function renderMarkdownComparison(issues: ComparisonIssue[]): string {
  if (issues.length === 0) return 'No intent mismatches detected by the MVP keyword check.';
  return issues.map((issue) => `- **${issue.file}:${issue.line}** — ${issue.issue} Suggestion: ${issue.suggestion}`).join('\n');
}
