// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/player-anim — a ESCOLHA DO QUADRO do personagem (project node). ZOMBIES + Right-BICEP.
// A função é a única parte da antiga cauda do `stepPlayer` que é decisão pura, então dá para cobrir a CADEIA
// DE PRIORIDADE E17 inteira (ventosa → escada → água → voo → aéreo → andando → idle) e, mais importante, as
// PRECEDÊNCIAS entre os ramos: cada teste de precedência liga DOIS estados ao mesmo tempo e exige o vencedor.
// As texturas são etiquetas de string (não PIXI): o contrato é "qual quadro", não "qual pixel".
// Ver docs/5-Refactoring/plano-modularizacao-mapa.md (C1).
import { describe, it, expect } from 'vitest';
import { choosePlayerFrame, COYOTE } from '../app/js/render/player-anim.js';
import { makePlayer } from '../app/js/game/player.js';
import { ANIM } from '../app/js/core/constants.js';

// Conjunto de quadros FALSO, com a mesma CARDINALIDADE do real (render/sprites.SPRITE_MANIFEST):
// idle 4 · andar 8 · correr 4 · escada 2 · parede 4 · teto 4 · nadar 2 · nadar-parado 2.
// As gracinhas repetem seq/hold dos FLAVORS reais — o ciclo depende desses números.
const N = (p, n) => Array.from({ length: n }, (_, i) => p + i);
const TEX = {
  // A chave `run` aqui e NOME DE ANIMACAO — o conjunto de quadros da corrida, que `render/player-anim` le
  // como `tex.run`. NAO e o nome de uma acao, e por isso NAO migrou para `action1` com as outras. O
  // renomeador da migracao trocou-a por engano e o teste rebentou com `Cannot read properties of undefined`.
  idle: N('i', 4), walk: N('w', 8), run: N('r', 4),
  jumpUp: 'JUMP_UP', jumpDown: 'JUMP_DOWN',
  climb: N('c', 2), fly: 'FLY',
  clingWall: N('pw', 4), clingCeil: N('pt', 4),
  swim: N('s', 2), swimIdle: N('si', 2),
  flavors: [
    { seq: [0, 1, 0, 1, 0, 1], hold: 12, tex: N('joinha', 2) },
    { seq: [0, 1, 1, 1, 1, 0], hold: 16, tex: N('espreg', 2) },
    { seq: [0, 0, 0], hold: 40, tex: N('aquec', 1) },
  ],
};

// Jogador de teste: makePlayer real (mesmos ~45 campos do jogo) + overrides. airTime=0 → no chão.
function novo(over = {}) {
  return Object.assign(makePlayer(0), { airTime: 0, onGround: true }, over);
}
// env padrão: 1 tick, sem direção, sem cadeira, nenhuma tecla segurada, RNG travado.
function env(over = {}) {
  return { dt: 1, dir: 0, wheelchair: false, held: () => false, rnd: () => 0, tex: TEX, ...over };
}
// atalho: só a tecla `act` segurada
const holding = (act) => (_pl, a) => a === act;

/* ===================== ZOMBIES: o caso simples ===================== */

describe('render/player-anim — o caso base (parado, no chão)', () => {
  it('[Zero] parado sem nada ligado → respiração (idle), e devolve o MESMO valor que grava em pl._tx', () => {
    const pl = novo({ anim: ANIM.idleHold * 2 - 1 }); // após o +=dt vira 40 → floor(40/20)%4 = 2
    const tx = choosePlayerFrame(pl, env());
    expect(tx).toBe('i2');
    expect(pl._tx).toBe('i2');
    expect(pl.idleNow).toBe(true);
  });
  it('[One] andando no chão → o ciclo de 8 quadros, indexado por walkAnim/walkHold', () => {
    const pl = novo({ walkAnim: ANIM.walkHold * 3 - 1 }); // o +=dt leva a 18 → floor(18/6)%8 = 3
    expect(choosePlayerFrame(pl, env({ dir: 1 }))).toBe('w3');
  });
  it('[Right] os relógios avançam por dt (anim e walkAnim), e walkAnim NÃO é resetado ao parar', () => {
    const pl = novo({ anim: 5, walkAnim: 100 });
    choosePlayerFrame(pl, env({ dt: 3 })); // parado
    expect(pl.anim).toBe(8);
    expect(pl.walkAnim).toBe(103); // o ciclo de 8 nunca reinicia (era o bug dos "só 2 quadros")
  });
});

/* ===================== a CADEIA DE PRIORIDADE E17, ramo a ramo ===================== */

describe('render/player-anim — cada ramo da cadeia, isolado', () => {
  it('ventosa na PAREDE usa clingWall; no TETO (clingN==="U") usa clingCeil', () => {
    const parede = novo({ clinging: true, clingN: 'R', vx: 1, walkAnim: ANIM.clingHold * 2 - 1 }); // →20 → floor(20/10)%4=2
    expect(choosePlayerFrame(parede, env())).toBe('pw2');
    const teto = novo({ clinging: true, clingN: 'U', vx: 1, walkAnim: ANIM.clingHold * 2 - 1 });
    expect(choosePlayerFrame(teto, env())).toBe('pt2');
  });
  it('escada SUBINDO cicla; escada PARADA (vy=0) trava no quadro 0', () => {
    const subindo = novo({ onLadder: true, vy: -1, walkAnim: ANIM.climbHold - 1 }); // 8 → floor(8/8)%2=1
    expect(choosePlayerFrame(subindo, env())).toBe('c1');
    const parada = novo({ onLadder: true, vy: 0, walkAnim: ANIM.climbHold - 1 });
    expect(choosePlayerFrame(parada, env())).toBe('c0');
  });
  it('água: com direção → braçada (swim); sem direção e sem pulo → boiando (swimIdle)', () => {
    const nadando = novo({ inWater: true, walkAnim: ANIM.swimHold - 1 }); // 24 → floor(24/24)%2=1
    expect(choosePlayerFrame(nadando, env({ dir: -1 }))).toBe('s1');
    const boiando = novo({ inWater: true, walkAnim: ANIM.swimHold - 1 });
    expect(choosePlayerFrame(boiando, env())).toBe('si1');
  });
  it('água: segurar PULO também conta como braçada (mesmo com dir=0)', () => {
    const pl = novo({ inWater: true, walkAnim: ANIM.swimHold - 1 });
    expect(choosePlayerFrame(pl, env({ held: holding('action2') }))).toBe('s1');
  });
  it('voo → quadro único FLY', () => {
    expect(choosePlayerFrame(novo({ flying: true }), env())).toBe('FLY');
  });
  it('aéreo: subindo (vy<0) = JUMP_UP; caindo (vy>0) = JUMP_DOWN', () => {
    expect(choosePlayerFrame(novo({ vy: -3, onGround: false }), env())).toBe('JUMP_UP');
    expect(choosePlayerFrame(novo({ vy: 3, onGround: false, airTime: 6 }), env())).toBe('JUMP_DOWN');
  });
  it('correr (E19): outro conjunto de quadros E outra cadência', () => {
    const pl = novo({ walkAnim: ANIM.runHold * 3 - 1 }); // →24 → floor(24/8)%4 = 3 (com walkHold daria 4%8=4)
    expect(choosePlayerFrame(pl, env({ dir: 1, held: holding('action1') }))).toBe('r3');
  });
});

/* ===================== as PRECEDÊNCIAS — o que este módulo realmente decide ===================== */

describe('render/player-anim — precedências da cadeia E17 (dois estados ligados de uma vez)', () => {
  it('ventosa VENCE escada', () => {
    const pl = novo({ clinging: true, clingN: 'R', onLadder: true, vy: -1, vx: 1, walkAnim: 0 });
    expect(choosePlayerFrame(pl, env())).toBe('pw0');
  });
  it('ventosa VENCE água', () => {
    const pl = novo({ clinging: true, clingN: 'R', inWater: true, vx: 1, walkAnim: 0 });
    expect(choosePlayerFrame(pl, env({ dir: 1 }))).toBe('pw0');
  });
  it('escada VENCE água', () => {
    const pl = novo({ onLadder: true, inWater: true, vy: -1, walkAnim: 0 });
    expect(choosePlayerFrame(pl, env({ dir: 1 }))).toBe('c0');
  });
  it('água VENCE voo', () => {
    const pl = novo({ inWater: true, flying: true, walkAnim: 0 });
    expect(choosePlayerFrame(pl, env({ dir: 1 }))).toBe('s0');
  });
  it('voo VENCE aéreo (voando e caindo → FLY, não JUMP_DOWN)', () => {
    const pl = novo({ flying: true, vy: 5, onGround: false, airTime: 99 });
    expect(choosePlayerFrame(pl, env())).toBe('FLY');
  });
  it('aéreo VENCE andando (no ar com direção segurada → pulo, não passo)', () => {
    const pl = novo({ vy: -2, onGround: false, walkAnim: 0 });
    expect(choosePlayerFrame(pl, env({ dir: 1 }))).toBe('JUMP_UP');
  });
  it('andando VENCE idle (com direção não entra em respiração nem em gracinha)', () => {
    const pl = novo({ walkAnim: 0, idleTime: 9999 });
    expect(choosePlayerFrame(pl, env({ dir: 1 }))).toBe('w0');
    expect(pl.idleNow).toBe(false);
  });
  it('ventosa VENCE o estado aéreo (clinging zera `airborne` mesmo com airTime alto)', () => {
    const pl = novo({ clinging: true, clingN: 'L', airTime: 99, onGround: false, vy: 4, vx: 1, walkAnim: 0 });
    expect(choosePlayerFrame(pl, env())).toBe('pw0');
  });
});

/* ===================== E16: o coyote-time da ANIMAÇÃO ===================== */

describe('render/player-anim — COYOTE (E16: mata o flicker walk↔jump no pouso)', () => {
  // A FOLGA É 5 QUADROS, não "alguma folga": o número é o contrato (ancorado em literal de propósito —
  // escrever `airTime: COYOTE` faria o teste acompanhar qualquer mudança do valor e nunca falhar).
  it('[Boundary] a folga é de exatamente 5 quadros', () => {
    expect(COYOTE).toBe(5);
  });
  it('[Boundary] airTime === 5 ainda conta como CHÃO → anda', () => {
    const pl = novo({ airTime: 5, onGround: false, vy: 2, walkAnim: 0 });
    expect(choosePlayerFrame(pl, env({ dir: 1 }))).toBe('w0');
  });
  it('[Boundary] airTime === 6 já é AÉREO → cai', () => {
    const pl = novo({ airTime: 6, onGround: false, vy: 2, walkAnim: 0 });
    expect(choosePlayerFrame(pl, env({ dir: 1 }))).toBe('JUMP_DOWN');
  });
  it('subir (vy<0 fora do chão) entra no aéreo NA HORA, sem esperar o coyote', () => {
    const pl = novo({ airTime: 0, onGround: false, vy: -1, walkAnim: 0 });
    expect(choosePlayerFrame(pl, env({ dir: 1 }))).toBe('JUMP_UP');
  });
  it('vy<0 mas AINDA no chão (onGround) não é aéreo — o quadro do pique não rouba o passo', () => {
    const pl = novo({ airTime: 0, onGround: true, vy: -1, walkAnim: 0 });
    expect(choosePlayerFrame(pl, env({ dir: 1 }))).toBe('w0');
  });
});

/* ===================== congelamento: cadeira de rodas e Movimento Reduzido ===================== */

describe('render/player-anim — wcFreeze (cadeirante) congela a locomoção', () => {
  const wc = (over) => choosePlayerFrame(novo(over), env({ wheelchair: true, dir: 1 }));
  it('andando → pose neutra sentado (idle[0]), sem ciclo de passos', () => {
    expect(wc({ walkAnim: 999 })).toBe('i0');
  });
  it('escada/elevador → idle[0], NUNCA a pose de escada', () => {
    expect(wc({ onLadder: true, vy: -2, walkAnim: 999 })).toBe('i0');
  });
  it('água → boiando no quadro 0 (pernas paradas), mesmo com direção', () => {
    expect(wc({ inWater: true, walkAnim: 999 })).toBe('si0');
  });
  it('caindo → idle[0] (sentado), não JUMP_DOWN', () => {
    expect(wc({ onGround: false, airTime: 99, vy: 5 })).toBe('i0');
  });
});

describe('render/player-anim — rmWalk (Movimento Reduzido do personagem) congela sem sentar', () => {
  const rm = (over) => choosePlayerFrame(novo({ rmWalk: true, ...over }), env({ dir: 1 }));
  it('andando → idle[0]', () => { expect(rm({ walkAnim: 999 })).toBe('i0'); });
  it('escada subindo → quadro 0 da escada (climbing exige !rmWalk)', () => { expect(rm({ onLadder: true, vy: -2, walkAnim: 999 })).toBe('c0'); });
  it('água → boiando no quadro 0', () => { expect(rm({ inWater: true, walkAnim: 999 })).toBe('si0'); });
  it('CAINDO → JUMP_UP (um quadro só) — difere do cadeirante, que vira idle[0]', () => {
    expect(rm({ onGround: false, airTime: 99, vy: 5 })).toBe('JUMP_UP');
  });
  it('ventosa → quadro 0, e o climbFrame NÃO avança', () => {
    const pl = novo({ rmWalk: true, clinging: true, clingN: 'R', vx: 3, vy: 3, walkAnim: 999, climbFrame: 0 });
    expect(choosePlayerFrame(pl, env())).toBe('pw0');
    expect(pl.climbFrame).toBe(0);
  });
});

/* ===================== ventosa: o quadro CONGELA quando se para ===================== */

describe('render/player-anim — ventosa: parado na parede MANTÉM o quadro', () => {
  it('movendo (vx≠0) avança climbFrame a partir de walkAnim', () => {
    const pl = novo({ clinging: true, clingN: 'R', vx: -1, walkAnim: ANIM.clingHold * 2 - 1, climbFrame: 0 }); // →20 → floor(20/10)%4=2
    expect(choosePlayerFrame(pl, env())).toBe('pw2');
    expect(pl.climbFrame).toBe(2);
  });
  it('parado (vx=vy=0) NÃO recalcula: repete o climbFrame anterior mesmo com walkAnim correndo', () => {
    // walkAnim daria o quadro 2 se fosse recalculado; o guardado (3) tem de vencer.
    const pl = novo({ clinging: true, clingN: 'R', vx: 0, vy: 0, walkAnim: ANIM.clingHold * 2 - 1, climbFrame: 3 });
    expect(choosePlayerFrame(pl, env())).toBe('pw3');
    expect(pl.climbFrame).toBe(3);
  });
});

/* ===================== E20: respiração e gracinhas ===================== */

describe('render/player-anim — respiração (idle)', () => {
  it('cicla os 4 quadros por anim/idleHold', () => {
    const pl = novo({ anim: ANIM.idleHold * 5 - 1, rmFlavor: true }); // 100 → floor(100/20)%4 = 1
    expect(choosePlayerFrame(pl, env())).toBe('i1');
  });
  it('rmBreath congela no quadro 0 (o relógio segue correndo, o quadro não)', () => {
    const pl = novo({ anim: ANIM.idleHold * 5 - 1, rmBreath: true, rmFlavor: true });
    expect(choosePlayerFrame(pl, env())).toBe('i0');
    expect(pl.anim).toBe(ANIM.idleHold * 5); // o relógio avançou mesmo assim
  });
});

describe('render/player-anim — gracinhas (flavors)', () => {
  it('[Boundary] idleTime === flavorDelay ainda NÃO dispara (a regra é estritamente maior)', () => {
    const pl = novo({ idleTime: ANIM.flavorDelay - 1, anim: ANIM.idleHold - 1 });
    choosePlayerFrame(pl, env());
    expect(pl.idleTime).toBe(ANIM.flavorDelay);
    expect(pl.flavor).toBe(-1);
  });
  it('[Boundary] idleTime > flavorDelay dispara, e o rnd escolhe QUAL gracinha', () => {
    const pl = novo({ idleTime: ANIM.flavorDelay, flavor: -1 });
    const tx = choosePlayerFrame(pl, env({ rnd: () => 0.5 })); // floor(0.5*3) = 1 → espreguiçar
    expect(pl.flavor).toBe(1);
    expect(pl.flavorT).toBe(1);   // zerado na escolha e já adiantado por dt
    expect(tx).toBe('espreg0');   // seq[0] = 0
  });
  it('o passo da gracinha vem de flavorT/hold e indexa por seq (não por tex direto)', () => {
    // espreguiçar: seq [0,1,1,1,1,0], hold 16. flavorT=16 → step 1 → seq[1]=1 → tex[1]
    const pl = novo({ idleTime: 9999, flavor: 1, flavorT: ANIM.flavorDelay * 0 + 16 });
    expect(choosePlayerFrame(pl, env())).toBe('espreg1');
    // último passo (step 5) volta a seq[5]=0 → tex[0]
    const fim = novo({ idleTime: 9999, flavor: 1, flavorT: 16 * 5 });
    expect(choosePlayerFrame(fim, env())).toBe('espreg0');
  });
  it('[Boundary] ao passar do último passo a gracinha ENCERRA: flavor=-1, idleTime=0 e volta a respirar', () => {
    // aquecer: seq [0,0,0], hold 40 → step 3 é o primeiro fora
    const pl = novo({ idleTime: 9999, flavor: 2, flavorT: 40 * 3, anim: ANIM.idleHold - 1 });
    const tx = choosePlayerFrame(pl, env());
    expect(pl.flavor).toBe(-1);
    expect(pl.idleTime).toBe(0);
    expect(tx).toBe('i1'); // anim virou 20 → floor(20/20)%4 = 1
  });
  it('rmFlavor desliga o sorteio e força flavor=-1 mesmo com idleTime enorme', () => {
    const pl = novo({ idleTime: 99999, rmFlavor: true, flavor: 2, flavorT: 0, anim: ANIM.idleHold - 1 });
    let sorteou = false;
    expect(choosePlayerFrame(pl, env({ rnd: () => { sorteou = true; return 0; } }))).toBe('i1');
    expect(pl.flavor).toBe(-1);
    expect(sorteou).toBe(false);
  });
  it('sair do idle zera idleTime E a gracinha em curso', () => {
    const pl = novo({ idleTime: 5000, flavor: 1, flavorT: 30, walkAnim: 0 });
    choosePlayerFrame(pl, env({ dir: 1 }));
    expect(pl.idleTime).toBe(0);
    expect(pl.flavor).toBe(-1);
  });
});

/* ===================== flags que o RESTO do jogo lê (bengala do modo cego) ===================== */

describe('render/player-anim — pl.walking / pl.running (o que a bengala consome em render/draw)', () => {
  it('andando no chão liga walking; sem direção, desliga', () => {
    const a = novo(); choosePlayerFrame(a, env({ dir: 1 })); expect(a.walking).toBe(true);
    const b = novo(); choosePlayerFrame(b, env({ dir: 0 })); expect(b.walking).toBe(false);
  });
  it('walking é falso na água, na escada, voando e no ar', () => {
    for (const over of [{ inWater: true }, { onLadder: true }, { flying: true }, { onGround: false, airTime: 99 }]) {
      const pl = novo(over); choosePlayerFrame(pl, env({ dir: 1 }));
      expect(pl.walking, JSON.stringify(over)).toBe(false);
    }
  });
  it('running exige walking + tecla Correr + a BENGALA DE CORRIDA (runCane)', () => {
    const sem = novo({ runCane: false }); choosePlayerFrame(sem, env({ dir: 1, held: holding('action1') }));
    expect(sem.running).toBe(false);
    const com = novo({ runCane: true }); choosePlayerFrame(com, env({ dir: 1, held: holding('action1') }));
    expect(com.running).toBe(true);
  });
  it('parado com Correr segurado não é running (walking é o pré-requisito)', () => {
    const pl = novo({ runCane: true }); choosePlayerFrame(pl, env({ dir: 0, held: holding('action1') }));
    expect(pl.running).toBe(false);
  });
});
