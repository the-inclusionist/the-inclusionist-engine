// SPDX-License-Identifier: AGPL-3.0-or-later
// AS HISTÓRIAS DE UTILIZADOR NÃO PODEM APONTAR PARA FICHEIROS QUE JÁ NÃO EXISTEM (issue #3).
//
// ========================= O QUE ESTE FICHEIRO IMPEDE, E FOI MEDIDO =========================
// Em 2026-09-07 varri o quadro de issues à procura de corpos que citassem caminhos inexistentes. Três
// apontavam para ficheiros que tinham saído com o cartucho (#111) — a #62 mandava editar seis linhas de um
// `app/index.html` que já não existe, a #77 citava um `app/js/game/progress.ts` que mudou de repositório, e a
// #14 apontava um plano que fora migrado de pasta. **Nada disse.**
//
// O `User-Stories.md` é o documento com maior densidade de caminhos deste repositório, e o que a #3 lhe pede
// — *«mark which stories are already implemented; audit against app/js»* — é exactamente a afirmação que
// apodrece primeiro. Uma história marcada ✅ que nomeia um módulo apagado não é uma imprecisão: é o documento
// a dizer que uma coisa está feita e guardada quando o guarda saiu.
//
// ⚠️ O QUE ELE NÃO AFERE, e é honesto dizê-lo: se a história é VERDADE. Que `ui/webcam.ts` exista não prova
// que uma criança joga com os olhos. Isto afere o que uma máquina pode aferir — que a prova apontada existe —
// e é por isso que a coluna ✅ exige um GATE e não só um módulo: quem quiser saber se a história se cumpre
// segue para o teste nomeado, que é onde a pergunta tem resposta.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = process.cwd();
const REL = join('docs', '1-Discovery', 'User-Stories.md');
const DOC = readFileSync(join(RAIZ, REL), 'utf8');

/** Um caminho do repositório citado entre crases. `package.json` conta; `../educational/` não é ficheiro. */
const RE_CAMINHO = /`((?:app|tests|scripts|docs)\/[A-Za-z0-9_\-./]+\.[a-z]+|package\.json)`/g;

/**
 * As histórias: itens de lista que trazem um dos quatro marcadores de estado.
 *
 * ⚠️ UMA HISTÓRIA É UM ITEM, NÃO UMA LINHA, e a primeira versão deste ficheiro tratava-a como linha. As
 * histórias estão quebradas a 110 colunas, então o marcador ⬜ fica na primeira linha e o `**#92**` que o
 * justifica fica na segunda — e o caso da issue reprovou as SETE histórias por fazer, todas por engano meu.
 * Juntar as continuações (linhas indentadas) antes de dividir é o que faz o crivo ver o item inteiro.
 */
const MARCADORES = ['✅', '🟡', '⬜', '🎮'];
/**
 * ⚠️ O MARCADOR TEM DE ABRIR A LINHA, e não apenas aparecer nela. A primeira versão aceitava qualquer item
 * que CONTIVESSE um marcador, e apanhou uma linha da secção «Status» que diz «três delas agora ✅ com o gate
 * nomeado» — prosa sobre as histórias lida como história. Um crivo largo não erra por excesso de zelo: ele
 * acusa texto que nunca prometeu nada.
 */
const RE_HISTORIA = new RegExp('^- (?:' + MARCADORES.join('|') + ') ');
const historias = DOC
  .replace(/\r?\n\s{2,}(?=\S)/g, ' ')  // continuação de item de lista → mesma linha
  .split(/\r?\n/)
  .filter((l) => RE_HISTORIA.test(l));

/**
 * As histórias ✅ que se provam SÓ com gate, porque o que elas afirmam é uma AUSÊNCIA.
 *
 * «A engine não fala o vocabulário do meu jogo» não tem módulo: o sujeito dela é não haver um. Exigir-lhe um
 * módulo obrigaria a inventar uma citação, e uma citação inventada é pior do que uma excepção declarada.
 * Esta lista só encolhe, e o caso `[Interface]` abaixo impede-a de crescer para acomodar preguiça.
 */
const PROVAM_SE_POR_AUSENCIA = [
  'not speak my game',
];

/** Os caminhos citados numa linha. */
const caminhosDe = (linha) => [...linha.matchAll(RE_CAMINHO)].map((m) => m[1]);

describe('User-Stories.md · o que ele afirma sobre o código tem de existir (#3)', () => {
  it('[Zero] o crivo está mesmo a ler histórias — senão tudo passaria por vacuidade', () => {
    // O modo de falha deste ficheiro é o regex casar zero linhas e todos os casos ficarem verdes sobre nada.
    expect(DOC.length).toBeGreaterThan(3000);
    expect(historias.length, 'nenhuma linha de história reconhecida').toBeGreaterThanOrEqual(25);
    const comCaminho = historias.filter((l) => caminhosDe(l).length > 0);
    expect(comCaminho.length, 'nenhuma história cita caminho').toBeGreaterThanOrEqual(20);
  });

  it('⚠️ [Right] todo caminho citado EXISTE', () => {
    const mortos = [];
    for (const linha of historias) {
      for (const c of caminhosDe(linha)) {
        if (!existsSync(join(RAIZ, c))) mortos.push(`${c}  (em: ${linha.slice(0, 70)}…)`);
      }
    }
    expect(mortos, 'história a apontar para ficheiro inexistente:\n  ' + mortos.join('\n  ')).toEqual([]);
  });

  it('⚠️ [Right] toda história ✅ nomeia um MÓDULO e um GATE — a marca de feito custa prova', () => {
    // A regra que dá sentido ao ✅. Sem ela, «feito e guardado» seria uma opinião, e o documento voltaria a
    // ser aquilo que a #3 encontrou: uma lista com a nota «many of the seed items above are already
    // implemented; audit against code when formalizing», que ninguém auditou durante um mês.
    const fracas = [];
    for (const linha of historias.filter((l) => l.startsWith('- ✅'))) {
      const cs = caminhosDe(linha);
      const temModulo = cs.some((c) => c.startsWith('app/js/') || c === 'package.json');
      const temGate = cs.some((c) => /^tests\/.+\.test\.js$/.test(c));
      const porAusencia = PROVAM_SE_POR_AUSENCIA.some((m) => linha.includes(m));
      if (!temGate || (!temModulo && !porAusencia)) {
        fracas.push(`${linha.slice(0, 80)}…  (módulo: ${temModulo}, gate: ${temGate})`);
      }
    }
    expect(fracas, 'história ✅ sem módulo ou sem gate:\n  ' + fracas.join('\n  ')).toEqual([]);
  });

  it('[Interface] a lista de excepções não guarda entrada morta nem cresce sem razão', () => {
    // A metade que faz a excepção encolher: uma entrada que já não corresponde a história nenhuma — porque a
    // história mudou de texto ou ganhou módulo — é uma folga aberta onde cabe a próxima preguiça.
    const orfas = PROVAM_SE_POR_AUSENCIA.filter((m) => !historias.some((l) => l.startsWith('- ✅') && l.includes(m)));
    expect(orfas, 'excepção que já não descreve história nenhuma: ' + orfas.join(', ')).toEqual([]);
    expect(PROVAM_SE_POR_AUSENCIA.length, 'a excepção deixou de ser excepção').toBeLessThanOrEqual(2);
  });

  it('[Interface] toda história ⬜ nomeia a issue que a segue — dívida sem número é dívida perdida', () => {
    const semIssue = historias
      .filter((l) => l.includes('⬜'))
      .filter((l) => !/\*\*#\d+\*\*/.test(l))
      .map((l) => l.slice(0, 80) + '…');
    expect(semIssue, 'história por fazer e sem issue:\n  ' + semIssue.join('\n  ')).toEqual([]);
  });

  it('[Error] o crivo APANHA um caminho inventado — senão os casos acima não provam nada', () => {
    const falsa = '- ⬜ As a **player**, I want nothing. `app/js/core/nao-existe.ts` · **#1**';
    const mortos = caminhosDe(falsa).filter((c) => !existsSync(join(RAIZ, c)));
    expect(mortos).toEqual(['app/js/core/nao-existe.ts']);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · trocando `app/js/ui/webcam.ts` por `app/js/ui/webcam-x.ts` no documento → "[Right] todo caminho citado
//     EXISTE" reprova nomeando o ficheiro e a linha.
//   · tirando o gate de uma linha ✅ (ficando só o módulo) → "[Right] toda história ✅" reprova com
//     `(módulo: true, gate: false)`.
//   · tirando o `**#92**` de uma linha ⬜ → "[Interface] toda história ⬜" reprova.
//   · tirando a entrada de `PROVAM_SE_POR_AUSENCIA` → "[Right] toda história ✅" reprova na história da
//     fronteira, que é a única que se prova só com gate. É o caso que impede a excepção de ser apagada por
//     quem não perceba por que existe.
//   · trocando o `RE_CAMINHO` por um que não case nada → reprovam TRÊS: "[Zero]" («nenhuma história cita
//     caminho»), "[Right] toda história ✅" e "[Error] o crivo apanha um caminho inventado».
//     ⚠️ Esta é a que importa. Sem o `[Zero]`, um crivo partido deixaria "[Right] todo caminho EXISTE" verde
//     a medir um conjunto vazio — e esse é o caso principal do ficheiro. É o modo de falha silencioso que
//     este repositório já pagou com uma regex morta.
//
// ⚠️ E DUAS COISAS QUE ESTE GATE APANHOU EM SI MESMO, ao nascer, valem ficar escritas:
//   1. uma história é um ITEM de lista, não uma LINHA — as histórias estão quebradas a 110 colunas, e a
//      primeira versão reprovou as sete histórias ⬜ porque o `**#N**` delas estava na segunda linha;
//   2. o marcador tem de ABRIR a linha: a versão que aceitava «contém ✅» leu como história uma frase da
//      secção «Status» que fala SOBRE as histórias.
