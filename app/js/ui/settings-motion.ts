// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-motion.ts — the Motion panel (#animation overlay): reduced motion (WCAG 2.3.3 + Pause/Stop/Hide 2.2.2) per
// CHARACTER (walk/breath/flavour) and per SCENE (parallax/decor/items/particles), the stop/resume-all master button, the
// player selection and the CRT look (scanlines/vignette/corners), which lives on the SAME screen. What a choice IS lives in
// ./motion-choices.js. INJECTED via initSettingsMotion(ctx): $ (selector), srSay, store (persistence), matchMedia (the
// operating system's reduced-motion answer, ADR-0232), frontOverlay/toggleBtn (helpers shared with the sibling panels), and optionally rm/saveRM/rmKeys/rmChar (reduced-motion
// state, which a cartridge may share by reference). CRT/applyCrt (render/crt.ts) are imported DIRECTLY.
import { toggleLabel, toggleAria } from './dom.js';

import { CRT, CRT_DEFAULT, applyCrt } from '../render/crt.js';
import { defaultReducedMotion, type MediaQuery } from '../core/setting-defaults.js';
import { markChanged, markMenuChanged } from './changed-mark.js';
import type { Translate } from '../core/i18n.js';
import { mountSteps, updateSteps, nextStep, controlRow, labelRow, sectionHeader } from './panel-widgets.js';
import type { PanelShellCtx } from './panel-shell.js';
import type { Store } from '../platform/storage.js';

import { SCENE_KEYS, CHARACTER_ANIMATIONS, readStoredScene, storeScene } from './motion-scene.js';
/*
 * 📌 THE PURE HALF LIVES IN `ui/motion-choices` (ADR-0221), and the SUITE pointed at the seam:
 * `tests/settings-motion.node.test.js` exercises exactly these names, and the node project mounts no document.
 *
 * ⚠️ NO ALIAS: a re-export would keep alive a path nothing in here uses and make the surface snapshot lie, because it
 * does not see re-exports (issue #204).
 */
import {
  RM_LABEL, CRT_LBL, CRT_ROUND_LEVELS, clampSelectedPlayer, allMotionFrozen, motionMasterLabel,
  sceneMotionAnnouncement, crtToggleAnnouncement, crtLevelLabel, crtRoundAnnouncement, stopResumeAllAnnouncement,
} from './motion-choices.js';
import type {
  MotionSceneKey as ChaveDeCenaLeaf,
  MotionCharProp as PropDoPersonagemLeaf,
  MotionCharDef as DefDoPersonagemLeaf,
  MotionPlayer as JogadorDeMovimentoLeaf,
  MotionSceneFlags as BandeirasDeCenaLeaf,
} from './motion-scene.js';

/*
 * ⚠️ THE VOCABULARY LIVES IN `ui/motion-scene`, which owns the VALUES (the other way round is an import cycle), AND
 * THE NAMES STAY HERE too.
 *
 * ⚠️ As ALIASES and not re-exports (`export type { X } from …`): the public-surface snapshot leaves re-exports out on
 * purpose, so re-exporting would make the five names DISAPPEAR from this module's snapshot — and the gate would read a
 * change of home as a removal, a break that does not exist. The alias says the same and stays visible.
 */
export type MotionSceneKey = ChaveDeCenaLeaf;
export type MotionCharProp = PropDoPersonagemLeaf;
export type MotionCharDef = DefDoPersonagemLeaf;
export type MotionPlayer = JogadorDeMovimentoLeaf;
export type MotionSceneFlags = BandeirasDeCenaLeaf;

export interface SettingsMotionCtx {
  /** Translates in the page's language — the root's translator (ADR-0232 D3). REQUIRED: text built from nowhere is a raw key. */
  t: Translate;
  /** How many players/screens. ROUND state (ADR-0038): it comes from the instance the root owns — a module `let` would
   *  be shared by any second game the same page loads. */
  getNumPlayers: () => number;
  /** The players. ROUND state, for the same reason. `readonly unknown[]` because each consumer narrows to ITS slice —
   *  the real type is the game's, not the engine's (ADR-0033). */
  getPlayers: () => readonly unknown[];
  /** DOM selector (ui/dom.ts `$`). */
  $: <T extends Element = Element>(sel: string) => T | null;
  /** "Polite" screen-reader announcement (core/a11y-sr.ts). */
  srSay: (text: string) => void;
  /**
   * The page's store (ADR-0232, issue #207) — only what is needed here: storing the per-player flags, and reading and
   * writing the scene flags when the host does not share its own `rm`.
   */
  store: Pick<Store, 'setBool' | 'getJSON' | 'setJSON'>;
  /**
   * The browser's media query (`win.matchMedia`), asked for `prefers-reduced-motion` at every mark and every reset — the
   * default follows the operating system NOW, not at boot. MANDATORY and injected (ADR-0232, ADR-0227): this module
   * reaches no global, and an optional port would let a host forget it and turn the animation back on at the reset.
   */
  matchMedia: MediaQuery;
  /** Stacks the overlay (z-index) + wires the explanation footer — shared by every settings panel. */
  frontOverlay: (el: HTMLElement | null) => void;
  /** Returns focus to whoever opened the dialog (ui/settings-panel `restoreFocus`). Injected, not a fixed `#opt-*`: that
   *  id does not exist in the document, so closing would leave focus on `<body>`. */
  restoreFocus?: (id: string) => boolean;

  /** Reflects on/off on a button (is-on class + aria-pressed) — a generic helper used by several master buttons. */
  toggleBtn: (el: HTMLElement, on: boolean) => void;
  /*
   * ⚠️ THE FOUR ARE OPTIONAL (ADR-0106 §4, step 1): the engine can answer them itself, because none of them holds a
   * choice of the game — the scene keys are the whole `MotionSceneKey` union, the character targets the three
   * `MotionCharProp`s, and the flags are read and written under an ENGINE storage key with an ENGINE default. See
   * `ui/motion-scene`.
   *
   * ⚠️ Whoever injects still rules, which is why this is ADDITIVE: a cartridge that passes its own object keeps sharing
   * it by reference with the modules that read it every frame. A game that passes nothing still gets reduced motion.
   */
  /** SCENE reduced motion (parallax/decor/items/particles) — a LIVE object, mutated in place. */
  rm?: MotionSceneFlags;
  /** Persists `rm` (localStorage 'inclusionist.reducedmotion.v1'). */
  saveRM?: () => void;
  /** The 4 scene keys. */
  rmKeys?: readonly MotionSceneKey[];
  /** The 3 CHARACTER reduced-motion targets. */
  rmChar?: readonly MotionCharDef[];
  /**
   * DOES THIS GAME HAVE A CHARACTER THAT WALKS, BREATHES OR PLAYS AROUND? (ADR-0153, `reducedCharacterMotion`.)
   *
   * 🔴 Without it the character section would mount in EVERY game — three switches to stop the walk, the breath and the
   * flourishes of a character a board game does not have. It is ADR-0145's subjectless button. `false` removes the
   * section, and its rows stop counting for the master button and the reset.
   *
   * ⚠️ OPTIONAL, defaulting to `true`: whoever mounts this panel outside `createGame` is unchanged.
   */
  hasCharacter?: () => boolean;
  /**
   * The GAME's word for its character (ADR-0153: what applies carries the game's word), the section's title. Optional:
   * absent, the section keeps the engine's own title, as for a panel mounted outside `createGame`.
   */
  characterLabel?: () => string | null;
  /**
   * Moves the rows' prose to the footer (`ui/settings-panel` → `fillExplain`). Called on EVERY render.
   *
   * ⚠️ Relabelling a row puts its `.opt-hint` back inside it — so without this call the explanation appears twice, in
   * the footer and under the label, from the first click. `CLAUDE.md` §4 records exactly this (issue #109).
   *
   * Optional in the signature because a consumer can mount the panel without the shell (a test): without the shell
   * there is no footer to duplicate.
   */
  fillExplain?: (card: HTMLElement | null) => void;
}

/*
 * 🎯 NO "SOON" MECHANISM: it had no subject — no path let a cartridge supply a coming-soon row, so the only thing
 * keeping it alive would be tests. The `ui.soon` key stays in the three dictionaries, because the no-parentheses label
 * gate still reads it.
 */


// ---------------------------------------------------------------------------------------------------------
// PURE logic — testable in node, no `document`.
// ---------------------------------------------------------------------------------------------------------


/**
 * The NAME of each part of this inside, which is what mounting reconciles by.
 *
 * 📌 A key and not a position: the character rows appear and disappear with the cartridge (ADR-0153), so mounting has to
 * know WHICH row is which to relabel the one that stayed and remove the one that lost its subject.
 */
const partOfChar = (prop: string): string => `char:${prop}`;
const partOfScene = (key: string): string => `scene:${key}`;
const partOfCrt = (key: string): string => `crt:${key}`;

/** A part of the inside: the key, how it is built, and how its words are rewritten. */
interface MotionPart {
  readonly key: string;
  readonly build: () => HTMLElement;
  readonly write: (el: HTMLElement) => void;
}

/** What mounting needs to know, already translated — the kit does not decide language, it builds shape. */
export interface MotionInsideSpec {
  /** The character section's title, or `null` when this game has no character (ADR-0153). */
  readonly charTitle: string | null;
  /** ⚠️ The character's tag is DIFFERENT, not by oversight: its rows hold per PLAYER, the other two sections' hold for
   *  everyone. A single tag would say the same thing about different things. */
  readonly charTag: string;
  readonly charRows: readonly { readonly prop: string; readonly label: string }[];
  readonly sceneTitle: string;
  readonly sceneRows: readonly { readonly key: string; readonly label: string }[];
  readonly crtTitle: string;
  /** The for-everyone tag, shared by the scene and CRT sections. */
  readonly allTag: string;
  readonly crtToggles: readonly { readonly key: string; readonly label: string }[];
  /** The corners' name and positions, for the steps control (ADR-0151). */
  readonly roundSpec: () => { readonly label: string; readonly values: readonly string[]; readonly current: number };
}

/**
 * Mounts this panel's inside and reconciles it afterwards — creates what is missing, rewrites what stayed, removes what
 * lost its subject. It NEVER moves a node that already exists.
 *
 * 🔴 Rebuilding costs the child their place: with the cursor on the rounded corners, a click on the neighbouring row
 * would destroy the control and drop focus on `<body>`. ⚠️ And moving also blurs, which is why this function INSERTS at
 * the right position instead of appending and reordering: a node that changes parent is removed and re-added, and the
 * browser takes its focus away on removal.
 */
function mountMotionInside(ctx: PanelShellCtx, list: HTMLElement, spec: MotionInsideSpec): void {
  reconcile(list, motionParts(ctx, spec));
}

/**
 * What this inside HAS, in order — a different question from how the document gets there.
 *
 * ⚠️ Separate from `reconcile` so each stays under McCabe's ceiling of 10 (ADR-0221): each is a sentence with a name.
 */
function motionParts(ctx: PanelShellCtx, spec: MotionInsideSpec): MotionPart[] {
  const sectionPart = (key: string, title: string, tag: string, rows: number): MotionPart | null =>
    (rows === 0 ? null : {
      key,
      build: () => sectionHeader(ctx, title, tag, rows) ?? ctx.create('h3'),
      write: (el) => {
        el.textContent = title + ' ';
        const mark = ctx.create('span');
        mark.className = 'panel-sub__tag';
        mark.textContent = tag;
        el.appendChild(mark);
      },
    });

  const switchPart = (key: string, id: string, label: string, mark: readonly [string, string]): MotionPart => ({
    key,
    build: () => {
      const { row: newRow, controle: switchButton } = controlRow(ctx, { id, label: label, ariaLabel: label });
      switchButton.setAttribute(mark[0], mark[1]);
      return newRow;
    },
    // ⚠️ ONLY THE WORDS. The state (class, `aria-pressed`, the button's text) is written by the panel's reflect, which
    // knows the value — writing it here would give two answers to the same question.
    write: (el) => labelRow(el, { id, label: label, ariaLabel: label }),
  });

  const parts: MotionPart[] = [];
  const charHeader = sectionPart('sec:char', spec.charTitle ?? '', spec.charTag, spec.charTitle ? spec.charRows.length : 0);
  if (charHeader) parts.push(charHeader);
  for (const r of spec.charRows) parts.push(switchPart(partOfChar(r.prop), `motion-char-${r.prop}`, r.label, ['data-rmc', r.prop]));
  const sceneHeader = sectionPart('sec:scene', spec.sceneTitle, spec.allTag, spec.sceneRows.length);
  if (sceneHeader) parts.push(sceneHeader);
  for (const r of spec.sceneRows) parts.push(switchPart(partOfScene(r.key), `motion-scene-${r.key}`, r.label, ['data-rm', r.key]));
  const crtHeader = sectionPart('sec:crt', spec.crtTitle, spec.allTag, spec.crtToggles.length + 1);
  if (crtHeader) parts.push(crtHeader);
  for (const r of spec.crtToggles) parts.push(switchPart(partOfCrt(r.key), `crt-${r.key}`, r.label, ['data-crt-tgl', r.key]));
  parts.push({
    key: partOfCrt('round'),
    build: () => {
      // ⚠️ NO SEPARATE LABEL (ADR-0130 errata): the steps control writes «◀ Cantos arredondados: pequeno ▶» across the
      // whole row, and a label beside it would say the name twice.
      const row = ctx.create('div');
      row.className = 'ctrl-row ctrl-row--passos';
      const steps = mountSteps(ctx, spec.roundSpec());
      steps.setAttribute('data-crt', 'round');
      row.appendChild(steps);
      return row;
    },
    write: (el) => {
      const steps = el.querySelector<HTMLElement>('[data-passos]');
      if (steps) updateSteps(steps, spec.roundSpec());
    },
  });

  return parts;
}

/**
 * The document brought in line with the list: creates what is missing AT THE RIGHT POSITION, rewrites what stayed,
 * removes what is no longer asked for.
 *
 * ⚠️ IT NEVER MOVES A NODE THAT ALREADY EXISTS, and not for thrift: a node that changes parent is removed and re-added,
 * and the browser takes its focus away on removal — the defect building nodes exists to avoid, through another door.
 */
function reconcile(list: HTMLElement, parts: readonly MotionPart[]): void {
  let previous: HTMLElement | null = null;
  for (const part of parts) {
    let el = list.querySelector<HTMLElement>(`[data-motion-part="${part.key}"]`);
    if (!el) {
      el = part.build();
      el.dataset.motionPart = part.key;
      list.insertBefore(el, previous ? previous.nextSibling : list.firstChild);
    }
    part.write(el);
    previous = el;
  }
  const keep = new Set(parts.map((p) => p.key));
  for (const el of [...list.querySelectorAll<HTMLElement>('[data-motion-part]')]) {
    if (!keep.has(el.dataset.motionPart ?? '')) el.remove();
  }
}


// ---------------------------------------------------------------------------------------------------------
// Module state — the selected player.
// ---------------------------------------------------------------------------------------------------------

let selectedPlayer = 0;
export function getSelectedPlayer(): number { return selectedPlayer; }
/** Called from outside (e.g. the pause menu's "anim" entry) before open(). */
export function setSelectedPlayer(i: number): void { selectedPlayer = i; }

// ---------------------------------------------------------------------------------------------------------
// Render/DOM — a thin shell around the pure logic above.
// ---------------------------------------------------------------------------------------------------------

export interface SettingsMotionApi {
  render: () => void;
  open: () => void;
  close: () => void;
}

export function initSettingsMotion(ctx: SettingsMotionCtx): SettingsMotionApi {
  const { t } = ctx;
  /*
   * ⚠️ RESOLVED ONCE, AT BOOT, not on every use. `rm` is mutated in place and shared by REFERENCE with whoever draws
   * the scene; resolving it on every read would create a new object per call, the switch would stop reaching the
   * drawing, and there would be no error at all — the menu would say reduced and the scene would keep moving.
   */
  const rm: MotionSceneFlags = ctx.rm ?? readStoredScene(ctx.store, defaultReducedMotion(ctx.matchMedia));
  const rmKeys: readonly MotionSceneKey[] = ctx.rmKeys ?? SCENE_KEYS;
  const allCharAnimations: readonly MotionCharDef[] = ctx.rmChar ?? CHARACTER_ANIMATIONS;
  /** The character targets that HAVE A SUBJECT in this game — read on every use, because the cartridge changes on `mount()`. */
  const rmChar = (): readonly MotionCharDef[] => (ctx.hasCharacter?.() === false ? [] : allCharAnimations);
  const saveRM: () => void = ctx.saveRM ?? (() => storeScene(ctx.store, rm));

  function reflectMotionBtn(): void {
    const b = ctx.$<HTMLElement>('#opt-animation');
    if (b) b.classList.toggle('is-on', rmKeys.some((k) => rm[k]));
  }

  function updateMotionMaster(): void {
    reflectMotionBtn();
    const m = ctx.$<HTMLElement>('#motion-master');
    if (!m) return;
    const player = (ctx.getPlayers() as readonly MotionPlayer[])[selectedPlayer];
    const allFrozen = allMotionFrozen(rmKeys, rm, rmChar(), player);
    m.textContent = motionMasterLabel(t, allFrozen);
    ctx.toggleBtn(m, allFrozen);
  }

  const kitCtx = (list: HTMLElement): PanelShellCtx => ({
    find: (sel) => ctx.$<HTMLElement>(sel),
    create: (tag) => list.ownerDocument.createElement(tag),
  });

  const roundSpec = () => ({ label: t(CRT_LBL.round), values: [0, 1, 2].map((level) => crtLevelLabel(t, level)), current: CRT.round });

  /** Each switch's STATE — what the kit does not write, because the panel knows the value. */
  function reflectSwitches(el: HTMLElement): void {
    const player = (ctx.getPlayers() as readonly MotionPlayer[])[selectedPlayer];
    const writeSwitch = (sel: string, on: boolean, name: string): void => {
      const b = el.querySelector<HTMLElement>(sel);
      if (!b) return;
      ctx.toggleBtn(b, on);
      b.textContent = toggleLabel(t, on);
      b.setAttribute('aria-label', toggleAria(t, name, on));
    };
    // ⚠️ "Animated" is the OPPOSITE of `rm`/`player[prop]`, which store "reduced motion". The faithful name is in
    // `allMotionFrozen`, and the inversion lives here, in one place.
    for (const c of rmChar()) writeSwitch(`[data-rmc="${c.prop}"]`, !(player && player[c.prop]), t(c.lbl));
    for (const k of rmKeys) writeSwitch(`[data-rm="${k}"]`, !rm[k], t(RM_LABEL[k]));
    writeSwitch('[data-crt-tgl="scan"]', !!CRT.scan, t(CRT_LBL.scan));
    writeSwitch('[data-crt-tgl="vig"]', !!CRT.vig, t(CRT_LBL.vig));
  }

  /** The listeners, ONCE and by delegation: the character rows come and go with the cartridge (ADR-0153), and wiring
   *  button by button on every render would pile one listener per pass onto each button that survived. */
  let wired = false;
  function wireOnce(el: HTMLElement): void {
    if (wired) return;
    wired = true;
    el.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement | null)?.closest<HTMLElement>('button');
      if (!b || !el.contains(b)) return;
      const crt = b.dataset.crtTgl as 'scan' | 'vig' | undefined;
      if (crt) {
        CRT[crt] = CRT[crt] ? 0 : 1;
        applyCrt();
        reflectSwitches(el);
        refreshMarks();
        ctx.srSay(crtToggleAnnouncement(t, t(CRT_LBL[crt]), !!CRT[crt]));
        return;
      }
      const prop = b.dataset.rmc as MotionCharProp | undefined;
      if (prop) {
        const p = (ctx.getPlayers() as readonly MotionPlayer[])[selectedPlayer];
        p[prop] = !p[prop];
        ctx.store.setBool('incl_' + prop + '_p' + selectedPlayer, !!p[prop]);
        render();
        return;
      }
      const k = b.dataset.rm as MotionSceneKey | undefined;
      if (!k) return;
      rm[k] = !rm[k];
      saveRM();
      render();
      updateMotionMaster();
      ctx.srSay(sceneMotionAnnouncement(t, t(RM_LABEL[k]), rm[k]));
    });
    el.addEventListener('passo', (ev) => {
      const stepper = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-crt="round"]');
      if (!stepper) return;
      const next = nextStep(CRT.round, CRT_ROUND_LEVELS.length, (ev as CustomEvent<number>).detail);
      // ⚠️ AT THE END NOTHING IS ANNOUNCED: repeating the largest level to someone already there would sound like a step.
      if (next === CRT.round) return;
      CRT.round = next;
      applyCrt();
      updateSteps(stepper, roundSpec());
      refreshMarks();
      ctx.srSay(crtRoundAnnouncement(t, t(CRT_LBL.round), CRT.round));
    });
  }

  function render(): void {
    const el = ctx.$<HTMLElement>('#motion-list');
    if (!el) return;
    selectedPlayer = clampSelectedPlayer(selectedPlayer, ctx.getNumPlayers());

    // No tabs — each player edits only their own. The strip stays hidden and empty.
    const tabs = ctx.$<HTMLElement>('#animation-players');
    if (tabs) {
      tabs.hidden = true;
      tabs.textContent = '';
    }

    mountMotionInside(kitCtx(el), el, {
      // ⚠️ THE SEAT SUFFIX is a key, and reuses the card's `pause.cardSeat`: it is the SAME sentence for the SAME person,
      // and two keys would be two places for it to drift between languages.
      charTitle: rmChar().length
        ? (ctx.characterLabel?.() ?? 'Personagem') + (ctx.getNumPlayers() > 1 ? t('pause.cardSeat', { n: selectedPlayer + 1 }) : '')
        : null,
      // 📌 Three section labels are still raw and are in this module's raw-prose ledger — fixing them in passing would
      // mix two decisions in one commit.
      charTag: 'por jogador',
      charRows: rmChar().map((c) => ({ prop: c.prop, label: t(c.lbl) })),
      sceneTitle: 'Cena',
      sceneRows: rmKeys.map((k) => ({ key: k, label: t(RM_LABEL[k]) })),
      crtTitle: 'Estética CRT',
      allTag: t('rm.sec.all'),
      crtToggles: [{ key: 'scan', label: t(CRT_LBL.scan) }, { key: 'vig', label: t(CRT_LBL.vig) }],
      roundSpec,
    });
    reflectSwitches(el);
    wireOnce(el);

    updateMotionMaster();
    refreshMarks();
    // The prose goes back to the footer after the rows change (CLAUDE.md §4, #109).
    ctx.fillExplain?.(ctx.$<HTMLElement>('#animation .overlay__card'));
  }

  /**
   * The left-the-default mark (ADR-0029), against the COMPUTED default — not against `false`.
   *
   * On a machine whose owner asked for less motion, the animation rows' default is FROZEN. Marking against `false` would
   * accuse "changed" on rows the child never touched, and send exactly them to undo their own system's preference. A
   * wrong mark is worse than no mark, and here it would err in the costliest direction.
   */
  function refreshMarks(): void {
    const reducedByDefault = defaultReducedMotion(ctx.matchMedia);
    const el = ctx.$<HTMLElement>('#motion-list');
    const player = (ctx.getPlayers() as readonly MotionPlayer[])[selectedPlayer];
    const changedFlags: boolean[] = [];
    const markRow = (sel: string, changed: boolean): void => {
      changedFlags.push(changed);
      markChanged(t, el?.querySelector<HTMLElement>(sel)?.closest<HTMLElement>('.ctrl-row') ?? null, changed);
    };
    for (const c of rmChar()) markRow(`[data-rmc="${c.prop}"]`, !!(player && player[c.prop]) !== reducedByDefault);
    for (const k of rmKeys) markRow(`[data-rm="${k}"]`, !!rm[k] !== reducedByDefault);
    markRow('[data-crt-tgl="scan"]', !!CRT.scan !== !!CRT_DEFAULT.scan);
    markRow('[data-crt-tgl="vig"]', !!CRT.vig !== !!CRT_DEFAULT.vig);
    markRow('[data-crt="round"]', CRT.round !== CRT_DEFAULT.round);
    markMenuChanged(t, ctx.$<HTMLElement>('[data-act="anim"]'), changedFlags);
  }

  // ---- reset THIS menu's defaults (ADR-0028) ----
  //
  // The only menu whose default is NOT a constant: the animation rows' default is what the operating system asks for
  // (`prefers-reduced-motion`). Returning `false` here would TURN ANIMATION BACK ON for whoever already asked for less
  // motion — the reset alone would do what WCAG 2.3.3 exists to prevent. That is why it calls `defaultReducedMotion`
  // and does not write the value by hand.
  //
  // The scope is ALL players, as in the mobility menu: the panel edits one at a time, but the reset belongs to the menu,
  // and leaving player 2 frozen because the open tab was player 1's would give two states one name.
  const resetBtn = ctx.$<HTMLButtonElement>('#animation-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    const reducedByDefault = defaultReducedMotion(ctx.matchMedia);
    for (const k of rmKeys) rm[k] = reducedByDefault;
    saveRM();
    (ctx.getPlayers() as readonly MotionPlayer[]).forEach((p, i) => {
      for (const c of rmChar()) {
        p[c.prop] = reducedByDefault;
        ctx.store.setBool('incl_' + c.prop + '_p' + i, reducedByDefault);
      }
    });
    CRT.scan = CRT_DEFAULT.scan; CRT.vig = CRT_DEFAULT.vig; CRT.round = CRT_DEFAULT.round;
    applyCrt();
    render();
    ctx.srSay(t('sr.motion.reset'));
  });

  function open(): void {
    const ov = ctx.$<HTMLElement>('#animation');
    if (!ov) return;
    render();
    ov.hidden = false;
    ctx.frontOverlay(ov);
    const f = ov.querySelector<HTMLElement>('button');
    if (f) f.focus();
  }

  function close(): void {
    const ov = ctx.$<HTMLElement>('#animation');
    if (!ov) return;
    ov.hidden = true;
    if (ctx.restoreFocus && ctx.restoreFocus('animation')) return;
    const b = ctx.$<HTMLElement>('#opt-animation');
    if (b) b.focus(); // fallback: this id does not exist in the document today (a hook for a future bar)
  }

  const master = ctx.$<HTMLElement>('#motion-master');
  if (master) master.addEventListener('click', () => {
    const player = (ctx.getPlayers() as readonly MotionPlayer[])[selectedPlayer];
    const allFrozen = allMotionFrozen(rmKeys, rm, rmChar(), player);
    const next = !allFrozen;
    for (const k of rmKeys) rm[k] = next;
    saveRM();
    if (player) for (const c of rmChar()) {
      player[c.prop] = next;
      ctx.store.setBool('incl_' + c.prop + '_p' + selectedPlayer, next);
    }
    render();
    ctx.srSay(stopResumeAllAnnouncement(t, next));
  });

  reflectMotionBtn(); // initial state (e.g. prefers-reduced-motion switches it on by default)

  return { render, open, close };
}
