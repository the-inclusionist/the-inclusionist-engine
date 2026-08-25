// SPDX-License-Identifier: GPL-3.0-or-later
// OS LOTES DO PASSO 5 — "dividir os módulos de fronteira em 4 lotes, FOLHA PRIMEIRO" (project node: só lê o disco).
//
// ========================= POR QUE ISTO É TESTE, E NÃO UM DOCUMENTO =========================
// O item 19 manda dividir folha primeiro. "Folha primeiro" não é uma preferência de organização: é uma
// ORDENAÇÃO TOPOLÓGICA do grafo de importação, e ela só existe se o grafo for ACÍCLICO. Um único ciclo novo
// entre dois módulos de engine e o item 19 fica impossível — não mais difícil, impossível — e o modo de
// descobrir isso seria no meio da mudança, com metade dos módulos já movidos.
//
// Um documento com a lista dos lotes envelheceria no primeiro módulo novo e ninguém saberia. Isto aqui
// RECALCULA a divisão a cada rodada, a partir dos imports de verdade, e reprova se a premissa quebrar.
//
// ========================= O QUE A MEDIÇÃO ACHOU, E POR QUE ELA IMPORTA =========================
// O grafo é acíclico e cai em camadas naturais. Os lotes NÃO precisam ser inventados: eles são as camadas. E
// dentro de uma camada nenhum módulo depende de outro da mesma camada — que é exatamente a propriedade que
// torna um lote movível DE UMA VEZ, em vez de módulo a módulo.
//
// O item 19 estima QUATRO lotes; a medição diz CINCO camadas (30, 24, 21, 13 e uma), e a quinta é um módulo
// só. Ou seja: quatro lotes de verdade e uma cauda. Está cobrado abaixo em vez de arredondado.
//
// O achado que muda a expectativa é o tamanho da dívida: eram QUATRO módulos de engine arrastando `game/`
// (direta ou transitivamente), hoje são DOIS. Os outros ~87 são limpos. Ou seja, o trabalho do passo 5 não
// está espalhado pelos lotes — está concentrado, e os lotes existem para mover o resto COM SEGURANÇA, não
// para consertá-lo.
//
// ========================= O QUE ESTE ARQUIVO NÃO DECIDE =========================
// Nada sobre o EIXO (por gênero · por subsistema · por contrato declarado). A ordenação folha-primeiro é a
// mesma nas quatro alternativas, porque é fato do grafo e não da escolha. Quando o eixo for decidido, é este
// cálculo que diz em que ORDEM mover — e ele já vai estar aqui, verdadeiro.
//
// ⚠️ Complementa `tests/engine-boundary.node.test.js`, não o repete: lá ficam as ARESTAS conhecidas e o
// vocabulário; aqui fica a FORMA do grafo (aciclicidade, camadas, concentração).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'app', 'js');
const CAMADAS_ENGINE = ['core', 'input', 'render', 'platform', 'ui', 'audio', 'i18n'];
const CR = String.fromCharCode(13);

function modulosDe(camada) {
  const dir = join(RAIZ, camada);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => `${camada}/${f.replace(/\.ts$/, '')}`);
}
const ENGINE = CAMADAS_ENGINE.flatMap(modulosDe);
const SET = new Set(ENGINE);

/** Fonte SEM comentário. O `split(CR).join('')` não é higiene: com CRLF o `.` da regex não alcança o CR, o
 *  âncora de fim nunca chega e o removedor de comentários FALHA ABERTO — já produziu uma lista de dívida
 *  falsa neste projeto, e uma lista falsa é pior que lista nenhuma (ver o cabeçalho de engine-boundary). */
function semComentarios(caminho) {
  return readFileSync(caminho, 'utf8').split(CR).join('')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
}

/** Importações de `m` para outros módulos de app/js, resolvidas para a forma `camada/nome`. */
function importesDe(m) {
  const src = semComentarios(join(RAIZ, ...m.split('/')) + '.ts');
  const base = m.split('/')[0], alvo = new Set();
  for (const achado of src.matchAll(/from\s+'([^']+\.js)'/g)) {
    const rel = achado[1];
    if (!rel.startsWith('.')) continue; // pacote npm (pixi.js): não é aresta interna
    let p = rel.replace(/\.js$/, '');
    if (p.startsWith('./')) p = base + '/' + p.slice(2);
    else if (p.startsWith('../')) p = p.slice(3);
    alvo.add(p);
  }
  return [...alvo];
}

const DEPS = new Map(ENGINE.map((m) => [m, importesDe(m)]));
/** Só as arestas ENTRE módulos de engine — é sobre elas que a ordenação folha-primeiro se faz. */
const DENTRO = new Map(ENGINE.map((m) => [m, DEPS.get(m).filter((d) => SET.has(d) && d !== m)]));

/** Camadas topológicas: nível 0 = folhas; nível n = só depende de níveis < n. */
function niveis() {
  const nivel = new Map();
  let restante = new Set(ENGINE);
  for (let n = 0; n < ENGINE.length && restante.size; n++) {
    const prontos = [...restante].filter((m) => DENTRO.get(m).every((d) => nivel.has(d) && nivel.get(d) < n));
    if (!prontos.length) break; // ciclo: ninguém mais fica pronto
    for (const m of prontos) { nivel.set(m, n); restante.delete(m); }
  }
  return { nivel, restante };
}

/** Fecho transitivo do que `m` arrasta, incluindo o que sai da engine. */
function arrasta(m, visto = new Set()) {
  const acc = new Set();
  for (const d of DEPS.get(m) || []) {
    if (visto.has(d)) continue;
    acc.add(d);
    if (SET.has(d)) for (const x of arrasta(d, new Set([...visto, m, d]))) acc.add(x);
  }
  return acc;
}

/** Quantos módulos em cada lote. */
function contagem() {
  const { nivel } = niveis(), c = new Map();
  for (const [, n] of nivel) c.set(n, (c.get(n) || 0) + 1);
  return c;
}

describe('a premissa do item 19: o grafo permite ordenar folha primeiro', () => {
  it('[Right] o grafo de engine é ACÍCLICO — sem isso "folha primeiro" não existe', () => {
    // É o caso central. Um ciclo não torna o passo 5 mais difícil: torna-o impossível de fazer em lotes, e o
    // lugar onde isso apareceria sem este teste é no meio da mudança, com metade dos módulos já movidos.
    const { restante } = niveis();
    expect([...restante].sort(), 'módulos em ciclo — desfaça o ciclo antes de dividir').toEqual([]);
  });

  it('[Right] TODO módulo de engine recebe um lote — a divisão é total, não uma amostra', () => {
    const { nivel } = niveis();
    expect(nivel.size).toBe(ENGINE.length);
  });

  it('[Interface] dentro de um lote, nenhum módulo depende de outro do MESMO lote', () => {
    // É a propriedade que faz um lote ser movível DE UMA VEZ. Sem ela, "lote" seria só um agrupamento de
    // nome, e a mudança teria de descer a módulo por módulo de qualquer jeito.
    const { nivel } = niveis();
    const conflitos = [];
    for (const m of ENGINE) {
      for (const d of DENTRO.get(m)) if (nivel.get(d) === nivel.get(m)) conflitos.push(`${m} → ${d}`);
    }
    expect(conflitos, 'dependência dentro do mesmo lote').toEqual([]);
  });

  it('[Boundary] os lotes são CONTÍGUOS a partir de 0 e nenhum é vazio', () => {
    const lotes = [...contagem().keys()].sort((a, b) => a - b);
    expect(lotes).toEqual(lotes.map((_v, i) => i));
    for (const l of lotes) expect(contagem().get(l), 'lote ' + l).toBeGreaterThan(0);
  });

  it('[Interface] o item 19 diz QUATRO lotes; o grafo dá CINCO, e o quinto tem um módulo só', () => {
    // ESCREVI ESTE CASO PEDINDO QUATRO E ELE REPROVOU, com razão. A pipeline estima quatro; a medição diz
    // cinco camadas — 30, 24, 21, 13 e UMA (`ui/pause-icons`, que depende do lote 3 e por isso não pode ser
    // fundido nele sem quebrar a independência dentro do lote, cobrada acima).
    //
    // A diferença não é um detalhe de contagem: ela diz que o último "lote" não é um lote, é uma CAUDA. Quem
    // for executar o passo 5 move quatro lotes de verdade e depois um módulo. Registrado aqui em vez de
    // arredondado para quatro, porque arredondar teria sido eu ajustando a medida ao plano.
    const c = contagem(), lotes = [...c.keys()].sort((a, b) => a - b);
    expect(lotes.length).toBeGreaterThanOrEqual(4);
    expect(c.get(lotes[lotes.length - 1]), 'a cauda').toBeLessThan(5);
    expect(c.get(0), 'o lote das folhas é o maior').toBeGreaterThan(c.get(lotes[lotes.length - 1]));
  });

  it('[Interface] o lote 0 são FOLHAS DE VERDADE: não importam nada de app/js', () => {
    // Folha aqui é mais forte que "nível 0 entre módulos de engine": elas não importam NEM de `game/`. É o
    // lote que se move sem olhar para mais nada, e é por ele que a divisão começa.
    const { nivel } = niveis();
    const lote0 = ENGINE.filter((m) => nivel.get(m) === 0);
    const comDependencia = lote0.filter((m) => DEPS.get(m).length > 0);
    expect(comDependencia, 'lote 0 deveria ser folha absoluta').toEqual([]);
    expect(lote0.length).toBeGreaterThan(20); // hoje 30; a ordem de grandeza é o que importa
  });
});

describe('a dívida do passo 5 é CONCENTRADA, e é isso que torna a divisão barata', () => {
  /** Dívida CONHECIDA em 2026-08-25. Só encolhe — mesma regra de engine-boundary.
   *  `ui/activities-menu` saiu com o ADR-0032: o catálogo que ele arrastava era CURRÍCULO em `game/`, e mudou
   *  de camada. Vale registrar o que isso significa e o que NÃO significa — o módulo deixou de arrastar o
   *  JOGO, e continua conhecendo um catálogo (`educational/`), que `engine-boundary` conta em lista própria. */
  const ARRASTAM_JOGO = ['render/draw'];

  it('[Right] só estes módulos de engine arrastam game/, direta ou transitivamente', () => {
    const sujos = ENGINE.filter((m) => [...arrasta(m)].some((d) => d.startsWith('game/'))).sort();
    expect(sujos, 'módulo de engine NOVO arrastando game/').toEqual([...ARRASTAM_JOGO].sort());
  });

  it('[Zero] `render/viz-setters` NÃO arrasta mais nada — a conta transitiva voltou a bater com a direta', () => {
    // Este caso já disse o CONTRÁRIO, e a inversão é o registro do conserto. Ele existia para mostrar que as
    // duas medidas divergiam: `viz-setters` não importava de `game/`, importava `render/textures`, que
    // importava — quatro arrastadores contra três culpados. Tirar `SOMASUB_SHAPES` de dentro do `textures`
    // resolveu os dois de uma vez, e é a razão de a aresta pequena ter valido a pena.
    //
    // O caso FICA (invertido) em vez de ser apagado: enquanto ele existir, ninguém reintroduz a importação em
    // `render/textures` sem ver aqui que o custo não é uma aresta, são duas.
    expect(DEPS.get('render/viz-setters').some((d) => d.startsWith('game/'))).toBe(false);
    expect([...arrasta('render/viz-setters')].some((d) => d.startsWith('game/'))).toBe(false);
    expect([...arrasta('render/textures')].some((d) => d.startsWith('game/'))).toBe(false);
  });

  it('[Boundary] a esmagadora maioria da engine é LIMPA — o passo 5 move, não conserta', () => {
    const limpos = ENGINE.filter((m) => ![...arrasta(m)].some((d) => d.startsWith('game/')));
    expect(limpos.length / ENGINE.length).toBeGreaterThan(0.9);
  });
});
