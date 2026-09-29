export function bindAuthInput(elements, actions) {
    elements.authForm.addEventListener("submit", (event) => {
        event.preventDefault();
        actions.login();
    });

    elements.registerButton.addEventListener("click", () => {
        actions.register();
    });

    elements.logoutButton.addEventListener("click", () => {
        actions.logout();
    });
}

export function bindGameInput(elements, getGame, actions) {
    elements.farmGrid.addEventListener("click", (event) => {
        const tile = event.target.closest("[data-tile-index]");

        if (!tile) {
            return;
        }

        const game = getGame();
        const tileIndex = Number(tile.dataset.tileIndex);
        const status = game.getTileStatus(tileIndex);

        if (status.state === "empty") {
            if (game.plant(tileIndex, "wheat")) {
                actions.changed();
            }
            return;
        }

        if (status.state === "ready" && game.harvest(tileIndex)) {
            actions.changed();
        }
    });

    elements.sellWheatButton.addEventListener("click", () => {
        if (getGame().sellAll("wheat")) {
            actions.changed();
        }
    });

    elements.buyHarvesterButton.addEventListener("click", () => {
        if (getGame().buyUnlock("harvester")) {
            actions.changed();
            actions.importantChanged();
        }
    });

    elements.saveButton.addEventListener("click", () => {
        actions.save();
    });
}
