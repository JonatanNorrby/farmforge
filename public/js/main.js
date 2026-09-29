import { api, ApiError, SaveManager } from "./api.js";
import { Game } from "./game.js";
import { bindAuthInput, bindGameInput } from "./input.js";
import { Renderer } from "./renderer.js";

const elements = {
    authView: document.querySelector("#auth-view"),
    gameView: document.querySelector("#game-view"),
    authForm: document.querySelector("#auth-form"),
    usernameInput: document.querySelector("#username-input"),
    passwordInput: document.querySelector("#password-input"),
    registerButton: document.querySelector("#register-button"),
    logoutButton: document.querySelector("#logout-button"),
    authMessage: document.querySelector("#auth-message"),
    moneyValue: document.querySelector("#money-value"),
    wheatValue: document.querySelector("#wheat-value"),
    automationValue: document.querySelector("#automation-value"),
    farmGrid: document.querySelector("#farm-grid"),
    sellWheatButton: document.querySelector("#sell-wheat-button"),
    buyHarvesterButton: document.querySelector("#buy-harvester-button"),
    saveButton: document.querySelector("#save-button"),
    saveStatus: document.querySelector("#save-status")
};

const renderer = new Renderer(elements);
let game = null;
let updateIntervalId = null;

const saveManager = new SaveManager(
    () => game?.state ?? null,
    (message, isError = false) => renderer.setSaveStatus(message, isError)
);

function credentials() {
    return {
        username: elements.usernameInput.value.trim(),
        password: elements.passwordInput.value
    };
}

async function enterGame() {
    const { save } = await api.loadSave();
    game = new Game(save);

    renderer.showGame();
    renderer.setSaveStatus("Progress saves automatically.");
    renderer.render(game);

    saveManager.start();

    if (updateIntervalId !== null) {
        window.clearInterval(updateIntervalId);
    }

    updateIntervalId = window.setInterval(() => {
        game.update();
        renderer.render(game);
    }, 250);
}

async function handleAuth(action) {
    const { username, password } = credentials();

    renderer.setAuthMessage(action === "register" ? "Creating account..." : "Logging in...");

    try {
        await api[action](username, password);
        elements.passwordInput.value = "";
        await enterGame();
    } catch (error) {
        renderer.setAuthMessage(error.message ?? "Authentication failed.", true);
    }
}

async function logout() {
    await saveManager.save();
    saveManager.stop();

    if (updateIntervalId !== null) {
        window.clearInterval(updateIntervalId);
        updateIntervalId = null;
    }

    try {
        await api.logout();
    } catch {
        // The local session is cleared from the UI even if the request fails.
    }

    game = null;
    renderer.showAuth("Logged out.");
}

bindAuthInput(elements, {
    login: () => handleAuth("login"),
    register: () => handleAuth("register"),
    logout
});

bindGameInput(elements, () => game, {
    changed: () => renderer.render(game),
    importantChanged: () => saveManager.save(),
    save: () => saveManager.save()
});

window.addEventListener("pagehide", () => {
    if (game) {
        saveManager.save({ keepalive: true });
    }
});

async function bootstrap() {
    try {
        await enterGame();
    } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
            renderer.showAuth();
            return;
        }

        renderer.showAuth("Could not connect to the game server.", true);
    }
}

bootstrap();
