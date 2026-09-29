import { CROP_TYPES } from "./data/crops.js";
import { UNLOCKS } from "./data/upgrades.js";

export const FARM_SIZE = 8;
export const FARM_TILE_COUNT = FARM_SIZE * FARM_SIZE;

function createEmptyTile() {
    return {
        cropId: null,
        plantedAt: 0
    };
}

export function createInitialState(now = Date.now()) {
    return {
        version: 1,
        money: 20,
        inventory: {
            wheat: 0
        },
        farm: Array.from({ length: FARM_TILE_COUNT }, createEmptyTile),
        unlocks: [],
        lastUpdated: now
    };
}

function normalizeTile(tile) {
    if (!tile || typeof tile !== "object") {
        return createEmptyTile();
    }

    const cropId = CROP_TYPES[tile.cropId] ? tile.cropId : null;

    return {
        cropId,
        plantedAt: cropId && Number.isFinite(tile.plantedAt) ? tile.plantedAt : 0
    };
}

export function normalizeState(savedState) {
    const initial = createInitialState();

    if (!savedState || typeof savedState !== "object") {
        return initial;
    }

    const farm = Array.from({ length: FARM_TILE_COUNT }, (_, index) =>
        normalizeTile(savedState.farm?.[index])
    );

    return {
        version: 1,
        money: Number.isInteger(savedState.money) && savedState.money >= 0
            ? savedState.money
            : initial.money,
        inventory: {
            wheat: Number.isInteger(savedState.inventory?.wheat) && savedState.inventory.wheat >= 0
                ? savedState.inventory.wheat
                : 0
        },
        farm,
        unlocks: Array.isArray(savedState.unlocks)
            ? savedState.unlocks.filter((id) => UNLOCKS[id])
            : [],
        lastUpdated: Number.isFinite(savedState.lastUpdated)
            ? savedState.lastUpdated
            : initial.lastUpdated
    };
}

export class Game {
    constructor(savedState) {
        this.state = normalizeState(savedState);
    }

    hasUnlock(unlockId) {
        return this.state.unlocks.includes(unlockId);
    }

    getTileStatus(tileIndex, now = Date.now()) {
        const tile = this.state.farm[tileIndex];

        if (!tile?.cropId) {
            return {
                state: "empty",
                progress: 0,
                crop: null
            };
        }

        const crop = CROP_TYPES[tile.cropId];
        const elapsed = Math.max(0, now - tile.plantedAt);
        const progress = Math.min(1, elapsed / crop.growTimeMs);

        return {
            state: progress >= 1 ? "ready" : "growing",
            progress,
            crop
        };
    }

    plant(tileIndex, cropId = "wheat", now = Date.now()) {
        const tile = this.state.farm[tileIndex];
        const crop = CROP_TYPES[cropId];

        if (!tile || tile.cropId || !crop || this.state.money < crop.seedCost) {
            return false;
        }

        this.state.money -= crop.seedCost;
        tile.cropId = cropId;
        tile.plantedAt = now;
        return true;
    }

    harvest(tileIndex, now = Date.now()) {
        const tile = this.state.farm[tileIndex];
        const status = this.getTileStatus(tileIndex, now);

        if (!tile || status.state !== "ready") {
            return false;
        }

        const crop = status.crop;
        this.state.inventory[crop.id] = (this.state.inventory[crop.id] ?? 0) + crop.yield;
        tile.cropId = null;
        tile.plantedAt = 0;
        return true;
    }

    sellAll(cropId) {
        const crop = CROP_TYPES[cropId];
        const amount = this.state.inventory[cropId] ?? 0;

        if (!crop || amount <= 0) {
            return false;
        }

        this.state.money += amount * crop.sellPrice;
        this.state.inventory[cropId] = 0;
        return true;
    }

    buyUnlock(unlockId) {
        const unlock = UNLOCKS[unlockId];

        if (!unlock || this.hasUnlock(unlockId) || this.state.money < unlock.cost) {
            return false;
        }

        this.state.money -= unlock.cost;
        this.state.unlocks.push(unlockId);
        return true;
    }

    update(now = Date.now()) {
        let changed = false;

        if (this.hasUnlock("harvester")) {
            for (let index = 0; index < this.state.farm.length; index += 1) {
                if (this.harvest(index, now)) {
                    changed = true;
                }
            }
        }

        return changed;
    }
}
