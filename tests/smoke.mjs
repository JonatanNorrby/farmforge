import assert from "node:assert/strict";

const baseUrl = process.env.FARMFORGE_URL;

if (!baseUrl) {
    throw new Error("FARMFORGE_URL is required.");
}

async function request(path, expectedStatus, expectedText) {
    const url = new URL(path, baseUrl);
    const response = await fetch(url, { redirect: "follow" });
    const body = await response.text();

    console.log(`${response.status} ${url} (${response.headers.get("content-type") ?? "no content type"})`);

    assert.equal(
        response.status,
        expectedStatus,
        `Unexpected response for ${path}: ${body.slice(0, 500)}`
    );

    if (expectedText) {
        assert.ok(
            body.includes(expectedText),
            `Response for ${path} is missing ${JSON.stringify(expectedText)}: ${body.slice(0, 500)}`
        );
    }
}

await request("/", 200, "Farmforge");
await request("/js/main.js", 200, "bootstrap()");
await request("/css/main.css", 200, ".farm-grid");
await request("/api/save", 401, "Authentication required.");
console.log("Deployed Farmforge smoke checks passed.");
