// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/vlibras — DEAF MODE (ADR-0234): «não existe modo libras, mas modo pessoa surda: sons ganham legenda e o sonar chama o
// intérprete». Node project: the mode is logic over ports, and the interpreter here is a DOUBLE of the port — text in, a
// result out — so no case touches a player or the network.
//
// THE CONTRACT: the state is the PERSON'S CHOICE, persisted. With the mode on, what the sonar found is captioned and handed
// to the interpreter; with it off, it is spoken. An interpreter that cannot sign leaves the captions and the text working,
// puts a line in `problems`, and the child is told.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, beforeEach } from 'vitest';
import { createDeafMode, signingUnavailableLine, NO_INTERPRETER } from '../app/js/ui/vlibras.js';
import { createTranslator } from '../app/js/core/i18n.js';
import { createStorage, memoryBackend } from '../app/js/platform/storage.js';
import pt from '../app/js/i18n/pt.js';

const t = createTranslator().t; // the root's translator, played by the test (ADR-0232 D3)
const settle = () => new Promise((r) => { setTimeout(r, 0); });

/** A double of the interpreter port: what it was asked to sign, what it answers, and whether it is on screen. */
function interpreterDouble(answer = () => Promise.resolve({ signed: true })) {
  const d = { asked: [], hidden: 0, disposed: false };
  d.port = {
    sign: (text) => { d.asked.push(text); return answer(text); },
    hide: () => { d.hidden++; },
    dispose: () => { d.disposed = true; },
  };
  return d;
}

let backend;
/** A deaf mode over this case's own store and ports. */
function build(interpreter = interpreterDouble()) {
  const out = { spoken: [], captions: [], told: [], problems: [], interpreter, captionsSetting: false };
  out.mode = createDeafMode({
    store: createStorage(backend),
    captionsSetting: () => out.captionsSetting,
    t,
    interpreter: interpreter.port,
    speak: (text) => { out.spoken.push(text); },
    caption: (text) => { out.captions.push(text); },
    tell: (text) => { out.told.push(text); },
    report: (line) => { out.problems.push(line); },
  });
  return out;
}
const unavailable = (reason = 'offline') => interpreterDouble(() => Promise.resolve({ signed: false, reason }));

beforeEach(() => {
  backend = memoryBackend(); // each case its own store: nothing stored, so the mode starts off
});

const SONAR = 'Sonar: primeira pergunta à direita, bem perto.';

describe('ui/vlibras — one setting, and the state is ours', () => {
  it('🔴 [Right] the toggle flips and persists', () => {
    const s = build();
    expect(s.mode.isOn()).toBe(false);
    s.mode.toggle();
    expect(s.mode.isOn()).toBe(true);
    expect(backend.getItem('incl_libras')).toBe('1');
    s.mode.toggle();
    expect(s.mode.isOn()).toBe(false);
    expect(backend.getItem('incl_libras')).toBe('0');
  });

  it('🔴 [Right] building READS the stored choice — at build, never at import (ADR-0232)', () => {
    backend = memoryBackend([['incl_libras', '1']]);
    expect(build().mode.isOn(), 'the child who left deaf mode on found it off').toBe(true);
  });

  it('🔴 [Right] every sound is captioned in deaf mode — and with it off, the captions setting alone decides', () => {
    const s = build();
    expect(s.mode.captionsOn(), 'captions off and deaf mode off, and a sound would be captioned').toBe(false);
    s.captionsSetting = true;
    expect(s.mode.captionsOn(), 'the child\'s captions setting was ignored').toBe(true);
    s.captionsSetting = false;
    s.mode.toggle();
    expect(s.mode.captionsOn(), 'deaf mode is on and a sound would go uncaptioned').toBe(true);
  });

  it('[Interface] tells the reflow in BOTH directions, and the release silences it', () => {
    const s = build();
    let n = 0;
    const release = s.mode.onChange(() => { n++; });
    s.mode.toggle();
    s.mode.toggle();
    expect(n).toBe(2);
    release();
    s.mode.toggle();
    expect(n, 'a released reflow still ran').toBe(2);
  });

  it('🎯 [Boundary] two deaf modes share nothing', () => {
    const first = build();
    const second = build();
    first.mode.toggle();
    expect(second.mode.isOn(), 'one root\'s deaf mode switched another root\'s').toBe(false);
  });
});

describe('ui/vlibras — the sonar calls the interpreter', () => {
  it('🔴 [Right] deaf mode on: the sonar hands EXACTLY its text to the interpreter, captions it, and speaks nothing', async () => {
    const s = build();
    s.mode.toggle();
    s.mode.sonar(SONAR);
    expect(s.interpreter.asked).toEqual([SONAR]);
    expect(s.captions, 'the text was not written: written Portuguese is never removed').toEqual([SONAR]);
    expect(s.spoken, 'deaf mode still spoke the sonar').toEqual([]);
    await settle();
    expect(s.told, 'a signed text was reported as unavailable').toEqual([]);
    expect(s.problems).toEqual([]);
  });

  it('🔴 [Right] deaf mode off: the sonar SPEAKS, as it always did, and asks no interpreter', () => {
    const s = build();
    s.mode.sonar(SONAR);
    expect(s.spoken).toEqual([SONAR]);
    expect(s.interpreter.asked).toEqual([]);
    expect(s.captions).toEqual([]);
  });

  it('🔴 [Right] toggling off takes the interpreter off the screen', () => {
    const s = build();
    s.mode.toggle();
    s.mode.sonar(SONAR);
    expect(s.interpreter.hidden).toBe(0);
    s.mode.toggle();
    expect(s.interpreter.hidden, 'deaf mode is off and the interpreter stayed on screen').toBe(1);
  });
});

describe('ui/vlibras — an interpreter that cannot sign never leaves her with nothing (ADR-0169)', () => {
  it('🔴 [Right] `problems` gets a line, the child is told and it is written after the sonar\'s text, and the captions keep working', async () => {
    const s = build(unavailable('the player is offline'));
    s.mode.toggle();
    s.mode.sonar(SONAR);
    await settle();
    expect(s.problems).toEqual([signingUnavailableLine('the player is offline')]);
    expect(s.problems[0]).toMatch(/sign-language interpreter/); // the subject by name
    expect(s.problems[0]).toMatch(/deaf child keeps/);          // the child's cost
    expect(s.problems[0]).toMatch(/give deaf mode a Libras player/); // the fix
    expect(s.told, 'the child was not told signing is unavailable').toEqual([pt['sr.deaf.noSigning']]);
    expect(s.captions, 'she is deaf: told only through the announcer, she was not told — or the sonar\'s text was lost')
      .toEqual([SONAR, `${SONAR} ${pt['sr.deaf.noSigning']}`]);
  });

  it('🎯 [Right] she is told ONCE while the mode stays on, `problems` holds ONE line, and every press still writes its text', async () => {
    const s = build(unavailable());
    s.mode.toggle();
    s.mode.sonar(SONAR);
    await settle();
    s.mode.sonar('segunda');
    await settle();
    expect(s.told.length, 'the notice was repeated at every press').toBe(1);
    expect(s.captions.at(-1)).toBe('segunda');
    expect(s.problems.length, 'one diagnosis became one line per press').toBe(1);
    s.mode.toggle();
    s.mode.toggle(); // turned on again: she is told again
    s.mode.sonar('terceira');
    await settle();
    expect(s.told.length, 'turned on again, she was not told').toBe(2);
  });

  it('🔴 [Right] an interpreter that REJECTS or THROWS is the same «unavailable», not a crash', async () => {
    const rejects = build(interpreterDouble(() => Promise.reject(new Error('broken player'))));
    rejects.mode.toggle();
    rejects.mode.sonar(SONAR);
    await settle();
    expect(rejects.problems).toEqual([signingUnavailableLine('broken player')]);
    backend = memoryBackend(); // a store of its own: the first one keeps the mode stored on
    const throws = build(interpreterDouble(() => { throw new Error('no player'); }));
    throws.mode.toggle();
    expect(() => { throws.mode.sonar(SONAR); }).not.toThrow();
    await settle();
    expect(throws.problems).toEqual([signingUnavailableLine('no player')]);
    expect(throws.captions[0]).toBe(SONAR);
  });

  it('🎯 [Zero] an answer that arrives after the mode was turned off tells nobody', async () => {
    let answer;
    const s = build(interpreterDouble(() => new Promise((r) => { answer = r; })));
    s.mode.toggle();
    s.mode.sonar(SONAR);
    s.mode.toggle();
    answer({ signed: false, reason: 'offline' });
    await settle();
    expect(s.told).toEqual([]);
    expect(s.problems).toEqual([]);
  });

  it('🔴 [Right] where the delivery carries no player, the interpreter says why it cannot sign, and how to fix it', async () => {
    const result = await NO_INTERPRETER.sign(SONAR);
    expect(result.signed).toBe(false);
    expect(result.reason).toMatch(/a Libras player is not installed in this delivery .*--libras/);
    const s = build({ port: NO_INTERPRETER, asked: [] });
    s.mode.toggle();
    s.mode.sonar(SONAR);
    await settle();
    expect(s.problems[0]).toMatch(/a Libras player is not installed in this delivery/);
    expect(s.told).toEqual([pt['sr.deaf.noSigning']]);
  });
});

describe('ui/vlibras — dispose releases the interpreter', () => {
  it('🔴 [Right] dispose releases the interpreter, and an answer still on its way is dropped', async () => {
    let answer;
    const s = build(interpreterDouble(() => new Promise((r) => { answer = r; })));
    s.mode.toggle();
    s.mode.sonar(SONAR);
    s.mode.dispose();
    expect(s.interpreter.disposed).toBe(true);
    answer({ signed: false, reason: 'offline' });
    await settle();
    expect(s.told, 'a disposed root still told the child').toEqual([]);
  });
});

// ========================= MUTATIONS CHECKED =========================
// (2026-09-25, each run on `ui/vlibras.ts` and restored — all 24 red)
//   M1 `NO_INTERPRETER` answering «signed»                              🔴 «where the delivery carries no player»
//   M2 `disposed` ignored · M20 `dispose` not releasing the interpreter 🔴 «dispose releases»
//   M3 an answer heard with the mode off                                🔴 [Zero] «after the mode was turned off»
//   M4 a SIGNED answer reported as unavailable                          🔴 «hands EXACTLY its text»
//   M5 no dedupe · M6/M7 told at every press · M10 not told again after turning on  🔴 «told ONCE»
//   M8 the notice not written · M9 not told · M23 the line without its fix  🔴 «`problems` gets a line»
//   M11 off not hiding the interpreter                                  🔴 «toggling off»
//   M12 the choice not stored · M21 the stored choice not read          🔴 «flips and persists» · «READS»
//   M13 the reflow not told · M22 its release doing nothing              🔴 [Interface]
//   M14 off not speaking                                                🔴 «deaf mode off: the sonar SPEAKS»
//   M15 the sonar's text not captioned · M16 the interpreter not asked  🔴 several, «hands EXACTLY» first
//   M17 a THROWN sign escaping · M18 a REJECTED sign unhandled           🔴 «REJECTS or THROWS»
//   M19 `captionsOn` as the setting alone, or as the mode alone          🔴 «every sound is captioned»
