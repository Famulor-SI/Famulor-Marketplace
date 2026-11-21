#!/usr/bin/env node
// Checks every connector and automation template, including the examples.
// Run: node scripts/validate.mjs            (all entries)
//      node scripts/validate.mjs connectors/acme   (one folder)

import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { checkAutomation, checkConnector, catalogText, entryDirs, rel, ROOT } from "./lib.mjs";

const args = process.argv.slice(2);
const connectorDirs = [...entryDirs("connectors"), ...entryDirs("examples/connectors")];
const automationDirs = [...entryDirs("automations"), ...entryDirs("examples/automations")];
const knownConnectors = new Set(entryDirs("connectors").map((dir) => basename(dir)));

function selected(dir) {
    if (args.length === 0) return true;
    return args.some((arg) => resolve(arg) === dir || resolve(ROOT, arg) === dir);
}

let failed = 0;
let checked = 0;
const report = (dir, errors) => {
    checked += 1;
    if (errors.length === 0) {
        console.log(`✓ ${rel(dir)}`);
        return;
    }
    failed += 1;
    console.log(`✗ ${rel(dir)}`);
    for (const error of errors) console.log(`    ${error}`);
};

for (const dir of connectorDirs.filter(selected)) report(dir, checkConnector(dir).errors);
for (const dir of automationDirs.filter(selected)) {
    const known = dir.includes(join("examples", "automations"))
        ? new Set([...knownConnectors, ...entryDirs("examples/connectors").map((d) => basename(d))])
        : knownConnectors;
    report(dir, checkAutomation(dir, known).errors);
}

// Slugs are global: a connector and an automation template may not share one.
if (args.length === 0) {
    const seen = new Map();
    for (const dir of [...entryDirs("connectors"), ...entryDirs("automations")]) {
        const slug = basename(dir);
        if (seen.has(slug)) {
            failed += 1;
            console.log(`✗ ${rel(dir)}\n    slug "${slug}" is already used by ${rel(seen.get(slug))}`);
        } else seen.set(slug, dir);
    }
    for (const base of ["connectors", "automations"]) {
        for (const dir of entryDirs(base)) {
            const marker = base === "connectors" ? "connector.json" : "listing.json";
            if (!existsSync(join(dir, marker))) {
                failed += 1;
                console.log(`✗ ${rel(dir)}\n    ${marker} is missing; every folder in ${base}/ is one entry`);
            }
        }
    }
    const catalogPath = join(ROOT, "catalog.json");
    if (!existsSync(catalogPath) || readFileSync(catalogPath, "utf8") !== catalogText()) {
        failed += 1;
        console.log("✗ catalog.json\n    is out of date. Run: node scripts/build-catalog.mjs");
    }
}

if (checked === 0 && args.length > 0) {
    console.log(`No entry found for ${args.join(", ")}. Pass a folder such as connectors/<slug>.`);
    process.exit(1);
}
console.log(failed === 0 ? `\nAll ${checked} entries pass.` : `\n${failed} problem(s) found.`);
process.exit(failed === 0 ? 0 : 1);

