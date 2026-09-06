# Checkpoint Compass — Project Documentation

## 1. Overview

Checkpoint Compass is a Visual Studio Code extension that turns preserved development context into an input for review, risk assessment, handoff, and resuming agent-assisted work. It records why a change happened, what was attempted, assumptions, failures, unresolved work, and the Git diff. When [Entire](https://entire.io/) is enabled, it links this local record to the saved agent transcript and session checkpoint that produced the work.

The project currently targets:

- VS Code Webview UI
- A Node.js and TypeScript extension backend
- Git-backed workspaces
- Repository-local checkpoint storage

## 2. Why Checkpoints When Git Already Exists?

Git history is the authoritative record of **what** changed: commits, branches, diffs, and the final state of the code. Checkpoint Compass complements Git by preserving **why** the change happened and the reasoning that led to it.

| Git history records | Checkpoint context records |
| --- | --- |
| Files and lines changed | The intended outcome of the change |
| Commit messages | What the developer or agent attempted |
| The final implementation | Assumptions made along the way |
| Branch and merge history | Failed approaches and incomplete work |
| Test changes and results in code | Unresolved requirements and release risks |

This difference matters most in agent-assisted or multi-session work. A Git diff cannot show which prompt created a change, which design alternatives were rejected, why a temporary workaround remains, or what another developer should verify before release.

Checkpoint Compass stores a concise, reviewable summary of that context alongside the workspace. When Entire is enabled, the checkpoint additionally links to the Git-backed agent transcript and session state, so a developer or agent can inspect the original reasoning rather than reconstructing it from code alone.

Typical benefits include:

- **More accurate reviews:** Compare the implementation with its stated intent, not only with coding conventions.
- **Safer releases:** Surface assumptions, failed attempts, TODO/FIXME markers, and unresolved work in one risk dashboard.
- **Faster handoffs:** Give the next developer or agent the goal, decisions, known risks, and a route to the original session context.
- **Better resumption after a break:** Continue work without repeating exploration or retrying approaches that already failed.

Checkpoints do not replace disciplined commits, pull-request descriptions, tests, or architecture documentation. For small, well-documented human-authored changes, Git may be sufficient. Their value grows with the amount of reasoning that occurred outside the final diff.

## 3. Core Workflow

```text
Start an Entire-tracked agent session
      ↓
Capture intent, attempts, assumptions, failures, unresolved work + Git diff
      ↓
Link the latest committed Entire Checkpoint when available
      ↓
Save .checkpoints/<timestamp>.cp.json
      ↓
Compare implementation, reasoning trail, and checkpoint availability
      ↓
Generate risks, release report, or context handoff
```

## 4. VS Code Commands

Commands are available from the VS Code Command Palette.

| Command | Purpose |
| --- | --- |
| `Checkpoint Compass: Create New Checkpoint` | Captures the requested intent and current Git diff, then saves a checkpoint. |
| `Checkpoint Compass: Compare Implementation to Intent` | Compares intent keywords against the checkpoint diff and displays detected issues. |
| `Checkpoint Compass: Generate Release-Readiness Report` | Creates a Markdown report containing intent comparison, risks, and test output. |
| `Checkpoint Compass: Create Context Handoff` | Creates a Markdown briefing that a developer or agent can use to continue the work. |
| `Checkpoint Compass: Open Linked Entire Checkpoint Context` | Opens the saved Entire CLI context associated with the latest local checkpoint. |

The create-checkpoint command is also available from the editor title toolbar.

## 5. Project Structure

```text
Checkpoint-Compass/
├── src/
│   ├── extension.ts              Extension activation and command registration
│   ├── checkpointSchema.ts       Checkpoint types, JSON schema, and AJV validation
│   ├── entire.ts                 Entire CLI discovery, checkpoint lookup, and context retrieval
│   ├── git.ts                    Git commands and diff parsing
│   ├── analysis.ts               Intent comparison and risk analysis
│   └── ui/
│       ├── createCheckpoint.ts   Create-checkpoint Webview and checkpoint assembly
│       └── webview.ts             Shared Webview HTML helpers
├── test/
│   ├── checkpointSchema.test.js  Schema validation tests
│   └── analysis.test.js          Intent and risk-analysis tests
├── package.json                  Extension metadata and scripts
├── tsconfig.json                 TypeScript compiler configuration
├── README.md                     Short project introduction and setup guide
└── PROJECT_DOCUMENTATION.md     Detailed project documentation
```

## 6. Checkpoint Storage

Checkpoints are stored in the workspace root under `.checkpoints/`.

Example layout:

```text
.checkpoints/
├── 2026-09-06T14-30-00-000Z.cp.json
├── 2026-09-06T14-30-00-000Z-risk.md
└── 2026-09-06T14-30-00-000Z-report.md
```

The `.checkpoints/` directory is intentionally repository-local so checkpoint context can remain close to the code it describes. It can be added to `.gitignore` if checkpoints should remain local-only, or committed if the team wants them to be part of the project record.

## 7. Checkpoint Schema

Each checkpoint contains the following fields:

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | `1` or `2` | Schema version for future migrations. New records use version 2. |
| `timestamp` | ISO date-time string | Creation time of the checkpoint. |
| `intent` | string | The user’s description of what the change should accomplish. |
| `codeDiff` | string | Output of `git diff HEAD`. |
| `files` | string array | Files detected as changed. |
| `notes` | string, optional | Additional context supplied during checkpoint creation. |
| `unresolved` | string array | Assumptions or unresolved questions associated with the checkpoint. |
| `agentSteps` | string array | Actions attempted by the developer or agent. |
| `assumptions` | string array | Decisions requiring verification. |
| `failures` | string array | Failed attempts, missing environments, or incomplete work. |
| `agentLogs` | object array | Reserved for local prompt and response capture; Entire preserves the full session transcript. |
| `entire` | object, optional | Reference to the linked Entire checkpoint, branch, and session. |

Example:

```json
{
  "schemaVersion": 2,
  "timestamp": "2026-09-06T14:30:00.000Z",
  "intent": "Add validation for imported configuration",
  "codeDiff": "diff --git ...",
  "files": ["src/config.ts"],
  "agentSteps": ["Added parser validation", "Ran unit tests"],
  "assumptions": ["Existing clients handle validation errors"],
  "failures": ["Integration test environment is unavailable"],
  "unresolved": ["Confirm the release error message"],
  "agentLogs": [],
  "entire": {
    "source": "entire-cli",
    "checkpointId": "a3b2c4d5e6f7",
    "capturedAt": "2026-09-06T14:30:00.000Z",
    "branch": "main"
  }
}
```

Checkpoint files are validated with AJV before being written and when they are loaded for analysis.

## 8. Intent Comparison

The current comparison engine is intentionally lightweight. It:

1. Extracts meaningful words from the intent.
2. Removes common stop words.
3. Searches the checkpoint diff for each remaining keyword.
4. Reports keywords that are not found.
5. Reports an empty implementation diff as a mismatch.
6. Treats unavailable Entire context as a handoff and review risk.

The output includes:

| Column | Description |
| --- | --- |
| File | Changed file associated with the issue. |
| Line | Approximate changed line number. |
| Issue | Detected intent mismatch. |
| Suggestion | Suggested follow-up action. |

This is a heuristic MVP check, not a semantic or security review. Similar words, indirect implementations, and behavior that is not visible in the diff may not be recognized.

## 9. Risk Dashboard

The risk dashboard combines:

- Assumptions requiring verification.
- Failed or incomplete attempts.
- Entries in the checkpoint’s `unresolved` array.
- `TODO` markers in changed files.
- `FIXME` markers in changed files.
- A missing Entire checkpoint link or missing agent-step record.

Example:

```markdown
## Risks for 2026-09-06T14:30:00.000Z

- Unresolved assumption: Backward compatibility still needs confirmation.
- src/config.ts line 42: // TODO: remove temporary fallback
```

The dashboard is generated automatically during the compare workflow and saved next to the checkpoint.

## 10. Release-Readiness Report

The report command produces a Markdown file with:

1. Checkpoint timestamp and intent.
2. Intent-versus-implementation findings.
3. Risk dashboard contents.
4. A test output snapshot from `npm test -- --json`.

The generated file is opened in a VS Code editor tab for review or copy-paste into a pull request.

The handoff command creates a separate Markdown briefing with the goal, files touched, attempts, assumptions, failures, unresolved work, risks, and the Entire CLI commands needed to inspect or resume the source session.

## 11. Entire Integration

Entire is the durable agent-context layer for this workflow. Its CLI preserves the full prompt, transcript, tool activity, and checkpoint metadata when agent work is committed. Checkpoint Compass stores only a stable Entire checkpoint reference, then reads the saved context during review, reporting, and handoff.

Set up Entire before beginning an agent-assisted task:

```bash
entire enable --agent codex
```

The extension detects checkpoints with `entire checkpoint list --json`; use the following commands to inspect original reasoning or restore the latest session for a branch:

```bash
entire checkpoint explain --checkpoint <id> --full --no-pager
entire session resume <branch>
```

If Entire is unavailable or there is no committed checkpoint yet, Checkpoint Compass remains usable but reports the missing reasoning trail as a risk. It never installs or enables Entire automatically.

## 12. Development Setup

Requirements:

- Node.js 20 or newer recommended
- npm
- VS Code
- Git

Install dependencies and run validation:

```bash
npm install
npm test
```

Compile the extension only:

```bash
npm run compile
```

To launch the extension during development:

1. Open the project in VS Code.
2. Run the project from the Extension Development Host configuration or press `F5`.
3. Open a Git-backed workspace in the Extension Development Host.
4. Run one of the Checkpoint Compass commands from the Command Palette.

## 13. Testing

The test suite uses Node’s built-in test runner.

Current coverage includes:

- Valid checkpoint acceptance.
- Missing intent rejection.
- Unknown field rejection.
- Invalid timestamp rejection.
- Intent keyword mismatch detection.
- TODO/FIXME detection with line numbers.
- Entire-checkpoint reference validation.
- Missing Entire context detection for handoff.

Run all tests with:

```bash
npm test
```

## 14. Current Limitations

- Intent comparison uses keyword matching rather than semantic analysis.
- ESLint and other language-specific analyzers are not currently invoked.
- Intent comparison uses keywords rather than semantic verification.
- Checkpoint Compass reads the Entire CLI but does not create, configure, or install Entire automatically.
- The CLI and CI integration for Checkpoint Compass itself are not yet implemented.
- Test output is captured as a text snapshot rather than normalized coverage metrics.

## 15. Suggested Future Work

### Near term

- Add optional ESLint or language-service diagnostics to comparison results.
- Add integration tests using a temporary Git repository.
- Add a tree view for browsing checkpoints.

### Later iterations

- Add semantic comparison that uses the linked Entire transcript and stated acceptance criteria.
- Add a `cp-compass` CLI for local and CI usage.
- Add configurable checkpoint storage locations.
- Add report templates for pull requests and release sign-off.
- Add semantic comparison backed by a configurable model.

## 16. Design Decisions

### Entire as the durable agent record

The extension stores concise review and handoff metadata in `.checkpoints/`, while Entire stores the durable, restorable agent-session record in Git-backed checkpoint storage. This keeps reports compact while retaining a path to the full original reasoning.

### Repository-local storage

The MVP stores checkpoints in `.checkpoints/` so the recorded intent and implementation context can be associated with a specific workspace. Teams can choose whether to commit or ignore this directory.

### Webview-based UI

Webviews provide enough flexibility for the initial form, diff preview, comparison table, and future report controls without introducing a separate frontend framework.

### TypeScript backend

TypeScript provides typed checkpoint data, safer command implementations, and straightforward integration with the VS Code extension API.
