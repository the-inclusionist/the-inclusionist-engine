// SPDX-License-Identifier: AGPL-3.0-or-later
// A ROTA NÃO ATRAVESSA PAREDE, E É SÓ ISSO QUE ELA TEM DE PROVAR (#84, item 1).
//
// ========================= O QUE ESTE FICHEIRO AFERE =========================
// A #84 diz que a pista de hoje «aponta em linha reta para o alvo, e a linha reta atravessa parede». O caso
// central deste ficheiro é exatamente esse desenho: um alvo perto, atrás de um muro, e um alvo longe, por um
// corredor aberto. A resposta certa é o LONGE.
//
// ⚠️ E ele reprova por si mesmo se o mapa estiver mal desenhado: um `[Cross-check]` afirma que, em linha
// reta, o vencedor seria o outro. Sem isso o caso central podia ficar verde por os dois estarem à mesma
// distância, e eu nunca saberia.
//
// Project `node` porque não há DOM nenhum aqui: é aritmética sobre o contrato.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { routeTo, isWalkable, WALKABLE_ROLES } from '../app/js/core/route.js';
import { distance } from '../app/js/core/contract.js';

const GRADE = (w, h, move = 'orthogonal') => ({ kind: 'grid', size: [w, h], move, frame: 'compass' });

/** Um mapa desenhado em texto: `#` é parede, `.` é ar, `~` é água, `^` é espinho, `+` é portão, `L` escada. */
function mapa(linhas) {
  const PAPEL = { '#': 'structure', '.': 'free', '~': 'water', '^': 'hazard', '+': 'gate', L: 'climb', k: 'key' };
  return (at) => {
    const linha = linhas[at.y];
    const c = linha ? linha[at.x] : undefined;
    return PAPEL[c] ?? 'structure'; // fora do desenho é parede: o mapa é o que está escrito
  };
}

describe('core/route — o que se atravessa é leitura do contrato, não invenção', () => {
  it('[Right] ar, água, escada e chave deixam passar; parede, portão e espinho não', () => {
    expect([...WALKABLE_ROLES].sort()).toEqual(['climb', 'free', 'key', 'water']);
    for (const p of ['free', 'water', 'climb', 'key']) expect(isWalkable(p), p).toBe(true);
    for (const p of ['structure', 'gate', 'hazard', 'goal']) expect(isWalkable(p), p).toBe(false);
  });
});

describe('core/route — a rota contorna, a linha reta atravessa', () => {
  //  0123456
  // 0.......
  // 1.#####.
  // 2.#...#.
  // 3.#.A.#.     A = alvo perto, EMPAREDADO
  // 4.#####.
  // 5.......
  // 6...B...     B = alvo longe, por fora
  const DESENHO = [
    '.......',
    '.#####.',
    '.#...#.',
    '.#...#.',
    '.#####.',
    '.......',
    '.......',
  ];
  const topo = GRADE(7, 7);
  const ctx = { topology: topo, roleAt: mapa(DESENHO) };
  const DE = { x: 3, y: 0 };
  const PERTO = { x: 3, y: 3 };   // isInside da caixa fechada
  const LONGE = { x: 3, y: 6 };   // fora, alcançável contornando

  it('⚠️ [Cross-check] em LINHA RETA o vencedor seria o emparedado — senão este ficheiro não prova nada', () => {
    expect(distance(topo, DE, PERTO)).toBeLessThan(distance(topo, DE, LONGE));
  });

  it('⚠️ [Right] a rota escolhe o alcançável, e não o mais perto', () => {
    const r = routeTo(ctx, DE, [PERTO, LONGE]);
    expect(r, 'não achou rota nenhuma').not.toBe(null);
    expect(r.reached).toEqual(LONGE);
  });

  it('[Right] `passos` conta o caminho andado, não a reta', () => {
    const r = routeTo(ctx, DE, [LONGE]);
    // Contornar pela esquerda ou pela direita dá o mesmo: 6 de descida + 2 de desvio, ida e volta.
    expect(r.steps).toBeGreaterThan(distance(topo, DE, LONGE));
  });

  it('⚠️ [Right] `proximo` é UM passo — é isso que a pista aponta', () => {
    const r = routeTo(ctx, DE, [LONGE]);
    expect(distance(topo, DE, r.next)).toBe(1);
    expect(ctx.roleAt(r.next), 'o primeiro passo caiu numa parede').not.toBe('structure');
  });

  it('[Zero] alvo TOTALMENTE emparedado devolve null — «não sei», e a pista cala-se', () => {
    expect(routeTo(ctx, DE, [PERTO])).toBe(null);
  });

  it('[Zero] sem alvo nenhum, null', () => {
    expect(routeTo(ctx, DE, [])).toBe(null);
  });

  it('[Boundary] estar EM CIMA do alvo é zero passos, e o próximo é o próprio sítio', () => {
    const r = routeTo(ctx, LONGE, [LONGE]);
    expect(r).toEqual({ next: LONGE, reached: LONGE, steps: 0 });
  });
});

describe('core/route — a métrica declarada decide quantos vizinhos um ponto tem', () => {
  // Um corredor diagonal: só se atravessa andando na diagonal.
  //  012
  // 0.#.
  // 1#.#
  // 2.#.
  const DIAGONAL = ['.#.', '#.#', '.#.'];

  it('⚠️ [Interface] com `diagonal` a rota passa; com `orthogonal` NÃO — e é o contrato a decidir', () => {
    const de = { x: 0, y: 0 }, ate = { x: 2, y: 2 };
    const comDiagonal = { topology: GRADE(3, 3, 'diagonal'), roleAt: mapa(DIAGONAL) };
    const semDiagonal = { topology: GRADE(3, 3, 'orthogonal'), roleAt: mapa(DIAGONAL) };
    expect(routeTo(comDiagonal, de, [ate]), 'a diagonal era legal e a rota não a usou').not.toBe(null);
    expect(routeTo(semDiagonal, de, [ate]), 'andou na diagonal onde ela não existe').toBe(null);
  });
});

describe('core/route — os casos que o contrato manda tratar', () => {
  it('⚠️ [Boundary] o ÚLTIMO passo entra num alvo que não se atravessa', () => {
    // Uma bandeira declarada dentro de um portão. Recusar entrar faria a rota nunca chegar.
    const DESENHO = ['...+'];
    const ctx = { topology: GRADE(4, 1), roleAt: mapa(DESENHO) };
    const r = routeTo(ctx, { x: 0, y: 0 }, [{ x: 3, y: 0 }]);
    expect(r, 'o alvo dentro do portão ficou inalcançável').not.toBe(null);
    expect(r.steps).toBe(3);
  });

  it('⚠️ [Boundary] mas NÃO se atravessa o portão para continuar do outro lado', () => {
    const DESENHO = ['..+..'];
    const ctx = { topology: GRADE(5, 1), roleAt: mapa(DESENHO) };
    expect(routeTo(ctx, { x: 0, y: 0 }, [{ x: 4, y: 0 }])).toBe(null);
  });

  it('⚠️ [Boundary] nem o espinho — e essa é a escolha declarada no cabeçalho', () => {
    const DESENHO = ['..^..'];
    const ctx = { topology: GRADE(5, 1), roleAt: mapa(DESENHO) };
    expect(routeTo(ctx, { x: 0, y: 0 }, [{ x: 4, y: 0 }]),
      'a rota mandou a criança levar dano').toBe(null);
  });

  it('[Right] água e escada deixam passar', () => {
    const ctx = { topology: GRADE(5, 1), roleAt: mapa(['.~L..']) };
    expect(routeTo(ctx, { x: 0, y: 0 }, [{ x: 4, y: 0 }])?.steps).toBe(4);
  });

  it('⚠️ [Zero] `hotspots` não tem espaço, logo não tem rota', () => {
    // Uma lista ordenada não tem geometria: inventar uma direção ali seria mentir, e o `bearing` do contrato
    // já responde `none` pelo mesmo motivo.
    const ctx = { topology: { kind: 'hotspots', order: ['a', 'b', 'c'] }, roleAt: () => 'free' };
    expect(routeTo(ctx, { x: 0, y: 0 }, [{ x: 2, y: 0 }])).toBe(null);
  });

  it('⚠️ [Exercise] o ORÇAMENTO corta, e `null` quer dizer «não sei» e não «não há»', () => {
    // O aviso está escrito no `core/contract`: enumerar um mapa grande por quadro seria caro. Um campo aberto
    // de 60×60 com o alvo no canto tem caminho de sobra — o que se afere é que a busca DESISTE em vez de o
    // varrer inteiro, e que com orçamento à altura ela acha.
    const aberto = { topology: GRADE(60, 60), roleAt: () => 'free' };
    const de = { x: 0, y: 0 }, ate = { x: 59, y: 59 };
    expect(routeTo({ ...aberto, budget: 50 }, de, [ate]), 'varreu o mapa apesar do teto').toBe(null);
    expect(routeTo({ ...aberto, budget: 20000 }, de, [ate]), 'com folga tinha de achar').not.toBe(null);
  });

  it('[Boundary] fora da extensão declarada não é caminho', () => {
    // `size` é 3×1: `y = 1` não existe, e um vizinho para lá não pode ser considerado.
    const ctx = { topology: GRADE(3, 1), roleAt: () => 'free' };
    const r = routeTo(ctx, { x: 0, y: 0 }, [{ x: 2, y: 0 }]);
    expect(r.steps).toBe(2);
    expect(r.next).toEqual({ x: 1, y: 0, z: 0 });
  });
});

describe('core/route — contínuo: a grelha é uma AMOSTRAGEM, e está declarada como tal', () => {
  const CONT = { kind: 'continuous', size: [64, 16], unit: 8, move: 'free', frame: 'clock' };

  it('[Right] anda em passos de `unit` e chega a meio passo do alvo', () => {
    const ctx = { topology: CONT, roleAt: () => 'free' };
    const r = routeTo(ctx, { x: 0, y: 0 }, [{ x: 24, y: 0 }]);
    expect(r).not.toBe(null);
    expect(r.next.x, 'o primeiro passo não tem o tamanho da unidade').toBe(8);
    expect(r.steps).toBe(3);
  });

  it('⚠️ [Boundary] um alvo ENTRE pontos da grelha continua alcançável', () => {
    // 20 não é múltiplo de 8. Sem a tolerância de meio passo a rota nunca «chegaria», e o guia calaria-se
    // num alvo que está mesmo ali — que é o modo de falhar mais cruel: silêncio sobre o que existe.
    const ctx = { topology: CONT, roleAt: () => 'free' };
    expect(routeTo(ctx, { x: 0, y: 0 }, [{ x: 20, y: 0 }])).not.toBe(null);
  });

  it('[Zero] unidade zero não faz a fila andar — devolve null em vez de rodar para sempre', () => {
    const ctx = { topology: { ...CONT, unit: 0 }, roleAt: () => 'free' };
    expect(routeTo(ctx, { x: 0, y: 0 }, [{ x: 24, y: 0 }])).toBe(null);
  });
});

describe('core/route — what the probe of 2026-09-23 found unheld', () => {
  // 🔴 Eight of nineteen decisions of `routeTo` could be undone with this file green. Each case is one rule the sonar's guide meets.
  it('⚠️ [Zero] `hotspots` has no route even to the spot the child is already on — a list has no «here»', () => {
    const ctx = { topology: { kind: 'hotspots', order: ['a', 'b', 'c'] }, roleAt: () => 'free' };
    expect(routeTo(ctx, { x: 0, y: 0 }, [{ x: 0, y: 0 }])).toBe(null);
  });

  it('[Zero] with no target, the world is not asked about a single cell', () => {
    let asked = 0;
    const ctx = { topology: GRADE(20, 20), roleAt: () => { asked += 1; return 'free'; } };
    expect(routeTo(ctx, { x: 0, y: 0 }, [])).toBe(null);
    expect(asked, 'the whole map was searched for nothing').toBe(0);
  });

  it('⚠️ [Boundary] a NEGATIVE unit is refused too — it would walk exactly like a positive one', () => {
    const ctx = { topology: { kind: 'continuous', size: [64, 16], unit: -8, move: 'free', frame: 'clock' }, roleAt: () => 'free' };
    expect(routeTo(ctx, { x: 0, y: 0 }, [{ x: 24, y: 0 }])).toBe(null);
  });

  it('⚠️ [Boundary] in a continuous space two points half a unit apart are two points, not one', () => {
    // with keys rounded to whole numbers, 0.5 and 1 would share a key («1») and the corridor would close
    const ctx = { topology: { kind: 'continuous', size: [2, 0], unit: 0.5, move: 'free', frame: 'clock' }, roleAt: () => 'free' };
    expect(routeTo(ctx, { x: 0, y: 0 }, [{ x: 2, y: 0 }])?.steps).toBe(4);
  });

  it('[Boundary] the budget counts the cell the child stands on, and is spent only when EXCEEDED', () => {
    const ctx = { topology: GRADE(3, 1), roleAt: () => 'free' };
    // from the middle, the left cell is looked at first and the target second: three cells in all
    expect(routeTo({ ...ctx, budget: 2 }, { x: 1, y: 0 }, [{ x: 2, y: 0 }])).toBe(null);
    expect(routeTo({ ...ctx, budget: 3 }, { x: 1, y: 0 }, [{ x: 2, y: 0 }])?.steps).toBe(1);
  });

  it('[Right] a three-dimensional grid walks along z too', () => {
    const ctx = { topology: { kind: 'grid', size: [1, 1, 3], move: 'orthogonal', frame: 'compass' }, roleAt: () => 'free' };
    const r = routeTo(ctx, { x: 0, y: 0, z: 0 }, [{ x: 0, y: 0, z: 2 }]);
    expect(r?.steps).toBe(2);
    expect(r?.next).toEqual({ x: 0, y: 0, z: 1 });
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · tirando `if (!isWalkable(ctx.roleAt(vizinho))) continue;` → reprovam SETE casos, entre eles "[Right]
//     a rota escolhe o alcançável" (que passa a apontar o alvo EMPAREDADO) e "[Zero] alvo totalmente
//     emparedado" (que devolve rota em vez de null). É o defeito da #84 reproduzido: a pista atravessa a
//     parede. ⚠️ Eu tinha registado dois; são sete, e a diferença é boa notícia — a propriedade está presa
//     por vários lados, e não por um caso só.
//   · trocando o `primeiro` por `vizinho` (guardar sempre o último passo em vez do primeiro) → reprovam TRÊS,
//     entre eles "[Right] `proximo` é UM passo".
//   · pondo `if (ortogonal && n > 1) continue;` a valer sempre → "[Interface] com `diagonal` a rota passa"
//     reprova: o corredor diagonal fecha-se.
//   · movendo o teste de alvo (`chegou`) para DEPOIS do teste de atravessabilidade → "[Boundary] o ÚLTIMO
//     passo entra num alvo que não se atravessa" reprova com null.
//   · trocando `tolerancia` de 0.5 para 0 no contínuo → "[Boundary] um alvo ENTRE pontos da grelha" reprova.
