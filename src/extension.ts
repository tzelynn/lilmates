import * as vscode from 'vscode';
import { CatViewProvider } from './catViewProvider';
import { discoverAssets } from './assetDiscovery';
import { StateManager } from './stateManager';
import { GachaSystem } from './gachaSystem';

export function activate(context: vscode.ExtensionContext) {
  const catalogue = discoverAssets(context.extensionUri);
  const devMode = context.extensionMode === vscode.ExtensionMode.Development;
  const stateManager = new StateManager(context.globalState, catalogue, devMode);
  const gachaSystem = new GachaSystem(catalogue, stateManager);

  const catViewProvider = new CatViewProvider(
    context.extensionUri,
    catalogue,
    stateManager,
    gachaSystem
  );

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('lilmate.catView', catViewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Track text changes for animation and type count
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.contentChanges.length === 0) {
        return;
      }
      // Each text change event = 1 type count (paste/AI counts as just 1)
      stateManager.incrementTypeCount(1);
      catViewProvider.advanceFrame();
      catViewProvider.sendTypeCountUpdate();
    })
  );

  // Debounced state persistence: save type count every 5 seconds
  const saveInterval = setInterval(() => {
    stateManager.persistTypeCount();
  }, 5000);

  context.subscriptions.push({
    dispose: () => {
      clearInterval(saveInterval);
      stateManager.persistTypeCount();
    }
  });
}

export function deactivate() {}
