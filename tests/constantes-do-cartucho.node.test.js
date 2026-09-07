// SPDX-License-Identifier: AGPL-3.0-or-later
// O QUE `core/constants.ts` EXPORTA E A ENGINE NÃO USA (issue #63, etapa B).
//
// ========================= O QUE ESTE FICHEIRO MEDE, E POR QUE MEDIR E NÃO CORTAR =========================
// A etapa B da #63 é «cortar `core/constants.ts` em engine (resolução, grade) e jogo (`TUNE`, `EASY`, `ANIM`,
// `TILE_TYPES`, `COIN_TARGET`)». A própria issue põe uma condição antes: *«a lista de achados da etapa C é o
// que dirá se este corte é o certo»* — e a lista de C tem sete itens, nenhum feito.
//
// ⚠️ E A MEDIÇÃO DE 07/09 ACHOU O MOTIVO DE A PRESSA SER CARA. Oito exports não têm UM ÚNICO importador
// dentro da engine, e é tentador ler isso como «código morto, apagar é de graça». Não é:
//
//     `game-platformer` importa SEIS DOS OITO, do pacote publicado, por
//     `@the-inclusionist/engine/core/constants.js` — em `game/physics.ts`, `game/player.ts`,
//     `game/session.ts`, `game/tile-roles.ts`, `game/level-geometry.ts`, `game/elevators.ts`,
//     `main.ts` e mais dois módulos do jogo.
//
// ⚠️ «MAIS DOIS MÓDULOS» PORQUE ESTE FICHEIRO NÃO OS PODE NOMEAR, e a limitação é um gate a funcionar, não
// um esquecimento: `engine-boundary` proíbe um teste de engine de dizer as palavras do jogo, e os nomes
// desses dois são palavras do jogo. Ele acusou-me ao escrever isto — corretamente. Quem quiser a lista
// inteira faz um `grep` por `core/constants.js` no `game-platformer`; o que importa aqui é o REPOSITÓRIO
// que consome, e esse está dito.
//
// Não são órfãos. São a SUPERFÍCIE PÚBLICA que o cartucho consome, e ficaram sem importador cá dentro
// exactamente porque o cartucho saiu (#111). Apagá-los parte o segundo consumidor real e é uma quebra
// semver de um pacote publicado — quer dizer, uma major e uma edição em duas árvores no mesmo passo.
//
// Então o que este ficheiro faz é o que se pode fazer sem decidir nada: **manter o número visível e a
// encolher**. É o padrão do ADR-0043 — dívida conhecida com tecto que só desce —, e o LIVRO abaixo é, ao
// mesmo tempo, o gate e a folha de trabalho do corte da etapa B.
//
// ========================= AS DUAS QUE SÃO MESMO MORTAS =========================
// `JUMP_BASE` e `ehChave` não são usadas por ninguém: nem pela engine, nem pelos testes dela (fora um), nem
// pelo `game-platformer`. A #63 já nomeia a primeira no seu «achado solto»: o único uso é um teste que
// verifica que `JUMP_BASE === jumpVel * sqrt(8/5)`, ou seja, reafirma a própria definição.
//
// ⚠️ ELAS FICAM, E A RAZÃO É DE PREÇO, NÃO DE ZELO: tirar um export de um pacote publicado é uma major, e
// gastar uma major em dois símbolos mortos, dias depois da 7.0.0/7.0.1, é pagar caro por arrumação. Saem no
// mesmo corte que as outras seis, que é quando a major se paga. Está escrito aqui para que a próxima pessoa
// não repita a medição para chegar à mesma conclusão.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as CONSTANTES from '../app/js/core/constants.js';

const RAIZ = process.cwd();
const CONST_REL = 'app/js/core/constants.ts';

/** Todos os ficheiros `.ts` da engine, com barra normal — o glob do Windows não perdoa a invertida. */
function ficheirosTs(dir, out = []) {
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) ficheirosTs(p, out);
    else if (nome.endsWith('.ts')) out.push(p.replace(/\\/g, '/'));
  }
  return out;
}

const MODULOS = ficheirosTs(join(RAIZ, 'app', 'js'))
  .map((f) => f.slice(RAIZ.replace(/\\/g, '/').length + 1))
  .filter((f) => f !== CONST_REL);

/**
 * Quantos módulos da engine importam cada nome.
 *
 * ⚠️ O PADRÃO ACEITA `./constants.js` E `../core/constants.js`, e a diferença já custou uma medição errada:
 * a primeira versão exigia `core/constants.js` e por isso não via o `core/collision.ts`, que é vizinho e
 * importa por `./constants.js`. O resultado foi `TILE_TYPES` e `ehPerigo` a aparecerem como sem dono — quer
 * dizer, um crivo estreito a INVENTAR dívida. O caso `[Zero]` abaixo existe por causa disto.
 */
function importadoresPorNome() {
  const conta = new Map(Object.keys(CONSTANTES).map((n) => [n, 0]));
  for (const rel of MODULOS) {
    const txt = readFileSync(join(RAIZ, rel), 'utf8');
    for (const m of txt.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"][^'"]*constants\.js['"]/g)) {
      for (const bruto of m[1].split(',')) {
        const n = bruto.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (conta.has(n)) conta.set(n, conta.get(n) + 1);
      }
    }
  }
  return conta;
}

/**
 * O LIVRO: o que a engine exporta e não usa, e quem o consome do outro lado da fronteira.
 *
 * Cada linha é uma linha da etapa B da #63. Uma entrada sai daqui quando o símbolo MUDA DE CASA (vai para o
 * cartucho) ou quando um módulo de engine passa a precisar dele — nunca por se levantar o tecto.
 */
const SO_DO_CARTUCHO = {
  // ⚠️ `COIN_TARGET` e `TUNE` SAÍRAM em 2026-09-07 — mudaram de casa para o `game/tuning.ts` do
  // `game-platformer`, com o jogo editado PRIMEIRO para que nada quebrasse no intervalo. O livro encolheu de
  // seis para quatro, e o tecto com ele.
  ehAgua: 'game-platformer: level-geometry, tile-roles',
  ehEscada: 'game-platformer: elevators, level-geometry, tile-roles',
  ehPortao: 'game-platformer: tile-roles',
  ehSecreto: 'game-platformer: level-geometry',
  // ⚠️ `JUMP_BASE` e `ehChave` SAÍRAM do livro em 2026-09-07, e saíram do catálogo junto. Eram as duas
  // linhas que diziam «NINGUÉM — morta», e a etapa B da issue #63 levou-as: zero consumidores em lado
  // nenhum, e a major que a etapa inteira exige paga as duas de borla. O caso `[Interface]` abaixo é o que
  // as obrigou a sair daqui no mesmo passo — uma entrada que já não descreve a árvore é folga escondida.
};

/**
 * Tecto que só desce (ADR-0043). Eram OITO; são seis desde que as duas mortas saíram na etapa B.
 *
 * ⚠️ Este número não é um alvo nem uma tolerância: é o máximo que a superfície só-do-cartucho pode voltar a
 * ser. Ele desce quando um símbolo muda de casa, e a asserção de igualdade lá em baixo é o que impede que
 * fique acima do medido — folga por cima é onde a próxima dívida cabe sem que nada reprove.
 */
const TETO = 4;

describe('core/constants: o que a engine exporta e só o cartucho usa (#63 etapa B)', () => {
  const conta = importadoresPorNome();
  const semDono = [...conta.entries()].filter(([, n]) => n === 0).map(([nome]) => nome).sort();

  it('[Zero] o crivo de imports está mesmo a ver imports — senão TUDO pareceria sem dono', () => {
    // ⚠️ O modo de falhar deste ficheiro é o crivo casar zero e o livro parecer completo. Estes três pares
    // são conhecidos e de FORMAS DIFERENTES de import: `../core/constants.js` (render) e `./constants.js`
    // (o vizinho `core/collision.ts`), que foi exactamente o que a primeira versão do padrão não via.
    expect(conta.get('LOGICAL_W'), 'ninguém importa LOGICAL_W? o crivo partiu-se').toBeGreaterThanOrEqual(5);
    expect(conta.get('TILE_TYPES'), 'o import de vizinho (./constants.js) deixou de ser visto').toBeGreaterThanOrEqual(1);
    expect(conta.get('ehPerigo'), 'o import de vizinho deixou de ser visto').toBeGreaterThanOrEqual(1);
    // ⚠️ ESTE PISO DESCE COM O CORTE, e é a única linha deste ficheiro que se mexe nos dois sentidos — ele
    // não mede dívida, mede que o `import` resolveu. Era 15 e passou a 10 quando a etapa B levou quatro
    // exports (2026-09-07). O que o torna honesto é não ser a única guarda: as três asserções acima pinam
    // nomes CONCRETOS, então um módulo vazio ou um import partido reprova por elas primeiro, e o número
    // sozinho nunca é o que prova nada.
    expect(Object.keys(CONSTANTES).length, 'o módulo deixou de exportar valores').toBeGreaterThanOrEqual(10);
  });

  it('⚠️ [Right] o livro está completo — nenhum export NOVO fica sem dono em silêncio', () => {
    // Um export novo que a engine não use é uma peça de cartucho a nascer dentro da engine. Ele tem de ser
    // escrito no livro, com o nome de quem o consome, e não simplesmente aparecer.
    const naoListados = semDono.filter((n) => !(n in SO_DO_CARTUCHO));
    expect(naoListados, 'export sem importador na engine e fora do livro: ' + naoListados.join(', ')).toEqual([]);
  });

  it('[Interface] e o livro não tem entradas mortas — quem ganhou dono na engine sai dele', () => {
    // A outra metade, e sem ela o livro engordaria para sempre: uma linha que já não descreve a árvore é uma
    // dívida fantasma, e uma dívida fantasma faz o tecto parecer apertado quando não está.
    const fantasmas = Object.keys(SO_DO_CARTUCHO).filter((n) => !semDono.includes(n));
    expect(fantasmas, 'no livro mas já com dono na engine (ou já apagado): ' + fantasmas.join(', ')).toEqual([]);
  });

  it('⚠️ [Boundary] o tecto SÓ DESCE — oito é o máximo, nunca o alvo', () => {
    expect(semDono.length, `a superfície só-do-cartucho cresceu para ${semDono.length}: ` + semDono.join(', '))
      .toBeLessThanOrEqual(TETO);
    // E o tecto acompanha a realidade: deixá-lo acima do medido esconderia uma folga onde cabe uma dívida
    // nova sem que nada reprove. Se estas oito saírem, esta linha é a que obriga a baixar o número.
    expect(TETO, 'o tecto ficou acima do medido — há folga escondida').toBe(semDono.length);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · pondo `export const NOVA_COISA = 1;` em `core/constants.ts` (sem importador) → "[Right] o livro está
//     completo" reprova nomeando `NOVA_COISA`, e "[Boundary] o tecto" reprova nas duas asserções (9 > 8).
//   · tirando `ehChave` do livro `SO_DO_CARTUCHO` → "[Right]" reprova. É o caso que impede alguém de
//     esvaziar o livro em vez de esvaziar a dívida.
//   · pondo `LOGICAL_W` no livro (uma entrada fantasma, que tem dono) → "[Interface]" reprova nomeando-o.
//   · estreitando o padrão do crivo para `core\/constants\.js` — a primeira versão, e o defeito real que eu
//     cometi ao medir → reprovam TRÊS casos: "[Zero]" no `TILE_TYPES`, "[Right]" a acusar `TILE_TYPES`,
//     `ehPerigo` e `ehTrampolim` de estarem fora do livro, e "[Boundary]" com 11 > 8.
//     ⚠️ Sem o `[Zero]`, esta mutação teria INVENTADO três dívidas e o livro teria crescido para as
//     acomodar — um gate a fabricar o problema que existe para medir. Os três nomes são os do
//     `core/collision.ts`, que importa por `./constants.js` por ser vizinho.
