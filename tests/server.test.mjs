import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server.mjs";
async function start(dataDir) {
  const app = createApp({ dataDir });
  await new Promise((r) => app.listen(0, "127.0.0.1", r));
  return { app, url: "http://127.0.0.1:" + app.address().port };
}
async function call(url, route, body, token) {
  const res = await fetch(url + route, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: "Bearer " + token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}
const close = (app) =>
  new Promise((r) => {
    app.closeAllConnections();
    app.close(r);
  });
test("two players: lobby, role selection, hidden decks, stale commands, foreign pawn protection, consent and restart", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pandemic-test-"));
  let { app, url } = await start(dir);
  try {
    let r = await call(url, "/api/rooms", { name: "Alice" });
    assert.equal(r.status, 201);
    const t1 = r.data.token,
      code = r.data.room.code,
      base = "/api/rooms/" + code;
    let room = r.data.room;
    const unauthorized = await call(url, base);
    assert.equal(unauthorized.status, 401);
    r = await call(url, base + "/join", { name: "Bob" });
    assert.equal(r.status, 200);
    const t2 = r.data.token;
    room = r.data.room;
    const alice = room.seats[0],
      bob = room.seats[1];
    r = await call(
      url,
      base + "/lobby",
      {
        version: room.version,
        op: "seatRole",
        seat: alice.id,
        role: "researcher",
      },
      t1,
    );
    room = r.data;
    r = await call(
      url,
      base + "/lobby",
      {
        version: room.version,
        op: "seatRole",
        seat: bob.id,
        role: "scientist",
      },
      t2,
    );
    room = r.data;
    r = await call(url, base + "/start", { version: room.version }, t2);
    assert.equal(r.status, 403);
    r = await call(url, base + "/start", { version: room.version }, t1);
    assert.equal(r.status, 200);
    room = r.data;
    assert.ok(!("playerDeck" in room.game));
    assert.ok(!JSON.stringify(room).includes(t1));
    assert.ok(!JSON.stringify(room).includes(t2));
    const turn = room.game.players[room.game.turn],
      activeToken = turn.owner === alice.owner ? t1 : t2,
      otherToken = activeToken === t1 ? t2 : t1;
    r = await call(
      url,
      base + "/action",
      { version: room.version, actor: turn.id, action: { type: "pass" } },
      otherToken,
    );
    assert.equal(r.status, 403);
    r = await call(
      url,
      base + "/action",
      { version: room.version - 1, actor: turn.id, action: { type: "pass" } },
      activeToken,
    );
    assert.equal(r.status, 409);
    // Share a valid city card from the researcher. If it is not her turn, advance legally first.
    for (
      let i = 0;
      room.game.players[room.game.turn].id !== alice.id && i < 15;
      i++
    ) {
      const p = room.game.players[room.game.turn],
        t = p.owner === alice.owner ? t1 : t2;
      const over = room.game.players.find((p) => p.hand.length > 7);
      if (over) {
        const ownState = await call(
          url,
          base,
          undefined,
          over.owner === alice.owner ? t1 : t2,
        );
        over.hand = ownState.data.game.players.find(
          (p) => p.id === over.id,
        ).hand;
      }
      if (
        over &&
        room.game.phase === "draw" &&
        !room.game.drawQueue.length &&
        !room.game.pending
      ) {
        r = await call(
          url,
          base + "/action",
          {
            version: room.version,
            actor: over.id,
            action: { type: "discard", card: over.hand[0] },
          },
          over.owner === alice.owner ? t1 : t2,
        );
      } else
        r = await call(
          url,
          base + "/action",
          { version: room.version, actor: p.id, action: { type: "advance" } },
          t,
        );
      assert.equal(r.status, 200);
      room = r.data;
    }
    assert.equal(room.game.players[room.game.turn].id, alice.id);
    r = await call(url, base, undefined, t1);
    room = r.data;
    const card = room.game.players
      .find((p) => p.id === alice.id)
      .hand.find((c) => !c.includes(":"));
    r = await call(
      url,
      base + "/action",
      {
        version: room.version,
        actor: alice.id,
        action: { type: "share", direction: "give", player: bob.id, card },
      },
      t1,
    );
    assert.equal(r.status, 200);
    room = r.data;
    assert.ok(room.approval);
    assert.equal(
      room.game.players
        .find((p) => p.id === alice.id)
        .hand.filter((c) => c === card).length,
      1,
    );
    r = await call(
      url,
      base + "/approve",
      { version: room.version, id: room.approval.id, accept: true },
      t2,
    );
    assert.equal(r.status, 200);
    room = r.data;
    assert.equal(room.approval, null);
    assert.ok(
      room.game.players.find((p) => p.id === bob.id).hand.includes(card),
    );
    const version = room.version;
    await close(app);
    ({ app, url } = await start(dir));
    r = await call(url, base, undefined, t1);
    assert.equal(r.status, 200);
    assert.equal(r.data.version, version);
    assert.ok(
      r.data.game.players
        .find((p) => p.id === bob.id)
        .hand.every((c) => c === "hidden"),
    );
    const resumedBob = await call(url, base, undefined, t2);
    assert.ok(
      resumedBob.data.game.players
        .find((p) => p.id === bob.id)
        .hand.includes(card),
    );
  } finally {
    await close(app);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("1-person game uses 2 roles; SSE receives version updates; scripts/static routes and health available", async () => {
  const { app, url } = await start();
  const abort = new AbortController();
  try {
    let r = await call(url, "/api/rooms", { name: "Solo" });
    let room = r.data.room;
    const token = r.data.token,
      base = "/api/rooms/" + room.code;
    r = await call(
      url,
      base + "/lobby",
      { version: room.version, op: "addSeat" },
      token,
    );
    room = r.data;
    const response = await fetch(url + base + "/stream?token=" + token, {
      signal: abort.signal,
    });
    assert.equal(response.headers.get("content-type"), "text/event-stream");
    const reader = response.body.getReader();
    const initial = new TextDecoder().decode((await reader.read()).value);
    assert.ok(initial.includes("retry: 2000"));
    r = await call(url, base + "/start", { version: room.version }, token);
    assert.equal(r.status, 200);
    assert.equal(r.data.game.players.length, 2);
    const update = new TextDecoder().decode((await reader.read()).value);
    assert.ok(update.includes("data: "));
    for (const route of [
      "/",
      "/app.js",
      "/style.css",
      "/src/data.js",
      "/src/catalog.js",
      "/healthz",
    ])
      assert.equal((await fetch(url + route)).status, 200);
    assert.equal((await fetch(url + "/src/engine.js")).status, 404);
    assert.equal((await fetch(url + "/server.mjs")).status, 404);
  } finally {
    abort.abort();
    await close(app);
  }
});
test("four real members each control one role, fifth member rejected and initial hands correct", async () => {
  const { app, url } = await start();
  try {
    let r = await call(url, "/api/rooms", { name: "One" });
    let room = r.data.room;
    const tokens = [r.data.token],
      base = "/api/rooms/" + room.code;
    for (const name of ["Two", "Three", "Four"]) {
      r = await call(url, base + "/join", { name });
      assert.equal(r.status, 200);
      tokens.push(r.data.token);
      room = r.data.room;
    }
    r = await call(url, base + "/join", { name: "Five" });
    assert.equal(r.status, 400);
    r = await call(url, base + "/start", { version: room.version }, tokens[0]);
    assert.equal(r.status, 200);
    room = r.data;
    assert.equal(room.game.players.length, 4);
    assert.ok(room.game.players.every((p) => p.hand.length === 2));
    for (let i = 0; i < 4; i++) {
      r = await call(url, base, undefined, tokens[i]);
      const owner = r.data.you;
      assert.equal(
        r.data.game.players.filter((p) => p.owner === owner).length,
        1,
      );
      assert.ok(
        r.data.game.players
          .filter((p) => p.owner !== owner)
          .every((p) => p.hand.every((c) => c === "hidden")),
      );
    }
  } finally {
    await close(app);
  }
});
