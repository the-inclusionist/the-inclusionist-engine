// SPDX-License-Identifier: AGPL-3.0-or-later
// AS QUATRO LICENÇAS QUE A ARTE PODE TER — os gates que o ADR-0133 §confirmation deixou em dívida (#140).
//
// ========================= O QUE MUDOU, E POR QUE O FICHEIRO TROCOU DE NOME =========================
// Este ficheiro era `lcp-quarantine.node.test.js` e afirmava que uma PAREDE se aguentava: material do
// Liberated Pixel Cup de um lado, a arte do projeto do outro, e nenhum recurso a misturar os dois. A parede
// existia porque o LCP é CC BY-SA 3.0, e o share-alike VIAJA — uma imagem semântica traçada de um sprite é
// derivada dele, logo tudo o que o pipeline produzisse de uma fonte SA sairia SA.
//
// 🔴 E A PREMISSA QUE SUSTENTAVA A PAREDE ERA FALSA, corrigida pelo Dev em 2026-09-09: o ADR-0107 dizia que
// o share-alike alcançaria arte NÃO-FOSS de terceiro, e essa arte não existe — nenhuma arte de contribuinte
// entrou, e nenhuma entrará enquanto o regime não estiver resolvido. O regime de licença é POLÍTICA QUE O
// PROJETO ESCOLHE, e quem contribuir adapta-se. O que sobra do argumento é sobre a SAÍDA, escrito acima.
//
// 🎯 O ADR-0133 REMOVEU A PAREDE AO REMOVER O QUE ELA SEGURAVA. O Dev recusou share-alike de vez — «nada de
// quarentena, melhor não aceitar por enquanto» — e fechou a lista em quatro licenças. Sem arte SA na árvore
// não há nada a propagar, logo não há mistura a proibir nem tree a segregar.
//
// ⚠️ O FICHEIRO NÃO FOI APAGADO, E ISSO É DELIBERADO. Apagá-lo deixaria o livro-razão sem gate nenhum
// durante a mudança, que é exactamente como uma regra vira frase num documento. A afirmação VIROU-SE: onde
// dizia «a parede aguenta-se» diz agora «nenhuma licença recusada aparece no livro» — e a nova é mais forte,
// porque é a lista enumerada que a torna afirmável de todo. O teste de duas perguntas que o ADR-0133 tinha
// na primeira versão («permite derivar? permite uso comercial?») NÃO É COMPARÁVEL POR UMA MÁQUINA.
//
// ========================= O QUE ESTE FICHEIRO NÃO CONSEGUE AFIRMAR, DITO À FRENTE =========================
// 🔴 ELE CONFERE O NOME DA LICENÇA, NÃO A CONCESSÃO. O ADR-0133 §confirmation pede mais: que a licença
// declarada seja conferida contra a página de ORIGEM, porque uma declaração a jusante é indício e não
// autoridade. Foi medido: o `ElizaWy/LPC` declara tudo CC BY 3.0 ou OGA-BY 3.0, e uma das páginas que os
// créditos dele citam concede apenas CC-BY-SA 3.0 e GPL 3.0. Essa metade PRECISA DE REDE e por isso não
// mora aqui — fica na #140, e este cabeçalho é onde a dívida está escrita para não desaparecer.
// O que este ficheiro pode exigir hoje é a matéria-prima dela: toda linha carrega uma URL de fonte.
//
// ⚠️ E O LIVRO ESTÁ VAZIO. Nenhum recurso entrou nunca — `art/` tem um README e um cabeçalho de CSV. Um
// crivo sobre uma árvore vazia passa por não ter o que examinar, então as regras vivem em funções PURAS que
// fixtures conduzem, e o caso do vácuo vem PRIMEIRO: é ele que prova que a varredura continua viva.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));

/** A árvore da arte importada. Já não é uma quarentena: é só onde a arte de fora vive. */
const ARTE = 'art/';
/** O livro-razão por recurso. Atribuição é CONDIÇÃO DE USO em três das quatro, não linha de crédito. */
const LIVRO = 'art/ATTRIBUTION.csv';
/** Os dois ficheiros da própria árvore, que não são recursos e por isso não se declaram a si mesmos. */
const NAO_SAO_RECURSO = new Set(['art/README.md', LIVRO]);

/**
 * ⚠️ A LISTA É FECHADA, E O SER FECHADA É A DECISÃO. O ADR-0133 recusou um TESTE («permite derivar? permite
 * uso comercial?») em favor de uma lista, porque um teste discute-se nas bordas e porque nenhuma máquina
 * consegue afirmá-lo. Acrescentar uma linha aqui é o acto de admitir uma licença nova, e ele custa um registo.
 */
const ACEITES = Object.freeze([
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'OGA-BY-3.0',
  'OGA-BY-4.0',
]);

/**
 * 🔴 E AS RECUSADAS SÃO NOMEADAS, em vez de serem só «o que não está na lista de cima».
 *
 * Sem isto, uma licença mal escrita («CC-BY-SA 3.0» com espaço, «cc-by-3.0» em minúsculas) reprovaria com a
 * mesma frase de uma licença PROIBIDA — e a diferença entre um erro de escrita e uma violação de licença é a
 * coisa mais importante que esta mensagem pode dizer a quem a lê.
 */
const RECUSADAS = Object.freeze([
  { padrao: /(^|[-\s])ND([-\s]|$)|NoDeriv/i, porque: 'ND proíbe derivar, e recolorir já é derivar' },
  { padrao: /(^|[-\s])NC([-\s]|$)|NonCommercial/i, porque: 'NC deixaria a arte mais estreita que o código AGPL' },
  { padrao: /(^|[-\s])SA([-\s]|$)|ShareAlike/i, porque: 'share-alike VIAJA para a saída do pipeline' },
  { padrao: /^A?GPL/i, porque: 'o copyleft do braço GPL propaga como o share-alike' },
]);

/* ---------- as metades puras: recebem listas, para que os fixtures as possam conduzir ---------- */

/** Lê o livro-razão. Devolve as entradas; a primeira linha é cabeçalho e o vazio final ignora-se. */
export function lerLivro(texto) {
  return texto.split(/\r?\n/).slice(1).filter((ln) => ln.trim() !== '').map((ln) => {
    const [caminho, autor, fonte, licenca, derivadoDe] = ln.split(',');
    return {
      caminho: (caminho ?? '').trim(),
      autor: (autor ?? '').trim(),
      fonte: (fonte ?? '').trim(),
      licenca: (licenca ?? '').trim(),
      derivadoDe: (derivadoDe ?? '').split(';').map((s) => s.trim()).filter(Boolean),
    };
  });
}

/**
 * Tudo o que pode estar errado com o livro, dito por extenso.
 *
 * ⚠️ A ORDEM DAS DUAS PRIMEIRAS REGRAS DE LICENÇA É A REGRA: pergunta-se primeiro se está RECUSADA e só
 * depois se está na lista. Ao contrário, uma linha com «CC-BY-SA-3.0» sairia com «não é uma das quatro»,
 * que é verdade e é a metade errada da verdade — quem a ler pensa em corrigir a grafia.
 */
export function problemasDoLivro(entradas, vivos) {
  const problemas = [];
  const vistos = new Set();
  for (const e of entradas) {
    if (!e.autor) problemas.push(`sem autor: ${e.caminho} — «não consegui descobrir» não é licença`);
    if (!e.caminho.startsWith(ARTE)) problemas.push(`fora de ${ARTE}: ${e.caminho}`);
    if (!vivos.has(e.caminho)) problemas.push(`órfão: ${e.caminho} — a entrada nomeia um recurso que não existe`);
    if (vistos.has(e.caminho)) problemas.push(`entrada repetida: ${e.caminho}`);

    const recusada = RECUSADAS.find((r) => r.padrao.test(e.licenca));
    if (recusada) {
      problemas.push(`LICENÇA RECUSADA em ${e.caminho}: «${e.licenca}» — ${recusada.porque} (ADR-0133)`);
    } else if (!ACEITES.includes(e.licenca)) {
      problemas.push(`licença desconhecida em ${e.caminho}: «${e.licenca}» — as aceites são ${ACEITES.join(', ')}`);
    }

    // 🎯 A URL da fonte é a matéria-prima da conferência que o ADR-0133 pede e que precisa de rede: sem ela
    // guardada por recurso, a licença declarada não tem contra o que ser conferida quando a #140 chegar.
    if (!/^https?:\/\/\S+$/.test(e.fonte)) {
      problemas.push(`fonte sem URL em ${e.caminho}: «${e.fonte}» — a licença declarada tem de poder ser conferida na origem`);
    }
    vistos.add(e.caminho);
  }
  return problemas;
}

/** Ficheiros na árvore que ninguém declarou. Entrar sem entrada é entrar sem atribuição. */
export function naoDeclarados(vivos, entradas) {
  const declarados = new Set(entradas.map((e) => e.caminho));
  return [...vivos].filter((f) => !declarados.has(f));
}

/* ---------- a árvore de verdade ---------- */

function ficheirosDe(rel) {
  const abs = join(RAIZ, rel);
  if (!existsSync(abs)) return [];
  const saida = [];
  const andar = (dir) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) andar(p);
      else saida.push(relative(RAIZ, p).split('\\').join('/'));
    }
  };
  andar(abs);
  return saida;
}

const naArvore = ficheirosDe(ARTE);
const recursosVivos = new Set(naArvore.filter((f) => !NAO_SAO_RECURSO.has(f)));
const entradas = existsSync(join(RAIZ, LIVRO)) ? lerLivro(readFileSync(join(RAIZ, LIVRO), 'utf8')) : [];

describe('ADR-0133 · as quatro licenças que a arte pode ter', () => {
  it('⚠️ [Vácuo] a árvore da arte EXISTE e é versionada — sem ela os outros casos passariam por vácuo', () => {
    // Primeiro e não último, porque hoje a árvore de recursos está VAZIA: a lista foi decidida e nenhuma
    // arte entrou. Enquanto estiver vazia, é este caso que prova que a varredura continua viva — e ele
    // apanha a armadilha do `.gitignore` no ponto onde ela morde: num clone limpo, uma pasta ignorada não
    // tem nem README nem livro, e este caso reprova.
    expect(existsSync(join(RAIZ, LIVRO)), `${LIVRO} não existe — o livro-razão é a atribuição, não um extra`).toBe(true);
    expect(naArvore, 'a varredura de `art/` não achou nem o README nem o livro')
      .toEqual(expect.arrayContaining([...NAO_SAO_RECURSO]));
  });

  it('⚠️ [Interface] todo recurso tem entrada — entrar sem atribuição é violar a licença', () => {
    expect(naoDeclarados(recursosVivos, entradas), 'recurso de arte sem entrada no livro-razão').toEqual([]);
  });

  it('⚠️ [Interface] o livro real não tem órfãos, autor vazio, licença recusada nem fonte sem URL', () => {
    expect(problemasDoLivro(entradas, recursosVivos)).toEqual([]);
  });

  it('🔴 [Right] SHARE-ALIKE reprova, e a mensagem diz que a licença é RECUSADA e não desconhecida', () => {
    // O caso que carrega o registo inteiro, e é o que MUDOU de sentido: até ontem `CC-BY-SA-3.0` era o
    // único valor ACEITE nesta coluna. O ADR-0133 recusou-o, e recusar uma coisa que já foi obrigatória é
    // exactamente o tipo de mudança que um gate tem de conseguir afirmar.
    const p = problemasDoLivro(
      [{ caminho: `${ARTE}x.png`, autor: 'Alguém', fonte: 'https://opengameart.org/x', licenca: 'CC-BY-SA-3.0', derivadoDe: [] }],
      new Set([`${ARTE}x.png`]),
    );
    expect(p.filter((s) => s.startsWith('LICENÇA RECUSADA'))).toHaveLength(1);
    expect(p[0], 'a mensagem não diz POR QUE o share-alike é recusado').toContain('VIAJA');
    expect(p.some((s) => s.startsWith('licença desconhecida')), 'saiu como erro de escrita em vez de recusa').toBe(false);
  });

  it('🔴 [Right] ND, NC e o braço GPL reprovam, cada um com o seu motivo', () => {
    for (const [licenca, agulha] of [
      ['CC-BY-ND-4.0', 'recolorir já é derivar'],
      ['CC-BY-NC-4.0', 'mais estreita que o código'],
      ['GPL-3.0-only', 'copyleft do braço GPL'],
    ]) {
      const p = problemasDoLivro(
        [{ caminho: `${ARTE}x.png`, autor: 'Alguém', fonte: 'https://opengameart.org/x', licenca, derivadoDe: [] }],
        new Set([`${ARTE}x.png`]),
      );
      expect(p.filter((s) => s.startsWith('LICENÇA RECUSADA')), `«${licenca}» não foi recusada`).toHaveLength(1);
      expect(p[0], `a recusa de «${licenca}» não diz o motivo certo`).toContain(agulha);
    }
  });

  it('[Right] as quatro aceites passam, senão o gate nunca poderia ficar verde', () => {
    // ⚠️ A metade que falta a quase todo gate de lista negra: provar que a lista BRANCA funciona. Sem ela,
    // uma expressão recusada demasiado larga (`/SA/` casaria «CC0-1.0»? não — mas `/BY/` casaria tudo)
    // deixaria o livro impossível de preencher, e um gate que nunca fica verde é um gate que alguém desliga.
    for (const licenca of ACEITES) {
      const p = problemasDoLivro(
        [{ caminho: `${ARTE}x.png`, autor: 'Alguém', fonte: 'https://opengameart.org/x', licenca, derivadoDe: [] }],
        new Set([`${ARTE}x.png`]),
      );
      expect(p, `«${licenca}» devia passar e não passou`).toEqual([]);
    }
  });

  it('⚠️ [Right] uma fonte sem URL reprova — é a matéria-prima da conferência na origem', () => {
    const p = problemasDoLivro(
      [{ caminho: `${ARTE}x.png`, autor: 'Alguém', fonte: 'opengameart', licenca: 'CC0-1.0', derivadoDe: [] }],
      new Set([`${ARTE}x.png`]),
    );
    expect(p.some((s) => s.startsWith('fonte sem URL'))).toBe(true);
  });

  it('⚠️ [Right] um ficheiro SEM ENTRADA reprova — entrar sem atribuição é violar a licença', () => {
    expect(naoDeclarados(new Set([`${ARTE}intruso.png`]), [])).toEqual([`${ARTE}intruso.png`]);
    expect(naoDeclarados(
      new Set([`${ARTE}ok.png`]),
      [{ caminho: `${ARTE}ok.png`, autor: 'Alguém', fonte: 'https://x/y', licenca: 'CC0-1.0', derivadoDe: [] }],
    )).toEqual([]);
  });

  it('⚠️ [Right] um recurso SEM AUTOR reprova — «não consegui descobrir» não é licença', () => {
    const p = problemasDoLivro(
      [{ caminho: `${ARTE}x.png`, autor: '', fonte: 'https://x/y', licenca: 'CC0-1.0', derivadoDe: [] }],
      new Set([`${ARTE}x.png`]),
    );
    expect(p.some((s) => s.startsWith('sem autor'))).toBe(true);
  });

  it('[Right] uma entrada ÓRFÃ reprova — senão o livro é uma lembrança, não uma medida', () => {
    const p = problemasDoLivro(
      [{ caminho: `${ARTE}sumiu.png`, autor: 'Alguém', fonte: 'https://x/y', licenca: 'CC0-1.0', derivadoDe: [] }],
      new Set(),
    );
    expect(p.some((s) => s.startsWith('órfão'))).toBe(true);
  });

  it('⚠️ [Interface] o `LICENSES.md` nomeia as quatro aceites E as três recusas', () => {
    // Sem este caso o ficheiro que um advogado lê pode divergir do que o gate afirma — e é o ficheiro que
    // o pedido `g` do requerimento manda constar dos autos.
    const txt = readFileSync(join(RAIZ, 'docs/LICENSES.md'), 'utf8');
    for (const nome of ['CC0', 'CC BY 3.0', 'CC BY 4.0', 'OGA-BY']) {
      expect(txt, `o LICENSES.md não nomeia ${nome}`).toContain(nome);
    }
    // 🎯 E as recusas, que são metade da decisão: um documento que só lista o permitido lê-se como
    // uma lista de exemplos, e foi por isso que o ADR-0133 as nomeou em vez de as deixar por dedução.
    for (const nome of ['ND', 'NC', 'share-alike']) {
      expect(txt, `o LICENSES.md não diz que recusamos ${nome}`).toContain(nome);
    }
  });

  it('⚠️ [Interface] o `CREDITS.md` APONTA para o livro-razão — senão a atribuição fica achável só por quem já sabe', () => {
    // A atribuição não CABE no CREDITS em prosa (é por recurso, e cresce com o catálogo), então o que viaja
    // é o apontador — e um apontador que ninguém verifica é como não o ter.
    const txt = readFileSync(join(RAIZ, 'docs/CREDITS.md'), 'utf8');
    expect(txt, 'o CREDITS.md não aponta para o livro-razão da arte').toContain(LIVRO);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Cada uma aplicada por script a ficheiro e com contagem de ocorrencias antes de aplicar.
//   · ⚠️ trocar a ordem das duas regras de licenca (perguntar primeiro se esta na lista ACEITES, so depois
//     se esta RECUSADA) -> reprova o caso do share-alike pela ultima asseracao. E a mutacao que mais
//     interessa, porque o gate continuaria a reprovar a linha: o que se perderia e a RAZAO. «CC-BY-SA-3.0
//     nao e uma das quatro» e verdade e e a metade errada da verdade — quem le vai corrigir a grafia.
//   · tirar `SA` das RECUSADAS -> reprova o caso do share-alike. E a decisao inteira do ADR-0133 numa linha.
//   · tirar a guarda da FONTE SEM URL -> reprova o caso homonimo. Sem ela nao ha o que conferir na origem
//     quando a #140 chegar, e a decisao ficaria a depender da palavra de quem entrega o ficheiro.
//   · tirar a guarda do AUTOR VAZIO -> reprova "um recurso SEM AUTOR". Um recurso sem autor conhecido nao e
//     um recurso mal documentado, e um recurso que NAO PODE ENTRAR: a atribuicao e condicao de uso.
//   · tirar a guarda do ORFAO -> reprova o caso do orfao. Sem ele o livro apodrece e parece maior do que e.
//   · alargar uma RECUSADA ate casar tudo (por exemplo `/BY/`) -> reprova "as quatro aceites passam". E a
//     direccao oposta e a que um gate de lista negra costuma esquecer: um crivo que recusa tudo nao e
//     seguro, e um gate que nunca pode ficar verde e um gate que alguem desliga.
//   · esvaziar `art/` -> reprova o [Vacuo] PRIMEIRO, que e o unico que o pode apanhar enquanto o livro
//     estiver vazio. Todos os casos da arvore real passariam por nao ter o que examinar.
