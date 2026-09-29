import { UNLOCKS } from "./data/upgrades.js";

export class Renderer {
    constructor(elements) {
        this.elements = elements;
        this.buildFarmGrid();
    }

    buildFarmGrid() {
        const fragment = document.createDocumentFragment();

        for (let index = 0; index < 64; index += 1) {
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
                element.querySelector(".tile-label").textContent = "+ Plant";
                element.title = "Plant wheat for $1";
                continue;
            }

            if (status.state === "ready") {
                element.querySelector(".tile-label").textContent = "Wheat\nReady";
                element.title = game.hasUnlock("harvester")
                    ? "The harvester will collect this crop."
                    : "Click to harvest wheat.";
                continue;
            }

            const percent = Math.floor(status.progress * 100);
            element.querySelector(".tile-label").textContent = `Wheat\n${percent}%`;
            element.title = `Wheat is ${percent}% grown.`;
        }
    }

    renderActions(game) {
        const wheat = game.state.inventory.wheat ?? 0;
        this.elements.sellWheatButton.disabled = wheat <= 0;
        this.elements.sellWheatButton.textContent = wheat > 0
            ? `Sell ${wheat} wheat for $${wheat * 3}`
            : "Sell all wheat";

        const harvester = UNLOCKS.harvester;
        const owned = game.hasUnlock(harvester.id);

        this.elements.buyHarvesterButton.disabled = owned || game.state.money < harvester.cost;
        this.elements.buyHarvesterButton.textContent = owned
            ? "Harvester unlocked"
            : `Buy Harvester — $${harvester.cost}`;
    }
}
