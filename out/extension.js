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
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
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
  /**
   * Called after each type-count increment. If the threshold has been
   * reached and there are items left, auto-pull and show the reward;
   * otherwise just push the new count to the webview.
   */
  handleTypeCountChanged() {
    if (this.gachaSystem.canPull()) {
      const item = this.gachaSystem.pull();
      if (item) {
        const cat = this.catalogue.find((c) => c.id === item.catId);
        const catFrameUri = cat ? this.getCatFrameUri(cat.id, cat.frameFileNames[1]) : "";
        let accessoryFrameUri;
        if (item.itemType === "accessory" && item.accessoryId && cat) {
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
          type: "gacha-result",
          item,
          typeCount: this.stateManager.getTypeCount(),
          catFrameUri,
          accessoryFrameUri
        });
        return;
      }
    }
    this.view?.webview.postMessage({
      type: "update-type-count",
      typeCount: this.stateManager.getTypeCount()
    });
  }
  handleMessage(message) {
    switch (message.type) {
      case "webview-ready":
        this.sendInit();
        break;
      case "select-cat": {
        const catId = message.catId;
        if (this.stateManager.isUnlockedCat(catId)) {
          this.stateManager.setActiveCat(catId);
          this.sendSwitchCat(catId);
        }
        break;
      }
      case "set-accessory": {
        const catId = message.catId;
        const accessoryId = message.accessoryId ?? null;
        if (accessoryId !== null && !this.stateManager.isUnlockedAccessory(catId, accessoryId)) {
          break;
        }
        this.stateManager.setActiveAccessory(catId, accessoryId);
        this.sendSwitchCat(catId);
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
        thumbUri: this.getCatFrameUri(c.id, c.frameFileNames[0]),
        accessories: c.accessories.map((a) => ({
          id: a.id,
          displayName: a.displayName,
          thumbUri: this.getAccessoryFrameUri(c.id, a.id, a.frameFileNames[0]),
          thumbSvg: this.readAccessorySvg(c.id, a.id, a.frameFileNames[0])
        }))
      })),
      state: {
        typeCount: state.typeCount,
        unlockedCats: state.unlockedCats,
        unlockedAccessories: state.unlockedAccessories,
        activeCat: state.activeCat,
        activeAccessory: state.activeAccessory
      },
      frameUris: activeCat ? activeCat.frameFileNames.map((f) => this.getCatFrameUri(state.activeCat, f)) : [],
      accessoryUris: activeCat ? this.buildAccessoryUris(activeCat) : []
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
      frameUris: cat.frameFileNames.map((f) => this.getCatFrameUri(catId, f)),
      accessoryUris: this.buildAccessoryUris(cat),
      activeAccessory: this.stateManager.getActiveAccessory(catId)
    });
  }
  buildAccessoryUris(cat) {
    return cat.accessories.map((a) => ({
      id: a.id,
      frameUris: a.frameFileNames.map((f) => this.getAccessoryFrameUri(cat.id, a.id, f))
    }));
  }
  getCatFrameUri(catId, fileName) {
    return this.view.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "assets", "mates", catId, fileName)
    ).toString();
  }
  readAccessorySvg(catId, accessoryId, fileName) {
    const filePath = path.join(
      this.extensionUri.fsPath,
      "assets",
      "mates",
      catId,
      "acs",
      accessoryId,
      fileName
    );
    try {
      return fs.readFileSync(filePath, "utf8");
    } catch {
      return void 0;
    }
  }
  getAccessoryFrameUri(catId, accessoryId, fileName) {
    return this.view.webview.asWebviewUri(
      vscode.Uri.joinPath(
        this.extensionUri,
        "assets",
        "mates",
        catId,
        "acs",
        accessoryId,
        fileName
      )
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
var path2 = __toESM(require("path"));
var fs2 = __toESM(require("fs"));
var FRAME_FILE_NAMES = ["1.svg", "2.svg", "3.svg"];
function titleCase(id) {
  return id.split(/[_\-\s]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}
function discoverAssets(extensionUri) {
  const matesDir = path2.join(extensionUri.fsPath, "assets", "mates");
  if (!fs2.existsSync(matesDir)) {
    return [];
  }
  const entries = fs2.readdirSync(matesDir, { withFileTypes: true });
  const cats = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const catDir = path2.join(matesDir, entry.name);
    const catFiles = fs2.readdirSync(catDir);
    const hasAllFrames = FRAME_FILE_NAMES.every((f) => catFiles.includes(f));
    if (!hasAllFrames) {
      continue;
    }
    const accessories = [];
    const acsDir = path2.join(catDir, "acs");
    if (fs2.existsSync(acsDir) && fs2.statSync(acsDir).isDirectory()) {
      const acsEntries = fs2.readdirSync(acsDir, { withFileTypes: true });
      for (const acsEntry of acsEntries) {
        if (!acsEntry.isDirectory()) {
          continue;
        }
        const acsSubDir = path2.join(acsDir, acsEntry.name);
        const acsFiles = fs2.readdirSync(acsSubDir);
        const acsHasAllFrames = FRAME_FILE_NAMES.every((f) => acsFiles.includes(f));
        if (!acsHasAllFrames) {
          continue;
        }
        accessories.push({
          id: acsEntry.name,
          displayName: titleCase(acsEntry.name),
          frameFileNames: [...FRAME_FILE_NAMES]
        });
      }
      accessories.sort((a, b) => a.id.localeCompare(b.id));
    }
    cats.push({
      id: entry.name,
      displayName: titleCase(entry.name),
      frameFileNames: [...FRAME_FILE_NAMES],
      accessories
    });
  }
  cats.sort((a, b) => a.id.localeCompare(b.id));
  return cats;
}

// src/stateManager.ts
var STATE_KEY = "lilmate.state";
var REWARD_INTERVAL = 100;
var StateManager = class {
  constructor(globalState, catalogue, devMode) {
    this.dirty = false;
    this.globalState = globalState;
    const saved = devMode ? void 0 : globalState.get(STATE_KEY);
    if (saved) {
      this.state = migrateState(saved);
      this.persistImmediate();
    } else {
      const firstCat = catalogue.length > 0 ? catalogue[0].id : "";
      this.state = {
        typeCount: 0,
        nextRewardAt: REWARD_INTERVAL,
        unlockedCats: firstCat ? [firstCat] : [],
        unlockedAccessories: {},
        activeCat: firstCat,
        activeAccessory: {}
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
  getNextRewardAt() {
    return this.state.nextRewardAt;
  }
  advanceNextRewardAt() {
    this.state.nextRewardAt += REWARD_INTERVAL;
    this.persistImmediate();
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
  /** Equip a specific accessory, or pass null to unequip whatever is equipped. */
  setActiveAccessory(catId, accessoryId) {
    if (accessoryId === null) {
      this.state.activeAccessory[catId] = null;
    } else {
      this.state.activeAccessory[catId] = accessoryId;
    }
    this.persistImmediate();
  }
  getActiveAccessory(catId) {
    return this.state.activeAccessory[catId] ?? null;
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
function migrateState(saved) {
  const activeAccessory = {};
  if (saved.activeAccessory) {
    for (const [catId, val] of Object.entries(saved.activeAccessory)) {
      activeAccessory[catId] = val ?? null;
    }
  } else if (saved.activeAccessories) {
    for (const [catId, list] of Object.entries(saved.activeAccessories)) {
      activeAccessory[catId] = list && list.length > 0 ? list[0] : null;
    }
  }
  const typeCount = saved.typeCount ?? 0;
  const nextRewardAt = saved.nextRewardAt ?? Math.floor(typeCount / REWARD_INTERVAL) * REWARD_INTERVAL + REWARD_INTERVAL;
  return {
    typeCount,
    nextRewardAt,
    unlockedCats: saved.unlockedCats ?? [],
    unlockedAccessories: saved.unlockedAccessories ?? {},
    activeCat: saved.activeCat ?? "",
    activeAccessory
  };
}

// src/gachaSystem.ts
var GachaSystem = class {
  constructor(catalogue, stateManager) {
    this.catalogue = catalogue;
    this.stateManager = stateManager;
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
    return this.getAvailablePool().length > 0 && this.stateManager.getTypeCount() >= this.stateManager.getNextRewardAt();
  }
  pull() {
    if (!this.canPull()) {
      return null;
    }
    const pool = this.getAvailablePool();
    const item = pool[Math.floor(Math.random() * pool.length)];
    this.stateManager.advanceNextRewardAt();
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
      catViewProvider.handleTypeCountChanged();
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
