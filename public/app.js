import { CITIES, ADJ, EDGES, COLORS, CN } from "/src/data.js";
import { ROLES, EVENTS, STRAINS, SEQUENCES, DISHES } from "/src/catalog.js";
const $ = (s) => document.querySelector(s),
  app = $("#app");
const esc = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const color = (c) =>
  ({
    blue: "#56a8ed",
    yellow: "#f5c555",
    black: "#a9b0bf",
    red: "#f36f76",
    purple: "#b88aef",
    gray: "#d9dedc",
  })[c] || "#7ddfc4";
const cname = (id) =>
  id === "hidden"
    ? "隐藏手牌"
    : CITIES[id]?.zh ||
      (id?.startsWith("event:")
        ? EVENTS[id.slice(6)]?.[0]
        : id?.startsWith("mutation")
          ? "突变"
          : id?.startsWith("epidemic")
            ? "疫情"
            : id);
const cp = (id) => CITIES[id]?.color;
const dishes = {
  sample1: "采样皿 ①",
  sample2: "采样皿 ②",
  centrifuge: "离心皿",
  separator: "分离皿",
  growth: "培养皿",
  line0: "研究线 ①",
  line1: "研究线 ②",
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
  if (!res.ok) throw Error(data.error || "请求失败");
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
    $("#connection").textContent = "● 已同步 · " + session.code;
  };
  stream.onerror = () => {
    $("#connection").textContent = "○ 重新连接中…";
  };
}
function saveSession(token, code) {
  session = { token, code };
  localStorage.setItem("pandemic.session", JSON.stringify(session));
  connect();
}
function showHome() {
  room = null;
  app.innerHTML = `<section class="home"><div class="intro"><div class="eyebrow">COOPERATE · CONTAIN · CURE</div><h1>世界的命运，<br>在你们手中。</h1><p>四种疾病正在全球蔓延。与伙伴共享知识、控制疫情、研发解药，在一切失控前完成任务。</p><div class="statrow"><div><b>48</b><small>座互联城市</small></div><div><b>1–4</b><small>位在线玩家</small></div><div><b>04</b><small>可组合挑战</small></div></div><p class="helper">单人可操控2–4名角色；多人各自控制自己的角色。服务器统一结算规则，支持刷新重连。</p></div><div><section class="panel"><h2>建立指挥中心</h2><p>创建房间，邀请伙伴一起作战。</p><input id="create-name" maxlength="24" placeholder="你的昵称" autocomplete="nickname"><button id="create" class="primary">创建房间 →</button></section><section class="panel"><h2>加入行动</h2><input id="join-name" maxlength="24" placeholder="你的昵称"><input id="join-code" maxlength="6" placeholder="6位房间码" value="${esc(new URLSearchParams(location.search).get("room") || "")}" style="text-transform:uppercase;letter-spacing:3px"><button id="join">加入房间</button></section>${session ? '<button id="resume">恢复上次房间 ' + esc(session.code) + "</button>" : ""}<button id="import-session" style="margin-top:12px">导入重连凭据</button><input type="file" id="session-file" accept="application/json" hidden></div></section><div class="footer-note">非官方爱好者实现 · 原创界面与地图绘制 · Pandemic © Z-Man Games / Asmodee</div>`;
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
      if (!file || file.size > 10000) throw Error("凭据文件无效");
      const data = JSON.parse(await file.text());
      if (
        !/^[A-Z2-9]{6}$/.test(data.code) ||
        typeof data.token !== "string" ||
        data.token.length > 200
      )
        throw Error("凭据文件格式无效");
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
  return `<div class="roomhead"><h2>协作房间</h2><span class="roomcode">${esc(room.code)}</span><button id="copy-room">复制邀请</button><small>${room.members.length}/4 位玩家</small><button id="leave">返回首页</button></div>`;
}
function bindHead() {
  $("#copy-room").onclick = async () => {
    try {
      await navigator.clipboard.writeText(
        location.origin + "/?room=" + room.code,
      );
      toast("邀请链接已复制");
    } catch {
      toast("房间码：" + room.code);
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
    `<div class="lobby"><section class="panel"><div class="eyebrow">RESPONSE TEAM</div><h2>防疫小组</h2><p>至少2名角色。一个人可以操控多个角色；其他玩家加入时会获得自己的角色。</p>${room.seats
      .map(
        (p, i) =>
          `<div class="seat"><span class="dot" style="background:${["#7ce2cc", "#f1ae6a", "#ca99ed", "#e982ae"][i]}"></span><div><b>${esc(p.name)}</b><br><small>${p.owner === room.you ? "由你操控" : room.members.find((m) => m.id === p.owner)?.online ? "已连接" : "等待连接"}</small></div><select data-seat="${p.id}" ${p.owner !== room.you ? "disabled" : ""}><option value="">随机职业</option>${Object.entries(
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
            )}</select>${host && p.owner === room.you && room.seats.length > 1 ? `<button data-remove="${p.id}" aria-label="移除角色">×</button>` : ""}</div>`,
      )
      .join(
        "",
      )}${host && room.seats.length < 4 ? '<button id="add-seat">＋ 添加我操控的角色</button>' : ""}<p class="helper">职业能力可在右侧“规则速查”中查看。请选择不重复的职业，或保留随机。</p>${host ? `<button id="start" class="primary" ${room.seats.length < 2 ? "disabled" : ""}>开始行动 →</button>` : "<p>等待房主开始游戏…</p>"}</section><section class="panel"><div class="eyebrow">MISSION PARAMETERS</div><h2>难度与挑战</h2><div class="setting"><label>疫情牌数量 <select id="epidemics" ${host ? "" : "disabled"}>${[4, 5, 6, 7].map((n) => `<option ${o.epidemics === n ? "selected" : ""} value="${n}">${n} 张 · ${["入门", "标准", "英雄", "传奇"][n - 4]}</option>`).join("")}</select></label><small>7张是 On the Brink 的传奇难度；不是额外的独立疾病。</small></div>${[
      [
        "virulent",
        "强毒株 · Virulent Strain",
        "疫情牌带有特殊效果；第一场疫情选定强毒株。",
      ],
      [
        "mutation",
        "突变 · Mutation",
        "加入紫色第五疾病与突变卡；默认使用原始12方块规则。",
      ],
      [
        "lab",
        "实验室 · In the Lab",
        "采样、处理、定性、填充序列、测试，协作完成研发。",
      ],
      [
        "expansionCards",
        "扩展职业与事件",
        "加入 On the Brink / In the Lab 职业与事件、2种新强毒株效果；每个角色随机加入2张事件。",
      ],
      [
        "worldwide",
        "Worldwide Panic 变体",
        "使用24个紫色方块、额外初始感染及变体研发条件；需要开启突变。",
      ],
    ]
      .map(
        ([k, n, d]) =>
          `<div class="setting"><label><input type="checkbox" data-option="${k}" ${o[k] ? "checked" : ""} ${!host || (k === "worldwide" && !o.mutation) ? "disabled" : ""}>${n}</label><small>${d}</small></div>`,
      )
      .join(
        "",
      )}<p class="helper">强毒株、突变、实验室可任意叠加。单人采用多角色合作方式；不使用CDC单角色变体。</p></section></div>`;
  bindHead();
  document
    .querySelectorAll("[data-seat]")
    .forEach(
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
    document
      .querySelectorAll("[data-option]")
      .forEach(
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
  `<button class="card ${selectedCards.has(c) && p.id === actor ? "picked" : ""}" style="--c:${color(cp(c))}" data-card="${esc(c)}" data-owner="${p.id}" title="${esc(CITIES[c] ? CITIES[c].name : EVENTS[c.slice(6)]?.[1])}">${esc(cname(c))}</button>`;
function mapSVG(g) {
  const selected = selectedCity;
  let lines = EDGES.map(([a, b]) => {
    const ca = CITIES[a],
      cb = CITIES[b],
      hot =
        (ADJ[selected]?.includes(a) && selected === b) ||
        (ADJ[selected]?.includes(b) && selected === a);
    const wrap = Math.abs(ca.x - cb.x) > 800;
    return wrap
      ? `<path class="route wrap ${hot ? "hot" : ""}" d="M${ca.x} ${ca.y} L${ca.x < cb.x ? 0 : 1420} ${ca.y - 25} M${cb.x} ${cb.y} L${cb.x < ca.x ? 0 : 1420} ${cb.y - 25}"/>`
      : `<line class="route ${hot ? "hot" : ""}" x1="${ca.x}" y1="${ca.y}" x2="${cb.x}" y2="${cb.y}"/>`;
  }).join("");
  const grid =
    Array.from(
      { length: 15 },
      (_, i) =>
        `<line class="map-grid" x1="${i * 100}" y1="0" x2="${i * 100}" y2="690"/>`,
    ).join("") +
    Array.from(
      { length: 8 },
      (_, i) =>
        `<line class="map-grid" x1="0" y1="${i * 100}" x2="1420" y2="${i * 100}"/>`,
    ).join("");
  const land = `<path class="land" d="M40 90L110 60 240 60 330 85 390 145 370 220 320 280 280 315 270 390 230 370 170 310 80 280 45 190ZM320 390L415 390 490 450 470 510 420 575 325 635 295 565 280 465ZM510 70L650 60 730 95 775 140 720 190 700 270 585 280 510 230 525 170ZM550 295L700 280 775 360 740 475 690 580 630 525 610 470 555 390ZM750 85L1030 65 1245 95 1340 190 1280 300 1200 345 1170 420 1100 460 1060 410 990 480 920 390 820 330 770 220ZM1165 550L1290 545 1380 600 1360 660 1220 655 1180 610"/>`;
  const cities = Object.values(CITIES)
    .map((c) => {
      const b = g.board[c.id],
        cs = COLORS.filter((x) => b[x] > 0),
        pawns = g.players.filter((p) => p.city === c.id);
      return `<g class="city ${c.id === selected ? "selected" : ""}" data-city="${c.id}" role="button" tabindex="0" aria-label="${c.zh} ${cs.map((x) => CN[x] + b[x]).join(" ")}" transform="translate(${c.x},${c.y})"><title>${esc(c.zh + " / " + c.name + "\n相邻：" + ADJ[c.id].map((n) => CITIES[n].zh).join("、"))}</title><circle class="ring" r="9" stroke="${color(c.color)}"/>${g.stations.includes(c.id) ? '<text class="station" x="-8" y="-16">⌂</text>' : ""}<text class="name" x="13" y="-4">${c.zh}</text><text class="en" x="13" y="7">${c.name.toUpperCase()}</text>${cs.map((x, i) => `<g transform="translate(${i * 21 - 9},14)"><rect width="18" height="14" rx="3" fill="${color(x)}"/><text class="cube-label" x="9" y="11" text-anchor="middle">${b[x]}</text></g>`).join("")}${pawns.map((p, i) => `<path class="pawn" fill="${["#7ce2cc", "#f1ae6a", "#ca99ed", "#e982ae"][g.players.indexOf(p)]}" transform="translate(${i * 12 - 6},${cs.length ? 34 : 15})" d="M1 0a4 4 0 1 1 8 0L11 12H-1Z"/>`).join("")}</g>`;
    })
    .join("");
  return `<svg viewBox="0 0 1420 690" xmlns="http://www.w3.org/2000/svg" aria-label="Pandemic 48城市地图">${grid}${land}<g>${lines}</g>${cities}<text x="25" y="650" fill="#537984" font-size="11" letter-spacing="4">GLOBAL RESPONSE NETWORK · 48 CITIES / 93 ROUTES</text></svg>`;
}
function renderLab(g) {
  if (!g.lab) return "";
  return `<section class="panel lab"><div class="eyebrow">IN THE LAB · 共同研究</div><h2>实验室</h2><div class="dishes">${DISHES.map(
    (d) =>
      `<div class="dish"><h3>${dishes[d]}</h3>${
        COLORS.filter((c) => g.lab.dishes[d][c])
          .map(
            (c) =>
              `<span class="chip" style="--c:${color(c)}">${CN[c]} ${g.lab.dishes[d][c]}</span>`,
          )
          .join("") || "<small>空皿</small>"
      }</div>`,
  ).join(
    "",
  )}</div><p class="helper">采样皿 → 离心（保留一种色）／分离（每色1个） → 培养（翻倍）／序列。每次沿一条路径移动整皿，剩余未使用方块回供应。</p><div class="researchlines">${g.lab.lines.map((l, i) => (l ? `<div class="researchline"><h3>研究线 ${i + 1} <small>SEQUENCE ${l.sequence + 1}</small></h3><small>支持：${SEQUENCES[l.sequence].eligible.map((c) => CN[c]).join(" / ")}</small><div class="slots">${SEQUENCES[l.sequence].slots.map((c, j) => `<span class="slot ${l.filled[j] ? "filled" : ""}" style="--c:${color(c === "gray" && l.color ? l.color : c)};--fill:${color(l.filled[j])}" title="${c === "gray" ? "所研发疾病颜色" : CN[c]}${l.filled[j] ? "，已填" + CN[l.filled[j]] : ""}">${l.filled[j] ? "✓" : c === "gray" ? "?" : ""}</span>`).join("")}</div><small>${l.color ? "定性：" + CN[l.color] + " · " + cname(l.character) : "尚未定性"}<br>${l.test ? "已测试 · " + cname(l.test) : "尚未测试"}</small></div>` : `<div class="researchline"><h3>研究线 ${i + 1}</h3><p class="helper">空闲。建立至少2个研究站后，通过测序放入序列牌。</p></div>`)).join("")}</div></section>`;
}
function renderGame() {
  captureDraft();
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
      !room.approval,
    colors = g.options.mutation ? COLORS : COLORS.slice(0, 4);
  app.innerHTML =
    roomHead() +
    `${g.status !== "playing" ? `<div class="outcome ${g.status}"><h2>${g.status === "won" ? "行动成功 · 人类的胜利" : "行动结束 · 疫情失控"}</h2>${esc(g.reason)}</div>` : ""}<div class="gamehead"><h2>全球态势</h2><span class="pill">${g.phase === "actions" ? "行动阶段" : g.phase === "draw" ? "玩家抽牌" : "感染城市"}</span><div class="right">${g.options.virulent ? '<span class="pill">强毒株</span>' : ""}${g.options.mutation ? '<span class="pill">突变' + (g.options.worldwide ? " WWP" : "") + "</span>" : ""}${g.options.lab ? '<span class="pill">实验室</span>' : ""}</div></div>${room.approval ? approvalHTML() : ""}<div class="dashboard"><div class="boardwrap"><div class="metrics"><div class="metric"><label>OUTBREAKS · 爆发</label><b style="color:${g.outbreaks >= 5 ? "#f98989" : "#dbe8ee"}">${g.outbreaks}<span> / 8</span></b></div><div class="metric"><label>INFECTION · 感染率</label><b>${g.effects.travelBan ? 1 : [2, 2, 2, 3, 3, 4, 4][g.rate]}<span> 张 / 回合</span></b></div><div class="metric"><label>PLAYER DECK · 玩家牌</label><b>${g.playerDeckCount}<span> 张剩余</span></b></div><div class="metric"><label>RESEARCH · 研究站</label><b>${g.stations.length}<span> / 6</span></b></div></div><div class="boardframe">${mapSVG(g)}<div class="mapfooter"><span>⌂ 研究站</span>${g.players.map((p, i) => `<span style="color:${["#7ce2cc", "#f1ae6a", "#ca99ed", "#e982ae"][i]}">● ${esc(p.name)}</span>`).join("")}<span>点击城市查看连线与行动目标</span></div></div><div class="diseases">${colors.map((c) => `<div class="disease"><b style="color:${color(c)}"><span class="square" style="--c:${color(c)}"></span>${CN[c]} ${g.strain === c ? "· 强毒株" : ""}</b><small>${g.eradicated[c] ? "已根除" : g.cures[c] ? "已治愈" : "尚无解药"} · 供应 ${g.supply[c]}</small></div>`).join("")}</div>${renderLab(g)}<div class="playerlist">${g.players
      .map(
        (q) =>
          `<section class="playercard ${q.id === turn.id ? "active" : ""}"><h3>${esc(q.name)} <small>· ${ROLES[q.role][0]} ${own(q) ? "（你）" : ""}</small></h3><div class="meta"><span>${CITIES[q.city].zh}</span><span>${q.hand.length}/${q.role === "archivist" ? 8 : 7} 张手牌</span></div><div class="cards">${q.hand.map((c) => cardHTML(c, q)).join("")}${q.stored ? cardHTML(q.stored, q) : ""}</div>${
            COLORS.some((c) => q.samples[c])
              ? `<div class="helper">现场样本：${COLORS.filter(
                  (c) => q.samples[c],
                )
                  .map((c) => CN[c] + q.samples[c])
                  .join(" / ")}</div>`
              : ""
          }<div class="helper">${ROLES[q.role][1]}</div></section>`,
      )
      .join(
        "",
      )}</div><div class="decklinks"><button data-deck="infectionDiscard">感染弃牌 ${g.infectionDiscard.length}</button><button data-deck="playerDiscard">玩家弃牌 ${g.playerDiscard.length}</button><button data-deck="infectionRemoved">已移除感染牌 ${g.infectionRemoved.length}</button>${g.peek ? '<button data-deck="peek">应变专家 · 查看感染牌</button>' : ""}<button id="credentials">保存重连凭据</button></div></div><aside class="sidebar"><section class="panel"><div class="eyebrow">YOUR RESPONSE</div><div class="turnname">${esc(turn.name)}的回合</div><small>${ROLES[turn.role][0]} · ${CITIES[turn.city].zh}</small><div class="actiondots">${Array.from({ length: Math.max(g.actions, turn.role === "generalist" ? 5 : 4) }, (_, i) => `<i class="${i < g.actions ? "live" : ""}"></i>`).join("")}</div><p class="helper">${g.phase === "actions" ? g.actions + " 次行动剩余" : g.phase === "draw" ? "逐张结算突变、疫情，再处理手牌上限。" : "待感染 " + g.infectionLeft + " 张。可在各次感染之间使用事件。"}</p><label>操作角色 <select id="actor">${g.players
      .filter(own)
      .map(
        (q) =>
          `<option value="${q.id}" ${q.id === actor ? "selected" : ""}>${esc(q.name)} · ${ROLES[q.role][0]}</option>`,
      )
      .join("")}</select></label>${
      g.status === "playing"
        ? `<div class="control-grid" style="margin-top:14px">${[["move", "移动"], ["treat", "治疗"], ["build", "建立研究站"], ["share", "共享知识"], ["cure", "研发解药"], ["role", "职业能力"], ...(g.lab ? [["lab", "实验室"]] : []), ["event", "事件卡"], ["discard", "超限弃牌"]].map(([k, n]) => `<button data-mode="${k}" ${["event", "discard"].includes(k) || (k === "role" && p.role === "field_operative") ? "" : (!can && !(k === "role" && mine && g.phase === "actions")) || actor !== turn.id ? "disabled" : ""}>${n}</button>`).join("")}</div>${g.pending ? pendingHTML(g, p) : `<button id="advance" class="${mine ? "primary" : ""}" style="width:100%;margin-top:12px" ${!mine || actor !== turn.id || room.approval ? "disabled" : ""}>${g.phase === "actions" ? "结束行动 → 抽牌" : g.phase === "draw" && g.drawQueue.length ? "结算 " + cname(g.drawQueue[0]) : g.phase === "draw" ? "开始感染阶段" : g.infectionLeft ? "结算下一张感染" : "交给下一位角色"} →</button>`}${
            g.phase === "draw" &&
            g.drawQueue.filter((c) => c.startsWith("mutation:")).length > 1
              ? '<label>突变结算顺序</label><select id="resolve-card">' +
                g.drawQueue
                  .filter((c) => c.startsWith("mutation:"))
                  .map((c) =>
                    opt(
                      c,
                      {
                        threatens: "突变威胁：底部城市3个紫色",
                        spreads: "突变扩散：底部3城各1个紫色",
                        intensifies: "突变增强：有2个紫色的城市增加1个",
                      }[c.slice(9)],
                    ),
                  )
                  .join("") +
                "</select>"
              : ""
          }${renderForm(g, p)}`
        : ""
    }</section><section class="panel"><div class="eyebrow">SELECTED CITY</div><div class="selectedcity">${CITIES[selectedCity].zh}</div><div class="citydetail">${CITIES[selectedCity].name} · ${CN[cp(selectedCity)]}<br>${
      COLORS.filter((c) => g.board[selectedCity][c])
        .map(
          (c) =>
            `<span class="chip" style="--c:${color(c)}">${CN[c]} ${g.board[selectedCity][c]}</span>`,
        )
        .join("") || "暂无疾病方块"
    }<br>连接 ${ADJ[selectedCity].map((id) => `<a href="#" data-select-city="${id}" style="color:${color(cp(id))}">${CITIES[id].zh}</a>`).join("、")}</div></section>${g.strain ? `<section class="panel"><h3 style="color:${color(g.strain)}">强毒株 · ${CN[g.strain]}</h3><div class="helper">${g.strainEffects.map((x) => STRAINS[x][0]).join(" · ") || "暂无持续效果"}</div><button id="strain-help" style="margin-top:12px">查看效果</button></section>` : ""}<section class="panel"><div class="eyebrow">OPERATION LOG</div><div class="log">${[
      ...g.log,
    ]
      .reverse()
      .map((l) => `<div>${esc(l)}</div>`)
      .join("")}</div></section></aside></div>`;
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
    Object.values(CITIES).map((c) => [c.id, c.zh]),
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
    (g.options.mutation ? COLORS : COLORS.slice(0, 4)).map((c) => [c, CN[c]]),
    cp(selectedCity),
  );
const handcards = (p, id = "card") =>
  select(
    id,
    p.hand.filter((c) => CITIES[c]).map((c) => [c, cname(c)]),
    [...selectedCards][0],
  );
const cityCardsHint = (p) =>
  `<p class="helper">已选择 ${selectedCards.size} 张城市牌。在下方自己的手牌上点击选择，再提交研发。${[...selectedCards].map((c) => cname(c)).join("、")}</p>`;
function labFields(g, p, op = "characterize") {
  return (
    field(
      "实验室行动",
      select(
        "op",
        [
          ["characterize", "定性疾病"],
          ["process", "处理样本"],
          ["test", "测试解药"],
          ["sequence", "测序／替换序列"],
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
        "移动方式",
        select(
          "moveMode",
          [
            ["drive", "驾车／渡船"],
            ["direct", "直飞（弃目的地牌）"],
            ["charter", "包机（弃出发城市牌）"],
            ["shuttle", "穿梭（研究站之间）"],
            ...(p.role === "dispatcher"
              ? [["dispatch", "调度至另一角色所在城市"]]
              : []),
            ...(p.role === "operations_expert"
              ? [["operations", "行动专家飞行"]]
              : []),
            ...(p.role === "pilot" ? [["pilot", "飞行员：最多3条连线"]] : []),
          ],
          p.role === "pilot" ? "pilot" : "drive",
        ),
      ) +
      field(
        "被移动角色",
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
      field("目的地（也可点击地图）", cities()) +
      field("行动专家支付牌", handcards(p)) +
      field(
        "飞行员搭载同伴（可选）",
        select(
          "passenger",
          [
            ["", "不搭载"],
            ...g.players
              .filter((q) => q.id !== p.id && q.city === p.city)
              .map((q) => [q.id, q.name]),
          ],
          "",
        ),
      ) +
      field(
        "流动医院移除颜色",
        select(
          "color",
          [["", "自动选择一种"], ...COLORS.map((c) => [c, CN[c]])],
          "",
        ),
      );
  if (mode === "treat")
    html =
      field(
        "治疗城市",
        cities(
          p.city === selectedCity || p.role === "field_director"
            ? selectedCity
            : p.city,
        ),
      ) +
      field("疾病颜色", colors(g)) +
      (g.lab
        ? field(
            "采集1个样本（可选）",
            select(
              "sample",
              [
                ["", "不采集"],
                ["sample1", "采样皿 ①"],
                ["sample2", "采样皿 ②"],
              ],
              "",
            ),
          )
        : "");
  if (mode === "build")
    html =
      '<p class="helper">在当前城市建站。行动专家无需城市牌；其他角色须弃当前城市牌。</p>' +
      field(
        "6站已用完时，选择迁走的研究站",
        select(
          "replace",
          g.stations.map((c) => [c, cname(c)]),
        ),
      );
  if (mode === "share")
    html =
      field("同城伙伴", players(g)) +
      field(
        "方向",
        select(
          "direction",
          [
            ["give", "我给予"],
            ["take", "我拿取"],
          ],
          "give",
        ),
      ) +
      field(
        "共享城市牌",
        select(
          "card",
          Object.values(CITIES).map((c) => [c.id, c.zh]),
          [...selectedCards][0],
        ),
      );
  if (mode === "cure")
    html =
      field("研发疾病", colors(g)) +
      cityCardsHint(p) +
      (p.role === "field_operative"
        ? '<label class="inline-check"><input type="checkbox" id="f-useSamples">用3个现场样本替换2张城市牌</label>'
        : "") +
      '<p class="helper">基础需5张同色牌；科学家4张。实验室完成研究线后需3张，科学家2张。强毒株与测序突破会修正数量。</p>';
  if (mode === "lab") html = labFields(g, p);
  if (mode === "role") {
    if (["archivist", "researcher"].includes(p.role))
      html = `<p class="helper">${ROLES[p.role][1]}</p>`;
    else if (p.role === "contingency_planner")
      html = field(
        "回收事件",
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
          "能力",
          select(
            "op",
            [
              ["take", "免费取得同城城市牌"],
              ...(g.lab ? [["process", "免费处理实验室样本"]] : []),
            ],
            "take",
          ),
        ) + '<div id="role-detail"></div>';
    else if (p.role === "field_operative")
      html =
        field(
          "能力",
          select(
            "op",
            [
              ["sample", "采集1个现场样本"],
              ["return", "归还1个现场样本"],
            ],
            "sample",
          ),
        ) + field("颜色", colors(g));
    else if (p.role === "field_director")
      html = field("移动同伴", players(g)) + field("目的地", cities());
    else if (p.role === "virologist")
      html =
        field("弃置城市牌", handcards(p)) +
        field("远程移除方块的城市", cities());
    else if (p.role === "local_liaison")
      html =
        field(
          "能力",
          select(
            "op",
            [
              ["give", "远程给牌"],
              ...(g.lab
                ? [
                    ["characterize", "免费定性"],
                    ["test", "免费测试"],
                  ]
                : []),
            ],
            "give",
          ),
        ) + '<div id="role-detail"></div>';
    else
      html =
        '<p class="helper">该职业能力自动生效，或在移动／治疗等操作中使用。</p>';
  }
  if (mode === "event") {
    const events = [...p.hand, ...(p.stored ? [p.stored] : [])].filter((c) =>
      c.startsWith("event:"),
    );
    html =
      field(
        "可使用事件",
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
        "选择超限弃牌",
        select(
          "card",
          p.hand.map((c) => [c, cname(c)]),
        ),
      ) +
      '<p class="helper">只能在超过手牌上限时弃牌。也可使用事件减少手牌。</p>';
  return `<form id="action-form" class="actionform" data-draft-key="${actor}:${mode}"><h3>${{ move: "移动角色", treat: "治疗疾病", build: "建立研究站", share: "共享知识", cure: "发现解药", lab: "实验室行动", role: "职业能力", event: "使用事件", discard: "处理手牌上限" }[mode]}</h3>${html}<button class="primary" type="submit">确认操作</button><button id="cancel-form" type="button">收起</button></form>`;
}
function processFields() {
  return (
    field(
      "源培养皿",
      select(
        "from",
        DISHES.map((d) => [d, dishes[d]]),
        "sample1",
      ),
    ) +
    field(
      "目标",
      select(
        "to",
        ["centrifuge", "separator", "growth", "line0", "line1"].map((d) => [
          d,
          dishes[d],
        ]),
        "centrifuge",
      ),
    ) +
    field("离心保留颜色", colors(room.game)) +
    field(
      "序列分配",
      select(
        "allocationMode",
        [
          ["auto", "自动尽量填满"],
          ["manual", "逐格指定"],
        ],
        "auto",
      ),
    ) +
    `<div id="allocation"></div><p class="helper">处理到研究线时默认自动分配；也可逐格指定。未使用的方块返回供应。</p>`
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
        "序列分配（逐格选择）",
        SEQUENCES[l.sequence].slots
          .map(
            (c, i) =>
              `<label>第${i + 1}格 · ${c === "gray" ? CN[l.color] : CN[c]}${l.filled[i] ? "（已填）" : ""}${select("alloc-" + i, [["", "不填"], ...COLORS.map((c) => [c, CN[c]])], "")}</label>`,
          )
          .join(""),
      )
    : '<p class="helper">该研究线尚未定性。</p>';
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
        "研究线",
        select(
          "line",
          g.lab.lines.map((l, i) => [String(i), "研究线 " + (i + 1)]),
          "0",
        ),
      ) +
      (op === "characterize" ? field("研发疾病", colors(g)) : "") +
      field("支付城市牌", handcards(p)) +
      (op === "test" ? field("测试移除方块的城市", cities()) : "");
  if (op === "sequence")
    html =
      '<p class="helper">抽取序列牌后，选择替换研究线、开启下方研究线（至少2站），或弃置抽到的序列牌。</p>';
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
      field("伙伴", players(g)) +
      field(
        "城市牌",
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
        cname(id) + " · " + CN[c] + " (" + b[c] + ")",
      ]),
    );
  return (
    field("移除方块 ①", select("remove0", choices)) +
    field(
      "移除方块 ②",
      select("remove1", [...(cured ? [["", "不移除"]] : []), ...choices]),
    ) +
    (cured
      ? [2, 3, 4]
          .map((i) =>
            field(
              "移除方块 " + (i + 1),
              select("remove" + i, [["", "不移除"], ...choices], ""),
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
    html += field("目标角色", players(g));
  if (["airlift", "government_grant"].includes(id))
    html += field("目的城市", cities());
  if (id === "government_grant")
    html += field(
      "6站时迁走",
      select(
        "replace",
        g.stations.map((c) => [c, cname(c)]),
      ),
    );
  if (id === "resilient_population")
    html += field(
      "移出游戏的感染城市牌",
      select(
        "card",
        g.infectionDiscard.filter((c) => CITIES[c]).map((c) => [c, cname(c)]),
      ),
    );
  if (id === "reexamined_research")
    html += field(
      "回收城市牌",
      select(
        "card",
        g.playerDiscard.filter((c) => CITIES[c]).map((c) => [c, cname(c)]),
      ),
    );
  if (id === "new_assignment")
    html += field(
      "新职业",
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
    return `<div class="helper">疫情感染已完成。此时可使用“人口韧性”，然后强化感染牌库。</div><button id="advance" class="primary" style="width:100%;margin-top:12px" ${own(active()) && actor === active().id ? "" : "disabled"}>完成疫情强化 →</button>`;
  if (!owns)
    return '<p class="helper">等待其他玩家完成 ' + esc(q.type) + " 选择…</p>";
  if (q.type === "bonusLab")
    return '<div class="helper">建站奖励：立即免费进行一次实验室行动（无需身处研究站）。</div><button id="bonus-lab">选择奖励行动</button> <button id="skip-bonus">跳过奖励</button>';
  if (q.type === "sequence")
    return `<div class="helper">抽到序列 ${q.sequence + 1}：${SEQUENCES[q.sequence].slots.map((c) => (c === "gray" ? "所研发疾病" : CN[c])).join(" / ")}<br>支持：${SEQUENCES[q.sequence].eligible.map((c) => CN[c]).join("、")}</div><button id="place-sequence">放置／弃置序列</button>`;
  if (q.type === "forecast")
    return '<button id="order-forecast">重排预测感染牌</button>';
  return "";
}
function approvalHTML() {
  const a = room.approval,
    g = room.game,
    p = g.players.find((p) => p.id === a.actor);
  return `<div class="approval"><p>${esc(p.name)} 请求协作确认</p><div class="consent-action">${describeAction(a.action, g)}</div>${a.needed.includes(room.you) && !a.approved.includes(room.you) ? '<button id="accept">同意</button>' : ""}<button id="reject">${a.needed.includes(room.you) ? "拒绝" : "取消请求"}</button><small>所有受影响玩家同意后执行；等待期间牌局暂停。</small></div>`;
}
function describeAction(a, g) {
  const target = g.players.find((p) => p.id === (a.player || a.pawn));
  return esc(
    (a.type === "move"
      ? "移动"
      : a.type === "share"
        ? "共享知识"
        : a.type === "event"
          ? EVENTS[a.event]?.[0]
          : "职业能力") +
      " · " +
      (target?.name || "") +
      " " +
      (a.to ? cname(a.to) : "") +
      " " +
      (a.card ? cname(a.card) : "") +
      (a.direction === "take" ? "（拿取）" : ""),
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
              (CITIES[e.dataset.card]?.name || "伙伴的事件"),
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
              infectionDiscard: "感染弃牌",
              playerDiscard: "玩家弃牌",
              infectionRemoved: "移除的感染城市",
              peek: "应变专家查看（保持原顺序）",
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
    toast("请私下保存凭据；不要发给其他玩家。");
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
    `<h2>序列 ${s.id + 1}</h2><p>${s.slots.map((c) => (c === "gray" ? "研发颜色" : CN[c])).join(" · ")}</p><p>可研发：${s.eligible.map((c) => CN[c]).join("、")}</p><div class="choice"><button data-seq="0">替换／放入研究线 ①</button><button data-seq="1" ${room.game.stations.length < 2 && !room.game.lab.lines[1] ? "disabled" : ""}>替换／放入研究线 ②</button><button data-seq="discard">弃置</button></div><p class="helper">替换时保留仍兼容的定性、测试与方块；方块会优先填充严格颜色格，再填通配格。</p>`,
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
      "<h2>预测 · 从上到下为抽牌顺序</h2>" +
        forecastOrder
          .map(
            (c, i) =>
              `<div class="choice"><span>${i + 1}. ${esc(cname(c))}</span><button data-up="${i}" ${i === 0 ? "disabled" : ""}>↑</button><button data-down="${i}" ${i === forecastOrder.length - 1 ? "disabled" : ""}>↓</button></div>`,
          )
          .join("") +
        '<button id="finish-forecast" class="primary">确认顺序</button>',
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
    `<div class="ruletext"><h2>规则与操作速查</h2><h3>回合与胜负</h3><p>每名角色通常4次行动，然后抽2张玩家牌，再按感染率逐张感染。右侧“继续”按钮推进结算；每张牌的结算不可中断。8次爆发、需要放置方块时供应不足、玩家牌不足以抽2张时失败。四种解药即胜；Mutation还需研发紫色解药，或在四种原疾病治愈时地图上没有紫色方块。</p><h3>移动与共享知识</h3><p>驾车沿地图连线；直飞弃目的地牌；包机弃出发城市牌；穿梭需两端都有研究站。共享知识需要同城，并转移所在城市牌；研究员给予时可用任意城市牌。其他玩家的移动、给牌和换职业需要其明确确认。</p><h3>手牌、事件与疫情</h3><p>手牌上限7，档案管理员8。入门难度手牌公开；5–7张疫情难度仅自己可见，需沟通共享的具体城市牌。只能在超限时弃牌。事件不花行动，可在各次行动或各张牌结算之间使用；疫情感染与强化之间仅“人口韧性”可使用。预测、测序及建站奖励须先完成选择。</p><h3>实验室</h3><p>治疗行动移除的方块中最多采样1个。实验室操作通常需要研究站，每次1行动。定性用匹配序列药瓶颜色的城市牌；紫色须对应城市有紫色方块。处理移动整皿，沿一个箭头；离心保留一种颜色，分离每色保留1个，培养翻倍；处理到已定性序列时按格分配，余下回供应。灰格匹配研发颜色；已根除颜色的印刷格允许任意色。填入至少1个方块后可测试：支付匹配城市牌并移除地图上该疾病1方块。全部填满、已测试后，在站内用3张匹配城市牌发现解药（科学家2张）。建站奖励1次免费实验室行动；至少2站才能通过测序启用下方线。</p><h3>职业</h3>${Object.entries(
      ROLES,
    )
      .map(([id, [n, d]]) => `<p><b>${n}</b>：${d}</p>`)
      .join("")}<h3>强毒株持续效果</h3>${[
      ["chronic_effect", "正常感染到该色城市且没有该色方块时放2个，否则1个。"],
      [
        "complex_molecular_structure",
        "研发强毒株多需1张城市牌；实验室从3张算起。",
      ],
      [
        "government_interference",
        "要离开有强毒株的城市，当前操作者须本回合先治疗该城市强毒株。",
      ],
      ["rate_effect", "感染阶段抽到强毒株城市，且未根除，恰好额外抽1张。"],
      ["slippery_slope", "每次该色爆发增加2点爆发值。"],
      ["highly_contagious", "原发爆发向邻城放2个；连锁爆发仍放1个。"],
      ["resistant_to_treatment", "治愈前，治疗强毒株须在同一回合花2行动。"],
    ]
      .map(([id, d]) => `<p><b>${STRAINS[id][0]}</b>：${d}</p>`)
      .join(
        "",
      )}<h3>参考与范围</h3><p>实现基础版、4–7张疫情、Virulent Strain、原始Mutation、In the Lab和Worldwide Panic；不含生化恐怖分子、队伍模式与CDC单角色变体。单人通过多角色游玩。</p><p><a target="_blank" rel="noreferrer" href="https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/Pandemic_Rulebook.pdf">基础版官方规则</a> · <a target="_blank" rel="noreferrer" href="https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/On-the-Brink_Rules_Web.pdf">On the Brink</a> · <a target="_blank" rel="noreferrer" href="https://cdn.svc.asmodee.net/production-zman/uploads/2024/09/In-the-Lab_Rules_Web.pdf">In the Lab</a></p></div>`,
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
