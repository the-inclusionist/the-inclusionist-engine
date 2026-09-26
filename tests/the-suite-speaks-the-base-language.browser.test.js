// SPDX-License-Identifier: AGPL-3.0-or-later
// THE BROWSER SUITE RUNS IN THE BASE LANGUAGE, WHATEVER MACHINE RUNS IT.
//
// A root with nothing stored takes the language the browser reports, and an unpinned Chromium reports the host's: pt-BR on
// the Dev's Windows, en-US on GitHub's runner. The suite's expectations are written in pt-BR, so the same tree was green
// locally and red in CI from 2026-09-12 on — dozens of cases failing with an English string where a Portuguese one was
// expected, and nothing saying that the MACHINE was the difference. `vite.config.ts` pins the Playwright context to pt-BR.
//
// 📌 This case is what makes that pin visible: without it, removing the pin stays green on a pt-BR machine and turns CI
// red in forty places that each look like a translation bug. With it, the first failure names the cause.
//
// MUTATION CHECKED (2026-09-26): the pin set to `en-US` in `vite.config.ts` → this case RED, «the browser reports en-US».
import { describe, it, expect } from 'vitest';

describe('the browser suite runs in the base language', () => {
  it('🔴 [Right] the browser reports pt-BR — the pin in vite.config.ts, not the host, decides it', () => {
    expect(navigator.language, `the browser reports ${navigator.language}: the suite's expectations are pt-BR, and the `
      + 'Playwright context in vite.config.ts must pin `locale: \'pt-BR\'` so the host machine does not choose').toBe('pt-BR');
  });
});
