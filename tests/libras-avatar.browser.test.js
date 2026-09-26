// SPDX-License-Identifier: AGPL-3.0-or-later
// THE INTERPRETER THAT SIGNS (ADR-0234, route B; `ui/libras-avatar-player`, the root's own since phase B3) — the `Interpreter`
// port, held against a TINY delivery (`tests/fixtures/libras-avatar/tiny-delivery.js`): a real glTF avatar and real three.js clips,
// drawn by the real stage in this browser, served through the `fetch` the interpreter is given. What is held is the Dev's
// rules for the interpreter: the avatar appears at the bottom right when a request is played, signs the gloss's clips in order
// (a word with no clip fingerspelled from the digit and letter clips), answers when the last clip ends, LEAVES the screen some
// seconds after it stopped — five by default — unless a new press comes first, and leaves at once when deaf mode or the root
// does. And the two things the export hands over that the stage must answer: the face's track reaches both meshes of the head,
// and a part of the avatar a clip does not move goes back to rest.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLibrasAvatarInterpreter } from '../app/js/ui/libras-avatar-player.js';
import { NO_INTERPRETER } from '../app/js/ui/vlibras.js';
import { createAvatarStage } from '../app/js/ui/libras-avatar-stage.js';
import { tinyDelivery, HAND_REST_Y } from './fixtures/libras-avatar/tiny-delivery.js';

const TITLE = 'Intérprete de Libras';
const BASE = `${location.origin}/delivery/`;
/** A quick leave for the cases that are not about its length. */
const LEAVE = 300;

const made = [];
/** An interpreter over the tiny delivery, its stage spied on: every clip it started, in order, and the stage itself. */
async function interpreter({ delivery = {}, ...extra } = {}) {
  const served = await tinyDelivery(BASE, delivery);
  const spy = { started: [], starts: [], stage: null };
  const it = createLibrasAvatarInterpreter({
    doc: document, win: window, fetch: served.fetch, base: BASE, title: () => TITLE, leaveAfterMs: LEAVE,
    loadStage: async (canvas, avatar) => {
      const stage = await createAvatarStage({ canvas, avatar });
      spy.stage = stage;
      return { ...stage, start: (name, fade, at) => {
        spy.started.push(name);
        spy.starts.push({ name, fade, at, t: performance.now() });
        stage.start(name, fade, at);
      } };
    },
    ...extra,
  });
  made.push(it);
  return { it, spy, asked: served.asked };
}
const avatar = () => document.querySelector(`canvas[aria-label="${TITLE}"]`);
const until = (check, timeout = 10_000) => vi.waitFor(check, { timeout, interval: 20 });
/** A promise's state without waiting for it: `pending`, or what it resolved with. */
const peek = async (p) => Promise.race([p, new Promise((r) => { setTimeout(() => r('pending'), 30); })]);
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

afterEach(() => {
  vi.useRealTimers();
  for (const it of made.splice(0)) it.dispose();
});

describe('ui/libras-avatar-player — the port, by the Dev\'s rules', () => {
  it('🔴 [Right] a request makes the avatar appear at the bottom right, in front of the screen, never taking the keyboard', async () => {
    const { it: vl } = await interpreter();
    const answer = vl.sign('gato');
    await until(() => { expect(avatar()?.hidden).toBe(false); });
    const style = avatar().style;
    expect([style.position, style.right, style.bottom], 'the avatar is not at the bottom right').toEqual(['fixed', '0px', '0px']);
    expect(style.pointerEvents, 'the avatar catches the pointer the game should get').toBe('none');
    expect(avatar().tabIndex, 'the avatar took the keyboard from the game').toBe(-1);
    expect(avatar().getAttribute('role')).toBe('img');
    expect(await answer).toEqual({ signed: true });
  });

  it('🔴 [Right] the gloss\'s clips are signed IN ORDER — the delivery\'s gloss first, a word with no clip fingerspelled as written', async () => {
    const { it: vl, spy } = await interpreter({ delivery: { glosses: [['Os bichos.', 'GATO GALINHA CAVALO PEIXE [PONTO]']] } });
    expect(await vl.sign('Os bichos.')).toEqual({ signed: true });
    expect(spy.started).toEqual(['GATO', 'GALINHA', 'CAVALO', 'PEIXE']);
    // what was DRAWN, not only what was asked: each fake clip lifts the hand to its own height, and the last one's is held
    expect(spy.stage.scene.getObjectByName('Hand').position.y, 'the stage played another clip than the one it was asked for')
      .toBeCloseTo(3.5, 3);
    spy.started.length = 0;
    expect(await vl.sign('gato 21')).toEqual({ signed: true });
    expect(spy.started, 'the number was not fingerspelled digit by digit, in order').toEqual(['GATO', '2', '1']);
  });

  /**
   * 🔴 A SPELLED WORD IS SIGNED WITH THE HAND HELD UP BETWEEN ITS LETTERS (the Dev, interface log 2026-09-26). «OPA» has no sign:
   * O, P and A are spelled, each letter a 0.6 s clip whose hand is up from 0.2 s to 0.4 s (A still, up its whole clip), as the
   * manifest says. What is held is what was DRAWN: from O's hand up to the word's end, the hand never goes back toward its rest —
   * signed whole, O's fall and P's rise cross at 2.6, a third of the way down.
   */
  it('🔴 [Right] a fingerspelled word is CHAINED: each letter after the first starts where its hand is up, and the hand stays up to the end', async () => {
    const { it: vl, spy } = await interpreter();
    const hand = [];
    let sampling = true;
    const sample = () => { if (!sampling) return; const h = spy.stage?.scene.getObjectByName('Hand'); if (h) hand.push([performance.now(), h.position.y]); requestAnimationFrame(sample); };
    requestAnimationFrame(sample);
    expect(await vl.sign('opa')).toEqual({ signed: true });
    sampling = false;
    expect(spy.starts.map((s) => s.name)).toEqual(['O', 'P', 'A']);
    expect(spy.starts[0].at, 'the first letter lost its rise').toBe(0);
    expect(spy.starts[1].at, 'P rose again from the arms-down pose').toBeGreaterThanOrEqual(0.2);
    expect(spy.starts[2].at, 'the still A did not start at its first frame').toBeLessThan(0.1);
    const from = spy.starts[0].t + 250;
    const to = spy.starts[2].t + 450;
    const between = hand.filter(([t]) => t > from && t < to).map(([, y]) => y);
    expect(between.length, 'no frame was drawn while the word was signed').toBeGreaterThan(5);
    expect(Math.min(...between), 'the hand went down between two letters of one word').toBeGreaterThan(2.9);
    // and it still leaves the screen after it stopped
    await until(() => { expect(avatar().hidden).toBe(true); });
  });

  it('🔴 [Right] the request resolves when the LAST clip reached its end — not when the first did', async () => {
    const { it: vl, spy } = await interpreter();
    const answer = vl.sign('gato galinha cavalo');
    await until(() => { expect(spy.started).toEqual(['GATO']); });
    expect(await peek(answer), 'the request resolved while the avatar was still signing').toBe('pending');
    await until(() => { expect(spy.started).toEqual(['GATO', 'GALINHA', 'CAVALO']); });
    expect(await peek(answer)).toBe('pending');
    expect(await answer).toEqual({ signed: true });
  });

  it('🔴 [Right] the avatar LEAVES the screen five seconds after it stopped — hidden, not unloaded', async () => {
    const { it: vl } = await interpreter({ leaveAfterMs: undefined });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await vl.sign('gato');
    expect(avatar().hidden, 'the avatar left the moment it stopped').toBe(false);
    vi.advanceTimersByTime(4999);
    expect(avatar().hidden, 'the avatar left before five seconds').toBe(false);
    vi.advanceTimersByTime(1);
    expect(avatar().hidden, 'the avatar stayed after its five seconds').toBe(true);
    expect(avatar(), 'the avatar was unloaded instead of hidden').not.toBeNull();
  });

  it('🎯 [Right] a press in those seconds CANCELS the leaving: the avatar stays, and signs again at once', async () => {
    const { it: vl, spy } = await interpreter();
    await vl.sign('gato');
    await sleep(LEAVE / 2);
    const again = vl.sign('peixe');
    await sleep(LEAVE / 2 + 100); // past the first leaving's end
    expect(avatar().hidden, 'the first request\'s leaving took away the avatar signing the second').toBe(false);
    await again;
    expect(spy.started).toEqual(['GATO', 'PEIXE']);
    await until(() => { expect(avatar().hidden).toBe(true); });
  });

  it('🔴 [Right] a new press REPLACES what is being signed: the old request is answered «signed», the new one is signed', async () => {
    const { it: vl, spy } = await interpreter();
    const first = vl.sign('gato galinha cavalo peixe');
    await until(() => { expect(spy.started).toEqual(['GATO']); });
    const second = vl.sign('peixe');
    expect(await first).toEqual({ signed: true });
    expect(await second).toEqual({ signed: true });
    expect(spy.started, 'the replaced queue went on signing').toEqual(['GATO', 'PEIXE']);
  });

  it('🔴 [Right] `hide()` takes it off at once and answers what it was signing «not signed»; `dispose()` removes it', async () => {
    const { it: vl, spy } = await interpreter();
    const answer = vl.sign('gato galinha');
    await until(() => { expect(spy.started).toEqual(['GATO']); });
    vl.hide();
    expect(avatar().hidden).toBe(true);
    expect(await answer).toEqual({ signed: false, reason: 'the interpreter was taken off the screen before it signed' });
    await sleep(600);
    expect(spy.started, 'the hidden avatar kept signing').toEqual(['GATO']);
    vl.dispose();
    expect(avatar(), 'the released avatar is still in the document').toBeNull();
  });
});

describe('ui/libras-avatar-player — what it reports (ADR-0169)', () => {
  it('🔴 [Right] a word it can neither sign nor fingerspell is left out and SAID; the rest is signed', async () => {
    const { it: vl, spy } = await interpreter();
    const answer = await vl.sign('gato bebe');
    expect(answer.signed).toBe(true);
    expect(answer.unsigned).toMatch(/«BEBE» lacks a sign of its own and could not be fingerspelled: the avatar lacks the clips for B, E/);
    expect(spy.started).toEqual(['GATO']);
  });

  it('🔴 [Right] nothing it could sign is «not signed», with why', async () => {
    const { it: vl } = await interpreter();
    const answer = await vl.sign('bebe');
    expect(answer.signed).toBe(false);
    expect(answer.reason).toMatch(/^none of the text could be signed: «BEBE» lacks a sign/);
  });

  it('🔴 [Right] a delivery that did not ship the avatar answers EXACTLY as `NO_INTERPRETER` does, the flag that ships it named — and downloads nothing more', async () => {
    const { it: vl, asked } = await interpreter({ delivery: { drop: ['libras/avatar/manifest.json'] } });
    const answer = await vl.sign('gato');
    // the root's interpreter since phase B3: a delivery built without `--libras` must read as a root with no player at all
    expect(answer).toEqual(await NO_INTERPRETER.sign('gato'));
    expect(answer).toEqual({ signed: false, reason: expect.stringMatching(/not installed in this delivery .*inclusionist-heavy <folder> --libras`$/) });
    expect(asked, 'the avatar was fetched from a delivery that did not ship it').toEqual(['libras/avatar/manifest.json']);
    expect(avatar()).toBeNull();
  });

  it('🔴 [Right] a device that cannot draw it (no WebGL) answers «unavailable» with the reason, and the next press tries again', async () => {
    let tries = 0;
    const { it: vl } = await interpreter({ loadStage: async () => { tries += 1; throw new Error('Error creating WebGL context.'); } });
    expect(await vl.sign('gato')).toEqual({ signed: false, reason: 'the Libras avatar cannot be drawn here: Error creating WebGL context.' });
    expect(avatar(), 'a canvas that cannot draw stayed on the page').toBeNull();
    await vl.sign('gato');
    expect(tries).toBe(2);
  });

  it('[Right] a load that never ends is given up on, by name', async () => {
    const { it: vl } = await interpreter({ loadTimeoutMs: 200, loadStage: () => new Promise(() => {}) });
    expect(await vl.sign('gato')).toEqual({ signed: false, reason: 'the Libras avatar did not load within 0 s' });
  });
});

describe('ui/libras-avatar-stage — what the export hands over, answered', () => {
  it('🔴 [Right] the face\'s track, named after the head\'s NODE, moves BOTH meshes three.js loads the head as', async () => {
    const { it: vl, spy } = await interpreter();
    await vl.sign('sorrir');
    const head = spy.stage.scene.getObjectByName('Head');
    const meshes = [];
    head.traverse((o) => { if (o.isMesh) meshes.push(o); });
    expect(meshes.length, 'the head is not the two-mesh group the export\'s head loads as').toBe(2);
    expect(meshes.map((m) => +m.morphTargetInfluences[0].toFixed(2)), 'the smile did not reach every mesh of the head').toEqual([1, 1]);
  });

  it('🎯 [Right] a part the next clip does not move goes BACK TO REST — it is not left where the last clip put it', async () => {
    const { it: vl, spy } = await interpreter();
    await vl.sign('peixe');
    const hand = spy.stage.scene.getObjectByName('Hand');
    expect(hand.position.y, 'the first clip did not move the hand').toBeCloseTo(3.5, 2);
    await vl.sign('sorrir');
    expect(hand.position.y, 'the hand stayed where PEIXE left it, though SORRIR does not move it').toBeCloseTo(HAND_REST_Y, 3);
  });

  it('[Right] the avatar\'s embedded texture is decoded by the stage\'s own step and reaches the GPU', async () => {
    const { it: vl, spy } = await interpreter();
    await vl.sign('gato');
    expect(spy.stage.stats().textures, 'the avatar\'s texture never reached the GPU').toBeGreaterThanOrEqual(1);
    expect(spy.stage.stats().calls).toBeGreaterThanOrEqual(1);
  });
});

// ========================= MUTATIONS CHECKED =========================
// (2026-09-25, scripted: each applied, this file run, the module restored from a copy — all 11 red)
//   B1 no leaving after the end · B2 leaving after 4 s                   🔴 «LEAVES the screen five seconds after»
//   B3 a late press not cancelling the leaving                           🔴 «CANCELS the leaving»
//   B4 the last clip left running under the next                         🔴 «BACK TO REST», «IN ORDER»
//   B5 parsed clips sharing one uuid (every clip played as the first)    🔴 «IN ORDER», «BACK TO REST»
//   B6 the face track left on the head's node                            🔴 «moves BOTH meshes»
//   B7 the host's fetch called as a method of the ports (Illegal invocation)  🔴 14 of the 15
//   B8 the avatar catching the pointer                                   🔴 «appear at the bottom right»
//   B9 `hide()` leaving its request unanswered                           🔴 «`hide()` takes it off at once»
//   B10 a replaced request never answered                                🔴 «REPLACES what is being signed»
//   B12 a device without WebGL never tried again                         🔴 «no WebGL»
// (2026-09-26, phase B3; scripted the same way, the module restored from a copy and checked by sha256 — 2 of 2 red)
//   P1 the not-shipped answer its own text again, not `NO_INTERPRETER`'s  🔴 «answers EXACTLY as `NO_INTERPRETER` does»
//   P3 the glosses read at route A's old place (`libras/player/`)         🔴 «IN ORDER» (the gloss never found, the text spelled)
// (2026-09-26, a spelled word's letters chained; scripted, CRLF normalised, each pattern required exactly once, the module restored
// from a copy and checked by sha256 — 4 of 4 red)
//   C14 the player lends the sequencer no windows                          🔴 «a fingerspelled word is CHAINED»
//   C15 the player chains from a fixed window, not the manifest's          🔴 «a fingerspelled word is CHAINED»
//   B1 again, leaving after 4 s · B3 again, a late press not cancelling   🔴 «five seconds after» · «CANCELS the leaving» — both still hold
