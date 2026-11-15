#!/usr/bin/env node
/**
 * Copies committed data into the static app and writes a manifest.
 * Runs before `next dev` and `next build`, so the browser only ever fetches
 * /data/... and the repository keeps a single source of truth.
 */
import { copyFile, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { gzip as gzipCallback, constants as zlibConstants } from "node:zlib";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const gzip = promisify(gzipCallback);
const webRoot = path.resolve(here, "..");
const repoRoot = path.resolve(webRoot, "../..");
const source = path.join(repoRoot, "data", "processed");
const sourceV2 = path.join(repoRoot, "data", "v2");
const target = path.join(webRoot, "public", "data");
const targetProcessed = path.join(target, "processed");
const maplibreDist = path.join(webRoot, "node_modules", "maplibre-gl", "dist");
const maplibreTarget = path.join(webRoot, "public", "maplibre");
const preserveGenerated = process.argv.includes("--preserve");
async function envFileApiBase() {
  for (const name of [".env.local", ".env"]) {
    try {
      const text = await readFile(path.join(webRoot, name), "utf8");
      const match = text.match(/^NEXT_PUBLIC_API_BASE=(.*)$/m);
      if (match && match[1].trim()) return match[1].trim();
    } catch {
      // file missing: keep looking
    }
  }
  return "";
}
const apiMode = Boolean(process.env.NEXT_PUBLIC_API_BASE || (await envFileApiBase()));

if (apiMode) {
  // The deployed frontend reads /data and /api from the VPS. Keep the local
  // MapLibre worker (it is code, not data) and remove any stale data bundle.
  await rm(target, { recursive: true, force: true });
  await mkdir(maplibreTarget, { recursive: true });
  await copyFile(
    path.join(maplibreDist, "maplibre-gl-worker.mjs"),
    path.join(maplibreTarget, "worker.js"),
  );
  console.log("[sync-data] NEXT_PUBLIC_API_BASE is set; API mode, data copy skipped");
  process.exit(0);
}

if (!preserveGenerated) await rm(target, { recursive: true, force: true });
await mkdir(targetProcessed, { recursive: true });

async function atomicWrite(file, contents) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  await writeFile(temporary, contents);
  await rename(temporary, file);
}

const files = existsSync(source) ? (await readdir(source)).sort() : [];
const years = [];
let calibration = false;

for (const name of files) {
  const match = /^(\d{4})\.json$/.exec(name);
  if (!match) continue;
  await atomicWrite(
    path.join(targetProcessed, name),
    await readFile(path.join(source, name)),
  );
  years.push(Number(match[1]));
}

if (files.includes("calibration.json")) {
  await atomicWrite(
    path.join(targetProcessed, "calibration.json"),
    await readFile(path.join(source, "calibration.json")),
  );
  calibration = true;
}

let v2Compressed = 0;
if (existsSync(sourceV2)) {
  const v2Target = path.join(target, "v2");
  await mkdir(v2Target, { recursive: true });

  const copyV2 = async (from, to) => {
    await mkdir(to, { recursive: true });
    for (const entry of await readdir(from, { withFileTypes: true })) {
      const input = path.join(from, entry.name);
      const output = path.join(to, entry.name);
      if (entry.isDirectory()) {
        await copyV2(input, output);
      } else if (entry.name === "manifest.json") {
        await atomicWrite(output, await readFile(input));
      } else if (entry.name.endsWith(".json")) {
        const compressed = await gzip(await readFile(input), {
          level: zlibConstants.Z_BEST_COMPRESSION,
        });
        await atomicWrite(`${output}.gz`, compressed);
        v2Compressed += 1;
      } else if (entry.name.endsWith(".geojson")) {
        await atomicWrite(output, await readFile(input));
      }
      // The bundled browser export builds CSV from the selected rows; redundant
      // source .csv.gz files stay editable in data/v2 but are not shipped twice.
    }
  };

  await copyV2(sourceV2, v2Target);
}

const manifest = {
  generated_at: new Date().toISOString(),
  years: years.sort((a, b) => a - b),
  calibration,
};
await atomicWrite(
  path.join(target, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

// MapLibre's module worker, served from a stable URL instead of a bundler chunk.
await mkdir(maplibreTarget, { recursive: true });
await atomicWrite(
  path.join(maplibreTarget, "worker.js"),
  await readFile(path.join(maplibreDist, "maplibre-gl-worker.mjs")),
);

const label = years.length === 0 ? "demo mode" : `${years.length} year file(s)`;
console.log(
  `[sync-data] ${label}, calibration ${calibration ? "found" : "missing"}, v2 ${v2Compressed} compressed JSON files, ${preserveGenerated ? "preserving" : "refreshing"} generated assets → apps/web/public/data`,
);
