// SPDX-License-Identifier: AGPL-3.0-or-later
// UM NOME NÃO SAI DO PACOTE SEM ALGUÉM DIZER QUE SAIU.
//
// ========================= O QUE ISTO EXISTE PARA APANHAR =========================
// Medido em 2026-09-07, comparando a superfície publicada em `v7.0.1` com a árvore: desde essa etiqueta
// saíram **33 módulos** e **8 constantes**, e o tipo `KeyScheme` fechou-se sobre catorze posições. Cinco
// commits marcaram-se quebrantes com `!` no assunto — e **nenhum** escreveu o rodapé `BREAKING CHANGE:`.
//
// ⚠️ A CONSEQUÊNCIA NÃO É DE ESTILO. O `CHANGELOG.md` deste repositório é gerado dos Conventional Commits, e
// a entrada da `v7.0.0` mostra o que ele consegue dizer quando os rodapés existem: parágrafos a dizer a quem
// consome o que tem de mudar. Sem eles, o que sobra é um assunto de uma linha — e um assunto não é migração.
// A `docs/6-DevOps-SRE/Breaking-Changes.md` teve de ser escrita depois do facto, a partir de uma medição,
// porque a informação não estava em lado nenhum.
//
// Este gate é para não haver «depois do facto» outra vez. Ele compara a árvore com um RETRATO committado e
// reprova quando um nome desaparece. Não impede a remoção: pede que ela seja DECLARADA — correr
// `node scripts/snapshot-public-surface.mjs` é a declaração, e a mensagem abaixo diz o resto.
//
// ⚠️ ACRESCENTAR NÃO REPROVA, e a assimetria é o desenho. Um nome novo é compatível para trás e um gate que
// exigisse igualdade seria empurrado a cada `export` inocente — que é como um teto «que só desce» acaba
// afrouxado. O que se proíbe é a única coisa que quebra alguém: **desaparecer**.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { superficieDe, RETRATO } from '../scripts/snapshot-public-surface.mjs';
import { formaDe, formaDoTexto, quebrasDeForma, RETRATO_FORMA } from '../scripts/shape-surface.mjs';

const RAIZ = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();
const retrato = JSON.parse(readFileSync(join(RAIZ, RETRATO), 'utf8'));
const arvore = superficieDe(join(RAIZ, 'app', 'js'));

const COMO_DECLARAR = [
  '',
  'Isto é uma MUDANÇA QUEBRANTE do pacote. Se for deliberada, faça as duas coisas:',
  '  1. escreva o rodapé `BREAKING CHANGE:` no commit, dirigido a quem tem de editar o código dele;',
  '  2. corra `node scripts/snapshot-public-surface.mjs` para declarar a remoção.',
  'E se houver mais de uma a caminho, veja `docs/6-DevOps-SRE/Breaking-Changes.md`: elas querem o MESMO major.',
].join('\n');

describe('a superfície pública do pacote só encolhe por declaração (docs/6-DevOps-SRE/Breaking-Changes.md)', () => {
  it('[Interface] o retrato e a árvore falam do mesmo repositório', () => {
    // Sem isto, um retrato vazio ou um caminho errado deixariam todos os casos abaixo verdes de graça.
    expect(Object.keys(retrato).length, 'o retrato está vazio; correu o script?').toBeGreaterThan(50);
    expect(Object.keys(arvore).length, 'a varredura não achou módulos').toBeGreaterThan(50);
    expect(arvore['core/contract.ts'], 'a varredura não vê o contrato').toBeTruthy();
  });

  it('⚠️ [Zero] NENHUM módulo saiu do pacote sem declaração', () => {
    const foram = Object.keys(retrato).filter((m) => !arvore[m]);
    expect(foram, 'módulos que o pacote publicava e já não publica:' + COMO_DECLARAR).toEqual([]);
  });

  it('⚠️ [Zero] NENHUM nome exportado desapareceu de um módulo que ficou', () => {
    const sumidos = [];
    for (const [m, nomes] of Object.entries(retrato)) {
      const agora = new Set(arvore[m] ?? []);
      if (!arvore[m]) continue; // o módulo inteiro é o caso acima; não contar duas vezes
      for (const n of nomes) if (!agora.has(n)) sumidos.push(`${m}  ${n}`);
    }
    expect(sumidos, 'nomes que o pacote publicava e já não publica:' + COMO_DECLARAR).toEqual([]);
  });

  it('[Right] acrescentar NÃO reprova — só desaparecer', () => {
    // A assimetria dita em prosa, afirmada em código: um nome que existe hoje e não está no retrato é
    // compatível para trás, e este caso existe para ninguém a «consertar» exigindo igualdade.
    const novos = [];
    for (const [m, nomes] of Object.entries(arvore)) {
      const antes = new Set(retrato[m] ?? []);
      for (const n of nomes) if (!antes.has(n)) novos.push(`${m} ${n}`);
    }
    expect(Array.isArray(novos), 'nomes novos são informação, não reprovação').toBe(true);
  });

  /*
   * 🔴 O RETRATO VIA UM NOME POR LINHA, e uma linha publica quantos quiser. Achado em 2026-09-21 ao medir o que os jogos
   * IMPORTAM da engine: `export const LOGICAL_W = 320, LOGICAL_H = 180, TILE = 16;` publica três nomes e o retrato guardava
   * um. 📏 Oito assim, e dois deles — `LOGICAL_H` e `TILE` — são importados pelo game-platformer e pelo pixi-15-puzzle:
   * apagá-los passava VERDE no crivo que existe justamente para reprovar quando um nome público desaparece.
   *
   * ⚠️ E O PAR QUE IMPEDE O CONSERTO DE EXAGERAR: um retrato que INVENTA um nome é pior do que um que perde, porque passa a
   * exigir para sempre algo que nenhum módulo tem. A primeira versão do conserto contava só parênteses e chavetas, e a
   * vírgula DENTRO de uma cadeia («'button:not([disabled]), select:not(…)'») publicou um export chamado `select`.
   */
  it('🔴 [Right] uma linha que declara vários nomes publica TODOS — e nenhuma vírgula de dentro de uma cadeia vira nome', () => {
    const constantes = new Set(arvore['core/constants.ts'] ?? []);
    for (const n of ['LOGICAL_W', 'LOGICAL_H', 'TILE']) {
      expect(constantes.has(n), `${n} é público e o retrato não o vê — apagá-lo passaria verde`).toBe(true);
    }
    const itens = new Set(arvore['ui/menu-items.ts'] ?? []);
    expect(itens.has('ITEM_SELECTOR')).toBe(true);
    expect(itens.has('select'), 'a vírgula de dentro do selector CSS virou um nome público que não existe').toBe(false);
  });

  it('⚠️ [Interface] o retrato guarda os oito que já saíram — a medição não se perde', () => {
    // As oito constantes de `core/constants.ts` saíram ANTES deste gate existir, e o retrato foi tirado
    // depois. Este caso afirma que elas continuam fora: se alguém as trouxer de volta sem pensar, o gate
    // acima não diria nada (acrescentar não reprova), e a `Breaking-Changes.md` passaria a mentir.
    // 🔴 SÃO ONZE DESDE 23/09, e as três últimas mudaram DE LADO neste mesmo caso: até aí ele EXIGIA que
    // `TILE_TYPES`, `isHazard` e `isTrampoline` ficassem, «por uma razão de acessibilidade e não por simetria» —
    // o `core/collision.isSolidType` torna perigo e trampolim sólidos no modo cego e no de cadeira de rodas.
    // Era verdade, e deixou de ser quando essa regra foi com a geometria que a consulta (ADR-0228): as três
    // ficaram sem leitor nenhum aqui. 📌 A engine continua a saber o que é perigo — pergunta o PAPEL ao
    // contrato, pelo `roleOf`; o que ela deixou de ter é uma tabela de NÚMEROS de tile.
    const FORAM = ['JUMP_BASE', 'TUNE', 'COIN_TARGET', 'ehAgua', 'ehEscada', 'ehPortao', 'ehChave', 'ehSecreto',
      'TILE_TYPES', 'isHazard', 'isTrampoline'];
    const constantes = new Set(arvore['core/constants.ts'] ?? []);
    for (const n of FORAM) {
      expect(constantes.has(n), `${n} voltou a core/constants.ts; a doc de quebras precisa de ser corrigida`).toBe(false);
    }
    // E o que FICA é a resolução lógica e a grade, que é o que qualquer jogo 2D em pixel partilha.
    expect(constantes.has('TILE'), 'a grade saiu: sem ela a engine não sabe desenhar em múltiplos inteiros').toBe(true);
  });
});

// ========================= A FORMA, QUE É A METADE QUE OS NOMES NÃO VEEM =========================
// ⚠️ MEDIDO EM 2026-09-08, comparando `v7.0.1` com a árvore: o gate dos nomes acha **32 módulos** que saíram
// e **8 constantes**, e os dois conjuntos NÃO SE TOCAM nos 23 que se seguem. Ele é cego a todos eles, porque
// em todos o nome exportado continua exactamente igual — o que mudou foi o que está DENTRO:
//
//   · `GameDeclaration.holdsAtOnce` entrou como obrigatório (é ele que faz os quatro jogos não compilarem);
//   · `PlayerBase.visual` idem; `Player.guideT` saiu;
//   · `SonarPlayer.viz`/`.guideT` e `SonarCtx.VIZ_BY_KEY` saíram, `SonarCtx.visaoComprometida` entrou;
//   · `IconStateSnapshot.viz` → `.visual`, e `PauseIconsCtx` ganhou dois campos obrigatórios;
//   · `PhaseView.pauseOverlayHidden` saiu; `SettingsVisualCtx.renderVizGroup` → `renderEixosVisuais`;
//   · e três ALIASES estreitaram: `KeyScheme` fechou-se sobre as catorze posições, `DrawPlayer` e
//     `PausePlayer` trocaram a fatia `'viz'` por `'visual'`.
//
// ⚠️ E A ASSIMETRIA AQUI É OUTRA. No gate dos nomes, acrescentar é sempre seguro. Aqui não: um membro
// OBRIGATÓRIO novo quebra toda a gente que constrói o tipo — foi o que o `holdsAtOnce` fez. Opcional passa em
// silêncio; obrigatório pede declaração, como pede a remoção.
describe('a FORMA dos tipos exportados também só muda por declaração', () => {
  const forma = JSON.parse(readFileSync(join(RAIZ, RETRATO_FORMA), 'utf8'));
  const formaArvore = formaDe(join(RAIZ, 'app', 'js'));

  it('[Interface] o retrato de forma e a árvore falam do mesmo repositório', () => {
    expect(Object.keys(forma).length, 'o retrato de forma está vazio; correu o script?').toBeGreaterThan(50);
    expect(Object.keys(formaArvore).length, 'a varredura não achou tipo nenhum').toBeGreaterThan(50);
    expect(formaArvore['core/contract.ts']?.['interface GameDeclaration'], 'a varredura não vê a declaração').toBeTruthy();
  });

  it('⚠️ [Zero] NENHUM tipo exportado mudou de forma sem declaração', () => {
    expect(quebrasDeForma(forma, formaArvore), 'a forma publicada mudou:' + COMO_DECLARAR).toEqual([]);
  });

  it('⚠️ [Right] um membro que SAI reprova — é a quebra que o gate dos nomes não vê', () => {
    const antes = { 'm.ts': { 'interface A': ['x', 'y'] } };
    const agora = { 'm.ts': { 'interface A': ['x'] } };
    expect(quebrasDeForma(antes, agora)).toEqual(['m.ts  interface A.y  SAIU']);
  });

  it('⚠️ [Right] um membro OBRIGATÓRIO novo reprova — foi o que o `holdsAtOnce` fez aos quatro jogos', () => {
    const q = quebrasDeForma({ 'm.ts': { 'interface A': ['x'] } }, { 'm.ts': { 'interface A': ['x', 'y'] } });
    expect(q).toEqual(['m.ts  interface A.y  ENTROU como obrigatório']);
  });

  it('[Right] um membro OPCIONAL novo NÃO reprova — é compatível para trás', () => {
    expect(quebrasDeForma({ 'm.ts': { 'interface A': ['x'] } }, { 'm.ts': { 'interface A': ['x', 'y?'] } })).toEqual([]);
  });

  it('⚠️ [Right] um opcional que passa a OBRIGATÓRIO reprova — quebra quem não o preenchia', () => {
    const q = quebrasDeForma({ 'm.ts': { 'interface A': ['x?'] } }, { 'm.ts': { 'interface A': ['x'] } });
    expect(q).toEqual(['m.ts  interface A.x  era opcional e passou a OBRIGATÓRIO']);
  });

  it('⚠️ [Right] um alias que ESTREITA reprova — é o caso do `KeyScheme`', () => {
    const q = quebrasDeForma(
      { 'm.ts': { 'type K': 'Record<string, string[]>' } },
      { 'm.ts': { 'type K': 'Record<Action, readonly string[] | null>' } },
    );
    expect(q).toHaveLength(1);
    expect(q[0]).toContain('mudou de forma');
  });

  it('[Right] um tipo que desaparece INTEIRO não é contado aqui — já é caso do gate dos nomes', () => {
    // O mesmo `continue` que o gate dos nomes tem, e pela mesma razão: contá-lo nos dois faria uma lista de
    // seis linhas parecer doze, e a segunda metade não diria nada que a primeira não tenha dito.
    expect(quebrasDeForma({ 'm.ts': { 'interface A': ['x'] } }, { 'm.ts': {} })).toEqual([]);
    expect(quebrasDeForma({ 'm.ts': { 'interface A': ['x'] } }, {})).toEqual([]);
  });

  it('⚠️ [Interface] o extractor lê membros de verdade — opcional, método, readonly e assinatura de índice', () => {
    // Sem este caso, um extractor que devolvesse listas vazias deixaria TODOS os casos acima verdes: duas
    // listas vazias não têm diferenças. É o caso do vácuo desta metade.
    const f = formaDoTexto([
      'export interface A {',
      '  readonly i: number;',
      '  topology: () => Topology;',
      '  LOGICAL_W?: number;',
      '  holdsAtOnce(): number;',
      '  [k: string]: unknown;',
      '}',
      'export type U = "a" | "b";',
    ].join('\n'));
    expect(f['interface A']).toEqual(['LOGICAL_W?', 'holdsAtOnce', 'i', 'topology']);
    expect(f['type U']).toBe('"a" | "b"');
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · apagando um `export` qualquer de `app/js/core/route.ts` → "[Zero] NENHUM nome exportado desapareceu"
//     reprova nomeando o módulo e o nome, com as duas instruções de como declarar.
//   · renomeando `app/js/core/route.ts` → "[Zero] NENHUM módulo saiu do pacote" reprova com o caminho antigo,
//     e o caso dos nomes NÃO reprova junto — o `continue` existe para o mesmo desaparecimento não ser
//     contado duas vezes, que é o que faria uma lista de 6 linhas parecer 60.
//   · devolvendo `export const TUNE = …` a `core/constants.ts` → "[Interface] o retrato guarda os oito"
//     reprova. É a única forma de o gate falar de uma remoção ANTERIOR ao retrato, e é por isso que ela está
//     escrita por extenso em vez de derivada.
//   · esvaziando o `public-surface.json` para `{}` → "[Interface] o retrato e a árvore" reprova. Sem ele os
//     dois casos `[Zero]` ficariam verdes por não haver nada a comparar.
//
// ========================= MUTAÇÕES DA METADE DA FORMA =========================
// Seis, aplicadas por script a ficheiro e com contagem de ocorrências (=1 nas seis). ⚠️ As duas primeiras
// são contra a ÁRVORE DE VERDADE e não contra fixtures — o gate apanha uma quebra de forma em código real.
//   · renomeando `holdsAtOnce(): number` no `core/contract.ts` → "[Zero] NENHUM tipo mudou de forma" reprova.
//     ⚠️ E o gate dos NOMES não diz nada: `GameDeclaration` continua exportada com o mesmo nome. É a
//     demonstração da cegueira que esta metade existe para tapar.
//   · tornando `SonarCtx.LOGICAL_W?` obrigatório → reprova por "era opcional e passou a OBRIGATÓRIO". Um
//     campo que já era `@deprecated` e opcional a fechar-se quebraria quem nunca o preencheu.
//   · matando o extractor de membros → reprovam DOIS, e o segundo é o do vácuo: sem ele, duas listas vazias
//     não têm diferenças e todos os casos de forma passariam por não terem nada que comparar.
//   · tirando a regra do MEMBRO OBRIGATÓRIO NOVO → reprova o caso homónimo. É a regra que separa este gate
//     do dos nomes: lá acrescentar é sempre seguro, aqui acrescentar obrigatório quebra quem constrói.
//   · tirando a comparação de ALIAS → reprova o caso do `KeyScheme`. Sem ela, um estreitamento de união
//     passa — e foi um estreitamento de união que o §3 desta doc teve de descrever à mão.
//   · tirando a regra do OPCIONAL→OBRIGATÓRIO → reprova o caso homónimo.
