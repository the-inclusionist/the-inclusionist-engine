// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of ui/settings-motion — PURE logic (node project, no `document`). ZOMBIES + Right-BICEP.
// Covers: the clamp of the selected player, the master button's allOn and the screen-reader announcement texts. The
// real render/DOM (querySelector/addEventListener/focus, and the rows built as nodes) is covered in
// tests/settings-motion.browser.test.js. See docs/5-Refactoring/plano-modularizacao-mapa.md (ui/settings-motion).
import { describe, it, expect } from 'vitest';
import { t } from '../app/js/core/i18n.js'; // RM_LABEL holds KEYS (item 14)
// 🔴 A NAMED import of something a module does not export resolves to `undefined` under the transformer, and while no
// case uses the name, nothing fails — measured on 2026-09-23, when this list still imported six names the module no
// longer exported, with the suite GREEN. The same shape as a ledger key that stops matching any file: what is not read
// stops requiring, in silence.
//
// 📌 The PURE half lives in `ui/motion-choices` (ADR-0221 step 7c), and it was THIS file that pointed at the seam: it
// exercises exactly these names, and the node project mounts no document.
import {
  clampSelectedPlayer, allMotionFrozen, motionMasterLabel,
  sceneMotionAnnouncement, crtToggleAnnouncement, crtLevelLabel, crtRoundAnnouncement,
  stopResumeAllAnnouncement, RM_LABEL,
} from '../app/js/ui/motion-choices.js';

const RM_CHAR = [
  { prop: 'rmWalk', lbl: 'Personagem em movimento (andar, escalar, nadar, pular)' },
  { prop: 'rmBreath', lbl: 'Respiração (parado)' },
  { prop: 'rmFlavor', lbl: 'Gracinhas (animações de descanso)' },
];
const RM_KEYS = ['parallax', 'decor', 'items', 'particles'];

describe('clampSelectedPlayer', () => {
  it('[Right] mantém o índice quando ele ainda cabe no nº de telas', () => {
    expect(clampSelectedPlayer(1, 3)).toBe(1);
  });
  it('[Boundary] volta a 0 quando o índice fica >= nº de telas (ex.: 4p→1p com o 4º selecionado)', () => {
    expect(clampSelectedPlayer(3, 1)).toBe(0);
    expect(clampSelectedPlayer(2, 2)).toBe(0); // igual conta como "fora" (0-based)
  });
  it('[Zero] 0 jogadores também volta a 0 (não quebra, não fica negativo)', () => {
    expect(clampSelectedPlayer(0, 0)).toBe(0);
  });
});

// 📌 THE FOUR BLOCKS THAT MEASURED MARKUP CHANGED PROJECT, not requirement: this panel builds NODES with the kit
// (ADR-0129, 2026-09-23), so the strings `motionRowHtml`, `buildCharRowsHtml`, `buildSceneRowsHtml`, `crtToggleRowHtml`
// and `crtRoundRowHtml` returned no longer exist. Eight cases are whole in `tests/settings-motion.browser.test.js`,
// under «o interior montado em nós».
//
// ⚠️ TWO DID NOT GO, and that is right: they measured the «em breve» mechanism, which left with the conversion for
// having no subject — `RM_SOON` was an empty set since the cartridge left this repository, and the only things giving
// it a value were those two cases. A mechanism whose only user is a test is not a mechanism.

describe('allMotionFrozen', () => {
  // rmWalk/rmBreath/rmFlavor = true MEANS "reduced motion ON" (frozen), not "animation on" — the same convention as
  // `rm[k]`. allMotionFrozen is only true when EVERYTHING is frozen.
  const allFrozenPlayer = { rmWalk: true, rmBreath: true, rmFlavor: true };
  const partiallyFrozenPlayer = { rmWalk: false, rmBreath: true, rmFlavor: true };
  it('[Right] true quando toda cena + todo personagem estão com movimento reduzido (congelados)', () => {
    const rm = { parallax: true, decor: true, items: true, particles: true };
    expect(allMotionFrozen(RM_KEYS, rm, RM_CHAR, allFrozenPlayer)).toBe(true);
  });
  it('[Inverse] false se QUALQUER alvo de cena ainda estiver animado', () => {
    const rm = { parallax: false, decor: true, items: true, particles: true };
    expect(allMotionFrozen(RM_KEYS, rm, RM_CHAR, allFrozenPlayer)).toBe(false);
  });
  it('[Inverse] false se QUALQUER alvo do personagem ainda estiver animado', () => {
    const rm = { parallax: true, decor: true, items: true, particles: true };
    expect(allMotionFrozen(RM_KEYS, rm, RM_CHAR, partiallyFrozenPlayer)).toBe(false);
  });
  it('🔴 [Zero] SEM personagem, a cena inteira congelada JÁ É "tudo congelado" — e dá para voltar', () => {
    // ⚠️ A case written in terms of the implementation cannot disagree with it: the old version asserted «sem player
    // (undefined) nunca dá true (RM_CHAR.every falha)», and so pinned a defect as if it were the decision.
    //
    // 📏 What it let through, measured when the engine started mounting the panel for every game: in a game with no
    // `players` — a quiz, a puzzle — `allFrozen` was stuck at `false`, so the master button computed
    // `next = !false = true` at every click. The child stopped every animation and HAD NO WAY TO BRING THEM BACK. Whoever
    // presses that button does not do it out of curiosity; they press it feeling sick.
    const rm = { parallax: true, decor: true, items: true, particles: true };
    expect(allMotionFrozen(RM_KEYS, rm, RM_CHAR, undefined),
      'sem personagem, a metade do personagem não pode pesar na resposta').toBe(true);
    // and the label that comes out of it is the one offering the WAY BACK — the half the child needs to see
    expect(motionMasterLabel(allMotionFrozen(RM_KEYS, rm, RM_CHAR, undefined)))
      .toBe('Retomar todas as animações');
  });

  it('[Inverse] sem personagem, cena por congelar continua a dar false', () => {
    // The pair of the case above: the change removes the weight of the ABSENT half, not of the half that exists.
    const rm = { parallax: true, decor: false, items: true, particles: true };
    expect(allMotionFrozen(RM_KEYS, rm, RM_CHAR, undefined)).toBe(false);
  });
});

describe('motionMasterLabel', () => {
  it('[Right] allFrozen=true → "Retomar"; allFrozen=false → "Parar"', () => {
    expect(motionMasterLabel(true)).toBe('Retomar todas as animações');
    expect(motionMasterLabel(false)).toBe('Parar todas as animações');
  });
});

describe('anúncios (srSay)', () => {
  it('sceneMotionAnnouncement: congelado vs animado', () => {
    expect(sceneMotionAnnouncement('Parallax do fundo', true)).toBe('Parallax do fundo congelado.');
    expect(sceneMotionAnnouncement('Parallax do fundo', false)).toBe('Parallax do fundo animado.');
  });
  it('crtToggleAnnouncement: ligada vs desligada', () => {
    expect(crtToggleAnnouncement('Scanlines', true)).toBe('Scanlines ligada.');
    expect(crtToggleAnnouncement('Scanlines', false)).toBe('Scanlines desligada.');
  });
  it('crtLevelLabel: 0/1/2 → desligado/pequeno/grande', () => {
    expect(crtLevelLabel(0)).toBe('desligado');
    expect(crtLevelLabel(1)).toBe('pequeno');
    expect(crtLevelLabel(2)).toBe('grande');
  });
  it('crtRoundAnnouncement compõe rótulo + nível', () => {
    expect(crtRoundAnnouncement('Cantos arredondados', 2)).toBe('Cantos arredondados: grande.');
  });
  it('stopResumeAllAnnouncement: nowFrozen=true (acabou de congelar) vs false (acabou de retomar)', () => {
    expect(stopResumeAllAnnouncement(true)).toBe('Todas as animações paradas.');
    expect(stopResumeAllAnnouncement(false)).toBe('Todas as animações retomadas.');
  });
});
