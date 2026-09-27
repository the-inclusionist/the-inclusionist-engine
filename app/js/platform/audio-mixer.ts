// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/audio-mixer.ts — the audio mixer's categories (data) + load/persist, through the store the caller passes (ADR-0232).
// Only the list of categories, the initial state (narration born off) and the per-category save live here; the audio
// graph and the LIVE mixer state are `platform/audio`'s.
import type { Store } from './storage.js';

type AudioCat = { k: string; lbl: string };
type AudioCatState = { on: boolean; vol: number };
/** What the mixer is read and written through: the page's store, built by the root (ADR-0232, issue #207). */
export type AudioCatStore = Pick<Store, 'getJSON' | 'setJSON'>;

// 🔴 There is no `other` category (ADR-0151, erratum): «O que esta categoria controla? Nada. Então pra que?» (the Dev).
// 📏 Measured: no sound was routed through it — a volume with nothing underneath, the dead button of ADR-0106 §5.
// 🔴 `lbl` is an i18n KEY since 2026-09-12 (ADR-0158). The labels were raw Portuguese with examples in parentheses —
// «Sons ambiente (água, rua, trânsito, folhas, chuva)» — and a page in English showed them as they were (measured in
// dist). ⚠️ The examples are GONE, not moved to a hint: water, doors, coins are one game's sounds, and the engine does
// not describe a game it does not know (the Dev: «Não se faz abstração sem precisar»).
export const AUDIO_CATS: AudioCat[] = [
  {k:'music',   lbl:'audio.cat.music'},
  {k:'ambient', lbl:'audio.cat.ambient'},
  {k:'interact',lbl:'audio.cat.interact'},
  {k:'earcons', lbl:'audio.cat.earcons'},
  {k:'tts',     lbl:'audio.cat.tts'},
  {k:'sonar',   lbl:'audio.cat.sonar'},
  // 🔴 `guard` and `guide` LEFT (ADR-0258, the Dev: «Saem.»): the engine plays nothing in either since the guide moved to the
  // platformer (ADR-0257); a level stored for them stays in the child's storage and is read by nobody.
];

/**
 * The categories born OFF, and the reason for each. A list with its reason written down, not a `k !== 'x'` hanging in an
 * expression — the next one to join has to say why.
 *
 *  · `tts` — a robotic voice irritates and overloads autistic people. Whoever needs it turns it on in the menu. (The
 *    literacy voice is `gameSay()`, independent of this and always on.)
 *
 * (`guide`, born off by the Dev's decision on the old beacon, left with its category — ADR-0258.)
 */
const BORN_OFF = new Set(['tts']);

/**
 * A category's FACTORY state. It has a name because two places need it: the boot's read (when nothing is stored) and
 * the hearing menu's "restore defaults" (ADR-0028). Writing `k !== 'tts'` and `0.8` in both would be the ownerless copy
 * this repository has seen diverge — and here the divergence would put the child in a third state, neither theirs nor
 * the factory's.
 *
 * What is STORED overrides it, deliberately: a stored value means someone MOVED that control, and the child's choice is
 * not mine to undo.
 */

export function defaultAudioCat(k: string): AudioCatState {
  return { on: !BORN_OFF.has(k), vol: 0.8 };
}

export function loadAudioCat(store: AudioCatStore): Record<string, AudioCatState> {
  const cat: Record<string, AudioCatState> = {};
  AUDIO_CATS.forEach((c) => {
    const d = defaultAudioCat(c.k);
    let on = d.on, vol = d.vol;
    const o = store.getJSON<AudioCatState>('incl_audiocat_' + c.k, null);
    if (o) { on = !!o.on; vol = +o.vol; }
    cat[c.k] = { on, vol };
  });
  return cat;
}
export function saveAudioCat(store: AudioCatStore, k: string, obj: AudioCatState): void { store.setJSON('incl_audiocat_' + k, obj); }
