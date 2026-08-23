// SPDX-License-Identifier: GPL-3.0-or-later
// ui/settings-panel.ts — a CASCA COMUM dos diálogos de configuração (#visual, #typo, #audio, #options,
// #movement, #animation, #empathy, #touchcfg, #help). Os SETE painéis já saíram para ui/settings-*.ts; o que
// sobrou no game.js em volta deles era: (a) a pilha de z-index dos overlays (`_ovZ` + frontOverlay), (b) o
// rodapé de explicação (fillExplain), (c) a tabela OVERLAY_CLOSE (id → fechar) e (d) o encadeamento de Escape.
//
// DECISÃO DE PROJETO (ver relatório da extração): NÃO existe aqui um open()/close() genérico. Os nove diálogos
// divergem em quase tudo o que a casca faria — o que renderizar antes de mostrar (de 0 a 5 chamadas distintas),
// QUAL controle recebe o foco ao abrir (`button` · `button[data-viz]||button` · `button[data-font]:not([disabled])
// ||button` · `select,button`), qual flag `*Open` refletir (sete têm, dois não), o que fazer a mais ao fechar
// (só #options cancela a captura de tecla) e PARA ONDE o foco volta (sete vão a um `#opt-*`, dois devolvem ao
// menu de pausa por menuFocus/sharedDialogOpen). Uma casca com seis parâmetros de exceção, todos eles closures
// de uma linha, custaria o mesmo código e uma indireção a mais para ler — e três dos painéis (motion, empathy,
// touch) já implementam o seu próprio open/close dentro do módulo. Então este arquivo entrega SÓ o que é
// genuinamente comum, e o open/close continua sendo sete (nove) funções curtas, cada uma legível sozinha.
//
// ACESSIBILIDADE: quem foca o quê continua nas funções de abrir/fechar de cada painel — esta casca não mexe em
// foco, em `aria-modal` (é estático no index.html) e não instala armadilha de foco (o original também não tem;
// ver o relatório). O que ELA cuida é da ORDEM DE LEITURA: fillExplain tira a descrição longa de dentro da
// linha, deixa só o rótulo em <strong>, e passa a descrição a um rodapé `aria-live="polite"` — foco/hover na
// linha atualiza esse rodapé. E frontOverlay garante que o último diálogo aberto fique por cima (z crescente),
// que é o que sharedDialogOpen/topVisibleOverlay lê de volta para saber quem navegar.
//
// INJETADO via initSettingsPanel(ctx): $/$$ (ui/dom.ts), doc (só `createElement`, para o rodapé) e computedZ
// (leitura do z-index efetivo). Nenhuma I/O no import; todo o estado (o contador `_ovZ` e o registro de
// overlays) vive no closure do init — dois inits em processos de teste distintos não vazam um no outro.

/** Escopo dos overlays de a11y: o inCanvasMenus() do game.js reparenta TODOS para dentro do #game-region
 *  ("nenhuma tela fora do canvas"). Verbatim do sharedDialogOpen() original. */
export const OVERLAY_SCOPE_SELECTOR = '#game-region .overlay';

/** Texto de repouso do rodapé de explicação (verbatim do game.js). */
export const EXPLAIN_IDLE = 'Passe o mouse ou navegue pelas opções para ver a explicação.';

/** z-index inicial da pilha: o primeiro overlay trazido à frente recebe 61. Verbatim (`let _ovZ=60`). */
export const OVERLAY_BASE_Z = 60;

export interface SettingsPanelCtx {
  /** ui/dom.ts `$` — usado só para resolver `#<id>` e checar visibilidade na cadeia de Escape (o `dlgVis`
   *  do game.js). Injetado, e não importado direto, para o teste node poder passar um DOM falso. */
  $: <T extends Element = Element>(sel: string) => T | null;
  /** ui/dom.ts `$$` — usado só por topVisibleOverlay(), que varre OVERLAY_SCOPE_SELECTOR. */
  $$: <T extends Element = Element>(sel: string) => T[];
  /** Só `createElement`: fillExplain CRIA o rodapé `.opt-explain` na primeira vez que vê um card. É a única
   *  coisa que este módulo precisa do `document` global — injetada para não amarrar o módulo a ele. */
  doc: Pick<Document, 'createElement'>;
  /** z-index EFETIVO de um elemento. No game.js é `+getComputedStyle(el).zIndex||0` (repare: 'auto' vira NaN
   *  e o `||0` o transforma em 0 — comportamento preservado, é responsabilidade de quem injeta). Injetado
   *  porque getComputedStyle só existe no navegador, e porque o teste node precisa simular a pilha. */
  computedZ: (el: Element) => number;
}

/** Uma entrada do registro de overlays — substitui a tabela OVERLAY_CLOSE do game.js. */
export interface OverlayEntry {
  /** Fecha o diálogo. É o MESMO valor que estava em OVERLAY_CLOSE[id] no game.js: cada painel devolve o foco
   *  do seu jeito lá dentro (uns a um `#opt-*`, outros ao menu de pausa) — a casca não opina. */
  close: () => void;
  /** Reflete a flag `*Open` do game.js (`optionsOpen`, `audioOpen`, …). SÓ quem tinha flag entra na cadeia de
   *  Escape; #touchcfg e #help não tinham e por isso ficam de fora (verbatim — ver bugs no relatório).
   *  É um GETTER, não um valor: as flags são `let` reatribuídos no game.js e um binding importado não pode ser
   *  reatribuído de fora, então o registro lê o valor atual a cada consulta. */
  isOpen?: () => boolean;
}

export interface SettingsPanelApi {
  /** Traz o overlay para a frente da pilha (z crescente) e preenche o rodapé de explicação do seu card.
   *  Chamado por TODOS os open* (game.js) e pelos módulos que já têm o seu (motion/empathy/touch/gamepad). */
  frontOverlay: (el: HTMLElement | null) => void;
  /** Move as descrições das `.ctrl-row` do card para o rodapé `.opt-explain` (idempotente por linha). */
  fillExplain: (card: HTMLElement | null) => void;
  /** Registra um diálogo. A ORDEM DE REGISTRO é significativa: é ela que a cadeia de Escape percorre. */
  register: (id: string, entry: OverlayEntry) => void;
  /** OVERLAY_CLOSE[id]?.() — devolve true se havia entrada registrada (o `if(c)c()` do dialogBack). */
  closeById: (id: string) => boolean;
  /** Id do diálogo que deve consumir a tecla, ou null. Percorre na ORDEM DE REGISTRO (não por z-index — é o
   *  encadeamento if/else do game.js portado verbatim) e devolve o primeiro que esteja com a flag `*Open`
   *  ligada E de fato visível (`!el.hidden`). Ver o relatório: isto NÃO é "o de cima". */
  escapeTarget: () => string | null;
  /** O overlay VISÍVEL mais alto na pilha (sharedDialogOpen do game.js). Empate de z: vence o último no DOM. */
  topVisibleOverlay: () => HTMLElement | null;
  /** Ids registrados, na ordem — só para teste/depuração. */
  registeredIds: () => string[];
}

// ---------------------------------------------------------------------------------------------------------
// Lógica PURA — sem `document`, testável no project node.
// ---------------------------------------------------------------------------------------------------------

/**
 * A descrição de uma linha de opção, do jeito que o game.js a extrai:
 * há `.opt-hint` dentro do <span>? usa o texto dele. Senão, tira do texto do <span> o prefixo do <strong>
 * (o rótulo curto) e o travessão que separa rótulo de descrição.
 * Aceita — (em dash), – (en dash) e - (hífen), como no original.
 */
export function rowExplainText(spanText: string, strongText: string, hintText: string | null): string {
  if (hintText !== null) return hintText.trim();
  return spanText.slice(strongText.length).replace(/^\s*[—–-]\s*/, '').trim();
}

/**
 * Escolhe o overlay visível de z-index mais alto. Empate: vence o ÚLTIMO da lista (ordem do DOM) — é o efeito
 * do `sort` estável seguido de `ov[ov.length-1]` no game.js. Lista vazia → null.
 */
export function topByZ<T>(overlays: readonly T[], zOf: (el: T) => number): T | null {
  if (!overlays.length) return null;
  const sorted = [...overlays].sort((a, b) => zOf(a) - zOf(b));
  return sorted[sorted.length - 1] as T;
}

// ---------------------------------------------------------------------------------------------------------
// Casca DOM
// ---------------------------------------------------------------------------------------------------------

export function initSettingsPanel(ctx: SettingsPanelCtx): SettingsPanelApi {
  // `_ovZ` do game.js. Fica no closure (e não no módulo) para que cada init comece limpo — sem isso um teste
  // herdaria a pilha do anterior.
  let ovZ = OVERLAY_BASE_Z;

  // OVERLAY_CLOSE + as flags `*Open`, num registro só. Map preserva a ordem de inserção, que é justamente a
  // ordem do encadeamento de Escape.
  const registry = new Map<string, OverlayEntry>();

  function fillExplain(card: HTMLElement | null): void {
    if (!card) return;
    let f = card.querySelector<HTMLElement>('.opt-explain');
    if (!f) {
      f = ctx.doc.createElement('div');
      f.className = 'opt-explain';
      f.setAttribute('aria-live', 'polite'); // rodapé anunciado ao mudar (foco/hover na linha)
      f.dataset.idle = EXPLAIN_IDLE;
      f.textContent = EXPLAIN_IDLE;
      card.appendChild(f);
    }
    const footer = f; // estreita o tipo para os closures abaixo
    card.querySelectorAll<HTMLElement>('.ctrl-row').forEach((row) => {
      if (row.dataset.explainDone) return; // idempotente: render() redesenha o card, mas linha feita não repete
      const span = row.querySelector<HTMLElement>(':scope > span');
      const strong = span ? span.querySelector<HTMLElement>('strong') : null;
      if (!span || !strong) { row.dataset.explainDone = '1'; return; } // linha sem rótulo curto: nada a mover
      const hint = span.querySelector<HTMLElement>('.opt-hint');
      const desc = rowExplainText(span.textContent ?? '', strong.textContent ?? '', hint ? (hint.textContent ?? '') : null);
      row.dataset.explainDone = '1';
      if (!desc) return; // rótulo sem descrição: a linha fica como está
      row.dataset.explain = desc;
      span.innerHTML = strong.outerHTML; // ORDEM DE LEITURA: a linha passa a ter só o rótulo curto…
      const show = (): void => { footer.textContent = desc; }; // …e a descrição vai ao rodapé ao focar/passar o mouse
      const clear = (): void => { footer.textContent = footer.dataset.idle ?? ''; };
      row.addEventListener('mouseenter', show);
      row.addEventListener('focusin', show);
      row.addEventListener('mouseleave', clear);
      // NOTA (bug do original, preservado): não há listener de 'focusout' — navegando por teclado o rodapé
      // nunca volta ao texto de repouso. Relatado, não corrigido.
    });
  }

  function frontOverlay(el: HTMLElement | null): void {
    if (!el) return;
    el.style.zIndex = String(++ovZ);
    const card = el.querySelector<HTMLElement>('.overlay__card');
    if (card) fillExplain(card);
  }

  function register(id: string, entry: OverlayEntry): void {
    registry.set(id, entry);
  }

  function closeById(id: string): boolean {
    const entry = registry.get(id);
    if (!entry) return false;
    entry.close();
    return true;
  }

  function escapeTarget(): string | null {
    for (const [id, entry] of registry) {
      if (!entry.isOpen) continue;      // sem flag `*Open` (#touchcfg, #help): fora da cadeia, verbatim
      if (!entry.isOpen()) continue;
      const el = ctx.$<HTMLElement>('#' + id);
      if (!el || el.hidden) continue;   // `dlgVis`: flag presa num diálogo invisível não trava mais o teclado
      return id;
    }
    return null;
  }

  function topVisibleOverlay(): HTMLElement | null {
    const visible = ctx.$$<HTMLElement>(OVERLAY_SCOPE_SELECTOR).filter((o) => !o.hidden);
    return topByZ(visible, ctx.computedZ);
  }

  return {
    frontOverlay, fillExplain, register, closeById, escapeTarget, topVisibleOverlay,
    registeredIds: () => [...registry.keys()],
  };
}
