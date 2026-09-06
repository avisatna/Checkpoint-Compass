import * as vscode from 'vscode';

export function createWebviewHtml(webview: vscode.Webview, title: string, body: string, script = ''): string {
  const nonce = getNonce();
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title><style>
    body{font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);padding:20px;line-height:1.45}h1{font-size:1.4em}label{display:block;margin:16px 0 6px;font-weight:600}textarea,input{box-sizing:border-box;width:100%;padding:8px;color:var(--vscode-input-foreground);background:var(--vscode-input-background);border:1px solid var(--vscode-input-border)}textarea{min-height:110px;font-family:var(--vscode-editor-font-family)}button{margin-top:18px;padding:8px 14px;color:var(--vscode-button-foreground);background:var(--vscode-button-background);border:0;cursor:pointer}button:hover{background:var(--vscode-button-hoverBackground)}pre{white-space:pre-wrap;max-height:360px;overflow:auto;background:var(--vscode-textCodeBlock-background);padding:12px;border-radius:4px}.ok{color:var(--vscode-testing-iconPassed)}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid var(--vscode-panel-border);padding:8px;text-align:left;vertical-align:top}th{background:var(--vscode-editor-inactiveSelectionBackground)}small{opacity:.8}
  </style></head><body><h1>${title}</h1>${body}<script nonce="${nonce}">${script}</script></body></html>`;
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
