// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/layout — the scale of #game-region (BROWSER project: uses #stage-wrap/#game-region + devicePixelRatio).
// Patterns: ZOMBIES + Right-BICEP. VLibras closed by default (librasOpen=false). See docs/5-Refactoring/plano-modularizacao-mapa.md.
import { describe, it, expect } from 'vitest';
import { layout } from '../app/js/ui/layout.js';

const setup = (w = 1280, h = 720) => { document.body.innerHTML = `<div id="stage-wrap" style="width:${w}px;height:${h}px"><div id="game-region"></div></div>`; };

describe('ui/layout — escala do #game-region', () => {
  it('[Right] escala o canvas e seta as vars de UI (--ui-fs/--tap/--hud-fs) em px', () => {
    setup();
    layout();
    const gr = document.querySelector('#game-region');
    expect(parseFloat(gr.style.width)).toBeGreaterThan(0);
    expect(gr.style.height).toMatch(/px$/);
    expect(gr.style.getPropertyValue('--ui-fs')).toMatch(/px$/);
    expect(gr.style.getPropertyValue('--tap')).toMatch(/px$/);
    expect(gr.style.getPropertyValue('--hud-fs')).toMatch(/px$/);
  });
  it('[Cross-check] 1 jogador (base 320) com piso k≥2 → largura ≥ 640 (viewport mín. do Chromebook)', () => {
    setup(1280, 720);
    layout();
    expect(parseFloat(document.querySelector('#game-region').style.width)).toBeGreaterThanOrEqual(640);
  });
  it('[Zero/Robustez] sem #stage-wrap → early return, não quebra', () => {
    document.body.innerHTML = '';
    expect(() => layout()).not.toThrow();
  });
  it('[Interface] VLibras fechado (padrão) → sem reserva à direita (paddingRight 0)', () => {
    setup();
    layout();
    expect(document.querySelector('#stage-wrap').style.paddingRight).toBe('0px');
  });
});

// ===================================================================================================
// THE HOST AS IT REALLY EXISTS — not as this file would prefer it
// ===================================================================================================
// ⚠️ `app/quiz.html`, the proof consumer's page, has `<div class="stage-wrap">` — by CLASS — and `ui/layout.ts` returns
// early, silently, when it finds no shell. Looking up by id only, `layout()` did not run on the engine's host: the
// canvas did not scale, `--tap`/`--ui-fs`/`--hud-fs` were never written, and the early return is indistinguishable
// from «não havia o que fazer».
//
// ⚠️ AND THE `setup()` ABOVE IS WHY NOBODY SAW IT. It FABRICATES `<div id="stage-wrap">` with a fixed height, injecting
// exactly the variable it should be measuring. A test that builds the host the way the code wants does not check that
// the real host is like that — it checks that the function works when it works.
//
// This block builds the host AS `quiz.html` BUILDS IT. It was born red.
describe('ui/layout — o host real do consumidor de prova (achado de 07/09)', () => {
  /** Exactly the shape of `app/quiz.html`: the shell by CLASS, `#game-region` inside it. */
  const setupComoOQuiz = (w = 1280, h = 720) => {
    document.body.innerHTML =
      `<main><div class="stage-wrap" style="width:${w}px;height:${h}px">`
      + '<div id="stage" class="stage"><section id="game-region" class="game-region"></section></div>'
      + '</div></main>';
  };

  it('⚠️ [Right] com a casca por CLASSE, o `#game-region` é escalado na mesma', () => {
    setupComoOQuiz();
    layout();
    const gr = document.querySelector('#game-region');
    expect(parseFloat(gr.style.width), 'layout() não correu: o host da engine não escala').toBeGreaterThan(0);
    expect(gr.style.height).toMatch(/px$/);
  });

  it('⚠️ [Right] e as vars de UI chegam — sem elas o alvo de toque não tem tamanho', () => {
    // `--tap` is what ADR-0095 uses as the target's floor. Without `layout()` it is never written and every
    // `min-height: var(--tap)` in `style.css` falls back to its default.
    setupComoOQuiz();
    layout();
    const gr = document.querySelector('#game-region');
    for (const v of ['--ui-fs', '--tap', '--hud-fs']) {
      expect(gr.style.getPropertyValue(v), `${v} não foi escrita`).toMatch(/px$/);
    }
  });

  it('[Interface] as duas formas do host produzem a MESMA escala', () => {
    // Accepting the class cannot be a second-class path: the same space must give the same canvas.
    setupComoOQuiz(1280, 720);
    layout();
    const porClasse = document.querySelector('#game-region').style.width;
    document.body.innerHTML = '<div id="stage-wrap" style="width:1280px;height:720px"><div id="game-region"></div></div>';
    layout();
    expect(document.querySelector('#game-region').style.width).toBe(porClasse);
  });

  it('[Zero] e sem host nenhum continua a não quebrar', () => {
    document.body.innerHTML = '<main></main>';
    expect(() => layout()).not.toThrow();
  });
});
