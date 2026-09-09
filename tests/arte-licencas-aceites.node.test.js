// SPDX-License-Identifier: AGPL-3.0-or-later
// AS TRÊS PORTAS POR ONDE A ARTE ENTRA — os gates que o ADR-0133 §confirmation deixou em dívida (#140).
//
// ========================= O QUE ESTE FICHEIRO AFIRMA, E POR QUE MUDOU DUAS VEZES =========================
// Ele era `lcp-quarantine.node.test.js` e afirmava que uma PAREDE se aguentava. Depois passou a afirmar que
// toda licença estava numa LISTA FECHADA de quatro nomes. As duas versões erravam da mesma maneira, e o Dev
// apanhou-as com o mesmo tipo de caso: **recusavam por um nome não estar na lista**, e não por o projeto não
// poder usar a obra.
//
// 🎯 O ADR-0133 passou a decidir por COMPATIBILIDADE COM O PROJETO, em quatro perguntas — pode derivar? pode
// usar comercialmente? podemos CONVEIAR o ficheiro no que publicamos? algo VIAJA da fonte para a saída? — e
// três portas: a CONCESSÃO do autor, a LICENÇA que passa as quatro, e a PONTE, por onde o copyleft entra
// convertido em `GPL-3.0-only` (declaração de compatibilidade da Creative Commons de 08/10/2015 + §13 da
// GPLv3, que permite combinar obra GPLv3 com obra AGPLv3 num único trabalho).
//
// ⚠️ E ISSO MUDA O QUE UM GATE CONSEGUE AFIRMAR, o que é o assunto deste ficheiro. Nenhuma máquina responde
// «esta licença permite uso comercial?» — não é comparação de texto. O que uma máquina consegue afirmar é
// que **alguém escreveu a resposta**, que a linha declara POR QUE PORTA entrou, e que o que essa porta exige
// está lá. Um nome novo não é recusado: é REFERIDO, e a linha reprova até um registo dizer que as quatro
// perguntas foram respondidas para ele. É a diferença entre uma lista e um estrangulamento.
//
// ========================= O QUE ESTE FICHEIRO NÃO CONSEGUE AFIRMAR, DITO À FRENTE =========================
// 🔴 ELE CONFERE A LINHA, NÃO A CONCESSÃO NA ORIGEM. O ADR-0133 pede mais: que a licença declarada seja
// conferida contra a página de origem, porque uma declaração a jusante é indício e não autoridade — medido
// no `ElizaWy/LPC`, que declara tudo CC BY 3.0 ou OGA-BY 3.0 enquanto uma das páginas que ele cita concede
// só CC-BY-SA 3.0 e GPL 3.0. Essa metade PRECISA DE REDE e fica na #140.
//
// ⚠️ E O LIVRO ESTÁ VAZIO. Nenhum recurso entrou ainda. Um crivo sobre árvore vazia passa por não ter o que
// examinar, então as regras vivem em funções PURAS que fixtures conduzem, e o caso do vácuo vem PRIMEIRO.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));

/** A árvore da arte importada. Já não é uma quarentena: é só onde a arte de fora vive. */
const ARTE = 'art/';
/** O livro-razão por recurso. Atribuição é condição de uso na maioria das portas, não linha de crédito. */
const LIVRO = 'art/ATTRIBUTION.csv';
/** Os dois ficheiros da própria árvore, que não são recursos e por isso não se declaram a si mesmos. */
const NAO_SAO_RECURSO = new Set(['art/README.md', LIVRO]);

/**
 * As licenças que o projeto JÁ MEDIU e registou como passando as quatro perguntas.
 *
 * 📌 Isto não é a regra — a regra são as quatro perguntas, e vive no ADR-0133. Isto é a memória das respostas
 * já dadas, que é o que uma máquina consegue conferir. Acrescentar uma linha aqui é declarar que as quatro
 * foram respondidas para aquele nome, e o sítio onde a resposta mora é o registo.
 */
const MEDIDAS_COMO_PASSANDO = Object.freeze([
  'CC0-1.0', 'CC-BY-3.0', 'CC-BY-4.0', 'OGA-BY-3.0', 'OGA-BY-4.0', 'MIT', 'Apache-2.0',
]);

/**
 * 🔴 SEM CAMINHO NENHUM, POR PORTA NENHUMA — e são só duas, desde que a ponte existe.
 *
 * A recusa é nomeada em vez de ser «o que não está na lista de cima» por uma razão de MENSAGEM: a diferença
 * entre um erro de escrita («cc-by-3.0» em minúsculas) e uma licença proibida é a coisa mais importante que
 * esta linha pode dizer a quem a lê.
 */
const SEM_PORTA = Object.freeze([
  { padrao: /(^|[-\s])ND([-\s]|$)|NoDeriv/i, porque: 'ND proíbe derivar, e recolorir já é derivar' },
  { padrao: /(^|[-\s])NC([-\s]|$)|NonCommercial/i, porque: 'NC deixaria a arte mais estreita que o código AGPL' },
]);

/** As três portas do ADR-0133. A linha declara a sua, e cada uma exige uma coisa diferente. */
const PORTAS = Object.freeze(['concessao', 'licenca', 'ponte']);
/** A ponte só existe para share-alike da Creative Commons, e só produz esta saída. */
const FONTE_DA_PONTE = /^CC-BY-SA-[34]\.0$/;
const SAIDA_DA_PONTE = 'GPL-3.0-only';

/* ---------- as metades puras: recebem listas, para que os fixtures as possam conduzir ---------- */

/** Lê o livro-razão. Devolve as entradas; a primeira linha é cabeçalho e o vazio final ignora-se. */
export function lerLivro(texto) {
  return texto.split(/\r?\n/).slice(1).filter((ln) => ln.trim() !== '').map((ln) => {
    const [caminho, autor, fonte, porta, licenca, saida, derivadoDe] = ln.split(',');
    return {
      caminho: (caminho ?? '').trim(),
      autor: (autor ?? '').trim(),
      fonte: (fonte ?? '').trim(),
      porta: (porta ?? '').trim(),
      licenca: (licenca ?? '').trim(),
      saida: (saida ?? '').trim(),
      derivadoDe: (derivadoDe ?? '').split(';').map((s) => s.trim()).filter(Boolean),
    };
  });
}

/**
 * Tudo o que pode estar errado com o livro, dito por extenso.
 *
 * ⚠️ A ORDEM DAS PERGUNTAS DE LICENÇA É A REGRA: pergunta-se primeiro se está SEM PORTA e só depois se a
 * porta declarada aceita aquele nome. Ao contrário, uma linha `CC-BY-NC-4.0` sairia com «não é uma das
 * medidas», que é verdade e é a metade errada da verdade — quem a ler vai corrigir a grafia.
 */
export function problemasDoLivro(entradas, vivos) {
  const problemas = [];
  const vistos = new Set();
  for (const e of entradas) {
    if (!e.autor) problemas.push(`sem autor: ${e.caminho} — «não consegui descobrir» não é licença`);
    if (!e.caminho.startsWith(ARTE)) problemas.push(`fora de ${ARTE}: ${e.caminho}`);
    if (!vivos.has(e.caminho)) problemas.push(`órfão: ${e.caminho} — a entrada nomeia um recurso que não existe`);
    if (vistos.has(e.caminho)) problemas.push(`entrada repetida: ${e.caminho}`);

    // 🎯 A URL da fonte é a matéria-prima da conferência na origem que a #140 vai construir: sem ela
    // guardada por recurso, a licença declarada não tem contra o que ser conferida.
    if (!/^https?:\/\/\S+$/.test(e.fonte)) {
      problemas.push(`fonte sem URL em ${e.caminho}: «${e.fonte}» — a licença declarada tem de poder ser conferida na origem`);
    }

    const semPorta = SEM_PORTA.find((r) => r.padrao.test(e.licenca));
    if (semPorta) {
      problemas.push(`SEM PORTA NENHUMA em ${e.caminho}: «${e.licenca}» — ${semPorta.porque} (ADR-0133)`);
    } else if (!PORTAS.includes(e.porta)) {
      problemas.push(`porta inválida em ${e.caminho}: «${e.porta}» — tem de ser uma de ${PORTAS.join(', ')}`);
    } else if (e.porta === 'licenca' && !MEDIDAS_COMO_PASSANDO.includes(e.licenca)) {
      // 📌 REFERIDO, não recusado: um nome novo entra assim que um registo disser que as quatro perguntas
      // foram respondidas para ele. A mensagem tem de dizer isso, senão parece uma porta fechada.
      problemas.push(`licença por medir em ${e.caminho}: «${e.licenca}» — responda as quatro perguntas do `
        + `ADR-0133 num registo e acrescente o nome; medidas até hoje: ${MEDIDAS_COMO_PASSANDO.join(', ')}`);
    } else if (e.porta === 'concessao' && !/^https?:\/\/\S+$/.test(e.licenca)) {
      problemas.push(`concessão sem ponteiro em ${e.caminho}: «${e.licenca}» — uma concessão que ninguém `
        + `consegue abrir é uma lembrança, não uma permissão`);
    } else if (e.porta === 'ponte') {
      if (!FONTE_DA_PONTE.test(e.licenca)) {
        problemas.push(`ponte com fonte errada em ${e.caminho}: «${e.licenca}» — a declaração de `
          + `compatibilidade da Creative Commons cobre CC BY-SA, e mais nada`);
      }
      if (e.saida !== SAIDA_DA_PONTE) {
        problemas.push(`saída errada na ponte em ${e.caminho}: «${e.saida}» — tem de ser exactamente `
          + `${SAIDA_DA_PONTE}; «or-later» reivindicaria uma compatibilidade que não foi declarada`);
      }
      if (e.derivadoDe.length === 0) {
        problemas.push(`ponte sem adaptação em ${e.caminho} — a ponte só abre para uma DERIVADA, e o `
          + `ficheiro original continua na licença dele para toda a gente`);
      }
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

/** Uma linha sã, para os casos mudarem UM campo de cada vez em vez de repetirem o objecto inteiro. */
const linha = (extra = {}) => ({
  caminho: `${ARTE}x.png`, autor: 'Alguém', fonte: 'https://opengameart.org/x',
  porta: 'licenca', licenca: 'CC0-1.0', saida: '', derivadoDe: [], ...extra,
});
const so = (extra) => problemasDoLivro([linha(extra)], new Set([`${ARTE}x.png`]));

describe('ADR-0133 · as três portas por onde a arte entra', () => {
  it('⚠️ [Vácuo] a árvore da arte EXISTE e é versionada — sem ela os outros casos passariam por vácuo', () => {
    // Primeiro e não último, porque a árvore de recursos está VAZIA: as portas foram decididas e nenhuma
    // arte entrou ainda. É este caso que prova que a varredura continua viva — e ele apanha a armadilha do
    // `.gitignore` onde ela morde: num clone limpo, uma pasta ignorada não tem nem README nem livro.
    expect(existsSync(join(RAIZ, LIVRO)), `${LIVRO} não existe — o livro-razão é a atribuição, não um extra`).toBe(true);
    expect(naArvore, 'a varredura de `art/` não achou nem o README nem o livro')
      .toEqual(expect.arrayContaining([...NAO_SAO_RECURSO]));
  });

  it('⚠️ [Interface] todo recurso tem entrada — entrar sem atribuição é violar a licença', () => {
    expect(naoDeclarados(recursosVivos, entradas), 'recurso de arte sem entrada no livro-razão').toEqual([]);
  });

  it('⚠️ [Interface] o livro real não tem órfãos, autor vazio, porta inválida nem fonte sem URL', () => {
    expect(problemasDoLivro(entradas, recursosVivos)).toEqual([]);
  });

  it('[Right] as licenças já medidas passam pela porta `licenca` — senão o gate nunca ficaria verde', () => {
    // ⚠️ A metade que falta a quase todo gate de lista negra: provar que o lado permissivo FUNCIONA. Sem
    // ela, um padrão de recusa largo demais tornaria o livro impossível de preencher, e um gate que nunca
    // pode ficar verde é um gate que alguém desliga.
    for (const licenca of MEDIDAS_COMO_PASSANDO) {
      expect(so({ licenca }), `«${licenca}» devia passar e não passou`).toEqual([]);
    }
  });

  it('🔴 [Right] ND e NC não têm porta nenhuma, e a mensagem diz que é RECUSA e não erro de escrita', () => {
    for (const [licenca, agulha] of [
      ['CC-BY-ND-4.0', 'recolorir já é derivar'],
      ['CC-BY-NC-4.0', 'mais estreita que o código'],
    ]) {
      const p = so({ licenca });
      expect(p.filter((s) => s.startsWith('SEM PORTA')), `«${licenca}» não foi recusada`).toHaveLength(1);
      expect(p[0], `a recusa de «${licenca}» não diz o motivo certo`).toContain(agulha);
      expect(p.some((s) => s.startsWith('licença por medir')), 'saiu como erro de escrita').toBe(false);
    }
  });

  it('🎯 [Right] SHARE-ALIKE já não é recusado: passa PELA PONTE, com saída e adaptação', () => {
    // O caso que carrega a decisão de hoje, e é o inverso do que este ficheiro afirmava de manhã. A ponte
    // é a declaração de compatibilidade da Creative Commons de 08/10/2015 mais o §13 da GPLv3.
    expect(so({
      porta: 'ponte', licenca: 'CC-BY-SA-3.0', saida: 'GPL-3.0-only', derivadoDe: ['fonte/heroi.png'],
    }), 'a ponte devia deixar passar CC BY-SA adaptada').toEqual([]);
  });

  it('⚠️ [Right] a ponte exige `GPL-3.0-only` — «or-later» reivindica o que não foi declarado', () => {
    const p = so({ porta: 'ponte', licenca: 'CC-BY-SA-4.0', saida: 'GPL-3.0-or-later', derivadoDe: ['f.png'] });
    expect(p.some((s) => s.startsWith('saída errada na ponte'))).toBe(true);
  });

  it('⚠️ [Right] a ponte exige ADAPTAÇÃO — o ficheiro original nunca muda de licença', () => {
    const p = so({ porta: 'ponte', licenca: 'CC-BY-SA-3.0', saida: 'GPL-3.0-only', derivadoDe: [] });
    expect(p.some((s) => s.startsWith('ponte sem adaptação'))).toBe(true);
  });

  it('[Right] a ponte não serve para levar uma licença qualquer a GPL', () => {
    const p = so({ porta: 'ponte', licenca: 'MIT', saida: 'GPL-3.0-only', derivadoDe: ['f.png'] });
    expect(p.some((s) => s.startsWith('ponte com fonte errada'))).toBe(true);
  });

  it('🎯 [Right] a porta `concessao` exige um PONTEIRO para a concessão, não um nome', () => {
    // É a porta do Tiny Swords: termos escritos pelo autor, permissivos, sem nome de licença conhecido.
    expect(so({ porta: 'concessao', licenca: 'https://pixelfrog-assets.itch.io/tiny-swords' }),
      'uma concessão com ponteiro devia passar').toEqual([]);
    const p = so({ porta: 'concessao', licenca: 'o autor deixou' });
    expect(p.some((s) => s.startsWith('concessão sem ponteiro'))).toBe(true);
  });

  it('📌 [Boundary] um nome NOVO é REFERIDO, não recusado — a mensagem tem de dizer como o admitir', () => {
    // A diferença entre uma lista e um estrangulamento. `Zlib` não tem nada de errado; só ainda ninguém
    // respondeu as quatro perguntas para ele, e a mensagem tem de dizer exactamente isso.
    const p = so({ licenca: 'Zlib' });
    expect(p.filter((s) => s.startsWith('licença por medir'))).toHaveLength(1);
    expect(p[0], 'a mensagem não diz COMO admitir a licença nova').toContain('quatro perguntas');
    expect(p.some((s) => s.startsWith('SEM PORTA')), 'tratou um nome novo como proibição').toBe(false);
  });

  it('⚠️ [Right] uma fonte sem URL reprova — é a matéria-prima da conferência na origem', () => {
    expect(so({ fonte: 'opengameart' }).some((s) => s.startsWith('fonte sem URL'))).toBe(true);
  });

  it('⚠️ [Right] um ficheiro SEM ENTRADA reprova — entrar sem atribuição é violar a licença', () => {
    expect(naoDeclarados(new Set([`${ARTE}intruso.png`]), [])).toEqual([`${ARTE}intruso.png`]);
    expect(naoDeclarados(new Set([`${ARTE}x.png`]), [linha()])).toEqual([]);
  });

  it('⚠️ [Right] um recurso SEM AUTOR reprova — «não consegui descobrir» não é licença', () => {
    expect(so({ autor: '' }).some((s) => s.startsWith('sem autor'))).toBe(true);
  });

  it('[Right] uma entrada ÓRFÃ reprova — senão o livro é uma lembrança, não uma medida', () => {
    const p = problemasDoLivro([linha({ caminho: `${ARTE}sumiu.png` })], new Set());
    expect(p.some((s) => s.startsWith('órfão'))).toBe(true);
  });

  it('⚠️ [Interface] o `LICENSES.md` nomeia as três portas E as duas recusas', () => {
    // Sem este caso o ficheiro que um advogado lê pode divergir do que o gate afirma — e é o ficheiro que
    // o pedido `g` do requerimento manda constar dos autos.
    const txt = readFileSync(join(RAIZ, 'docs/LICENSES.md'), 'utf8');
    for (const nome of ['CC0', 'CC BY', 'OGA-BY', 'GPL-3.0-only', 'concess']) {
      expect(txt, `o LICENSES.md não nomeia ${nome}`).toContain(nome);
    }
    // 🎯 E as recusas, que são metade da decisão: um documento que só lista o permitido lê-se como uma
    // lista de exemplos, e foi por isso que o ADR-0133 as nomeou em vez de as deixar por dedução.
    for (const nome of ['ND', 'NC']) {
      expect(txt, `o LICENSES.md não diz que recusamos ${nome}`).toContain(nome);
    }
  });

  it('⚠️ [Interface] o `CREDITS.md` APONTA para o livro-razão — senão a atribuição fica achável só por quem já sabe', () => {
    const txt = readFileSync(join(RAIZ, 'docs/CREDITS.md'), 'utf8');
    expect(txt, 'o CREDITS.md não aponta para o livro-razão da arte').toContain(LIVRO);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Cada uma aplicada por script a ficheiro e com contagem de ocorrencias antes de aplicar.
//   · 🎯 tirar a exigencia de `GPL-3.0-only` (aceitar qualquer saida) -> reprova o caso do «or-later». E a
//     mutacao que mais interessa da ponte: a declaracao da Creative Commons cobre a VERSAO 3 e mais nenhuma,
//     e um aviso «or-later» reivindica uma compatibilidade que ninguem declarou. Ninguem notaria a olho.
//   · tirar a exigencia de ADAPTACAO na ponte -> reprova o caso homonimo. Sem ela um ficheiro CC BY-SA
//     copiado tal e qual sairia como GPL, e o original nunca muda de licenca para ninguem.
//   · deixar a ponte aceitar qualquer licenca de origem -> reprova o caso do MIT. A ponte nao e um conversor
//     universal para GPL; ela existe so para o share-alike da Creative Commons.
//   · trocar a ordem das perguntas (porta antes de SEM_PORTA) -> reprova os casos do ND/NC pela ultima
//     asseracao: o gate continuaria a reprovar a linha e perderia a RAZAO, que e o que quem le precisa.
//   · tratar um nome novo como proibicao em vez de «por medir» -> reprova o [Boundary]. E a diferenca entre
//     uma lista e um estrangulamento, e foi o defeito que o Dev apanhou duas vezes num dia.
//   · tirar a guarda do PONTEIRO na porta `concessao` -> reprova o caso homonimo. Uma concessao que ninguem
//     consegue abrir e honrada de memoria, que e onde toda regra deste repositorio ja falhou.
//   · tirar a guarda da FONTE SEM URL -> reprova o caso homonimo. Sem ela nao ha o que conferir na origem.
//   · tirar a guarda do AUTOR VAZIO / do ORFAO -> reprovam os casos homonimos.
//   · esvaziar `art/` -> reprova o [Vacuo] PRIMEIRO, o unico que o pode apanhar com o livro vazio.
