import {
  CITIES,
  ADJ,
  EDGES,
  COLORS,
  DISEASE_NAMES,
  INFECTION_RATES,
} from "../src/data.js";
import { ROLES, ROLE_PAWN_COLORS, cardName } from "../src/catalog.js";

const MAP_WIDTH = 1420;
const MAP_HEIGHT = 650;

export function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
}

export const diseaseColor = (color) =>
  ({
    blue: "#56a8ed",
    yellow: "#f5c555",
    black: "#a9b0bf",
    red: "#f36f76",
    purple: "#b88aef",
    gray: "#d9dedc",
  })[color] || "#7ddfc4";

const pieceColor = (color) =>
  color === "black" ? "#2b2d34" : diseaseColor(color);

const pacificRoutes = new Set([
  "san-francisco/tokyo",
  "manila/san-francisco",
  "los-angeles/sydney",
]);

function renderRoutes(selectedCity) {
  return EDGES.map(([first, second]) => {
    const id = [first, second].sort().join("/");
    const a = CITIES[first];
    const b = CITIES[second];
    const highlighted =
      selectedCity === first || selectedCity === second ? " hot" : "";
    const title = `<title>${a.name} – ${b.name}</title>`;
    if (!pacificRoutes.has(id)) {
      return `<line class="route${highlighted}" data-route="${id}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}">${title}</line>`;
    }

    // Interpolate across the Pacific seam. Each route meets both edges at the same height.
    const [west, east] = a.x < b.x ? [a, b] : [b, a];
    const distanceAcrossSeam = west.x + MAP_WIDTH - east.x;
    const seamY = west.y + ((east.y - west.y) * west.x) / distanceAcrossSeam;
    return `<path class="route wrap${highlighted}" data-route="${id}" data-edge="west" d="M${west.x} ${west.y} L0 ${seamY}">${title}</path>
      <path class="route wrap${highlighted}" data-route="${id}" data-edge="east" d="M${east.x} ${east.y} L${MAP_WIDTH} ${seamY}">${title}</path>`;
  }).join("");
}

function renderCube(color, x, y) {
  return `<g class="disease-cube" data-color="${color}" transform="translate(${x},${y})" fill="${pieceColor(color)}" aria-hidden="true">
    <path d="M0 3 5 0 10 3 10 10 5 13 0 10Z"/>
    <path class="cube-top" d="M0 3 5 0 10 3 5 6Z"/>
    <path class="cube-side" d="M5 6 10 3 10 10 5 13Z"/>
  </g>`;
}

function renderCity(game, city, selectedCity) {
  const cubes = game.board[city.id];
  const pawns = game.players.filter((player) => player.city === city.id);
  const presentColors = COLORS.filter((color) => cubes[color] > 0);
  const cubeSummary = presentColors.map(
    (color) => `${DISEASE_NAMES[color]} ${cubes[color]}`,
  );
  const cubePieces = presentColors
    .map((color, group) =>
      Array.from({ length: cubes[color] }, (_, index) =>
        renderCube(
          color,
          (group % 2) * 36 + index * 11 - 9,
          13 + Math.floor(group / 2) * 14,
        ),
      ).join(""),
    )
    .join("");
  const pawnPieces = pawns
    .map(
      (player, index) =>
        `<path class="pawn" data-role="${player.role}" fill="${ROLE_PAWN_COLORS[player.role]}"
      transform="translate(${index * 12 - 7},${presentColors.length ? 17 + Math.ceil(presentColors.length / 2) * 14 : 14})"
      d="M1 0a4 4 0 1 1 8 0L11 12H-1Z"><title>${escapeHTML(player.name)} · ${ROLES[player.role][0]}</title></path>`,
    )
    .join("");
  const station = game.stations.includes(city.id)
    ? '<path class="station" d="M-7 -13v-7l7-5 7 5v7Z"><title>Research station</title></path>'
    : "";
  return `<g class="city${city.id === selectedCity ? " selected" : ""}" data-city="${city.id}" role="button"
    tabindex="0" aria-label="${escapeHTML([city.name, ...cubeSummary].join(", "))}" transform="translate(${city.x},${city.y})">
    <title>${escapeHTML([city.name, ...cubeSummary, "Connected cities: " + ADJ[city.id].map((id) => CITIES[id].name).join(", ")].join("\n"))}</title>
    <circle class="ring" r="8" stroke="${diseaseColor(city.color)}"/>
    ${station}<text class="name" x="12" y="4">${city.name}</text>${cubePieces}${pawnPieces}
  </g>`;
}

function renderMap(game, selectedCity) {
  return `<svg class="city-map" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" xmlns="http://www.w3.org/2000/svg" aria-label="Map of 48 cities">
    <defs><pattern id="map-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path class="map-grid" d="M50 0H0V50" fill="none"/></pattern></defs>
    <rect width="${MAP_WIDTH}" height="${MAP_HEIGHT}" fill="url(#map-grid)"/>
    <path class="land" d="M40 90L110 60 240 60 330 85 390 145 370 220 320 280 280 315 270 390 230 370 170 310 80 280 45 190ZM320 390L415 390 490 450 470 510 420 575 325 635 295 565 280 465ZM510 70L650 60 730 95 775 140 720 190 700 270 585 280 510 230 525 170ZM550 295L700 280 775 360 740 475 690 580 630 525 610 470 555 390ZM750 85L1030 65 1245 95 1340 190 1280 300 1200 345 1170 420 1100 460 1060 410 990 480 920 390 820 330 770 220ZM1165 550L1290 545 1380 600 1360 645 1220 645 1180 610"/>
    <g class="city-connections">${renderRoutes(selectedCity)}</g>
    ${Object.values(CITIES)
      .map((city) => renderCity(game, city, selectedCity))
      .join("")}
  </svg>`;
}

function renderTrack(title, spaces, activeIndex, modifier = "") {
  return `<section class="board-track ${modifier}" aria-label="${title}">
    <h3>${title}</h3>
    <ol>${spaces
      .map(
        (value, index) =>
          `<li class="track-space${index === activeIndex ? " current" : ""}${value === 8 ? " loss-space" : ""}"
        ${index === activeIndex ? 'aria-current="step"' : ""}>${index === activeIndex ? '<i class="track-marker" aria-hidden="true"></i>' : ""}<span>${value}</span></li>`,
      )
      .join("")}</ol>
  </section>`;
}

function renderDeck(label, type, count, discard = null) {
  const topCard = discard?.at(-1);
  const detail = discard
    ? topCard
      ? cardName(topCard)
      : "Empty"
    : "Face down";
  const content = `<span class="deck-label">${label}</span><span class="deck-detail">${escapeHTML(detail)}</span><span class="deck-count">${count}</span>`;
  const css = `board-deck ${type.startsWith("infection") ? "infection-deck" : "player-deck"}${discard ? " discard-pile" : ""}`;
  return discard
    ? `<button type="button" class="${css}" data-deck="${type}" aria-label="${label}, ${count} cards">${content}</button>`
    : `<div class="${css}" aria-label="${label}, ${count} cards">${content}</div>`;
}

function renderCures(game) {
  const colors = game.options.mutation ? COLORS : COLORS.slice(0, 4);
  return `<section class="board-cures" aria-label="Discovered Cure Indicators">
    <h3>Discovered Cure Indicators</h3>
    <div class="cure-slots">${colors
      .map((color) => {
        const status = game.eradicated[color]
          ? "Eradicated"
          : game.cures[color]
            ? "Cured"
            : "No cure";
        return `<div class="cure-slot" data-disease="${color}" data-status="${status.toLowerCase()}" style="--disease-color:${pieceColor(color)}">
        <span class="cure-vial" aria-hidden="true">${game.eradicated[color] ? "⊘" : ""}</span>
        <span class="cure-color">${DISEASE_NAMES[color]}</span>
        <small>${status}</small><small>${game.supply[color]} cubes in supply</small>
        ${game.strain === color ? '<small class="virulent-label">Virulent Strain</small>' : ""}
      </div>`;
      })
      .join("")}</div>
  </section>`;
}

export function renderBoard(game, selectedCity) {
  return `<div class="boardframe" tabindex="0" aria-label="Pandemic game board">
    <div class="tabletop">
      <div class="board-top">
        <div class="infection-area">
          <div class="board-decks">
            ${renderDeck("Infection Deck", "infection", game.infectionDeckCount)}
            ${renderDeck("Infection Discard Pile", "infectionDiscard", game.infectionDiscard.length, game.infectionDiscard)}
          </div>
          ${renderTrack("Infection Rate Track", INFECTION_RATES, game.rate, "infection-track")}
          ${game.effects.travelBan ? '<small class="rate-override">Commercial Travel Ban · Effective infection rate: 1</small>' : ""}
        </div>
      </div>
      <div class="board-center">
        ${renderTrack(
          "Outbreaks Track",
          Array.from({ length: 9 }, (_, index) => index),
          Math.min(game.outbreaks, 8),
          "outbreak-track",
        )}
        ${renderMap(game, selectedCity)}
      </div>
      <div class="board-bottom">
        ${renderCures(game)}
        <div class="board-decks">
          ${renderDeck("Player Deck", "player", game.playerDeckCount)}
          ${renderDeck("Player Discard Pile", "playerDiscard", game.playerDiscard.length, game.playerDiscard)}
        </div>
      </div>
      <div class="mapfooter">
        <span>⌂ Research station</span>
        ${game.players.map((player) => `<span><i class="pawn-dot" style="--pawn-color:${ROLE_PAWN_COLORS[player.role]}"></i>${escapeHTML(player.name)} · ${ROLES[player.role][0]}</span>`).join("")}
      </div>
    </div>
  </div>`;
}
