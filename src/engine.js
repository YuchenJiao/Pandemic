import { CITIES, ADJ, COLORS, DISEASE_NAMES, INFECTION_RATES } from "./data.js";
import {
  ROLES,
  BASE_ROLES,
  EVENTS,
  BASE_EVENTS,
  STRAINS,
  SEQUENCES,
  DISHES,
  cardName,
  LAB_ACTION_NAMES,
} from "./catalog.js";
export class RuleError extends Error {}
const ok = (x, m) => {
  if (!x) throw new RuleError(m);
};
const natural = COLORS.slice(0, 4),
  ids = Object.keys(CITIES),
  empty = () => Object.fromEntries(COLORS.map((c) => [c, 0]));
export function shuffle(a, rng = Math.random) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const current = (s) => s.players[s.turn];
export const handLimit = (p) => (p.role === "archivist" ? 8 : 7);
export const rate = (s) =>
  s.effects.travelBan !== undefined ? 1 : INFECTION_RATES[s.rate];
export const boardCount = (s, c) =>
  Object.values(s.board).reduce((n, b) => n + b[c], 0);
const log = (s, t) => {
  s.log.push(t);
  if (s.log.length > 300) s.log.shift();
};
const effect = (s, id, c = s.strain) =>
  !!c && s.strain === c && s.strainEffects.includes(id);
const lose = (s, t) => {
  s.status = "lost";
  s.reason = t;
  log(s, "Defeat: " + t);
};
const station = (s, p) => s.stations.includes(p.city);
const player = (s, id) => {
  const p = s.players.find((p) => p.id === id);
  ok(p, "Unknown role.");
  return p;
};
const city = (id) => {
  ok(CITIES[id], "Unknown city.");
  return CITIES[id];
};
const enabledColors = (s) => (s.options.mutation ? COLORS : natural);
const checkColor = (s, c) =>
  ok(enabledColors(s).includes(c), "Invalid disease color.");
function consume(p, cards) {
  ok(
    Array.isArray(cards) && new Set(cards).size === cards.length,
    "Select distinct cards.",
  );
  for (const c of cards) ok(p.hand.includes(c), "You do not have that card.");
  for (const c of cards) p.hand.splice(p.hand.indexOf(c), 1);
}
function discard(s, p, cards) {
  consume(p, cards);
  s.playerDiscard.push(...cards);
}
function refresh(s) {
  for (const c of enabledColors(s))
    if (s.cures[c] && boardCount(s, c) === 0) s.eradicated[c] = true;
  if (s.status !== "playing") return;
  if (
    natural.every((c) => s.cures[c]) &&
    (!s.options.mutation || s.cures.purple || boardCount(s, "purple") === 0)
  ) {
    s.status = "won";
    s.reason = "All required cures have been discovered.";
    log(s, "Victory!");
  }
}
function takeSupply(s, c, n) {
  if (s.supply[c] < n) {
    lose(s, `${DISEASE_NAMES[c]} disease cube supply exhausted.`);
    return false;
  }
  s.supply[c] -= n;
  return true;
}
function protectedCity(s, id, c) {
  return (
    s.eradicated[c] ||
    s.players.some(
      (p) =>
        (p.role === "quarantine_specialist" &&
          (p.city === id || ADJ[p.city].includes(id))) ||
        (p.role === "medic" && p.city === id && s.cures[c]),
    )
  );
}
export function infect(
  s,
  id,
  c,
  n = 1,
  seen = new Set(),
  chain = false,
  setup = false,
) {
  if (
    s.status !== "playing" ||
    (!setup && protectedCity(s, id, c)) ||
    seen.has(id)
  )
    return;
  const b = s.board[id],
    room = 3 - b[c],
    add = Math.min(n, room);
  if (add) {
    if (!takeSupply(s, c, add)) return;
    b[c] += add;
    s.ever[c] = true;
  }
  if (n <= room || (chain && s.effects.zoneBan !== undefined)) return;
  seen.add(id);
  s.outbreaks += effect(s, "slippery_slope", c) ? 2 : 1;
  log(s, `${CITIES[id].name}: ${DISEASE_NAMES[c]} outbreak (${s.outbreaks}/8)`);
  if (s.outbreaks >= 8) {
    lose(s, "The Outbreaks marker reached 8.");
    return;
  }
  const spread = !chain && effect(s, "highly_contagious", c) ? 2 : 1;
  for (const other of ADJ[id]) infect(s, other, c, spread, seen, true, setup);
}
function remove(s, id, c, n) {
  const count = Math.min(s.board[id][c], n);
  s.board[id][c] -= count;
  s.supply[c] += count;
  return count;
}
function arrive(s, p) {
  if (p.role === "containment_specialist")
    for (const c of enabledColors(s))
      if (s.board[p.city][c] >= 2) remove(s, p.city, c, 1);
  if (p.role === "medic")
    for (const c of enabledColors(s)) if (s.cures[c]) remove(s, p.city, c, 3);
  refresh(s);
}
function leave(s, p) {
  ok(
    !(
      effect(s, "government_interference") &&
      s.board[p.city][s.strain] > 0 &&
      !s.treated.includes(p.city)
    ),
    "Government Interference: Treat Disease in the departure city before leaving this turn.",
  );
}
function movePawn(s, p, to) {
  city(to);
  ok(to !== p.city, "Choose a different destination.");
  leave(s, p);
  p.city = to;
  arrive(s, p);
}
function startTurn(s) {
  const p = current(s);
  s.phase = "actions";
  s.actions = p.role === "generalist" ? 5 : 4;
  s.used = {};
  s.treated = [];
  s.effects.mobileHospital = false;
  s.effects.specialOrders = null;
  s.lastCure = null;
  s.generalistBonus = p.role === "generalist";
  for (const [key, e] of Object.entries(s.effects))
    if (e && typeof e === "object" && e.expires === p.id) {
      if (e.card) s.playerDiscard.push(e.card);
      delete s.effects[key];
    }
  s.privatePeek =
    p.role === "troubleshooter"
      ? { player: p.id, cards: s.infectionDeck.slice(0, rate(s)) }
      : null;
  log(s, `${p.name} (${ROLES[p.role][0]})'s turn`);
}
export function rolePool(options) {
  return (options.expansionCards ? Object.keys(ROLES) : BASE_ROLES).filter(
    (r) => !(options.lab && r === "field_operative"),
  );
}
export function newGame(seats, options = {}, rng = Math.random) {
  ok(
    seats.length >= 2 && seats.length <= 4,
    "Choose two to four roles. A solo player may control multiple roles.",
  );
  options = {
    epidemics: 5,
    virulent: false,
    mutation: false,
    lab: false,
    expansionCards: false,
    ...options,
  };
  ok(
    Number.isInteger(options.epidemics) &&
      options.epidemics >= 4 &&
      options.epidemics <= 7,
    "Choose four to seven Epidemic cards.",
  );
  for (const k of ["virulent", "mutation", "lab", "expansionCards"])
    ok(typeof options[k] === "boolean", "Invalid settings.");
  ok(
    !options.worldwide || options.mutation,
    "Worldwide Panic requires Mutation.",
  );
  const pool = shuffle(rolePool(options), rng),
    used = new Set(),
    reserved = new Set(seats.map((p) => p.role).filter(Boolean));
  const players = seats.map((p, i) => {
    const r = p.role || pool.find((x) => !used.has(x) && !reserved.has(x));
    ok(
      pool.includes(r) && !used.has(r),
      "Role unavailable or already selected.",
    );
    used.add(r);
    return {
      id: p.id,
      name: p.name,
      owner: p.owner,
      role: r,
      city: "atlanta",
      hand: [],
      samples: empty(),
      stored: null,
    };
  });
  const s = {
    schema: 1,
    status: "playing",
    options,
    players,
    turn: 0,
    phase: "actions",
    actions: 4,
    board: Object.fromEntries(ids.map((id) => [id, empty()])),
    supply: empty(),
    cures: {},
    eradicated: {},
    ever: {},
    stations: ["atlanta"],
    outbreaks: 0,
    rate: 0,
    strain: null,
    strainEffects: [],
    removedCubes: empty(),
    playerDeck: [],
    playerDiscard: [],
    infectionDeck: shuffle(ids, rng),
    infectionDiscard: [],
    infectionRemoved: [],
    eventRemoved: [],
    effects: {},
    used: {},
    treated: [],
    log: [],
    drawQueue: [],
    infectionLeft: 0,
    infectionStrainSeen: false,
    infectionExtra: false,
    pending: null,
    lab: null,
  };
  for (const c of enabledColors(s))
    s.supply[c] = c === "purple" && !options.worldwide ? 12 : 24;
  for (let i = 0; i < 9; i++) {
    const id = s.infectionDeck.shift();
    infect(
      s,
      id,
      CITIES[id].color,
      3 - Math.floor(i / 3),
      new Set(),
      false,
      true,
    );
    if (options.worldwide && [0, 3, 6].includes(i))
      infect(s, id, "purple", 1 + i / 3, new Set(), false, true);
    s.infectionDiscard.push(id);
  }
  if (options.mutation) s.infectionDiscard.push("mutation-1", "mutation-2");
  const events = options.expansionCards
    ? shuffle(Object.keys(EVENTS), rng).slice(0, 2 * players.length)
    : BASE_EVENTS;
  let deck = shuffle([...ids, ...events.map((x) => "event:" + x)], rng);
  const count = { 2: 4, 3: 3, 4: 2 }[players.length];
  for (const p of players) p.hand = deck.splice(0, count);
  s.turn = players.reduce(
    (best, p, i) =>
      Math.max(0, ...p.hand.map((c) => CITIES[c]?.population || 0)) >
      Math.max(0, ...players[best].hand.map((c) => CITIES[c]?.population || 0))
        ? i
        : best,
    0,
  );
  if (options.mutation)
    deck = shuffle(
      [
        ...deck,
        "mutation:threatens",
        "mutation:spreads",
        "mutation:intensifies",
      ],
      rng,
    );
  const effects = shuffle(
    Object.keys(STRAINS).slice(0, options.expansionCards ? 10 : 8),
    rng,
  );
  const n = options.epidemics;
  for (let i = 0; i < n; i++) {
    const size = Math.ceil(deck.length / (n - i)),
      pile = deck.splice(0, size);
    pile.push("epidemic:" + (options.virulent ? effects[i] : "normal"));
    s.playerDeck.push(...shuffle(pile, rng));
  }
  if (options.lab)
    s.lab = {
      dishes: Object.fromEntries(DISHES.map((d) => [d, empty()])),
      deck: shuffle(
        SEQUENCES.map((x) => x.id),
        rng,
      ),
      discard: [],
      lines: [null, null],
    };
  if (s.lab) s.lab.lines[0] = newLine(s.lab.deck.shift());
  startTurn(s);
  return s;
}
function bottomCity(s) {
  const at = s.infectionDeck.findLastIndex((c) => !!CITIES[c]);
  ok(at >= 0, "The Infection Deck contains no City cards.");
  const [id] = s.infectionDeck.splice(at, 1);
  s.infectionDiscard.push(id);
  return id;
}
function resolveMutation(s, id) {
  if (id === "intensifies") {
    for (const cityId of ids)
      if (s.board[cityId].purple === 2) infect(s, cityId, "purple");
  } else if (!s.eradicated.purple) {
    const n = id === "threatens" ? 1 : 3;
    for (let i = 0; i < n && s.status === "playing"; i++)
      infect(s, bottomCity(s), "purple", id === "threatens" ? 3 : 1);
  }
  log(s, "Resolved Mutation Event: " + cardName("mutation:" + id));
}
function epidemicInfect(s, id, rng) {
  s.rate = Math.min(6, s.rate + 1);
  const town = bottomCity(s);
  infect(s, town, CITIES[town].color, 3);
  log(s, "Epidemic: " + CITIES[town].name);
  if (s.options.virulent && !s.strain) {
    const colors = s.options.worldwide ? COLORS : natural,
      max = Math.max(...colors.map((c) => boardCount(s, c)));
    s.strain = shuffle(
      colors.filter((c) => boardCount(s, c) === max),
      rng,
    )[0];
    log(s, "Virulent Strain: " + DISEASE_NAMES[s.strain]);
  }
  s.pending = { type: "intensify", effect: id };
}
function intensify(s, rng) {
  const id = s.pending.effect,
    c = s.strain;
  if (c) {
    if (id === "hidden_pocket" && s.eradicated[c] && c !== "purple") {
      const towns = s.infectionDiscard.filter((x) => CITIES[x]?.color === c);
      if (towns.length) {
        s.eradicated[c] = false;
        for (const town of towns) infect(s, town, c);
      }
    }
    if (id === "unacceptable_loss") {
      const n = Math.min(4, s.supply[c]);
      s.supply[c] -= n;
      s.removedCubes[c] += n;
    }
    if (id === "uncounted_populations")
      for (const town of ids) if (s.board[town][c] === 1) infect(s, town, c);
  }
  s.infectionDeck = [...shuffle(s.infectionDiscard, rng), ...s.infectionDeck];
  s.infectionDiscard = [];
  if (
    c &&
    STRAINS[id]?.[1] &&
    !(
      s.cures[c] &&
      ["complex_molecular_structure", "resistant_to_treatment"].includes(id)
    )
  )
    s.strainEffects.push(id);
  s.pending = null;
  log(
    s,
    "Intensify: the Infection Discard Pile was shuffled onto the Infection Deck." +
      (STRAINS[id] ? "; " + STRAINS[id][0] : ""),
  );
}
function shortage(s) {
  const appeared = enabledColors(s).filter((c) => s.ever[c]);
  if (
    s.options.lab &&
    enabledColors(s).some((c) => !s.ever[c]) &&
    appeared.every((c) => s.cures[c])
  ) {
    s.status = "won";
    s.reason = "Lab Challenge: all diseases that appeared have been cured.";
  } else lose(s, "The Player Deck has fewer than two cards.");
}
function beginDraw(s) {
  s.phase = "draw";
  if (s.playerDeck.length < 2) {
    shortage(s);
    return;
  }
  const drawn = s.playerDeck.splice(0, 2);
  s.drawQueue = [];
  for (const c of drawn)
    if (CITIES[c] || c.startsWith("event:")) current(s).hand.push(c);
  s.drawQueue = [
    ...drawn.filter((c) => c.startsWith("mutation:")),
    ...drawn.filter((c) => c.startsWith("epidemic:")),
  ];
  log(
    s,
    "Drew two Player cards. Resolve any Mutation Event and Epidemic cards.",
  );
}
export { cardName };
function advance(s, a, rng) {
  if (s.pending?.type === "intensify") {
    intensify(s, rng);
    return;
  }
  ok(!s.pending, "Complete the pending choice first.");
  if (s.phase === "actions") {
    beginDraw(s);
    return;
  }
  if (s.phase === "draw") {
    if (s.drawQueue.length) {
      let idx = 0;
      if (a.card) {
        idx = s.drawQueue.indexOf(a.card);
        ok(idx >= 0, "Invalid card to resolve.");
        if (s.drawQueue[0].startsWith("mutation:"))
          ok(a.card.startsWith("mutation:"), "Resolve Mutation Events first.");
      }
      const c = s.drawQueue.splice(idx, 1)[0];
      if (c.startsWith("mutation:")) {
        resolveMutation(s, c.slice(9));
        s.playerDiscard.push(c);
      } else {
        epidemicInfect(s, c.slice(9), rng);
        s.playerDiscard.push(c);
      }
      return;
    }
    ok(
      !s.players.some((p) => p.hand.length > handLimit(p)),
      "Discard down to the hand limit first.",
    );
    s.phase = "infect";
    s.infectionStrainSeen = false;
    s.infectionExtra = false;
    if (s.effects.quietNight) {
      s.effects.quietNight--;
      s.infectionLeft = 0;
      log(s, "One Quiet Night: skip Infect Cities.");
    } else s.infectionLeft = rate(s);
    return;
  }
  if (s.phase === "infect") {
    if (!s.infectionLeft) {
      s.turn = (s.turn + 1) % s.players.length;
      startTurn(s);
      return;
    }
    const c = s.infectionDeck.shift();
    ok(c, "The Infection Deck is empty.");
    s.infectionDiscard.push(c);
    s.infectionLeft--;
    if (c.startsWith("mutation")) {
      if (!s.eradicated.purple)
        infect(s, bottomCity(s), "purple", s.options.worldwide ? 2 : 1);
      if (s.strain === "purple") s.infectionStrainSeen = true;
    } else {
      const color = CITIES[c].color;
      const wasPurple = s.board[c].purple > 0;
      infect(
        s,
        c,
        color,
        effect(s, "chronic_effect", color) && !s.board[c][color] ? 2 : 1,
      );
      if (s.options.mutation && wasPurple) infect(s, c, "purple");
      if (color === s.strain) s.infectionStrainSeen = true;
    }
    log(s, "Infect Cities: " + cardName(c));
    if (
      !s.infectionLeft &&
      s.infectionStrainSeen &&
      !s.infectionExtra &&
      effect(s, "rate_effect") &&
      !s.eradicated[s.strain]
    ) {
      s.infectionLeft = 1;
      s.infectionExtra = true;
      log(s, "Rate Effect: draw one additional Infection card.");
    }
  }
}
function spend(s, n = 1) {
  ok(s.actions >= n, "Not enough actions remaining.");
  s.actions -= n;
}
function requireAction(s, p) {
  ok(
    s.phase === "actions" && p.id === current(s).id,
    "Only the current role may take actions during Do 4 Actions.",
  );
  ok(s.actions > 0, "Finish Do 4 Actions to continue.");
}
function ensureNoLimit(s) {
  ok(
    !s.players.some((p) => p.hand.length > handLimit(p)),
    "Resolve the hand limit first.",
  );
}
function build(s, p, to, replace) {
  city(to);
  ok(!s.stations.includes(to), "This city already has a research station.");
  if (s.stations.length === 6) {
    ok(s.stations.includes(replace), "Select a research station to relocate.");
    s.stations.splice(s.stations.indexOf(replace), 1);
  }
  s.stations.push(to);
  if (s.lab) s.pending = { type: "bonusLab", player: p.id };
  log(s, "Built a research station in " + CITIES[to].name);
}
function doMove(s, p, a) {
  const q = a.pawn ? player(s, a.pawn) : p,
    other = q.id !== p.id;
  ok(
    !other || p.role === "dispatcher" || s.effects.specialOrders === q.id,
    "You cannot move that pawn.",
  );
  const from = q.city,
    to = a.to;
  city(to);
  ok(to !== from, "Choose a different destination.");
  if (a.mode === "pilot") {
    ok(!other && p.role === "pilot", "Only the Pilot can use this move.");
    ok(distance(from, to) <= 3, "The Pilot can fly up to three connections.");
    const passenger = a.passenger ? player(s, a.passenger) : null;
    ok(
      !passenger || (passenger.id !== p.id && passenger.city === from),
      "The passenger must be in the departure city.",
    );
    if (passenger) leave(s, passenger);
    movePawn(s, q, to);
    if (passenger) {
      passenger.city = to;
      arrive(s, passenger);
    }
  } else {
    ok(
      other || p.role !== "pilot",
      "The Pilot must use the Pilot's flight ability.",
    );
    switch (a.mode) {
      case "drive":
        ok(ADJ[from].includes(to), "These cities are not connected.");
        break;
      case "direct":
        ok(
          p.hand.includes(to),
          "Direct Flight requires the destination City card.",
        );
        if (p.role !== "troubleshooter") discard(s, p, [to]);
        break;
      case "charter":
        discard(s, p, [from]);
        break;
      case "shuttle":
        ok(
          s.stations.includes(from) && s.stations.includes(to),
          "Shuttle Flight requires a research station in both cities.",
        );
        break;
      case "dispatch":
        ok(
          p.role === "dispatcher" && s.players.some((x) => x.city === to),
          "The Dispatcher must choose a city with another pawn.",
        );
        break;
      case "operations":
        ok(
          !other &&
            p.role === "operations_expert" &&
            station(s, p) &&
            !s.used.operations,
          "The Operations Expert's special move is unavailable this turn.",
        );
        ok(CITIES[a.card], "Discard a City card.");
        discard(s, p, [a.card]);
        s.used.operations = true;
        break;
      default:
        ok(false, "Invalid movement action.");
    }
    movePawn(s, q, to);
  }
  if (a.mode === "drive" && s.effects.mobileHospital) {
    const cs = enabledColors(s).filter((c) => s.board[to][c]);
    if (cs.length) {
      const c = a.hospitalColor || cs[0];
      ok(cs.includes(c), "Invalid disease color for Mobile Hospital.");
      remove(s, to, c, 1);
      if (c === s.strain) s.treated.push(to);
    }
  }
  spend(s);
  log(s, `${q.name} → ${CITIES[to].name}`);
}
export function distance(from, to) {
  let seen = new Set([from]),
    queue = [[from, 0]];
  while (queue.length) {
    const [id, n] = queue.shift();
    if (id === to) return n;
    for (const x of ADJ[id])
      if (!seen.has(x)) {
        seen.add(x);
        queue.push([x, n + 1]);
      }
  }
  return Infinity;
}
function treat(s, p, a) {
  const id = a.city || p.city;
  ok(
    id === p.city || (p.role === "field_director" && ADJ[p.city].includes(id)),
    "Choose your current city or a connected city if you are the Field Director.",
  );
  const c = a.color;
  checkColor(s, c);
  ok(s.board[id][c] > 0, "There are no cubes of that disease in this city.");
  const cost = effect(s, "resistant_to_treatment", c) && !s.cures[c] ? 2 : 1;
  spend(s, cost);
  let n = p.role === "medic" || s.cures[c] ? 3 : 1;
  if (s.effects.sanitation) n++;
  n = remove(s, id, c, n);
  if (c === s.strain) s.treated.push(id);
  if (s.lab && a.sample) {
    ok(
      ["sample1", "sample2"].includes(a.sample),
      "Place the sample in a Sample Dish.",
    );
    s.supply[c]--;
    s.lab.dishes[a.sample][c]++;
  }
  log(s, `Treat Disease in ${CITIES[id].name} ${DISEASE_NAMES[c]} ×${n}`);
}
function share(s, p, a) {
  const q = player(s, a.player),
    give = a.direction !== "take",
    from = give ? p : q,
    to = give ? q : p;
  ok(
    p.id !== q.id && p.city === q.city,
    "Share Knowledge requires both pawns to be in the same city.",
  );
  ok(
    CITIES[a.card] && (a.card === p.city || from.role === "researcher"),
    "Share the current City card. The Researcher may give any City card.",
  );
  consume(from, [a.card]);
  to.hand.push(a.card);
  spend(s);
  log(s, `${from.name} gave ${cardName(a.card)} to ${to.name}`);
}
function cureRequired(s, p, c) {
  return (
    (s.lab ? 3 : 5) -
    (p.role === "scientist" ? 1 : 0) +
    (effect(s, "complex_molecular_structure", c) && !s.cures[c] ? 1 : 0) -
    (s.effects.breakthrough ? 1 : 0)
  );
}
function validateCureCards(s, p, c, cards, useSamples) {
  ok(
    cards.every((x) => CITIES[x]),
    "Discover a Cure uses City cards.",
  );
  let needed = cureRequired(s, p, c);
  if (useSamples) {
    ok(
      p.role === "field_operative" && p.samples[c] >= 3,
      "Not enough Field Operative samples.",
    );
    needed -= 2;
  }
  let credit = cards.length;
  if (c !== "purple") {
    const own = cards.filter((x) => CITIES[x].color === c).length,
      others = cards.filter((x) => CITIES[x].color !== c);
    if (p.role === "virologist") {
      const counts = {};
      for (const x of others)
        counts[CITIES[x].color] = (counts[CITIES[x].color] || 0) + 1;
      ok(
        Object.values(counts).every((n) => n % 2 === 0),
        "Each pair of substitute cards must be of the same color.",
      );
      credit = own + others.length / 2;
    } else {
      ok(!others.length, "The City cards do not match the disease color.");
      credit = own;
    }
  }
  ok(
    credit === needed,
    `This cure requires exactly ${needed} matching City cards or equivalent substitutions.`,
  );
  if (c === "purple" && !s.lab) {
    let n = s.options.worldwide ? 2 : 1;
    if (effect(s, "complex_molecular_structure", c)) n++;
    ok(
      cards.filter((x) => s.board[x].purple > 0).length >= n,
      `${n} City cards from cities that currently have purple disease cubes are required.`,
    );
  }
}
function doCure(s, p, a) {
  const c = a.color;
  checkColor(s, c);
  ok(station(s, p), "Discover a Cure requires a research station.");
  ok(!s.cures[c], "This disease has already been cured.");
  const cards = a.cards || [];
  ok(Array.isArray(cards), "Select City cards.");
  validateCureCards(s, p, c, cards, a.useSamples);
  const line = s.lab?.lines.find((l) => l?.color === c);
  if (s.lab)
    ok(
      line && line.test && line.filled.every(Boolean),
      "Characterize the Disease, fill its Sequence card, and Test a Cure first.",
    );
  discard(s, p, cards);
  if (a.useSamples) {
    p.samples[c] -= 3;
    s.supply[c] += 3;
  }
  spend(s);
  s.cures[c] = true;
  s.lastCure = c;
  if (s.effects.breakthrough) {
    if (s.effects.breakthrough.card)
      s.playerDiscard.push(s.effects.breakthrough.card);
    delete s.effects.breakthrough;
  }
  if (s.strain === c)
    s.strainEffects = s.strainEffects.filter(
      (x) =>
        !["resistant_to_treatment", "complex_molecular_structure"].includes(x),
    );
  if (line) {
    const i = s.lab.lines.indexOf(line);
    closeLine(s, line);
    s.lab.lines[i] = newLine(drawSequence(s));
  }
  for (const q of s.players) if (q.role === "medic") arrive(s, q);
  log(s, "Discovered a cure for " + DISEASE_NAMES[c]);
}
function newLine(id) {
  return {
    sequence: id,
    color: null,
    character: null,
    test: null,
    filled: SEQUENCES[id].slots.map(() => null),
  };
}
function closeLine(s, line) {
  if (!line) return;
  s.lab.discard.push(line.sequence);
  if (line.character) s.playerDiscard.push(line.character);
  if (line.test) s.playerDiscard.push(line.test);
  for (const c of line.filled) if (c) s.supply[c]++;
}
function drawSequence(s, rng = Math.random) {
  if (!s.lab.deck.length) {
    s.lab.deck = shuffle(s.lab.discard, rng);
    s.lab.discard = [];
  }
  ok(s.lab.deck.length, "No Sequence cards available.");
  return s.lab.deck.shift();
}
function slotAccepts(s, line, i, c) {
  const slot = SEQUENCES[line.sequence].slots[i];
  return slot === "gray" ? c === line.color : slot === c || s.eradicated[slot];
}
function fillLine(s, line, batch, alloc) {
  if (alloc) {
    ok(
      Array.isArray(alloc) && alloc.length === line.filled.length,
      "The allocation must match the number of spaces on the Sequence card.",
    );
    for (let i = 0; i < alloc.length; i++)
      if (alloc[i]) {
        const c = alloc[i];
        ok(
          !line.filled[i] && batch[c] > 0 && slotAccepts(s, line, i, c),
          "Invalid Sequence card cube allocation.",
        );
        batch[c]--;
        line.filled[i] = c;
      }
  } else {
    const slots = line.filled.map((v, i) => i).filter((i) => !line.filled[i]);
    slots.sort(
      (a, b) =>
        COLORS.filter((c) => slotAccepts(s, line, a, c)).length -
        COLORS.filter((c) => slotAccepts(s, line, b, c)).length,
    );
    for (const i of slots) {
      const c = COLORS.find((c) => batch[c] > 0 && slotAccepts(s, line, i, c));
      if (c) {
        batch[c]--;
        line.filled[i] = c;
      }
    }
  }
  for (const c of COLORS) s.supply[c] += batch[c];
}
function labAction(s, p, a, free = false, rng = Math.random) {
  ok(s.lab, "The Lab Challenge is disabled.");
  ok(free || station(s, p), "Lab actions require a research station.");
  const lab = s.lab;
  if (a.op === "sequence") {
    s.pending = {
      type: "sequence",
      player: p.id,
      sequence: drawSequence(s, rng),
    };
  } else if (a.op === "characterize") {
    const l = lab.lines[a.line];
    ok(
      l && !l.color && !s.cures[a.color],
      "Choose an uncharacterized research line and an uncured disease.",
    );
    const c = a.color;
    checkColor(s, c);
    ok(
      SEQUENCES[l.sequence].eligible.includes(c),
      "The Sequence card does not match this disease.",
    );
    ok(
      CITIES[a.card] &&
        (c === "purple"
          ? s.board[a.card].purple > 0
          : CITIES[a.card].color === c),
      "The City card does not match Characterize a Disease.",
    );
    consume(p, [a.card]);
    const other = lab.lines.find((x) => x?.color === c);
    if (other) {
      const i = lab.lines.indexOf(other);
      closeLine(s, other);
      lab.lines[i] = null;
    }
    l.color = c;
    l.character = a.card;
  } else if (a.op === "test") {
    const l = lab.lines[a.line];
    ok(
      l?.color && !l.test && l.filled.some(Boolean),
      "Test a Cure requires a characterized Sequence card with at least one cube.",
    );
    const c = l.color;
    ok(
      CITIES[a.card] &&
        (c === "purple"
          ? !s.options.worldwide || s.board[a.card].purple > 0
          : CITIES[a.card].color === c),
      "The City card does not match Test a Cure.",
    );
    consume(p, [a.card]);
    l.test = a.card;
    if (boardCount(s, c) > 0) {
      city(a.city);
      ok(
        s.board[a.city][c] > 0,
        "Choose a city with a cube of the disease being tested.",
      );
      remove(s, a.city, c, 1);
    }
  } else if (a.op === "process") {
    ok(DISHES.includes(a.from), "Choose the source dish.");
    const batch = { ...lab.dishes[a.from] };
    ok(
      COLORS.some((c) => batch[c] > 0),
      "The source dish is empty.",
    );
    const arrows = {
      sample1: ["centrifuge", "separator"],
      sample2: ["centrifuge", "separator"],
      centrifuge: ["growth", "line0", "line1"],
      separator: ["growth", "line0", "line1"],
      growth: ["line0", "line1"],
    };
    ok(
      arrows[a.from].includes(a.to),
      "These positions are not connected by a sample processing arrow.",
    );
    lab.dishes[a.from] = empty();
    if (a.to.startsWith("line")) {
      const l = lab.lines[Number(a.to.slice(4))];
      ok(l?.color, "Characterize a Disease on this research line first.");
      fillLine(s, l, batch, a.allocation);
    } else {
      if (a.to === "centrifuge") {
        checkColor(s, a.color);
        ok(batch[a.color] > 0, "The source dish has no cubes of that color.");
        for (const c of COLORS)
          if (c !== a.color) {
            s.supply[c] += batch[c];
            batch[c] = 0;
          }
      }
      if (a.to === "separator")
        for (const c of COLORS)
          if (batch[c] > 1) {
            s.supply[c] += batch[c] - 1;
            batch[c] = 1;
          }
      for (const c of COLORS) lab.dishes[a.to][c] += batch[c];
      if (a.to === "growth")
        for (const c of COLORS)
          if (batch[c]) {
            if (!takeSupply(s, c, batch[c])) return;
            lab.dishes[a.to][c] += batch[c];
          }
    }
  } else ok(false, "Unknown Lab action.");
  if (!free) spend(s);
  log(s, "Lab action: " + LAB_ACTION_NAMES[a.op]);
}
function sequenceChoice(s, p, a) {
  const pending = s.pending;
  ok(
    pending?.type === "sequence" && pending.player === p.id,
    "There is no Sequence card awaiting placement.",
  );
  if (a.line === "discard") {
    s.lab.discard.push(pending.sequence);
    s.pending = null;
    return;
  }
  const i = Number(a.line);
  ok(i === 0 || i === 1, "Invalid research line.");
  ok(
    i === 0 || s.lab.lines[1] || s.stations.length >= 2,
    "The second research line requires two research stations.",
  );
  const old = s.lab.lines[i],
    l = newLine(pending.sequence);
  if (old?.color && SEQUENCES[l.sequence].eligible.includes(old.color)) {
    l.color = old.color;
    l.character = old.character;
    l.test = old.test;
    const batch = empty();
    for (const c of old.filled) if (c) batch[c]++;
    fillLine(s, l, batch, a.allocation);
    s.lab.discard.push(old.sequence);
  } else if (old) closeLine(s, old);
  s.lab.lines[i] = l;
  s.pending = null;
}
function roleAction(s, p, a, rng) {
  switch (p.role) {
    case "contingency_planner":
      ok(
        !p.stored &&
          a.card?.startsWith("event:") &&
          s.playerDiscard.includes(a.card),
        "Choose one Event card from the Player Discard Pile to store.",
      );
      s.playerDiscard.splice(s.playerDiscard.indexOf(a.card), 1);
      p.stored = a.card;
      spend(s);
      break;
    case "archivist":
      ok(
        !s.used.archivist && s.playerDiscard.includes(p.city),
        "You cannot recover the current City card this turn.",
      );
      s.playerDiscard.splice(s.playerDiscard.indexOf(p.city), 1);
      p.hand.push(p.city);
      s.used.archivist = true;
      spend(s);
      break;
    case "epidemiologist":
      if (a.op === "process") {
        ok(
          s.lab && station(s, p) && !s.used.labProcess,
          "The free Process a Sample action requires a research station and is available once per turn.",
        );
        labAction(s, p, { ...a, op: "process" }, true, rng);
        s.used.labProcess = true;
      } else {
        ok(!s.used.epidemiologist, "This ability is available once per turn.");
        const q = player(s, a.player);
        ok(
          q.id !== p.id && q.city === p.city && CITIES[a.card],
          "Choose a City card held by another player in your city.",
        );
        consume(q, [a.card]);
        p.hand.push(a.card);
        s.used.epidemiologist = true;
      }
      break;
    case "researcher":
      ok(
        s.lab && station(s, p) && !s.used.labSequence,
        "The free Sequence a Disease action is unavailable.",
      );
      labAction(s, p, { op: "sequence" }, true, rng);
      s.used.labSequence = true;
      break;
    case "field_operative": {
      const c = a.color;
      checkColor(s, c);
      if (a.op === "return") {
        ok(p.samples[c] > 0, "You do not have that sample.");
        p.samples[c]--;
        s.supply[c]++;
        break;
      }
      ok(
        !s.used.sample && s.board[p.city][c] > 0,
        "You cannot take that sample this turn.",
      );
      s.board[p.city][c]--;
      p.samples[c]++;
      s.used.sample = true;
      spend(s);
      break;
    }
    case "virologist":
      ok(CITIES[a.card], "Select City cards.");
      city(a.city);
      {
        const c = CITIES[a.card].color;
        ok(s.board[a.city][c] > 0, "That city has no matching disease cube.");
        discard(s, p, [a.card]);
        remove(s, a.city, c, 1);
        spend(s);
      }
      break;
    case "local_liaison":
      if (["characterize", "test"].includes(a.op)) {
        ok(
          station(s, p) && !s.used.labLiaison,
          "The free Lab action is unavailable.",
        );
        labAction(s, p, a, true, rng);
        s.used.labLiaison = true;
      } else {
        ok(!s.used.liaison, "This ability is available once per turn.");
        const q = player(s, a.player);
        ok(
          q.id !== p.id &&
            CITIES[a.card]?.color === CITIES[p.city].color &&
            CITIES[q.city].color === CITIES[p.city].color,
          "The City card and both cities must match in color.",
        );
        consume(p, [a.card]);
        q.hand.push(a.card);
        s.used.liaison = true;
        spend(s);
      }
      break;
    case "field_director": {
      ok(!s.used.director, "This ability is available once per turn.");
      const q = player(s, a.player);
      ok(
        q.id !== p.id &&
          q.role !== "pilot" &&
          (q.city === p.city || ADJ[p.city].includes(q.city)) &&
          ADJ[q.city].includes(a.to),
        "Move another pawn in your city or an adjacent city one Drive / Ferry connection.",
      );
      movePawn(s, q, a.to);
      s.used.director = true;
      break;
    }
    default:
      ok(false, "This role has no separate action.");
  }
}
function playEvent(s, p, a) {
  const card = "event:" + a.event,
    stored = p.stored === card;
  ok(stored || p.hand.includes(card), "You do not have that Event card.");
  const id = a.event;
  ok(EVENTS[id], "Unknown Event card.");
  if (s.pending?.type === "intensify")
    ok(
      id === "resilient_population",
      "Only Resilient Population may be played between Infect and Intensify.",
    );
  const expire = { card, expires: p.id };
  let keep = false;
  switch (id) {
    case "airlift":
      movePawn(s, player(s, a.player), a.to);
      break;
    case "forecast":
      s.pending = {
        type: "forecast",
        player: p.id,
        cards: s.infectionDeck.splice(0, Math.min(6, s.infectionDeck.length)),
      };
      break;
    case "government_grant":
      build(s, p, a.to, a.replace);
      break;
    case "one_quiet_night":
      s.effects.quietNight = 1;
      break;
    case "resilient_population":
      ok(
        CITIES[a.card] && s.infectionDiscard.includes(a.card),
        "Choose a City card in the Infection Discard Pile.",
      );
      s.infectionDiscard.splice(s.infectionDiscard.indexOf(a.card), 1);
      s.infectionRemoved.push(a.card);
      break;
    case "borrowed_time":
      ok(s.phase === "actions", "Play Borrowed Time during Do 4 Actions.");
      s.actions += 2;
      break;
    case "commercial_travel_ban":
      ok(!s.effects.travelBan, "Commercial Travel Ban is already in effect.");
      s.effects.travelBan = { card, expires: current(s).id };
      keep = true;
      break;
    case "mobile_hospital":
      s.effects.mobileHospital = true;
      break;
    case "new_assignment": {
      const q = player(s, a.player);
      ok(
        rolePool(s.options).includes(a.role) &&
          !s.players.some((x) => x.role === a.role),
        "That role is unavailable.",
      );
      const old = q.role;
      q.role = a.role;
      if (
        q.id === current(s).id &&
        q.role === "generalist" &&
        !s.generalistBonus
      ) {
        s.actions++;
        s.generalistBonus = true;
      }
      for (const c of COLORS) {
        s.supply[c] += q.samples[c];
        q.samples[c] = 0;
      }
      if (q.stored) {
        s.playerDiscard.push(q.stored);
        q.stored = null;
      }
      if (q.role === "medic") arrive(s, q);
      break;
    }
    case "rapid_vaccine_deployment": {
      const c = s.lastCure;
      ok(c, "Play this Event immediately after Discover a Cure.");
      const list = a.removals || [];
      ok(
        list.length >= 1 && list.length <= 5,
        "Remove one to five disease cubes.",
      );
      const towns = [...new Set(list.map((x) => x.city))];
      ok(
        towns.length === 1 ||
          towns.every((t) => ADJ[t]?.some((n) => towns.includes(n))),
        "Each selected city must connect to another selected city.",
      );
      for (const x of list) {
        city(x.city);
        ok(s.board[x.city][c] > 0, "There are not enough disease cubes.");
        remove(s, x.city, c, 1);
      }
      break;
    }
    case "reexamined_research":
      ok(
        CITIES[a.card] && s.playerDiscard.includes(a.card),
        "Select a City card from the Player Discard Pile.",
      );
      s.playerDiscard.splice(s.playerDiscard.indexOf(a.card), 1);
      player(s, a.player).hand.push(a.card);
      break;
    case "remote_treatment": {
      const list = a.removals || [];
      ok(
        list.length ===
          Math.min(
            2,
            enabledColors(s).reduce((n, c) => n + boardCount(s, c), 0),
          ),
        "Select two disease cubes, or all cubes if fewer remain.",
      );
      for (const x of list) {
        city(x.city);
        checkColor(s, x.color);
        ok(s.board[x.city][x.color] > 0, "There are not enough disease cubes.");
        remove(s, x.city, x.color, 1);
      }
      break;
    }
    case "special_orders":
      ok(a.player !== current(s).id, "Choose another pawn.");
      player(s, a.player);
      s.effects.specialOrders = a.player;
      break;
    case "infection_zone_ban":
      ok(!s.effects.zoneBan, "Infection Zone Ban is already in effect.");
      s.effects.zoneBan = expire;
      keep = true;
      break;
    case "improved_sanitation":
      ok(!s.effects.sanitation, "Improved Sanitation is already in effect.");
      s.effects.sanitation = expire;
      keep = true;
      break;
    case "sequencing_breakthrough":
      ok(
        !s.effects.breakthrough,
        "Sequencing Breakthrough is already in effect.",
      );
      s.effects.breakthrough = { card };
      keep = true;
      break;
  }
  if (stored) {
    p.stored = null;
    s.eventRemoved.push(card);
    if (keep) {
      for (const v of Object.values(s.effects))
        if (v?.card === card) v.card = null;
    }
  } else {
    consume(p, [card]);
    if (!keep) s.playerDiscard.push(card);
  }
  log(s, p.name + " played " + EVENTS[id][0]);
}
export function requiredConsents(s, actor, a) {
  const affected = [];
  if (
    a.type === "share" ||
    (a.type === "role" &&
      ["epidemiologist", "local_liaison", "field_director"].includes(
        player(s, actor).role,
      ))
  )
    if (a.player) affected.push(a.player);
  if (a.type === "move") {
    if (a.pawn) affected.push(a.pawn);
    if (a.passenger) affected.push(a.passenger);
  }
  if (
    a.type === "event" &&
    [
      "airlift",
      "new_assignment",
      "reexamined_research",
      "special_orders",
    ].includes(a.event)
  )
    if (a.player) affected.push(a.player);
  return [...new Set(affected)].filter((x) => x !== actor);
}
export function apply(input, actor, a, rng = Math.random) {
  const s = structuredClone(input),
    p = player(s, actor);
  ok(s.status === "playing", "This game has ended.");
  ok(a && typeof a.type === "string", "Invalid command.");
  if (
    a.type !== "cure" &&
    !(a.type === "event" && a.event === "rapid_vaccine_deployment")
  )
    s.lastCure = null;
  if (a.type === "role" && p.role === "field_operative" && a.op === "return") {
    checkColor(s, a.color);
    ok(p.samples[a.color] > 0, "You do not have that sample.");
    p.samples[a.color]--;
    s.supply[a.color]++;
    refresh(s);
    return s;
  }
  if (a.type === "discard") {
    ok(
      !(
        s.phase === "draw" &&
        (s.drawQueue.length || s.pending?.type === "intensify")
      ),
      "Resolve the drawn Mutation Event and Epidemic cards first.",
    );
    ok(p.hand.length > handLimit(p), "Discard only when over the hand limit.");
    ok(p.hand.includes(a.card), "You do not have that card.");
    discard(s, p, [a.card]);
    return s;
  }
  if (a.type === "sequenceChoice") {
    sequenceChoice(s, p, a);
    refresh(s);
    return s;
  }
  if (a.type === "forecastChoice") {
    ok(
      s.pending?.type === "forecast" && s.pending.player === p.id,
      "There is no pending Forecast.",
    );
    ok(
      Array.isArray(a.cards) &&
        a.cards.length === s.pending.cards.length &&
        new Set(a.cards).size === a.cards.length &&
        a.cards.every((c) => s.pending.cards.includes(c)),
      "Reorder the same cards revealed by Forecast.",
    );
    s.infectionDeck = [...a.cards, ...s.infectionDeck];
    s.pending = null;
    return s;
  }
  if (a.type === "bonusLab") {
    ok(
      s.pending?.type === "bonusLab" && s.pending.player === p.id,
      "No bonus Lab action is pending.",
    );
    s.pending = null;
    if (!a.skip) labAction(s, p, a, true, rng);
    refresh(s);
    return s;
  }
  if (a.type === "event") {
    ok(
      !s.pending || s.pending.type === "intensify",
      "Complete the pending choice first.",
    );
    playEvent(s, p, a);
    refresh(s);
    return s;
  }
  ok(
    !s.pending || (a.type === "advance" && s.pending.type === "intensify"),
    "Complete the pending choice first.",
  );
  ok(p.id === current(s).id, "Wait for the current player's turn.");
  if (a.type === "advance" || a.type === "end") {
    if (
      !(
        s.phase === "draw" &&
        (s.drawQueue.length || s.pending?.type === "intensify")
      )
    )
      ensureNoLimit(s);
    advance(s, a, rng);
    refresh(s);
    return s;
  }
  if (a.type === "role") {
    ok(
      s.phase === "actions" && p.id === current(s).id,
      "Only the current role may take actions during Do 4 Actions.",
    );
  } else requireAction(s, p);
  ensureNoLimit(s);
  if (a.type !== "cure") s.lastCure = null;
  switch (a.type) {
    case "move":
      doMove(s, p, a);
      break;
    case "treat":
      treat(s, p, a);
      break;
    case "build":
      ok(p.role !== "pilot", "The Pilot cannot build a research station.");
      if (p.role !== "operations_expert") discard(s, p, [p.city]);
      build(s, p, p.city, a.replace);
      spend(s);
      break;
    case "share":
      share(s, p, a);
      break;
    case "cure":
      doCure(s, p, a);
      break;
    case "lab":
      labAction(s, p, a, false, rng);
      break;
    case "role":
      roleAction(s, p, a, rng);
      break;
    case "pass":
      spend(s);
      break;
    default:
      ok(false, "Unknown action.");
  }
  refresh(s);
  return s;
}
export function view(s, owner) {
  if (!s) return null;
  const v = structuredClone(s);
  for (const p of v.players)
    if (p.owner !== owner && s.options.epidemics !== 4)
      p.hand = p.hand.map(() => "hidden");
  v.playerDeckCount = v.playerDeck.length;
  delete v.playerDeck;
  v.infectionDeckCount = v.infectionDeck.length;
  delete v.infectionDeck;
  if (v.lab) {
    v.lab.deckCount = v.lab.deck.length;
    delete v.lab.deck;
  }
  if (
    v.pending?.type === "forecast" &&
    player(s, v.pending.player).owner !== owner
  )
    delete v.pending.cards;
  if (
    v.pending?.type === "sequence" &&
    player(s, v.pending.player).owner !== owner
  )
    delete v.pending.sequence;
  const p = current(s);
  if (
    p.role === "troubleshooter" &&
    p.owner === owner &&
    s.privatePeek?.player === p.id
  )
    v.peek = s.privatePeek.cards;
  delete v.privatePeek;
  return v;
}
export function invariants(s) {
  for (const c of enabledColors(s)) {
    const lab = s.lab
      ? Object.values(s.lab.dishes).reduce((n, b) => n + b[c], 0) +
        s.lab.lines
          .filter(Boolean)
          .reduce((n, l) => n + l.filled.filter((x) => x === c).length, 0)
      : 0;
    const total =
      boardCount(s, c) +
      s.supply[c] +
      s.players.reduce((n, p) => n + p.samples[c], 0) +
      lab +
      s.removedCubes[c];
    const expected = c === "purple" && !s.options.worldwide ? 12 : 24;
    ok(
      total === expected,
      `${c} disease cube count is inconsistent: ${total}/${expected}`,
    );
    for (const b of Object.values(s.board))
      ok(
        b[c] >= 0 && b[c] <= 3,
        "A city has an invalid number of disease cubes.",
      );
  }
  return true;
}
