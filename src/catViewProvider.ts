import * as vscode from 'vscode';
import { CatAsset } from './types';
import { StateManager } from './stateManager';
import { GachaSystem } from './gachaSystem';

export class CatViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private extensionUri: vscode.Uri;
  private catalogue: CatAsset[];
  private stateManager: StateManager;
  private gachaSystem: GachaSystem;

  constructor(
    extensionUri: vscode.Uri,
    catalogue: CatAsset[],
    stateManager: StateManager,
    gachaSystem: GachaSystem
  ) {
    this.extensionUri = extensionUri;
    this.catalogue = catalogue;
    this.stateManager = stateManager;
    this.gachaSystem = gachaSystem;
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'assets'),
        vscode.Uri.joinPath(this.extensionUri, 'media'),
      ],
    };

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message) => {
      this.handleMessage(message);
    });

    // Re-send init when webview becomes visible again
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.sendInit();
      }
    });
  }

  advanceFrame(): void {
    this.view?.webview.postMessage({ type: 'advance-frame' });
  }

  sendTypeCountUpdate(): void {
    this.view?.webview.postMessage({
      type: 'update-type-count',
      typeCount: this.stateManager.getTypeCount(),
      canPull: this.gachaSystem.canPull(),
    });
  }

  private handleMessage(message: { type: string; [key: string]: unknown }): void {
    switch (message.type) {
      case 'webview-ready':
        this.sendInit();
        break;

      case 'gacha-pull': {
        const item = this.gachaSystem.pull();
        if (item) {
          this.view?.webview.postMessage({
            type: 'gacha-result',
            item,
            typeCount: this.stateManager.getTypeCount(),
            canPull: this.gachaSystem.canPull(),
            hasItemsLeft: this.gachaSystem.hasItemsLeft(),
          });
        }
        break;
      }

      case 'select-cat': {
        const catId = message.catId as string;
        if (this.stateManager.isUnlockedCat(catId)) {
          this.stateManager.setActiveCat(catId);
          this.sendSwitchCat(catId);
        }
        break;
      }

      case 'toggle-accessory': {
        const catId = message.catId as string;
        const accessoryId = message.accessoryId as string;
        if (this.stateManager.isUnlockedAccessory(catId, accessoryId)) {
          this.stateManager.toggleAccessory(catId, accessoryId);
          this.sendSwitchCat(catId);
        }
        break;
      }
    }
  }

  private sendInit(): void {
    const state = this.stateManager.getState();
    const activeCat = this.catalogue.find((c) => c.id === state.activeCat);

    this.view?.webview.postMessage({
      type: 'init',
      catalogue: this.catalogue.map((c) => ({
        id: c.id,
        displayName: c.displayName,
        thumbUri: this.getAssetUri(c.id, c.frameFileNames[0]),
        accessories: c.accessories.map((a) => ({ id: a.id, displayName: a.displayName })),
      })),
      state: {
        typeCount: state.typeCount,
        unlockedCats: state.unlockedCats,
        unlockedAccessories: state.unlockedAccessories,
        activeCat: state.activeCat,
        activeAccessories: state.activeAccessories,
      },
      frameUris: activeCat
        ? activeCat.frameFileNames.map((f) => this.getAssetUri(state.activeCat, f))
        : [],
      accessoryUris: activeCat
        ? activeCat.accessories.map((a) => ({
            id: a.id,
            uri: this.getAssetUri(state.activeCat, a.fileName),
          }))
        : [],
      gachaCost: this.gachaSystem.getCost(),
      canPull: this.gachaSystem.canPull(),
      hasItemsLeft: this.gachaSystem.hasItemsLeft(),
    });
  }

  private sendSwitchCat(catId: string): void {
    const cat = this.catalogue.find((c) => c.id === catId);
    if (!cat) {return;}

    this.view?.webview.postMessage({
      type: 'switch-cat',
      catId,
      frameUris: cat.frameFileNames.map((f) => this.getAssetUri(catId, f)),
      accessoryUris: cat.accessories.map((a) => ({
        id: a.id,
        uri: this.getAssetUri(catId, a.fileName),
      })),
      activeAccessories: this.stateManager.getActiveAccessories(catId),
    });
  }

  private getAssetUri(catId: string, fileName: string): string {
    return this.view!.webview
      .asWebviewUri(
        vscode.Uri.joinPath(this.extensionUri, 'assets', 'mates', catId, fileName)
      )
      .toString();
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'webview.css')
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'webview.js')
    );
    const nonce = getNonce();
    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${cspSource}; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="${cssUri}" rel="stylesheet">
  <title>LilMate</title>
</head>
<body>
  <div id="cat-display">
    <div class="cat-container" id="cat-container">
      <!-- Frames and accessories injected by JS -->
    </div>
  </div>

  <div id="meow-bar">
    <span id="meow-icon">🐾</span>
    <span id="type-count">0</span>
    <span id="meow-label">meows</span>
  </div>

  <div id="controls">
    <button id="gacha-btn" disabled>🎲 Gacha! (100)</button>
    <button id="collection-btn">📦 Collection</button>
  </div>

  <div id="collection-panel" class="hidden">
    <div class="collection-header">
      <div class="collection-header-left">
        <h3>Collection</h3>
        <span id="collection-progress" class="collection-progress"></span>
      </div>
      <button id="close-collection">&times;</button>
    </div>
    <div id="collection-content"></div>
  </div>

  <div id="gacha-overlay" class="hidden">
    <div id="gacha-result-card">
      <div id="gacha-result-emoji"></div>
      <div id="gacha-result-label">You got:</div>
      <div id="gacha-result-name"></div>
      <button id="gacha-close">Nice!</button>
    </div>
  </div>

  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
