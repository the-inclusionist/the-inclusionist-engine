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

  it('⚠️ [Interface] o retrato guarda os oito que já saíram — a medição não se perde', () => {
    // As oito constantes de `core/constants.ts` saíram ANTES deste gate existir, e o retrato foi tirado
    // depois. Este caso afirma que elas continuam fora: se alguém as trouxer de volta sem pensar, o gate
    // acima não diria nada (acrescentar não reprova), e a `Breaking-Changes.md` passaria a mentir.
    const FORAM = ['JUMP_BASE', 'TUNE', 'COIN_TARGET', 'ehAgua', 'ehEscada', 'ehPortao', 'ehChave', 'ehSecreto'];
    const constantes = new Set(arvore['core/constants.ts'] ?? []);
    for (const n of FORAM) {
      expect(constantes.has(n), `${n} voltou a core/constants.ts; a doc de quebras precisa de ser corrigida`).toBe(false);
    }
    // E as duas que FICARAM ficaram por uma razão de acessibilidade, não por simetria.
    expect(constantes.has('ehPerigo'), 'ehPerigo saiu: `isSolidType` depende dele no modo cego').toBe(true);
    expect(constantes.has('ehTrampolim'), 'ehTrampolim saiu: `isSolidType` depende dele no modo cadeirante').toBe(true);
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
