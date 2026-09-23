// SPDX-License-Identifier: AGPL-3.0-or-later
// PUBLICADO SEM GATE — o inventário dos módulos que a engine entrega e que nada aqui exercita.
//
// ========================= A MEDIÇÃO QUE PEDIU ESTE FICHEIRO, E A QUE A DESFEZ =========================
// A primeira varredura comparou o TEXTO dos testes com os nomes dos módulos e acusou cinco. Era falsa: `anel`
// casa dentro de `painel`, `speech` dentro de `interruptible-speech`. Refeita pelo GRAFO DE IMPORTAÇÃO — por
// especificador, um a um —, a lista mudou de forma inteira. Fica escrito porque é a diferença entre um crivo
// e um alarme que alguém desliga.
//
// 📏 MEDIDO EM 2026-09-08: 127 módulos. QUARENTA não têm importador interno nenhum, e isso **não é defeito** —
// é a arquitectura: a raiz de composição é o cartucho, então uma folha que o jogo fia por sua conta não tem
// chamador aqui dentro. Trinta e sete dos quarenta têm teste. É a INTERSECÇÃO que interessa.
//
// ⚠️ E A INTERSECÇÃO NÃO PODE PRODUZIR ACUSAÇÃO FALSA, o que é a razão de o crivo ser esta e não «módulo sem
// teste». Um módulo sem importador interno é inalcançável por caminho transitivo: se nada em `app/js` o
// importa, nenhum teste chega a ele senão importando-o directamente. Logo «sem importador **e** sem teste»
// é literalmente «ninguém aqui o exercita», e não «o meu detector não viu».
//
// 📌 O `package.json` exporta `./core/*.js`, `./input/*.js`, `./render/*.js`, `./platform/*.js`, `./ui/*.js`,
// `./educational/*.js` e `./i18n/*.js` — CURINGAS. Um módulo destes está publicado no instante em que existe.
// Estar nesta lista é, então, «a engine entrega isto a 300 jogos e não tem como saber se partiu».
//
// ⚠️ A LISTA TEM DE ENCOLHER, e já encolheu uma vez: `platform/speech` saiu daqui em `873618b`, com catorze
// casos e sete mutações. Uma lista que só cresce é um monumento.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_JS = fileURLToPath(new URL('../app/js/', import.meta.url));
const RAIZ_TESTES = fileURLToPath(new URL('./', import.meta.url));

/**
 * OS MÓDULOS PUBLICADOS QUE NADA AQUI EXERCITA, e por que cada um ainda está assim.
 *
 * ⚠️ Uma entrada NOVA sem razão escrita à mão é a engine a publicar superfície sem alarme, sem ninguém
 * decidir — que foi exactamente como estes chegaram.
 */
/*
 * 🔴 A LISTA ESTÁ VAZIA, E ISSO É UM PAGAMENTO E NÃO UM AFROUXAMENTO. A única entrada era o
 * `render/recycling-tex`, dispensado porque o único teste dele vivia no repositório do CARTUCHO — o padrão do
 * canário, com a nota de que mover o teste era decisão do cartucho e não daqui.
 *
 * 🎯 O ADR-0228 respondeu essa decisão por inteiro: o módulo É do cartucho, e foi para lá com o teste. A dispensa
 * desapareceu porque o sujeito dela desapareceu, que é a única forma honesta de uma excepção sair de uma lista.
 */
const SEM_GATE = {};

// ===== A varredura =====

/** Todo `.ts` sob `app/js`, menos as declarações ambiente (`*.d.ts`), que não são módulos. */
function modulos(dir = RAIZ_JS, prefixo = '') {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) { saida.push(...modulos(caminho, `${prefixo}${nome}/`)); continue; }
    if (!nome.endsWith('.ts') || nome.endsWith('.d.ts')) continue;
    saida.push(`${prefixo}${nome.slice(0, -3)}`);
  }
  return saida;
}

/** Todo ficheiro de teste, incluindo auxiliares que não terminam em `.test.js`. */
function ficheirosDeTeste(dir = RAIZ_TESTES) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) { saida.push(...ficheirosDeTeste(caminho)); continue; }
    if (/\.(js|ts|mjs)$/.test(nome)) saida.push(caminho);
  }
  return saida;
}

const ESPECIFICADOR = /from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]/g;
const especificadores = (src) => [...src.matchAll(ESPECIFICADOR)].map((m) => m[1] || m[2]);

const TODOS = modulos();

/** Chave de módulo (`ui/shell`) a partir de um especificador relativo visto dentro de `app/js/<de>`. */
function resolveInterno(de, spec) {
  if (!spec.startsWith('.')) return null;
  const base = posix.dirname(de);
  return posix.normalize(posix.join(base, spec)).replace(/\.js$/, '');
}

function medir() {
  const comImportador = new Set();
  for (const m of TODOS) {
    const src = readFileSync(join(RAIZ_JS, `${m}.ts`), 'utf8');
    for (const spec of especificadores(src)) {
      const alvo = resolveInterno(m, spec);
      if (alvo) comImportador.add(alvo);
    }
  }
  const comTeste = new Set();
  for (const f of ficheirosDeTeste()) {
    const src = readFileSync(f, 'utf8');
    for (const spec of especificadores(src)) {
      const i = spec.indexOf('app/js/');
      if (i === -1) continue;
      comTeste.add(spec.slice(i + 'app/js/'.length).replace(/\.js$/, ''));
    }
  }
  return TODOS.filter((m) => !comImportador.has(m) && !comTeste.has(m));
}

describe('publicado sem gate · o inventário encolhe, e uma entrada nova tem de ser declarada', () => {
  const achados = medir();

  // ⚠️ ESTE CASO APANHOU-ME A TRAZER UM FACTO DE OUTRO REPOSITÓRIO: escrevi `expect(TODOS).toContain('main')`
  // porque num CARTUCHO a raiz é `app/js/main.ts` e um glob `**` já a escondeu. Aqui a raiz de `app/js` tem
  // **só** o `env.d.ts` — a engine não tem módulo de raiz nenhum. O caso passou a afirmar o que é verdade
  // desta árvore, incluindo a exclusão das declarações ambiente, que é regra e não sorte.
  it('[Vácuo] a varredura desce a árvore, e a declaração ambiente fica de fora', () => {
    expect(TODOS.length).toBeGreaterThan(100);
    expect(TODOS).toContain('boot/create-game');
    expect(TODOS).toContain('platform/speech');
    expect(TODOS).not.toContain('env.d');
  });

  it('[Feliz] nenhum módulo publicado ficou sem gate e sem razão escrita', () => {
    const novos = achados.filter((m) => !(m in SEM_GATE));
    expect(novos, `módulo publicado que ninguém aqui exercita e ninguém declarou: ${novos.join(', ')}`).toEqual([]);
  });

  // ⚠️ A SAÍDA. Sem esta metade a lista vira monumento: uma entrada consertada continuaria a dizer que existe
  // um buraco, e a próxima pessoa leria a lista inteira como história em vez de estado.
  it('[Fronteira] nenhuma entrada da lista já foi resolvida — se foi, sai daqui', () => {
    const resolvidas = Object.keys(SEM_GATE).filter((m) => !achados.includes(m));
    expect(resolvidas, `já tem gate (ou deixou de existir); apague a entrada: ${resolvidas.join(', ')}`).toEqual([]);
  });

  // 🎯 O caso que prova que o crivo mede o que diz medir, e não «módulo cujo nome não aparece num teste».
  it('[Fronteira] um módulo muito importado e nunca nomeado num teste NÃO é acusado', () => {
    // `core/entity` tem 19 importadores internos e nenhum teste o importa directamente: é exercitado por
    // caminho transitivo, e acusá-lo seria a falsa acusação que desliga um gate.
    expect(achados).not.toContain('core/entity');
    expect(achados).not.toContain('core/dom-query');
  });

  it('[Fronteira] `platform/speech` saiu da lista e não pode voltar em silêncio', () => {
    expect(achados).not.toContain('platform/speech');
    expect(SEM_GATE).not.toHaveProperty('platform/speech');
  });
});

// ===== MUTAÇÕES CONFERIDAS (2026-09-08) =====
// Cada uma aplicada POR SCRIPT ao ficheiro, com a contagem de ocorrências afirmada em exactamente 1 — um
// `replace` com `\n` casa zero em CRLF e a mutação «sobrevive» sem ter sido aplicada. E o que está aqui é o
// que foi MEDIDO, não o que eu previa: quatro das seis reprovaram casos diferentes dos que eu tinha escrito.
//
// 1. renomear a chave `render/recycling-tex` em `SEM_GATE`  → reprova [Feliz] **e** [Fronteira] da saída. A
//    segunda porque a chave renomeada deixa de aparecer nos achados — as duas metades a funcionar juntas.
// 2. acrescentar `platform/speech` a `SEM_GATE`             → reprova [Fronteira] da saída e o caso do speech
// 3. tirar a cláusula «sem importador interno»              → reprova [Feliz] e o caso da FALSA ACUSAÇÃO, que
//    é a prova de que a intersecção é o crivo e não uma conveniência
// 4. tirar a cláusula «sem teste»                           → reprova [Feliz] e o caso do speech
// 5. `medir()` a devolver `[]`                              → reprova **só** [Fronteira] da saída
//    🎯 É A MUTAÇÃO QUE MAIS IMPORTA: com o crivo cego, o [Feliz] fica verde para sempre — um crivo cego
//    aprova tudo. Quem o apanha é a metade da SAÍDA, e é por isso que ela não é arrumação.
// 6. contar só `*.test.js` como teste                       → SOBREVIVE. Equivalência MEDIDA: hoje não há
//    auxiliar em `tests/` que importe `app/js`. Fica registada em vez de apagada — a generosidade do detector
//    é o que impede a acusação falsa no dia em que um auxiliar aparecer.
