// SPDX-License-Identifier: AGPL-3.0-or-later
// WHAT IS BORN ON AND WHAT IS BORN OFF — and why an audio default is an accessibility decision.
//
// ========================= WHY THIS DESERVES A GATE =========================
// A sound default looks like a detail and is not. It decides what the child HEARS before she knows there is a menu — and
// the two categories that are off are off for opposite and equally concrete reasons:
//
//   · `tts` — a robotic voice irritates and overloads people with ASD. Whoever needs it turns it on.
//   · `guide` — the audio guide. As a beacon it played a 0.12 s `triangle` every 0.8 s, forever, regardless of movement
//     or of anything having changed; and in blind mode the condition that releases it is always true, so the child who
//     most needs cues was the one who heard the beep the whole match. The Dev's verdict: «um ping é a pior escolha
//     possível, tenebroso para quem tem TEA».
//
// ⚠️ THE `guide` BEING OFF WAS PROVISIONAL, and this file also exists so that it does not become permanent by
// forgetting. The replacement decided was a sound that grows as the child gets closer, following a navigable route
// instead of pointing in a straight line into a wall; the continuous guide now follows `core/route` (#84 item 2,
// `platform/audio-sonar`). Its default is still off, and switching it on goes through this line.
//
// ========================= AND WHY THE SAVED VALUE WINS =========================
// A saved value means someone TOUCHED that control, and the child's choice is not ours to undo. Whoever had turned the
// guide on keeps it on — the default reaches only whoever never chose.
//
// MUTATIONS CHECKED (at the end of the file).
import { describe, it, expect } from 'vitest';
import { defaultAudioCat, AUDIO_CATS } from '../app/js/platform/audio-mixer.js';

const DESLIGADAS = ['tts', 'guide'];

describe('categorias de áudio · o estado de fábrica é decisão, não acaso', () => {
  it('[Zero] o gate está lendo o catálogo de verdade', () => {
    expect(AUDIO_CATS.length).toBeGreaterThanOrEqual(8);
    expect(AUDIO_CATS.map((c) => c.k)).toEqual(expect.arrayContaining(DESLIGADAS));
  });

  it('🔴 [Zero] `other` SAIU do mixer (ADR-0151, errata) — não controlava som nenhum', () => {
    // «O que esta categoria controla? Nada. Então pra que?» (the Dev). A volume with nothing under it is a dead button.
    expect(AUDIO_CATS.map((c) => c.k)).not.toContain('other');
  });

  it('[Right] EXATAMENTE `tts` e `guide` nascem desligadas', () => {
    // Exactly in both directions: a new category born muted without a written reason fails here, and so does switching
    // `guide` back on without going through this line.
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
//   · returning `{ on: k !== 'tts' }` (the guide back on) → the [Right] exactly-`tts`-and-`guide` case fails.
//   · putting `'earcons'` on the muted list → the same case fails from the other side.
//   · giving `vol: 0` to the muted ones → the [Boundary] factory-volume case fails.
