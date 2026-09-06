# Checkpoint Compass

Checkpoint Compass is a VS Code extension that makes preserved development context part of code review and handoff. It records why a change happened, what was attempted, assumptions, failures, unresolved work, and the current Git diff; when [Entire](https://entire.io/) is enabled, it also links the local record to the checkpointed agent transcript that produced the change.

## MVP commands

Open the Command Palette and run:

- `Checkpoint Compass: Create New Checkpoint`
- `Checkpoint Compass: Compare Implementation to Intent`
- `Checkpoint Compass: Generate Release-Readiness Report`
- `Checkpoint Compass: Create Context Handoff`
- `Checkpoint Compass: Open Linked Entire Checkpoint Context`

Checkpoints and generated Markdown are stored in the workspace’s hidden `.checkpoints/` folder. The create form records the work performed, assumptions, failed attempts, unresolved requirements, and notes. This local record is deliberately small and reviewable; Entire remains the source for the full agent transcript and session state.

## Entire integration

Install and enable the Entire CLI in the repository before starting an agent session:

```bash
entire enable --agent codex
```

Entire creates persistent checkpoint context when the session is committed. Checkpoint Compass detects the latest Entire checkpoint on the active branch and links it to its own context record. Comparisons, reports, and handoffs then include the availability of the preserved session. To inspect the original reasoning or continue on another machine, use the extension command above or:

```bash
entire checkpoint explain --checkpoint <id> --full --no-pager
entire session resume <branch>
```

## Development

```bash
npm install
npm run compile
npm test
```

Press `F5` in VS Code to launch an Extension Development Host. The extension expects a Git-backed workspace. The comparison is intentionally lightweight for the MVP: it tokenizes the intent and checks whether meaningful intent keywords appear in the checkpoint diff. TODO/FIXME markers, assumptions, failed attempts, unresolved entries, and missing Entire context are included in the risk dashboard.
