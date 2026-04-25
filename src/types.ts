export interface CatAccessory {
  id: string;
  displayName: string;
  frameFileNames: string[]; // ["1.svg", "2.svg", "3.svg"] under acs/<id>/
}

export interface CatAsset {
  id: string;
  displayName: string;
  frameFileNames: string[]; // ["1.svg", "2.svg", "3.svg"]
  accessories: CatAccessory[];
}

export interface LilMateState {
  typeCount: number;
  nextRewardAt: number; // typeCount threshold at which the next reward pull fires
  unlockedCats: string[];
  unlockedAccessories: Record<string, string[]>; // catId -> accessoryId[]
  activeCat: string;
  activeAccessory: Record<string, string | null>; // catId -> single equipped accessoryId or null
}

export interface AccessoryFrameUris {
  id: string;
  frameUris: string[]; // 3 entries matching cat frames
}

// Messages from extension host to webview
export type ExtToWebviewMessage =
  | {
      type: 'init';
      catalogue: CatAsset[];
      state: LilMateState;
      frameUris: string[];
      accessoryUris: AccessoryFrameUris[];
    }
  | { type: 'advance-frame' }
  | { type: 'update-type-count'; typeCount: number }
  | {
      type: 'gacha-result';
      item: GachaItem;
      typeCount: number;
      catFrameUri: string;
      accessoryFrameUri?: string;
    }
  | {
      type: 'switch-cat';
      catId: string;
      frameUris: string[];
      accessoryUris: AccessoryFrameUris[];
      activeAccessory: string | null;
    };

// Messages from webview to extension host
export type WebviewToExtMessage =
  | { type: 'webview-ready' }
  | { type: 'select-cat'; catId: string }
  | { type: 'set-accessory'; catId: string; accessoryId: string | null };

export interface GachaItem {
  itemType: 'cat' | 'accessory';
  catId: string;
  accessoryId?: string;
  displayName: string;
}
