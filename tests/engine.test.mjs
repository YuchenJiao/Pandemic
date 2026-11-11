import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame,
  apply,
  infect,
  invariants,
  boardCount,
  current,
  view,
  distance,
  requiredConsents,
  RuleError,
} from "../src/engine.js";
import { CITIES, ADJ, EDGES, COLORS } from "../src/data.js";
import { SEQUENCES, ROLES, EVENTS } from "../src/catalog.js";
const seeded = (seed) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const seats = (roles = ["scientist", "medic"]) =>
  roles.map((role, i) => ({
    id: "p" + i,
    name: "Player " + i,
    owner: "u" + i,
    role,
  }));
function game(options = {}, roles = ["scientist", "medic"]) {
  const s = newGame(seats(roles), options, seeded(42));
  s.turn = 0;
  s.actions = 4;
  s.used = {};
  return s;
}
function clean(options = {}, roles) {
  const s = game(options, roles);
  for (const b of Object.values(s.board))
    for (const c of COLORS) {
      s.supply[c] += b[c];
      b[c] = 0;
    }
  s.ever = {};
  return s;
}
function cube(s, id, c, n) {
  s.supply[c] += s.board[id][c] - n;
  s.board[id][c] = n;
  s.ever[c] = true;
}
const run = (s, a, id = "p0") => apply(s, id, a, seeded(24));
const event = (s, id, p = "p0", a = {}) => {
  s.players.find((x) => x.id === p).hand.push("event:" + id);
  return run(s, { type: "event", event: id, ...a }, p);
};
function setHand(s, cards) {
  s.players[0].hand = cards;
}
function seq(s, id = 0, color = "blue") {
  s.lab.lines[0] = {
    sequence: id,
    color,
    character: "chicago",
    test: null,
    filled: SEQUENCES[id].slots.map(() => null),
  };
}
test("48 cities, 12 of each color, exactly 93 reciprocal unique edges and all wrap links", () => {
  assert.equal(Object.keys(CITIES).length, 48);
  assert.equal(EDGES.length, 93);
  assert.equal(new Set(EDGES.map((e) => [...e].sort().join("|"))).size, 93);
  for (const [id, ns] of Object.entries(ADJ))
    for (const n of ns) assert.ok(ADJ[n].includes(id));
  for (const c of COLORS.slice(0, 4))
    assert.equal(Object.values(CITIES).filter((x) => x.color === c).length, 12);
  for (const [a, b] of [
    ["san-francisco", "tokyo"],
    ["san-francisco", "manila"],
    ["los-angeles", "sydney"],
  ])
    assert.ok(ADJ[a].includes(b));
  assert.equal(distance("santiago", "lima"), 1);
});
test("setup: 18 cubes, 9 discards, correct hands and epidemic pile spacing", () => {
  const s = game();
  assert.equal(
    COLORS.reduce((n, c) => n + boardCount(s, c), 0),
    18,
  );
  assert.equal(s.infectionDiscard.length, 9);
  assert.equal(s.players[0].hand.length, 4);
  assert.equal(s.playerDeck.filter((c) => c.startsWith("epidemic:")).length, 5);
  const sizes = [10, 10, 10, 9, 9];
  let offset = 0;
  for (const n of sizes) {
    assert.equal(
      s.playerDeck
        .slice(offset, offset + n)
        .filter((c) => c.startsWith("epidemic:")).length,
      1,
    );
    offset += n;
  }
  invariants(s);
});
test("random earlier seat cannot steal later explicitly selected role", () => {
  const s = newGame([{ ...seats()[0], role: null }, seats()[1]], {}, seeded(4));
  assert.equal(s.players[1].role, "medic");
  assert.notEqual(s.players[0].role, "medic");
});
for (let mask = 0; mask < 8; mask++)
  test("all challenge combinations preserve cube accounting: " + mask, () => {
    for (let seed = 0; seed < 15; seed++) {
      let s = newGame(
        seats(["generalist", "epidemiologist"]),
        {
          expansionCards: true,
          virulent: !!(mask & 1),
          mutation: !!(mask & 2),
          lab: !!(mask & 4),
        },
        seeded(seed),
      );
      invariants(s);
      let n = 0;
      while (s.status === "playing" && n++ < 180) {
        const p = current(s),
          a = s.players.find(
            (p) => p.hand.length > (p.role === "archivist" ? 8 : 7),
          );
        if (a && (!s.drawQueue.length || s.phase !== "draw") && !s.pending)
          s = apply(s, a.id, { type: "discard", card: a.hand[0] }, seeded(n));
        else s = apply(s, p.id, { type: "advance" }, seeded(n));
        invariants(s);
      }
      assert.ok(n < 180);
    }
  });
test("Worldwide Panic setup: 24 total on board, 6 purple, supply18,12/24 cube variants", () => {
  for (const lab of [false, true]) {
    const s = game({ mutation: true, worldwide: true, lab });
    assert.equal(boardCount(s, "purple"), 6);
    assert.equal(s.supply.purple, 18);
    invariants(s);
  }
  assert.equal(game({ mutation: true }).supply.purple, 12);
});
test("rejected action is transactional, cannot move without edge or card", () => {
  const s = game(),
    old = JSON.stringify(s);
  assert.throws(
    () => run(s, { type: "move", mode: "drive", to: "tokyo" }),
    RuleError,
  );
  assert.equal(JSON.stringify(s), old);
});
test("drive/direct/charter/shuttle legal moves spend 1 and city cards correctly", () => {
  let s = game();
  s = run(s, { type: "move", mode: "drive", to: "chicago" });
  assert.equal(s.actions, 3);
  assert.equal(s.players[0].city, "chicago");
  setHand(s, ["tokyo", "tokyo-invalid"]);
  s = run(s, { type: "move", mode: "direct", to: "tokyo" });
  assert.ok(!s.players[0].hand.includes("tokyo"));
  s.players[0].hand = ["tokyo"];
  s = run(s, { type: "move", mode: "charter", to: "london" });
  s.stations.push("london");
  s = run(s, { type: "move", mode: "shuttle", to: "atlanta" });
  assert.equal(s.actions, 0);
});
test("chain outbreak city only once, 3 cubes maximum per color", () => {
  const s = clean();
  cube(s, "atlanta", "blue", 3);
  cube(s, "chicago", "blue", 3);
  infect(s, "atlanta", "blue");
  assert.equal(s.outbreaks, 2);
  assert.equal(s.board.atlanta.blue, 3);
  assert.equal(s.board.chicago.blue, 3);
  assert.equal(s.board.washington.blue, 1);
  invariants(s);
});
test("loss on eighth outbreak and only actually required cube shortage", () => {
  let s = clean();
  s.outbreaks = 7;
  cube(s, "atlanta", "blue", 3);
  infect(s, "atlanta", "blue");
  assert.equal(s.status, "lost");
  s = clean();
  cube(s, "atlanta", "blue", 3);
  s.supply.blue = 0;
  infect(s, "atlanta", "blue");
  assert.equal(s.status, "lost");
});
test("quarantine prevents neighboring placements and outbreaks", () => {
  const s = clean({}, ["quarantine_specialist", "medic"]);
  cube(s, "chicago", "blue", 3);
  infect(s, "chicago", "blue");
  assert.equal(s.outbreaks, 0);
  assert.equal(s.board.chicago.blue, 3);
  infect(s, "miami", "yellow");
  assert.equal(s.board.miami.yellow, 0);
});
test("medic actual Treat removes all; cured entering auto removes and blocks placement", () => {
  let s = clean({}, ["medic", "scientist"]);
  cube(s, "atlanta", "blue", 3);
  s = run(s, { type: "treat", color: "blue" });
  assert.equal(s.board.atlanta.blue, 0);
  cube(s, "chicago", "blue", 3);
  s.cures.blue = true;
  s = run(s, { type: "move", mode: "drive", to: "chicago" });
  assert.equal(s.board.chicago.blue, 0);
  infect(s, "chicago", "blue");
  assert.equal(s.board.chicago.blue, 0);
  invariants(s);
});
test("normal cured disease treats all cubes, uncured one", () => {
  let s = clean();
  cube(s, "atlanta", "yellow", 3);
  s = run(s, { type: "treat", color: "yellow" });
  assert.equal(s.board.atlanta.yellow, 2);
  s.cures.yellow = true;
  s = run(s, { type: "treat", color: "yellow" });
  assert.equal(s.board.atlanta.yellow, 0);
  assert.ok(s.eradicated.yellow);
});
test("researcher can give any city but cannot receive arbitrary card", () => {
  let s = clean({}, ["researcher", "scientist"]);
  setHand(s, ["tokyo"]);
  s = run(s, { type: "share", direction: "give", player: "p1", card: "tokyo" });
  assert.ok(s.players[1].hand.includes("tokyo"));
  assert.throws(
    () =>
      run(s, { type: "share", direction: "take", player: "p1", card: "tokyo" }),
    RuleError,
  );
  assert.deepEqual(requiredConsents(s, "p0", { type: "share", player: "p1" }), [
    "p1",
  ]);
});
test("scientist needs exactly 4 cities, at station, immediately wins fourth cure", () => {
  let s = clean();
  setHand(s, ["chicago", "montreal", "london", "paris"]);
  s.cures = { red: true, black: true, yellow: true };
  s = run(s, { type: "cure", color: "blue", cards: s.players[0].hand });
  assert.equal(s.status, "won");
  assert.equal(s.cures.blue, true);
});
test("cannot freely discard; overlimit interrupts actions; events still usable", () => {
  let s = game();
  assert.throws(() => run(s, { type: "discard", card: s.players[0].hand[0] }));
  s.players[0].hand = Object.keys(CITIES).slice(0, 8);
  assert.throws(() => run(s, { type: "move", mode: "drive", to: "chicago" }));
  s = run(s, { type: "discard", card: s.players[0].hand[0] });
  assert.equal(s.players[0].hand.length, 7);
});
test("epidemic fills city and outbreaks once; resilience window before intensify", () => {
  let s = clean();
  cube(s, "tokyo", "red", 1);
  s.infectionDeck = ["paris", "tokyo"];
  s.infectionDiscard = [];
  s.playerDeck = ["epidemic:normal", "london", "essen"];
  s = run(s, { type: "advance" });
  s = run(s, { type: "advance" });
  assert.equal(s.board.tokyo.red, 3);
  assert.equal(s.outbreaks, 1);
  assert.equal(s.pending.type, "intensify");
  assert.throws(() => event(s, "one_quiet_night"));
  s = event(s, "resilient_population", "p0", { card: "tokyo" });
  assert.ok(s.infectionRemoved.includes("tokyo"));
  s = run(s, { type: "advance" });
  assert.ok(!s.infectionDeck.includes("tokyo"));
  assert.equal(s.pending, null);
});
test("mutation resolves before drawn epidemic; infection cards initially only in discard", () => {
  let s = clean({ mutation: true });
  assert.ok(!s.infectionDeck.some((c) => c.startsWith("mutation")));
  s.playerDeck = ["epidemic:normal", "mutation:threatens"];
  s = run(s, { type: "advance" });
  assert.ok(s.drawQueue[0].startsWith("mutation"));
  assert.throws(() => run(s, { type: "advance", card: "epidemic:normal" }));
  s = run(s, { type: "advance" });
  assert.equal(boardCount(s, "purple"), 3);
  assert.ok(!s.pending);
});
test("normal city infection adds native and purple; Mutation bottom card only purple", () => {
  let s = clean({ mutation: true });
  cube(s, "tokyo", "purple", 1);
  s.phase = "infect";
  s.infectionLeft = 1;
  s.infectionDeck = ["tokyo", "paris"];
  s = run(s, { type: "advance" });
  assert.equal(s.board.tokyo.red, 1);
  assert.equal(s.board.tokyo.purple, 2);
  s.infectionDeck = ["mutation-1", "paris"];
  s.infectionLeft = 1;
  s = run(s, { type: "advance" });
  assert.equal(s.board.paris.purple, 1);
  assert.equal(s.board.paris.blue, 0);
  invariants(s);
});
test("purple cure arbitrary colors but needs currently purple city; four natural cures and no board purple wins", () => {
  let s = clean({ mutation: true });
  setHand(s, ["tokyo", "london", "paris", "mumbai"]);
  assert.throws(() =>
    run(s, { type: "cure", color: "purple", cards: s.players[0].hand }),
  );
  cube(s, "tokyo", "purple", 1);
  s = run(s, { type: "cure", color: "purple", cards: s.players[0].hand });
  assert.ok(s.cures.purple);
  s = clean({ mutation: true });
  s.cures = { blue: true, yellow: true, black: true, red: true };
  s = run(s, { type: "pass" });
  assert.equal(s.status, "won");
});
test("virulent: original mutation excludes purple strain and selects most map cubes", () => {
  let s = clean({ mutation: true, virulent: true });
  cube(s, "tokyo", "purple", 3);
  cube(s, "shanghai", "purple", 3);
  cube(s, "atlanta", "yellow", 3);
  s.infectionDeck = ["london", "paris"];
  s.playerDeck = ["epidemic:chronic_effect", "tokyo"];
  s = run(s, { type: "advance" });
  s = run(s, { type: "advance" });
  assert.notEqual(s.strain, "purple");
  s = run(s, { type: "advance" });
  assert.ok(s.strainEffects.includes("chronic_effect"));
});
test("chronic adds2 only on empty native VS; slippery slope doubles outbreak track", () => {
  let s = clean({ virulent: true });
  s.strain = "blue";
  s.strainEffects = ["chronic_effect", "slippery_slope"];
  s.phase = "infect";
  s.infectionLeft = 2;
  s.infectionDeck = ["london", "essen"];
  s = run(s, { type: "advance" });
  assert.equal(s.board.london.blue, 2);
  cube(s, "essen", "blue", 3);
  s = run(s, { type: "advance" });
  assert.equal(s.outbreaks, 2);
  invariants(s);
});
test("rate effect adds exactly 1 and no recursive extras", () => {
  let s = clean({ virulent: true });
  s.strain = "blue";
  s.strainEffects = ["rate_effect"];
  s.phase = "infect";
  s.infectionLeft = 1;
  s.infectionDeck = ["london", "essen", "tokyo"];
  s = run(s, { type: "advance" });
  assert.equal(s.infectionLeft, 1);
  s = run(s, { type: "advance" });
  assert.equal(s.infectionLeft, 0);
});
test("highly contagious original outbreak spreads2, chain outbreak spreads1", () => {
  const s = clean({ virulent: true });
  s.strain = "blue";
  s.strainEffects = ["highly_contagious"];
  cube(s, "atlanta", "blue", 3);
  cube(s, "chicago", "blue", 2);
  infect(s, "atlanta", "blue");
  assert.equal(s.outbreaks, 2);
  assert.equal(s.board.chicago.blue, 3);
  assert.equal(s.board.miami.blue, 2);
  assert.equal(s.board["san-francisco"].blue, 1);
  invariants(s);
});
test("Infection Zone Ban allows spread placements but suppresses chain outbreaks", () => {
  const s = clean();
  cube(s, "atlanta", "blue", 3);
  cube(s, "chicago", "blue", 2);
  s.effects.zoneBan = { expires: "p0", card: "event:infection_zone_ban" };
  infect(s, "atlanta", "blue", 1);
  assert.equal(s.outbreaks, 1);
  assert.equal(s.board.chicago.blue, 3);
  assert.equal(s.board.miami.blue, 1);
  infect(s, "atlanta", "blue");
  assert.equal(s.outbreaks, 2);
  invariants(s);
});
test("government interference blocks leave until current actor treated city", () => {
  let s = clean({ virulent: true });
  s.strain = "blue";
  s.strainEffects = ["government_interference"];
  cube(s, "atlanta", "blue", 2);
  assert.throws(() => run(s, { type: "move", mode: "drive", to: "chicago" }));
  s = run(s, { type: "treat", color: "blue" });
  s = run(s, { type: "move", mode: "drive", to: "chicago" });
  assert.equal(s.players[0].city, "chicago");
});
test("resistant takes2 actions in same turn; Scientist cure VS needs extra card", () => {
  let s = clean({ virulent: true });
  s.strain = "blue";
  s.strainEffects = ["resistant_to_treatment", "complex_molecular_structure"];
  cube(s, "atlanta", "blue", 3);
  s.actions = 1;
  assert.throws(() => run(s, { type: "treat", color: "blue" }));
  s.actions = 4;
  s = run(s, { type: "treat", color: "blue" });
  assert.equal(s.actions, 2);
  setHand(s, ["chicago", "montreal", "london", "paris"]);
  assert.throws(() =>
    run(s, { type: "cure", color: "blue", cards: s.players[0].hand }),
  );
  s.players[0].hand.push("essen");
  s = run(s, { type: "cure", color: "blue", cards: s.players[0].hand });
  assert.ok(!s.strainEffects.includes("resistant_to_treatment"));
});
test("lab sample one per Treat, Medic auto never samples, sample in supply accounting", () => {
  let s = clean({ lab: true }, ["medic", "scientist"]);
  cube(s, "atlanta", "blue", 3);
  s = run(s, { type: "treat", color: "blue", sample: "sample1" });
  assert.equal(s.lab.dishes.sample1.blue, 1);
  assert.equal(s.supply.blue, 23);
  assert.equal(boardCount(s, "blue"), 0);
  invariants(s);
});
test("full lab pipeline: sample → centrifuge → growth → sequence, early test, cure2", () => {
  let s = clean({ lab: true });
  seq(s);
  cube(s, "atlanta", "blue", 3);
  setHand(s, ["chicago", "montreal", "london", "paris", "essen"]);
  s = run(s, { type: "treat", color: "blue", sample: "sample1" });
  s.actions = 20;
  s = run(s, {
    type: "lab",
    op: "process",
    from: "sample1",
    to: "centrifuge",
    color: "blue",
  });
  s = run(s, { type: "lab", op: "process", from: "centrifuge", to: "growth" });
  s = run(s, { type: "lab", op: "process", from: "growth", to: "line0" });
  assert.equal(s.lab.lines[0].filled.filter(Boolean).length, 2);
  s = run(s, {
    type: "lab",
    op: "test",
    line: 0,
    card: "montreal",
    city: "atlanta",
  });
  assert.equal(s.board.atlanta.blue, 1);
  s = run(s, { type: "treat", color: "blue", sample: "sample2" });
  s = run(s, { type: "lab", op: "process", from: "sample2", to: "separator" });
  s = run(s, { type: "lab", op: "process", from: "separator", to: "growth" });
  s = run(s, { type: "lab", op: "process", from: "growth", to: "line0" });
  assert.ok(s.lab.lines[0].filled.every(Boolean));
  s = run(s, { type: "cure", color: "blue", cards: ["london", "paris"] });
  assert.ok(s.cures.blue);
  assert.equal(s.supply.blue, 24);
  invariants(s);
});
test("lab characterization consumes card, purple needs current cube and eligible sequence", () => {
  let s = clean({ lab: true, mutation: true });
  s.lab.lines[0] = {
    sequence: 10,
    color: null,
    character: null,
    test: null,
    filled: Array(8).fill(null),
  };
  setHand(s, ["tokyo"]);
  assert.throws(() =>
    run(s, {
      type: "lab",
      op: "characterize",
      line: 0,
      color: "purple",
      card: "tokyo",
    }),
  );
  cube(s, "tokyo", "purple", 1);
  s = run(s, {
    type: "lab",
    op: "characterize",
    line: 0,
    color: "purple",
    card: "tokyo",
  });
  assert.equal(s.lab.lines[0].color, "purple");
  assert.ok(!s.players[0].hand.includes("tokyo"));
});
test("lab processing entire dish, centrifuge filters, separator deduplicates", () => {
  let s = clean({ lab: true });
  for (const [c, n] of [
    ["blue", 3],
    ["red", 2],
  ]) {
    s.supply[c] -= n;
    s.lab.dishes.sample1[c] = n;
  }
  s = run(s, { type: "lab", op: "process", from: "sample1", to: "separator" });
  assert.equal(s.lab.dishes.separator.blue, 1);
  assert.equal(s.lab.dishes.separator.red, 1);
  assert.equal(s.lab.dishes.sample1.blue, 0);
  invariants(s);
  s.lab.dishes.sample2.red = 1;
  s.supply.red--;
  s.lab.dishes.sample2.blue = 1;
  s.supply.blue--;
  s = run(s, {
    type: "lab",
    op: "process",
    from: "sample2",
    to: "centrifuge",
    color: "blue",
  });
  assert.equal(s.lab.dishes.centrifuge.blue, 1);
  assert.equal(s.lab.dishes.centrifuge.red, 0);
  invariants(s);
});
test("lab growth cube shortage loses without destroying existing samples", () => {
  let s = clean({ lab: true });
  s.lab.dishes.centrifuge.blue = 13;
  s.supply.blue = 11;
  s = run(s, { type: "lab", op: "process", from: "centrifuge", to: "growth" });
  assert.equal(s.status, "lost");
  assert.equal(s.lab.dishes.growth.blue, 13);
  invariants(s);
});
test("lab sequence cannot be processed before characterization; test needs at least1 cube", () => {
  const s = clean({ lab: true });
  s.lab.lines[0] = {
    sequence: 0,
    color: null,
    character: null,
    test: null,
    filled: Array(4).fill(null),
  };
  s.lab.dishes.growth.blue = 1;
  s.supply.blue--;
  assert.throws(() =>
    run(s, { type: "lab", op: "process", from: "growth", to: "line0" }),
  );
  s.lab.lines[0].color = "blue";
  setHand(s, ["london"]);
  assert.throws(() =>
    run(s, {
      type: "lab",
      op: "test",
      line: 0,
      card: "london",
      city: "atlanta",
    }),
  );
});
test("lab wildcard eradicated fixed slot accepts any but gray requires cure color", () => {
  let s = clean({ lab: true });
  seq(s, 4, "yellow");
  s.eradicated.blue = true;
  s.lab.dishes.growth.red = 1;
  s.supply.red--;
  s = run(s, {
    type: "lab",
    op: "process",
    from: "growth",
    to: "line0",
    allocation: [null, null, "red", null, null, null],
  });
  assert.equal(s.lab.lines[0].filled[2], "red");
  invariants(s);
});
test("lab build bonus can open second line; second station alone does not", () => {
  let s = clean({ lab: true });
  setHand(s, ["atlanta"]);
  s.stations = ["chicago"];
  s = run(s, { type: "build" });
  assert.equal(s.pending.type, "bonusLab");
  assert.equal(s.lab.lines[1], null);
  s = run(s, { type: "bonusLab", op: "sequence" });
  assert.equal(s.pending.type, "sequence");
  s = run(s, { type: "sequenceChoice", line: 1 });
  assert.ok(s.lab.lines[1]);
  invariants(s);
});
test("government grant bonus lab allowed remotely", () => {
  let s = clean({ lab: true });
  s.players[0].city = "tokyo";
  s = event(s, "government_grant", "p0", { to: "sydney" });
  assert.equal(s.pending.type, "bonusLab");
  s = run(s, { type: "bonusLab", op: "sequence" });
  assert.equal(s.pending.type, "sequence");
});
test("lab card exhaustion exception only when all appeared diseases are cured", () => {
  let s = clean({ lab: true });
  s.ever = { blue: true, red: true };
  s.cures = { blue: true, red: true };
  s.playerDeck = ["london"];
  s = run(s, { type: "advance" });
  assert.equal(s.status, "won");
  s = clean({ lab: true });
  s.ever = { blue: true };
  s.playerDeck = [];
  s = run(s, { type: "advance" });
  assert.equal(s.status, "lost");
});
test("Researcher/Epidemiologist free lab actions work after last action", () => {
  let s = clean({ lab: true, expansionCards: true }, [
    "researcher",
    "epidemiologist",
  ]);
  s.actions = 0;
  s = run(s, { type: "role" });
  assert.equal(s.pending.type, "sequence");
  assert.equal(s.actions, 0);
  assert.throws(() => run(s, { type: "lab", op: "sequence" }));
});
test("Operations expert station no card and once-per-turn station flight", () => {
  let s = clean({ expansionCards: true }, ["operations_expert", "scientist"]);
  s.players[0].city = "tokyo";
  setHand(s, ["london"]);
  s = run(s, { type: "build" });
  assert.ok(s.stations.includes("tokyo"));
  s = run(s, {
    type: "move",
    mode: "operations",
    to: "sydney",
    card: "london",
  });
  assert.equal(s.players[0].city, "sydney");
  assert.throws(() =>
    run(s, { type: "move", mode: "operations", to: "atlanta", card: "london" }),
  );
});
test("Dispatcher uses own cards, target arrival effects and consent", () => {
  let s = clean({}, ["dispatcher", "medic"]);
  s.cures.red = true;
  cube(s, "tokyo", "red", 3);
  setHand(s, ["tokyo"]);
  s = run(s, { type: "move", mode: "direct", pawn: "p1", to: "tokyo" });
  assert.equal(s.board.tokyo.red, 0);
  assert.equal(s.players[0].hand.length, 0);
  assert.equal(s.players[1].city, "tokyo");
});
test("Pilot range3/passenger; cannot drive/build; Dispatcher may move Pilot normally", () => {
  let s = clean({ expansionCards: true }, ["pilot", "medic"]);
  assert.throws(() => run(s, { type: "move", mode: "drive", to: "chicago" }));
  assert.throws(() => run(s, { type: "build" }));
  s = run(s, {
    type: "move",
    mode: "pilot",
    to: "san-francisco",
    passenger: "p1",
  });
  assert.equal(s.players[1].city, "san-francisco");
  assert.throws(() =>
    run(s, { type: "move", mode: "pilot", to: "johannesburg" }),
  );
});
test("Containment arrival removes each color with2+; not automatic samples", () => {
  let s = clean({ expansionCards: true, lab: true }, [
    "containment_specialist",
    "medic",
  ]);
  cube(s, "chicago", "blue", 2);
  cube(s, "chicago", "red", 3);
  s = run(s, { type: "move", mode: "drive", to: "chicago" });
  assert.equal(s.board.chicago.blue, 1);
  assert.equal(s.board.chicago.red, 2);
  assert.equal(s.lab.dishes.sample1.blue, 0);
  invariants(s);
});
test("Field operative sample substitution and return outside own turn", () => {
  let s = clean({ expansionCards: true }, ["field_operative", "medic"]);
  setHand(s, ["london", "paris", "essen"]);
  s.players[0].samples.blue = 3;
  s.supply.blue -= 3;
  s = run(s, {
    type: "cure",
    color: "blue",
    cards: s.players[0].hand,
    useSamples: true,
  });
  assert.ok(s.cures.blue);
  invariants(s);
  s.players[0].samples.red = 1;
  s.supply.red--;
  s.turn = 1;
  s = run(s, { type: "role", op: "return", color: "red" });
  assert.equal(s.players[0].samples.red, 0);
  invariants(s);
});
test("Virologist same-color pair replaces exactly one needed card", () => {
  let s = clean({ expansionCards: true }, ["virologist", "medic"]);
  setHand(s, [
    "tokyo",
    "shanghai",
    "beijing",
    "london",
    "paris",
    "mumbai",
    "delhi",
  ]);
  s = run(s, { type: "cure", color: "red", cards: s.players[0].hand });
  assert.ok(s.cures.red);
});
test("Forecast reveals only owner, reorder permutation enforced", () => {
  let s = clean();
  s = event(s, "forecast");
  const cards = s.pending.cards;
  assert.equal(view(s, "u1").pending.cards, undefined);
  assert.deepEqual(view(s, "u0").pending.cards, cards);
  assert.throws(() =>
    run(s, { type: "forecastChoice", cards: cards.slice(1) }),
  );
  s = run(s, { type: "forecastChoice", cards: [...cards].reverse() });
  assert.deepEqual(s.infectionDeck.slice(0, 6), [...cards].reverse());
});
test("One Quiet Night skips entire next infection, not epidemic", () => {
  let s = clean();
  s = event(s, "one_quiet_night");
  s.phase = "draw";
  s.drawQueue = [];
  s = run(s, { type: "advance" });
  assert.equal(s.phase, "infect");
  assert.equal(s.infectionLeft, 0);
});
test("Stored event removed permanently; persistent stored event not returned on expiry", () => {
  let s = clean({}, ["contingency_planner", "medic"]);
  s.playerDiscard.push("event:improved_sanitation");
  s = run(s, { type: "role", card: "event:improved_sanitation" });
  s = run(s, { type: "event", event: "improved_sanitation" });
  assert.ok(s.eventRemoved.includes("event:improved_sanitation"));
  s.phase = "infect";
  s.infectionLeft = 0;
  s.turn = 1;
  s = run(s, { type: "advance" }, "p1");
  assert.ok(!s.playerDiscard.includes(null));
  assert.ok(!s.playerDiscard.includes("event:improved_sanitation"));
});
test("Rapid vaccine only immediately after cure, not after other action or draw", () => {
  let s = clean();
  s.lastCure = "blue";
  s.players[0].hand = ["event:rapid_vaccine_deployment"];
  cube(s, "chicago", "blue", 1);
  s = run(s, { type: "pass" });
  assert.throws(() =>
    run(s, {
      type: "event",
      event: "rapid_vaccine_deployment",
      removals: [{ city: "chicago" }],
    }),
  );
});
test("hidden decks never sent, mutation queue visible but next player/infection cards hidden", () => {
  const s = game({ lab: true });
  const v = view(s, "u0");
  assert.ok(!("playerDeck" in v));
  assert.ok(!("infectionDeck" in v));
  assert.ok(!("deck" in v.lab));
  assert.equal(v.playerDeckCount, s.playerDeck.length);
});
test("hand limit cannot discard before drawn epidemics and blocks advancing infection", () => {
  let s = clean();
  s.phase = "draw";
  s.drawQueue = ["epidemic:normal"];
  s.players[0].hand = Object.keys(CITIES).slice(0, 8);
  assert.throws(() => run(s, { type: "discard", card: "san-francisco" }));
  s.phase = "infect";
  s.drawQueue = [];
  s.infectionLeft = 1;
  assert.throws(() => run(s, { type: "advance" }));
  s = run(s, { type: "discard", card: "san-francisco" });
  assert.equal(s.players[0].hand.length, 7);
});
test("private hands at Standard, shared at Introductory, drawing log never leaks cards", () => {
  let s = game();
  assert.ok(view(s, "u0").players[1].hand.every((c) => c === "hidden"));
  assert.deepEqual(view(s, "u0").players[0].hand, s.players[0].hand);
  s.options.epidemics = 4;
  assert.deepEqual(view(s, "u0").players[1].hand, s.players[1].hand);
  s.options.epidemics = 5;
  s.playerDeck = ["london", "paris"];
  s = run(s, { type: "advance" });
  assert.ok(!s.log.at(-1).includes("London"));
  assert.ok(!s.log.at(-1).includes("Paris"));
});
test("Troubleshooter only sees turn-start snapshot, not refreshed top cards", () => {
  let s = game({ expansionCards: true }, ["troubleshooter", "medic"]);
  s.phase = "infect";
  s.infectionLeft = 0;
  s.turn = 1;
  s = run(s, { type: "advance" }, "p1");
  const original = view(s, "u0").peek;
  s.infectionDeck.reverse();
  assert.deepEqual(view(s, "u0").peek, original);
  assert.ok(!("privatePeek" in view(s, "u1")));
  assert.ok(!view(s, "u1").peek);
  setHand(s, ["tokyo"]);
  s = run(s, { type: "move", mode: "direct", to: "tokyo" });
  assert.ok(s.players[0].hand.includes("tokyo"));
});
test("Archivist can retrieve only own-city card once and limit8", () => {
  let s = clean({ expansionCards: true }, ["archivist", "medic"]);
  s.playerDiscard.push("atlanta");
  s = run(s, { type: "role" });
  assert.ok(s.players[0].hand.includes("atlanta"));
  s.playerDiscard.push("atlanta");
  assert.throws(() => run(s, { type: "role" }));
});
test("Epidemiologist free transfer once, plus separate free processing in Lab", () => {
  let s = clean({ expansionCards: true, lab: true }, [
    "epidemiologist",
    "medic",
  ]);
  s.players[1].hand = ["tokyo"];
  s = run(s, { type: "role", op: "take", player: "p1", card: "tokyo" });
  assert.equal(s.actions, 4);
  s.lab.dishes.sample1.red = 1;
  s.supply.red--;
  s = run(s, { type: "role", op: "process", from: "sample1", to: "separator" });
  assert.equal(s.actions, 4);
  assert.throws(() =>
    run(s, { type: "role", op: "process", from: "separator", to: "growth" }),
  );
  invariants(s);
});
test("Local liaison remote give uses city color; separate free lab characterize", () => {
  let s = clean({ expansionCards: true, lab: true }, [
    "local_liaison",
    "medic",
  ]);
  s.players[1].city = "london";
  setHand(s, ["chicago", "montreal"]);
  s = run(s, { type: "role", op: "give", player: "p1", card: "chicago" });
  assert.ok(s.players[1].hand.includes("chicago"));
  assert.equal(s.actions, 3);
  s.lab.lines[0] = {
    sequence: 0,
    color: null,
    character: null,
    test: null,
    filled: Array(4).fill(null),
  };
  s = run(s, {
    type: "role",
    op: "characterize",
    line: 0,
    color: "blue",
    card: "montreal",
  });
  assert.equal(s.actions, 3);
  assert.equal(s.lab.lines[0].color, "blue");
});
test("Field director may treat adjacent city and free drive another pawn once", () => {
  let s = clean({ expansionCards: true }, ["field_director", "medic"]);
  cube(s, "chicago", "blue", 2);
  s = run(s, { type: "treat", city: "chicago", color: "blue" });
  assert.equal(s.board.chicago.blue, 1);
  s = run(s, { type: "role", player: "p1", to: "chicago" });
  assert.equal(s.players[1].city, "chicago");
  assert.equal(s.actions, 3);
  assert.throws(() => run(s, { type: "role", player: "p1", to: "montreal" }));
});
test("remote treatment and reexamined research resolve with accounting and recipient limit", () => {
  let s = clean();
  cube(s, "tokyo", "red", 2);
  s = event(s, "remote_treatment", "p0", {
    removals: [
      { city: "tokyo", color: "red" },
      { city: "tokyo", color: "red" },
    ],
  });
  assert.equal(s.board.tokyo.red, 0);
  s.playerDiscard.push("tokyo");
  s = event(s, "reexamined_research", "p0", { card: "tokyo", player: "p1" });
  assert.ok(s.players[1].hand.includes("tokyo"));
  invariants(s);
});
test("improved sanitation adds1 to Treat, duration until event owner next turn", () => {
  let s = clean();
  cube(s, "atlanta", "blue", 3);
  s = event(s, "improved_sanitation", "p1");
  s = run(s, { type: "treat", color: "blue" });
  assert.equal(s.board.atlanta.blue, 1);
  s.phase = "infect";
  s.infectionLeft = 0;
  s = run(s, { type: "advance" });
  assert.ok(!s.effects.sanitation);
  assert.ok(s.playerDiscard.includes("event:improved_sanitation"));
});
test("travel ban expires on CURRENT player next turn and borrowed time only actions phase", () => {
  let s = clean();
  s = event(s, "commercial_travel_ban", "p1");
  assert.equal(s.effects.travelBan.expires, "p0");
  s = event(s, "borrowed_time");
  assert.equal(s.actions, 6);
  s.phase = "draw";
  assert.throws(() => event(s, "borrowed_time"));
  s.phase = "infect";
  s.infectionLeft = 0;
  s.turn = 1;
  s = run(s, { type: "advance" }, "p1");
  assert.ok(!s.effects.travelBan);
});
test("sequencing breakthrough next cure saves1, then discards reminder", () => {
  let s = clean();
  setHand(s, ["chicago", "montreal", "paris"]);
  s = event(s, "sequencing_breakthrough");
  s = run(s, {
    type: "cure",
    color: "blue",
    cards: ["chicago", "montreal", "paris"],
  });
  assert.ok(s.cures.blue);
  assert.ok(!s.effects.breakthrough);
  assert.ok(s.playerDiscard.includes("event:sequencing_breakthrough"));
});
test("special orders uses current player own direct flight card, movement consent required", () => {
  let s = clean();
  setHand(s, ["tokyo"]);
  s = event(s, "special_orders", "p0", { player: "p1" });
  s = run(s, { type: "move", mode: "direct", pawn: "p1", to: "tokyo" });
  assert.equal(s.players[1].city, "tokyo");
  assert.ok(!s.players[0].hand.includes("tokyo"));
  assert.deepEqual(
    requiredConsents(s, "p0", { type: "move", pawn: "p1", to: "tokyo" }),
    ["p1"],
  );
});
test("New Assignment grants Generalist bonus only once even if role changes twice", () => {
  let s = clean({ expansionCards: true });
  s = event(s, "new_assignment", "p0", { player: "p0", role: "generalist" });
  assert.equal(s.actions, 5);
  s = event(s, "new_assignment", "p0", { player: "p0", role: "archivist" });
  s = event(s, "new_assignment", "p0", { player: "p0", role: "generalist" });
  assert.equal(s.actions, 5);
});
test("all 14 Sequence cards: four mono4, six pair6, four wildcard8 including fourth photographed", () => {
  assert.equal(SEQUENCES.length, 14);
  assert.equal(SEQUENCES.filter((s) => s.slots.length === 4).length, 4);
  assert.equal(SEQUENCES.filter((s) => s.slots.length === 6).length, 6);
  assert.equal(SEQUENCES.filter((s) => s.slots.length === 8).length, 4);
  assert.deepEqual(SEQUENCES[13].slots, [
    "gray",
    "gray",
    "blue",
    "blue",
    "blue",
    "blue",
    "black",
    "yellow",
  ]);
});
test("sequence replacement compatible retains characterize/test and cubes, incompatible resets", () => {
  let s = clean({ lab: true });
  seq(s, 0, "blue");
  s.lab.lines[0].test = "montreal";
  s.lab.lines[0].filled = ["blue", "blue", null, null];
  s.supply.blue -= 2;
  s.pending = { type: "sequence", player: "p0", sequence: 4 };
  s = run(s, { type: "sequenceChoice", line: 0 });
  assert.equal(s.lab.lines[0].color, "blue");
  assert.equal(s.lab.lines[0].test, "montreal");
  assert.equal(s.lab.lines[0].filled.filter(Boolean).length, 2);
  invariants(s);
  s.pending = { type: "sequence", player: "p0", sequence: 3 };
  s = run(s, { type: "sequenceChoice", line: 0 });
  assert.equal(s.lab.lines[0].color, null);
  assert.equal(s.supply.blue, 24);
  assert.ok(s.playerDiscard.includes("montreal"));
  invariants(s);
});
test("moving cure vial to another line closes old line and returns cubes", () => {
  let s = clean({ lab: true });
  seq(s, 0, "blue");
  s.lab.lines[0].filled[0] = "blue";
  s.supply.blue--;
  s.lab.lines[1] = {
    sequence: 4,
    color: null,
    character: null,
    test: null,
    filled: Array(6).fill(null),
  };
  setHand(s, ["london"]);
  s = run(s, {
    type: "lab",
    op: "characterize",
    line: 1,
    color: "blue",
    card: "london",
  });
  assert.equal(s.lab.lines[0], null);
  assert.equal(s.lab.lines[1].color, "blue");
  assert.equal(s.supply.blue, 24);
  invariants(s);
});
test("New Assignment to Containment Specialist does not trigger enter-city removal", () => {
  let s = clean({ expansionCards: true });
  cube(s, "atlanta", "blue", 2);
  s = event(s, "new_assignment", "p0", {
    player: "p0",
    role: "containment_specialist",
  });
  assert.equal(s.board.atlanta.blue, 2);
});
test("Hidden Pocket revives eradicated VS; Unacceptable Loss removes at most supply", () => {
  let s = clean({ virulent: true });
  s.strain = "blue";
  s.cures.blue = true;
  s.eradicated.blue = true;
  s.infectionDiscard = ["london", "paris"];
  s.pending = { type: "intensify", effect: "hidden_pocket" };
  s.phase = "draw";
  s = run(s, { type: "advance" });
  assert.equal(boardCount(s, "blue"), 2);
  assert.equal(s.eradicated.blue, false);
  invariants(s);
  s.pending = { type: "intensify", effect: "unacceptable_loss" };
  s = run(s, { type: "advance" });
  assert.equal(s.removedCubes.blue, 4);
  invariants(s);
});
test("Uncounted Populations adds one only to VS cities with exactly1 cube", () => {
  let s = clean({ virulent: true });
  s.strain = "yellow";
  cube(s, "tokyo", "yellow", 1);
  cube(s, "london", "yellow", 2);
  s.pending = { type: "intensify", effect: "uncounted_populations" };
  s.phase = "draw";
  s = run(s, { type: "advance" });
  assert.equal(s.board.tokyo.yellow, 2);
  assert.equal(s.board.london.yellow, 2);
  invariants(s);
});
test("Mutation Intensifies can outbreak chains; two Mutation events may be chosen in either order", () => {
  let s = clean({ mutation: true });
  cube(s, "tokyo", "purple", 2);
  s.playerDeck = ["mutation:spreads", "mutation:intensifies"];
  s = run(s, { type: "advance" });
  s = run(s, { type: "advance", card: "mutation:intensifies" });
  assert.equal(s.board.tokyo.purple, 3);
  assert.deepEqual(s.drawQueue, ["mutation:spreads"]);
  invariants(s);
});
test("Worldwide Panic purple test requires purple city card, final cure does not", () => {
  let s = clean({ mutation: true, worldwide: true, lab: true });
  seq(s, 10, "purple");
  s.lab.lines[0].filled[0] = "purple";
  s.supply.purple--;
  setHand(s, ["london"]);
  cube(s, "tokyo", "purple", 1);
  assert.throws(() =>
    run(s, { type: "lab", op: "test", line: 0, card: "london", city: "tokyo" }),
  );
  cube(s, "london", "purple", 1);
  s = run(s, {
    type: "lab",
    op: "test",
    line: 0,
    card: "london",
    city: "tokyo",
  });
  assert.equal(s.board.tokyo.purple, 0);
  assert.ok(s.lab.lines[0].test);
  invariants(s);
});
