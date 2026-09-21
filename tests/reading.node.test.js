// SPDX-License-Identifier: AGPL-3.0-or-later
// THE CHILD READS ALOUD AND THE GAME RECEIVES TEXT (ADR-0216, issue #200) — the Dev, 2026-09-21: «O jogo não deve precisar saber como
// isso funciona, apenas deve pedir para ouvir e receber o texto.»
//
// No microphone here: the browser's recogniser is a double, and the clock is the case's. What must hold is the promise the engine
// makes to a child — a reading ends when she stops talking, what she said arrives even if she stops mid-sentence, a second request
// does not open a second microphone, and a device that cannot hear her language SAYS SO instead of answering with a recogniser that
// would send her voice to a server.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { createReading } from '../app/js/platform/reading.js';

/** A recogniser that recognises on the device, with the pieces this module reads. */
const browserApi = (state = 'available') => {
  const made = [];
  function Rec() { made.push(this); this.lang = ''; this.processLocally = false; this.continuous = false; this.interimResults = false; }
  Rec.prototype = { processLocally: false, start() {}, stop() {} };
  Rec.available = async () => state;
  return { Rec, made };
};

/** A clock the case moves by hand: `every` remembers the tick, `advance` runs it as many times as the case says. */
function ticker() {
  let t = 0; const ticks = [];
  return {
    now: () => t,
    every: (fn) => { ticks.push(fn); return fn; },
    stopEvery: (h) => { const i = ticks.indexOf(h); if (i >= 0) ticks.splice(i, 1); },
    advance(ms, step = 100) { for (let i = 0; i < ms; i += step) { t += step; for (const fn of [...ticks]) fn(); } },
  };
}

/** The session only exists after the browser has answered whether it can hear this language — wait for it, do not guess a tick. */
const theSession = async (sessions, n = 1) => { for (let i = 0; i < 50 && sessions.length < n; i++) await Promise.resolve(); return sessions[n - 1]; };

const heard = (session, text, final = false) => session.onresult({ results: Object.assign([[{ transcript: text }]], { isFinal: final }) });

function build({ state = 'available', model, record, language = 'pt-BR' } = {}) {
  const { Rec } = browserApi(state);
  const r = ticker();
  const reports = [];
  const sessions = [];
  const reading = createReading({
    language: () => language, api: Rec, now: r.now, every: r.every, stopEvery: r.stopEvery,
    report: (l) => reports.push(l), model, record,
    createSession: () => {
      const s = { lang: language, start() { this.started = true; }, stop() { this.stopped = true; }, onresult: null, onerror: null, onend: null };
      sessions.push(s);
      return s;
    },
  });
  return { reading, r, reports, sessions };
}

describe('a reading heard on the device', () => {
  it('🔴 [Right] answers with what the child read, once she goes quiet', async () => {
    const { reading, r, sessions } = build();
    const p = reading.listen();
    heard(await theSession(sessions), 'as maos dadas');
    r.advance(1600);
    const o = await p;
    expect(o.text).toBe('as maos dadas');
    expect(o.ended).toBe('silence');
    expect(o.route).toBe('webspeech-local');
    expect(sessions[0].stopped, 'the microphone was not given back').toBe(true);
  });

  it('🔴 [Right] a child who keeps reading past the ceiling is stopped by it, with everything heard so far', async () => {
    // ⚠️ THIS CASE WAS WRONG FIRST TIME and the module was right: it paused the child for a second between two words, so the
    // SILENCE ended the reading before the ceiling could. To measure the ceiling, the child may never go quiet.
    const { reading, r, sessions } = build();
    const p = reading.listen({ maxMs: 3000 });
    const session = await theSession(sessions);
    for (const words of ['era', 'era uma', 'era uma vez', 'era uma vez um', 'era uma vez um menino']) {
      heard(session, words);
      r.advance(800);         // always less than the 1.5 s of silence: only the ceiling can end this
    }
    const o = await p;
    // the ceiling falls during the fourth pause (3.2 s), so «menino» was never said: what came back is everything heard UNTIL then
    expect([o.text, o.ended]).toEqual(['era uma vez um', 'timeout']);
  });

  it('📌 [Boundary] the text arrives without any FINAL result: a hypothesis is what a child who stopped leaves behind', async () => {
    const { reading, r, sessions } = build();
    const p = reading.listen();
    heard(await theSession(sessions), 'o gato', false);
    r.advance(1600);
    expect((await p).text).toBe('o gato');
  });

  it('🔴 [Right] `stop()` gives the microphone back at once, with what was heard', async () => {
    const { reading, sessions } = build();
    const p = reading.listen();
    heard(await theSession(sessions), 'meio');
    reading.stop();
    expect(await p).toMatchObject({ text: 'meio', ended: 'asked' });
    expect(sessions[0].stopped).toBe(true);
  });

  it('🔴 [Zero] asking twice does not open a second microphone', async () => {
    const { reading, r, sessions } = build();
    const a = reading.listen();
    await theSession(sessions);
    const b = reading.listen();
    heard(sessions[0], 'uma so');
    r.advance(1600);
    expect(await a).toEqual(await b);
    expect(sessions.length, 'a second reading opened a second microphone').toBe(1);
  });

  it('⚠️ [Error] a recogniser that fails says why, once, and the promise does not hang', async () => {
    const { reading, reports, sessions } = build();
    const p = reading.listen();
    (await theSession(sessions)).onerror({ error: 'not-allowed' });
    await expect(p).rejects.toThrow(/not-allowed/);
    const second = reading.listen();
    (await theSession(sessions, 2)).onerror({ error: 'not-allowed' });
    await expect(second).rejects.toThrow();
    expect(reports, 'the same reason was written twice into problems').toHaveLength(1);
    expect(reports[0]).toMatch(/microphone/);
  });
});

describe('a device that cannot hear this child', () => {
  it('🔴 [Zero] with no route and no model, the reading is REFUSED and says why — never a recogniser that leaves the device', async () => {
    const { reading, reports } = build({ state: 'downloadable' });
    expect(await reading.ready()).toEqual({ can: false, why: 'no-model' });
    await expect(reading.listen()).rejects.toThrow(/not available here: downloadable/);
    expect(reports[0]).toMatch(/nothing on this device can hear pt-BR/);
  });

  it('🔴 [Right] with the engine\'s own model, the same request is answered by it', async () => {
    const asked = [];
    const ouvido = [];
    const { reading } = build({
      state: 'unavailable',
      model: async (language) => { asked.push(language); return { transcribe: async (s) => { ouvido.push(s.length); return '  o menino  '; } }; },
      record: async (options) => new Float32Array(options.maxMs === 5000 ? 8 : 16),
    });
    expect(await reading.ready()).toEqual({ can: true, why: 'unavailable' });
    expect(await reading.listen({ maxMs: 5000 })).toEqual({ text: 'o menino', route: 'model', ended: 'silence' });
    expect(asked, 'the model was not asked for the child\'s language').toEqual(['pt-BR']);
    expect(ouvido, 'the model read something other than what was recorded for THIS request').toEqual([8]);
  });

  /**
   * ⚠️ A READING WITH A MODEL AND NO MICROPHONE IS NOT A READING OF NOTHING. Answering an empty sentence would reach a child as
   * «you read nothing» — the two failures look identical to a game, and only one of them is about her.
   */
  it('⚠️ [Error] the model is here and nothing captures her voice: it REFUSES, and says which half is missing', async () => {
    const { reading, reports } = build({ state: 'unavailable', model: async () => ({ transcribe: async () => 'x' }) });
    await expect(reading.listen()).rejects.toThrow(/microphone/);
    expect(reports.some((l) => /nothing captures the child's voice/.test(l)), 'the missing half was not named').toBe(true);
  });

  it('📌 [Boundary] the browser is only the route when it says «available» — «downloading» is not «works»', async () => {
    // ⚠️ A language the browser is still DOWNLOADING would hear nothing today, and a mutation that read it as working survived
    // until `ready()` was asked about it too — `listen()` alone could not see it, because it falls back either way.
    for (const state of ['downloadable', 'downloading', 'unavailable']) {
      const { reading } = build({ state, model: async () => ({ transcribe: async () => 'x' }), record: async () => new Float32Array(16) });
      expect((await reading.listen()).route, `${state} was taken for a working recogniser`).toBe('model');
      expect(await reading.ready(), `${state} answered as if the browser could hear`).toEqual({ can: true, why: state });
      const withoutModel = build({ state }).reading;
      expect(await withoutModel.ready(), `${state} promised a reading nothing can serve`).toEqual({ can: false, why: 'no-model' });
    }
  });
});

// MUTATIONS CHECKED (2026-09-21) — `scratchpad/mutar-reading.py`:
//   · the silence never ends the reading            → «answers with what the child read»
//   · the ceiling never ends it                     → «a child who stops mid-sentence»
//   · `stop()` does not stop the session           → «gives the microphone back at once»
//   · a second request opens a second microphone    → «does not open a second microphone»
//   · the failure is written to problems every time → «says why, once»
//   · with no route, the browser is used anyway     → «the reading is REFUSED»
//   · «downloading» taken as a working recogniser   → «only the route when it says available»
