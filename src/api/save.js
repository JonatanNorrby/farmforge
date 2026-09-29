import { authenticateRequest, json } from "./auth.js";
import { getSave, upsertSave } from "../db/database.js";

const MAX_SAVE_BYTES = 200_000;
const FARM_TILE_COUNT = 64;

function defaultSave(now = Date.now()) {
    return {
        version: 1,
        money: 20,
        inventory: {
            wheat: 0
        },
        farm: Array.from({ length: FARM_TILE_COUNT }, () => ({
            cropId: null,
            plantedAt: 0
        })),
        unlocks: [],
        lastUpdated: now
    };
}

export async function loadSave(request, env) {
    const user = await authenticateRequest(request, env);

    if (!user) {
        return json({ error: "Authentication required." }, 401);
    }

    const row = await getSave(env.DB, user.id);

    if (!row) {
        const save = defaultSave();
        await upsertSave(env.DB, user.id, JSON.stringify(save), Date.now());
        return json({ save });
    }

    try {
        return json({ save: JSON.parse(row.state_json) });
    } catch (error) {
        console.error("Stored save JSON is invalid", error);
        return json({ error: "Stored save could not be loaded." }, 500);
    }
}

export async function saveGame(request, env) {
    const user = await authenticateRequest(request, env);

    if (!user) {
        return json({ error: "Authentication required." }, 401);
    }

    let state;

    try {
        state = await request.json();
    } catch {
        return json({ error: "Save payload must be valid JSON." }, 400);
    }

    if (!state || typeof state !== "object" || Array.isArray(state)) {
        return json({ error: "Save payload is invalid." }, 400);
    }

    state.lastUpdated = Date.now();
    const stateJson = JSON.stringify(state);

    if (new TextEncoder().encode(stateJson).byteLength > MAX_SAVE_BYTES) {
        return json({ error: "Save payload is too large." }, 413);
    }

    await upsertSave(env.DB, user.id, stateJson, state.lastUpdated);
    return json({ ok: true, savedAt: state.lastUpdated });
}
