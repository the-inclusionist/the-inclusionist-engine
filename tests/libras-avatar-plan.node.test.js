// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/libras-avatar-plan — THE FREE PLAYER'S PURE HALF (ADR-0234, route B, phase B2): which clips a gloss is signed with, in which
// order, when each one starts, and the two things the export hands over that the player must answer — a clip that starts at a
// stray keyframe (FALA), and a face track named after a node three.js loads as a group. FAKE clips throughout: names and
// lengths, no three.js.
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import {
  avatarManifestOf, createSignSequencer, CROSS_FADE_S, LIBRAS_AVATAR_FOLDER, LIBRAS_AVATAR_MANIFEST, leftOutText, nothingSigned,
  planSigns, playedLength, unsignedText,
} from '../app/js/ui/libras-avatar-plan.js';
import { bindFaceTracks, clipFrom, valueAt } from '../app/js/ui/libras-avatar-clip.js';

/** The export's clips a test pretends the delivery carries: signs, the digits, and the four letters B1 exported. */
const CARRIED = new Set(['GATO', 'GALINHA', 'CAVALO', 'PEIXE', 'CASA', 'A', 'D', 'M', 'O', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
const carried = (name) => CARRIED.has(name);

describe('ui/libras-avatar-plan — the clips a gloss is signed with', () => {
  it('🔴 [Right] each token with a clip is its clip, in the gloss\'s order', () => {
    expect(planSigns('GATO GALINHA CAVALO PEIXE', carried))
      .toEqual({ steps: [{ clip: 'GATO' }, { clip: 'GALINHA' }, { clip: 'CAVALO' }, { clip: 'PEIXE' }], unsigned: [] });
  });

  it('🔴 [Right] a token with no clip is FINGERSPELLED as written — capitals, accents stripped, one clip per letter or digit', () => {
    expect(planSigns('MOÃ 2026', carried).steps).toEqual([
      { clip: 'M', spells: 'MOÃ' }, { clip: 'O', spells: 'MOÃ' }, { clip: 'A', spells: 'MOÃ' },
      { clip: '2', spells: '2026' }, { clip: '0', spells: '2026' }, { clip: '2', spells: '2026' }, { clip: '6', spells: '2026' },
    ]);
  });

  it('🎯 [Right] a word with a letter the avatar lacks is left out WHOLE and listed — spelling only its O would show another word', () => {
    const plan = planSigns('GATO ENTROU CASA', carried);
    expect(plan.steps, 'part of a word was spelled with the letters the avatar happens to have').toEqual([{ clip: 'GATO' }, { clip: 'CASA' }]);
    expect(plan.unsigned).toEqual([{ word: 'ENTROU', missing: ['E', 'N', 'T', 'R', 'U'] }]);
  });

  it('[Zero] punctuation and a template\'s hole are not signs; nothing to sign is no step', () => {
    expect(planSigns('GATO [PONTO] {n} [EXCLAMAÇÃO]', carried), 'punctuation was taken for a word to spell')
      .toEqual({ steps: [{ clip: 'GATO' }], unsigned: [] });
    expect(planSigns('', carried)).toEqual({ steps: [], unsigned: [] });
    expect(planSigns('  ', carried)).toEqual({ steps: [], unsigned: [] });
  });

  it('[Right] what was left out is said with the words and the letters, sorted and once each; nothing left out says nothing', () => {
    const plan = planSigns('BEBE BOLO', carried);
    expect(unsignedText(plan.unsigned)).toBe('«BEBE», «BOLO» lack a sign of their own and could not be fingerspelled: the avatar '
      + 'lacks the clips for B, E, L');
    expect(unsignedText([{ word: 'BEM', missing: ['B', 'E'] }])).toMatch(/^«BEM» lacks a sign of its own/);
    expect(unsignedText([])).toBeUndefined();
  });

  it('[Right] a request\'s left-out part joins the unspellable words and the clips the delivery could not give; nothing, nothing', () => {
    const plan = planSigns('GATO BEM', carried);
    expect(leftOutText(plan.unsigned, ['GATO'])).toBe('«BEM» lacks a sign of its own and could not be fingerspelled: the avatar '
      + 'lacks the clips for B, E; the clips of «GATO» could not be read from the delivery');
    expect(leftOutText([], ['GATO'])).toBe('the clips of «GATO» could not be read from the delivery');
    expect(leftOutText([], [])).toBeUndefined();
    expect(nothingSigned(undefined)).toBe('none of the text could be signed: it holds not a single word');
  });
});

describe('ui/libras-avatar-plan — the delivery\'s manifest', () => {
  it('🔴 [Right] reads the avatar and each clip\'s window; a clip without `from` plays from its start', () => {
    const m = avatarManifestOf({ format: 1, avatar: 'avatar.glb', clips: {
      GATO: { file: 'clips/GATO.json', duration: 2.4 }, FALA: { file: 'clips/FALA.json', duration: 48.8, from: 46.8 } } });
    expect(m.avatar).toBe('avatar.glb');
    expect(m.clips.get('GATO')).toEqual({ file: 'clips/GATO.json', duration: 2.4, from: 0 });
    expect(playedLength(m.clips.get('FALA'))).toBeCloseTo(2, 9);
  });

  it('[Interface] the manifest is where the delivery writes it, beside route A\'s folders under `libras/`', () => {
    expect(`${LIBRAS_AVATAR_FOLDER}${LIBRAS_AVATAR_MANIFEST}`).toBe('libras/avatar/manifest.json');
  });

  it('🔴 [Zero] anything that is not the delivery\'s manifest is no avatar; a malformed clip is left out, not trusted', () => {
    for (const bad of [null, 'x', {}, { format: 2, avatar: 'a.glb', clips: {} }, { format: 1, avatar: '', clips: {} }, { format: 1, avatar: 'a.glb' }]) {
      expect(avatarManifestOf(bad), JSON.stringify(bad)).toBeNull();
    }
    const m = avatarManifestOf({ format: 1, avatar: 'a.glb', clips: {
      OK: { file: 'clips/OK.json', duration: 1 }, NOFILE: { duration: 1 }, ZERO: { file: 'z', duration: 0 },
      PAST: { file: 'p', duration: 1, from: 1 }, NEG: { file: 'n', duration: 1, from: -1 } } });
    expect([...m.clips.keys()]).toEqual(['OK']);
  });
});

const LENGTHS = { GATO: 2, GALINHA: 3, CAVALO: 2.5, PEIXE: 1, A: 1.6, B: 0.4 };
const lengthOf = (clip) => LENGTHS[clip];
const steps = (...names) => names.map((clip) => ({ clip }));
/** Runs the clock in `dt` steps until the queue finishes; every start, with the clock time it happened at. */
function run(seq, first, dt = 1 / 60, limit = 60) {
  const log = first.map((s) => ({ ...s, t: 0 }));
  let t = 0;
  while (t < limit) {
    t += dt;
    const { starts, finished } = seq.tick(dt);
    for (const s of starts) log.push({ ...s, t });
    if (finished) return { log, end: t };
  }
  return { log, end: null };
}

describe('ui/libras-avatar-plan — the clock: in order, cross-faded, and «stopped» at the last clip\'s end', () => {
  it('🔴 [Right] the clips start in order, each CROSS_FADE_S before its predecessor ends, fading over that overlap', () => {
    const seq = createSignSequencer(lengthOf);
    const { log, end } = run(seq, seq.play(steps('GATO', 'GALINHA', 'CAVALO', 'PEIXE')), 1 / 240);
    expect(log.map((s) => s.clip)).toEqual(['GATO', 'GALINHA', 'CAVALO', 'PEIXE']);
    expect(log[0]).toMatchObject({ fade: 0, at: 0 }); // nothing was on the stage: it appears at once
    const f = CROSS_FADE_S;
    expect(log[1].t).toBeCloseTo(2 - f, 2);
    expect(log[2].t).toBeCloseTo(2 - f + 3 - f, 2);
    expect(log[1].fade).toBe(f);
    expect(log[2].fade).toBe(f);
    // PEIXE is 1 s long: the overlap before it is capped at half of it
    expect(log[3].fade).toBe(Math.min(f, 0.5));
    expect(end, 'the queue never said it stopped').not.toBeNull();
    const total = 2 + 3 + 2.5 + 1 - f - f - Math.min(f, 0.5);
    expect(end).toBeCloseTo(total, 2);
  });

  it('🎯 [Boundary] no overlap exceeds half of either clip: a short clip is not swallowed by its neighbours', () => {
    const seq = createSignSequencer(lengthOf, 1);
    const { log } = run(seq, seq.play(steps('A', 'B', 'A')), 1 / 480);
    expect(log.map((s) => s.fade)).toEqual([0, 0.2, 0.2]);
    expect(log[1].t).toBeCloseTo(1.6 - 0.2, 2);
    expect(log[2].t).toBeCloseTo(1.6 - 0.2 + 0.4 - 0.2, 2);
  });

  it('🔴 [Right] a clip starts where the clock is: a long frame starts the next one `at` the seconds it already lost', () => {
    const seq = createSignSequencer(lengthOf);
    seq.play(steps('GATO', 'PEIXE'));
    const { starts } = seq.tick(2); // one frame of 2 s: GATO handed over at 1.7 s
    expect(starts).toEqual([{ clip: 'PEIXE', fade: 0.3, at: expect.closeTo(0.3, 9) }]);
  });

  it('🔴 [Right] a queue that replaces another fades in from the pose on the stage; after `stop` nothing starts or finishes', () => {
    const seq = createSignSequencer(lengthOf);
    seq.play(steps('GATO'));
    seq.tick(0.5);
    expect(seq.play(steps('CAVALO', 'PEIXE')), 'the replacing clip jumped in instead of fading from the pose on the stage')
      .toEqual([{ clip: 'CAVALO', fade: 0.3, at: 0 }]);
    const { end } = run(seq, []);
    expect(end).toBeCloseTo(2.5 + 1 - 0.3, 1); // GATO's remaining time counts for nothing
    expect(seq.play(steps('GATO'))[0].fade, 'the pose held after the last queue was forgotten').toBe(0.3);
    seq.stop();
    expect(seq.tick(10)).toEqual({ starts: [], finished: false });
  });

  it('[Zero] an empty queue starts nothing and never finishes', () => {
    const seq = createSignSequencer(lengthOf);
    expect(seq.play([])).toEqual([]);
    expect(seq.tick(5)).toEqual({ starts: [], finished: false });
  });
});

describe('ui/libras-avatar-plan — the clip, before three.js reads it', () => {
  const clip = {
    name: 'FALA', duration: 48.8, tracks: [
      { name: 'BnBracoR.quaternion', type: 'quaternion', times: [0, 46.8, 48.8], values: [0, 0, 0, 1, 0, 0.7071068, 0, 0.7071068, 0, 1, 0, 0] },
      { name: 'BnBocaCantoL.position', type: 'vector', times: [0, 46.8333, 48.8], values: [0, 0, 0, 1, 2, 3, 4, 5, 6] },
      { name: 'BnBracoL.quaternion', type: 'quaternion', times: [0], values: [0, 0, 0.3826834, 0.9238795] },
      { name: 'Olho.position', type: 'vector', times: [0, 10, 47], values: [0, 0, 0, 1, 1, 1, 9, 9, 9], interpolation: 2300 },
    ],
  };

  it('🔴 [Right] FALA from 46.8 s: times start at zero, each track keeps its value AT the cut, then its later keys', () => {
    const cut = clipFrom(clip, 46.8);
    expect(cut.duration).toBeCloseTo(2, 9);
    const [arm, mouth, still, eye] = cut.tracks;
    expect(arm.times).toEqual([0, expect.closeTo(2, 9)]);
    expect(arm.values.slice(0, 4).map((v) => +v.toFixed(6))).toEqual([0, 0.707107, 0, 0.707107]);
    expect(mouth.times.map((t) => +t.toFixed(4))).toEqual([0, 0.0333, 2]);
    expect(mouth.values.slice(0, 3).map((v) => +v.toFixed(3))).toEqual([0.999, 1.999, 2.998]); // interpolated at the cut
    expect(still, 'a constant track was lost at the cut').toEqual({ ...clip.tracks[2], times: [0], values: clip.tracks[2].values });
    expect(eye.values.slice(0, 3), 'a STEP track was interpolated at the cut').toEqual([1, 1, 1]);
    expect(eye.interpolation).toBe(2300);
  });

  it('🎯 [Boundary] from zero is the clip itself; a quaternion cut between keys stays a unit rotation', () => {
    expect(clipFrom(clip, 0)).toBe(clip);
    const q = valueAt(clip.tracks[0], 47.8);
    expect(Math.hypot(...q)).toBeCloseTo(1, 6); // the keys themselves are unit to 7 digits
    expect(q[1], 'the cut is not between the two keys').toBeGreaterThan(0.7071068);
  });

  it('🔴 [Right] a face track on a node loaded as a group is written once for EACH of its meshes; any other track is untouched', () => {
    const face = { name: 'OLÁ', duration: 1, tracks: [
      { name: 'cabecaModifAlisson.morphTargetInfluences[Sorriso]', type: 'number', times: [0, 1], values: [0, 1] },
      { name: 'BnMaoL.quaternion', type: 'quaternion', times: [0], values: [0, 0, 0, 1] },
      { name: 'Olhos.morphTargetInfluences[Pisca]', type: 'number', times: [0], values: [1] },
    ] };
    const meshes = { cabecaModifAlisson: ['uuid-1', 'uuid-2'] };
    const bound = bindFaceTracks(face, (node) => meshes[node] ?? null);
    expect(bound.tracks.map((t) => t.name)).toEqual([
      'uuid-1.morphTargetInfluences[Sorriso]', 'uuid-2.morphTargetInfluences[Sorriso]', 'BnMaoL.quaternion',
      'Olhos.morphTargetInfluences[Pisca]',
    ]);
    expect(bound.tracks[1].values).toEqual([0, 1]);
  });
});

// ========================= MUTATIONS CHECKED =========================
// (2026-09-25, scripted: each applied to the module, this file run, the module restored from a copy — all 15 red)
//   P1 a token with a clip spelled instead of signed                     🔴 «each token with a clip» and 3 more
//   P2 the word spelled with its accents                                 🔴 «FINGERSPELLED as written»
//   P3 a word spelled with only the letters the avatar has               🔴 «left out WHOLE»
//   P4 punctuation read as a word                                        🔴 [Zero] «punctuation»
//   P5 the overlap not capped at half a clip                             🔴 [Boundary] «no overlap exceeds half»
//   P6 the first clip fading in from nothing · P7 the held pose forgotten 🔴 «in order» · «replaces another»
//   P8 the next clip started at 0 after a long frame                     🔴 «where the clock is»
//   P9 the queue never finishing                                         🔴 «in order», «replaces another»
//   P13 the manifest dropping `from` · P14 a zero-length clip trusted     🔴 «the delivery's manifest»
//   P15 the unread clips left out of what is said                        🔴 «left-out part»
//   P10 FALA cut without its value at the cut · P11 a STEP track interpolated  🔴 «FALA from 46.8 s»
//   P12 the face track bound to one mesh of the head                     🔴 «written once for EACH»
