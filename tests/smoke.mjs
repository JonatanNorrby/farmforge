import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const baseUrl = process.env.FARMFORGE_URL;

if (!baseUrl) {
    throw new Error("FARMFORGE_URL is required.");
}

async function request(path, expectedStatus, expectedText) {
    const url = new URL(path, baseUrl);
    const response = await fetch(url, { redirect: "follow" });
    const body = await response.text();

    console.log(response.status + " " + url + " (" + (response.headers.get("content-type") ?? "no content type") + ")");

    assert.equal(response.status, expectedStatus,
        "Unexpected response for " + path + ": " + body.slice(0, 500));

    if (expectedText) {
        assert.ok(body.includes(expectedText),
            "Response for " + path + " is missing " + JSON.stringify(expectedText));
    }
}

async function postJson(path, data, expectedStatus, cookie = "") {
    const response = await fetch(new URL(path, baseUrl), {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(cookie ? { Cookie: cookie } : {})
        },
        body: JSON.stringify(data)
    });
    const body = await response.text();
    console.log(response.status + " POST " + path);
    assert.equal(response.status, expectedStatus,
        "Unexpected response for POST " + path + ": " + body.slice(0, 500));
    return { response, json: JSON.parse(body) };
}

await request("/", 200, "id=\"render-canvas\"");
await request("/build/game.js", 200);
await request("/css/main.css", 200, ".world-shell");
await request("/api/save", 401, "Authentication required.");

const username = "smoke_" + randomBytes(7).toString("hex");
const password = randomBytes(24).toString("hex");
writeFileSync(".smoke-username", username);

const registered = await postJson("/api/register", { username, password }, 201);
const cookie = registered.response.headers.get("set-cookie")?.split(";")[0];
assert.ok(cookie?.startsWith("farmforge_session="), "Registration did not set a session cookie.");

const saved = await postJson("/api/save", {
    version: 1,
    money: 34,
    inventory: { wheat: 2 },
    farm: Array.from({ length: 64 }, () => ({ cropId: null, plantedAt: 0 })),
    unlocks: [],
    lastUpdated: Date.now()
}, 200, cookie);
assert.equal(saved.json.ok, true);

await postJson("/api/logout", {}, 200, cookie);

const loggedIn = await postJson("/api/login", { username, password }, 200);
const secondCookie = loggedIn.response.headers.get("set-cookie")?.split(";")[0];
assert.ok(secondCookie?.startsWith("farmforge_session="), "Login did not set a session cookie.");

const loaded = await fetch(new URL("/api/save", baseUrl), {
    headers: { Cookie: secondCookie }
});
if (loaded.status !== 200) {
    throw new Error("Could not reload game save (" + loaded.status + "): " + await loaded.text());
}
const { save } = await loaded.json();
assert.equal(save.money, 34);
assert.equal(save.inventory.wheat, 2);

console.log("Deployed Farmforge smoke checks passed: 3D assets, registration, login and save/load.");
