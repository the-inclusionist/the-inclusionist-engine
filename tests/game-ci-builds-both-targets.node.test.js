// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SHARED CI BUILDS BOTH TARGETS OF EVERY GAME AND CHECKS THE CARTRIDGE, WITH NO SWITCH (ADR-0253).
//
// `game-ci.yml` is the one gate every game calls (ADR-0068 §4). ADR-0140 said a gate building BOTH targets «is not optional», and
// for sixteen days it built the app only. What this holds: in the `gate` job, the app build, then the cartridge built with the
// engine's build, then the engine's checker over it — in that order, none behind an `if:`, none allowed to fail, and none reading
// an input, so no caller can turn the cartridge off by a line in its own workflow.
//
// ⚠️ NOT A YAML PARSER — the engine has none among its dependencies (see `workflow-run-blocks-are-not-cut.node.test.js`). The
// steps are cut at their `- ` under the job's `steps:`, which is the only shape this file writes them in.
//
// MUTATIONS CHECKED (2026-09-27), each restored from a copy in the scratchpad:
//   · the checker step deleted → RED (no step runs the checker);
//   · `if: ${{ inputs.a11y }}` added to the cartridge build step → RED (a switch);
//   · `continue-on-error: true` added to the checker step → RED;
//   · the two cartridge steps moved above `npm run build` → RED (order).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WORKFLOW = readFileSync(fileURLToPath(new URL('../.github/workflows/game-ci.yml', import.meta.url)), 'utf8');

/** The `gate` job's steps, each as its own text, in file order. */
function gateSteps(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^ {2}gate:\s*$/.test(l));
  const steps = [];
  let inSteps = false;
  for (const line of lines.slice(start + 1)) {
    if (/^ {2}\S/.test(line)) break; // the next job
    if (/^ {4}steps:\s*$/.test(line)) { inSteps = true; continue; }
    if (!inSteps) continue;
    if (/^ {6}- /.test(line)) steps.push(line);
    else if (steps.length && !/^\s*#/.test(line)) steps[steps.length - 1] += `\n${line}`;
  }
  return steps;
}

const STEPS = gateSteps(WORKFLOW);
const APP = /^\s*(?:- )?run: npm run build\s*$/m;
const CARTRIDGE = /^\s*npx --no -- vite build --mode cartridge\s*$/m;
const CHECK = /^\s*(?:- )?run: npx --no -- inclusionist-check-cartridge\s*$/m;
const at = (re) => STEPS.findIndex((s) => re.test(s));

describe('game-ci.yml · both targets and the checker, required (ADR-0253)', () => {
  it('[Right] the gate job builds the app, then the cartridge with the engine\'s build, then runs the engine\'s checker', () => {
    const order = [at(APP), at(CARTRIDGE), at(CHECK)];
    expect(order.every((i) => i >= 0), `steps found at ${order.join(', ')} of ${STEPS.length}`).toBe(true);
    expect([...order].sort((a, b) => a - b), 'the checker reads what the cartridge build wrote, after the app build').toEqual(order);
    expect(new Set(order).size, 'three steps, not one step doing everything behind a script').toBe(3);
  });

  it('🔴 [Zero] no switch: neither cartridge step has an `if:`, reads an input, or may fail', () => {
    for (const step of [STEPS[at(CARTRIDGE)], STEPS[at(CHECK)]]) {
      expect(step, 'the cartridge step is missing').toBeDefined();
      expect(step).not.toMatch(/^\s*(?:- )?if:/m);
      expect(step).not.toMatch(/inputs\./);
      expect(step).not.toMatch(/continue-on-error/);
    }
  });

  it('[Right] the header says what the step gates, and that a game without a cartridge target is red', () => {
    expect(WORKFLOW).toMatch(/A GAME WITHOUT A CARTRIDGE TARGET IS RED UNTIL IT ADOPTS THE ENGINE'S BUILD/);
  });

  it('[Boundary] the step cutter reads the shape: a comment between steps belongs to neither, the next job ends the list', () => {
    const text = 'jobs:\n  gate:\n    steps:\n      - run: a\n      # note\n      - name: b\n        run: b\n  other:\n    steps:\n      - run: c\n';
    expect(gateSteps(text)).toEqual(['      - run: a', '      - name: b\n        run: b']);
  });
});
