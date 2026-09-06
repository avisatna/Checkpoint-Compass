import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function runGit(workspacePath: string, args: string[]): Promise<string> {
  const result = await execFileAsync('git', args, { cwd: workspacePath, maxBuffer: 5 * 1024 * 1024 });
  return result.stdout;
}

export async function getDiff(workspacePath: string): Promise<string> {
  return runGit(workspacePath, ['diff', 'HEAD']);
}

export async function getChangedFiles(workspacePath: string): Promise<string[]> {
  const output = await runGit(workspacePath, ['status', '--porcelain']);
  return output.split(/\r?\n/).filter(Boolean).map((line) => line.slice(3).trim()).filter(Boolean);
}

export function filesFromDiff(diff: string): string[] {
  const files = new Set<string>();
  for (const match of diff.matchAll(/^diff --git a\/(.+?) b\/(.+)$/gm)) {
    files.add(match[2]);
  }
  return [...files];
}

export interface DiffLine {
  file: string;
  line: number;
  text: string;
}

export function addedLines(diff: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let file = '';
  let newLine = 0;
  for (const rawLine of diff.split(/\r?\n/)) {
    const fileMatch = rawLine.match(/^diff --git a\/.+ b\/(.+)$/);
    if (fileMatch) {
      file = fileMatch[1];
      continue;
    }
    const hunk = rawLine.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (rawLine.startsWith('+') && !rawLine.startsWith('+++')) {
      lines.push({ file, line: newLine, text: rawLine.slice(1) });
      newLine += 1;
    } else if (!rawLine.startsWith('-') && !rawLine.startsWith('\\')) {
      newLine += 1;
    }
  }
  return lines;
}
