// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/libras-avatar-clip — A SIGN CLIP, BEFORE three.js READS IT (ADR-0234, route B, phase B2). Pure: no three.js, no DOM.
//
// The B1 export hands each sign over as three.js AnimationClip JSON (`scripts/libras-export.mjs`), and two things about it are
// answered here, on the JSON, where node can hold them (`tests/libras-avatar-plan.node.test.js`): a clip whose sign starts
// later than the clip does — FALA, whose export starts at a stray keyframe — is played from its sign (`clipFrom`), and the
// face's tracks, named after the head's node, are written for each mesh three.js loads the head as (`bindFaceTracks`).
// `ui/libras-avatar-stage` parses what comes out.

/** One track of a three.js AnimationClip JSON, as the export writes it. */
export interface TrackJson {
  readonly name: string;
  readonly type: string;
  readonly times: readonly number[];
  readonly values: readonly number[];
  readonly interpolation?: number;
}

/** A three.js AnimationClip JSON (`AnimationClip.parse`), as the export writes it. */
export interface ClipJson {
  readonly name: string;
  readonly duration: number;
  readonly tracks: readonly TrackJson[];
}

/** three.js `InterpolateDiscrete`: the export marks a STEP track with it. */
const DISCRETE = 2300;

function slerp(a: readonly number[], b: readonly number[], u: number): number[] {
  let dot = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]! + a[3]! * b[3]!;
  const bb = dot < 0 ? b.map((x) => -x) : [...b];
  dot = Math.abs(dot);
  if (dot > 0.9995) {
    const q = a.map((x, c) => x + (bb[c]! - x) * u);
    const l = Math.hypot(...q);
    return q.map((x) => x / l);
  }
  const th = Math.acos(dot);
  const s = Math.sin(th);
  return a.map((x, c) => (Math.sin((1 - u) * th) * x + Math.sin(u * th) * bb[c]!) / s);
}

/** A track's value at `time`, as three.js interpolates it: held before the first key and after the last. */
export function valueAt(track: TrackJson, time: number): number[] {
  const { times, values } = track;
  const width = values.length / times.length;
  const key = (i: number): number[] => values.slice(i * width, i * width + width);
  const last = times.length - 1;
  if (time <= times[0]! || last === 0) return key(0);
  if (time >= times[last]!) return key(last);
  let i = 0;
  while (times[i + 1]! <= time) i += 1;
  if (time === times[i] || track.interpolation === DISCRETE) return key(i);
  const u = (time - times[i]!) / (times[i + 1]! - times[i]!);
  const a = key(i);
  const b = key(i + 1);
  return track.type === 'quaternion' ? slerp(a, b, u) : a.map((x, c) => x + (b[c]! - x) * u);
}

/**
 * The clip from `from` seconds on, its times shifted to start at zero: each track keeps its value AT `from` as its first key,
 * then its later keys. A track whose keys all lie before `from` holds its last value. `from` of zero is the clip itself.
 */
export function clipFrom(clip: ClipJson, from: number): ClipJson {
  if (!(from > 0)) return clip;
  const tracks = clip.tracks.map((t) => {
    const times = [0];
    const values = [...valueAt(t, from)];
    const width = t.values.length / t.times.length;
    t.times.forEach((time, i) => {
      if (time <= from) return;
      times.push(time - from);
      values.push(...t.values.slice(i * width, i * width + width));
    });
    return { ...t, times, values };
  });
  return { name: clip.name, duration: Math.max(0, clip.duration - from), tracks };
}

const MORPH_TRACK = /^(.+)\.morphTargetInfluences\[(.+)\]$/u;

/**
 * The face's tracks, bound to every mesh that carries the morph targets. The export names a morph track after the head's NODE
 * (`cabecaModifAlisson.morphTargetInfluences[Sorriso]`), and three.js loads a node whose mesh has two primitives as a GROUP of
 * two meshes, each with its own copy of the targets — a track on the group moves neither. `meshesOf(node)` answers the meshes
 * a track on that node must reach (by the names three.js binds, e.g. their uuids), or `null` where the node is itself the mesh;
 * the track is written once for each.
 */
export function bindFaceTracks(clip: ClipJson, meshesOf: (node: string) => readonly string[] | null): ClipJson {
  const tracks: TrackJson[] = [];
  for (const t of clip.tracks) {
    const m = MORPH_TRACK.exec(t.name);
    const meshes = m ? meshesOf(m[1]!) : null;
    if (!m || !meshes) { tracks.push(t); continue; }
    for (const mesh of meshes) tracks.push({ ...t, name: `${mesh}.morphTargetInfluences[${m[2]!}]` });
  }
  return { ...clip, tracks };
}
