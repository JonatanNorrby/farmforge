export function bindAuthInput(elements, actions) {
    elements.authForm.addEventListener("submit", (event) => {
        event.preventDefault();
        actions.login();
    });

    elements.registerButton.addEventListener("click", () => actions.register());
    elements.logoutButton.addEventListener("click", () => actions.logout());
}

export function bindGameInput(elements, getGame, actions) {
    elements.sellWheatButton.addEventListener("click", () => {
        if (getGame()?.sellAll("wheat")) actions.changed();
    });

    elements.buyHarvesterButton.addEventListener("click", () => {
        if (getGame()?.buyUnlock("harvester")) {
            actions.changed();
            actions.importantChanged();
        }
    });

    elements.saveButton.addEventListener("click", () => actions.save());
    elements.resetCameraButton.addEventListener("click", () => actions.resetCamera());
}
