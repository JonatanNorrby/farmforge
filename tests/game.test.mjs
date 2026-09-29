import test from "node:test";
import assert from "node:assert/strict";

import { createInitialState, Game } from "../public/js/game.js";

test("manual wheat loop plants, grows, harvests and sells", () => {
    const game = new Game(createInitialState(1_000));

    assert.equal(game.plant(0, "wheat", 1_000), true);
    assert.equal(game.state.money, 19);
    assert.equal(game.getTileStatus(0, 10_999).state, "growing");
    assert.equal(game.harvest(0, 10_999), false);

    assert.equal(game.getTileStatus(0, 11_000).state, "ready");
    assert.equal(game.harvest(0, 11_000), true);
    assert.equal(game.state.inventory.wheat, 1);

    assert.equal(game.sellAll("wheat"), true);
    assert.equal(game.state.inventory.wheat, 0);
    assert.equal(game.state.money, 22);
});

test("harvester automatically collects mature crops", () => {
    const state = createInitialState(0);
    state.money = 100;

    const game = new Game(state);

    assert.equal(game.buyUnlock("harvester"), true);
    assert.equal(game.state.money, 70);
    assert.equal(game.plant(0, "wheat", 0), true);

    assert.equal(game.update(9_999), false);
    assert.equal(game.state.inventory.wheat, 0);

    assert.equal(game.update(10_000), true);
    assert.equal(game.state.inventory.wheat, 1);
    assert.equal(game.getTileStatus(0, 10_000).state, "empty");
});

test("an unaffordable unlock is not purchased", () => {
    const game = new Game(createInitialState());

    assert.equal(game.buyUnlock("harvester"), false);
    assert.equal(game.hasUnlock("harvester"), false);
});
