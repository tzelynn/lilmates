import { CatAsset, GachaItem } from './types';
import { StateManager } from './stateManager';

export class GachaSystem {
  private catalogue: CatAsset[];
  private stateManager: StateManager;

  constructor(catalogue: CatAsset[], stateManager: StateManager) {
    this.catalogue = catalogue;
    this.stateManager = stateManager;
  }

  getAvailablePool(): GachaItem[] {
    const pool: GachaItem[] = [];

    for (const cat of this.catalogue) {
      // Add cat if not unlocked
      if (!this.stateManager.isUnlockedCat(cat.id)) {
        pool.push({
          itemType: 'cat',
          catId: cat.id,
          displayName: cat.displayName,
        });
      }

      // Add each locked accessory only if the cat is already unlocked
      if (this.stateManager.isUnlockedCat(cat.id)) {
        for (const acs of cat.accessories) {
          if (!this.stateManager.isUnlockedAccessory(cat.id, acs.id)) {
            pool.push({
              itemType: 'accessory',
              catId: cat.id,
              accessoryId: acs.id,
              displayName: `${acs.displayName} (${cat.displayName})`,
            });
          }
        }
      }
    }

    return pool;
  }

  canPull(): boolean {
    // Cheap integer threshold check first so the expensive pool build is
    // short-circuited on the vast majority of keystrokes. nextRewardAt is
    // monotonic, so this gate is sound.
    return (
      this.stateManager.getTypeCount() >= this.stateManager.getNextRewardAt() &&
      this.getAvailablePool().length > 0
    );
  }

  pull(): GachaItem | null {
    if (this.stateManager.getTypeCount() < this.stateManager.getNextRewardAt()) {
      return null;
    }

    const pool = this.getAvailablePool();
    if (pool.length === 0) {
      return null;
    }
    const item = pool[Math.floor(Math.random() * pool.length)];

    this.stateManager.advanceNextRewardAt();

    if (item.itemType === 'cat') {
      this.stateManager.unlockCat(item.catId);
    } else if (item.accessoryId) {
      this.stateManager.unlockAccessory(item.catId, item.accessoryId);
    }

    return item;
  }
}
