import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";

const browser = await chromium.launch({
    headless: true,
    args: [
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--disable-dev-shm-usage"
    ]
});

try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("http://127.0.0.1:8787", { waitUntil: "networkidle" });
    await page.locator("#username-input").fill("browser_" + randomBytes(6).toString("hex"));
    await page.locator("#password-input").fill("test-password-12345");
    await page.locator("#register-button").click();

    await page.waitForSelector("#game-view:not(.hidden)", { timeout: 30_000 });
    await page.waitForTimeout(700);

    const sceneError = page.locator("#scene-error");
    assert.equal(await sceneError.isVisible(), false,
        "Babylon scene failed: " + await sceneError.textContent() + " " + errors.join("; "));

    const size = await page.locator("#render-canvas").evaluate((canvas) => ({
        width: canvas.width,
        height: canvas.height
    }));
    assert.ok(size.width > 100 && size.height > 100,
        "3D canvas never initialized: " + JSON.stringify(size));

    await page.locator("#render-canvas").focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#money-value")?.textContent === "$19", {
        timeout: 5000
    });
    assert.equal(await page.locator("#money-value").textContent(), "$19");
    assert.deepEqual(errors, []);
    console.log("3D browser test passed: WebGL scene initialized, signed in, and planted from keyboard.");
} finally {
    await browser.close();
}
