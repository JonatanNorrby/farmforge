import { CROP_TYPES } from "./data/crops.js";
import { UNLOCKS } from "./data/upgrades.js";

export class Renderer {
    constructor(elements) {
        this.elements = elements;
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

    setPlotHint(message) {
        this.elements.plotHint.textContent = message;
    }

    setSceneError(message) {
        this.elements.sceneError.textContent = message;
        this.elements.sceneError.classList.toggle("hidden", !message);
    }

    render(game) {
        this.elements.moneyValue.textContent = "$" + game.state.money.toLocaleString();
        this.elements.wheatValue.textContent = String(game.state.inventory.wheat ?? 0);
        this.elements.automationValue.textContent = game.hasUnlock("harvester")
            ? "Harvester active"
            : "Manual";

        const wheat = CROP_TYPES.wheat;
        const storedWheat = game.state.inventory.wheat ?? 0;
        this.elements.sellWheatButton.disabled = storedWheat <= 0;
        this.elements.sellWheatButton.textContent = storedWheat > 0
            ? "Sell " + storedWheat + " wheat for $" + (storedWheat * wheat.sellPrice)
            : "Sell all wheat";

        const harvester = UNLOCKS.harvester;
        const owned = game.hasUnlock(harvester.id);
        this.elements.buyHarvesterButton.disabled = owned || game.state.money < harvester.cost;
        this.elements.buyHarvesterButton.textContent = owned
            ? "Harvester unlocked"
            : "Buy Harvester — $" + harvester.cost;
    }
}
