export interface CatAccessory {
  id: string;
  displayName: string;
  fileName: string;
}

export interface CatAsset {
  id: string;
  displayName: string;
  frameFileNames: string[]; // ["1.PNG", "2.PNG", "3.PNG"]
  accessories: CatAccessory[];
}

export interface LilMateState {
  typeCount: number;
  unlockedCats: string[];
  unlockedAccessories: Record<string, string[]>; // catId -> accessoryId[]
  activeCat: string;
  activeAccessories: Record<string, string[]>; // catId -> accessoryId[]
}

// Messages from extension host to webview
export type ExtToWebviewMessage =
  | { type: 'init'; catalogue: CatAsset[]; state: LilMateState; frameUris: string[]; accessoryUris: { id: string; uri: string }[]; gachaCost: number; canPull: boolean }
  | { type: 'advance-frame' }
  | { type: 'update-type-count'; typeCount: number; canPull: boolean }
  | { type: 'gacha-result'; item: GachaItem; typeCount: number; canPull: boolean }
  | { type: 'switch-cat'; catId: string; frameUris: string[]; accessoryUris: { id: string; uri: string }[]; activeAccessories: string[] };

// Messages from webview to extension host
export type WebviewToExtMessage =
  | { type: 'webview-ready' }
  | { type: 'gacha-pull' }
  | { type: 'select-cat'; catId: string }
  | { type: 'toggle-accessory'; catId: string; accessoryId: string };

export interface GachaItem {
  itemType: 'cat' | 'accessory';
  catId: string;
  accessoryId?: string;
  displayName: string;
}
