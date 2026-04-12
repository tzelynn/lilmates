"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode2 = __toESM(require("vscode"));

// src/catViewProvider.ts
var vscode = __toESM(require("vscode"));
var CatViewProvider = class {
  constructor(extensionUri, catalogue, stateManager, gachaSystem) {
    this.extensionUri = extensionUri;
    this.catalogue = catalogue;
    this.stateManager = stateManager;
    this.gachaSystem = gachaSystem;
  }
  resolveWebviewView(webviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "assets"),
        vscode.Uri.joinPath(this.extensionUri, "media")
      ]
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
  advanceFrame() {
    this.view?.webview.postMessage({ type: "advance-frame" });
  }
  sendTypeCountUpdate() {
    this.view?.webview.postMessage({
      type: "update-type-count",
      typeCount: this.stateManager.getTypeCount(),
      canPull: this.gachaSystem.canPull()
    });
  }
  handleMessage(message) {
    switch (message.type) {
      case "webview-ready":
        this.sendInit();
        break;
      case "gacha-pull": {
        const item = this.gachaSystem.pull();
        if (item) {
          this.view?.webview.postMessage({
            type: "gacha-result",
            item,
            typeCount: this.stateManager.getTypeCount(),
            canPull: this.gachaSystem.canPull(),
            hasItemsLeft: this.gachaSystem.hasItemsLeft()
          });
        }
        break;
      }
      case "select-cat": {
        const catId = message.catId;
        if (this.stateManager.isUnlockedCat(catId)) {
          this.stateManager.setActiveCat(catId);
          this.sendSwitchCat(catId);
        }
        break;
      }
      case "toggle-accessory": {
        const catId = message.catId;
        const accessoryId = message.accessoryId;
        if (this.stateManager.isUnlockedAccessory(catId, accessoryId)) {
          this.stateManager.toggleAccessory(catId, accessoryId);
          this.sendSwitchCat(catId);
        }
        break;
      }
    }
  }
  sendInit() {
    const state = this.stateManager.getState();
    const activeCat = this.catalogue.find((c) => c.id === state.activeCat);
    this.view?.webview.postMessage({
      type: "init",
      catalogue: this.catalogue.map((c) => ({
        id: c.id,
        displayName: c.displayName,
        thumbUri: this.getAssetUri(c.id, c.frameFileNames[0]),
        accessories: c.accessories.map((a) => ({ id: a.id, displayName: a.displayName }))
      })),
      state: {
        typeCount: state.typeCount,
        unlockedCats: state.unlockedCats,
        unlockedAccessories: state.unlockedAccessories,
        activeCat: state.activeCat,
        activeAccessories: state.activeAccessories
      },
      frameUris: activeCat ? activeCat.frameFileNames.map((f) => this.getAssetUri(state.activeCat, f)) : [],
      accessoryUris: activeCat ? activeCat.accessories.map((a) => ({
        id: a.id,
        uri: this.getAssetUri(state.activeCat, a.fileName)
      })) : [],
      gachaCost: this.gachaSystem.getCost(),
      canPull: this.gachaSystem.canPull(),
      hasItemsLeft: this.gachaSystem.hasItemsLeft()
    });
  }
  sendSwitchCat(catId) {
    const cat = this.catalogue.find((c) => c.id === catId);
    if (!cat) {
      return;
    }
    this.view?.webview.postMessage({
      type: "switch-cat",
      catId,
      frameUris: cat.frameFileNames.map((f) => this.getAssetUri(catId, f)),
      accessoryUris: cat.accessories.map((a) => ({
        id: a.id,
        uri: this.getAssetUri(catId, a.fileName)
      })),
      activeAccessories: this.stateManager.getActiveAccessories(catId)
    });
  }
  getAssetUri(catId, fileName) {
    return this.view.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "assets", "mates", catId, fileName)
    ).toString();
  }
  getHtmlForWebview(webview) {
    const cssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "webview.css")
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "webview.js")
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
    <span id="meow-icon">\u{1F43E}</span>
    <span id="type-count">0</span>
    <span id="meow-label">meows</span>
  </div>

  <div id="controls">
    <button id="gacha-btn" disabled>\u{1F3B2} Gacha! (100)</button>
    <button id="collection-btn">\u{1F4E6} Collection</button>
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
};
function getNonce() {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

// src/assetDiscovery.ts
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
function discoverAssets(extensionUri) {
  const matesDir = path.join(extensionUri.fsPath, "assets", "mates");
  if (!fs.existsSync(matesDir)) {
    return [];
  }
  const entries = fs.readdirSync(matesDir, { withFileTypes: true });
  const cats = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const catDir = path.join(matesDir, entry.name);
    const catFiles = fs.readdirSync(catDir);
    const frameFileNames = ["1.PNG", "2.PNG", "3.PNG"];
    const hasAllFrames = frameFileNames.every((f) => catFiles.includes(f));
    if (!hasAllFrames) {
      continue;
    }
    const accessories = catFiles.filter((f) => f.startsWith("acs_") && f.endsWith(".PNG")).map((f) => {
      const id = f.replace("acs_", "").replace(".PNG", "");
      return {
        id,
        displayName: id.charAt(0).toUpperCase() + id.slice(1),
        fileName: f
      };
    });
    cats.push({
      id: entry.name,
      displayName: entry.name.charAt(0).toUpperCase() + entry.name.slice(1),
      frameFileNames,
      accessories
    });
  }
  cats.sort((a, b) => a.id.localeCompare(b.id));
  return cats;
}

// src/stateManager.ts
var STATE_KEY = "lilmate.state";
var StateManager = class {
  constructor(globalState, catalogue, devMode) {
    this.dirty = false;
    this.globalState = globalState;
    const saved = devMode ? void 0 : globalState.get(STATE_KEY);
    if (saved) {
      this.state = saved;
    } else {
      const firstCat = catalogue.length > 0 ? catalogue[0].id : "";
      this.state = {
        typeCount: 0,
        unlockedCats: firstCat ? [firstCat] : [],
        unlockedAccessories: {},
        activeCat: firstCat,
        activeAccessories: {}
      };
      this.persistImmediate();
    }
  }
  getState() {
    return this.state;
  }
  getTypeCount() {
    return this.state.typeCount;
  }
  incrementTypeCount(amount) {
    this.state.typeCount += amount;
    this.dirty = true;
  }
  deductTypeCount(amount) {
    this.state.typeCount = Math.max(0, this.state.typeCount - amount);
    this.dirty = true;
  }
  unlockCat(catId) {
    if (!this.state.unlockedCats.includes(catId)) {
      this.state.unlockedCats.push(catId);
      this.persistImmediate();
    }
  }
  unlockAccessory(catId, accessoryId) {
    if (!this.state.unlockedAccessories[catId]) {
      this.state.unlockedAccessories[catId] = [];
    }
    if (!this.state.unlockedAccessories[catId].includes(accessoryId)) {
      this.state.unlockedAccessories[catId].push(accessoryId);
      this.persistImmediate();
    }
  }
  setActiveCat(catId) {
    this.state.activeCat = catId;
    this.persistImmediate();
  }
  toggleAccessory(catId, accessoryId) {
    if (!this.state.activeAccessories[catId]) {
      this.state.activeAccessories[catId] = [];
    }
    const list = this.state.activeAccessories[catId];
    const idx = list.indexOf(accessoryId);
    if (idx >= 0) {
      list.splice(idx, 1);
      this.persistImmediate();
      return false;
    } else {
      list.push(accessoryId);
      this.persistImmediate();
      return true;
    }
  }
  getActiveAccessories(catId) {
    return this.state.activeAccessories[catId] || [];
  }
  isUnlockedCat(catId) {
    return this.state.unlockedCats.includes(catId);
  }
  isUnlockedAccessory(catId, accessoryId) {
    return this.state.unlockedAccessories[catId]?.includes(accessoryId) ?? false;
  }
  /** Called on interval to save type count to disk */
  persistTypeCount() {
    if (this.dirty) {
      this.dirty = false;
      this.persistImmediate();
    }
  }
  persistImmediate() {
    this.globalState.update(STATE_KEY, this.state);
  }
};

// src/gachaSystem.ts
var GACHA_COST = 100;
var GachaSystem = class {
  constructor(catalogue, stateManager) {
    this.catalogue = catalogue;
    this.stateManager = stateManager;
  }
  getCost() {
    return GACHA_COST;
  }
  getAvailablePool() {
    const pool = [];
    for (const cat of this.catalogue) {
      if (!this.stateManager.isUnlockedCat(cat.id)) {
        pool.push({
          itemType: "cat",
          catId: cat.id,
          displayName: cat.displayName
        });
      }
      if (this.stateManager.isUnlockedCat(cat.id)) {
        for (const acs of cat.accessories) {
          if (!this.stateManager.isUnlockedAccessory(cat.id, acs.id)) {
            pool.push({
              itemType: "accessory",
              catId: cat.id,
              accessoryId: acs.id,
              displayName: `${acs.displayName} (${cat.displayName})`
            });
          }
        }
      }
    }
    return pool;
  }
  canPull() {
    return this.getAvailablePool().length > 0 && this.stateManager.getTypeCount() >= GACHA_COST;
  }
  hasItemsLeft() {
    return this.getAvailablePool().length > 0;
  }
  pull() {
    if (!this.canPull()) {
      return null;
    }
    const pool = this.getAvailablePool();
    const item = pool[Math.floor(Math.random() * pool.length)];
    this.stateManager.deductTypeCount(GACHA_COST);
    if (item.itemType === "cat") {
      this.stateManager.unlockCat(item.catId);
    } else if (item.accessoryId) {
      this.stateManager.unlockAccessory(item.catId, item.accessoryId);
    }
    return item;
  }
};

// src/extension.ts
function activate(context) {
  const catalogue = discoverAssets(context.extensionUri);
  const devMode = context.extensionMode === vscode2.ExtensionMode.Development;
  const stateManager = new StateManager(context.globalState, catalogue, devMode);
  const gachaSystem = new GachaSystem(catalogue, stateManager);
  const catViewProvider = new CatViewProvider(
    context.extensionUri,
    catalogue,
    stateManager,
    gachaSystem
  );
  context.subscriptions.push(
    vscode2.window.registerWebviewViewProvider("lilmate.catView", catViewProvider, {
      webviewOptions: { retainContextWhenHidden: true }
    })
  );
  context.subscriptions.push(
    vscode2.workspace.onDidChangeTextDocument((event) => {
      if (event.contentChanges.length === 0) {
        return;
      }
      stateManager.incrementTypeCount(1);
      catViewProvider.advanceFrame();
      catViewProvider.sendTypeCountUpdate();
    })
  );
  const saveInterval = setInterval(() => {
    stateManager.persistTypeCount();
  }, 5e3);
  context.subscriptions.push({
    dispose: () => {
      clearInterval(saveInterval);
      stateManager.persistTypeCount();
    }
  });
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
