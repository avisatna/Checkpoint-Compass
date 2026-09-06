import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { EntireCheckpointReference } from './checkpointSchema';

const execFileAsync = promisify(execFile);

export interface EntireDiscovery {
  available: boolean;
  version?: string;
  latest?: EntireCheckpointReference;
  message: string;
}

export interface EntireContext {
  available: boolean;
  text?: string;
  message: string;
}

export async function discoverEntire(workspacePath: string): Promise<EntireDiscovery> {
  try {
    const version = (await runEntire(workspacePath, ['version'])).trim();
    const latest = await latestEntireCheckpoint(workspacePath);
    return {
      available: true,
      version,
      latest,
      message: latest
        ? `Entire CLI detected. Linked checkpoint: ${latest.checkpointId}.`
        : 'Entire CLI detected, but no committed Entire checkpoint is available on this branch yet.'
    };
  } catch {
    return {
      available: false,
      message: 'Entire CLI was not found. Install it and run “entire enable --agent codex” to preserve agent sessions automatically.'
    };
  }
}

export async function readEntireContext(workspacePath: string, reference?: EntireCheckpointReference): Promise<EntireContext> {
  if (!reference) return { available: false, message: 'No Entire checkpoint is linked to this Checkpoint Compass record.' };
  const primaryArgs = ['checkpoint', 'explain', '--checkpoint', reference.checkpointId, '--full', '--no-pager'];
  try {
    const output = await runEntire(workspacePath, primaryArgs);
    return { available: true, text: clip(output), message: `Loaded Entire checkpoint ${reference.checkpointId}.` };
  } catch {
    try {
      const output = await runEntire(workspacePath, ['explain', '--checkpoint', reference.checkpointId, '--full', '--no-pager']);
      return { available: true, text: clip(output), message: `Loaded Entire checkpoint ${reference.checkpointId}.` };
    } catch {
      return { available: false, message: `Could not read Entire checkpoint ${reference.checkpointId}. Ensure its metadata is available locally or fetch it from the checkpoint remote.` };
    }
  }
}

async function latestEntireCheckpoint(workspacePath: string): Promise<EntireCheckpointReference | undefined> {
  const output = await runEntire(workspacePath, ['checkpoint', 'list', '--json']);
  const parsed = JSON.parse(output) as unknown;
  const entries = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.checkpoints)
      ? parsed.checkpoints
      : isRecord(parsed) && Array.isArray(parsed.items)
        ? parsed.items
        : [];
  const latest = entries[0];
  if (!isRecord(latest)) return undefined;
  const checkpointId = stringField(latest, 'checkpoint_id') ?? stringField(latest, 'id');
  if (!checkpointId) return undefined;
  return {
    source: 'entire-cli',
    checkpointId,
    capturedAt: new Date().toISOString(),
    branch: stringField(latest, 'branch'),
    sessionId: stringField(latest, 'session_id'),
    message: stringField(latest, 'message') ?? stringField(latest, 'session_prompt')
  };
}

async function runEntire(workspacePath: string, args: string[]): Promise<string> {
  const command = entireCommand();
  const result = await execFileAsync(command, args, { cwd: workspacePath, timeout: 20000, maxBuffer: 5 * 1024 * 1024 });
  return result.stdout;
}

function entireCommand(): string {
  if (process.platform !== 'win32') return 'entire';
  const scoopShim = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'scoop', 'shims', 'entire.exe') : undefined;
  return scoopShim && existsSync(scoopShim) ? scoopShim : 'entire.exe';
}

function clip(value: string): string {
  const maximumLength = 24000;
  return value.length <= maximumLength ? value : `${value.slice(0, maximumLength)}\n\n[Entire context clipped for the webview; use Entire CLI for the full transcript.]`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringField(value: Record<string, unknown>, key: string): string | undefined {
  return typeof value[key] === 'string' ? value[key] : undefined;
}
