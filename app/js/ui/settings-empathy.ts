// SPDX-License-Identifier: GPL-3.0-or-later
// ui/settings-empathy.ts — Empathy/simulation panel (Sensibilidade → Empatia): lets a player WITHOUT a disability
// experience one (VIZ_SIM: color-blindness/low-vision/blindness simulation, simulated hearing loss, one-button
// play, wheelchair). This is the opposite of settings-visual, which CORRECTS the game for a player who has the
// disability — do not merge the two, even where they share the viz-mode catalog or a helper.
// Injected via initSettingsEmpathy(ctx): DOM selector, srSay, store, the state setters (setHearingLoss/
// setOneButton/setWheelchair — still game.js: they touch the audio graph, player powers and world geometry far
// beyond this panel) plus their live getters, and the shared reflect/overlay helpers (renderVizGroup,
// reflectMotorEmpathy, reflectVizButtons, frontOverlay — used by sibling panels too, so they stay in game.js).
// Pure catalog/label logic (isSimKind/EMPATHY_VIZ_MODES/toggleLabel) is unit-tested in node; render/open/close
// are a thin DOM shell tested in browser. Model: app/js/render/fx.ts.

import { VIZ_MODES, simulatesDisability, type VizMode } from '../render/viz-modes.js';
import { hearingLoss, setHearingLossGraph } from '../platform/audio.js';
import { t } from '../core/i18n.js';
import { DEFAULTS } from '../core/state.js';
import { markChanged, markMenuChanged } from './changed-mark.js';

/** Kinds treated as *simulation* here (vs. the 'hcnew' *correction* kind that settings-visual owns). */
export const isSimKind = (kind: string): boolean => kind === 'filter' || kind === 'lowvision' || kind === 'blind';

/** This panel's slice of the shared viz-mode catalog: color-blindness/low-vision/blindness simulations. */
export const EMPATHY_VIZ_MODES: VizMode[] = VIZ_MODES.filter((m) => isSimKind(m.kind));

/** On/off label shared by every toggle button in this panel (hearing, one-button, wheelchair). */
export const toggleLabel = (on: boolean): string => (on ? '❚❚ Ligado' : '▶ Desligado');

export interface EmpathySettingsCtx {
  /** ui/dom.ts querySelector shortcut. */
  $<T extends Element = Element>(sel: string): T | null;
  /** core/a11y-sr.ts screen-reader announcer. */
  srSay(msg: string): void;
  /** platform/storage.ts (or a test double) — read here only, to restore hearing-loss simulation on boot. */
  store: { getBool(key: string, fallback?: boolean): boolean };
  /** Renders one viz-mode radio list (+ per-player tabs); shared with settings-visual, so it stays in game.js. */
  renderVizGroup(listSel: string, tabsSel: string, modes: VizMode[]): void;
  /** Reflects #opt-onebtn/#opt-wheelchair; game.js also calls it from its setOneButton/setWheelchair bodies. */
  reflectMotorEmpathy(): void;
  /** Reflects the #opt-visual/#opt-empathy summary buttons; shared across every viz-mode change in the game. */
  reflectVizButtons(): void;
  /** Brings an overlay to front + fills its footer explanations; shared by every Sensibilidade panel. */
  frontOverlay(el: HTMLElement | null): void;
  /** Devolve o foco a quem abriu o diálogo (ui/settings-panel `restoreFocus`). Injetado, e não um `#opt-*`
   *  fixo: o id que este módulo focava não existe no documento, então fechar deixava o foco no `<body>`. */
  restoreFocus?: (id: string) => boolean;
  /** Persists + applies the audio graph change (and announces); body stays in game.js. */
  setHearingLoss(on: boolean): void;
  /** Persists + applies one-button-only play (and announces); body stays in game.js. */
  setOneButton(on: boolean): void;
  /** Persists + rebuilds world geometry for wheelchair mode (and announces); body stays in game.js. */
  setWheelchair(on: boolean): void;
  /** Live reads of game.js's oneButton/wheelchair booleans (not yet migrated to core/state.ts). */
  getOneButton(): boolean;
  getWheelchair(): boolean;
  /** Jogadores vivos (core/state `players`), só para saber QUAL modo visual cada um está usando agora. */
  getPlayers(): readonly { viz: string }[];
  /** Mesmo setPlayerViz do painel visual e do atalho de contraste; usado aqui só pelo "restaurar padrões". */
  setPlayerViz(i: number, mode: string): void;
}

export interface EmpathySettingsApi {
  /** Redraws the simulation list + reflects the hearing/one-button/wheelchair toggle buttons. */
  render(): void;
  /** Opens the #empathy overlay (renders first, fronts it, focuses its first button). */
  open(): void;
  /** Closes the #empathy overlay and returns focus to #opt-empathy. */
  close(): void;
}

/** Wires the empathy panel's DOM (buttons + boot restore) and returns render/open/close for game.js to call. */
export function initSettingsEmpathy(ctx: EmpathySettingsCtx): EmpathySettingsApi {
  function render(): void {
    ctx.renderVizGroup('#empathy-list', '#empathy-players', EMPATHY_VIZ_MODES);
    const h = ctx.$<HTMLElement>('#opt-hearing');
    if (h) {
      h.classList.toggle('is-on', hearingLoss);
      h.setAttribute('aria-pressed', String(hearingLoss));
      h.textContent = toggleLabel(hearingLoss);
    }
    ctx.reflectMotorEmpathy();
    refreshMarks();
  }

  /**
   * A marca de "saiu do padrão" (ADR-0029). Neste menu ela quer dizer "esta simulação está LIGADA", e por
   * isso é a mais útil dos sete: uma criança que ligou a simulação de cegueira está com a tela preta e não
   * consegue ler nada — mas o leitor de tela dela percorre o menu e diz qual linha saiu do padrão.
   *
   * O recorte é o do reset, pelo mesmo motivo dele: as três CORREÇÕES de daltonismo que este painel lista
   * não são deste menu. Marcá-las aqui mandaria a criança daltônica desfazer, no menu de empatia, a correção
   * que a faz enxergar o jogo.
   */
  function refreshMarks(): void {
    const simulando = ctx.getPlayers().some((p) => simulatesDisability(p.viz));
    const surdez = hearingLoss;
    const um = ctx.getOneButton() !== DEFAULTS.oneButton;
    const cadeira = ctx.getWheelchair() !== DEFAULTS.wheelchair;
    const linha = (sel: string): HTMLElement | null =>
      ctx.$<HTMLElement>(sel)?.closest<HTMLElement>('.ctrl-row') ?? null;
    markChanged(linha('#opt-hearing'), surdez);
    markChanged(linha('#opt-onebtn'), um);
    markChanged(linha('#opt-wheelchair'), cadeira);
    markChanged(ctx.$<HTMLElement>('#empathy-list'), simulando);
    markMenuChanged(ctx.$<HTMLElement>('[data-act="empatia"]'), [simulando, surdez, um, cadeira]);
  }

  function open(): void {
    const ov = ctx.$<HTMLElement>('#empathy');
    if (!ov) return;
    render();
    ov.hidden = false;
    ctx.frontOverlay(ov);
    const f = ov.querySelector<HTMLElement>('button');
    if (f) f.focus();
  }

  function close(): void {
    const ov = ctx.$<HTMLElement>('#empathy');
    if (!ov) return;
    ov.hidden = true;
    if (ctx.restoreFocus && ctx.restoreFocus('empathy')) return;
    const b = ctx.$<HTMLElement>('#opt-empathy');
    if (b) b.focus(); // recuo: este id nao existe no documento hoje (gancho de uma barra futura)
  }

  const empathyBtn = ctx.$<HTMLElement>('#opt-empathy');
  if (empathyBtn) empathyBtn.addEventListener('click', open);
  const empathyClose = ctx.$<HTMLElement>('#empathy-close');
  if (empathyClose) empathyClose.addEventListener('click', close);

  const hearingBtn = ctx.$<HTMLElement>('#opt-hearing');
  if (hearingBtn) hearingBtn.addEventListener('click', () => { ctx.setHearingLoss(!hearingLoss); render(); ctx.reflectVizButtons(); });
  if (ctx.store.getBool('incl_hearingloss')) setHearingLossGraph(true); // restaura o grafo de áudio persistido no boot

  // `refreshMarks()` depois de CADA um: estes dois setters não passam por `render()` — eles refletem o botão
  // por conta própria —, então a marca precisa ser puxada aqui ou nunca acompanha a mudança.
  const oneBtn = ctx.$<HTMLElement>('#opt-onebtn');
  if (oneBtn) oneBtn.addEventListener('click', () => { ctx.setOneButton(!ctx.getOneButton()); refreshMarks(); });
  const wheelBtn = ctx.$<HTMLElement>('#opt-wheelchair');
  if (wheelBtn) wheelBtn.addEventListener('click', () => { ctx.setWheelchair(!ctx.getWheelchair()); refreshMarks(); });

  // ---- restaurar os padrões DESTE menu (ADR-0028) ----
  //
  // De todos os oito, este é o reset que mais precisa existir e o que mais precisa ter cuidado, pelo mesmo
  // motivo: é o menu que simula deficiências. Uma criança que liga "Simular cegueira total" fica com a tela
  // preta, e a saída — o toque duplo na bolinha — é justamente o que ela acabou de perder a capacidade de ver.
  //
  // E o cuidado: A LISTA DESTE PAINEL NÃO É A LISTA QUE O RESET DESLIGA, e a diferença é deliberada. O painel
  // mostra também `fix-protan/fix-deuter/fix-tritan`, que são CORREÇÃO de daltonismo, porque hoje elas não têm
  // outro lugar onde morar — o painel visual só cobre os 4 níveis de contraste. Desligá-las junto tiraria de
  // uma criança daltônica a única correção que ela tem, a mando de um menu feito para quem não é daltônico.
  // Por isso o reset pergunta `simulatesDisability`, que responde pelo modo, e não `isSimKind`, que responde
  // pelo `kind` e não distingue simular de corrigir.
  const resetBtn = ctx.$<HTMLButtonElement>('#empathy-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    // Cada setter já é idempotente e anuncia sozinho ao mudar; chamar só na diferença evita anúncio falso de
    // "desligado" para algo que nunca esteve ligado. O anúncio-resumo vem por último, e é o que fica no
    // `#sr-status` — uma ação, uma frase, em vez de três.
    ctx.getPlayers().forEach((p, i) => { if (simulatesDisability(p.viz)) ctx.setPlayerViz(i, 'normal'); });
    if (hearingLoss) ctx.setHearingLoss(false);
    if (ctx.getOneButton() !== DEFAULTS.oneButton) ctx.setOneButton(DEFAULTS.oneButton);
    if (ctx.getWheelchair() !== DEFAULTS.wheelchair) ctx.setWheelchair(DEFAULTS.wheelchair);
    render(); ctx.reflectVizButtons();
    ctx.srSay(t('sr.empathy.reset'));
  });

  return { render, open, close };
}
