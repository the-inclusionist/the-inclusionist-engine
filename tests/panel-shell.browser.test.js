// SPDX-License-Identifier: AGPL-3.0-or-later
// A CASCA DO PAINEL É CONSTRUÍDA, E POR ISSO O CONTRATO DEIXA DE SER INVISÍVEL (#62, #115, achado 6 da #63).
//
// ========================= O QUE ISTO IMPEDE =========================
// O segundo consumidor mediu e escreveu: «o ctx do painel pede `$` e `store`; o que ele REALMENTE exige é
// que o documento contenha `#typo`, `#typo-list`, `#typo-preview`, `#typo-close` e `#typo-reset`. Nada no
// tipo diz isso — descobre-se por tentativa, e o modo de falhar é o pior possível: **o painel abre vazio,
// sem erro**.»
//
// Cada `ui/settings-*` preenche o interior; o exterior vinha do `app/index.html`, que saiu com o cartucho
// (#111). Desde então a engine exigia cinco ids por painel e não os declarava em lado nenhum.
//
// ⚠️ E A REGRA DE MENU DO `CLAUDE.md` §4 PASSA A SER CONSTRUÇÃO EM VEZ DE LEMBRETE. A introdução de um painel
// vai no `data-explain-idle` do cartão, nunca num `<p>` de prosa no topo — e a casca não tem por onde receber
// um `<p>`. Era o que a #62 mandava editar em seis blocos de markup; o markup saiu e a regra ficou sem alvo.
//
// ⚠️ Este é um teste de BROWSER porque a casca é uma árvore de DOM: o project `node` não distingue «criou o
// nó» de «criou o nó no sítio certo», e o defeito que ela conserta é exactamente de estrutura.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect, beforeEach } from 'vitest';
import { mountShell, shellIds } from '../app/js/ui/panel-shell.js';

const ctx = {
  find: (sel) => document.querySelector(sel),
  create: (tag) => document.createElement(tag),
};

const SPEC = {
  id: 'audio',
  title: 'Acessibilidade auditiva',
  listLabel: 'Ajustes de som',
  resetLabel: 'Restaurar padrões deste menu',
  closeLabel: 'Fechar',
};

beforeEach(() => { document.body.innerHTML = ''; });

describe('ui/panel-shell · a casca declara o que exigia em silêncio', () => {
  it('[Right] monta os cinco ids que o painel precisa, e devolve-os', () => {
    const casca = mountShell(ctx, SPEC);
    document.body.appendChild(casca.overlay);
    const ids = shellIds('audio');
    for (const [papel, id] of Object.entries(ids)) {
      expect(document.getElementById(id), `${papel} (#${id}) não foi montado`).not.toBe(null);
    }
    expect(casca.ids).toEqual(ids);
  });

  it('🔴 [Right] «Voltar» is the FIRST control, and no close button comes after the rows (ADR-0158)', () => {
    // The Dev, on a panel ending in «Restore» and «Close»: «Não pode haver botão "close" no final, mas sim o
    // primeiro item deve ser o botão "voltar"». The order a keyboard walks is the DOM order, so the DOM order is
    // what this case reads.
    const casca = mountShell(ctx, SPEC);
    document.body.appendChild(casca.overlay);
    const item = document.createElement('button');
    casca.list.appendChild(item);
    const botoes = [...casca.card.querySelectorAll('button')];
    expect(botoes[0], 'the way out is not item 1').toBe(casca.close);
    expect(botoes.at(-1), 'something comes after the reset — a close at the bottom again?').toBe(casca.reset);
    expect(botoes.indexOf(casca.close)).toBeLessThan(botoes.indexOf(item));
  });

  it('⚠️ [Right] o cartão é um diálogo NOMEADO pelo próprio título', () => {
    // O `aria-labelledby` a apontar para o `<h2>` é o que faz o leitor de tela anunciar QUAL painel abriu.
    // Sem ele a criança ouve «diálogo» e tem de adivinhar em qual dos oito entrou.
    const { card, overlay } = mountShell(ctx, SPEC);
    document.body.appendChild(overlay);
    expect(card.getAttribute('role')).toBe('dialog');
    expect(card.getAttribute('aria-modal')).toBe('true');
    const rotulo = card.getAttribute('aria-labelledby');
    expect(document.getElementById(rotulo)?.textContent).toBe(SPEC.title);
  });

  it('⚠️ [Right] a lista é um GRUPO com nome — e nasce vazia, porque o interior é do painel', () => {
    const { list: lista } = mountShell(ctx, SPEC);
    expect(lista.getAttribute('role')).toBe('group');
    expect(lista.getAttribute('aria-label')).toBe(SPEC.listLabel);
    expect(lista.children.length, 'a casca desenhou conteúdo que é do settings-*').toBe(0);
  });

  it('⚠️ [Boundary] ZERO prosa no topo — a introdução só cabe no `data-explain-idle`', () => {
    // O caso da #62. A casca não tem parâmetro para um parágrafo no topo, então a única forma de a
    // introdução existir é como texto de REPOUSO do rodapé — que é o que o `fillExplain` lê.
    const { card } = mountShell(ctx, { ...SPEC, intro: 'Ajuste como o jogo soa.' });
    expect(card.getAttribute('data-explain-idle')).toBe('Ajuste como o jogo soa.');
    expect(card.querySelectorAll('p').length, 'apareceu prosa no topo do cartão').toBe(0);
    // E o primeiro filho é o título: nada se intromete entre o cartão e o `<h2>`.
    expect(card.firstElementChild?.tagName).toBe('H2');
  });

  it('[Zero] sem introdução o atributo não existe — ausência é ausência, não cadeia vazia', () => {
    // Um `data-explain-idle=""` faria o `fillExplain` pôr uma região viva com texto vazio, que o leitor de
    // tela anuncia como nada. «Este painel não tem introdução» é uma resposta legítima.
    const { card } = mountShell(ctx, SPEC);
    expect(card.hasAttribute('data-explain-idle')).toBe(false);
  });

  it('⚠️ [Interface] o rótulo entra por `textContent` — markup de dicionário não vira markup', () => {
    // Um rótulo traduzido é dado de fora, e um dicionário de consumidor pode trazer o que quiser dentro.
    const { close: fechar } = mountShell(ctx, { ...SPEC, closeLabel: '<img src=x onerror=alert(1)>Fechar' });
    document.body.appendChild(document.createElement('div')).appendChild(fechar);
    expect(fechar.querySelector('img'), 'o rótulo foi ANALISADO como marcação').toBe(null);
    expect(fechar.textContent).toContain('Fechar');
  });

  it('⚠️ [Exercise] montar duas vezes NÃO duplica o véu — a grade de telas remonta', () => {
    // A raiz remonta os painéis quando a contagem de jogadores muda. Dois véus com o mesmo id é o defeito
    // que o `.pause-menu[hidden]` já pagou noutra camada: dois nós, um deles invisível ao `querySelector`.
    document.body.appendChild(mountShell(ctx, SPEC).overlay);
    const segunda = mountShell(ctx, { ...SPEC, title: 'Outro título' });
    expect(document.querySelectorAll('#audio').length).toBe(1);
    expect(document.querySelectorAll('#audio-title').length).toBe(1);
    expect(document.getElementById('audio-title').textContent).toBe('Outro título');
    expect(segunda.overlay).toBe(document.getElementById('audio'));
  });

  it('[Right] a casca nasce ESCONDIDA — um painel que abre sozinho é um painel que interrompe', () => {
    expect(mountShell(ctx, SPEC).overlay.hidden).toBe(true);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · tirando o `aria-labelledby` do cartão → "[Right] o cartão é um diálogo NOMEADO" reprova. É o atributo
//     que faz a criança ouvir QUAL painel abriu em vez de só «diálogo».
//   · trocando `card.setAttribute('data-explain-idle', …)` por um `<p>` acrescentado ao cartão → "[Boundary]
//     ZERO prosa no topo" reprova nas duas asserções. É a #62 aferida em vez de editada.
//   · pondo `if (spec.introducao !== undefined)` no lugar de `if (spec.introducao)` → "[Zero] sem introdução"
//     continua verde (o campo é `undefined`), mas passar `introducao: ''` produziria o atributo vazio. ⚠️
//     Registado como mutação que NÃO falha: o caso mede a ausência do campo, não a cadeia vazia, e fechar
//     esse buraco exigiria um caso próprio — que não escrevi porque nenhum chamador passa cadeia vazia hoje.
//   · trocando `textContent` por `innerHTML` no botão → "[Interface] o rótulo entra por textContent" reprova
//     com o `<img>` montado.
//   · tirando o `while (overlay.firstChild)` da remontagem → "[Exercise] montar duas vezes" reprova com dois
//     `#audio-title` no documento.
//   · (2026-09-12, ADR-0158) «Voltar» appended AFTER the list → the «Voltar is the FIRST control» case is red; and
//     the close button put back into `.overlay__actions` after the reset → red too, by the last-button assertion.
