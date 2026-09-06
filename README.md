# Checkpoint Compass

Checkpoint Compass is a VS Code extension that records implementation intent alongside the current Git diff, then turns that checkpoint into an intent comparison, risk dashboard, and release-readiness report.

## MVP commands

Open the Command Palette and run:

- `Checkpoint Compass: Create New Checkpoint`
- `Checkpoint Compass: Compare Implementation to Intent`
- `Checkpoint Compass: Generate Release-Readiness Report`

Checkpoints and generated Markdown are stored in the workspace’s hidden `.checkpoints/` folder. LLM prompt/response capture is reserved for a later iteration; the checkpoint schema already includes an `agentLogs` field for forward compatibility. CI and CLI integration remain optional and are not required to use the extension.

## Development

```bash
npm install
npm run compile
npm test
```

Press `F5` in VS Code to launch an Extension Development Host. The extension expects a Git-backed workspace. The comparison is intentionally lightweight for the MVP: it tokenizes the intent and checks whether meaningful intent keywords appear in the checkpoint diff. TODO/FIXME markers in changed files and unresolved checkpoint entries are included in the risk dashboard.
