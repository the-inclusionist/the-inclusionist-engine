// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de LÓGICA PURA (project node — sem PIXI/document/localStorage). Padrões: ZOMBIES (ordem/didática) +
// Right-BICEP (rigor). Rótulos no nome do teste. Ver docs/plano-testes.md. Módulos: constants, tiles, world, input/state.
import { describe, it, expect } from 'vitest';
import * as C from '../app/js/core/constants.js';
import * as T from '../app/js/core/tiles.js';
import * as W from '../app/js/core/world.js';
import * as S from '../app/js/input/state.js';
import * as AUDIO from '../app/js/platform/audio.js';
import { AUDIO_CATS } from '../app/js/platform/audio-mixer.js';
import * as RNG from '../app/js/core/rng.js';

describe('core/constants', () => {
  it('[Right] valores afinados do José (TUNE/ANIM/TILE)', () => {
    // ⚠️ `C.TUNE.jumpVel` saiu daqui em 2026-09-07: a afinação foi para o `game/tuning.ts` do
    // `game-platformer` (issue #63, etapa B). O que ficou é o que qualquer jogo 2D em pixel usa.
    expect(C.ANIM.walkHold).toBe(6);
    expect(C.ANIM.runHold).toBe(8);
    expect(C.TILE).toBe(16);
  });
  it('⚠️ [Interface] `JUMP_BASE` e `ehChave` SAÍRAM, e este caso é o que impede que voltem por engano', () => {
    // O caso que estava aqui verificava `JUMP_BASE === jumpVel * sqrt(8/5)` — isto é, **reafirmava a própria
    // definição**. Um teste que não pode falhar por motivo nenhum que importe, e que mantinha viva uma
    // constante sem um único consumidor: nem na engine, nem nos testes, nem no `game-platformer`. A issue
    // #63 já o nomeava no «achado solto», e a etapa B levou os dois na mesma passagem.
    //
    // O que fica no lugar afirma a AUSÊNCIA, que é o que agora importa: a superfície pública da engine
    // encolheu, e encolher superfície pública é uma major — não é coisa que se desfaça por distração.
    expect('JUMP_BASE' in C, 'JUMP_BASE voltou ao catálogo').toBe(false);
    expect('ehChave' in C, 'ehChave voltou ao catálogo').toBe(false);
  });
  it('[Interface] canvas lógico 320×180 (16:9)', () => {
    expect(C.LOGICAL_W).toBe(320);
    expect(C.LOGICAL_H).toBe(180);
    expect(C.LOGICAL_W / C.LOGICAL_H).toBeCloseTo(16 / 9, 4);
  });
});

describe('core/tiles — legenda glifo↔tipo + parser', () => {
  it('[Cross-check] selfTest confirma a bijeção (únicos, invertível, sem faltas)', () => {
    const r = T.selfTest();
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });
  it('[Zero] texto vazio → grid vazio', () => {
    expect(T.parseLevel('')).toEqual([]);
  });
  it('[One] um glifo → grid 1×1', () => {
    expect(T.parseLevel(T.TYPE_GLYPH[2])).toEqual([[2]]); // '#' = pedra
  });
  it('[Many] várias linhas preservam o comprimento irregular de cada uma', () => {
    const g = T.parseLevel('..\n.'); // 2ª linha mais curta
    expect(g.length).toBe(2);
    expect(g[0].length).toBe(2);
    expect(g[1].length).toBe(1); // irregular preservado (buildWorld preenche depois)
  });
  it('[Inverse] gridToGlyphs ∘ parseLevel = identidade (glifos válidos)', () => {
    const txt = [T.TYPE_GLYPH[0] + T.TYPE_GLYPH[2] + T.TYPE_GLYPH[9],
                 T.TYPE_GLYPH[3] + T.TYPE_GLYPH[4] + T.TYPE_GLYPH[5]].join('\n');
    expect(T.gridToGlyphs(T.parseLevel(txt))).toBe(txt);
  });
  it('[Error] glifo desconhecido → AIR (= tipo do ".", ar iluminado)', () => {
    const g = T.parseLevel('.?.');
    expect(g[0][1]).toBe(T.GLYPH_TYPE['.']);
    expect(g[0]).toEqual([T.GLYPH_TYPE['.'], T.GLYPH_TYPE['.'], T.GLYPH_TYPE['.']]);
  });
  it('[Boundary/Existence] linha de meta "#!" é ignorada (mas "#" sozinho é parede)', () => {
    expect(T.parseLevel('#!nome=teste\n' + T.TYPE_GLYPH[2])).toEqual([[2]]);
  });
});

describe('core/world — buildWorldFromText', () => {
  it('[One] mundo mínimo mantém as dimensões', () => {
    const w = W.buildWorldFromText('...\n...');
    expect(w.length).toBe(2);
    expect(w[0].length).toBe(3);
  });
  it('[Boundary] linha curta é preenchida à direita com ar escuro (tipo 0)', () => {
    const g = T.TYPE_GLYPH[2];
    const w = W.buildWorldFromText(g + g + '\n' + g); // 2ª linha mais curta
    expect(w[1].length).toBe(2);   // padded à largura máxima
    expect(w[1][1]).toBe(0);       // preenchimento = ar escuro (não-sólido)
  });
  it('[Right] pedra (2) preservada', () => {
    const g = T.TYPE_GLYPH[2];
    expect(W.buildWorldFromText(g + '\n' + g)[0][0]).toBe(2);
  });
  it('[Right/a11y] passagem de 1 tile é ALARGADA (teto de pedra vira ar p/ o jogador caber)', () => {
    // '#' teto · '.' ar sobre chão · '#' chão → o teto (pedra=2) é convertido em ar(1); jogador tem 2 tiles.
    expect(W.buildWorldFromText('#\n.\n#')).toEqual([[1], [1], [2]]);
  });
  it('[Boundary/a11y] passagem já com 2 tiles NÃO é alterada (não alarga à toa)', () => {
    expect(W.buildWorldFromText('#\n.\n.\n#')[0][0]).toBe(2); // teto de pedra preservado
  });
  it('[Right] power-up injetado no mapa (super-corrida=12 em x13,y8)', () => {
    const big = Array.from({ length: 9 }, () => '.'.repeat(14)).join('\n');
    expect(W.buildWorldFromText(big)[8][13]).toBe(12);
  });
});

describe('registro de tiles — consistência cross-módulo (smell: 4 objetos em 2 módulos)', () => {
  it('[Cross-check] todo tipo 0..14 existe em TILE_TYPES, TILE_COLOR (constants) e TYPE_GLYPH, TILE_NAME (tiles)', () => {
    for (let t = 0; t <= 14; t++) {
      expect(C.TILE_TYPES[t], `TILE_TYPES[${t}]`).toBeDefined();
      expect(C.TILE_COLOR[t], `TILE_COLOR[${t}]`).toBeDefined();
      expect(T.TYPE_GLYPH[t], `TYPE_GLYPH[${t}]`).toBeDefined();
      expect(T.TILE_NAME[t], `TILE_NAME[${t}]`).toBeDefined();
    }
  });
});

describe('platform/audio — mixer (import PURO, init explícito; dívida paga Fase 2.25)', () => {
  // [Zero] roda ANTES de qualquer init (é o 1º teste do bloco e nada mais chama initAudioMixer):
  it('[Zero] import não carrega o mixer — audioCat === null até initAudioMixer() (sem I/O no import)', () => {
    expect(AUDIO.audioCat).toBe(null);
    expect(typeof AUDIO.initAudioMixer).toBe('function');
  });
  it('[Interface] após init, audioCat tem exatamente as 9 categorias do AUDIO_CATS', () => {
    AUDIO.initAudioMixer();
    expect(Object.keys(AUDIO.audioCat).sort()).toEqual(AUDIO_CATS.map((c) => c.k).sort());
  });
  it('[Right/a11y] TTS geral nasce DESLIGADO (TEA-safe) e as demais LIGADAS', () => {
    AUDIO.initAudioMixer(); // idempotente
    expect(AUDIO.audioCat.tts.on).toBe(false);
    expect(AUDIO.audioCat.music.on).toBe(true);
    expect(AUDIO.audioCat.ambient.on).toBe(true);
  });
});

describe('core/rng — LCG semeado (determinístico)', () => {
  it('[Right/reprodutibilidade] mesma semente → mesma sequência', () => {
    RNG.reseed(20260601);
    const a = [RNG.rnd(), RNG.rnd(), RNG.rnd()];
    RNG.reseed(20260601);
    expect([RNG.rnd(), RNG.rnd(), RNG.rnd()]).toEqual(a);
  });
  it('[Range] rnd() sempre em [0, 1)', () => {
    RNG.reseed(1);
    for (let i = 0; i < 100; i++) { const v = RNG.rnd(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('[Boundary] randInt(5,5)===5; randInt(1,6) sempre em [1,6]', () => {
    expect(RNG.randInt(5, 5)).toBe(5);
    RNG.reseed(42);
    for (let i = 0; i < 200; i++) { const v = RNG.randInt(1, 6); expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(6); }
  });
  it('[Zero/One] shuffle([])=[] e shuffle([x])=[x]; [Many] preserva o multiset', () => {
    expect(RNG.shuffle([])).toEqual([]);
    expect(RNG.shuffle([7])).toEqual([7]);
    const src = [1, 2, 3, 4, 5];
    expect(RNG.shuffle(src).slice().sort((a, b) => a - b)).toEqual(src);
  });
});

describe('input/state — held(pl, act)', () => {
  const mkPlayer = (over = {}) => ({ ctrl: { jump: ['KeyL'], left: ['KeyA'] }, pad: -1, ...over });

  it('[Zero] nada pressionado → held=false', () => {
    expect(S.held(mkPlayer(), 'jump')).toBe(false);
  });
  it('[One] tecla do esquema aciona held; some ao soltar; não vaza p/ outra ação', () => {
    const pl = mkPlayer();
    S.keys.add('KeyL');
    expect(S.held(pl, 'jump')).toBe(true);
    expect(S.held(pl, 'left')).toBe(false);
    S.keys.delete('KeyL');
    expect(S.held(pl, 'jump')).toBe(false);
  });
  it('[Interface] gamepad associado (pl.pad) aciona held pela padCur', () => {
    const pl = mkPlayer({ pad: 0 });
    S.padCur[0] = { jump: true };
    expect(S.held(pl, 'jump')).toBe(true);
    S.padCur[0] = { jump: false };
    expect(S.held(pl, 'jump')).toBe(false);
    delete S.padCur[0];
  });
  it('[Boundary] pl.pad = -1 ignora o gamepad mesmo com padCur ocupada', () => {
    const pl = mkPlayer({ pad: -1 });
    S.padCur[0] = { jump: true }; // existe, mas não é o pad dele
    expect(S.held(pl, 'jump')).toBe(false);
    delete S.padCur[0];
  });
});

// ⚠️ O DESCRIBE `render/sprites — contrato PURO` SAIU DAQUI na separacao do cartucho (issue #111). O
// modulo `render/sprites` nao e' engine e o `tsconfig.pkg.json` ja' o excluia do pacote por escrito: ele
// importa `virtual:sprite-atlas`, que so' existe dentro do plugin de build do JOGO. As tres asseercoes
// mudaram para `game-platformer/tests/sprites-contrato.node.test.js`, onde o modulo agora vive.
