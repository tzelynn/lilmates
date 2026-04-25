import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AccessoryFrameUris, CatAsset } from './types';
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

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.sendInit();
      }
    });
  }

  advanceFrame(): void {
    this.view?.webview.postMessage({ type: 'advance-frame' });
  }

  /**
   * Called after each type-count increment. If the threshold has been
   * reached and there are items left, auto-pull and show the reward;
   * otherwise just push the new count to the webview.
   */
  handleTypeCountChanged(): void {
    if (this.gachaSystem.canPull()) {
      const item = this.gachaSystem.pull();
      if (item) {
        const cat = this.catalogue.find((c) => c.id === item.catId);
        const catFrameUri = cat
          ? this.getCatFrameUri(cat.id, cat.frameFileNames[1])
          : '';
        let accessoryFrameUri: string | undefined;
        if (item.itemType === 'accessory' && item.accessoryId && cat) {
          const acs = cat.accessories.find((a) => a.id === item.accessoryId);
          if (acs) {
            accessoryFrameUri = this.getAccessoryFrameUri(
              cat.id,
              acs.id,
              acs.frameFileNames[1]
            );
          }
        }
        this.view?.webview.postMessage({
          type: 'gacha-result',
          item,
          typeCount: this.stateManager.getTypeCount(),
          catFrameUri,
          accessoryFrameUri,
        });
        return;
      }
    }
    this.view?.webview.postMessage({
      type: 'update-type-count',
      typeCount: this.stateManager.getTypeCount(),
    });
  }

  private handleMessage(message: { type: string; [key: string]: unknown }): void {
    switch (message.type) {
      case 'webview-ready':
        this.sendInit();
        break;

      case 'select-cat': {
        const catId = message.catId as string;
        if (this.stateManager.isUnlockedCat(catId)) {
          this.stateManager.setActiveCat(catId);
          this.sendSwitchCat(catId);
        }
        break;
      }

      case 'set-accessory': {
        const catId = message.catId as string;
        const accessoryId = (message.accessoryId as string | null) ?? null;
        if (accessoryId !== null && !this.stateManager.isUnlockedAccessory(catId, accessoryId)) {
          break;
        }
        this.stateManager.setActiveAccessory(catId, accessoryId);
        this.sendSwitchCat(catId);
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
        thumbUri: this.getCatFrameUri(c.id, c.frameFileNames[0]),
        accessories: c.accessories.map((a) => ({
          id: a.id,
          displayName: a.displayName,
          thumbUri: this.getAccessoryFrameUri(c.id, a.id, a.frameFileNames[0]),
          thumbSvg: this.readAccessorySvg(c.id, a.id, a.frameFileNames[0]),
        })),
      })),
      state: {
        typeCount: state.typeCount,
        unlockedCats: state.unlockedCats,
        unlockedAccessories: state.unlockedAccessories,
        activeCat: state.activeCat,
        activeAccessory: state.activeAccessory,
      },
      frameUris: activeCat
        ? activeCat.frameFileNames.map((f) => this.getCatFrameUri(state.activeCat, f))
        : [],
      accessoryUris: activeCat ? this.buildAccessoryUris(activeCat) : [],
    });
  }

  private sendSwitchCat(catId: string): void {
    const cat = this.catalogue.find((c) => c.id === catId);
    if (!cat) {
      return;
    }

    this.view?.webview.postMessage({
      type: 'switch-cat',
      catId,
      frameUris: cat.frameFileNames.map((f) => this.getCatFrameUri(catId, f)),
      accessoryUris: this.buildAccessoryUris(cat),
      activeAccessory: this.stateManager.getActiveAccessory(catId),
    });
  }

  private buildAccessoryUris(cat: CatAsset): AccessoryFrameUris[] {
    return cat.accessories.map((a) => ({
      id: a.id,
      frameUris: a.frameFileNames.map((f) => this.getAccessoryFrameUri(cat.id, a.id, f)),
    }));
  }

  private getCatFrameUri(catId: string, fileName: string): string {
    return this.view!.webview
      .asWebviewUri(
        vscode.Uri.joinPath(this.extensionUri, 'assets', 'mates', catId, fileName)
      )
      .toString();
  }

  private readAccessorySvg(catId: string, accessoryId: string, fileName: string): string | undefined {
    const filePath = path.join(
      this.extensionUri.fsPath,
      'assets',
      'mates',
      catId,
      'acs',
      accessoryId,
      fileName
    );
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return undefined;
    }
  }

  private getAccessoryFrameUri(catId: string, accessoryId: string, fileName: string): string {
    return this.view!.webview
      .asWebviewUri(
        vscode.Uri.joinPath(
          this.extensionUri,
          'assets',
          'mates',
          catId,
          'acs',
          accessoryId,
          fileName
        )
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
  <div id="bottom-tabs">
    <div class="bottom-tab" id="count-tab" title="Type to earn a reward every 100 letters">
      <svg class="bottom-tab-svg bottom-tab-svg-paw" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="6" cy="10" rx="2" ry="2.4"/>
        <ellipse cx="10" cy="6" rx="2" ry="2.4"/>
        <ellipse cx="14" cy="6" rx="2" ry="2.4"/>
        <ellipse cx="18" cy="10" rx="2" ry="2.4"/>
        <path d="M12 10.5c-3.4 0-6.1 2.6-6.1 5.6 0 2.2 1.6 3.6 3.4 3.6 1 0 1.6-.35 2.7-.35s1.7.35 2.7.35c1.8 0 3.4-1.4 3.4-3.6 0-3-2.7-5.6-6.1-5.6z"/>
      </svg>
      <span class="bottom-tab-value" id="type-count">0</span>
    </div>
    <button class="bottom-tab" id="collection-btn" title="Collection">
      <svg class="bottom-tab-svg bottom-tab-svg-grid" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/>
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/>
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/>
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" class="filled"/>
      </svg>
    </button>
  </div>

  <div id="collection-panel" class="hidden">
    <div class="collection-header">
      <button id="collection-back" class="collection-back hidden" title="Back">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M14 6 L8 12 L14 18"/>
        </svg>
      </button>
      <span class="collection-header-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <rect x="5" y="4" width="14" height="17" rx="2"/>
          <path d="M9 4 v-1 a1 1 0 0 1 1-1 h4 a1 1 0 0 1 1 1 v1"/>
          <path d="M9 10 h6"/>
          <path d="M9 14 h6"/>
          <path d="M9 17 h4"/>
        </svg>
      </span>
      <div class="collection-header-left">
        <h3 id="collection-title">Collection</h3>
        <span id="collection-progress" class="collection-progress"></span>
      </div>
      <button id="close-collection" title="Close">&times;</button>
    </div>
    <div id="collection-content"></div>
  </div>

  <div id="gacha-overlay" class="hidden">
    <div id="gacha-result-card">
      <button id="gacha-close" title="Close">&times;</button>
      <div id="gacha-result-banner">NEW!</div>
      <div id="gacha-result-art-wrap">
        <div id="gacha-result-art"></div>
      </div>
      <div id="gacha-result-name"></div>
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
