import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  newGame,
  apply,
  view,
  requiredConsents,
  invariants,
  RuleError,
  rolePool,
} from "./src/engine.js";
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const token = () => crypto.randomBytes(24).toString("base64url");
const fail = (condition, message, status = 400) => {
  if (!condition) {
    const e = new Error(message);
    e.status = status;
    throw e;
  }
};
export function createApp({
  dataDir = process.env.ROOM_DATA_DIR,
  ttlMs = 7 * 86400000,
} = {}) {
  const rooms = new Map(),
    streams = new Map(),
    limits = new Map();
  if (dataDir) {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    for (const f of fs.readdirSync(dataDir)) {
      if (!/^[A-Z2-9]{6}\.json$/.test(f)) continue;
      try {
        const room = JSON.parse(fs.readFileSync(path.join(dataDir, f)));
        if (room.updated > Date.now() - ttlMs && room.schema === 1)
          rooms.set(room.code, room);
      } catch {
        console.error("Skipped unreadable room", f);
      }
    }
  }
  function persist(room) {
    room.updated = Date.now();
    if (dataDir) {
      const dest = path.join(dataDir, room.code + ".json"),
        tmp = dest + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(room), { mode: 0o600 });
      fs.renameSync(tmp, dest);
    }
  }
  function publicRoom(r, member) {
    return {
      code: r.code,
      version: r.version,
      host: r.host,
      you: member.id,
      members: r.members.map((m) => ({
        id: m.id,
        name: m.name,
        online: !!streams.get(r.code)?.get(m.id)?.size,
      })),
      seats: r.seats,
      options: r.options,
      game: view(r.game, member.id),
      approval: r.approval
        ? {
            id: r.approval.id,
            actor: r.approval.actor,
            action: r.approval.action,
            needed: r.approval.needed,
            approved: r.approval.approved,
          }
        : null,
    };
  }
  function emit(r) {
    for (const [id, set] of streams.get(r.code) || []) {
      const member = r.members.find((m) => m.id === id);
      for (const res of set)
        res.write("data: " + JSON.stringify(publicRoom(r, member)) + "\n\n");
    }
  }
  const snapshot = (r) => JSON.parse(JSON.stringify(r));
  function commit(r) {
    r.version++;
    persist(r);
    emit(r);
  }
  function execute(r, actor, action) {
    const next = apply(r.game, actor, action);
    invariants(next);
    r.game = next;
  }
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    const json = (status, data) => {
      res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(JSON.stringify(data));
    };
    try {
      if (url.pathname === "/healthz") return json(200, { ok: true });
      if (url.pathname.startsWith("/api/")) {
        // Bounded per-process limiter. Requests from a shared proxy are not grouped by forwarded headers.
        const ip = req.socket.remoteAddress || "local",
          now = Date.now();
        let bucket = limits.get(ip);
        if (!bucket || now - bucket.at > 60000) {
          bucket = { at: now, count: 0 };
          limits.set(ip, bucket);
        }
        fail(++bucket.count <= 1200, "Too many requests.", 429);
        let body = {};
        if (req.method === "POST") {
          const origin = req.headers.origin;
          fail(
            !origin || new URL(origin).host === req.headers.host,
            "Cross-origin writes are not allowed.",
            403,
          );
          let raw = "";
          for await (const part of req) {
            raw += part;
            fail(raw.length <= 65536, "Request is too large.", 413);
          }
          try {
            body = raw ? JSON.parse(raw) : {};
          } catch {
            fail(false, "Invalid JSON.");
          }
        }
        const name = (n) =>
          typeof n === "string" && n.trim().length > 0 && n.trim().length <= 24;
        if (url.pathname === "/api/rooms" && req.method === "POST") {
          fail(name(body.name), "Enter a name between 1 and 24 characters.");
          fail(
            rooms.size < 2000,
            "The server has reached its room limit.",
            503,
          );
          let code;
          do {
            code = Array.from(
              crypto.randomBytes(6),
              (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32],
            ).join("");
          } while (rooms.has(code));
          const m = {
              id: crypto.randomUUID(),
              name: body.name.trim(),
              token: token(),
            },
            r = {
              schema: 1,
              code,
              version: 0,
              host: m.id,
              members: [m],
              seats: [
                {
                  id: crypto.randomUUID(),
                  owner: m.id,
                  name: m.name,
                  role: null,
                },
              ],
              options: {
                epidemics: 5,
                virulent: false,
                mutation: false,
                lab: false,
                expansionCards: false,
                worldwide: false,
              },
              game: null,
              approval: null,
              updated: now,
            };
          persist(r);
          rooms.set(code, r);
          return json(201, { token: m.token, room: publicRoom(r, m) });
        }
        const match = url.pathname.match(
          /^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|stream|lobby|start|action|approve))?$/,
        );
        fail(match, "Endpoint not found.", 404);
        const r = rooms.get(match[1]);
        fail(r, "Room not found or expired.", 404);
        const route = match[2];
        if (route === "join" && req.method === "POST") {
          fail(
            !r.game,
            "The game has started. Reconnect with your original credentials.",
          );
          fail(r.members.length < 4, "A room can have at most four players.");
          fail(name(body.name), "Enter a name between 1 and 24 characters.");
          fail(
            r.seats.length < 4,
            "All role slots are full. Ask the host to remove an extra role.",
          );
          const m = {
            id: crypto.randomUUID(),
            name: body.name.trim(),
            token: token(),
          };
          const next = snapshot(r);
          next.members.push(m);
          next.seats.push({
            id: crypto.randomUUID(),
            owner: m.id,
            name: m.name,
            role: null,
          });
          commit(next);
          rooms.set(r.code, next);
          return json(200, { token: m.token, room: publicRoom(next, m) });
        }
        const auth =
          req.headers.authorization?.replace(/^Bearer /, "") ||
          url.searchParams.get("token");
        const m = r.members.find((x) => x.token === auth);
        fail(
          m,
          "Your session has expired. Reconnect with your original credentials.",
          401,
        );
        if (route === "stream" && req.method === "GET") {
          res.writeHead(200, {
            "content-type": "text/event-stream",
            "cache-control": "no-cache, no-transform",
            connection: "keep-alive",
            "x-accel-buffering": "no",
            "referrer-policy": "no-referrer",
          });
          res.write("retry: 2000\n\n");
          if (!streams.has(r.code)) streams.set(r.code, new Map());
          const map = streams.get(r.code);
          if (!map.has(m.id)) map.set(m.id, new Set());
          map.get(m.id).add(res);
          emit(r);
          const heartbeat = setInterval(
            () => res.write(": heartbeat\n\n"),
            20000,
          );
          req.on("close", () => {
            clearInterval(heartbeat);
            map.get(m.id)?.delete(res);
            const latest = rooms.get(r.code);
            if (latest) emit(latest);
          });
          return;
        }
        if (!route && req.method === "GET") return json(200, publicRoom(r, m));
        fail(req.method === "POST", "Method not allowed.", 405);
        fail(
          body.version === r.version,
          "The room has changed. Try again with the latest state.",
          409,
        );
        const next = snapshot(r);
        if (route === "lobby") {
          fail(!r.game, "The game has already started.");
          if (body.op === "seatRole") {
            const seat = next.seats.find((x) => x.id === body.seat);
            fail(
              seat && seat.owner === m.id,
              "You may choose only your own role.",
              403,
            );
            fail(
              body.role === null || rolePool(r.options).includes(body.role),
              "That role is unavailable.",
            );
            seat.role = body.role;
          } else {
            fail(m.id === r.host, "Only the host may do that.", 403);
            if (body.op === "options") {
              for (const key of [
                "virulent",
                "mutation",
                "lab",
                "expansionCards",
                "worldwide",
              ])
                if (key in body.options) {
                  fail(
                    typeof body.options[key] === "boolean",
                    "Invalid settings.",
                  );
                  next.options[key] = body.options[key];
                }
              if ("epidemics" in body.options) {
                fail(
                  Number.isInteger(body.options.epidemics) &&
                    body.options.epidemics >= 4 &&
                    body.options.epidemics <= 7,
                  "Invalid Epidemic card count.",
                );
                next.options.epidemics = body.options.epidemics;
              }
              if (!next.options.mutation) next.options.worldwide = false;
              for (const seat of next.seats)
                if (!rolePool(next.options).includes(seat.role))
                  seat.role = null;
            } else if (body.op === "addSeat") {
              fail(
                next.seats.length < 4,
                "A game can have at most four roles.",
              );
              next.seats.push({
                id: crypto.randomUUID(),
                owner: m.id,
                name: m.name + " " + (next.seats.length + 1),
                role: null,
              });
            } else if (body.op === "removeSeat") {
              const seat = next.seats.find((x) => x.id === body.seat);
              fail(
                seat && seat.owner === m.id && next.seats.length > 1,
                "The host may remove only their own extra roles.",
              );
              next.seats = next.seats.filter((x) => x.id !== body.seat);
            } else fail(false, "Invalid lobby operation.");
          }
        } else if (route === "start") {
          fail(
            m.id === r.host && !r.game,
            "Only the host may start the game.",
            403,
          );
          next.game = newGame(r.seats, r.options);
          invariants(next.game);
        } else if (route === "action") {
          fail(r.game, "The game has not started.");
          fail(!r.approval, "Resolve the pending consent request first.");
          const p = r.game.players.find((x) => x.id === body.actor);
          fail(p && p.owner === m.id, "You do not control that role.", 403);
          // Validate first; no hidden information is returned or state committed during this dry run.
          apply(r.game, body.actor, body.action);
          const needed = [
            ...new Set(
              requiredConsents(r.game, body.actor, body.action)
                .map((id) => r.game.players.find((p) => p.id === id)?.owner)
                .filter((x) => x && x !== m.id),
            ),
          ];
          if (needed.length)
            next.approval = {
              id: crypto.randomUUID(),
              actor: body.actor,
              action: body.action,
              needed,
              approved: [],
            };
          else execute(next, body.actor, body.action);
        } else if (route === "approve") {
          fail(
            r.approval && body.id === r.approval.id,
            "The consent request has expired.",
          );
          fail(
            r.approval.needed.includes(m.id) ||
              r.game.players.find((p) => p.id === r.approval.actor)?.owner ===
                m.id,
            "Your consent is not required.",
            403,
          );
          if (!body.accept) next.approval = null;
          else {
            fail(
              r.approval.needed.includes(m.id),
              "The requester does not need to approve.",
            );
            next.approval.approved = [
              ...new Set([...next.approval.approved, m.id]),
            ];
            if (
              next.approval.needed.every((x) =>
                next.approval.approved.includes(x),
              )
            ) {
              execute(next, next.approval.actor, next.approval.action);
              next.approval = null;
            }
          }
        } else fail(false, "Endpoint not found.", 404);
        commit(next);
        rooms.set(next.code, next);
        return json(200, publicRoom(next, m));
      }
      fail(
        req.method === "GET" || req.method === "HEAD",
        "Method not allowed.",
        405,
      );
      const paths = {
        "/": "public/index.html",
        "/app.js": "public/app.js",
        "/board.js": "public/board.js",
        "/style.css": "public/style.css",
        "/src/data.js": "src/data.js",
        "/src/catalog.js": "src/catalog.js",
      };
      const relative = paths[url.pathname];
      fail(relative, "Page not found.", 404);
      const ext = path.extname(relative),
        mime = {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
        }[ext];
      res.writeHead(200, {
        "content-type": mime + "; charset=utf-8",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "content-security-policy":
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
        "cache-control": "no-cache",
      });
      if (req.method === "HEAD") res.end();
      else fs.createReadStream(path.join(ROOT, relative)).pipe(res);
    } catch (e) {
      const status = e instanceof RuleError ? 400 : e.status || 500;
      if (status === 500) console.error(e);
      if (!res.headersSent)
        json(status, {
          error: status === 500 ? "Server error. Please try again." : e.message,
        });
      else res.end();
    }
  });
  const cleanup = setInterval(() => {
    for (const [code, r] of rooms)
      if (r.updated < Date.now() - ttlMs && !streams.get(code)?.size) {
        rooms.delete(code);
        if (dataDir)
          fs.rmSync(path.join(dataDir, code + ".json"), { force: true });
      }
    for (const [ip, b] of limits)
      if (Date.now() - b.at > 120000) limits.delete(ip);
  }, 60000);
  cleanup.unref();
  server.on("close", () => {
    clearInterval(cleanup);
    for (const map of streams.values())
      for (const set of map.values()) for (const r of set) r.end();
  });
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const server = createApp({
    dataDir: process.env.ROOM_DATA_DIR || path.join(ROOT, "room-data"),
  });
  const cliPort = process.argv.indexOf("--port");
  const port = Number(
    process.env.PORT || (cliPort >= 0 ? process.argv[cliPort + 1] : 3000),
  );
  server.listen(port, "0.0.0.0", () =>
    console.log("Pandemic listening on port " + port),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 5000).unref();
    });
}
