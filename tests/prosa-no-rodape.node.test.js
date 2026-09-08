// SPDX-License-Identifier: AGPL-3.0-or-later
// UM PAINEL QUE RE-RENDERIZA TEM DE MOVER A PROSA OUTRA VEZ — a regra do `CLAUDE.md` §4, que já falhou.
//
// ========================= A REGRA, E POR QUE ELA PRECISA DE GATE =========================
// A decisão do Dev de 2026-08-25 põe a explicação no RODAPÉ e não dentro das linhas: «Em vez de colocar no
// rodapé como dica, está explicando item a item dentro do menu e transformando-os em manuais!». O mecanismo é
// o `fillExplain` do `ui/settings-panel`, que MOVE o `.opt-hint` de dentro de cada linha para o rodapé.
//
// ⚠️ E ELE CORRE UMA VEZ, quando o overlay é frontalizado. Um painel que RECONSTRÓI as suas linhas devolve-as
// com a prosa lá dentro — então a explicação passa a aparecer DUAS VEZES, no rodapé e sob o rótulo, a partir
// do primeiro clique. É o defeito que a issue #109 já consertou no `settings-visual` e no `settings-empathy`.
//
// 📌 HOJE A REGRA ESTÁ HONRADA nos oito painéis, e é por isso que este ficheiro é um crivo e não um conserto:
// o que ele impede é o NONO. A regra vive num comentário de cada ctx e no `CLAUDE.md`; enquanto for lembrada à
// mão, ela falha exactamente como falhou — e o modo de falhar é silencioso, porque nada quebra: a criança só
// lê a mesma frase duas vezes, numa tela que ela abriu para perceber uma coisa.
//
// ⚠️ E O QUE ELE NÃO APANHA, dito para ninguém confiar demais: ele prova que a CHAMADA existe, não que ela
// está em todos os caminhos de render de um painel com vários. Um painel com dois `render` e a chamada só num
// deles passa. O que apanharia isso é um caso de comportamento por painel — e esses vivem nos ficheiros de
// cada um, onde o #109 os deixou.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const UI = fileURLToPath(new URL('../app/js/ui/', import.meta.url));

/**
 * ⚠️ O `settings-panel` É A CASCA e fica de fora: é ELE quem oferece o `fillExplain`. Exigir que o provedor
 * chame o que ele próprio provê seria o gate a não perceber de que lado da fronteira está.
 */
const A_CASCA = 'settings-panel.ts';

const paineis = () => readdirSync(UI)
  .filter((n) => n.startsWith('settings-') && n.endsWith('.ts') && n !== A_CASCA);

const fonte = (n) => readFileSync(join(UI, n), 'utf8');
/**
 * Linhas de CÓDIGO: um comentário que explica a regra não é a chamada que a cumpre.
 *
 * ⚠️ E O COMENTÁRIO DE FIM DE LINHA TAMBÉM SAI, o que a primeira versão não fazia. Ela só descartava linhas
 * COMEÇADAS por `//`, e cada ctx desta engine explica a regra do `fillExplain` em prosa — um `const x = 1; //
 * ver fillExplain(card)` faria um painel passar por cumprir uma coisa que ele só menciona. Foi o caso de
 * vivacidade deste ficheiro que o apanhou, e essa é a razão de ele existir.
 *
 * 📌 O `[^:]` antes das duas barras poupa `https://…`: um endereço dentro de uma string não é um comentário, e
 * cortá-lo ali partiria a linha ao meio sem que nada dissesse porquê.
 */
const codigo = (n) => fonte(n).split(/\r?\n/)
  .filter((ln) => !/^\s*(\/\/|\*|\/\*)/.test(ln))
  .map((ln) => ln.replace(/(^|[^:])\/\/.*$/, '$1'))
  .join('\n');

const RECONSTROI = /\.innerHTML\s*=|function render\b|render\s*\(\s*\)\s*[:{]/;
const CHAMA = /\bfillExplain\s*(\?\.)?\(/;

describe('CLAUDE.md §4 · a prosa fica no rodapé, também depois de re-renderizar', () => {
  it('🎯 [Zero] todo painel que RECONSTRÓI linhas volta a mover a prosa', () => {
    const faltam = paineis().filter((n) => {
      const c = codigo(n);
      return RECONSTROI.test(c) && !CHAMA.test(c);
    });
    expect(
      faltam,
      'painel que reconstrói as suas linhas sem voltar a chamar `fillExplain`. O `.opt-hint` volta para DENTRO '
      + 'da linha no primeiro clique e a criança lê a mesma frase duas vezes — no rodapé e sob o rótulo. É o '
      + 'defeito que a issue #109 já consertou uma vez, e ele não quebra nada: só duplica.',
    ).toEqual([]);
  });

  it('⚠️ [Interface] e a varredura está VIVA: acha os painéis e vê a casca do lado certo', () => {
    // Um crivo que lesse a pasta errada, ou cuja regex morresse, ficaria verde por não ter nada que examinar.
    const lista = paineis();
    expect(lista.length, 'a varredura não achou painel nenhum').toBeGreaterThan(5);
    expect(lista, 'a casca entrou na lista — ela PROVÊ o `fillExplain`, não o consome').not.toContain(A_CASCA);
    // o detector reconhece as duas metades quando elas existem
    expect(RECONSTROI.test('el.innerHTML = html;')).toBe(true);
    expect(CHAMA.test('ctx.fillExplain?.(card);')).toBe(true);
    // ⚠️ E É POR ISTO QUE OS COMENTÁRIOS SAEM ANTES: um que CITE a chamada — e cada ctx desta engine cita —
    // casaria com o detector, e um painel que só explicasse a regra sem a cumprir passaria por a cumprir.
    expect(CHAMA.test('// lembre-se de chamar `fillExplain(card)` a cada render')).toBe(true);
    expect(codigo(A_CASCA).includes('//'), 'a limpeza de comentários deixou passar uma linha de comentário').toBe(false);
  });

  it('📌 [Right] a casca continua a OFERECER o mecanismo — sem ela a regra não tem como ser cumprida', () => {
    // Se o `fillExplain` sair do `settings-panel`, os oito painéis passam a chamar uma coisa que não existe e
    // este crivo continuaria verde. É o caso que prende o outro lado da fronteira.
    expect(fonte(A_CASCA), 'a casca deixou de oferecer o `fillExplain`').toMatch(/fillExplain/);
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// (preenchido pelo arnes)
