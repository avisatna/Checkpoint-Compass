# Checkpoint Compass — Project Documentation

## 1. Overview

Checkpoint Compass is a Visual Studio Code extension that records the intent behind a code change and compares that intent with the current implementation. It creates checkpoint files from the current Git diff, identifies basic intent mismatches, detects unresolved risks, and generates a release-readiness report.

The project currently targets:

- VS Code Webview UI
- A Node.js and TypeScript extension backend
- Git-backed workspaces
- Repository-local checkpoint storage

## 2. Core Workflow

```text
Create checkpoint
      ↓
Capture intent + Git diff
      ↓
Save .checkpoints/<timestamp>.cp.json
      ↓
Compare implementation to intent
      ↓
Scan unresolved entries and TODO/FIXME markers
      ↓
Generate risk dashboard and release report
```

## 3. VS Code Commands

Commands are available from the VS Code Command Palette.

| Command | Purpose |
| --- | --- |
| `Checkpoint Compass: Create New Checkpoint` | Captures the requested intent and current Git diff, then saves a checkpoint. |
| `Checkpoint Compass: Compare Implementation to Intent` | Compares intent keywords against the checkpoint diff and displays detected issues. |
| `Checkpoint Compass: Generate Release-Readiness Report` | Creates a Markdown report containing intent comparison, risks, and test output. |

The create-checkpoint command is also available from the editor title toolbar.

## 4. Project Structure

```text
Checkpoint-Compass/
├── src/
│   ├── extension.ts              Extension activation and command registration
│   ├── checkpointSchema.ts       Checkpoint types, JSON schema, and AJV validation
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

## 5. Checkpoint Storage

Checkpoints are stored in the workspace root under `.checkpoints/`.

Example layout:

```text
.checkpoints/
├── 2026-09-06T14-30-00-000Z.cp.json
├── 2026-09-06T14-30-00-000Z-risk.md
└── 2026-09-06T14-30-00-000Z-report.md
```

The `.checkpoints/` directory is intentionally repository-local so checkpoint context can remain close to the code it describes. It can be added to `.gitignore` if checkpoints should remain local-only, or committed if the team wants them to be part of the project record.

## 6. Checkpoint Schema

Each checkpoint contains the following fields:

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | `1` | Schema version for future migrations. |
| `timestamp` | ISO date-time string | Creation time of the checkpoint. |
| `intent` | string | The user’s description of what the change should accomplish. |
| `codeDiff` | string | Output of `git diff HEAD`. |
| `files` | string array | Files detected as changed. |
| `notes` | string, optional | Additional context supplied during checkpoint creation. |
| `unresolved` | string array | Assumptions or unresolved questions associated with the checkpoint. |
| `agentLogs` | object array | Reserved for future LLM prompt and response capture. |

Example:

```json
{
  "schemaVersion": 1,
  "timestamp": "2026-09-06T14:30:00.000Z",
  "intent": "Add validation for imported configuration",
  "codeDiff": "diff --git ...",
  "files": ["src/config.ts"],
  "notes": "Validation should preserve existing defaults.",
  "unresolved": [],
  "agentLogs": []
}
```

Checkpoint files are validated with AJV before being written and when they are loaded for analysis.

## 7. Intent Comparison

The current comparison engine is intentionally lightweight. It:

1. Extracts meaningful words from the intent.
2. Removes common stop words.
3. Searches the checkpoint diff for each remaining keyword.
4. Reports keywords that are not found.
5. Reports an empty implementation diff as a mismatch.

The output includes:

| Column | Description |
| --- | --- |
| File | Changed file associated with the issue. |
| Line | Approximate changed line number. |
| Issue | Detected intent mismatch. |
| Suggestion | Suggested follow-up action. |

This is a heuristic MVP check, not a semantic or security review. Similar words, indirect implementations, and behavior that is not visible in the diff may not be recognized.

## 8. Risk Dashboard

The risk dashboard combines:

- Entries in the checkpoint’s `unresolved` array.
- `TODO` markers in changed files.
- `FIXME` markers in changed files.

Example:

```markdown
## Risks for 2026-09-06T14:30:00.000Z

- Unresolved assumption: Backward compatibility still needs confirmation.
- src/config.ts line 42: // TODO: remove temporary fallback
```

The dashboard is generated automatically during the compare workflow and saved next to the checkpoint.

## 9. Release-Readiness Report

The report command produces a Markdown file with:

1. Checkpoint timestamp and intent.
2. Intent-versus-implementation findings.
3. Risk dashboard contents.
4. A test output snapshot from `npm test -- --json`.

The generated file is opened in a VS Code editor tab for review or copy-paste into a pull request.

## 10. Development Setup

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

## 11. Testing

The test suite uses Node’s built-in test runner.

Current coverage includes:

- Valid checkpoint acceptance.
- Missing intent rejection.
- Unknown field rejection.
- Invalid timestamp rejection.
- Intent keyword mismatch detection.
- TODO/FIXME detection with line numbers.

Run all tests with:

```bash
npm test
```

## 12. Current Limitations

- Intent comparison uses keyword matching rather than semantic analysis.
- ESLint and other language-specific analyzers are not currently invoked.
- LLM prompt and response logging is reserved for a later iteration.
- The CLI and CI integration are not yet implemented.
- Test output is captured as a text snapshot rather than normalized coverage metrics.
- Checkpoint creation currently initializes `unresolved` as an empty list; unresolved entries can be populated by future UI or CLI workflows.

## 13. Suggested Future Work

### Near term

- Add a dedicated unresolved-assumptions field to the create-checkpoint Webview.
- Add optional ESLint or language-service diagnostics to comparison results.
- Add integration tests using a temporary Git repository.
- Add a tree view for browsing checkpoints.

### Later iterations

- Add automatic LLM prompt and response capture.
- Add a `cp-compass` CLI for local and CI usage.
- Add configurable checkpoint storage locations.
- Add report templates for pull requests and release sign-off.
- Add semantic comparison backed by a configurable model.

## 14. Design Decisions

### Repository-local storage

The MVP stores checkpoints in `.checkpoints/` so the recorded intent and implementation context can be associated with a specific workspace. Teams can choose whether to commit or ignore this directory.

### Webview-based UI

Webviews provide enough flexibility for the initial form, diff preview, comparison table, and future report controls without introducing a separate frontend framework.

### TypeScript backend

TypeScript provides typed checkpoint data, safer command implementations, and straightforward integration with the VS Code extension API.
