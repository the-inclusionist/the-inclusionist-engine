// SPDX-License-Identifier: AGPL-3.0-or-later
// O MAPA DIZ A VERDADE — os dois crivos do `docs/ARCHITECTURE.md`, e só esses dois.
//
// ========================= POR QUE SÃO DOIS, E NÃO UM GERADOR =========================
// O `CLAUDE.md` manda ler este documento em QUALQUER prompt, e 📏 medido em 2026-09-22 ele nomeava 81 dos 181 módulos, citava
// um `webcam` apagado seis dias antes e uma pasta `game/` que não existe. A cura óbvia — gerar a tabela da árvore e exigir que
// ela case — foi pesada e recusada: 📏 205 módulos nasceram ou morreram em 30 dias, em 156 de 1056 commits, logo um em cada
// sete commits acordaria o crivo para pedir uma regeneração. Pior do que o custo: um crivo que se satisfaz correndo um script
// ensina a regenerar sem ler, e o que ele garante é EXACTIDÃO, não utilidade.
//
// 🎯 ENTÃO O QUE SE CONFERE SÃO AS AFIRMAÇÕES QUE O MAPA FAZ, e ele deixou de afirmar ser um inventário:
//
//   1. todo caminho que o documento nomeia EXISTE — apanha exactamente o `webcam`, o `cenario-data` e o `settings-motor` que
//      lá estavam mortos, e apanha-o no dia em que o ficheiro se move;
//   2. toda pasta de `app/js` tem linha na tabela de camadas — apanha o `boot/`, o `i18n/` e o `consumer-quiz/`, que não
//      tinham nenhuma, e a `game/`, que tinha linha e não tinha pasta.
//
// 📏 As duas são ESTÁVEIS: não acordam quando nasce um módulo (que é o custo que se recusou), acordam quando nasce uma CAMADA
// — três vezes em toda a vida do projeto — ou quando alguém apaga um ficheiro que o mapa cita, que é quando se quer acordar.
//
// MUTAÇÕES CONFERIDAS no fim do ficheiro.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd().endsWith('app') ? join(process.cwd(), '..') : process.cwd();
const MAPA = 'docs/ARCHITECTURE.md';
const texto = readFileSync(join(RAIZ, MAPA), 'utf8');

/*
 * Um caminho que o mapa NOMEIA: dentro de crases, com pasta e extensão. As crases são o critério porque é assim que esta casa
 * escreve um identificador ou um ficheiro num documento — e sem elas o crivo leria prosa («o `game/` que não existe») como
 * promessa. ⚠️ Uma pasta (`core/`) não é caminho: ela é conferida pelo segundo caso, que sabe a diferença.
 */
const CAMINHOS = /`([A-Za-z0-9_@./-]+\/[A-Za-z0-9_.@-]+\.[a-z0-9]{1,5})`/g;

/**
 * Os caminhos que um texto NOMEIA.
 *
 * ⚠️ É função e não uma expressão solta dentro do caso, e a razão foi medida: com a regra das crases enterrada no caso, a
 * mutação que a tirava ficava VERDE — o documento de hoje por acaso não tem, na prosa, um caminho inexistente sem crases. Uma
 * regra que nenhum caso consegue avermelhar é uma regra que ninguém defende no dia em que alguém a apaga.
 */
export const caminhosCitados = (t) => [...new Set([...t.matchAll(CAMINHOS)].map((m) => m[1]))];

describe('o mapa não nomeia o que não existe', () => {
  it('🔴 [Right] todo ficheiro que o `ARCHITECTURE.md` cita está na árvore', () => {
    const citados = caminhosCitados(texto);
    expect(citados.length, 'o mapa não cita caminho nenhum — o crivo não está a medir nada').toBeGreaterThan(15);
    /*
     * ⚠️ O QUE FICA DE FORA, e cada linha tem uma razão que não é conveniência:
     *   · `node_modules/**` e endereços de pacote (`@the-inclusionist/engine/…`) não são ficheiros desta árvore;
     *   · um caminho do repositório dos REGISTOS (`docs/2-Architecture/adr/…`) vive do outro lado — o mapa pode nomeá-lo;
     *   · `app/js/game/**` NÃO está aqui de propósito: essa pasta saiu com o cartucho, e é precisamente o que o crivo apanhou.
     */
    const foraDaArvore = (c) => c.startsWith('@') || c.startsWith('node_modules/') || c.includes('://');
    /*
     * ⚠️ O MAPA ESCREVE UM CAMINHO RELATIVO À SECÇÃO EM QUE ESTÁ, e isso é convenção do documento e não desleixo: a secção do
     * código diz `ui/pause-icons.ts` e a das docs diz `1-Discovery/NFR.md`, porque repetir `app/js/` e `docs/` em cada célula
     * de uma tabela custa ao leitor e não lhe dá nada. O crivo aprende a convenção em vez de a proibir — o que ele guarda é
     * que o ficheiro EXISTA, não onde a frase o ancora.
     */
    const RAIZES = ['', 'app/js/', 'docs/', 'app/'];
    const mortos = citados.filter((c) => !foraDaArvore(c) && !RAIZES.some((r) => existsSync(join(RAIZ, r + c))));
    expect(mortos, `o mapa nomeia ficheiros que já não existem — quem o lê vai procurá-los. Em ${MAPA}`).toEqual([]);
  });
});

describe('o mapa não esconde uma camada', () => {
  it('🔴 [Right] toda pasta de `app/js` tem linha na tabela de camadas', () => {
    const pastas = readdirSync(join(RAIZ, 'app/js'), { withFileTypes: true })
      .filter((d) => d.isDirectory()).map((d) => d.name);
    expect(pastas.length, 'não há pastas em app/js — o crivo não está a medir nada').toBeGreaterThan(5);
    // A linha de uma camada abre com o nome da pasta entre crases, com a barra: `| `core/` | … |`
    const semLinha = pastas.filter((p) => !texto.includes(`| \`${p}/\` |`));
    expect(semLinha, 'uma camada existe na árvore e não existe no mapa — quem lê o mapa não sabe que ela existe').toEqual([]);
  });

  it('🔴 [Zero] e nenhuma linha de camada fala de uma pasta que não existe', () => {
    /*
     * ⚠️ SÓ A TABELA DAS CAMADAS, e a primeira corrida mostrou porquê: a secção 2 tem uma tabela com a MESMA forma de linha
     * para as pastas das DOCS (`game-design/`, `research/`), que não são camadas de código e não existem em `app/js`. Um
     * crivo que lesse o documento inteiro acusaria duas linhas correctas e ensinaria a desligá-lo.
     */
    const seccao = texto.slice(texto.indexOf('### 3.1'), texto.indexOf('### 3.2'));
    expect(seccao.length, 'a secção 3.1 não foi encontrada').toBeGreaterThan(200);
    const naTabela = [...seccao.matchAll(/^\| `([a-z-]+)\/` \|/gm)].map((m) => m[1]);
    expect(naTabela.length, 'a tabela de camadas não foi encontrada').toBeGreaterThan(5);
    const fantasmas = naTabela.filter((p) => !existsSync(join(RAIZ, 'app/js', p)));
    expect(fantasmas, 'o mapa tem linha para uma pasta que saiu — foi assim que a `game/` sobreviveu meses').toEqual([]);
  });
});

describe('a regra das crases, e o piso, medidos onde o documento de hoje não os exerce', () => {
  /*
   * 🔴 ESTES DOIS CASOS NASCERAM DE MUTAÇÕES SOBREVIVENTES, e são a diferença entre uma regra escrita e uma regra defendida.
   * Contra o documento REAL, tirar as crases da expressão e tirar o piso da contagem ficavam os dois VERDES — não porque as
   * regras sejam inertes, mas porque o texto de hoje não tem o caso que as exerce. Um texto sintético tem.
   */
  it('🔴 [Zero] um caminho na PROSA, sem crases, não é promessa do mapa', () => {
    const prosa = 'a pasta app/js/game/physics.ts saiu com o cartucho, e o `app/js/core/state.ts` ficou';
    expect(caminhosCitados(prosa), 'o crivo leu prosa como promessa — passa a acusar frases sobre o passado')
      .toEqual(['app/js/core/state.ts']);
  });

  it('⚠️ [Zero] um mapa que não cita nada reprova, em vez de passar por não ter o que medir', () => {
    // Sem o piso, um documento VAZIO satisfaz «nenhum caminho morto» — o vazio é o falso verde clássico deste repositório.
    expect(caminhosCitados('um mapa sem um único caminho'), 'texto sem caminhos deu caminhos').toEqual([]);
    expect(caminhosCitados(texto).length, 'o piso é o que impede o vazio de passar').toBeGreaterThan(15);
  });
});

/*
 * ========================= MUTAÇÕES CONFERIDAS (2026-09-22) =========================
 * 1. pôr `app/js/ui/webcam.ts` numa linha do mapa (o ficheiro que a F10 apagou em 16/09) ......... VERMELHO no 1.º caso
 *    — é o próprio defeito histórico, reproduzido.
 * 2. tirar a linha `| \`boot/\` |` da tabela de camadas .......................................... VERMELHO no 2.º
 * 3. devolver a linha `| \`game/\` |` ao mapa (a pasta saiu com o cartucho) ....................... VERMELHO no 3.º
 * 4. tirar as crases da expressão dos caminhos ................................................... VERMELHO no 4.º
 * 5. tirar o piso da contagem do 1.º caso ........................................................ EQUIVALENTE, e medido
 *    — o piso está afirmado DUAS vezes (no 1.º e no 5.º caso), logo tirá-lo de um sítio não desprotege nada. Fica escrito em
 *      vez de ser «consertado»: a regra está defendida, e é a duplicação da asserção que a torna equivalente.
 *
 * 🔴 E DUAS DELAS SÓ FICARAM VERMELHAS DEPOIS DE OS CASOS 4 E 5 EXISTIREM. Contra o documento REAL, a 4 e a 5 passavam — não
 * porque as regras fossem inertes, mas porque o texto de hoje não as exerce: não há, na prosa, um caminho inexistente sem
 * crases, nem um mapa vazio. Uma regra que nenhum caso consegue avermelhar é uma regra que ninguém defende no dia em que
 * alguém a apaga, e foi a mutação sobrevivente que o disse.
 *
 * ⚠️ E O PRÓPRIO SCRIPT DE MUTAÇÃO APAGOU ESTES DOIS CASOS ao repô-los: ele guarda uma cópia na primeira corrida e restaura-a
 * sempre, logo um caso ESCRITO ENTRE duas corridas é revertido sem aviso. Segunda vez no mesmo dia que uma ferramenta de
 * mutação estraga a árvore que mede.
 */
