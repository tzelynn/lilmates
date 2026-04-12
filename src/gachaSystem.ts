import { CatAsset, GachaItem } from './types';
import { StateManager } from './stateManager';

const GACHA_COST = 100;

export class GachaSystem {
  private catalogue: CatAsset[];
  private stateManager: StateManager;

  constructor(catalogue: CatAsset[], stateManager: StateManager) {
    this.catalogue = catalogue;
    this.stateManager = stateManager;
  }

  getCost(): number {
    return GACHA_COST;
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
    return (
      this.getAvailablePool().length > 0 &&
      this.stateManager.getTypeCount() >= GACHA_COST
    );
  }

  hasItemsLeft(): boolean {
    return this.getAvailablePool().length > 0;
  }

  pull(): GachaItem | null {
    if (!this.canPull()) {
      return null;
    }

    const pool = this.getAvailablePool();
    const item = pool[Math.floor(Math.random() * pool.length)];

    this.stateManager.deductTypeCount(GACHA_COST);

    if (item.itemType === 'cat') {
      this.stateManager.unlockCat(item.catId);
    } else if (item.accessoryId) {
      this.stateManager.unlockAccessory(item.catId, item.accessoryId);
    }

    return item;
  }
}
