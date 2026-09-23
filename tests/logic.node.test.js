// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de LÓGICA PURA (project node — sem PIXI/document/localStorage). Padrões: ZOMBIES (ordem/didática) +
// Right-BICEP (rigor). Rótulos no nome do teste. Ver docs/plano-testes.md. Módulos: constants, tiles, world, input/state.
import { describe, it, expect } from 'vitest';
import * as C from '../app/js/core/constants.js';
import * as S from '../app/js/input/state.js';
import * as AUDIO from '../app/js/platform/audio.js';
import { AUDIO_CATS } from '../app/js/platform/audio-mixer.js';
import * as RNG from '../app/js/core/rng.js';

describe('core/constants', () => {
  it('[Right] o que qualquer jogo 2D em pixel usa', () => {
    // ⚠️ `C.TUNE.jumpVel` saiu daqui em 2026-09-07 (issue #63, etapa B) e o `C.ANIM` saiu em 2026-09-23 na F12
    // (ADR-0228): cadências de uma personagem que anda, corre, nada e escala são de um jogo. O que ficou é a
    // grelha, e é a única coisa desta linha que qualquer cartucho partilha.
    expect(C.TILE).toBe(16);
  });
  it('⚠️ [Interface] o que DESCREVE UM MUNDO DE TILES saiu do catálogo, e voltar por engano reprova aqui', () => {
    /*
     * 🎯 Encolher superfície pública é uma major, e uma constante que volte sem querer desfá-la em silêncio.
     * 🔴 ESTE CASO MUDOU DE LADO EM 23/09, e a razão vale mais do que a lista: até aí ele EXIGIA que
     * `TILE_TYPES`, `isHazard` e `isTrampoline` ficassem, «porque o `core/collision.isSolidType` torna perigo e
     * trampolim sólidos no modo cego e no de cadeira de rodas — e isso é acessibilidade». Era verdade, e deixou
     * de ser quando essa regra foi com a geometria que a consulta: as três ficaram sem leitor nenhum na engine.
     * 📌 A engine continua a saber o que é perigo — pergunta o PAPEL ao contrato (`roleOf`), que é o mecanismo
     * que já existia. O que ela deixou de ter é uma tabela de NÚMEROS de tile, que só é verdade num mapa.
     */
    for (const n of ['ANIM', 'EASY', 'TILE_COLOR', 'TILE_TYPES', 'isHazard', 'isTrampoline']) {
      expect(n in C, `${n} voltou ao catálogo — ele descreve um jogo`).toBe(false);
    }
    expect(C.TILE, 'a GRADE em pixels fica: é o que qualquer jogo 2D em pixel partilha').toBe(16);
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

