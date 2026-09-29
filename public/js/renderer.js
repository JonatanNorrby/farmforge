import { CROP_TYPES } from "./data/crops.js";
import { UNLOCKS } from "./data/upgrades.js";
import { FARM_TILE_COUNT } from "./game.js";

export class Renderer {
    constructor(elements) {
        this.elements = elements;
        this.buildFarmGrid();
    }

    buildFarmGrid() {
        const fragment = document.createDocumentFragment();

        for (let index = 0; index < FARM_TILE_COUNT; index += 1) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "farm-tile";
            button.dataset.tileIndex = String(index);

            const label = document.createElement("span");
            label.className = "tile-label";
            button.append(label);
            fragment.append(button);
        }

        this.elements.farmGrid.replaceChildren(fragment);
    }

    showAuth(message = "") {
        this.elements.authView.classList.remove("hidden");
        this.elements.gameView.classList.add("hidden");
        this.elements.logoutButton.classList.add("hidden");
        this.setAuthMessage(message);
    }

    showGame() {
        this.elements.authView.classList.add("hidden");
        this.elements.gameView.classList.remove("hidden");
        this.elements.logoutButton.classList.remove("hidden");
        this.setAuthMessage("");
    }

    setAuthMessage(message, isError = false) {
        this.elements.authMessage.textContent = message;
        this.elements.authMessage.classList.toggle("error", isError);
    }

    setSaveStatus(message, isError = false) {
        this.elements.saveStatus.textContent = message;
        this.elements.saveStatus.classList.toggle("error", isError);
    }

    render(game, now = Date.now()) {
        this.elements.moneyValue.textContent = `$${game.state.money.toLocaleString()}`;
        this.elements.wheatValue.textContent = String(game.state.inventory.wheat ?? 0);
        this.elements.automationValue.textContent = game.hasUnlock("harvester")
            ? "Harvester active"
            : "Manual";

        this.renderFarm(game, now);
        this.renderActions(game);
    }

    renderFarm(game, now) {
        const tiles = this.elements.farmGrid.children;

        for (let index = 0; index < tiles.length; index += 1) {
            const element = tiles[index];
            const status = game.getTileStatus(index, now);

            element.classList.toggle("growing", status.state === "growing");
            element.classList.toggle("ready", status.state === "ready");

            if (status.state === "empty") {
                const wheat = CROP_TYPES.wheat;
                element.querySelector(".tile-label").textContent = "+ Plant";
                element.title = `Plant ${wheat.name.toLowerCase()} for $${wheat.seedCost}`;
                continue;
            }

            if (status.state === "ready") {
                element.querySelector(".tile-label").textContent = `${status.crop.name}\nReady`;
                element.title = game.hasUnlock("harvester")
                    ? "The harvester will collect this crop."
                    : `Click to harvest ${status.crop.name.toLowerCase()}.`;
                continue;
            }

            const percent = Math.floor(status.progress * 100);
            element.querySelector(".tile-label").textContent = `${status.crop.name}\n${percent}%`;
            element.title = `${status.crop.name} is ${percent}% grown.`;
        }
    }

    renderActions(game) {
        const wheat = CROP_TYPES.wheat;
        const storedWheat = game.state.inventory.wheat ?? 0;

        this.elements.sellWheatButton.disabled = storedWheat <= 0;
        this.elements.sellWheatButton.textContent = storedWheat > 0
            ? `Sell ${storedWheat} wheat for $${storedWheat * wheat.sellPrice}`
            : "Sell all wheat";

        const harvester = UNLOCKS.harvester;
        const owned = game.hasUnlock(harvester.id);

        this.elements.buyHarvesterButton.disabled = owned || game.state.money < harvester.cost;
        this.elements.buyHarvesterButton.textContent = owned
            ? "Harvester unlocked"
            : `Buy Harvester — $${harvester.cost}`;
    }
}
