// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/changed-mark.ts — MARCA O QUE SAIU DO PADRÃO (ADR-0029). Módulo-folha: só DOM e i18n, nenhuma dep de
// estado. Quem sabe o que é padrão é cada painel, que já leu DEFAULTS (ADR-0028); aqui mora só o COMO marcar.
//
// O problema que ele resolve: o reset por menu do ADR-0028 só serve a quem sabe que há algo para desfazer.
// Sete menus, ~40 controles, e o que a criança mexeu tem exatamente a mesma aparência do que ela não mexeu.
// Os menus não estavam mal rotulados — estavam IMPESQUISÁVEIS.
//
// TRÊS CANAIS, e nenhum é enfeite. O ADR-0029 explica por quê; em resumo: a moldura branca sozinha não serve
// a quem não distingue cores, some no alto contraste (onde `--ink-soft` JÁ é branco) e não existe para quem
// não enxerga. Então:
//
//   1. COR   — `--changed` na moldura (CSS; troca sozinha no alto contraste).
//   2. FORMA — anel interno, uma moldura dupla. Sobrevive a escala de cinza e a qualquer paleta, porque é uma
//              CONTAGEM DE ANÉIS e não uma matiz.
//   3. NOME  — o nome acessível do controle ganha um sufixo. É o canal que faz mais trabalho pelo menor preço:
//              a criança cega PERCORRE o menu e OUVE, em ordem, o que saiu do padrão.
//
// O canal 3 tem dois caminhos porque os painéis constroem o nome de duas formas, e um `aria-label` vence o
// conteúdo do botão. Marcar só um deles deixaria metade dos controles mudos — em silêncio, que é o pior jeito
// de uma marca de acessibilidade falhar, porque nada na tela denuncia a falta.
//
// O sufixo NUNCA toca o `textContent`. A primeira versão pendurava um `<span class="sr-only">` dentro do
// botão, e um teste que aferia o rótulo visível caiu — mostrando o problema real: os painéis reescrevem
// `textContent` inteiro a cada reflect, então o sufixo vivia à mercê da ordem das chamadas. Agora o caminho
// sem `aria-label` CRIA um, a partir do conteúdo, e o desmarcar simplesmente o remove.
//
// E a idempotência é ESTRUTURAL, não caso a caso: toda chamada primeiro devolve o controle ao estado
// original — tirando qualquer rastro nosso, dos dois caminhos — e só então aplica. Uma marca que só soubesse
// acrescentar acabaria em tudo, e uma marca em tudo não é marca.
import { t } from '../core/i18n.js';

export const CHANGED_CLASS = 'is-changed';
/** Guarda o `aria-label` ORIGINAL quando ele é do painel, para devolvê-lo sem adivinhar por texto. */
const BASE_ATTR = 'markBase';
/** Marca que o `aria-label` foi criado por NÓS: desmarcar tira o atributo inteiro em vez de restaurar algo. */
const OWNED_ATTR = 'markOwnsLabel';

/**
 * O nó cujo NOME acessível recebe o sufixo: o PRIMEIRO controle da linha em ordem de documento, ou a própria
 * linha quando ela não tem controle dentro.
 *
 * "O primeiro" é decisão, não acaso — e ela apareceu ao verificar no jogo. Uma linha do mixer tem DOIS
 * controles: o volume e o liga/desliga. O sufixo foi para o volume, que vem antes no markup, e isso está
 * certo por dois motivos: é o controle que a criança alcança primeiro ao tabular, então ela ouve "alterado"
 * ANTES de decidir se para nesta linha; e repetir o sufixo nos dois faria o leitor de tela dizer a mesma
 * coisa duas vezes ao atravessar uma linha só, que é ruído com cara de informação.
 *
 * O que isto deixa frágil, e por isso está preso por teste: reordenar o markup move o sufixo de controle sem
 * quebrar nada visível.
 */
function namedNode(el: HTMLElement): HTMLElement {
  return el.querySelector<HTMLElement>('button, select, input, [role="button"]') ?? el;
}

/** Devolve o controle ao estado original, venha o rótulo do painel ou de nós. Base de toda chamada. */
function clearMark(node: HTMLElement): void {
  if (node.dataset[OWNED_ATTR] !== undefined) {
    node.removeAttribute('aria-label');
    delete node.dataset[OWNED_ATTR];
  } else if (node.dataset[BASE_ATTR] !== undefined) {
    node.setAttribute('aria-label', node.dataset[BASE_ATTR]);
    delete node.dataset[BASE_ATTR];
  }
}

/**
 * Marca (ou desmarca) UM controle. Idempotente por construção: limpa e só então aplica. Os painéis chamam
 * isto de dentro do mesmo `reflect*` que já redesenha o controle, então ele roda muitas vezes seguidas.
 */
export function markChanged(el: HTMLElement | null, changed: boolean): void {
  if (!el) return;
  el.classList.toggle(CHANGED_CLASS, changed);
  const node = namedNode(el);
  clearMark(node);
  if (!changed) return;

  const suffix = t('a11y.changed');
  const label = node.getAttribute('aria-label');
  if (label !== null) {
    node.dataset[BASE_ATTR] = label;               // rótulo do painel: guardamos e devolvemos depois
    node.setAttribute('aria-label', label + ', ' + suffix);
  } else {
    node.dataset[OWNED_ATTR] = '1';                // rótulo vinha do conteúdo: criamos um e o assumimos
    node.setAttribute('aria-label', (node.textContent ?? '').trim() + ', ' + suffix);
  }
}

/**
 * Sobe a marca um nível: o botão que ABRE o menu fica marcado enquanto qualquer opção dentro dele estiver.
 * Sem isso a trilha começaria dentro do menu, e achar o menu certo continuaria custando abrir os sete.
 *
 * `changes` é uma lista de booleanos e não de elementos porque quem sabe comparar com o padrão é o painel;
 * este módulo não deve ter opinião sobre o que é padrão — há uma fonte só, e é o DEFAULTS do ADR-0028.
 */
export function markMenuChanged(opener: HTMLElement | null, changes: readonly boolean[]): void {
  markChanged(opener, changes.some(Boolean));
}
