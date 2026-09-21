// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de core/collision — consultas de grade (project node, sem PIXI/DOM). Padrões: ZOMBIES + Right-BICEP.
// A colisão recebe um ctx com CLOSURES (estado vivo). Aqui passamos um ctx FALSO controlável → funções puras.
// Ver docs/plano-testes.md + docs/plano-modularizacao-mapa.md (Estágio 4, core/collision).
import { describe, it, expect } from 'vitest';
import * as COL from '../app/js/core/collision.js';
import { TILE } from '../app/js/core/constants.js';

// ctx falso: closures leem `flags` VIVO (mutar flags após initCollision reflete na hora — como no game.js real).
const mkCtx = (grid, flags = {}) => ({
  world: grid, W: grid[0].length, H: grid.length,
  isWheelchair: () => !!flags.wheelchair,
  isModoCego: () => !!flags.blindMode,
  caneDiv: () => flags.caneDiv ?? 1,
  wcSolid: () => flags.wcSolid ?? new Set(),
  gateTiles: () => flags.gateTiles ?? new Set(),
  gateOpen: () => flags.gateOpen ?? true,
});

// Mundos de teste (tipos: 0/1=ar, 2=pedra, 3=água, 4=escada, 5=trampolim, 9=lava). TILE=16.
const FLAT = [ // chão liso na última linha
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2],
];
const RISE_R = [ // degrau sobe p/ a DIREITA (col1 topo em row2; col2 topo em row1)
  [0, 0, 0, 0, 0],
  [0, 0, 2, 0, 0],
  [0, 2, 2, 0, 0],
  [2, 2, 2, 2, 2],
];
const RISE_L = [ // degrau sobe p/ a ESQUERDA (col3 topo em row2; col2 topo em row1)
  [0, 0, 0, 0, 0],
  [0, 0, 2, 0, 0],
  [0, 0, 2, 2, 0],
  [2, 2, 2, 2, 2],
];

describe('core/collision — tileAt (leitura da grade)', () => {
  it('[Interface] dentro do mundo → o tipo do tile em grid[y][x]', () => {
    COL.initCollision(mkCtx(RISE_R));
    expect(COL.tileAt(2, 1)).toBe(2); // grid[1][2]
    expect(COL.tileAt(0, 0)).toBe(0);
  });
  it('[Boundary] fora do mundo (qualquer borda) → pedra(2) = parede natural', () => {
    COL.initCollision(mkCtx(FLAT));
    expect(COL.tileAt(-1, 0)).toBe(2);
    expect(COL.tileAt(0, -1)).toBe(2);
    expect(COL.tileAt(5, 0)).toBe(2); // W=5 → x=5 fora
    expect(COL.tileAt(0, 4)).toBe(2); // H=4 → y=4 fora
  });
});

describe('core/collision — isSolidType (por TIPO de tile)', () => {
  it('[Right] modo normal: pedra(2)/parede(6)/trampolim(5) sólidos; ar(0,1)/água(3)/escada(4)/lava(9) não', () => {
    COL.initCollision(mkCtx(FLAT));
    expect(COL.isSolidType(2)).toBe(true);
    expect(COL.isSolidType(6)).toBe(true);
    expect(COL.isSolidType(5)).toBe(true);  // trampolim já é sólido (bouncy)
    expect(COL.isSolidType(0)).toBe(false);
    expect(COL.isSolidType(1)).toBe(false);
    expect(COL.isSolidType(3)).toBe(false); // água
    expect(COL.isSolidType(4)).toBe(false); // escada
    expect(COL.isSolidType(9)).toBe(false); // lava (perigo, não-sólido)
  });
  it('[Right/a11y] cadeirante: lava(9) vira chão (atravessável/piso)', () => {
    COL.initCollision(mkCtx(FLAT, { wheelchair: true }));
    expect(COL.isSolidType(9)).toBe(true);
  });
  it('[Right/a11y] modo cego: SÓ lava(9) vira chão; trampolim(5) segue como está (já sólido)', () => {
    COL.initCollision(mkCtx(FLAT, { blindMode: true }));
    expect(COL.isSolidType(9)).toBe(true);
    expect(COL.isSolidType(5)).toBe(true);
  });
  it('[Cross-check/live] mudar o flag SEM reinicializar altera o resultado (closures leem estado vivo)', () => {
    const flags = { wheelchair: false };
    COL.initCollision(mkCtx(FLAT, flags));
    expect(COL.isSolidType(9)).toBe(false);
    flags.wheelchair = true;                 // muta o estado vivo — sem novo initCollision
    expect(COL.isSolidType(9)).toBe(true);   // a colisão vê o valor ATUAL
  });
});

describe('core/collision — solidAt / solidTile (portão + sólidos só-cadeirante)', () => {
  it('[Right/Inverse] portão fechado torna gateTiles sólidos; aberto, não', () => {
    const flags = { gateTiles: new Set(['2,1']), gateOpen: false };
    COL.initCollision(mkCtx(FLAT, flags)); // grid[1][2]=0 (ar) → só o portão decide
    expect(COL.solidAt(2, 1)).toBe(true);
    flags.gateOpen = true;
    expect(COL.solidAt(2, 1)).toBe(false);
  });
  it('[Right] wcSolid (ponte só-cadeirante) SÓ conta no modo cadeirante', () => {
    const flags = { wcSolid: new Set(['0,0']), wheelchair: false };
    COL.initCollision(mkCtx(FLAT, flags)); // grid[0][0]=0 (ar)
    expect(COL.solidAt(0, 0)).toBe(false);
    expect(COL.solidTile(0, 0)).toBe(false);
    flags.wheelchair = true;
    expect(COL.solidAt(0, 0)).toBe(true);
    expect(COL.solidTile(0, 0)).toBe(true);
  });
});

describe('core/collision — surfTop (topo caminhável)', () => {
  it('[Right] sólido com ar acima = topo', () => {
    COL.initCollision(mkCtx(RISE_R));
    expect(COL.surfTop(1, 2)).toBe(true); // col1 topo em row2 (ar em row1)
  });
  it('[Inverse] sólido com sólido acima NÃO é topo (é parede interna)', () => {
    COL.initCollision(mkCtx(RISE_R));
    expect(COL.surfTop(2, 2)).toBe(false); // col2 row2 tem pedra em row1 acima
  });
});

describe('core/collision — rampSurfaceY (diagonal 45° de rampa de 1 tile)', () => {
  it('[Right] degrau sobe p/ a DIREITA → altura = y*TILE - fx', () => {
    COL.initCollision(mkCtx(RISE_R));
    // cx=20 (tcx=1, fx=4), py=34 (na faixa do degrau) → surfTop(1,2) & surfTop(2,1) → 2*16 - 4 = 28
    expect(COL.rampSurfaceY(20, 34)).toBe(28);
  });
  it('[Right] degrau sobe p/ a ESQUERDA → altura = (y-1)*TILE + fx', () => {
    COL.initCollision(mkCtx(RISE_L));
    // cx=52 (tcx=3, fx=4), py=34 → surfTop(3,2) & surfTop(2,1) → 1*16 + 4 = 20
    expect(COL.rampSurfaceY(52, 34)).toBe(20);
  });
  it('[Zero] chão liso (sem degrau) → null', () => {
    COL.initCollision(mkCtx(FLAT));
    expect(COL.rampSurfaceY(20, 20)).toBe(null);
  });
  it('[Boundary] canto superior-esquerdo do mundo, sem rampa válida → null (não estoura índice)', () => {
    const topStep = [[0, 0, 0], [2, 2, 0], [2, 2, 2]]; // vizinho à esquerda cai fora do mundo (guard y<1 + bordas)
    COL.initCollision(mkCtx(topStep));
    expect(COL.rampSurfaceY(0, 0)).toBe(null);
  });
});

describe('core/collision — caneBlockPx (passo da bengala)', () => {
  it('[Interface/live] TILE/divisor; muda com o divisor sem reinit', () => {
    const flags = { caneDiv: 1 };
    COL.initCollision(mkCtx(FLAT, flags));
    expect(COL.caneBlockPx()).toBe(TILE);       // 1 batida por bloco
    flags.caneDiv = 2;
    expect(COL.caneBlockPx()).toBe(TILE / 2);   // 1 batida por meio-bloco
  });
});
