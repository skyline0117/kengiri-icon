import * as os from "node:os";
import * as path from "node:path";
import * as vscode from "vscode";

const LAUNCHER_VIEW_ID = "kengiriIcon.launcherView";
const REPOSITORY_URL = "https://github.com/oguzhan18/kengiri-icon";

function getNonce(): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getGeneratorWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "webview.js"));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "webview.css"));
  const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "assets", "kengiri-logo.png"));
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource} data: blob:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <link href="${styleUri}" rel="stylesheet" />
    <title>Kengiri Icon Generator</title>
  </head>
  <body>
    <div id="app"></div>
    <script nonce="${nonce}">
      window.kengiriVscode = acquireVsCodeApi();
      window.kengiriAssets = { logoUri: "${logoUri}" };
    </script>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}

function getLauncherViewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "assets", "kengiri-logo.png"));
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource} data: blob:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';"
    />
    <style>
      :root {
        color-scheme: var(--vscode-color-scheme, light);
      }

      body {
        margin: 0;
        padding: 12px;
        font-family: var(--vscode-font-family, "Segoe UI", sans-serif);
        color: var(--vscode-editor-foreground);
        background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      }

      .card {
        border: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
        border-radius: 6px;
        background: var(--vscode-editor-background);
        padding: 12px;
      }

      .logo-button {
        width: 100%;
        border: 0;
        padding: 0;
        margin: 0;
        background: transparent;
        cursor: pointer;
      }

      .logo {
        display: block;
        width: 84px;
        height: 84px;
        margin: 0 auto 10px;
      }

      h2 {
        margin: 0;
        font-size: 15px;
        text-align: center;
      }

      p {
        margin: 6px 0 12px;
        font-size: 12px;
        color: var(--vscode-descriptionForeground);
        text-align: center;
      }

      .actions {
        display: grid;
        gap: 8px;
      }

      button {
        height: 30px;
        border: 1px solid var(--vscode-button-background);
        border-radius: 4px;
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }

      button:hover {
        background: var(--vscode-button-hoverBackground);
        border-color: var(--vscode-button-hoverBackground);
      }

      .ghost {
        border-color: var(--vscode-input-border, var(--vscode-panel-border));
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
      }

      .ghost:hover {
        border-color: var(--vscode-focusBorder);
        background: var(--vscode-list-hoverBackground, var(--vscode-input-background));
      }
    </style>
  </head>
  <body>
    <div class="card">
      <button class="logo-button" id="logoButton" title="Open Kengiri Icon Generator">
        <img src="${logoUri}" class="logo" alt="Kengiri Icon Logo" />
      </button>
      <h2>Kengiri Icon</h2>
      <p>Open generator panel or visit project repository.</p>
      <div class="actions">
        <button id="openGenerator">Open Generator</button>
        <button class="ghost" id="openRepo">Open GitHub</button>
      </div>
    </div>

    <script nonce="${nonce}">
      const vscode = acquireVsCodeApi();
      const openMessage = { type: "openGenerator" };

      document.getElementById("logoButton")?.addEventListener("click", () => {
        vscode.postMessage(openMessage);
      });

      document.getElementById("openGenerator")?.addEventListener("click", () => {
        vscode.postMessage(openMessage);
      });

      document.getElementById("openRepo")?.addEventListener("click", () => {
        vscode.postMessage({
          type: "openExternal",
          url: "${REPOSITORY_URL}"
        });
      });
    </script>
  </body>
</html>`;
}

async function openExternalLink(
  webview: vscode.Webview,
  payload: { url?: string }
): Promise<void> {
  if (!payload.url) {
    webview.postMessage({ type: "externalOpenError", message: "Missing URL." });
    return;
  }

  try {
    const uri = vscode.Uri.parse(payload.url);
    if (uri.scheme !== "https" && uri.scheme !== "http") {
      throw new Error("Only http/https links are allowed.");
    }

    await vscode.env.openExternal(uri);
    webview.postMessage({ type: "externalOpened" });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    webview.postMessage({ type: "externalOpenError", message: messageText });
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const distRoot = vscode.Uri.joinPath(context.extensionUri, "dist");
  const assetsRoot = vscode.Uri.joinPath(context.extensionUri, "assets");
  let generatorPanel: vscode.WebviewPanel | undefined;
  let openedFromActivityBar = false;

  const openGeneratorPanel = () => {
    if (generatorPanel) {
      generatorPanel.reveal(vscode.ViewColumn.One, true);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "kengiriIconGenerator",
      "Kengiri Icon Generator",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [distRoot, assetsRoot]
      }
    );
    generatorPanel = panel;

    panel.webview.html = getGeneratorWebviewHtml(panel.webview, context.extensionUri);

    panel.onDidDispose(() => {
      generatorPanel = undefined;
    });

    panel.webview.onDidReceiveMessage(
      async (message: unknown) => {
        if (!message || typeof message !== "object") {
          return;
        }

        const payload = message as {
          type?: string;
          base64?: string;
          fileName?: string;
          url?: string;
        };

        if (payload.type === "openExternal") {
          await openExternalLink(panel.webview, payload);
          return;
        }

        if (payload.type !== "saveZip" || !payload.base64) {
          return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
        const defaultFileName = payload.fileName ?? "AppIcons.zip";
        const defaultSaveUri = workspaceFolder
          ? vscode.Uri.joinPath(workspaceFolder, defaultFileName)
          : vscode.Uri.file(path.join(os.homedir(), defaultFileName));

        const saveUri = await vscode.window.showSaveDialog({
          defaultUri: defaultSaveUri,
          filters: {
            "Zip Archive": ["zip"]
          },
          saveLabel: "Save icon package"
        });

        if (!saveUri) {
          panel.webview.postMessage({ type: "saveCanceled" });
          return;
        }

        try {
          const bytes = Buffer.from(payload.base64, "base64");
          await vscode.workspace.fs.writeFile(saveUri, new Uint8Array(bytes));
          panel.webview.postMessage({ type: "saveSuccess", path: saveUri.fsPath });

          const openAction = "Reveal in Finder/Explorer";
          const selected = await vscode.window.showInformationMessage(
            `Icon package saved: ${path.basename(saveUri.fsPath)}`,
            openAction
          );

          if (selected === openAction) {
            await vscode.commands.executeCommand("revealFileInOS", saveUri);
          }
        } catch (error) {
          const messageText = error instanceof Error ? error.message : String(error);
          panel.webview.postMessage({ type: "saveError", message: messageText });
          void vscode.window.showErrorMessage(`Could not save icon package: ${messageText}`);
        }
      },
      undefined,
      context.subscriptions
    );
  };

  const openGeneratorCommand = vscode.commands.registerCommand("kengiriIcon.openGenerator", () => {
    openGeneratorPanel();
  });

  const launcherViewProvider: vscode.WebviewViewProvider = {
    resolveWebviewView(webviewView) {
      webviewView.webview.options = {
        enableScripts: true,
        localResourceRoots: [assetsRoot]
      };

      webviewView.webview.html = getLauncherViewHtml(webviewView.webview, context.extensionUri);

      webviewView.webview.onDidReceiveMessage(
        async (message: unknown) => {
          if (!message || typeof message !== "object") {
            return;
          }

          const payload = message as {
            type?: string;
            url?: string;
          };

          if (payload.type === "openGenerator") {
            openGeneratorPanel();
            return;
          }

          if (payload.type === "openExternal") {
            await openExternalLink(webviewView.webview, payload);
          }
        },
        undefined,
        context.subscriptions
      );

      const visibilityDisposable = webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible && !openedFromActivityBar) {
          openedFromActivityBar = true;
          openGeneratorPanel();
        }
      });

      context.subscriptions.push(visibilityDisposable);
    }
  };

  const launcherViewDisposable = vscode.window.registerWebviewViewProvider(
    LAUNCHER_VIEW_ID,
    launcherViewProvider
  );

  context.subscriptions.push(openGeneratorCommand, launcherViewDisposable);

  if (context.extensionMode === vscode.ExtensionMode.Development) {
    setTimeout(() => {
      openGeneratorPanel();
    }, 250);
  }
}

export function deactivate(): void {}
