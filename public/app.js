import { CITIES, ADJ, COLORS, DISEASE_NAMES } from "/src/data.js";
import {
  ROLES,
  EVENTS,
  STRAINS,
  SEQUENCES,
  DISHES,
  ROLE_PAWN_COLORS,
  cardName,
} from "/src/catalog.js";
import {
  renderBoard,
  escapeHTML as esc,
  diseaseColor as color,
} from "/board.js";
const $ = (s) => document.querySelector(s),
  app = $("#app");
const cname = cardName;
const cp = (id) => CITIES[id]?.color;
const dishes = {
  sample1: "Sample Dish ①",
  sample2: "Sample Dish ②",
  centrifuge: "Centrifuge Dish",
  separator: "Separator Dish",
  growth: "Growth Dish",
  line0: "Research Line ①",
  line1: "Research Line ②",
};
const formDrafts = {};
function captureDraft() {
  const f = $("#action-form");
  if (!f || !f.dataset.draftKey) return;
  const draft = {};
  for (const e of f.querySelectorAll("select,input"))
    draft[e.id] = e.type === "checkbox" ? e.checked : e.value;
  formDrafts[f.dataset.draftKey] = draft;
}
function restoreDraft() {
  const f = $("#action-form"),
    draft = f && formDrafts[f.dataset.draftKey];
  if (draft)
    for (const [id, value] of Object.entries(draft)) {
      const e = document.getElementById(id);
      if (e) {
        if (e.type === "checkbox") e.checked = value;
        else if (
          [...(e.options || [])].some((o) => o.value === value) ||
          e.tagName === "INPUT"
        )
          e.value = value;
      }
    }
}
let room = null,
  session = null,
  stream = null,
  actor = null,
  selectedCity = "atlanta",
  selectedCards = new Set(),
  mode = null,
  eventId = null,
  pendingBusy = false,
  forecastOrder = null,
  toastTimer;
try {
  session = JSON.parse(localStorage.getItem("pandemic.session"));
} catch {}
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("#toast").style.display = "none"), 5500);
}
function active() {
  return room?.game?.players[room.game.turn];
}
function me() {
  return room?.game?.players.find((p) => p.id === actor);
}
function own(p) {
  return p.owner === room.you;
}
async function request(path, body) {
  const opts = { headers: {} };
  if (session) opts.headers.authorization = "Bearer " + session.token;
  if (body !== undefined) {
    opts.method = "POST";
    opts.headers["content-type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw Error(data.error || "Request failed.");
  return data;
}
async function mutation(route, data) {
  if (pendingBusy) return;
  pendingBusy = true;
  try {
    update(
      await request("/api/rooms/" + room.code + "/" + route, {
        version: room.version,
        ...data,
      }),
    );
  } catch (e) {
    toast(e.message);
    if (session)
      try {
        update(await request("/api/rooms/" + session.code));
      } catch {}
  } finally {
    pendingBusy = false;
  }
}
const command = (a) => mutation("action", { actor, action: a });
function update(r) {
  const was = room;
  room = r;
  if (r.game) {
    const oldActor = actor;
    if (!actor || !r.game.players.some((p) => p.id === actor && own(p)))
      actor = own(active()) ? active().id : r.game.players.find(own)?.id;
    if (was?.game && was.game.turn !== r.game.turn && own(active())) {
      actor = active().id;
      mode = null;
      selectedCards.clear();
    }
    if (oldActor !== actor) selectedCards.clear();
    for (const c of selectedCards)
      if (!me()?.hand.includes(c)) selectedCards.delete(c);
  }
  render();
}
function connect() {
  stream?.close();
  stream = new EventSource(
    "/api/rooms/" +
      session.code +
      "/stream?token=" +
      encodeURIComponent(session.token),
  );
  stream.onmessage = (e) => {
    const r = JSON.parse(e.data);
    if (!room || r.version >= room.version) update(r);
    $("#connection").textContent = "● Connected · " + session.code;
  };
  stream.onerror = () => {
    $("#connection").textContent = "○ Reconnecting…";
  };
}
function saveSession(token, code) {
  session = { token, code };
  localStorage.setItem("pandemic.session", JSON.stringify(session));
  connect();
}
function showHome() {
  room = null;
  app.innerHTML = `<section class="home"><div class="intro"><h1>Pandemic</h1><p>Work together to discover cures for four diseases before the outbreaks get out of control.</p><p class="helper">One player can control two to four roles. In multiplayer, each player controls their assigned roles.</p></div><div><section class="panel"><h2>Create a Room</h2><p>Invite others with your room code.</p><input id="create-name" maxlength="24" placeholder="Your name" autocomplete="nickname"><button id="create" class="primary">Create Room →</button></section><section class="panel"><h2>Join a Room</h2><input id="join-name" maxlength="24" placeholder="Your name"><input id="join-code" maxlength="6" placeholder="6-character room code" value="${esc(new URLSearchParams(location.search).get("room") || "")}" style="text-transform:uppercase;letter-spacing:3px"><button id="join">Join Room</button></section>${session ? '<button id="resume">Resume room ' + esc(session.code) + "</button>" : ""}<button id="import-session" style="margin-top:12px">Import Reconnect Credentials</button><input type="file" id="session-file" accept="application/json" hidden></div></section><div class="footer-note">Unofficial fan project · Pandemic © Z-Man Games / Asmodee</div>`;
  $("#create").onclick = async () => {
    try {
      const data = await request("/api/rooms", {
        name: $("#create-name").value,
      });
      saveSession(data.token, data.room.code);
      update(data.room);
    } catch (e) {
      toast(e.message);
    }
  };
  $("#join").onclick = async () => {
    try {
      const code = $("#join-code").value.trim().toUpperCase();
      const data = await request("/api/rooms/" + code + "/join", {
        name: $("#join-name").value,
      });
      saveSession(data.token, code);
      update(data.room);
    } catch (e) {
      toast(e.message);
    }
  };
  if ($("#resume")) $("#resume").onclick = resume;
  $("#import-session").onclick = () => $("#session-file").click();
  $("#session-file").onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file || file.size > 10000) throw Error("Invalid credentials file.");
      const data = JSON.parse(await file.text());
      if (
        !/^[A-Z2-9]{6}$/.test(data.code) ||
        typeof data.token !== "string" ||
        data.token.length > 200
      )
        throw Error("Invalid credentials file format.");
      const r = await fetch("/api/rooms/" + data.code, {
        headers: { authorization: "Bearer " + data.token },
      });
      const result = await r.json();
      if (!r.ok) throw Error(result.error);
      saveSession(data.token, data.code);
      update(result);
    } catch (e) {
      toast(e.message);
    }
  };
}
async function resume() {
  try {
    update(await request("/api/rooms/" + session.code));
    connect();
  } catch (e) {
    showHome();
    toast(e.message);
  }
}
function roomHead() {
  return `<div class="roomhead"><h2>Room</h2><span class="roomcode">${esc(room.code)}</span><button id="copy-room">Copy Invite</button><small>${room.members.length}/4  players</small><button id="leave">Back to Home</button></div>`;
}
function bindHead() {
  $("#copy-room").onclick = async () => {
    try {
      await navigator.clipboard.writeText(
        location.origin + "/?room=" + room.code,
      );
      toast("Invite link copied.");
    } catch {
      toast("Room code:" + room.code);
    }
  };
  $("#leave").onclick = () => {
    stream?.close();
    showHome();
  };
}
function renderLobby() {
  const host = room.you === room.host,
    o = room.options;
  app.innerHTML =
    roomHead() +
    `<div class="lobby"><section class="panel"><h2>Roles</h2><p>Choose at least two roles. You can control extra roles or invite other players.</p>${room.seats
      .map(
        (p) =>
          `<div class="seat"><span class="dot" style="background:${ROLE_PAWN_COLORS[p.role] ?? "var(--muted)"}"></span><div><b>${esc(p.name)}</b><br><small>${p.owner === room.you ? "You control this role" : room.members.find((m) => m.id === p.owner)?.online ? "Connected" : "Offline"}</small></div><select data-seat="${p.id}" ${p.owner !== room.you ? "disabled" : ""}><option value="">Random role</option>${Object.entries(
            ROLES,
          )
            .filter(
              ([r]) =>
                (o.expansionCards || Object.keys(ROLES).indexOf(r) < 7) &&
                !(o.lab && r === "field_operative"),
            )
            .map(
              ([r, [n]]) =>
                `<option value="${r}" ${p.role === r ? "selected" : ""}>${n}</option>`,
            )
            .join(
              "",
            )}</select>${host && p.owner === room.you && room.seats.length > 1 ? `<button data-remove="${p.id}" aria-label="Remove role">×</button>` : ""}</div>`,
      )
      .join(
        "",
      )}${host && room.seats.length < 4 ? '<button id="add-seat">＋ Add a Role I Control</button>' : ""}<p class="helper">Choose distinct roles or leave the selection random. See Rules for role abilities.</p>${host ? `<button id="start" class="primary" ${room.seats.length < 2 ? "disabled" : ""}>Start Game →</button>` : "<p>Waiting for the host to start the game…</p>"}</section><section class="panel"><h2>Difficulty and Challenges</h2><div class="setting"><label>Epidemic cards <select id="epidemics" ${host ? "" : "disabled"}>${[4, 5, 6, 7].map((n) => `<option ${o.epidemics === n ? "selected" : ""} value="${n}">${n} cards · ${["Introductory", "Standard", "Heroic", "Legendary"][n - 4]}</option>`).join("")}</select></label><small>Legendary uses seven Epidemic cards.</small></div>${[
      [
        "virulent",
        "Virulent Strain",
        "The first Virulent Strain Epidemic identifies the Virulent Strain. Each Epidemic card has an additional effect.",
      ],
      [
        "mutation",
        "Mutation",
        "Adds the purple disease, 12 purple disease cubes, and Mutation cards.",
      ],
      [
        "lab",
        "Lab Challenge",
        "Process disease samples, characterize diseases, and test cures before discovering them.",
      ],
      [
        "expansionCards",
        "Expansion Roles and Events",
        "Adds On the Brink / In the Lab roles and Events, plus two Virulent Strain Epidemic cards. Shuffle two Event cards per role into the Player Deck.",
      ],
      [
        "worldwide",
        "Worldwide Panic variant",
        "Requires Mutation. Uses 24 purple disease cubes, additional initial infection, and different requirements to Discover a Cure.",
      ],
    ]
      .map(
        ([k, n, d]) =>
          `<div class="setting"><label><input type="checkbox" data-option="${k}" ${o[k] ? "checked" : ""} ${!host || (k === "worldwide" && !o.mutation) ? "disabled" : ""}>${n}</label><small>${d}</small></div>`,
      )
      .join(
        "",
      )}<p class="helper">Combine any of the three challenges. A solo player controls multiple roles.</p></section></div>`;
  bindHead();
  document.querySelectorAll("[data-seat]").forEach(
    (e) =>
      (e.onchange = () =>
        mutation("lobby", {
          op: "seatRole",
          seat: e.dataset.seat,
          role: e.value || null,
        })),
  );
  document
    .querySelectorAll("[data-remove]")
    .forEach(
      (e) =>
        (e.onclick = () =>
          mutation("lobby", { op: "removeSeat", seat: e.dataset.remove })),
    );
  if ($("#add-seat"))
    $("#add-seat").onclick = () => mutation("lobby", { op: "addSeat" });
  if ($("#start")) $("#start").onclick = () => mutation("start", {});
  if (host) {
    $("#epidemics").onchange = (e) =>
      mutation("lobby", {
        op: "options",
        options: { epidemics: Number(e.target.value) },
      });
    document.querySelectorAll("[data-option]").forEach(
      (e) =>
        (e.onchange = () =>
          mutation("lobby", {
            op: "options",
            options: { [e.dataset.option]: e.checked },
          })),
    );
  }
}
const cardHTML = (c, p) =>
  `<button class="card ${selectedCards.has(c) && p.id === actor ? "picked" : ""}" style="--c:${color(cp(c))}" data-card="${esc(c)}" data-owner="${p.id}" title="${esc(EVENTS[c.slice(6)]?.[1] || cname(c))}">${esc(cname(c))}</button>`;
function renderLab(g) {
  if (!g.lab) return "";
  return `<section class="panel lab"><h2>Lab Challenge</h2><div class="dishes">${DISHES.map(
    (d) =>
      `<div class="dish"><h3>${dishes[d]}</h3>${
        COLORS.filter((c) => g.lab.dishes[d][c])
          .map(
            (c) =>
              `<span class="chip" style="--c:${color(c)}">${DISEASE_NAMES[c]} ${g.lab.dishes[d][c]}</span>`,
          )
          .join("") || "<small>Empty</small>"
      }</div>`,
  ).join(
    "",
  )}</div><p class="helper">Sample Dish → Centrifuge (one color) or Separator (one cube per color) → Growth (double the cubes) or Sequence card. Move all cubes from one dish along a single arrow. Return unused cubes to the supply.</p><div class="researchlines">${g.lab.lines.map((l, i) => (l ? `<div class="researchline"><h3>Research Line ${i + 1} <small>SEQUENCE ${l.sequence + 1}</small></h3><small>Cure colors: ${SEQUENCES[l.sequence].eligible.map((c) => DISEASE_NAMES[c]).join(" / ")}</small><div class="slots">${SEQUENCES[l.sequence].slots.map((c, j) => `<span class="slot ${l.filled[j] ? "filled" : ""}" style="--c:${color(c === "gray" && l.color ? l.color : c)};--fill:${color(l.filled[j])}" title="${c === "gray" ? "Disease color being researched" : DISEASE_NAMES[c]}${l.filled[j] ? ", filled with " + DISEASE_NAMES[l.filled[j]] : ""}">${l.filled[j] ? "✓" : c === "gray" ? "?" : ""}</span>`).join("")}</div><small>${l.color ? "Characterized: " + DISEASE_NAMES[l.color] + " · " + cname(l.character) : "Uncharacterized"}<br>${l.test ? "Tested · " + cname(l.test) : "Not tested"}</small></div>` : `<div class="researchline"><h3>Research Line ${i + 1}</h3><p class="helper">Use Sequence a Disease to open this research line when at least two research stations are on the board.</p></div>`)).join("")}</div></section>`;
}
function renderGame() {
  captureDraft();
  const boardScroll = $(".boardframe")?.scrollLeft ?? 0;
  const g = room.game,
    p = me(),
    turn = active(),
    mine = own(turn),
    can =
      mine &&
      g.phase === "actions" &&
      g.actions > 0 &&
      !g.pending &&
      !g.players.some(
        (p) => p.hand.length > (p.role === "archivist" ? 8 : 7),
      ) &&
      !room.approval;
  app.innerHTML =
    roomHead() +
    `${g.status !== "playing" ? `<div class="outcome ${g.status}"><h2>${g.status === "won" ? "Victory" : "Defeat"}</h2>${esc(g.reason)}</div>` : ""}<div class="gamehead"><h2>Game Board</h2><span class="pill">${g.phase === "actions" ? "Do 4 Actions" : g.phase === "draw" ? "Draw 2 Player Cards" : "Infect Cities"}</span><div class="right">${g.options.virulent ? '<span class="pill">Virulent Strain</span>' : ""}${g.options.mutation ? '<span class="pill">Mutation' + (g.options.worldwide ? ": Worldwide Panic" : "") + "</span>" : ""}${g.options.lab ? '<span class="pill">Lab Challenge</span>' : ""}</div></div>${room.approval ? approvalHTML() : ""}<div class="dashboard"><div class="boardwrap">${renderBoard(g, selectedCity)}${renderLab(g)}<div class="playerlist">${g.players
      .map(
        (q) =>
          `<section class="playercard ${q.id === turn.id ? "active" : ""}"><h3><i class="pawn-dot" style="--pawn-color:${ROLE_PAWN_COLORS[q.role]}"></i>${esc(q.name)} <small>· ${ROLES[q.role][0]} ${own(q) ? " (you)" : ""}</small></h3><div class="meta"><span>${CITIES[q.city].name}</span><span>${q.hand.length}/${q.role === "archivist" ? 8 : 7} cards</span></div><div class="cards">${q.hand.map((c) => cardHTML(c, q)).join("")}${q.stored ? cardHTML(q.stored, q) : ""}</div>${
            COLORS.some((c) => q.samples[c])
              ? `<div class="helper">Field Operative samples: ${COLORS.filter(
                  (c) => q.samples[c],
                )
                  .map((c) => DISEASE_NAMES[c] + q.samples[c])
                  .join(" / ")}</div>`
              : ""
          }<div class="helper">${ROLES[q.role][1]}</div></section>`,
      )
      .join(
        "",
      )}</div><div class="decklinks"><button data-deck="infectionRemoved">Removed Infection cards ${g.infectionRemoved.length}</button>${g.peek ? '<button data-deck="peek">Troubleshooter: View Infection Cards</button>' : ""}<button id="credentials">Save Reconnect Credentials</button></div></div><aside class="sidebar"><section class="panel"><div class="turnname">${esc(turn.name)}'s turn</div><small>${ROLES[turn.role][0]} · ${CITIES[turn.city].name}</small><div class="actiondots">${Array.from({ length: Math.max(g.actions, turn.role === "generalist" ? 5 : 4) }, (_, i) => `<i class="${i < g.actions ? "live" : ""}"></i>`).join("")}</div><p class="helper">${g.phase === "actions" ? g.actions + " actions remaining" : g.phase === "draw" ? "Resolve Mutation Events and Epidemic cards, then check the hand limit." : "Resolve " + g.infectionLeft + "  Infection cards. You may play Events between cards."}</p><label>Role to control <select id="actor">${g.players
      .filter(own)
      .map(
        (q) =>
          `<option value="${q.id}" ${q.id === actor ? "selected" : ""}>${esc(q.name)} · ${ROLES[q.role][0]}</option>`,
      )
      .join("")}</select></label>${
      g.status === "playing"
        ? `<div class="control-grid" style="margin-top:14px">${[["move", "Move"], ["treat", "Treat Disease"], ["build", "Build a Research Station"], ["share", "Share Knowledge"], ["cure", "Discover a Cure"], ["role", "Role Ability"], ...(g.lab ? [["lab", "Lab Actions"]] : []), ["event", "Event Cards"], ["discard", "Discard to Hand Limit"]].map(([k, n]) => `<button data-mode="${k}" ${["event", "discard"].includes(k) || (k === "role" && p.role === "field_operative") ? "" : (!can && !(k === "role" && mine && g.phase === "actions")) || actor !== turn.id ? "disabled" : ""}>${n}</button>`).join("")}</div>${g.pending ? pendingHTML(g, p) : `<button id="advance" class="${mine ? "primary" : ""}" style="width:100%;margin-top:12px" ${!mine || actor !== turn.id || room.approval ? "disabled" : ""}>${g.phase === "actions" ? "End Actions → Draw 2 Player Cards" : g.phase === "draw" && g.drawQueue.length ? "Resolve " + cname(g.drawQueue[0]) : g.phase === "draw" ? "Begin Infect Cities" : g.infectionLeft ? "Resolve Next Infection Card" : "End Turn"} →</button>`}${
            g.phase === "draw" &&
            g.drawQueue.filter((c) => c.startsWith("mutation:")).length > 1
              ? '<label>Mutation Event Order</label><select id="resolve-card">' +
                g.drawQueue
                  .filter((c) => c.startsWith("mutation:"))
                  .map((c) =>
                    opt(
                      c,
                      {
                        threatens:
                          "The Mutation Threatens! Add 3 purple cubes to the bottom Infection card’s city.",
                        spreads:
                          "The Mutation Spreads Add 1 purple cube to each of 3 bottom Infection card cities.",
                        intensifies:
                          "The Mutation Intensifies! Add 1 purple cube to each city with exactly 2 purple cubes.",
                      }[c.slice(9)],
                    ),
                  )
                  .join("") +
                "</select>"
              : ""
          }${renderForm(g, p)}`
        : ""
    }</section><section class="panel"><div class="eyebrow">SELECTED CITY</div><div class="selectedcity">${CITIES[selectedCity].name}</div><div class="citydetail">${DISEASE_NAMES[cp(selectedCity)]} disease<br>${
      COLORS.filter((c) => g.board[selectedCity][c])
        .map(
          (c) =>
            `<span class="chip" style="--c:${color(c)}">${DISEASE_NAMES[c]} ${g.board[selectedCity][c]}</span>`,
        )
        .join("") || "No disease cubes"
    }<br>Connected cities ${ADJ[selectedCity].map((id) => `<a href="#" data-select-city="${id}" style="color:${color(cp(id))}">${CITIES[id].name}</a>`).join(", ")}</div></section>${g.strain ? `<section class="panel"><h3 style="color:${color(g.strain)}">Virulent Strain${DISEASE_NAMES[g.strain]}</h3><div class="helper">${g.strainEffects.map((x) => STRAINS[x][0]).join(" · ") || "No ongoing effects"}</div><button id="strain-help" style="margin-top:12px">View Effects</button></section>` : ""}<section class="panel"><div class="eyebrow">OPERATION LOG</div><div class="log">${[
      ...g.log,
    ]
      .reverse()
      .map((l) => `<div>${esc(l)}</div>`)
      .join("")}</div></section></aside></div>`;
  $(".boardframe").scrollLeft = boardScroll;
  bindHead();
  bindGame(g, p);
}
const opt = (v, label, selected) =>
  `<option value="${esc(v)}" ${v === selected ? "selected" : ""}>${esc(label)}</option>`;
const select = (id, items, selected) =>
  `<select id="f-${id}">${items.map((x) => opt(Array.isArray(x) ? x[0] : x, Array.isArray(x) ? x[1] : x, selected)).join("")}</select>`;
const field = (n, html) => `<label>${n}</label>${html}`;
const cities = (selected = selectedCity) =>
  select(
    "city",
    Object.values(CITIES).map((c) => [c.id, c.name]),
    selected,
  );
const players = (g, id = "player") =>
  select(
    id,
    g.players.map((p) => [p.id, p.name + " · " + ROLES[p.role][0]]),
    g.players.find((p) => p.id !== actor)?.id,
  );
const colors = (g) =>
  select(
    "color",
    (g.options.mutation ? COLORS : COLORS.slice(0, 4)).map((c) => [
      c,
      DISEASE_NAMES[c],
    ]),
    cp(selectedCity),
  );
const handcards = (p, id = "card") =>
  select(
    id,
    p.hand.filter((c) => CITIES[c]).map((c) => [c, cname(c)]),
    [...selectedCards][0],
  );
const cityCardsHint = (p) =>
  `<p class="helper">Selected ${selectedCards.size}  City cards. Select cards from your hand before confirming.${[...selectedCards].map((c) => cname(c)).join(", ")}</p>`;
function labFields(g, p, op = "characterize") {
  return (
    field(
      "Lab Actions",
      select(
        "op",
        [
          ["characterize", "Characterize a Disease"],
          ["process", "Process a Sample"],
          ["test", "Test a Cure"],
          ["sequence", "Sequence a Disease"],
        ],
        op,
      ),
    ) + '<div id="lab-detail"></div>'
  );
}
function renderForm(g, p) {
  if (!mode || !p) return "";
  let html = "";
  if (mode === "move")
    html =
      field(
        "Movement action",
        select(
          "moveMode",
          [
            ["drive", "Drive / Ferry"],
            ["direct", "Direct Flight (discard destination City card)"],
            ["charter", "Charter Flight (discard departure City card)"],
            ["shuttle", "Shuttle Flight (between research stations)"],
            ...(p.role === "dispatcher"
              ? [
                  [
                    "dispatch",
                    "Dispatcher: move to a city containing another pawn",
                  ],
                ]
              : []),
            ...(p.role === "operations_expert"
              ? [["operations", "Operations Expert: special move"]]
              : []),
            ...(p.role === "pilot"
              ? [["pilot", "Pilot: fly up to three connections"]]
              : []),
          ],
          p.role === "pilot" ? "pilot" : "drive",
        ),
      ) +
      field(
        "Pawn to move",
        select(
          "pawn",
          g.players
            .filter(
              (q) =>
                q.id === p.id ||
                p.role === "dispatcher" ||
                g.effects.specialOrders === q.id,
            )
            .map((q) => [q.id, q.name]),
          p.id,
        ),
      ) +
      field("Destination", cities()) +
      field(
        "City card to discard for the Operations Expert's move",
        handcards(p),
      ) +
      field(
        "Pilot passenger (optional)",
        select(
          "passenger",
          [
            ["", "No passenger"],
            ...g.players
              .filter((q) => q.id !== p.id && q.city === p.city)
              .map((q) => [q.id, q.name]),
          ],
          "",
        ),
      ) +
      field(
        "Disease cube to remove with Mobile Hospital",
        select(
          "color",
          [
            ["", "Select a color automatically"],
            ...COLORS.map((c) => [c, DISEASE_NAMES[c]]),
          ],
          "",
        ),
      );
  if (mode === "treat")
    html =
      field(
        "City to treat",
        cities(
          p.city === selectedCity || p.role === "field_director"
            ? selectedCity
            : p.city,
        ),
      ) +
      field("Disease color", colors(g)) +
      (g.lab
        ? field(
            "Take one sample (optional)",
            select(
              "sample",
              [
                ["", "Do not sample"],
                ["sample1", "Sample Dish ①"],
                ["sample2", "Sample Dish ②"],
              ],
              "",
            ),
          )
        : "");
  if (mode === "build")
    html =
      '<p class="helper">Build in your current city. Discard its City card unless you are the Operations Expert.</p>' +
      field(
        "6 research stations are already on the board: choose one to relocate",
        select(
          "replace",
          g.stations.map((c) => [c, cname(c)]),
        ),
      );
  if (mode === "share")
    html =
      field("Player in the same city", players(g)) +
      field(
        "Direction",
        select(
          "direction",
          [
            ["give", "Give"],
            ["take", "Take"],
          ],
          "give",
        ),
      ) +
      field(
        "City card to share",
        select(
          "card",
          Object.values(CITIES).map((c) => [c.id, c.name]),
          [...selectedCards][0],
        ),
      );
  if (mode === "cure")
    html =
      field("Disease to cure", colors(g)) +
      cityCardsHint(p) +
      (p.role === "field_operative"
        ? '<label class="inline-check"><input type="checkbox" id="f-useSamples">Use three Field Operative samples in place of two City cards</label>'
        : "") +
      '<p class="helper">Discard five matching City cards (four for the Scientist). In the Lab Challenge, complete the research line, then discard three matching City cards (two for the Scientist). Apply any modifiers from Complex Molecular Structure or Sequencing Breakthrough.</p>';
  if (mode === "lab") html = labFields(g, p);
  if (mode === "role") {
    if (["archivist", "researcher"].includes(p.role))
      html = `<p class="helper">${ROLES[p.role][1]}</p>`;
    else if (p.role === "contingency_planner")
      html = field(
        "Retrieve an Event card",
        select(
          "card",
          g.playerDiscard
            .filter((c) => c.startsWith("event:"))
            .map((c) => [c, cname(c)]),
        ),
      );
    else if (p.role === "epidemiologist")
      html =
        field(
          "Ability",
          select(
            "op",
            [
              ["take", "Take a City card from a player in your city (free)"],
              ...(g.lab ? [["process", "Process a Sample (free)"]] : []),
            ],
            "take",
          ),
        ) + '<div id="role-detail"></div>';
    else if (p.role === "field_operative")
      html =
        field(
          "Ability",
          select(
            "op",
            [
              ["sample", "Take one Field Operative sample"],
              ["return", "Return one Field Operative sample"],
            ],
            "sample",
          ),
        ) + field("Color", colors(g));
    else if (p.role === "field_director")
      html = field("Pawn to move", players(g)) + field("Destination", cities());
    else if (p.role === "virologist")
      html =
        field("City card to discard", handcards(p)) +
        field("City to remove the disease cube from", cities());
    else if (p.role === "local_liaison")
      html =
        field(
          "Ability",
          select(
            "op",
            [
              [
                "give",
                "Give a City card to a player in a city of the same color",
              ],
              ...(g.lab
                ? [
                    ["characterize", "Characterize a Disease (free)"],
                    ["test", "Test a Cure (free)"],
                  ]
                : []),
            ],
            "give",
          ),
        ) + '<div id="role-detail"></div>';
    else
      html =
        '<p class="helper">This role’s ability applies automatically or through another action.</p>';
  }
  if (mode === "event") {
    const events = [...p.hand, ...(p.stored ? [p.stored] : [])].filter((c) =>
      c.startsWith("event:"),
    );
    html =
      field(
        "Event card",
        select(
          "event",
          events.map((c) => [c.slice(6), cname(c)]),
          eventId,
        ),
      ) + '<div id="event-detail"></div>';
  }
  if (mode === "discard")
    html =
      field(
        "Card to discard",
        select(
          "card",
          p.hand.map((c) => [c, cname(c)]),
        ),
      ) +
      '<p class="helper">Discard only when over the hand limit. You may also play Event cards to get below the limit.</p>';
  return `<form id="action-form" class="actionform" data-draft-key="${actor}:${mode}"><h3>${{ move: "Move a Pawn", treat: "Treat Disease", build: "Build a Research Station", share: "Share Knowledge", cure: "Discover a Cure", lab: "Lab Actions", role: "Role Ability", event: "Play an Event", discard: "Discard to Hand Limit" }[mode]}</h3>${html}<button class="primary" type="submit">Confirm</button><button id="cancel-form" type="button">Close</button></form>`;
}
function processFields() {
  return (
    field(
      "Source dish",
      select(
        "from",
        DISHES.map((d) => [d, dishes[d]]),
        "sample1",
      ),
    ) +
    field(
      "Destination",
      select(
        "to",
        ["centrifuge", "separator", "growth", "line0", "line1"].map((d) => [
          d,
          dishes[d],
        ]),
        "centrifuge",
      ),
    ) +
    field("Color to keep in the Centrifuge Dish", colors(room.game)) +
    field(
      "Sequence card allocation",
      select(
        "allocationMode",
        [
          ["auto", "Fill available spaces automatically"],
          ["manual", "Choose each space"],
        ],
        "auto",
      ),
    ) +
    `<div id="allocation"></div><p class="helper">Choose how to fill the Sequence card. Return unused disease cubes to the supply.</p>`
  );
}
function allocationFields() {
  const to = $("#f-to")?.value;
  if (!to?.startsWith("line") || val("allocationMode") !== "manual") {
    $("#allocation").innerHTML = "";
    return;
  }
  const l = room.game.lab.lines[Number(to.slice(4))];
  $("#allocation").innerHTML = l?.color
    ? field(
        "Allocate disease cubes to the Sequence card",
        SEQUENCES[l.sequence].slots
          .map(
            (c, i) =>
              `<label>Space ${i + 1} · ${c === "gray" ? DISEASE_NAMES[l.color] : DISEASE_NAMES[c]}${l.filled[i] ? " (filled)" : ""}${select("alloc-" + i, [["", "Leave empty"], ...COLORS.map((c) => [c, DISEASE_NAMES[c]])], "")}</label>`,
          )
          .join(""),
      )
    : '<p class="helper">Characterize a Disease on this research line first.</p>';
}
function bindProcess() {
  if ($("#f-to")) {
    $("#f-to").onchange = allocationFields;
    if ($("#f-allocationMode"))
      $("#f-allocationMode").onchange = allocationFields;
    allocationFields();
  }
}
function labDetails(op, target = "#lab-detail") {
  const g = room.game,
    p = me();
  let html = "";
  if (op === "process") html = processFields();
  if (op === "characterize" || op === "test")
    html =
      field(
        "Research line",
        select(
          "line",
          g.lab.lines.map((l, i) => [String(i), "Research Line " + (i + 1)]),
          "0",
        ),
      ) +
      (op === "characterize" ? field("Disease to cure", colors(g)) : "") +
      field("City card to discard", handcards(p)) +
      (op === "test"
        ? field("City to remove the test cube from", cities())
        : "");
  if (op === "sequence")
    html =
      '<p class="helper">Draw a Sequence card, then replace a card, open the second research line if at least two research stations are on the board, or discard the card.</p>';
  $(target).innerHTML = html;
  bindProcess();
}
function roleDetails() {
  const p = me(),
    op = $("#f-op").value,
    g = room.game;
  if (op === "process") labDetails(op, "#role-detail");
  else if (["characterize", "test"].includes(op))
    labDetails(op, "#role-detail");
  else
    $("#role-detail").innerHTML =
      field("Other player", players(g)) +
      field(
        "City card",
        select(
          "card",
          (p.role === "local_liaison"
            ? p.hand.filter((c) => CITIES[c])
            : Object.keys(CITIES)
          ).map((c) => [c, cname(c)]),
        ),
      );
}
function removalFields(cured = false) {
  const g = room.game,
    choices = Object.entries(g.board).flatMap(([id, b]) =>
      COLORS.filter((c) => b[c] && (!cured || c === g.lastCure)).map((c) => [
        id + "|" + c,
        cname(id) + " · " + DISEASE_NAMES[c] + " (" + b[c] + ")",
      ]),
    );
  return (
    field("Disease cube to remove ①", select("remove0", choices)) +
    field(
      "Disease cube to remove ②",
      select("remove1", [...(cured ? [["", "None"]] : []), ...choices]),
    ) +
    (cured
      ? [2, 3, 4]
          .map((i) =>
            field(
              "Disease cube to remove " + (i + 1),
              select("remove" + i, [["", "None"], ...choices], ""),
            ),
          )
          .join("")
      : "")
  );
}
function eventDetails() {
  const id = $("#f-event")?.value;
  eventId = id;
  const g = room.game,
    p = me();
  let html = EVENTS[id] ? `<p class="helper">${EVENTS[id][1]}</p>` : "";
  if (
    [
      "airlift",
      "reexamined_research",
      "new_assignment",
      "special_orders",
    ].includes(id)
  )
    html += field("Target pawn", players(g));
  if (["airlift", "government_grant"].includes(id))
    html += field("Destination city", cities());
  if (id === "government_grant")
    html += field(
      "6 stations are already on the board: choose one to relocate",
      select(
        "replace",
        g.stations.map((c) => [c, cname(c)]),
      ),
    );
  if (id === "resilient_population")
    html += field(
      "Infection card to remove from the game",
      select(
        "card",
        g.infectionDiscard.filter((c) => CITIES[c]).map((c) => [c, cname(c)]),
      ),
    );
  if (id === "reexamined_research")
    html += field(
      "City card to retrieve",
      select(
        "card",
        g.playerDiscard.filter((c) => CITIES[c]).map((c) => [c, cname(c)]),
      ),
    );
  if (id === "new_assignment")
    html += field(
      "New role",
      select(
        "role",
        Object.entries(ROLES)
          .filter(
            ([r]) =>
              !g.players.some((p) => p.role === r) &&
              (g.options.expansionCards || Object.keys(ROLES).indexOf(r) < 7) &&
              !(g.lab && r === "field_operative"),
          )
          .map(([r, [n]]) => [r, n]),
      ),
    );
  if (["remote_treatment", "rapid_vaccine_deployment"].includes(id))
    html += removalFields(id === "rapid_vaccine_deployment");
  $("#event-detail").innerHTML = html;
}
function pendingHTML(g, p) {
  const q = g.pending,
    owns = g.players.find((p) => p.id === q.player)?.owner === room.you;
  if (q.type === "intensify")
    return `<div class="helper">Infect is complete. You may play Resilient Population before Intensify.</div><button id="advance" class="primary" style="width:100%;margin-top:12px" ${own(active()) && actor === active().id ? "" : "disabled"}>Intensify →</button>`;
  if (!owns)
    return (
      '<p class="helper">Waiting for another player to finish ' +
      esc(
        q.type === "bonusLab"
          ? "a bonus Lab action"
          : q.type === "sequence"
            ? "Sequence a Disease"
            : "Forecast",
      ) +
      ".</p>"
    );
  if (q.type === "bonusLab")
    return '<div class="helper">Bonus Lab action: take one free Lab action without a research station requirement.</div><button id="bonus-lab">Take Bonus Lab Action</button> <button id="skip-bonus">Skip Bonus Lab Action</button>';
  if (q.type === "sequence")
    return `<div class="helper">Drew Sequence card ${q.sequence + 1}: ${SEQUENCES[q.sequence].slots.map((c) => (c === "gray" ? "Disease color being researched" : DISEASE_NAMES[c])).join(" / ")}<br>Cure colors: ${SEQUENCES[q.sequence].eligible.map((c) => DISEASE_NAMES[c]).join(", ")}</div><button id="place-sequence">Place or Discard Sequence Card</button>`;
  if (q.type === "forecast")
    return '<button id="order-forecast">Reorder Forecast Cards</button>';
  return "";
}
function approvalHTML() {
  const a = room.approval,
    g = room.game,
    p = g.players.find((p) => p.id === a.actor);
  return `<div class="approval"><p>${esc(p.name)} requests consent</p><div class="consent-action">${describeAction(a.action, g)}</div>${a.needed.includes(room.you) && !a.approved.includes(room.you) ? '<button id="accept">Approve</button>' : ""}<button id="reject">${a.needed.includes(room.you) ? "Decline" : "Cancel Request"}</button><small>The game waits for every affected player to approve.</small></div>`;
}
function describeAction(a, g) {
  const target = g.players.find((p) => p.id === (a.player || a.pawn));
  return esc(
    (a.type === "move"
      ? "Move"
      : a.type === "share"
        ? "Share Knowledge"
        : a.type === "event"
          ? EVENTS[a.event]?.[0]
          : "Role Ability") +
      " · " +
      (target?.name || "") +
      " " +
      (a.to ? cname(a.to) : "") +
      " " +
      (a.card ? cname(a.card) : "") +
      (a.direction === "take" ? " (take)" : ""),
  );
}
function bindGame(g, p) {
  $("#actor").onchange = (e) => {
    actor = e.target.value;
    selectedCards.clear();
    mode = null;
    render();
  };
  document.querySelectorAll("[data-city]").forEach((e) => {
    const selectCity = () => {
      selectedCity = e.dataset.city;
      if ($("#f-city")) $("#f-city").value = selectedCity;
      render();
    };
    e.onclick = selectCity;
    e.onkeydown = (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        selectCity();
      }
    };
  });
  document.querySelectorAll("[data-select-city]").forEach(
    (e) =>
      (e.onclick = (ev) => {
        ev.preventDefault();
        selectedCity = e.dataset.selectCity;
        if ($("#f-city")) $("#f-city").value = selectedCity;
        render();
      }),
  );
  document.querySelectorAll("[data-mode]").forEach(
    (e) =>
      (e.onclick = () => {
        mode = e.dataset.mode;
        render();
      }),
  );
  document.querySelectorAll("[data-card]").forEach(
    (e) =>
      (e.onclick = () => {
        const q = g.players.find((p) => p.id === e.dataset.owner);
        if (!own(q)) {
          toast(
            cname(e.dataset.card) +
              " · " +
              (CITIES[e.dataset.card]?.name || "Another player's Event card"),
          );
          return;
        }
        if (actor !== q.id) {
          selectedCards.clear();
          mode = null;
        }
        actor = q.id;
        const c = e.dataset.card;
        if (c.startsWith("event:")) {
          mode = "event";
          eventId = c.slice(6);
        } else {
          if (selectedCards.has(c)) selectedCards.delete(c);
          else selectedCards.add(c);
        }
        render();
      }),
  );
  if ($("#advance"))
    $("#advance").onclick = () =>
      command({ type: "advance", card: $("#resolve-card")?.value });
  if ($("#accept"))
    $("#accept").onclick = () =>
      mutation("approve", { id: room.approval.id, accept: true });
  if ($("#reject"))
    $("#reject").onclick = () =>
      mutation("approve", { id: room.approval.id, accept: false });
  if ($("#cancel-form"))
    $("#cancel-form").onclick = () => {
      mode = null;
      render();
    };
  restoreDraft();
  if (mode === "lab" && $("#f-op")) {
    labDetails($("#f-op").value);
    $("#f-op").onchange = () => labDetails($("#f-op").value);
  }
  if (mode === "role" && $("#role-detail")) {
    roleDetails();
    $("#f-op").onchange = roleDetails;
  }
  if (mode === "event" && $("#f-event")) {
    eventDetails();
    $("#f-event").onchange = eventDetails;
  }
  if ($("#action-form"))
    $("#action-form").onsubmit = (e) => {
      e.preventDefault();
      captureDraft();
      sendForm();
    };
  restoreDraft();
  if ($("#allocation")) {
    allocationFields();
    restoreDraft();
  }
  document.querySelectorAll("[data-deck]").forEach(
    (e) =>
      (e.onclick = () => {
        const key = e.dataset.deck;
        openModal(
          "<h2>" +
            {
              infectionDiscard: "Infection Discard Pile",
              playerDiscard: "Player Discard Pile",
              infectionRemoved: "Removed Infection Cards",
              peek: "Troubleshooter: Top Infection Cards",
            }[key] +
            '</h2><div class="modalcards">' +
            g[key]
              .map(
                (c) =>
                  `<span class="card" style="--c:${color(cp(c))}">${esc(cname(c))}</span>`,
              )
              .join("") +
            "</div>",
        );
      }),
  );
  $("#credentials").onclick = () => {
    const blob = new Blob(
        [JSON.stringify({ code: session.code, token: session.token })],
        { type: "application/json" },
      ),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Pandemic_Reconnect_" + session.code + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Keep these reconnect credentials private.");
  };
  if ($("#strain-help")) $("#strain-help").onclick = () => showRules();
  if ($("#skip-bonus"))
    $("#skip-bonus").onclick = () => {
      actor = g.pending.player;
      command({ type: "bonusLab", skip: true });
    };
  if ($("#bonus-lab"))
    $("#bonus-lab").onclick = () => {
      actor = g.pending.player;
      mode = "lab";
      render();
      const form = $("#action-form");
      form.dataset.bonus = "true";
    };
  if ($("#place-sequence"))
    $("#place-sequence").onclick = () => sequenceDialog();
  if ($("#order-forecast"))
    $("#order-forecast").onclick = () => forecastDialog();
}
const val = (id) => $("#f-" + id)?.value;
function getLab() {
  const a = {
    op: val("op"),
    line: Number(val("line")),
    color: val("color"),
    card: val("card"),
    city: val("city"),
    from: val("from"),
    to: val("to"),
  };
  if (a.to?.startsWith("line") && val("allocationMode") === "manual") {
    const l = room.game.lab.lines[Number(a.to.slice(4))];
    if (l) a.allocation = l.filled.map((_, i) => val("alloc-" + i) || null);
  }
  return a;
}
function sendForm() {
  let a = { type: mode };
  if (mode === "move")
    Object.assign(a, {
      mode: val("moveMode"),
      pawn: val("pawn"),
      to: val("city"),
      card: val("card"),
      passenger: val("passenger") || null,
      hospitalColor: val("color"),
    });
  if (mode === "treat")
    Object.assign(a, {
      city: val("city"),
      color: val("color"),
      sample: val("sample") || null,
    });
  if (mode === "build") a.replace = val("replace");
  if (mode === "share")
    Object.assign(a, {
      player: val("player"),
      direction: val("direction"),
      card: val("card"),
    });
  if (mode === "cure")
    Object.assign(a, {
      color: val("color"),
      cards: [...selectedCards],
      useSamples: $("#f-useSamples")?.checked || false,
    });
  if (mode === "lab")
    Object.assign(
      a,
      getLab(),
      room.game.pending?.type === "bonusLab" ? { type: "bonusLab" } : {},
    );
  if (mode === "role") Object.assign(a, getLab(), { player: val("player") });
  if (mode === "event") {
    Object.assign(a, {
      event: val("event"),
      player: val("player"),
      to: val("city"),
      replace: val("replace"),
      card: val("card"),
      role: val("role"),
    });
    if (["remote_treatment", "rapid_vaccine_deployment"].includes(a.event))
      a.removals = Array.from(
        { length: a.event === "remote_treatment" ? 2 : 5 },
        (_, i) => val("remove" + i),
      )
        .filter(Boolean)
        .map((x) => {
          const [city, color] = x.split("|");
          return { city, color };
        });
  }
  if (mode === "discard") a.card = val("card");
  command(a);
}
function openModal(html) {
  $("#modal-content").innerHTML = html;
  if (!$("#modal").open) $("#modal").showModal();
}
function sequenceDialog() {
  const q = room.game.pending,
    s = SEQUENCES[q.sequence];
  openModal(
    `<h2>Sequence card ${s.id + 1}</h2><p>${s.slots.map((c) => (c === "gray" ? "Disease color being researched" : DISEASE_NAMES[c])).join(" · ")}</p><p>Cure colors: ${s.eligible.map((c) => DISEASE_NAMES[c]).join(", ")}</p><div class="choice"><button data-seq="0">Place in Research Line ①</button><button data-seq="1" ${room.game.stations.length < 2 && !room.game.lab.lines[1] ? "disabled" : ""}>Place in Research Line ②</button><button data-seq="discard">Discard</button></div><p class="helper">When a compatible Sequence card replaces another, characterization, testing, and matching cubes carry over. Fixed-color spaces fill before wild spaces.</p>`,
  );
  document.querySelectorAll("[data-seq]").forEach(
    (e) =>
      (e.onclick = () => {
        actor = q.player;
        command({ type: "sequenceChoice", line: e.dataset.seq });
        $("#modal").close();
      }),
  );
}
function forecastDialog() {
  const q = room.game.pending;
  if (!forecastOrder || !q.cards.every((c) => forecastOrder.includes(c)))
    forecastOrder = [...q.cards];
  function draw() {
    openModal(
      "<h2>Forecast · Top Card First</h2>" +
        forecastOrder
          .map(
            (c, i) =>
              `<div class="choice"><span>${i + 1}. ${esc(cname(c))}</span><button data-up="${i}" ${i === 0 ? "disabled" : ""}>↑</button><button data-down="${i}" ${i === forecastOrder.length - 1 ? "disabled" : ""}>↓</button></div>`,
          )
          .join("") +
        '<button id="finish-forecast" class="primary">Confirm Order</button>',
    );
    document.querySelectorAll("[data-up]").forEach(
      (e) =>
        (e.onclick = () => {
          let i = Number(e.dataset.up);
          [forecastOrder[i - 1], forecastOrder[i]] = [
            forecastOrder[i],
            forecastOrder[i - 1],
          ];
          draw();
        }),
    );
    document.querySelectorAll("[data-down]").forEach(
      (e) =>
        (e.onclick = () => {
          let i = Number(e.dataset.down);
          [forecastOrder[i + 1], forecastOrder[i]] = [
            forecastOrder[i],
            forecastOrder[i + 1],
          ];
          draw();
        }),
    );
    $("#finish-forecast").onclick = () => {
      actor = q.player;
      command({ type: "forecastChoice", cards: forecastOrder });
      forecastOrder = null;
      $("#modal").close();
    };
  }
  draw();
}
function showRules() {
  openModal(
    `<div class="ruletext"><h2>Rules Reference</h2><h3>Turn and Victory Conditions</h3><p>Do up to four actions, draw two Player cards, then infect cities. Advance one card at a time. The team loses if the Outbreaks marker reaches 8, there are too few cubes to place, or the Player Deck cannot supply two cards. Discover cures for all four diseases to win. In Mutation, also discover the purple cure, or have no purple cubes on the board when the four original diseases are cured.</p><h3>Movement and Share Knowledge</h3><p>Drive / Ferry follows a connection. Direct Flight discards the destination City card. Charter Flight discards the departure City card. Shuttle Flight requires research stations at both ends. Share Knowledge transfers the current City card between players in the same city. The Researcher may give any City card. The affected player confirms transfers, pawn moves, and role changes.</p><h3>Hands, Events, and Epidemics</h3><p>The hand limit is seven cards, or eight for the Archivist. Hands are public in Introductory games and private in games with five to seven Epidemic cards. Discard down only when over the hand limit. Event cards cost no actions. Play them between actions or between cards. Only Resilient Population may interrupt an Epidemic between Infect and Intensify. Complete any pending Forecast, Sequence a Disease, or bonus Lab action choice before continuing.</p><h3>Lab Challenge</h3><p>Take at most one cube as a sample during Treat Disease. Lab actions usually cost one action and require a research station. To Characterize a Disease, use a City card matching a cure vial on the Sequence card. For purple, the city must have a purple cube. Process a Sample moves all cubes from a dish along one arrow. The Centrifuge Dish keeps one color, the Separator Dish keeps one cube per color, and the Growth Dish doubles cubes. Move samples to a characterized Sequence card and return unused cubes to the supply. Gray spaces match the cure color. Spaces of an eradicated color can take any color. Once at least one space is filled, Test a Cure with a matching City card and remove a cube of that disease from the board. With the Sequence card filled and the cure tested, Discover a Cure at a research station by discarding three matching City cards (two for the Scientist). Building a research station grants a free Lab action. Open the second research line with Sequence a Disease once there are at least two research stations.</p><h3>Roles</h3>${Object.entries(
      ROLES,
    )
      .map(([id, [n, d]]) => `<p><b>${n}</b>: ${d}</p>`)
      .join("")}<h3>Ongoing Virulent Strain Effects</h3>${[
      [
        "chronic_effect",
        "When infecting a city of this color with no cubes of that color, place two cubes instead of one.",
      ],
      [
        "complex_molecular_structure",
        "Discover a Cure for the Virulent Strain requires one additional City card.",
      ],
      [
        "government_interference",
        "To leave a city with Virulent Strain cubes, the current player must Treat Disease there first this turn.",
      ],
      [
        "rate_effect",
        "Draw one additional Infection card when a Virulent Strain city is drawn and the disease is not eradicated.",
      ],
      [
        "slippery_slope",
        "Advance the Outbreaks marker two spaces for each outbreak of the Virulent Strain.",
      ],
      [
        "highly_contagious",
        "The first outbreak adds two cubes to adjacent cities. Chain reaction outbreaks still add one.",
      ],
      [
        "resistant_to_treatment",
        "Treat Disease for an uncured Virulent Strain costs two actions in the same turn.",
      ],
    ]
      .map(([id, d]) => `<p><b>${STRAINS[id][0]}</b>: ${d}</p>`)
      .join(
        "",
      )}<h3>Rulebooks</h3><p>Includes the base game with four to seven Epidemic cards, Virulent Strain, the original Mutation, In the Lab, and Worldwide Panic. Solo play uses multiple standard roles. The Bio-Terrorist Challenge, Team Game, and CDC solo variant are outside this implementation.</p><p><a target="_blank" rel="noreferrer" href="https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/Pandemic_Rulebook.pdf">Base Game Rulebook</a> · <a target="_blank" rel="noreferrer" href="https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/On-the-Brink_Rules_Web.pdf">On the Brink</a> · <a target="_blank" rel="noreferrer" href="https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/In-the-Lab_Rules_Web.pdf">In the Lab</a></p></div>`,
  );
}
function render() {
  if (!room) return showHome();
  room.game ? renderGame() : renderLobby();
}
$("#help").onclick = showRules;
$("#modal .close").onclick = () => $("#modal").close();
if (session) resume();
else showHome();
