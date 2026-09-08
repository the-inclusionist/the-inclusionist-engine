// SPDX-License-Identifier: AGPL-3.0-or-later
// A QUARENTENA DO LIBERATED PIXEL CUP — os quatro gates que o ADR-0107 §confirmation deixou em dívida.
//
// ========================= POR QUE ISTO É UM CRIVO E NÃO UMA BUSCA POR PALAVRA =========================
// A afirmação do ADR-0107 §3 é uma AUSÊNCIA: «nenhum recurso mistura material derivado do LCP com a arte
// própria da autora». Isso não se prova procurando a palavra «LCP» — quem misturasse não escreveria a
// palavra, e um `grep` verde seria a forma mais barata de o gate mentir. O que se pode provar é o
// INVENTÁRIO: um livro-razão por recurso, cruzado contra os ficheiros que existem de verdade.
//
// ⚠️ E O QUE ESTÁ EM CAUSA NÃO É ARRUMAÇÃO. O pilar 10 do ADR-0010 diz que a arte é de uma TERCEIRA PESSOA,
// que não está neste repositório. O CC BY-SA 3.0 alcança o que nós alterarmos — é o que este repositório já
// escreveu para os pictogramas —, logo um recurso que misturasse as duas fontes licenciaria a arte DELA em
// share-alike. Seria gastar o direito de alguém sem lhe perguntar, e por engano de pipeline.
//
// ========================= O QUE ESTE FICHEIRO NÃO CONSEGUE AFIRMAR, DITO À FRENTE =========================
// ⚠️ O `assets-ref/` — 201 ficheiros de arte no disco — É IGNORADO PELO GIT (`.gitignore:22`), e por isso
// NÃO serve de âncora: num clone limpo ele não existe, a varredura devolveria vazio, e um crivo que não acha
// nada não prova ausência nenhuma — prova que o crivo morreu. Medido antes de escolher: `git ls-files
// assets-ref` devolve ZERO contra 201 no disco.
//
// Então o lado «arte própria» da regra de mistura é afirmado pela metade que É versionada: um recurso do LCP
// só pode derivar de outro recurso do LCP. Derivar de qualquer coisa fora da quarentena reprova, e é isso
// que fecha a porta ao recurso de duas fontes sem precisar de ver a árvore ignorada.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));

/** A árvore da quarentena, e o único sítio onde material derivado do LCP pode viver (ADR-0107 §3). */
const QUARENTENA = 'art/lcp/';
/** O livro-razão por recurso. Atribuição é CONDIÇÃO DE USO nos dois braços, não linha de crédito (§4). */
const LIVRO = 'art/lcp/ATTRIBUTION.csv';
/** Os dois ficheiros da própria quarentena, que não são recursos e por isso não se declaram a si mesmos. */
const NAO_SAO_RECURSO = new Set(['art/lcp/README.md', LIVRO]);
/** O braço escolhido pelo ADR-0107 §2. O outro (GPL-3.0) é leitura defensável e NÃO é o que este projeto toma. */
const BRACO = 'CC-BY-SA-3.0';

/* ---------- as metades puras: recebem listas, para que os fixtures as possam conduzir ---------- */

/** Lê o livro-razão. Devolve as entradas; a primeira linha é cabeçalho e o vazio final ignora-se. */
function lerLivro(texto) {
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
 * ⚠️ A regra 4 é a que carrega o ADR inteiro: um recurso do LCP que derive de algo FORA da quarentena é,
 * por construção, um recurso de duas fontes — e é ele que licenciaria a arte da autora em share-alike.
 */
function problemasDoLivro(entradas, vivos) {
  const problemas = [];
  const vistos = new Set();
  for (const e of entradas) {
    if (!e.autor) problemas.push(`sem autor: ${e.caminho} — «não consegui descobrir» não é licença (§4)`);
    if (!e.caminho.startsWith(QUARENTENA)) problemas.push(`fora da quarentena: ${e.caminho}`);
    if (!vivos.has(e.caminho)) problemas.push(`órfão: ${e.caminho} — a entrada nomeia um recurso que não existe`);
    if (vistos.has(e.caminho)) problemas.push(`entrada repetida: ${e.caminho}`);
    if (e.licenca !== BRACO) problemas.push(`braço errado em ${e.caminho}: «${e.licenca}» — o ADR-0107 §2 toma ${BRACO}`);
    for (const pai of e.derivadoDe) {
      if (!pai.startsWith(QUARENTENA)) {
        problemas.push(`MISTURA em ${e.caminho}: deriva de «${pai}», que está fora da quarentena`);
      }
    }
    vistos.add(e.caminho);
  }
  return problemas;
}

/** Ficheiros dentro da quarentena que ninguém declarou. Entrar sem entrada é entrar sem atribuição. */
function naoDeclarados(vivos, entradas) {
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

const naArvore = ficheirosDe(QUARENTENA);
const recursosVivos = new Set(naArvore.filter((f) => !NAO_SAO_RECURSO.has(f)));
const entradas = existsSync(join(RAIZ, LIVRO)) ? lerLivro(readFileSync(join(RAIZ, LIVRO), 'utf8')) : [];

describe('ADR-0107 · a quarentena do Liberated Pixel Cup', () => {
  it('⚠️ [Interface] a quarentena EXISTE e é versionada — sem ela os outros casos passariam por vácuo', () => {
    // O caso do vácuo, e aqui ele é o primeiro e não o último, porque hoje a árvore de recursos está VAZIA:
    // o LCP foi decidido e ainda não entrou. Enquanto estiver vazia, é este caso que prova que a varredura
    // continua viva. E ele apanha a armadilha do `.gitignore` no sítio onde ela morde: num clone limpo, uma
    // quarentena ignorada não tem nem README nem livro, e este caso reprova.
    expect(existsSync(join(RAIZ, LIVRO)), `${LIVRO} não existe — o livro-razão é a atribuição, não um extra`).toBe(true);
    expect(naArvore, 'a varredura da quarentena não achou nem o README nem o livro')
      .toEqual(expect.arrayContaining([...NAO_SAO_RECURSO]));
  });

  it('⚠️ [Interface] todo recurso da quarentena tem entrada — entrar sem atribuição é violar a licença', () => {
    expect(naoDeclarados(recursosVivos, entradas), 'recurso do LCP sem entrada no livro-razão').toEqual([]);
  });

  it('⚠️ [Interface] o livro não tem ÓRFÃOS, autor vazio, braço errado nem mistura', () => {
    expect(problemasDoLivro(entradas, recursosVivos)).toEqual([]);
  });

  it('⚠️ [Right] um ficheiro na quarentena SEM ENTRADA reprova — entrar sem atribuição é violar a licença', () => {
    // ⚠️ ESTE CASO EXISTE PORQUE O DE CIMA NÃO SE CONSEGUE MEDIR HOJE: a árvore de recursos está vazia, então
    // o caso da árvore real passa por não ter nada que examinar, e uma mutação em `naoDeclarados` sobreviveria
    // a ele. O fixture é o que dá corpo à regra antes de haver o primeiro ficheiro.
    expect(naoDeclarados(new Set([`${QUARENTENA}intruso.png`]), [])).toEqual([`${QUARENTENA}intruso.png`]);
    expect(naoDeclarados(
      new Set([`${QUARENTENA}ok.png`]),
      [{ caminho: `${QUARENTENA}ok.png`, autor: 'Alguém', fonte: 'lcp', licenca: BRACO, derivadoDe: [] }],
    )).toEqual([]);
  });

  it('⚠️ [Right] um recurso SEM AUTOR reprova — «não consegui descobrir» não é licença', () => {
    const fixture = [{ caminho: `${QUARENTENA}x.png`, autor: '', fonte: 'lcp', licenca: BRACO, derivadoDe: [] }];
    const p = problemasDoLivro(fixture, new Set([`${QUARENTENA}x.png`]));
    expect(p.some((s) => s.startsWith('sem autor'))).toBe(true);
  });

  it('⚠️ [Right] um recurso derivado de FORA da quarentena reprova — é a mistura que o ADR proíbe', () => {
    // O caso que carrega o registo inteiro. `assets-ref/walk/0.png` é o nome de um ficheiro do lado
    // PixelLab — o lado que, misturado, arrastaria a arte da autora para share-alike.
    const fixture = [{
      caminho: `${QUARENTENA}heroi.png`, autor: 'Alguém', fonte: 'lcp', licenca: BRACO,
      derivadoDe: [`${QUARENTENA}base.png`, 'assets-ref/walk/0.png'],
    }];
    const p = problemasDoLivro(fixture, new Set([`${QUARENTENA}heroi.png`]));
    expect(p.filter((s) => s.startsWith('MISTURA'))).toHaveLength(1);
    expect(p[0]).toContain('assets-ref/walk/0.png');
  });

  it('[Right] um recurso do LCP guardado FORA da quarentena reprova', () => {
    const p = problemasDoLivro(
      [{ caminho: 'app/public/x.png', autor: 'Alguém', fonte: 'lcp', licenca: BRACO, derivadoDe: [] }],
      new Set(['app/public/x.png']),
    );
    expect(p.some((s) => s.startsWith('fora da quarentena'))).toBe(true);
  });

  it('[Right] uma entrada ÓRFÃ reprova — senão o livro é uma lembrança, não uma medida', () => {
    const p = problemasDoLivro(
      [{ caminho: `${QUARENTENA}sumiu.png`, autor: 'Alguém', fonte: 'lcp', licenca: BRACO, derivadoDe: [] }],
      new Set(),
    );
    expect(p.some((s) => s.startsWith('órfão'))).toBe(true);
  });

  it('[Right] o braço GPL-3.0 reprova aqui — o ADR-0107 §2 escolheu, e a escolha é conferível', () => {
    const p = problemasDoLivro(
      [{ caminho: `${QUARENTENA}x.png`, autor: 'Alguém', fonte: 'lcp', licenca: 'GPL-3.0-only', derivadoDe: [] }],
      new Set([`${QUARENTENA}x.png`]),
    );
    expect(p.some((s) => s.startsWith('braço errado'))).toBe(true);
  });

  it('⚠️ [Interface] o `LICENSES.md` nomeia o braço e aponta para a quarentena', () => {
    // Sem este caso o ficheiro que um advogado lê pode divergir do que o gate afirma — e é o ficheiro que
    // o pedido `g` do requerimento manda constar dos autos.
    const txt = readFileSync(join(RAIZ, 'docs/LICENSES.md'), 'utf8');
    expect(txt, 'o LICENSES.md não nomeia o LCP').toContain('Liberated Pixel Cup');
    expect(txt, 'o LICENSES.md não nomeia o braço CC BY-SA 3.0').toContain('CC BY-SA 3.0');
    expect(txt.toLowerCase(), 'o LICENSES.md não diz que o LCP vive em quarentena').toContain('quarentena');
  });

  it('⚠️ [Interface] o `CREDITS.md` APONTA para o livro-razão — senão a atribuição fica achável só por quem já sabe', () => {
    // O ADR-0107 §4 diz que a atribuição viaja para o `CREDITS.md`. Ela não CABE lá em prosa (é por recurso, e
    // cresce com o catálogo), então o que viaja é o apontador — e um apontador que ninguém verifica é como não
    // o ter: quem procura os autores abre o CREDITS, não a árvore de arte.
    const txt = readFileSync(join(RAIZ, 'docs/CREDITS.md'), 'utf8');
    expect(txt, 'o CREDITS.md não aponta para o livro-razão do LCP').toContain('art/lcp/ATTRIBUTION.csv');
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Oito, cada uma aplicada por script a ficheiro e com contagem de ocorrencias (=1 nas oito).
//   · tirando a guarda do AUTOR VAZIO -> reprova "um recurso SEM AUTOR". E a mutacao que mais interessa
//     depois da 2: um recurso sem autor conhecido nao e um recurso mal documentado, e um recurso que NAO
//     PODE ENTRAR — a atribuicao e condicao de uso nos dois bracos da licenca.
//   · ⚠️ tirando a guarda da MISTURA -> reprova "derivado de FORA da quarentena". E a que carrega o ADR
//     inteiro: sem ela, um recurso do LCP podia declarar-se feito a partir do `assets-ref/`, e o share-alike
//     alcancaria a arte da autora — que nao esta neste repositorio para poder discordar.
//   · tirando a guarda do ORFAO -> reprova o caso do orfao. Sem ele o livro apodrece: descreveria recursos
//     que ja nao existem e pareceria maior do que e. E o mesmo buraco que o gate da superficie publica teve.
//   · tirando a guarda do BRACO -> reprova "o braco GPL-3.0 reprova aqui". O ADR-0107 §2 ESCOLHEU entre dois
//     bracos defensaveis, e uma escolha que nao se consegue conferir nao e uma escolha, e uma preferencia.
//   · tirando a guarda FORA DA QUARENTENA -> reprova o caso homonimo. A quarentena so e mecanismo enquanto
//     for o unico sitio; uma entrada a apontar para `app/public/` seria a excepcao que a desfaz.
//   · ⚠️ MATANDO A VARREDURA (`ficheirosDe` a devolver sempre `[]`) -> reprova o caso do VACUO, e so ele.
//     E a prova de que este ficheiro nao morre em silencio: hoje a arvore de recursos esta VAZIA — o LCP foi
//     decidido e ainda nao entrou —, entao sem este caso os outros passariam por nao terem nada que examinar.
//     E o mesmo caso que apanha a armadilha do `.gitignore` num clone limpo.
//   · `naoDeclarados` a devolver sempre `[]` -> reprova o caso do FICHEIRO SEM ENTRADA. ⚠️ Reprova o caso do
//     FIXTURE e nao o da arvore real, e a diferenca esta escrita no proprio caso: com zero recursos, o caso
//     da arvore real passa por vacuo e esta mutacao sobreviveria a ele. O fixture e o que da corpo a regra
//     antes de haver o primeiro ficheiro.
//   · trocando «Liberated Pixel Cup» por outro nome no `docs/LICENSES.md` -> reprova o caso do LICENSES.
//     Aplicada ao FICHEIRO DE VERDADE e restaurada por copia (nunca por `git checkout`, que levaria junto o
//     que nao esta commitado), com `git diff --stat` vazio a confirmar a repos.
//   · trocando o caminho do livro no `docs/CREDITS.md` -> reprova o caso do apontador (2 ocorrencias: a
//     ligacao markdown escreve o caminho duas vezes). Tambem no ficheiro de verdade, tambem restaurada por
//     copia. Sem este caso, o `CREDITS.md` podia apontar para lado nenhum e a atribuicao ficaria achavel so
//     por quem ja soubesse onde ela esta — que e toda a gente menos quem precisa dela.
//
// ⚠️ O QUE NENHUMA MUTACAO CONSEGUE PROVAR HOJE, e fica dito em vez de escondido: que a arvore REAL de
// recursos obedece as regras. Ela esta vazia. Os casos que a examinam sao verdadeiros e inuteis ate o
// primeiro ficheiro chegar; o que os segura ate la e o caso do VACUO, que reprova se a varredura morrer.
