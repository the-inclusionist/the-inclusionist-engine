// SPDX-License-Identifier: AGPL-3.0-or-later
// THE ENGINE FORCES THE RESOLUTION ON EVERY CARTRIDGE (ADR-0163, ADR-0001).
//
// 🔴 The Dev opened the quiz in a browser: «A resolução deveria ser no mínimo 640x360 ou múltiplos inteiros de 320x180
// maiores que a resolução mínima, conforme há espaço na tela […] A Engine deve forçar isso». Measured: `createGame`
// never ran ADR-0001's scale, and the quiz rendered at 569×395.
//
// The pure half (`escalaDoPalco`) is pinned with literal cases, including the crop tolerance and a fractional device
// pixel ratio; the wiring is measured on a real document: the region `createGame` sizes, and again after a resize.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll } from 'vitest';
import { escalaDoPalco } from '../app/js/ui/layout.js';
import { SEM_ASSUNTO } from './fixtures/respostas-de-acomodacao.js';

describe('ADR-0001 as a pure function', () => {
  it('🔴 [Zero] a space smaller than 640×360 still gets 640×360 — never less', () => {
    expect(escalaDoPalco(569, 395, 1, 320, 180)).toEqual({ kDev: 2, k: 2, largura: 640, altura: 360 });
  });

  it('🎯 [Right] the largest INTEGER multiple that fits', () => {
    expect(escalaDoPalco(1300, 740, 1, 320, 180)).toMatchObject({ kDev: 4, largura: 1280, altura: 720 });
    expect(escalaDoPalco(1279, 800, 1, 320, 180).kDev, 'within the tolerance, one more step').toBe(4);
  });

  it('🔴 [Boundary] the crop tolerance is 5 LOGICAL px per side — one more is too many', () => {
    // at k=4 a logical px is 4 CSS px: 5 per side = 40 CSS px in all
    expect(escalaDoPalco(1240, 720, 1, 320, 180).kDev, '40 px of crop is inside the tolerance').toBe(4);
    expect(escalaDoPalco(1239, 720, 1, 320, 180).kDev, '41 px of crop is past it').toBe(3);
  });

  it('🎯 [Right] TEXT AT 200% on the school devices still fits the screen (ADR-0159 rule 11)', () => {
    // A 200% zoom halves the CSS space and doubles the device pixel ratio. 📏 Measured in dist/quiz.html: at 683×384 CSS
    // (1366×768, the Positivo) and at 640×400 (1280×800, a Chromebook, stage 632×396 inside `main`'s padding) the page does
    // not scroll and the region is 640×360 — cropped at most by ADR-0001's tolerance of 5 logical px per side.
    for (const [w, h] of [[683, 384], [632, 396]]) {
      const e = escalaDoPalco(w, h, 2, 320, 180);
      expect([e.largura, e.altura], `${w}×${h} at 200%`).toEqual([640, 360]);
      expect(Math.max(0, e.largura - w), `${w}×${h}: cropped past the tolerance`).toBeLessThanOrEqual(2 * 5 * e.k);
      expect(Math.max(0, e.altura - h)).toBeLessThanOrEqual(2 * 5 * e.k);
    }
  });

  it('🎯 [Right] with a fractional device pixel ratio the multiple is in REAL pixels, not CSS ones', () => {
    const e = escalaDoPalco(1093, 614, 1.25, 320, 180);
    expect(Number.isInteger(e.kDev)).toBe(true);
    expect((e.largura * 1.25) % 320, 'the region is not a multiple of 320 in real pixels').toBe(0);
    expect(e.largura * 1.25, 'under 640 real px').toBeGreaterThanOrEqual(640);
  });
});

describe('createGame applies it — the cartridge has no other', () => {
  let regiao;
  let palco;
  let motor;

  beforeAll(async () => {
    const { createGame } = await import('../app/js/boot/create-game.js');
    palco = document.createElement('div');
    palco.className = 'stage-wrap';
    palco.style.cssText = 'width:1300px;height:740px;display:flex';
    palco.innerHTML = '<div id="game-region" tabindex="-1" style="width:569px;height:395px"></div>';
    document.body.append(Object.assign(document.createElement('p'), { id: 'sr-status' }), palco);
    regiao = palco.querySelector('#game-region');
    motor = createGame({ acomodacoes: SEM_ASSUNTO,
      declaration: {
        topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, seguraTeclas: () => false, tick: 'player',
        world: () => ({ kind: 'element', selector: '#game-region' }), roleAt: () => 'goal',
        nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
        objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
      },
      host: { doc: document, win: window },
      baixarPesados: false,
    });
  });

  it('🔴 [Right] the region the cartridge sized at 569×395 comes out at the integer multiple that fits', () => {
    const r = regiao.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    expect(Math.round(r.width * dpr) % 320, 'not a multiple of 320 in real pixels').toBe(0);
    expect(Math.round(r.height * dpr) % 180, 'not a multiple of 180 in real pixels').toBe(0);
    expect(r.width, 'under 640').toBeGreaterThanOrEqual(640);
    expect(Math.round(r.width * dpr) / 320).toBe(Math.round(r.height * dpr) / 180);
  });

  it('🔴 [Right] and again when the space changes — a resize re-applies it', () => {
    palco.style.width = '700px';
    palco.style.height = '400px';
    window.dispatchEvent(new Event('resize'));
    const r = regiao.getBoundingClientRect();
    expect([Math.round(r.width), Math.round(r.height)], 'the region did not follow the smaller space down to 640×360').toEqual([640, 360]);
  });

  it('🔴 [Right] the target floor is written from the SAME scale — 44 px at 640×360 (ADR-0163 rule 2)', () => {
    // After the resize above the region is 640×360 CSS px, so k = 640 / 320.
    const k = regiao.getBoundingClientRect().width / 320;
    expect(regiao.style.getPropertyValue('--alvo-min'), 'no target floor on the region').toBe(`${22 * k}px`);
    expect(regiao.style.getPropertyValue('--alvo-min')).toBe('44px');
  });

  it('🔴 [Right] a cartridge that sizes the region itself is NAMED in `problems` (ADR-0163 rule 4)', () => {
    const doTamanho = () => motor.problems.filter((p) => p.includes('#game-region') && p.includes('ADR-0163'));
    expect(doTamanho(), 'the engine\'s own size was reported as a departure').toEqual([]);
    const antes = [regiao.style.width, regiao.style.height];
    regiao.style.width = '569px';
    regiao.style.height = '395px';
    try {
      const linhas = doTamanho();
      expect(linhas, 'the departure was not said').toHaveLength(1);
      expect(linhas[0]).toContain('569×395');
      expect(linhas[0]).toContain('640×360');
    } finally {
      [regiao.style.width, regiao.style.height] = antes;
    }
    expect(doTamanho(), 'the line stayed after the size came back').toEqual([]);
    // and each axis on its own: a cartridge that only changes the height has still sized the region
    regiao.style.height = '400px';
    try {
      expect(doTamanho(), 'a height-only change was not said').toHaveLength(1);
    } finally {
      regiao.style.height = antes[1];
    }
  });

  it('🔴 [Right] text and targets the CARTRIDGE draws under the floor are named; the engine\'s own are not (ADR-0163 rule 4)', () => {
    const doPiso = () => motor.problems.filter((p) => p.includes('under') && p.includes('ADR-0163'));
    expect(doPiso(), 'nothing of the cartridge drawn yet, and a line already').toEqual([]);
    // the engine's own node with small text is not the cartridge's to answer for
    const daEngine = Object.assign(document.createElement('div'), { className: 'rodape-da-tela', textContent: 'engine' });
    daEngine.style.fontSize = '10px';
    regiao.appendChild(daEngine);
    const letra = Object.assign(document.createElement('p'), { className: 'miuda', textContent: 'fine print' });
    letra.style.fontSize = '12px';
    const botao = Object.assign(document.createElement('button'), { className: 'baixo', textContent: 'Go' });
    botao.style.cssText = 'height:30px;width:200px;font-size:20px';
    try {
      regiao.append(letra, botao);
      const linhas = doPiso();
      expect(linhas, 'the cartridge\'s small text and short button were not said').toHaveLength(1);
      expect(linhas[0]).toContain('p.miuda');
      expect(linhas[0]).toContain('button.baixo');
      expect(linhas[0], 'the engine\'s footer was accused').not.toContain('rodape-da-tela');
      expect(linhas[0], 'the button\'s 20 px label was accused as text').not.toMatch(/text under[^)]*button\.baixo/);
    } finally {
      letra.remove(); botao.remove(); daEngine.remove();
    }
    expect(doPiso(), 'the line stayed after the nodes left').toEqual([]);
  });
});

// ===== MUTATIONS CHECKED (2026-09-12) =====
// R1 `createGame` stops applying the scale             → red (the region stays 569×395)
// R2 no `resize` listener                              → red (the region keeps the old size)
// R3 floor at 1× instead of 2×                         → red (a small space gets 320×180)
// R4 no crop tolerance (`base` instead of `base − 10`)  → red, twice
// R5 the multiple rounded in CSS px, not real px       → red (the fractional-dpr case)
// P1 the size line is not pushed to `problems`          → red
// P2 a tolerance of 1000 px                            → red
// P3 the applied scale is not kept                     → red (nothing to compare)
// P4 only the width compared                          → red (the height-only step)
// P5 no early return: the engine's own size accused    → red
// F1 the floor line is not pushed                     → red
// F2 the engine's nodes not told apart (footer accused) → red
// F5 buttons are not targets                          → red