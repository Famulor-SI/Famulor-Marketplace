#!/usr/bin/env node
// Writes catalog.json, the index of listed connectors and automation templates.
// Run after adding or changing an entry. CI fails when catalog.json is out of date.
// node scripts/build-catalog.mjs          write the file
// node scripts/build-catalog.mjs --check  only compare

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { catalogText, ROOT } from "./lib.mjs";

const path = join(ROOT, "catalog.json");
const next = catalogText();
if (process.argv.includes("--check")) {
    const current = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (current !== next) {
        console.log("catalog.json is out of date. Run: node scripts/build-catalog.mjs");
        process.exit(1);
    }
    console.log("catalog.json is up to date.");
} else {
    writeFileSync(path, next);
    console.log("Wrote catalog.json.");
}
