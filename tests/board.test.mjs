import assert from "node:assert/strict";
import test from "node:test";
import { renderBoard } from "../public/board.js";
import { ROLE_PAWN_COLORS } from "../src/catalog.js";
import { newGame, view } from "../src/engine.js";

function boardFixture() {
  const game = newGame([
    { id: "one", owner: "host", name: "First", role: "medic" },
    { id: "two", owner: "guest", name: "Second", role: "scientist" },
  ]);
  return view(game, "host");
}

test("each Pacific route crosses both edges at a unique, matching height", () => {
  const html = renderBoard(boardFixture(), "san-francisco");
  const routes = Array.from(
    html.matchAll(
      /data-route="([^"]+)" data-edge="(west|east)" d="M[\d.]+ [\d.]+ L(0|1420) ([\d.]+)"/g,
    ),
  );
  assert.equal(routes.length, 6);
  const seamHeights = new Set();
  for (const route of [
    "san-francisco/tokyo",
    "manila/san-francisco",
    "los-angeles/sydney",
  ]) {
    const west = routes.find(
      (match) => match[1] === route && match[2] === "west",
    );
    const east = routes.find(
      (match) => match[1] === route && match[2] === "east",
    );
    assert.ok(west && east, route);
    assert.equal(west[3], "0");
    assert.equal(east[3], "1420");
    assert.equal(west[4], east[4]);
    seamHeights.add(west[4]);
  }
  assert.equal(seamHeights.size, 3);
});

test("the board shows individual cubes, role-based pawn colors, and marker positions", () => {
  const game = boardFixture();
  game.board.atlanta = { blue: 3, yellow: 2, black: 0, red: 0, purple: 0 };
  game.players.reverse();
  game.outbreaks = 5;
  game.rate = 3;
  game.cures.blue = true;
  game.eradicated.yellow = true;
  const html = renderBoard(game, "atlanta");
  const atlanta = html.split('data-city="atlanta"')[1].split('data-city="')[0];
  assert.equal(
    [...atlanta.matchAll(/class="disease-cube" data-color="blue"/g)].length,
    3,
  );
  assert.equal(
    [...atlanta.matchAll(/class="disease-cube" data-color="yellow"/g)].length,
    2,
  );
  assert.match(
    atlanta,
    new RegExp('data-role="medic" fill="' + ROLE_PAWN_COLORS.medic + '"'),
  );
  assert.match(
    atlanta,
    new RegExp(
      'data-role="scientist" fill="' + ROLE_PAWN_COLORS.scientist + '"',
    ),
  );
  assert.match(html, /infection-track[^]*?current"[^]*?<span>3<\/span>/);
  assert.match(html, /outbreak-track[^]*?current"[^]*?<span>5<\/span>/);
  assert.match(html, /data-disease="blue" data-status="cured"/);
  assert.match(html, /data-disease="yellow" data-status="eradicated"/);
});
