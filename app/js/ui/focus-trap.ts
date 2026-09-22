// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/focus-trap.ts — A ARMADILHA DE FOCO. O segundo fio da issue #109, e o único dos três que não existia
// EM LADO NENHUM da engine: os outros dois eram construídos e deixados desligados, este nunca foi escrito.
// `ui/settings-panel.ts:17-19` diz isso por escrito — *"não instala armadilha de foco (o original também não
// tem)"*.
//
// ⚠️ E O DOCUMENTO JÁ PROMETE O CONTRÁRIO. Todo `.overlay__card` do `index.html` tem `aria-modal="true"`, o
// que diz à tecnologia assistiva que o resto da página está inerte. O Tab não concorda: ele sai do diálogo e
// entra no tabuleiro por baixo. É a pior forma de defeito de acessibilidade — não a ausência de uma promessa,
// mas uma promessa que o teclado desmente. Quem usa leitor de tela sai para um jogo cujo estado não consegue
// perceber, e não tem caminho de volta que perceba.
//
// ⚠️ SÓ INTERVÉM NAS BORDAS, e isso é decisão e não economia. Reimplementar a ordem de tabulação inteira
// significaria reproduzir regras que o navegador já acerta — `tabindex` positivo, ordem do DOM em `shadow
// root`, elementos que ficam focáveis por `contenteditable`. Uma armadilha que se mete no meio erra ao
// caminhar; uma que só fecha o ciclo nas pontas não tem como errar o meio, porque não o toca.
//
// A regra fica em UMA função pura (`proximoNaArmadilha`), testável no project node sem DOM nenhum. O que
// precisa de navegador é só ler quem está focado e chamar `.focus()`.

/**
 * O que conta como focável. Deliberadamente SEM `[contenteditable]` e sem `tabindex` positivo: os dois
 * existem, mas não aparecem em nenhum diálogo desta engine (conferido), e um seletor que promete mais do que
 * foi verificado é um seletor que mente na próxima revisão.
 */
export const SELETOR_FOCAVEL = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Para onde o foco tem de ir quando o Tab está prestes a sair do diálogo — ou `null` quando não há nada a
 * fazer e o navegador deve seguir sozinho.
 *
 * Os quatro casos, e o terceiro é a razão de isto existir:
 *
 *   1. lista VAZIA → `null`. Um diálogo sem nada focável é um defeito do diálogo, e prender o foco nele
 *      deixaria a criança sem saída nenhuma. Melhor deixar sair do que trancar num lugar mudo.
 *   2. o foco está no ÚLTIMO e vai para a frente → volta ao primeiro; no PRIMEIRO e vai para trás → vai ao
 *      último. É o ciclo, que é o que «armadilha» quer dizer.
 *   3. ⚠️ o foco está FORA da lista → traz de volta. É o caso que os outros três não cobrem: o foco pode já
 *      ter escapado antes de esta armadilha existir, ou por um clique no tabuleiro, ou porque o diálogo
 *      abriu sem focar nada. Sem ele a armadilha só funciona para quem já estava dentro.
 *   4. o foco está no MEIO → `null`, e o navegador caminha. Ver o comentário do cabeçalho.
 */
export function proximoNaArmadilha<T>(
  focaveis: readonly T[],
  atual: T | null,
  paraTras: boolean,
): T | null {
  if (focaveis.length === 0) return null;
  const primeiro = focaveis[0]!;
  const ultimo = focaveis[focaveis.length - 1]!;

  const i = atual === null ? -1 : focaveis.indexOf(atual);
  if (i < 0) return paraTras ? ultimo : primeiro; // caso 3: o foco estava fora
  if (!paraTras && i === focaveis.length - 1) return primeiro;
  if (paraTras && i === 0) return ultimo;
  return null; // caso 4: o meio é do navegador
}

interface AlvoDeEvento {
  addEventListener: (tipo: 'keydown', fn: (e: KeyboardEvent) => void, captura?: boolean) => void;
  removeEventListener?: (tipo: 'keydown', fn: (e: KeyboardEvent) => void, captura?: boolean) => void;
}

export interface FocusTrapCtx {
  /** O diálogo VISÍVEL mais alto da pilha, ou `null`. É o `topVisibleOverlay` de `ui/settings-panel`. */
  overlayDeCima: () => HTMLElement | null;
  /** Quem tem o foco agora — `() => document.activeElement`. Injetado: o project node não tem documento. */
  focoAtual: () => Element | null;
  /** Os focáveis DENTRO do diálogo, na ordem do documento e já filtrados por visibilidade. */
  focaveisDe: (isInside: HTMLElement) => HTMLElement[];
  win: AlvoDeEvento;
}

export interface FocusTrapApi {
  /** O manipulador, exposto para o teste o chamar sem instalar nada. */
  aoTeclar: (e: KeyboardEvent) => void;
  /** Instala na fase de CAPTURA, pelo mesmo motivo do `menu-nav`: ver a tecla antes de quem está por baixo. */
  attach: () => void;
  /**
   * Desinstala.
   *
   * ⚠️ ELE NASCEU DE UM TESTE QUE REPROVOU, e não de simetria: dois casos no mesmo ficheiro instalaram duas
   * armadilhas na mesma janela, e a primeira continuou a prender o foco durante o segundo — o caso «sem
   * diálogo aberto o Tab é do jogo» ficou vermelho por causa de uma armadilha que já devia ter saído.
   *
   * O que isso mostra vale fora do teste: uma armadilha que não se desinstala é um vazamento para qualquer
   * página que monte a engine duas vezes — o `demos`, que troca de jogo sem recarregar, é exatamente isso.
   */
  detach: () => void;
}

export function initFocusTrap(ctx: FocusTrapCtx): FocusTrapApi {
  function aoTeclar(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;
    const dialogo = ctx.overlayDeCima();
    if (!dialogo) return; // sem diálogo aberto o Tab é do jogo, e tem de continuar a ser

    const alvo = proximoNaArmadilha(ctx.focaveisDe(dialogo), ctx.focoAtual() as HTMLElement | null, e.shiftKey);
    if (!alvo) return;

    e.preventDefault();
    alvo.focus();
  }

  return {
    aoTeclar,
    attach: () => ctx.win.addEventListener('keydown', aoTeclar, true),
    detach: () => ctx.win.removeEventListener?.('keydown', aoTeclar, true),
  };
}

/**
 * Os focáveis de um contêiner, no navegador. Vive aqui e não na raiz para as duas raízes não escreverem duas
 * versões que divergiriam em silêncio — uma prenderia o foco e a outra deixaria escapar, no mesmo produto.
 *
 * ⚠️ A VISIBILIDADE É POR `getClientRects()`, e não por `offsetParent`.
 *
 * ⚠️ E A PRIMEIRA VERSÃO DESTE COMENTÁRIO ESTAVA ERRADA, o que vale mais registrar do que apagar: ele dizia
 * que `offsetParent` é `null` para «qualquer elemento em `position: fixed`». Não é — é `null` para o elemento
 * FIXO EM SI, e os descendentes dele devolvem o próprio contêiner. O teste de navegador reprovou a afirmação,
 * que é exatamente o que um teste tem de fazer com uma justificativa inventada.
 *
 * A razão verdadeira é mais simples e mais forte: `getClientRects()` responde *«isto desenha alguma caixa?»*,
 * o que cobre `display:none` em QUALQUER ancestral, elementos de tamanho zero e o caso do contêiner fixo —
 * sem que quem lê precise de saber em que casos `offsetParent` tem buracos.
 */
export function focaveisNoDom(isInside: HTMLElement): HTMLElement[] {
  const todos = [...isInside.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL)];
  return todos.filter((el) => !el.hidden && el.getClientRects().length > 0);
}
