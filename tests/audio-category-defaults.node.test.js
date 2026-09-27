// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT IS BORN ON AND WHAT IS BORN OFF — and why an audio default is an accessibility decision.
//
// ========================= WHY THIS DESERVES A GATE =========================
// A sound default looks like a detail and is not. It decides what the child HEARS before she knows there is a menu — and
// the one category born off is off for a concrete reason:
//
//   · `tts` — a robotic voice irritates and overloads people with ASD. Whoever needs it turns it on.
//
// ⚠️ `guide` WAS THE SECOND, AND IT LEFT WITH ITS CATEGORY (ADR-0258, the Dev: «Saem.»). The guide moved to the platformer
// (ADR-0257) and the engine plays nothing in `guide` or in `guard` any more — a volume with nothing under it is the dead button
// `other` already was. What a game plays through its own guide is that game's mixer to name.
//
// ========================= AND WHY THE SAVED VALUE WINS =========================
// A saved value means someone TOUCHED that control, and the child's choice is not ours to undo. A level stored for a category
// that left stays in the child's storage and is read by nobody — it is not deleted behind her back.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { defaultAudioCat, AUDIO_CATS } from '../app/js/platform/audio-mixer.js';

const DESLIGADAS = ['tts'];

describe('categorias de áudio · o estado de fábrica é decisão, não acaso', () => {
  it('[Zero] o gate está lendo o catálogo de verdade', () => {
    expect(AUDIO_CATS.length).toBeGreaterThanOrEqual(6);
    expect(AUDIO_CATS.map((c) => c.k)).toEqual(expect.arrayContaining(DESLIGADAS));
  });

  it('🔴 [Zero] `other` SAIU do mixer (ADR-0151, errata) — não controlava som nenhum', () => {
    // «O que esta categoria controla? Nada. Então pra que?» (the Dev). A volume with nothing under it is a dead button.
    expect(AUDIO_CATS.map((c) => c.k)).not.toContain('other');
  });

  it('🔴 [Zero] `guard` e `guide` SAÍRAM do mixer (ADR-0258) — a engine não toca nada nelas', () => {
    const cats = AUDIO_CATS.map((c) => c.k);
    expect(cats).not.toContain('guard');
    expect(cats).not.toContain('guide');
  });

  it('[Right] EXATAMENTE `tts` nasce desligada', () => {
    // Exactly in both directions: a new category born muted without a written reason fails here, and so does switching
    // `tts` on at the factory without going through this line.
    const desligadas = AUDIO_CATS.map((c) => c.k).filter((k) => !defaultAudioCat(k).on);
    expect(desligadas.sort(), 'mudou quem nasce em silêncio — o motivo está no cabeçalho de audio-mixer').toEqual([...DESLIGADAS].sort());
  });

  it('[Right] todas as outras nascem ligadas, e no mesmo volume', () => {
    for (const { k } of AUDIO_CATS) {
      if (DESLIGADAS.includes(k)) continue;
      expect(defaultAudioCat(k).on, k).toBe(true);
      expect(defaultAudioCat(k).vol, k).toBe(0.8);
    }
  });

  it('[Boundary] o volume de fábrica NÃO depende de estar ligada', () => {
    // A muted category with volume 0 would be a second, hidden muting: whoever turned it on in the menu would still hear
    // nothing, and would look for the defect in the wrong place.
    for (const k of DESLIGADAS) expect(defaultAudioCat(k).vol, k).toBe(0.8);
  });

  it('[Zero] categoria desconhecida nasce ligada — o desligamento é uma lista, não um acaso', () => {
    expect(defaultAudioCat('categoria-que-ainda-nao-existe').on).toBe(true);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · returning `{ on: true }` for every category (`tts` on at the factory) → the [Right] exactly-`tts` case fails.
//   · putting `'earcons'` on the muted list → the same case fails from the other side.
//   · giving `vol: 0` to the muted ones → the [Boundary] factory-volume case fails.
//   · putting `guide` back in `AUDIO_CATS` → the [Zero] `guard`-and-`guide` case fails.
