// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de ui/settings-motion — lógica PURA (project node, sem `document`). ZOMBIES + Right-BICEP.
// Cobre: clamp do jogador selecionado, montagem de linhas (HTML string), allOn do botão-mestre e os
// textos de anúncio ao leitor de tela. O render/DOM real (querySelector/addEventListener/focus) é coberto
// em tests/settings-motion.browser.test.js. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (ui/settings-motion).
import { describe, it, expect } from 'vitest';
import { t } from '../app/js/core/i18n.js'; // RM_LABEL guarda CHAVE desde o item 14; o HTML tem de trazer o TEXTO
import {
  clampSelectedPlayer, motionRowHtml, buildCharRowsHtml, buildSceneRowsHtml,
  crtToggleRowHtml, crtRoundRowHtml, allMotionFrozen, motionMasterLabel,
  sceneMotionAnnouncement, crtToggleAnnouncement, crtLevelLabel, crtRoundAnnouncement,
  stopResumeAllAnnouncement, RM_LABEL,
} from '../app/js/ui/settings-motion.js';

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

// 📌 OS QUATRO BLOCOS QUE MEDIAM MARCAÇÃO MUDARAM DE PROJECTO, e não de exigência: este painel passou a construir
// NÓS com o kit (ADR-0129, 2026-09-23), logo as cadeias que o `motionRowHtml`, o `buildCharRowsHtml`, o
// `buildSceneRowsHtml`, o `crtToggleRowHtml` e o `crtRoundRowHtml` devolviam deixaram de existir. Oito casos estão
// inteiros em `tests/settings-motion.browser.test.js`, sob «o interior montado em nós».
//
// ⚠️ DOIS NÃO FORAM, e é o certo: mediam o mecanismo «em breve», que saiu com a conversão por não ter assunto —
// `RM_SOON` era um conjunto vazio desde que o cartucho deixou este repositório, e os únicos que lhe davam um valor
// eram esses dois casos. Um mecanismo cujo único utilizador é um teste não é um mecanismo.

describe('allMotionFrozen', () => {
  // rmWalk/rmBreath/rmFlavor = true SIGNIFICA "movimento reduzido LIGADO" (congelado), não "animação ligada" —
  // mesma convenção de `rm[k]`. allMotionFrozen só é true quando TUDO está congelado.
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
    // ⚠️ ESTE CASO AFIRMAVA O CONTRÁRIO, e afirmava-o pelo MECANISMO: «sem player (undefined) nunca dá true
    // (RM_CHAR.every falha)». Um caso escrito em termos da implementação não consegue discordar dela, e este
    // fixou um defeito como se fosse a decisão.
    //
    // 📏 O que ele deixava passar, medido quando a engine passou a montar o painel para todo jogo: num jogo
    // sem `players` — um quiz, um puzzle — `allFrozen` ficava preso em `false`, então o botão-mestre calculava
    // `next = !false = true` a cada clique. A criança parava todas as animações e NÃO TINHA COMO AS TRAZER DE
    // VOLTA. Quem carrega nesse botão não o faz por curiosidade; carrega com enjoo.
    const rm = { parallax: true, decor: true, items: true, particles: true };
    expect(allMotionFrozen(RM_KEYS, rm, RM_CHAR, undefined),
      'sem personagem, a metade do personagem não pode pesar na resposta').toBe(true);
    // e o rótulo que daí sai é o que oferece a VOLTA — a metade que a criança precisa de ver
    expect(motionMasterLabel(allMotionFrozen(RM_KEYS, rm, RM_CHAR, undefined)))
      .toBe('Retomar todas as animações');
  });

  it('[Inverse] sem personagem, cena por congelar continua a dar false', () => {
    // O par do caso acima: a mudança tira o peso da metade AUSENTE, não o da metade que existe.
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
