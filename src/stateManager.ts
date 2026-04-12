import * as vscode from 'vscode';
import { CatAsset, LilMateState } from './types';

const STATE_KEY = 'lilmate.state';

export class StateManager {
  private state: LilMateState;
  private globalState: vscode.Memento;
  private dirty = false;

  constructor(globalState: vscode.Memento, catalogue: CatAsset[], devMode: boolean) {
    this.globalState = globalState;

    const saved = devMode ? undefined : globalState.get<LilMateState>(STATE_KEY);
    if (saved) {
      this.state = saved;
    } else {
      const firstCat = catalogue.length > 0 ? catalogue[0].id : '';
      this.state = {
        typeCount: 0,
        unlockedCats: firstCat ? [firstCat] : [],
        unlockedAccessories: {},
        activeCat: firstCat,
        activeAccessories: {},
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

  deductTypeCount(amount: number): void {
    this.state.typeCount = Math.max(0, this.state.typeCount - amount);
    this.dirty = true;
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

  toggleAccessory(catId: string, accessoryId: string): boolean {
    if (!this.state.activeAccessories[catId]) {
      this.state.activeAccessories[catId] = [];
    }
    const list = this.state.activeAccessories[catId];
    const idx = list.indexOf(accessoryId);
    if (idx >= 0) {
      list.splice(idx, 1);
      this.persistImmediate();
      return false; // now inactive
    } else {
      list.push(accessoryId);
      this.persistImmediate();
      return true; // now active
    }
  }

  getActiveAccessories(catId: string): string[] {
    return this.state.activeAccessories[catId] || [];
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
