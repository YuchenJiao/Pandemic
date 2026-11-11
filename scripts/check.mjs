import { execFileSync } from "node:child_process";
import fs from "node:fs";
for (const file of [
  "server.mjs",
  "src/data.js",
  "src/catalog.js",
  "src/engine.js",
  "public/app.js",
])
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
for (const file of [
  "public/index.html",
  "public/style.css",
  "README.md",
  "render.yaml",
])
  if (!fs.existsSync(file)) throw Error("Missing " + file);
console.log("Source checks passed (no client bundle required).");
