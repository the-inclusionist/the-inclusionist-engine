// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of render/crt — the CRT look (BROWSER project: uses #game-region, classList, style, localStorage).
// The CRT is MUTABLE config (the menu adjusts its props), so each test pins cfg.scan/vig/round and checks the CSS classes.
// Each block builds its own instance (ADR-0232 D4): the config lives in the instance, never in the module.
// See docs/5-Refactoring/plan-modularization-map.md (Stage 4, Tier 1, render/crt).
import { describe, it, expect } from 'vitest';
import { createCrt } from '../app/js/render/crt.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';

const region = () => { document.body.innerHTML = '<div id="game-region" style="height:360px"></div>'; return document.querySelector('#game-region'); };
/** A CRT over the page's `#game-region`, a store of its own, and the accessibility answer `a11y()`. */
const crtWith = (a11y = () => false, store = createStorage(memoryBackend())) => createCrt({
  region: () => document.querySelector('#game-region'), win: window, numPlayers: () => 1, a11yVisualOn: a11y, store });
const { cfg: CRT, apply: applyCrt, scanVars: crtScanVars } = crtWith();

describe('render/crt — applyCrt (classes CSS no #game-region)', () => {
  it('[Right] CRT.scan → classe crt-scan-1 + variável --scan-per definida', () => {
    const g = region();
    CRT.scan = 1; CRT.vig = 0; CRT.round = 1;
    applyCrt();
    expect(g.classList.contains('crt-scan-1')).toBe(true);
    expect(g.style.getPropertyValue('--scan-per')).not.toBe('');
  });
  it('[Interface] vinheta e cantos: vig=1→crt-vig-1; round=2→crt-round-2; round=1 não gera classe', () => {
    const g = region();
    CRT.scan = 0; CRT.vig = 1; CRT.round = 2;
    applyCrt();
    expect(g.classList.contains('crt-vig-1')).toBe(true);
    expect(g.classList.contains('crt-round-2')).toBe(true);
    expect(g.classList.contains('crt-scan-1')).toBe(false); // scan=0 → no scanline
  });
  it('[Inverse] tudo desligado (scan/vig 0, round 1) → nenhuma classe crt-*', () => {
    const g = region();
    CRT.scan = 0; CRT.vig = 0; CRT.round = 1;
    applyCrt();
    expect([...g.classList].some((c) => c.startsWith('crt-'))).toBe(false);
  });
});

describe('render/crt — crtScanVars (scanline ancorada em px reais)', () => {
  it('[Interface] define --scan-per e --scan-line quando há scanline', () => {
    const g = region();
    CRT.scan = 1;
    crtScanVars();
    expect(g.style.getPropertyValue('--scan-per')).toMatch(/px$/);
    expect(g.style.getPropertyValue('--scan-line')).toMatch(/px$/);
  });
});

// ---------------------------------------------------------------------------------------------------------
// WHAT THE CRT RECEIVES (ADR-0232 D4): the region, the pixel ratio, the player count and the store all arrive through
// `createCrt`'s ctx — nothing is looked up in the page's document or read from its window.
describe('render/crt — everything it touches arrives by injection (ADR-0232 D4)', () => {
  it('🔴 [Right] the classes go on the region the ctx HANDS over, in whatever document it lives', () => {
    const other = document.implementation.createHTMLDocument('other');
    const g = other.createElement('div'); other.body.appendChild(g);
    region(); // a #game-region in the page too — the one that must NOT be touched
    createCrt({ region: () => g, win: { devicePixelRatio: 1 }, numPlayers: () => 1, a11yVisualOn: () => false,
      store: createStorage(memoryBackend()) }).apply();
    expect(g.classList.contains('crt-scan-1'), 'the handed region got no class').toBe(true);
    expect(document.querySelector('#game-region').classList.contains('crt-scan-1'), 'the page\'s region was touched').toBe(false);
  });

  it('🔴 [Right] the scanline period follows the INJECTED pixel ratio and player count', () => {
    // A 720 px region, one row of screens: 720/180 = 4 real px per art line at dpr 1 → `--scan-per: 4px`, a 1 px line.
    // At dpr 1.25: round(720·1.25/180) = 5 real px = 4 css px, and the line is 1 real px = 0.8 css px. Three players sit on
    // two rows of screens: 2 real px per art line.
    const g = region(); g.style.height = '720px';
    const at = (dpr, players) => {
      createCrt({ region: () => g, win: { devicePixelRatio: dpr }, numPlayers: () => players, a11yVisualOn: () => false,
        store: createStorage(memoryBackend()) }).scanVars();
      return [g.style.getPropertyValue('--scan-per'), g.style.getPropertyValue('--scan-line')];
    };
    expect(at(1, 1)).toEqual(['4px', '1px']);
    expect(at(1.25, 1), 'the pixel ratio was not the injected one').toEqual(['4px', '0.8px']);
    expect(at(1, 3), 'the player count was not the injected one').toEqual(['2px', '1px']);
  });

  it('🔴 [Right] TWO instances keep their own config (ADR-0142: two roots share nothing)', () => {
    const a = crtWith(), b = crtWith();
    a.cfg.vig = 1;
    expect(b.cfg.vig, 'the second root sees the first root\'s vignette').toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------
// THE VIGNETTE YIELDS TO ACCESSIBILITY — ADR-0020: accessibility modes suppress the decorative CRT (accessibility over
// looks), in `hc-direto`, `fix-deuter`, `lv-blur` and `blind` alike.
//
// A vignette darkens the EDGES. In high contrast — the mode that exists to RAISE contrast — it works against the very
// reason the child turned it on.
//
// MUTATIONS CHECKED:
//   · removing `&& !_a11yVisualAtiva()` from `render/crt.applyCrt`, the [Right] case fails with
//     "expected true to be false" — the vignette survives the accessibility mode.
//   · dropping the `!` (suppressing when there is NO accessibility mode), the [Inverse] case fails — the vignette
//     vanishes for whoever asked for no accessibility at all.
describe('render/crt — a decoração cede para a acessibilidade (ADR-0020)', () => {
  // ONE instance for the block, over a store of its own (ADR-0232): the accessibility answer is a getter the case flips
  // mid-case, which is how the root's answer changes when the child turns a visual mode on.
  let ativa = false;
  const { cfg: CRT, apply: applyCrt } = crtWith(() => ativa);
  const comA11y = (sim) => { ativa = sim; };

  it('[Right] com modo de a11y ativo, a vinheta NÃO é aplicada', () => {
    const g = region();
    comA11y(true);
    CRT.scan = 0; CRT.vig = 1; CRT.round = 1;
    applyCrt();
    expect(g.classList.contains('crt-vig-1')).toBe(false);
  });

  it('[Inverse] sem modo de a11y, a mesma vinheta é aplicada — a supressão é do modo, não do valor', () => {
    const g = region();
    comA11y(false);
    CRT.scan = 0; CRT.vig = 1; CRT.round = 1;
    applyCrt();
    expect(g.classList.contains('crt-vig-1')).toBe(true);
  });

  it('[Interface] suprimir NÃO é desligar: a preferência da criança fica gravada e volta sozinha', () => {
    // The distinction matters to whoever runs the school's machine: if suppression erased `CRT.vig`, leaving the
    // accessibility mode would not bring back the look the child had chosen.
    const g = region();
    comA11y(true);
    CRT.scan = 0; CRT.vig = 1; CRT.round = 1;
    applyCrt();
    expect(CRT.vig, 'a supressão não pode apagar a preferência').toBe(1);
    comA11y(false);
    applyCrt();
    expect(g.classList.contains('crt-vig-1')).toBe(true);
  });

  it('[Right] a SCANLINE TAMBÉM cede — a reversão que este caso existia para receber', () => {
    // The scanline yields too (ADR-0047), though ADR-0020's list named only the vignette and decorative flashes, and it
    // is the only one of the three that comes ON by default.
    const g = region();
    comA11y(true);
    CRT.scan = 1; CRT.vig = 0; CRT.round = 1;
    applyCrt();
    expect(g.classList.contains('crt-scan-1')).toBe(false);
  });

  it('[Right] os DOIS cedem juntos, e nenhuma chave os traz de volta', () => {
    // There is deliberately no per-effect escape key: the Dev removed it after seeing the result on screen
    // («Ceder fez muito bem ao jogo nos modos de acessibilidade»), so pillar 2 has no exception. This case keeps the key
    // from coming back unnoticed.
    const g = region();
    comA11y(true);
    CRT.scan = 1; CRT.vig = 1; CRT.round = 1;
    applyCrt();
    expect(g.classList.contains('crt-scan-1')).toBe(false);
    expect(g.classList.contains('crt-vig-1')).toBe(false);
    expect(CRT.scan, 'e as preferências continuam gravadas').toBe(1);
    expect(CRT.vig).toBe(1);
    comA11y(false);
    applyCrt();
    expect(g.classList.contains('crt-scan-1'), 'voltam sozinhas ao sair do modo').toBe(true);
    expect(g.classList.contains('crt-vig-1')).toBe(true);
  });
});
