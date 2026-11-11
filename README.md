# Pandemic Command

A self-hosted web implementation of Pandemic for one to four people. It uses an original board illustration and interface. The Node server handles the rules and keeps players in sync.

## Run locally

Install Node.js 22 or 24 and run the following commands at the repository root.

```bash
npm ci
npm start
```

Open <http://localhost:3000>. Create a room, then share the room code or invitation link with the other players.

```bash
npm run build  # Check source syntax and required files.
npm test       # Run rules, board rendering, and HTTP/SSE integration tests.
npm run dev    # Restart the server when server files change.
```

## Deploy to Render

Push the project to the root of a GitHub repository. In Render, create a **Web Service** connected to the repository, or create a Blueprint using `render.yaml`.

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Node version | 22 or 24 |
| Root Directory | Leave empty |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |
| Instances | 1 |
| `PORT` | Supplied by Render |

The web client and server share one origin. The Blueprint uses Render's Free plan by default.

The server stores rooms in `./room-data/` and expires inactive rooms after seven days. A reconnect credential restores your identity while the server still has the room. On Render Free, redeploys and instance restarts can erase the local room files. To retain rooms across deploys, use a single paid Web Service with a persistent disk mounted at `/var/data`, and set `ROOM_DATA_DIR=/var/data/pandemic`. Keep the room data directory private because it contains reconnect tokens.

- [Render Web Services](https://render.com/docs/web-services)
- [Render Free instances](https://render.com/docs/free)
- [Render Persistent Disks](https://render.com/docs/disks)

## Play

1. Create or join a room. Choose distinct roles or leave the selection random. Set the difficulty and enable any challenge options before the host starts the game.
2. Select the role you control. Use the board to choose cities, and the action panel to move, Treat Disease, Share Knowledge, Build a Research Station, or Discover a Cure. Click matching City cards in your hand to select them for a cure.
3. End the action step when ready. Advance the draw and Infect Cities steps one card at a time. Play Event cards between steps when allowed.
4. In the Lab Challenge, select a Sample Dish when using Treat Disease to keep one cube as a sample. Use Lab Actions at a research station to Characterize a Disease, Process a Sample, Test a Cure, or Sequence a Disease. Building a research station grants a bonus Lab action.

The Outbreaks Track is to the left of the map. The Infection Deck, Infection Discard Pile, and Infection Rate Track are above the map. The Player Deck, Player Discard Pile, and Discovered Cure Indicators are below it. Click a discard pile to inspect its cards. Pawn colors follow the corresponding Role cards. Each piece on a city represents one disease cube.

Moves or exchanges that affect another player require their consent. Hands are public in the Introductory game and private at higher difficulty. In a solo game, one person controls two to four roles and sees their hands. Use the reconnect credentials file to resume your seat from a different browser. When testing multiplayer on the same computer, use separate browser profiles.

## Included rules

| Component | Scope |
| --- | --- |
| Map | 48 cities and 93 connections, including three Pacific routes |
| Base game | Seven roles, five Event cards, four diseases, and four to six Epidemic cards |
| On the Brink | Legendary difficulty with seven Epidemic cards, Virulent Strain, and Mutation |
| In the Lab | Lab Challenge with five dishes, 14 Sequence cards, two research lines, and bonus Lab actions |
| Worldwide Panic | Optional 24-cube Mutation variant |
| Expansion Roles and Events | Six On the Brink roles, four In the Lab roles, eight On the Brink Events, three In the Lab Events, and two extra Virulent Strain Epidemic cards |
| Multiplayer | One to four people controlling two to four roles, room codes, real-time updates, consent, and reconnect |

Solo play uses ordinary roles. The CDC solo variant, Bio-Terrorist Challenge, Team Game, and fifth player are outside the implementation. See [Rules and source references](docs/RULES.md).

## Source layout

| File | Purpose |
| --- | --- |
| `server.mjs` | HTTP, SSE, room state, authentication, and persistence |
| `src/engine.js` | Rule validation and state transitions |
| `src/data.js` | City names, board coordinates, and the connection graph |
| `src/catalog.js` | Roles, pawn colors, Event cards, Virulent Strain effects, and Lab components |
| `public/board.js` | Board, tracks, decks, markers, and map pieces |
| `public/app.js` | Lobby, player hands, Lab board, action controls, and reconnect |
| `public/style.css` | Interface styles and responsive layout |

`newGame(seats, options, rng?)` creates a game. `apply(state, actorId, command, rng?)` returns the next state or throws a `RuleError`. `invariants(state)` verifies disease cube totals. `view(state, memberId)` returns the information visible to that player. HTTP action requests include the room version and the player's bearer token. Stale actions return HTTP 409.

## Docker

```bash
docker build -t pandemic-command .
docker run --rm -p 3000:3000 pandemic-command
```

Mount a directory writable by the container's `node` user at `/app/room-data` to retain rooms.
