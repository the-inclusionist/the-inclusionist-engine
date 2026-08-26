// SPDX-License-Identifier: AGPL-3.0-or-later
// A PAUSA VIRA SETE ITENS, E A ORDEM É A DECISÃO — item 5 do ADR-0044.
//
// ========================= O QUE FOI MEDIDO, E POR QUE MUDA =========================
// O cartão de pausa tinha 22 paradas em UMA tela, em dois blocos com dois modelos de interação: dez
// alternadores só de emoji (`role="group"`) e doze itens de palavra (`role="menu"`), com um `<h2>` no meio.
//
// Os alvos de toque não eram o problema — os ícones já tinham 44×44. O problema era ORDEM e VOLUME: `resume`,
// que é A SAÍDA, era a 11ª parada do cartão, porque os dez ícones vinham antes na ordem de leitura. Uma
// criança que pausa e não enxerga varria dez alternadores e um cabeçalho antes de achar "Continuar".
//
// Agora a lista raiz tem SETE itens, e a ordem é decisão e não arranjo:
//
//   resume PRIMEIRO   — a saída é para o que serve uma pausa. Menu de onde não se sai é armadilha, e a
//                       armadilha custa mais caro para quem não a enxerga.
//   quit ÚLTIMO       — é o desfecho menos desejado de pausar. E como a lista é ANEL (item 1), UMA tecla
//                       para CIMA a partir de `resume` chega nele: longe na leitura, perto no dedo.
//
// Os sete painéis de ajuste desceram para um SUBMENU, e ele obedece à mesma regra: a saída ("Voltar") é o
// primeiro item, não o último.
//
// ========================= UM MENU POR TELA, E POR QUE ISSO IMPORTA AQUI =========================
// As duas listas existem no markup ao mesmo tempo, mas só UMA fica visível — a outra carrega `hidden`, que a
// tira da árvore de acessibilidade inteira. É o que permite que "o que acontece no fim da lista" tenha UMA
// resposta: o anel dá a volta dentro da lista visível, e nunca atravessa para a outra.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { screenPauseMarkup, PM_ITENS_VISIVEIS } from '../app/js/ui/pause-icons.js';
import { PM_BTNS, PM_OPTIONS_BTNS } from '../app/js/ui/activities-menu.js';
import { t } from '../app/js/core/i18n.js';

const SEM_DIN = () => null;
const markup = () => screenPauseMarkup({
  player: 0, numPlayers: 1, pmButtons: PM_BTNS, optionsButtons: PM_OPTIONS_BTNS, dynLabel: SEM_DIN, t: (k) => k,
});

/** Os `data-act` de uma lista, na ordem em que o markup os põe. */
function atos(html, sub) {
  const bloco = html.match(new RegExp('<div class="pause-menu"[^>]*data-sub="' + sub + '"[^>]*>([\\s\\S]*?)</div>'));
  expect(bloco, 'a lista `' + sub + '` sumiu do markup').toBeTruthy();
  return [...bloco[1].matchAll(/data-act="([^"]+)"/g)].map((m) => m[1]);
}

describe('menu de pausa · sete itens na raiz, os ajustes num submenu', () => {
  it('[Right] a lista raiz é EXATAMENTE os sete itens da decisão, nessa ordem', () => {
    expect(PM_BTNS.map((b) => b.act)).toEqual(
      ['resume', 'acessibilidade', 'addplayer', 'options', 'ajuda', 'print', 'quit'],
    );
  });

  it('[Right] a saída é o PRIMEIRO item e `quit` é o ÚLTIMO', () => {
    // Escrito à parte do caso acima de propósito: a lista pode ganhar ou perder um item do meio um dia, e
    // essas duas pontas são o que NÃO pode mudar sem reabrir o ADR-0044.
    const acts = atos(markup(), 'raiz');
    expect(acts[0], 'a saída deixou de ser a primeira parada — é a armadilha que o ADR-0044 desfaz').toBe('resume');
    expect(acts[acts.length - 1], '`quit` deixou de ser o último').toBe('quit');
    expect(acts).toHaveLength(7);
  });

  it('[Right] o submenu de opções tem os SETE painéis, e a saída dele também vem primeiro', () => {
    const acts = atos(markup(), 'opcoes');
    expect(acts[0], 'o "Voltar" do submenu tem de ser a primeira parada, como `resume` na raiz').toBe('pmback');
    expect(acts.slice(1)).toEqual(['caa', 'empatia', 'audio', 'motora', 'tipo', 'visual', 'anim']);
  });

  it('[Right] só UMA lista é visível — a outra sai da árvore de acessibilidade', () => {
    // `hidden` e não `display:none` numa classe: `hidden` tira o ramo inteiro da árvore de acessibilidade,
    // que é o que faz "um menu por tela" ser verdade para quem escuta, e não só para quem vê.
    const html = markup();
    expect(html).toContain('data-sub="raiz"');
    expect(html).toMatch(/<div class="pause-menu"[^>]*data-sub="opcoes"[^>]*hidden/);
    expect(html).not.toMatch(/<div class="pause-menu"[^>]*data-sub="raiz"[^>]*hidden/);
  });

  it('[Interface] o seletor de itens navegáveis IGNORA a lista escondida', () => {
    // Sem isto o anel daria a volta atravessando para a lista invisível, e a criança ouviria itens de um menu
    // que não está na tela. É a única linha que impede as duas listas de virarem uma só para a navegação.
    expect(PM_ITENS_VISIVEIS).toContain(':not([hidden])');
  });

  it('[Right] o NOME ACESSÍVEL do diálogo passa pelo dicionário', () => {
    // MEDIDO no jogo construído com `<html lang="en">`: o título visível dizia "Paused" e o nome acessível do
    // diálogo dizia "Menu de pausa do jogador 1". Quem enxerga lia em inglês; quem escuta recebia o menu
    // anunciado em português.
    //
    // É a MESMA assimetria do item 4 do ADR-0044, um nível acima: lá a legenda existia para quem vê e era
    // escondida de quem escuta; aqui o rótulo é traduzido para quem vê e cru para quem escuta. O canal de
    // acessibilidade recebendo tratamento pior que o visual é o padrão que este registro existe para quebrar.
    //
    // O `<h2>` NÃO é o nome do diálogo — o cartão usa `aria-label`, não `aria-labelledby`. Foi por isso que
    // eu pude afirmar que escondê-lo no quadro apertado não custaria nada a quem escuta; esta linha é o que
    // torna a afirmação verificável em vez de lembrada.
    // A asserção "não contém a frase crua" NÃO cabe aqui e eu a escrevi assim primeiro: em pt-BR o valor do
    // dicionário É a mesma frase, então ela se contradizia. O que prova a passagem pela chave é a IDENTIDADE
    // com o que `t()` devolve, mais a existência da chave nos três idiomas (o `i18n-dicts` cobre o resto).
    const h = markup();
    expect(h).toContain('aria-label="' + t('pause.cardAria', { n: 1 }) + '"');
    expect(t('pause.cardAria', { n: 3 }), 'o número do jogador tem de entrar por parâmetro').toContain('3');
    expect(h, 'o `<h2>` não pode virar o nome do diálogo — ele é rótulo VISUAL').not.toContain('aria-labelledby');
  });

  it('[Zero] nenhum ato aparece nas DUAS listas', () => {
    // Um ato duplicado seria uma segunda porta para a mesma coisa em posições diferentes, e o índice "N de M"
    // passaria a contar dois lugares para um item só.
    const html = markup();
    const repetidos = atos(html, 'raiz').filter((a) => atos(html, 'opcoes').includes(a));
    expect(repetidos, 'ato nas duas listas: ' + repetidos.join(', ')).toEqual([]);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · pondo `quit` antes de `print` em PM_BTNS → "[Right] a lista raiz é EXATAMENTE" e "a saída é o PRIMEIRO"
//     reprovam, a segunda nomeando o item errado no fim.
//   · tirando o `hidden` da lista de opções → "[Right] só UMA lista é visível" reprova.
//   · trocando `PM_ITENS_VISIVEIS` por '.pm-btn' → "[Interface] o seletor IGNORA a lista escondida" reprova.
