import { api, ApiError, SaveManager } from "./api.js";
import { Game } from "./game.js";
import { bindAuthInput, bindGameInput } from "./input.js";
import { Renderer } from "./renderer.js";
import { FarmScene } from "./scene3d.js";

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
    renderCanvas: document.querySelector("#render-canvas"),
    sceneError: document.querySelector("#scene-error"),
    plotHint: document.querySelector("#plot-hint"),
    resetCameraButton: document.querySelector("#reset-camera-button"),
    sellWheatButton: document.querySelector("#sell-wheat-button"),
    buyHarvesterButton: document.querySelector("#buy-harvester-button"),
    saveButton: document.querySelector("#save-button"),
    saveStatus: document.querySelector("#save-status")
};

const renderer = new Renderer(elements);
let game = null;
let farmScene = null;
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

function renderGame() {
    if (!game) return;
    renderer.render(game);
    farmScene?.render(game);
}

function onPlotHover(index) {
    if (!game || index === null) {
        renderer.setPlotHint("Select an empty plot to plant wheat. Select ripe wheat to harvest.");
        return;
    }

    const status = game.getTileStatus(index);
    const plotNumber = index + 1;

    if (status.state === "empty") {
        renderer.setPlotHint("Plot " + plotNumber + ": empty soil — click to plant wheat ($1).");
    } else if (status.state === "ready") {
        renderer.setPlotHint("Plot " + plotNumber + ": wheat is ready to harvest.");
    } else {
        renderer.setPlotHint("Plot " + plotNumber + ": wheat is " + Math.floor(status.progress * 100) + "% grown.");
    }
}

function onPlotClick(index) {
    if (!game) return;
    const status = game.getTileStatus(index);
    let changed = false;

    if (status.state === "empty") {
        changed = game.plant(index, "wheat");
        if (!changed) renderer.setPlotHint("Not enough money to plant. Sell wheat from storage.");
    } else if (status.state === "ready") {
        changed = game.harvest(index);
    }

    if (changed) {
        renderGame();
        onPlotHover(index);
    }
}

function createFarmScene() {
    if (farmScene) {
        farmScene.resize();
        return;
    }

    try {
        farmScene = new FarmScene(elements.renderCanvas, onPlotClick, onPlotHover);
        renderer.setSceneError("");
    } catch (error) {
        console.error("Unable to initialize 3D farm", error);
        renderer.setSceneError("3D rendering could not start. Enable WebGL or try a modern browser with hardware acceleration.");
    }
}

async function enterGame() {
    const { save } = await api.loadSave();
    game = new Game(save);

    renderer.showGame();
    renderer.setSaveStatus("Progress saves automatically.");
    createFarmScene();
    renderGame();
    window.requestAnimationFrame(() => farmScene?.resize());
    saveManager.start();

    if (updateIntervalId !== null) window.clearInterval(updateIntervalId);
    updateIntervalId = window.setInterval(() => {
        game.update();
        renderGame();
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
        // Show the login view even if session cleanup fails on the server.
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
    changed: renderGame,
    importantChanged: () => saveManager.save(),
    save: () => saveManager.save(),
    resetCamera: () => farmScene?.resetCamera()
});

window.addEventListener("pagehide", () => {
    if (game) saveManager.save({ keepalive: true });
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
