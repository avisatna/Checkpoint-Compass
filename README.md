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

## Install and run locally

Checkpoint Compass is currently run from source as a VS Code development extension. You need Node.js 20 or later, npm, Git, and Visual Studio Code.

### 1. Prepare the extension project

Open PowerShell and run:

```powershell
cd C:\GitProjects\Checkpoint-Compass
npm install
npm run compile
```

### 2. Start the extension

1. Open `C:\GitProjects\Checkpoint-Compass` in **Visual Studio Code**.
2. Open **Run and Debug** with `Ctrl+Shift+D`.
3. Select **Run Checkpoint Compass**.
4. Press `F5`.

VS Code opens a separate **Extension Development Host** window with Checkpoint Compass installed for that window.

### 3. Use it in a Git repository

1. In the **Extension Development Host** window, select **File → Open Folder**.
2. Open the Git repository you want to work in.
3. Make or review some changes so the repository has a Git diff.
4. Open the Command Palette with `Ctrl+Shift+P`.
5. Run **Checkpoint Compass: Create New Checkpoint**.

The checkpoint and its generated reports are written to that target repository’s `.checkpoints/` folder. The commands are VS Code Command Palette actions; do not enter their names into PowerShell.

### Optional: add Entire session context

In the target Git repository, enable Entire before beginning an agent-assisted task:

```powershell
entire enable --agent codex
```

Approve the Entire hooks in Codex, complete an agent session, and commit the work. Checkpoint Compass will then link its local checkpoint to the latest Entire checkpoint on the branch.

## Development and verification

```bash
npm install
npm run compile
npm test
```

The extension expects a Git-backed workspace. The comparison is intentionally lightweight for the MVP: it tokenizes the intent and checks whether meaningful intent keywords appear in the checkpoint diff. TODO/FIXME markers, assumptions, failed attempts, unresolved entries, and missing Entire context are included in the risk dashboard.
