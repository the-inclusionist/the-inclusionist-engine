// SPDX-License-Identifier: AGPL-3.0-or-later
// THE SONAR TAKES TURNS, through the real root (ADR-0234, errata 2026-09-26 — the Dev: «em fila, não junto ao mesmo tempo com
// outro sonar em andamento», «outro jogador não corta, mas um jogador corta a si mesmo»).
//
// 📌 `tests/the-sonar-takes-turns.node.test.js` holds the rule in `platform/tts`; this file holds the WIRING: that the sonar in
// play (`platform/audio-sonar`) and the sonar with a menu open (`menuAnswers`, any seat's R1 on a shared screen) hand the
// narration the seat that pressed. A lent host's speech synthesis behaves as the browser's — one utterance at a time, `cancel`
// ending the one playing — and records every utterance; nothing speaks aloud.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { SEM_ASSUNTO } from './fixtures/accommodation-answers.js';

const declaration = () => ({
  topology: () => ({ kind: 'hotspots', order: ['q1'] }), holdsAtOnce: () => 1, holdsKeys: () => false, tick: 'player',
  world: () => ({ kind: 'element', selector: '#world' }), roleAt: () => 'goal',
  nameAt: () => ({ text: 'pergunta', gender: 'f', plural: false }), focusOf: () => ({ id: 'p0', at: { x: 0, y: 0 }, heading: 'none' }),
  objectiveOf: () => ({ name: { text: 'perguntas', gender: 'f', plural: true }, have: 0, need: 1 }), targetsOf: () => [{ x: 0, y: 0 }],
});

/** The real window, with `own` answering first (the lent host of `tests/a-spoken-text-carries-its-language.browser.test.js`). */
const hostWith = (own) => new Proxy(window, {
  get(target, prop) {
    if (Object.hasOwn(own, prop)) return own[prop];
    const v = Reflect.get(target, prop);
    return typeof v === 'function' && !Object.hasOwn(v, 'prototype') ? v.bind(target) : v;
  },
});
class HostUtterance { constructor(text) { this.text = text; this.lang = ''; this.voice = null; this.volume = 0; this.rate = 0; } }
const LUCIANA = { name: 'Luciana', lang: 'pt-BR' };

let spoken = [], playing = [], cut = [];
const synth = {
  speak(u) { spoken.push(u); playing.push(u); },
  cancel() { for (const u of playing.splice(0)) { cut.push(u.text); u.onerror?.({ error: 'interrupted' }); } },
  getVoices: () => [LUCIANA], onvoiceschanged: null,
};
const said = () => spoken.map((u) => u.text);
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
/** The utterance playing reaches its end. */
const ends = async () => { playing.shift()?.onend?.({}); await settle(); };

let raiz, motor;
/** R1 on the virtual controller for a seat, the way the eyes, the face, the hands, the voice and the scan press it. */
const r1 = (seat) => { motor.controller.press('rightShoulder', 'olhos', seat); motor.controller.release('rightShoulder', 'olhos', seat); };

beforeAll(async () => {
  const { createGame } = await import('../app/js/boot/create-game.js');
  raiz = document.createElement('div');
  raiz.innerHTML = '<p id="sr-status" role="status"></p><p id="sr-alert" role="alert"></p>'
    + '<div id="game-region" tabindex="-1"><div id="world"></div></div><div id="title-icons"></div>';
  document.body.appendChild(raiz);
  motor = createGame({
    accommodations: SEM_ASSUNTO, declaration: declaration(), downloadHeavy: false,
    host: { doc: document, win: hostWith({ speechSynthesis: synth, SpeechSynthesisUtterance: HostUtterance }) },
    players: [{ ctrl: 0 }, { ctrl: 0 }], onCommand: () => {}, setPhase: () => {},
  });
  await motor.localeReady();
  motor.audio.audioCat.tts.on = true; // narration is born off (the mixer's BORN_OFF); the child turned it on
});
afterAll(() => { motor?.dispose(); raiz?.remove(); document.querySelectorAll('[id^="vp-pause-"]').forEach((c) => c.remove()); });
beforeEach(async () => {
  synth.cancel();
  await settle();
  spoken = []; playing = []; cut = [];
});

describe('in play, the sonar of each seat', () => {
  it('🔴 [Right] seat 0 then seat 1: the second is spoken after the first ends, and both complete', async () => {
    motor.sonar.sonar({ i: 0, x: 0, y: 0 });
    motor.sonar.sonar({ i: 1, x: 0, y: 0 });
    expect(said(), 'seat 1\'s sonar was spoken on top of seat 0\'s').toHaveLength(1);
    expect(said()[0]).toMatch(/^Jogador 1: /);
    expect(cut, 'seat 1\'s sonar cut seat 0\'s').toEqual([]);
    await ends();
    expect(said(), 'seat 1\'s sonar was not spoken when seat 0\'s ended').toHaveLength(2);
    expect(said()[1]).toMatch(/^Jogador 2: /);
    await ends();
    expect(cut).toEqual([]);
  });

  it('🔴 [Right] with text on the screen, seat 1 reads it after seat 0 has', async () => {
    const world = document.getElementById('world');
    world.textContent = 'Quanto é 2 mais 3?';
    try {
      motor.sonar.sonar({ i: 0, x: 0, y: 0 });
      motor.sonar.sonar({ i: 1, x: 0, y: 0 });
      await settle();
      expect(said(), 'seat 1 read the screen on top of seat 0').toEqual(['Quanto é 2 mais 3?']);
      await ends();
      expect(said()).toEqual(['Quanto é 2 mais 3?', 'Quanto é 2 mais 3?']);
      expect(cut).toEqual([]);
    } finally { world.textContent = ''; }
  });

  it('🔴 [Right] the same seat twice: the second replaces the first', () => {
    motor.sonar.sonar({ i: 1, x: 0, y: 0 });
    motor.sonar.sonar({ i: 1, x: 0, y: 0 });
    expect(said(), 'a seat\'s newer sonar waited behind its own').toHaveLength(2);
    expect(cut, 'the older reading was not cut').toEqual([said()[0]]);
  });
});

describe('with a menu open, any seat\'s R1 reads it — in turn', () => {
  async function withCard(run) {
    motor.pause.show(0);
    await settle();
    synth.cancel(); await settle(); spoken = []; playing = []; cut = [];
    try { await run(); } finally { motor.pause.hide(0); }
  }

  it('🔴 [Right] seat 0 then seat 1 on the shared screen: the card is read twice, the second after the first ends', async () => {
    await withCard(async () => {
      r1(0);
      r1(1);
      expect(said(), 'R1 did not read the card, or seat 1 overlapped seat 0').toHaveLength(1);
      expect(said()[0], 'R1 did not read the card').toContain(motor.t('pause.title'));
      await ends();
      expect(said(), 'seat 1\'s reading of the card was lost').toHaveLength(2);
      expect(said()[1]).toBe(said()[0]);
      await ends();
      expect(cut, 'a reading was cut').toEqual([]);
    });
  });

  it('🔴 [Right] seat 0 twice: the second replaces the first', async () => {
    await withCard(async () => {
      r1(0);
      r1(0);
      expect(said()).toHaveLength(2);
      expect(cut).toEqual([said()[0]]);
    });
  });

  it('🎯 [Right] a narration that names no player still cuts the reading, as it always did', async () => {
    await withCard(async () => {
      r1(0);
      r1(1);
      motor.tts.narrate('Pergunta nova');
      expect(said().at(-1), 'the narration waited for the sonar').toBe('Pergunta nova');
      expect(cut).toEqual([said()[0]]);
      await ends();
      expect(said().at(-1), 'a reading of the old screen was spoken after the new narration').toBe('Pergunta nova');
    });
  });
});

// ===== MUTATIONS CHECKED (2026-09-26) =====
// Applied one at a time by a script that counts the occurrences before replacing, each restored from a copy and checked by SHA-256:
// W1. `boot/create-game.ts` narrates deaf mode's `speak` without the seat → red: in play seat 0 then 1, the card, the narration
// W2. `menuAnswers` hands deaf mode no seat                               → red: the card, the narration
// A1. `platform/audio-sonar.ts` narrates the navigation sentence with no seat → red: in play seat 0 then 1
// A2. `platform/audio-sonar.ts` narrates the screen's text with no seat   → red: text on the screen
// V1. `ui/vlibras.ts` deaf mode off speaks without the seat               → red: in play seat 0 then 1, the card, the narration
// (The rule itself is held in `tests/the-sonar-takes-turns.node.test.js`.)
