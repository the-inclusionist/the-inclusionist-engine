// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/pause-icons — the PER-SCREEN pause menu (`.screen-pause`) and the accessibility icon bar (`.pi-btn`).
// Extracted VERBATIM from game.js (Estágio 4): PAUSE_ICONS, buildScreenPause, calmMode/applyCalm, iconAct,
// iconLabel, reflectIconBtn, reflectPauseIcons and hasPrivateOutput.
//
// WHY THE ICON BAR IS ITS OWN SLICE: the ten `.pi-btn` buttons are the ONLY place in the game where a state
// owned by another subsystem (blind mode, TTS, Libras, TEA/reduced-motion, toggle-keys, contrast, CVD) is both
// mutated AND read back as an `aria-label`. That round-trip — "the label must tell the truth about the state" —
// is the whole reason `iconLabel` exists, and it is what the pure functions below make testable in node.
//
// `iconAct` IS A DISPATCHER (its ctx list is long by nature: seven subsystems, one button each), so it is
// implemented here as a TABLE (`ICON_ACTS`) rather than the original if/else chain. Same order, same
// guards, same announcements — only the shape changed.
//
// WHAT STAYS IN game.js (injected):
//   · `pauseActor`      — read by the gamepad (input/gamepad.ts ctx) and the keyboard router, and by
//                         openHelp()/openOptions(); this module only WRITES it (`setPauseActor`).
//   · `pauseActs`       — the `.pm-btn` action table; every entry calls a panel that still lives in game.js
//                         (openTypo/openAudio/openMovement/motion.open/openVisual/empathy.open/printMode/
//                         quitGame/openHelp/setPhase/applyLetra/setQuizLevel/joinPlayer/fitsN/vpScreens).
//                         Injected LAZILY (`getPauseActs`) because it is a `const` declared ~1200 lines below
//                         the init site — an eager reference would hit its temporal dead zone.
//   · `vpPause`         — the array of built pause screens; game.js rebuilds it in buildGameHud() and reads it
//                         in setPhase/navPause/printMode/pauseSelect/__incl. Injected as a getter.
//   · `rm`/`saveRM`     — the reduced-motion flags object, co-owned with ui/settings-motion (same reference).
//   · `PM_BTNS`/`QL_NAME` — owned by ui/activities-menu; injected, never copied.


import type { PlayerView } from '../core/entity.js';
import type { NavKeys } from '../input/edges.js'; // a MESMA intenção que teclado, controle, olhar e fala montam
import { t } from '../core/i18n.js';
import { CONTRAST_LEVELS, CONTRAST_LABELS } from './settings-visual.js';
import type { MotionSceneFlags, MotionSceneKey, MotionCharDef } from './settings-motion.js';
import type { AudioCatState } from './settings-audio.js';
import { anunciarItem } from './item-announcement.js';
import { passoNoAnel } from '../core/anel.js'; // da FOLHA, e não de ui/menu-nav: ver a nota lá
// LIGAÇÃO VIVA (ESM): o índice pode ser desligado no menu, e o valor aqui acompanha sem assinatura.
import { menuIndexOn } from '../core/state.js';

/**
 * A LEGENDA de um ícone da barra de acessibilidade — uma função, e não três cópias da mesma expressão.
 *
 * Ela é escrita em TRÊS momentos que parecem diferentes e são o mesmo: o cursor direcional pousa no ícone
 * (`ui/menu-nav`), o dedo o aciona, e o mouse ou o foco passa por cima. Enquanto eram três linhas soltas, o
 * índice do ADR-0044 teria de ser acrescentado em três lugares — e a chance de um ficar para trás é a mesma
 * que este repositório já pagou dezesseis vezes com o `DomQuery`.
 *
 * O `aria-label` já conta o ESTADO ("Alto contraste, ativado"): é ele que o `reflectIconBtn` reescreve a cada
 * mudança, e é por isso que a legenda o lê de volta em vez de recompor o texto por conta própria.
 */
export function legendaDoIcone(barra: ParentNode, el: HTMLElement): string {
  const icones = [...barra.querySelectorAll<HTMLElement>('.pi-btn')];
  return anunciarItem(
    { rotulo: el.getAttribute('aria-label') || '', posicao: icones.indexOf(el) + 1, total: icones.length },
    menuIndexOn,
  );
}

// ---------------------------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------------------------

export interface PauseIcon {
  /** `data-pi` key — the dispatch key of iconAct/iconLabel/reflectIconBtn. */
  k: string;
  /** The emoji glyph rendered inside the button. */
  e: string;
  /** i18n KEY of the base name; also the `aria-label` when the icon carries no state (or is `soon`). */
  n: string;
  /** Under construction: the button announces itself and does nothing else. */
  soon?: boolean;
}

/** The accessibility shortcut bar at the top of every pause screen (and of the splash `#title-icons`).
 *  Sound-bound icons (blind/TTS) require a private audio output; webcam/voice are still `soon`.
 *  VERBATIM from game.js in order and behaviour; the names became i18n keys in the Fase-5 pass. */
// `n` é a CHAVE i18n do nome do ícone (o emoji `e` não traduz — é o mesmo glifo em toda língua).
export const PAUSE_ICONS: readonly PauseIcon[] = [
  { k: 'blind', e: '🦯', n: 'icon.blind' },
  { k: 'tts', e: '🗨️', n: 'icon.tts' },
  { k: 'libras', e: '🤟', n: 'icon.libras' },
  { k: 'tea', e: '🧩', n: 'icon.tea' },
  { k: 'altmove', e: '🦾', n: 'icon.altmove' },
  { k: 'contrast', e: '🌗', n: 'icon.contrast' },
  { k: 'cvd', e: '🚥', n: 'icon.cvd' },
  { k: 'face', e: '🧑', n: 'icon.face', soon: true },
  { k: 'eyes', e: '👀', n: 'icon.eyes', soon: true },
  { k: 'voice', e: '👄', n: 'icon.voice', soon: true },
];

const ICON_BY_KEY: ReadonlyMap<string, PauseIcon> = new Map(PAUSE_ICONS.map((ic) => [ic.k, ic]));
export function pauseIcon(k: string): PauseIcon | undefined { return ICON_BY_KEY.get(k); }

/** TEA cycle: 0 = normal · 1 = calmo (reduces) · 2 = silencioso (switches off). Never touches TTS/blind mode. */
export const CALM_NAMES: readonly string[] = ['calm.off', 'calm.quiet', 'calm.silent'];
/** The audio categories `applyCalm` governs. TTS/sonar/guarda/guia stay untouched — a calm player still needs them. */
export const CALM_AUDIO_CATS: readonly string[] = ['ambient', 'music', 'earcons', 'other', 'interact'];
/** Colour-vision-deficiency cycle, in `player.viz` values. */
export const CVD_SEQ: readonly string[] = ['normal', 'fix-protan', 'fix-deuter', 'fix-tritan'];
/** i18n keys of the CVD announcement names, indexed the same as CVD_SEQ. */
export const CVD_NAMES: readonly string[] = ['cvd.off', 'cvd.protan', 'cvd.deuter', 'cvd.tritan'];
/** `player.viz` → i18n key of the label used by iconLabel (anything else falls back to the 'off' key). */
export const CVD_LABELS: Readonly<Record<string, string>> = {
  'fix-protan': 'cvd.protan', 'fix-deuter': 'cvd.deuter', 'fix-tritan': 'cvd.tritan',
};

// ---------------------------------------------------------------------------------------------
// Shapes this module reads but does not own
// ---------------------------------------------------------------------------------------------

/** The slice of a player object the pause icons touch. `players` (core/state) is typed `unknown[]`. */
/**
 * A fatia que os ícones de pausa tocam — derivada de core/entity, e SEM assinatura de índice.
 *
 * Havia uma (`[prop: string]: unknown`), posta ali porque `applyCalm` escreve por nome calculado
 * (`p[c.prop] = …`). Era andaime: `c.prop` tem tipo `MotionCharProp`, que é a união literal
 * `'rmWalk' | 'rmBreath' | 'rmFlavor'`, e o TypeScript verifica acesso por chave literal sem precisar de
 * assinatura nenhuma — bastava que os três campos tivessem nome, que é o que a derivação deu.
 *
 * E ela custava caro: uma assinatura de índice aceita QUALQUER propriedade, com valor `unknown`. Enquanto
 * existiu, um erro de digitação em qualquer campo deste objeto compilava em silêncio. Quem a denunciou foi
 * tipar `core/state.players` como `Player[]`: o compilador recusou converter um `Player` — que não tem
 * assinatura de índice — para ela, e essa recusa é a informação.
 */
export type PausePlayer = PlayerView<'viz' | 'toggleMove' | 'audioSink' | 'rmWalk' | 'rmBreath' | 'rmFlavor'>;

/** One `.pm-btn` descriptor — the shape of game.js's PM_BTNS (owned by ui/activities-menu). */
export interface PauseMenuButton {
  act: string;
  /** Só é lido quando o botão tem rótulo dinâmico; ver a nota em `PauseBtnDef` (ui/activities-menu). */
  lbl?: string;
  /** Dynamic label (the ABC cycle) — rendered from `lbl`, not from i18n, and NOT given `data-i18n`. */
  letra?: boolean;
  /** Dynamic label (the literacy level) — rendered from quizLevel + qlName. Currently dormant: no PM_BTNS
   *  entry sets it, but the branch is live code and is ported verbatim. */
  nivel?: boolean;
}

// ---------------------------------------------------------------------------------------------
// PURE LOGIC — no `document`, no ctx. This is the half that carries the accessibility contract.
// ---------------------------------------------------------------------------------------------

/** Everything the label/visual of ONE icon depends on, gathered in one value. */
export interface IconStateSnapshot {
  modoCego: boolean;
  ttsOn: boolean;
  librasOn: boolean;
  calmMode: number;
  toggleMove: boolean;
  /** `player.viz` — shared by the contrast and CVD icons (they overwrite each other; that is by design). */
  viz: string;
  /** False disables the blind/TTS icons: those need an audio output nobody else is listening to. */
  privateOutput: boolean;
}

/** A player has private output when nobody else is on the same sink. Single screen ⇒ always private.
 *  Pure form of game.js's hasPrivateOutput (see the report: it had no other caller left). */
export function hasPrivateOutputIn(list: readonly PausePlayer[], count: number, i: number): boolean {
  if (count <= 1) return true;
  const p = list[i];
  if (!p || !p.audioSink) return false;
  return !list.some((q, j) => j !== i && q && q.audioSink === p.audioSink);
}

/** TEA cycle step. */
export function nextCalmMode(cur: number): number { return (cur + 1) % 3; }

/** Next high-contrast level. An unlisted `viz` (e.g. a CVD filter) is treated as index 0 ⇒ jumps to 'hc-direto'. */
export function nextContrast(cur: string | undefined): string {
  let idx = CONTRAST_LEVELS.indexOf(cur as string);
  idx = idx < 0 ? 0 : idx;
  return CONTRAST_LEVELS[(idx + 1) % CONTRAST_LEVELS.length];
}

/** Next CVD filter. NOTE the asymmetry with nextContrast: an unlisted `viz` maps to index 1 ('fix-protan'),
 *  not 0 — verbatim from game.js (`idx = idx<0 ? 1 : (idx+1)%seq.length`). */
export function nextCvd(cur: string | undefined): { idx: number; mode: string } {
  let idx = CVD_SEQ.indexOf(cur as string);
  idx = idx < 0 ? 1 : (idx + 1) % CVD_SEQ.length;
  return { idx, mode: CVD_SEQ[idx] };
}

/** What `applyCalm` does to ONE audio category, given the TEA level. Extracted so the (destructive) volume
 *  clamp at level 1 is visible and testable — see the report. */
export function calmAudioPlan(calmMode: number, vol: number): { on: boolean; vol: number } {
  if (calmMode === 0) return { on: true, vol };
  if (calmMode === 1) return { on: true, vol: Math.min(vol, 0.3) };
  return { on: false, vol };
}

/** What `applyCalm` does to the scene/character reduced-motion flags. */
export function calmMotionPlan(calmMode: number): { sceneReduced: boolean; charFrozen: boolean } {
  return { sceneReduced: calmMode >= 1, charFrozen: calmMode === 2 };
}

/** The `aria-label` of one icon — it MUST reflect the current state, on/off or level. This is the whole
 *  point of the function: a toggle that looks pressed but does not say so is invisible to a screen reader. */
export function computeIconLabel(k: string, s: IconStateSnapshot): string {
  const ic = ICON_BY_KEY.get(k);
  if (!ic) return '';
  // O estado vira SEMPRE um parâmetro (`{v}`), nunca uma concatenação: 'on'/'off' eram palavras inglesas
  // presas numa frase em português, e uma língua que anteponha o estado ao nome precisa do dicionário para
  // reordenar. `nomeDoIcone: estado` é a moldura; o estado é o conteúdo, e ele também é traduzido.
  if (ic.soon) return t('icon.soon', { nome: t(ic.n) });
  const rotulo = (v: string): string => t('icon.state', { nome: t(ic.n), v: t(v) });
  if (k === 'blind') return rotulo(s.modoCego ? 'state.on' : 'state.off');
  if (k === 'tts') return rotulo(s.ttsOn ? 'state.on' : 'state.off');
  if (k === 'libras') return rotulo(s.librasOn ? 'state.on' : 'state.off');
  // TEA e daltonismo usam um nome CURTO aqui, diferente do nome do botão: o rótulo já diz o nível, e
  // repetir a lista de níveis do nome ("(calmo / silencioso)", "(protan/deutan/tritan)") a diria duas vezes.
  // Era assim antes da conversão, com o texto curto embutido — preservado, não reinventado.
  if (k === 'tea') return t('icon.state', { nome: t('icon.tea.short'), v: t(CALM_NAMES[s.calmMode]!) });
  if (k === 'altmove') return rotulo(s.toggleMove ? 'state.on' : 'state.off');
  if (k === 'contrast') return rotulo(CONTRAST_LABELS[s.viz] || 'contrast.off');
  if (k === 'cvd') return t('icon.state', { nome: t('icon.cvd.short'), v: t(CVD_LABELS[s.viz] || 'cvd.off') });
  return t(ic.n);
}

/** The visual state of one icon button. `active` is what becomes `aria-pressed`. */
export interface IconVisual {
  /** `.pi-on` — the yellow "this is on" state. */
  on: boolean;
  /** `.pi-dis` — greyed out (blind/TTS without a private audio output). */
  dis: boolean;
  /** `.pi-calm` — TEA level 1 only (white); level 2 uses `.pi-on` instead. */
  calm: boolean;
  /** `.pi-cvd-protan` | `.pi-cvd-deuter` | `.pi-cvd-tritan`, or '' — the two-tone background IS the on-signal. */
  cvd: string;
  /** aria-pressed: on OR calm OR a CVD tint. */
  active: boolean;
}

/** Pure form of reflectIconBtn's branching. A `soon` icon lands on all-false — it never claims to be on. */
export function computeIconVisual(k: string, s: IconStateSnapshot): IconVisual {
  let on = false, dis = false, calm = false, cvd = '';
  if (k === 'blind') { on = s.modoCego; dis = !s.privateOutput; }
  else if (k === 'tts') { on = s.ttsOn; dis = !s.privateOutput; }
  else if (k === 'libras') { on = s.librasOn; }
  else if (k === 'tea') { on = s.calmMode === 2; calm = s.calmMode === 1; }
  else if (k === 'altmove') { on = s.toggleMove; }
  else if (k === 'contrast') { on = /^hc-direto/.test(s.viz || ''); }
  else if (k === 'cvd') {
    if (s.viz === 'fix-protan') cvd = 'pi-cvd-protan';
    else if (s.viz === 'fix-deuter') cvd = 'pi-cvd-deuter';
    else if (s.viz === 'fix-tritan') cvd = 'pi-cvd-tritan';
  }
  return { on, dis, calm, cvd, active: on || calm || !!cvd };
}

/** The CSS classes reflectIconBtn clears before applying a fresh visual — in the original order. */
export const ICON_STATE_CLASSES: readonly string[] = ['pi-calm', 'pi-cvd-protan', 'pi-cvd-deuter', 'pi-cvd-tritan'];

// --- markup (pure string builders; the DOM shell below just assigns them) ---

/** One `.pi-btn`. `soon` icons get `.pi-soon` and the "under construction" suffix baked into the aria-label.
 *  The label is the RESTING one: reflectIconBtn overwrites it with the stateful label as soon as the bar is
 *  reflected. `ic.n` is an i18n key, so it must be resolved here too — the markup is rendered once at build
 *  time and would otherwise ship the raw key to a screen reader. */
export function iconBtnMarkup(ic: PauseIcon): string {
  return '<button class="pi-btn' + (ic.soon ? ' pi-soon' : '') + '" type="button" data-pi="' + ic.k +
    '" aria-label="' + (ic.soon ? t('icon.soon', { nome: t(ic.n) }) : t(ic.n)) + '">' + ic.e + '</button>';
}

/** The whole icon bar. Used by the pause screen AND by the splash `#title-icons` (which built the same string
 *  by hand in game.js — that duplication dies with this export). */
export function iconsMarkup(): string { return PAUSE_ICONS.map(iconBtnMarkup).join(''); }

/** One `.pm-btn`. Dynamic labels (`letra`/`nivel`) are rendered eagerly and carry NO `data-i18n`, so
 *  i18n.applyDom() cannot overwrite them. */
/**
 * ⚠️ O RÓTULO DINÂMICO ENTRA PRONTO (item 19), e a mudança conserta DUAS coisas de uma vez.
 *
 * A linha era `'📚 Nível ' + level + ' · ' + qlName[level]` — e ela tinha dois defeitos que só se enxergam
 * juntos:
 *
 *   1. FRONTEIRA. `level` vinha de `core/state.quizLevel` e `qlName` de uma tabela do jogo. Um menu de pausa
 *      da ENGINE montava o rótulo de uma atividade de alfabetização — conteúdo pedagógico, não mecânica.
 *   2. IDIOMA. "Nível" é pt-BR CRU dentro de um módulo de engine. O gate do item 14 vigia o `main.js` e não
 *      alcança `ui/`, então esta linha atravessou a i18n inteira sem ser vista. Num build em inglês, o menu
 *      de pausa de uma criança dizia "📚 Nível 2 · …".
 *
 * Agora o jogo entrega a frase montada (`dynLabel`), e a engine só a coloca no botão. O jogo é quem sabe o
 * que é um nível, quem sabe o nome dele e quem sabe em que idioma dizê-lo.
 */
export function pmBtnMarkup(
  b: PauseMenuButton, dynLabel: (b: PauseMenuButton) => string | null, tr: (key: string) => string,
): string {
  const dyn = b.letra || b.nivel;
  const lbl = dynLabel(b) ?? (dyn ? (b.lbl ?? '') : tr('pause.' + b.act));
  return '<button class="pm-btn' + (b.letra ? ' pm-letra' : '') + (b.nivel ? ' pm-nivel' : '') +
    '" role="menuitem" type="button" data-act="' + b.act + '"' +
    (dyn ? '' : (' data-i18n="pause.' + b.act + '"')) + '>' + lbl + '</button>';
}

/**
 * Qual das duas listas o cartão de pausa está mostrando.
 *
 * DUAS listas no markup, UMA visível — e a escondida carrega `hidden`, que a tira da árvore de acessibilidade
 * inteira. É o que faz "um menu por tela" (ADR-0044 §5) valer para quem escuta e não só para quem vê, e é o
 * que permite o anel dar a volta DENTRO da lista visível sem nunca atravessar para a outra.
 */
export type PauseSub = 'raiz' | 'opcoes';

/**
 * Os itens navegáveis de um cartão de pausa — os da lista VISÍVEL, e só eles.
 *
 * Uma constante porque TRÊS módulos a consultam (a navegação em `ui/menu-nav`, a seleção inicial em
 * `ui/shell` e a troca de submenu aqui). Enquanto fosse `.pm-btn` escrito três vezes, bastaria um deles
 * esquecer o `:not([hidden])` para o anel atravessar para a lista invisível — e a criança ouviria itens de um
 * menu que não está na tela.
 */
export const PM_ITENS_VISIVEIS = '.pause-menu:not([hidden]) .pm-btn';

/** O innerHTML de UMA `.pause-menu`: a lista, e só ela. */
export function pauseMenuHtml(
  bs: readonly PauseMenuButton[], sub: PauseSub, dynLabel: (b: PauseMenuButton) => string | null,
  tr: (key: string) => string,
): string {
  return '<div class="pause-menu" role="menu" data-sub="' + sub + '"' + (sub === 'raiz' ? '' : ' hidden') + '>' +
    bs.map((b) => pmBtnMarkup(b, dynLabel, tr)).join('') + '</div>';
}

/**
 * Troca a lista visível de UM cartão de pausa, e põe o cursor no PRIMEIRO item da lista que entrou.
 *
 * Livre (e não um método do `init`) de propósito: `ui/menu-nav` precisa dela para o "não" voltar da lista de
 * opções à raiz, e não tem acesso às tabelas de botões. Como as duas listas já existem no markup, a troca é
 * só DOM — nada a re-renderizar, nada a injetar.
 */
export function mostrarSubmenuDaPausa(sp: HTMLElement, sub: PauseSub): HTMLElement | null {
  sp.querySelectorAll<HTMLElement>('.pause-menu').forEach((m) => { m.hidden = m.dataset.sub !== sub; });
  const primeiro = sp.querySelector<HTMLElement>(PM_ITENS_VISIVEIS);
  sp.querySelectorAll<HTMLElement>('.pm-sel,.pi-sel').forEach((b) => b.classList.remove('pm-sel', 'pi-sel'));
  if (primeiro) primeiro.classList.add('pm-sel');
  return primeiro;
}

/**
 * A BARRA RÁPIDA DE ACESSIBILIDADE — dez alternadores e a legenda que os explica (ADR-0044, item 7).
 *
 * Saiu do cartão de pausa e passou a viver no HUD. O motivo é de uso, não de arrumação: é DURANTE a partida
 * que uma criança precisa mudar um ajuste que está a atrapalhando, e não depois de pausar. E o motivo
 * secundário é estrutural — sem ela, o cartão deixa de ter duas zonas e vira uma LISTA, o que é o que
 * finalmente autoriza o anel (a XAG 106 permite laço para menu linear e o proíbe para grade).
 *
 * A LEGENDA VIAJA JUNTO. Ela é a dica que substitui, para quem não vê, o `title` que só o mouse revela;
 * deixá-la no cartão tornaria a barra do HUD muda.
 */
export function quickBarMarkup(): string {
  return '<div class="pause-icons" role="group" aria-label="' + t('pause.iconBarAria') + '">' + iconsMarkup() +
    '</div><p class="pause-icons-cap" aria-live="polite"></p>';
}

/**
 * O QUE UMA INTENÇÃO SIGNIFICA DENTRO DO MODO `accessibility` (ADR-0044, item 7).
 *
 * O registro listou este modo entre as consequências NEGATIVAS da decisão, e disse por quê: "um modo em que
 * se entra e não se sabe sair é a própria armadilha de que este registro trata — então a saída dele (START ou
 * VOLTAR) é parte da decisão, e não um detalhe de implementação".
 *
 * Daí a forma desta função: SAIR vem primeiro, e vem por DUAS portas. Não é redundância. VOLTAR é a saída de
 * tudo no jogo, e é o que quem já o conhece tenta primeiro; START é o botão que ABRE a pausa, e a pausa é de
 * onde se entrou aqui — quem se perde tenta voltar por onde veio. Ter só uma das duas seria apostar que a
 * criança adivinhe qual delas foi escolhida.
 *
 * E a precedência é decisão também: um controle registra mais de uma borda no mesmo quadro (dedos apertam
 * junto), e nesse quadro `sair` não pode ficar atrás de `ativar`.
 */
export type AcaoNaBarra = 'sair' | 'ativar' | 'andar' | 'nada';
export function acaoNaBarra(k: NavKeys, temStart: boolean): AcaoNaBarra {
  if (temStart || k.no) return 'sair';
  if (k.yes) return 'ativar';
  if (k.up || k.down || k.left || k.right) return 'andar';
  return 'nada';
}

export interface ScreenPauseMarkupOpts {
  /** Screen/player index (0-based); the dialog label and the "· Jogador N" suffix are 1-based. */
  player: number;
  /** Live player count — the suffix only appears in multiplayer. */
  numPlayers: number;
  /** A lista RAIZ: os sete itens do ADR-0044, `resume` primeiro e `quit` último. */
  pmButtons: readonly PauseMenuButton[];
  /** O submenu de opções: os sete painéis de ajuste, com o "Voltar" na frente. */
  optionsButtons: readonly PauseMenuButton[];
  /** Rótulo pronto de um botão DINÂMICO, ou `null` se aquele botão não tem um. Quem monta a frase é o jogo. */
  dynLabel: (b: PauseMenuButton) => string | null;
  t: (key: string) => string;
}

/** The full innerHTML of a `.screen-pause`. Pure — every input is a parameter. */
export function screenPauseMarkup(o: ScreenPauseMarkupOpts): string {
  // O NOME ACESSÍVEL DO DIÁLOGO passa pelo dicionário. Era texto cru, e MEDIDO num jogo em inglês o efeito
  // era este: o título visível dizia "Paused" e o nome do diálogo, "Menu de pausa do jogador 1". Quem enxerga
  // lia em inglês; quem escuta recebia o menu anunciado em português — a mesma assimetria do item 4 do
  // ADR-0044, um nível acima. E `aria-label`, não `aria-labelledby`: o `<h2>` é rótulo VISUAL, e é por isso
  // que escondê-lo num quadro apertado não tira o nome do diálogo de quem escuta.
  return '<div class="pause-card" role="dialog" aria-modal="true" aria-label="' + t('pause.cardAria', { n: o.player + 1 }) + '">' +
    '<h2><span data-i18n="pause.title">' + o.t('pause.title') + '</span>' + (o.numPlayers > 1 ? ' · Jogador ' + (o.player + 1) : '') + '</h2>' +
    pauseMenuHtml(o.pmButtons, 'raiz', o.dynLabel, o.t) +
    pauseMenuHtml(o.optionsButtons, 'opcoes', o.dynLabel, o.t) +
    '<p class="pause-legend"></p></div>';
}

// ---------------------------------------------------------------------------------------------
// Injection contract
// ---------------------------------------------------------------------------------------------

export interface PauseIconsCtx {
  /** Quantos jogadores/telas. Estado de RODADA (ADR-0038): vem da instância que a raiz possui.
   *  Era `numPlayers`, um `let` de `core/state` importado como binding vivo — e um `let` de módulo
   *  é compartilhado por qualquer segundo jogo que a mesma página carregue (D13 do `demos`). */
  getNumPlayers: () => number;
  /** Os jogadores. Estado de RODADA, pelo mesmo motivo. `readonly unknown[]` porque cada consumidor
   *  estreita para a SUA fatia — o tipo real é do jogo, não da engine (ADR-0033). */
  getPlayers: () => readonly unknown[];
  // --- announcements (core/a11y-sr; injected because they reach `document` at call time) ---
  /** aria-live "polite" — every successful toggle announces its NEW state. */
  srSay: (text: string) => void;
  /** aria-live "assertive" — the two refusals (`soon` icon, shared audio output). */
  srAlert: (text: string) => void;

  // --- the per-screen pause menu ---
  /**
   * As BARRAS RÁPIDAS por tela (`.screen-a11y`), na ordem dos jogadores.
   *
   * Existe pelo mesmo motivo de `getPauseScreens`: `buildGameHud` REATRIBUI a array a cada remontagem, então
   * o que se injeta é o getter e não a array. E existe separada da pausa porque, desde o item 7, a barra não
   * mora mais dentro dela — o daltonismo é POR JOGADOR, e refletir os ícones exige achar a barra daquela tela.
   */
  getA11yBars: () => readonly HTMLElement[];
  /** PM_OPTIONS_BTNS — o submenu de opções. Mesma dona, mesmo motivo: ninguém tem duas cópias de uma lista. */
  optionsButtons: readonly PauseMenuButton[];
  /** PM_BTNS — the `.pm-btn` list. Owned by ui/activities-menu; injected, never copied. */
  pmButtons: readonly PauseMenuButton[];
  /** QL_NAME — literacy-level names, for the (dormant) `nivel` button. Same owner as pmButtons. */
  /**
   * O RÓTULO de um botão dinâmico, pronto — ou `null` quando aquele botão não tem um (item 19).
   *
   * Era `quizLevel` (importado de `core/state`) mais `qlName` (tabela do jogo), e este módulo montava a
   * frase. Um menu de pausa da ENGINE não sabe o que é nível de alfabetização, nem em que idioma dizê-lo.
   * Função e não valor, porque o rótulo muda em execução — de nível E de idioma.
   */
  dynLabel: (b: PauseMenuButton) => string | null;
  /** The `.pm-btn` action table. LAZY: `pauseActs` is a `const` declared far below the init site in game.js. */
  getPauseActs: () => Record<string, (() => void) | undefined>;
  /** Records which player opened the menu. `pauseActor` itself stays in game.js — the gamepad, the keyboard
   *  router, openHelp() and openOptions() all read it there. */
  setPauseActor: (i: number) => void;
  /** The live `vpPause` array (game.js rebuilds it on every buildGameHud). Getter, not the array. */
  getPauseScreens: () => readonly Element[];

  // --- blind mode (game.js owns `modoCego` + persistence + the cane/extras rebuild) ---
  getModoCego: () => boolean;
  setModoCego: (on: boolean) => void;

  // --- TTS (platform/audio mixer; the panel refresh lives in ui/settings-audio) ---
  /**
   * O mixer por categoria. NULO até `initAudioMixer()` — `platform/audio` o declara
   * `Record<string, CatState> | null` porque o import dele é PURO (não lê localStorage), e quem inicializa
   * é o boot do consumidor. Este ctx pedia não-nulo, o que era uma promessa que a fonte não faz.
   */
  getAudioCat: () => Record<string, AudioCatState> | null;
  /** Re-applies a category's gain node after `on`/`vol` changed. */
  setCatGain: (k: string) => void;
  /** Repaints the TTS row of the auditory panel. See BUG #1 in the report: in game.js this call is behind a
   *  `typeof reflectTTS==='function'` guard on a symbol that no longer exists, so it never fires. The guard is
   *  ported verbatim as `reflectTtsPanelEnabled` below rather than silently fixed. */
  reflectTtsPanel: () => void;
  /** Verbatim port of game.js's dead guard: `typeof reflectTTS === 'function'`. Pass `false` to preserve
   *  today's behaviour (the panel is NOT refreshed), `true` to restore the intended call. */
  reflectTtsPanelEnabled: boolean;

  // --- Libras (ui/vlibras; both reach `document` at call time) ---
  isLibrasOn: () => boolean;
  toggleLibras: () => void;

  // --- TEA / reduced motion (the `rm` object is co-owned with ui/settings-motion — same reference) ---
  rm: MotionSceneFlags;
  rmKeys: readonly MotionSceneKey[];
  rmChar: readonly MotionCharDef[];
  saveRM: () => void;

  // --- motor + visual (both mutate state and rebake textures in game.js) ---
  setToggleMove: (i: number, on: boolean) => void;
  setPlayerViz: (i: number, mode: string) => void;
}

export interface PauseIconsApi {
  /** Builds one `.screen-pause` (hidden), wired for click + hover/focus caption. Caller appends it. */
  buildScreenPause: (i: number) => HTMLElement;
  /** Monta a BARRA RÁPIDA (`.screen-a11y`) da tela `i`, já fiada. Chamada por ui/hud.ts, uma por tela. */
  buildQuickBar: (i: number) => HTMLElement;
  /** ENTRA no modo `accessibility` da tela `i` — é o que o item `acessibilidade` da pausa faz. */
  entrarNaBarra: (i: number) => void;
  /** SAI do modo e devolve o direcional ao personagem. */
  sairDaBarra: (i: number) => void;
  /** A tela `i` está com o direcional na BARRA em vez de no personagem? Perguntado a cada quadro. */
  naBarraDe: (i: number) => boolean;
  /** Um passo dentro do modo. `temStart` é a borda do botão de pausa — a segunda saída (ADR-0044, item 7). */
  navBar: (i: number, k: NavKeys, temStart?: boolean) => void;
  /** Runs the icon `k` for screen `i`. Does NOT reflect — callers reflect after, as game.js always did. */
  iconAct: (k: string, i: number) => void;
  /** The state-reflecting `aria-label` of icon `k` for screen `i`. */
  iconLabel: (k: string, i: number) => string;
  /** Applies classes + aria-pressed + aria-label to ONE `.pi-btn`. */
  reflectIconBtn: (b: HTMLElement, i: number) => void;
  /** Reflects every `.pi-btn` inside `root` in screen `i`'s scope. `#title-icons` uses i=0 (splash = J1). */
  reflectIconsIn: (root: ParentNode | null, i: number) => void;
  /** Reflects every pause screen (each in its own player's scope). */
  reflectPauseIcons: () => void;
  /** Applies the current TEA level to scene motion, character motion and the five audio categories. */
  applyCalm: () => void;
  getCalmMode: () => number;
  /** Sets the TEA level WITHOUT applying it (applyCalm is the apply step) — for tests and future restore. */
  setCalmMode: (n: number) => void;
  /** Snapshot of everything the label/visual of screen `i` depends on. Exposed for tests and debugging. */
  iconState: (i: number) => IconStateSnapshot;
}

// ---------------------------------------------------------------------------------------------
// DOM-facing shell
// ---------------------------------------------------------------------------------------------

export function initPauseIcons(ctx: PauseIconsCtx): PauseIconsApi {
  // TEA level. It lives HERE (game.js's `let calmMode` had no other reader) and is deliberately NOT persisted
  // — verbatim: game.js never wrote it to storage, even though applyCalm() persists `rm` as a side effect.
  let calmMode = 0;

  const P = (): readonly PausePlayer[] => ctx.getPlayers() as readonly PausePlayer[];

  function hasPrivateOutput(i: number): boolean { return hasPrivateOutputIn(P(), ctx.getNumPlayers(), i); }

  function iconState(i: number): IconStateSnapshot {
    const p = P()[i] || {};
    const cat = ctx.getAudioCat();
    return {
      modoCego: ctx.getModoCego(),
      ttsOn: !!(cat && cat.tts && cat.tts.on),
      librasOn: ctx.isLibrasOn(),
      calmMode,
      toggleMove: !!p.toggleMove,
      viz: p.viz || '',
      privateOutput: hasPrivateOutput(i),
    };
  }

  // --- TEA ---------------------------------------------------------------------------------

  function applyCalm(): void {
    const plan = calmMotionPlan(calmMode);
    for (const k of ctx.rmKeys) ctx.rm[k] = plan.sceneReduced;
    ctx.saveRM();
    // "silencioso" freezes the character too. Iterates the WHOLE players array (not just numPlayers) — verbatim.
    for (const p of P()) for (const c of ctx.rmChar) p[c.prop] = plan.charFrozen;
    const cat = ctx.getAudioCat();
    for (const k of CALM_AUDIO_CATS) {
      const c = cat && cat[k];
      if (!c) continue;
      const next = calmAudioPlan(calmMode, c.vol);
      c.on = next.on; c.vol = next.vol;
      ctx.setCatGain(k);
    }
    // TTS/sonar/guarda/guia stay intact on purpose: TEA is about noise, not about losing navigation.
  }

  // --- icon actions (the dispatcher, as a table) ---------------------------------------------

  const ICON_ACTS: Record<string, (i: number) => void> = {
    blind: () => {
      ctx.setModoCego(!ctx.getModoCego());
      ctx.srSay(t(ctx.getModoCego() ? 'sr.icon.blindOn' : 'sr.icon.blindOff'));
    },
    tts: () => {
      const cat = ctx.getAudioCat();
      if (!cat || !cat.tts) return; // a guarda que `iconLabel` e `applyCalm` já tinham e esta ação não
      cat.tts.on = !cat.tts.on;
      ctx.setCatGain('tts');
      if (ctx.reflectTtsPanelEnabled) ctx.reflectTtsPanel();
      ctx.srSay(t(cat.tts.on ? 'sr.audio.ttsOn' : 'sr.audio.ttsOff'));
    },
    libras: () => {
      ctx.toggleLibras();
      ctx.srSay(t(ctx.isLibrasOn() ? 'sr.icon.librasOn' : 'sr.icon.librasOff'));
    },
    tea: () => {
      calmMode = nextCalmMode(calmMode);
      applyCalm();
      ctx.srSay(t('sr.icon.tea', { v: t(CALM_NAMES[calmMode]!) }));
    },
    altmove: (i) => {
      // verbatim: `players[i].toggleMove` with no `||{}` guard (unlike contrast/cvd below).
      ctx.setToggleMove(i, !P()[i].toggleMove);
    },
    contrast: (i) => {
      const nx = nextContrast((P()[i] || {}).viz);
      ctx.setPlayerViz(i, nx);
      ctx.srSay(t('sr.visual.contrast', { v: t(CONTRAST_LABELS[nx] || 'contrast.off') }));
    },
    cvd: (i) => {
      const nx = nextCvd((P()[i] || {}).viz);
      ctx.setPlayerViz(i, nx.mode);
      ctx.srSay(t('sr.icon.cvd', { v: t(CVD_NAMES[nx.idx]!) }));
    },
  };

  function iconAct(k: string, i: number): void {
    const ic = ICON_BY_KEY.get(k);
    if (ic && ic.soon) {
      ctx.srAlert(t('sr.icon.underConstruction', { nome: t(ic.n) }));
      return;
    }
    if ((k === 'blind' || k === 'tts') && !hasPrivateOutput(i)) {
      ctx.srAlert(t('sr.icon.needsPrivateOutput'));
      return;
    }
    const act = ICON_ACTS[k];
    if (act) act(i);
  }

  // --- reflection --------------------------------------------------------------------------

  function iconLabel(k: string, i: number): string { return computeIconLabel(k, iconState(i)); }

  function reflectIconBtn(b: HTMLElement, i: number): void {
    const k = b.dataset.pi || '';
    const st = iconState(i);
    const v = computeIconVisual(k, st);
    b.classList.remove(...ICON_STATE_CLASSES);
    if (v.calm) b.classList.add('pi-calm');
    if (v.cvd) b.classList.add(v.cvd);
    b.classList.toggle('pi-on', v.on);
    b.classList.toggle('pi-dis', v.dis);
    b.setAttribute('aria-pressed', String(v.active));
    // `soon` buttons keep the label the markup gave them (same string) — no state to report.
    if (!(ICON_BY_KEY.get(k) || {} as PauseIcon).soon) b.setAttribute('aria-label', computeIconLabel(k, st));
  }

  function reflectIconsIn(root: ParentNode | null, i: number): void {
    if (!root) return;
    root.querySelectorAll<HTMLElement>('.pi-btn').forEach((b) => reflectIconBtn(b, i));
  }

  /**
   * Reflete os ícones de TODAS as telas. Varre as BARRAS e não mais os cartões de pausa: desde o item 7 do
   * ADR-0044 os ícones vivem no HUD, e um cartão de pausa não contém `.pi-btn` nenhum.
   */
  function reflectPauseIcons(): void {
    ctx.getA11yBars().forEach((bar, i) => reflectIconsIn(bar, i));
  }

  // --- the pause screen ----------------------------------------------------------------------

  /**
   * Troca a lista visível E ANUNCIA o primeiro item da lista que entrou.
   *
   * O anúncio não é enfeite: quem não enxerga acabou de mudar de menu e o cursor pulou para outro lugar. Sem
   * a fala, a única pista de que a tela mudou seria o silêncio. O índice "N de M" vem junto (item 3), e é ele
   * que diz de quantos itens é a lista nova.
   */
  function anunciarLista(sp: HTMLElement, sub: PauseSub): void {
    const primeiro = mostrarSubmenuDaPausa(sp, sub);
    if (!primeiro) return;
    const itens = [...sp.querySelectorAll<HTMLElement>(PM_ITENS_VISIVEIS)];
    ctx.srSay(anunciarItem(
      { rotulo: primeiro.textContent || '', posicao: 1, total: itens.length }, menuIndexOn,
    ));
  }

  /* ===================== O MODO `accessibility` (ADR-0044, item 7) ===================== */

  /**
   * Quem está com o direcional dirigindo a BARRA em vez do personagem.
   *
   * Vida de RODADA (ADR-0038): mora no closure desta instância, não é persistido, e some com a partida. Um
   * modo de entrada que sobrevivesse ao reinício seria a armadilha voltando pela porta dos fundos — a criança
   * abriria o jogo no dia seguinte e o personagem não andaria.
   */
  const naBarra = new Set<number>();

  /** O cursor da barra da tela `i`, ou o primeiro ícone quando ainda não há cursor. */
  function iconeSelecionado(bar: HTMLElement): HTMLElement | null {
    return bar.querySelector<HTMLElement>('.pi-sel') || bar.querySelector<HTMLElement>('.pi-btn');
  }

  /** Põe o cursor num ícone, escreve a legenda e ANUNCIA — a legenda é o canal de quem não vê o ícone. */
  function selecionarIcone(bar: HTMLElement, el: HTMLElement): void {
    bar.querySelectorAll<HTMLElement>('.pi-sel').forEach((x) => x.classList.remove('pi-sel'));
    el.classList.add('pi-sel');
    const cap = bar.querySelector('.pause-icons-cap');
    if (cap) cap.textContent = legendaDoIcone(bar, el);
    ctx.srSay(legendaDoIcone(bar, el));
  }

  /**
   * ENTRA no modo: o direcional passa a dirigir a barra da tela `i`, e o jogo VOLTA a rodar.
   *
   * O anúncio diz como SAIR, e diz na hora de entrar. É a linha que desarma a armadilha que o próprio
   * ADR-0044 anotou como consequência negativa desta decisão: quem não enxerga aperta a direção, o personagem
   * não anda, e sem esta frase não há nada na tela que explique — porque a tela não é o canal dessa criança.
   */
  function entrarNaBarra(i: number): void {
    const bar = ctx.getA11yBars()[i];
    const primeiro = bar && iconeSelecionado(bar);
    if (!bar || !primeiro) return;
    naBarra.add(i);
    const acts = ctx.getPauseActs();
    if (acts.resume) acts.resume(); // volta à tela normal: o modo é para usar DURANTE a partida
    ctx.srSay(t('sr.a11y.barEnter'));
    selecionarIcone(bar, primeiro);
  }

  /** SAI do modo e devolve o direcional ao personagem. Anuncia, porque a devolução também é informação. */
  function sairDaBarra(i: number): void {
    if (!naBarra.delete(i)) return;
    const bar = ctx.getA11yBars()[i];
    if (bar) {
      bar.querySelectorAll<HTMLElement>('.pi-sel').forEach((x) => x.classList.remove('pi-sel'));
      const cap = bar.querySelector('.pause-icons-cap');
      if (cap) cap.textContent = '';
    }
    ctx.srSay(t('sr.a11y.barExit'));
  }

  /** A tela `i` está com o direcional na barra? É o que o roteamento de entrada pergunta a cada quadro. */
  const naBarraDe = (i: number): boolean => naBarra.has(i);

  /**
   * UM PASSO dentro do modo. `temStart` é a borda do botão que abre a pausa — a segunda saída.
   *
   * A barra é uma fileira, então as QUATRO direções andam nela: para quem navega sem ver, "cima" numa lista
   * de uma linha só não pode ser um beco. E anda em ANEL, como todo menu do jogo desde o item 1.
   */
  function navBar(i: number, k: NavKeys, temStart = false): void {
    if (!naBarra.has(i)) return;
    const bar = ctx.getA11yBars()[i];
    if (!bar) return;
    const acao = acaoNaBarra(k, temStart);
    if (acao === 'sair') { sairDaBarra(i); return; }
    const icones = [...bar.querySelectorAll<HTMLElement>('.pi-btn')];
    if (!icones.length) return;
    const cur = iconeSelecionado(bar);
    const idx = cur ? icones.indexOf(cur) : 0;
    if (acao === 'ativar') { ctx.setPauseActor(i); if (cur) cur.click(); return; }
    if (acao === 'andar') {
      const d = (k.down || k.right) ? 1 : -1;
      selecionarIcone(bar, icones[passoNoAnel(icones.length, idx, d)]);
    }
  }

  function buildScreenPause(i: number): HTMLElement {
    const sp = document.createElement('div');
    sp.className = 'screen-pause';
    sp.hidden = true;
    sp.dataset.player = String(i);
    sp.innerHTML = screenPauseMarkup({
      player: i, numPlayers: ctx.getNumPlayers(), pmButtons: ctx.pmButtons, optionsButtons: ctx.optionsButtons,
      dynLabel: ctx.dynLabel, t,
    });

    sp.addEventListener('click', (e) => {
      const target = e.target as Element | null;
      const b = target && target.closest<HTMLElement>('.pm-btn');
      if (b) {
        ctx.setPauseActor(i);
        const act = b.dataset.act || '';
        // NAVEGAÇÃO DENTRO DO CARTÃO fica aqui, e não na tabela de ações: `options` e `pmback` não fazem nada
        // ao jogo — trocam qual lista está na tela. A tabela vive em `ui/shell`, que não conhece este `sp`.
        if (act === 'options' || act === 'pmback') { anunciarLista(sp, act === 'options' ? 'opcoes' : 'raiz'); return; }
        // `acessibilidade` leva o cursor à BARRA RÁPIDA. Enquanto ela mora dentro do cartão, "entrar no modo"
        // é pôr o cursor nela — e a saída continua sendo a saída da pausa, que é a mesma de sempre. Quando o
        // item 7 levar a barra para o HUD, esta linha o segue; o que o item SIGNIFICA não muda.
        if (act === 'acessibilidade') { entrarNaBarra(i); return; }
        const acts = ctx.getPauseActs();
        const fn = acts[act];
        if (fn) fn();
        return;
      }
    });
    return sp;
  }

  /**
   * A BARRA RÁPIDA de uma tela: os dez alternadores, a legenda, e a fiação dos dois.
   *
   * Ela é IRMÃ da `.screen-exp` e não filha, e isso é a decisão do #82 aplicada: a barra é CONTROLE, não
   * experiência. O modo empatia degrada a experiência de propósito — simulação é criar dificuldade onde a
   * facilidade não existe —, e degradar o que existe para DAR acesso seria o contrário do que ele serve.
   */
  function buildQuickBar(i: number): HTMLElement {
    const bar = document.createElement('div');
    bar.className = 'screen-a11y';
    bar.dataset.player = String(i);
    bar.innerHTML = quickBarMarkup();
    // FORA DA ORDEM DE TABULAÇÃO durante a partida (ADR-0044, item 7). Dez paradas entre a criança e o jogo
    // seria o preço de deixá-los lá — e o alcance por teclado não se perde: ele passa a ser o modo
    // `accessibility`, que se abre pela pausa. A barra do TÍTULO não é afetada: lá não se está jogando, e o
    // `tabindex` é posto AQUI, no elemento, e não no markup que as duas compartilham.
    bar.querySelectorAll<HTMLElement>('.pi-btn').forEach((b) => { b.tabIndex = -1; });

    const cap = bar.querySelector('.pause-icons-cap');
    bar.addEventListener('click', (e) => {
      const ib = (e.target as Element | null)?.closest<HTMLElement>('.pi-btn');
      if (!ib) return;
      ctx.setPauseActor(i);
      iconAct(ib.dataset.pi || '', i);
      reflectPauseIcons(); // must run BEFORE reading the label back — that is what makes the caption honest
      if (cap) cap.textContent = legendaDoIcone(bar, ib);
    });

    // Legenda = o `aria-label` do botão, para que passar o mouse ou focar diga a MESMA verdade que um leitor
    // de tela anunciaria. Uma fonte só para quem vê e para quem escuta.
    //
    // E ELA SOME AO SAIR. Antes ficava: a última explicação apontada permanecia por cima do jogo até alguém
    // apontar outra. Numa barra que agora vive na TELA DE JOGO isso é uma faixa de texto parada em cima da
    // partida — o Dev viu e disse o que é: explicação só enquanto o mouse estiver no botão.
    //
    // A EXCEÇÃO É O CURSOR DO MODO `accessibility`: quando ele está pousado num ícone, a legenda é a única
    // coisa que diz onde ele está, e apagá-la ao mexer o mouse cegaria o modo. Daí a pergunta pelo `.pi-sel`.
    const limpar = (): void => { if (cap && !bar.querySelector('.pi-sel')) cap.textContent = ''; };
    bar.querySelectorAll<HTMLElement>('.pi-btn').forEach((b) => {
      const show = (): void => { if (cap) cap.textContent = legendaDoIcone(bar, b); };
      b.addEventListener('mouseenter', show);
      b.addEventListener('focus', show);
      b.addEventListener('mouseleave', limpar);
      b.addEventListener('blur', limpar);
    });
    return bar;
  }

  return {
    buildScreenPause, buildQuickBar, entrarNaBarra, sairDaBarra, naBarraDe, navBar,
    iconAct, iconLabel, reflectIconBtn, reflectIconsIn, reflectPauseIcons,
    applyCalm, getCalmMode: () => calmMode, setCalmMode: (n) => { calmMode = n; }, iconState,
  };
}
