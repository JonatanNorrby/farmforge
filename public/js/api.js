export class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

async function request(path, options = {}) {
    const response = await fetch(path, {
        credentials: "same-origin",
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers ?? {})
        }
    });

    const text = await response.text();
    let data = {};

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = {};
        }
    }

    if (!response.ok) {
        throw new ApiError(data.error ?? "Request failed.", response.status);
    }

    return data;
}

export const api = {
    register(username, password) {
        return request("/api/register", {
            method: "POST",
            body: JSON.stringify({ username, password })
        });
    },

    login(username, password) {
        return request("/api/login", {
            method: "POST",
            body: JSON.stringify({ username, password })
        });
    },

    logout() {
        return request("/api/logout", {
            method: "POST",
            body: "{}"
        });
    },

    loadSave() {
        return request("/api/save");
    },

    saveGame(state, options = {}) {
        return request("/api/save", {
            method: "POST",
            body: JSON.stringify(state),
            keepalive: options.keepalive ?? false
        });
    }
};

export class SaveManager {
    constructor(getState, onStatus) {
        this.getState = getState;
        this.onStatus = onStatus;
        this.intervalId = null;
        this.saving = false;
    }

    start() {
        this.stop();
        this.intervalId = window.setInterval(() => {
            this.save();
        }, 15_000);
    }

    stop() {
        if (this.intervalId !== null) {
            window.clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    async save(options = {}) {
        if (this.saving) {
            return;
        }

        const state = this.getState();

        if (!state) {
            return;
        }

        this.saving = true;
        state.lastUpdated = Date.now();

        try {
            await api.saveGame(state, options);
            this.onStatus("Saved.");
        } catch (error) {
            this.onStatus(error.message ?? "Could not save.", true);
        } finally {
            this.saving = false;
        }
    }
}
