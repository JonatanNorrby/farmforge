import schemaSql from "../schema/schema.sql";
import { login, logout, register, json } from "./api/auth.js";
import { loadSave, saveGame } from "./api/save.js";

let schemaReadyPromise = null;

function ensureSchema(env) {
    if (!schemaReadyPromise) {
        schemaReadyPromise = env.DB.exec(schemaSql);
    }

    return schemaReadyPromise;
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        try {
            if (url.pathname.startsWith("/api/")) {
                await ensureSchema(env);
            }

            if (url.pathname === "/api/register" && request.method === "POST") {
                return register(request, env);
            }

            if (url.pathname === "/api/login" && request.method === "POST") {
                return login(request, env);
            }

            if (url.pathname === "/api/logout" && request.method === "POST") {
                return logout(request, env);
            }

            if (url.pathname === "/api/save" && request.method === "GET") {
                return loadSave(request, env);
            }

            if (url.pathname === "/api/save" && request.method === "POST") {
                return saveGame(request, env);
            }

            if (url.pathname.startsWith("/api/")) {
                return json({ error: "API route not found." }, 404);
            }

            return env.ASSETS.fetch(request);
        } catch (error) {
            console.error("Unhandled request error", error);

            if (url.pathname.startsWith("/api/")) {
                return json({ error: "Unexpected server error." }, 500);
            }

            return new Response("Unexpected server error.", { status: 500 });
        }
    }
};
