// SPDX-License-Identifier: AGPL-3.0-or-later
// A SOUND CAPTION STAYS FOR ITS WORDS, AT THE CHILD'S READING RATE (plan phase 5c; ADR-0183 §4; issue #179).
//
// 📏 Measured on 2026-09-13: `legendarSom` hid every caption after 2600 ms, whatever its length; a fixed 120 words a minute
// followed. ADR-0183 makes the rate the child's: «125 WPM (leitor iniciante), 145WPM (confortável na década de 90 segundo
// pesquisa), 175WPM (confortável hoje segundo pesquisa)» — 145 is Jensema's measured comfortable rate (1998), 125 sits between
// Burnham's 120 for children and the DCMP's 130, and 175 is kept as the Dev's choice though no study measures it comfortable.
// 2600 ms stays the floor: a one-word caption («Sino») keeps the time the games had measured in play.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach } from 'vitest';
import { captionDuration, CAPTION_MIN_MS, CAPTION_RATES, isCaptionRate } from '../app/js/core/caption-duration.js';
import * as state from '../app/js/core/state.js';

const OITO = 'Uma porta de madeira velha rangendo bem devagar';

describe('how long a sound caption stays', () => {
  it('📌 [Right] the rates are the Dev\'s three, and the floor is the games\' 2600 ms', () => {
    expect(CAPTION_RATES).toEqual([125, 145, 175]);
    expect(CAPTION_MIN_MS).toBe(2600);
  });

  it('🔴 [Right] a long caption stays for its words at the chosen rate', () => {
    expect(captionDuration(OITO, 125)).toBe(3840); // 8 × 60 000 / 125
    expect(captionDuration(OITO, 145)).toBe(3310);
    expect(captionDuration(OITO, 175)).toBe(2743);
  });

  it('🔴 [Right] a caption at 125 words a minute stays longer than at 175 (ADR-0183 confirmation)', () => {
    expect(captionDuration(OITO, 125)).toBeGreaterThan(captionDuration(OITO, 175));
  });

  it('🎯 [Boundary] a short caption keeps the floor, at any rate', () => {
    for (const ppm of CAPTION_RATES) expect(captionDuration('Sino', ppm)).toBe(2600);
    expect(captionDuration('Porta rangendo devagar lá fora', 175)).toBe(2600); // 5 words = 1714 ms, under the floor
  });

  it('🎯 [Zero] spaces are not words', () => {
    expect(captionDuration('  Gol   do   time  ', 125)).toBe(2600);
    expect(captionDuration('', 125)).toBe(2600);
  });

  it('🎯 [Boundary] a rate outside the three is not a rate — it reads as the slowest, never as a caption that flashes', () => {
    expect(isCaptionRate(999)).toBe(125);
    expect(isCaptionRate(0)).toBe(125);
    expect(isCaptionRate(Number.NaN)).toBe(125);
    expect(isCaptionRate(145)).toBe(145);
    expect(captionDuration(OITO, 0)).toBe(3840);
  });
});

function portaFalsa(guardado = {}) {
  const dados = { ...guardado };
  return {
    dados,
    get: (k, f) => (k in dados ? String(dados[k]) : f),
    set: (k, v) => { dados[k] = v; },
    getBool: (k, f = false) => (k in dados ? dados[k] === true || dados[k] === 'true' : f),
    setBool: (k, on) => { dados[k] = on; },
    getNum: (k, f = 0) => (k in dados ? Number(dados[k]) : f),
    KEYS: { letterCase: 'incl_lettercase', captions: 'incl_captions', menuIndex: 'incl_menuindex', cbsafe: 'incl_cbsafe', ownercolors: 'incl_ownercolors', outfg: 'incl_outfg', outbg: 'incl_outbg' },
  };
}

describe('the stored caption rate', () => {
  beforeEach(() => { state.loadState(portaFalsa()); });

  it('🎯 [Zero] nothing stored is 125, the slowest of the three', () => {
    expect(state.captionPpm).toBe(125);
  });

  it('🔴 [Right] it is loaded from the child\'s storage and written back', () => {
    const p = portaFalsa({ incl_caption_ppm: 175 });
    state.loadState(p);
    expect(state.captionPpm).toBe(175);
    state.setCaptionPpmValue(145);
    expect(state.captionPpm).toBe(145);
    expect(p.dados.incl_caption_ppm).toBe(145);
  });

  it('🎯 [Boundary] a stored typo lands on 125', () => {
    state.loadState(portaFalsa({ incl_caption_ppm: 160 }));
    expect(state.captionPpm).toBe(125);
  });
});

// ============================== MUTATIONS CHECKED ==============================
//   R1 the rate ignored · R2 no floor · R3 a typo reads as the fastest · R4 setter does not store · R5 load ignores it   🔴 each
//   (R6–R8 in `ritmo-da-legenda.browser`)
