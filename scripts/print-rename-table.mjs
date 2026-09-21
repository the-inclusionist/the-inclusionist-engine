#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// PRINTS THE MIGRATION TABLE FROM THE RENAME MAP (ADR-0219, issue #202).
//
// The table that goes into `docs/6-DevOps-SRE/Breaking-Changes.md` is not typed by hand: it is printed from the same file the
// engine renames itself from, so a name cannot be renamed without appearing in the table — which is the promise a hand-typed
// table cannot keep. The games are adapted from this table when the Dev goes to each one; nothing touches them from here.
//
// Use: `node scripts/print-rename-table.mjs [layer]` — every applied layer by default.

import { readMap } from './apply-rename.mjs';

const map = readMap();
const wanted = process.argv[2];
const layers = Object.entries(map.layers).filter(([name, l]) => (wanted ? name === wanted : l.done));
if (!layers.length) {
  console.error(wanted ? `print-rename-table: no layer «${wanted}»` : 'print-rename-table: no layer applied yet');
  process.exit(2);
}

for (const [name, layer] of layers) {
  const names = Object.entries(layer.names).sort(([a], [b]) => a.localeCompare(b));
  console.log(`\n**${name}** — ${names.length} names, applied ${layer.done}\n`);
  console.log('| was | is |');
  console.log('|---|---|');
  for (const [old, fresh] of names) console.log(`| \`${old}\` | \`${fresh}\` |`);
}
