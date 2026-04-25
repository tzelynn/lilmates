import * as vscode from 'vscode';
import { CatAsset, LilMateState } from './types';

const STATE_KEY = 'lilmate.state';
const REWARD_INTERVAL = 100;

// Migration-friendly shape: older versions stored `activeAccessories: Record<string, string[]>`.
interface LegacyState extends Omit<LilMateState, 'activeAccessory' | 'nextRewardAt'> {
  activeAccessory?: Record<string, string | null>;
  activeAccessories?: Record<string, string[]>;
  nextRewardAt?: number;
}

export class StateManager {
  private state: LilMateState;
  private globalState: vscode.Memento;
  private dirty = false;

  constructor(globalState: vscode.Memento, catalogue: CatAsset[], devMode: boolean) {
    this.globalState = globalState;

    const saved = devMode ? undefined : globalState.get<LegacyState>(STATE_KEY);
    if (saved) {
      this.state = migrateState(saved);
      this.persistImmediate();
    } else {
      const firstCat = catalogue.length > 0 ? catalogue[0].id : '';
      this.state = {
        typeCount: 0,
        nextRewardAt: REWARD_INTERVAL,
        unlockedCats: firstCat ? [firstCat] : [],
        unlockedAccessories: {},
        activeCat: firstCat,
        activeAccessory: {},
      };
      this.persistImmediate();
    }
  }

  getState(): LilMateState {
    return this.state;
  }

  getTypeCount(): number {
    return this.state.typeCount;
  }

  incrementTypeCount(amount: number): void {
    this.state.typeCount += amount;
    this.dirty = true;
  }

  getNextRewardAt(): number {
    return this.state.nextRewardAt;
  }

  advanceNextRewardAt(): void {
    this.state.nextRewardAt += REWARD_INTERVAL;
    this.persistImmediate();
  }

  unlockCat(catId: string): void {
    if (!this.state.unlockedCats.includes(catId)) {
      this.state.unlockedCats.push(catId);
      this.persistImmediate();
    }
  }

  unlockAccessory(catId: string, accessoryId: string): void {
    if (!this.state.unlockedAccessories[catId]) {
      this.state.unlockedAccessories[catId] = [];
    }
    if (!this.state.unlockedAccessories[catId].includes(accessoryId)) {
      this.state.unlockedAccessories[catId].push(accessoryId);
      this.persistImmediate();
    }
  }

  setActiveCat(catId: string): void {
    this.state.activeCat = catId;
    this.persistImmediate();
  }

  /** Equip a specific accessory, or pass null to unequip whatever is equipped. */
  setActiveAccessory(catId: string, accessoryId: string | null): void {
    if (accessoryId === null) {
      this.state.activeAccessory[catId] = null;
    } else {
      this.state.activeAccessory[catId] = accessoryId;
    }
    this.persistImmediate();
  }

  getActiveAccessory(catId: string): string | null {
    return this.state.activeAccessory[catId] ?? null;
  }

  isUnlockedCat(catId: string): boolean {
    return this.state.unlockedCats.includes(catId);
  }

  isUnlockedAccessory(catId: string, accessoryId: string): boolean {
    return this.state.unlockedAccessories[catId]?.includes(accessoryId) ?? false;
  }

  /** Called on interval to save type count to disk */
  persistTypeCount(): void {
    if (this.dirty) {
      this.dirty = false;
      this.persistImmediate();
    }
  }

  private persistImmediate(): void {
    this.globalState.update(STATE_KEY, this.state);
  }
}

function migrateState(saved: LegacyState): LilMateState {
  const activeAccessory: Record<string, string | null> = {};
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
  // For existing installs upgrading to the monotonic counter, pick the next
  // threshold above the current count so no stale rewards fire immediately.
  const nextRewardAt =
    saved.nextRewardAt ?? Math.floor(typeCount / REWARD_INTERVAL) * REWARD_INTERVAL + REWARD_INTERVAL;

  return {
    typeCount,
    nextRewardAt,
    unlockedCats: saved.unlockedCats ?? [],
    unlockedAccessories: saved.unlockedAccessories ?? {},
    activeCat: saved.activeCat ?? '',
    activeAccessory,
  };
}
