// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/settings-audio — Audio panel (Estágio 4, #audio overlay): extracted from game.js's renderAudio()/
// renderAudioSinks()/catRowHTML/wireCatControls/renderNavSound/reflectAudioMaster + the TTS-panel functions that
// platform/tts.ts already documents as belonging here (reflectTTS/populateTTSEngines/populateTTSVoices). Pure
// logic (category markup, volume->percent, sink option/label, cane-div validation, pt-BR voice filtering) is
// separated from the thin DOM-touching render/wire functions. DI via initSettingsAudio(ctx): `$`, `srSay`,
// `store` (narrow get/set), the live sound/mixer primitives from platform/audio.ts (getSoundOn/setSoundOn/
// getVolume/setVolume/getAudioCat/setCatGain), the injected `tts` panel API (platform/tts.ts), and the SHARED
// game.js helpers other panels also use (`toggleBtn`, `getNumPlayers`/`getPlayers`) or that live outside audio
// entirely (`getModoCego`/`setModoCego`, `getCaneBlockDiv`/`setCaneBlockDiv` — core collision state; the widgets
// live in this overlay, the state does not). Overlay open/close plumbing (#audio hidden toggle, frontOverlay,
// focus management, Escape, `ensureAC()`) is the shared infra every settings panel uses and stays in game.js,
// which calls `renderAudio()` from its `openAudio()`. `reflectModoCego`/`reflectTts` are also exported because
// game.js's own `setModoCego()` and the pause-menu icon bar (`iconAct('tts'|'blind', …)`) call them directly.

/** Minimal DOM-selector shape (matches ui/dom.ts's `$`). */
import { toggleLabel } from './dom.js';
import { t } from '../core/i18n.js';
import { DEFAULTS } from '../core/state.js';
// O módulo INTEIRO, e não os nomes soltos: `menuIndexOn` é ligação viva e `setMenuIndexOnValue` a muda — ler
// pelo namespace deixa isso à vista em cada uso, em vez de parecer uma constante importada.
import * as state from '../core/state.js';
import { markChanged, markMenuChanged } from './changed-mark.js';
import { defaultAudioCat } from '../platform/audio-mixer.js';
import type { PlayerView } from '../core/entity.js';
import type { PlayerAudioOut } from '../platform/audio-sonar.js'; // ADR-0039: o dono declara `_ac`/`_acOut`
import type { DomQuery } from '../core/dom-query.js';
import type { PanelShellCtx } from './panel-shell.js';
import { controlRow, labelRow, type ControlRowSpec } from './panel-widgets.js';
/*
 * 🔴 A SECÇÃO DA VOZ MUDOU DE CASA para `ui/voice-settings` (ADR-0221, issue #203): metade deste ficheiro era sobre FALA — o
 * interruptor da narração, o motor, a voz, o ritmo, o índice falado e o botão de teste — e a outra metade sobre categorias de
 * som, bengala, modo cego e saídas. As duas nunca precisaram uma da outra.
 */
import { createVoiceSettings, type TtsPanel } from './voice-settings.js';

// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

/** Minimal platform/storage.ts shape this module needs (get/set only — no direct localStorage access). */
export interface AudioStore {
  get(key: string, fallback?: string | null): string | null;
  set(key: string, value: string | number | boolean): boolean;
}

/*
 * 🔴 A METADE PURA MUDOU DE CASA para `ui/audio-choices` (ADR-0221, issue #203): o que uma escolha É — a lista de
 * categorias, a conta do volume, o catálogo de motores, o filtro de vozes, o rótulo de uma saída — não precisa de documento
 * nenhum, e este ficheiro é sobre ENCONTRAR os treze controles e ligá-los. Quem já tinha feito o corte era a suíte: o teste
 * node importava exactamente aqueles nomes e o de navegador conduzia este resto.
 */
import {
  type AudioCatDef, type AudioCatState,
  NAV_CATS, GEN_CATS, volPercent, navMasterVolume, parseCaneDiv, caneDivMessage,
  sinksSupported, sinkOptionLabel, sinkSelectValue,
} from './audio-choices.js';

/**
 * Saída de áudio dedicada de um jogador: o id do dispositivo e o AudioContext/ganho que ele abriu.
 *
 * O id é da entidade (é preferência do jogador, persistida); o par `_ac`/`_acOut` é do
 * `platform/audio-sonar`, que os cria. Daí a intersecção em vez de três chaves numa vista só.
 */
export type SinkPlayer = PlayerView<'audioSink'> & PlayerAudioOut;

export interface SettingsAudioCtx {
  /** DOM selector (querySelector), injected — never reaches `document` globally. */
  $: DomQuery;
  /** Screen-reader "polite" announcement (core/a11y-sr's srSay), injected. */
  srSay: (msg: string) => void;
  /** Persistence (platform/storage.ts) — only the TTS engine/voice choice and the per-player audio sink live
   *  here; the mixer categories persist through `setCatGain` (platform/audio.ts already saves them). */
  store: AudioStore;
  /*
   * 🔴 O NAVEGADOR CHEGA EM TRÊS PORTAS OBRIGATÓRIAS, e não é alcançado (ADR-0227; Dev, 23/09: «(a)»). Este era
   * o último módulo do passo 7d com `globalReach` acima de zero — `document`, `window.speechSynthesis` e
   * `navigator.mediaDevices` —, e o `ui/voice-settings`, que saiu deste mesmo ficheiro, mede zero por RECEBER o
   * navegador em quatro portas.
   *
   * ⚠️ OBRIGATÓRIAS, e a distinção que separa isto de «opcionais que não oferecem»: um hospedeiro sem vozes
   * responde `voices: () => []` e o painel já sabe dizer «este navegador não consegue» na língua da criança —
   * isso é o hospedeiro a FALAR. Uma porta ausente é o hospedeiro em SILÊNCIO, e um campo esquecido é
   * indistinguível de um campo respondido «não» (ADR-0224).
   */
  /**
   * Cria um elemento MANTENDO o tipo — o `<select>` das saídas responde `.value`, a lista de vozes precisa de
   * `<option>`.
   *
   * 📌 Chama-se `newElement` e não `criar` como o do `PanelShellCtx`, e a divergência é deliberada: um nome que
   * NASCE nasce em inglês (ADR-0219), e o do kit é superfície publicada que sai na fase 7. Os dois convergem
   * nessa release; até lá este casa com o vizinho que já existe, o `newOption` do `ui/voice-settings`.
   */
  newElement: <K extends keyof HTMLElementTagNameMap>(tag: K) => HTMLElementTagNameMap[K];
  /** A síntese de fala DESTE aparelho. Sem vozes, `voices` devolve uma lista vazia — que é uma resposta. */
  speech: {
    voices: () => readonly SpeechSynthesisVoice[];
    speakSample: (sample: string, chosen: SpeechSynthesisVoice | null) => void;
    whenVoicesChange: (again: () => void) => void;
  };
  /** As saídas de áudio deste aparelho, e o que ele consegue fazer com elas. */
  audioOutputs: {
    /** Este navegador sabe ENUMERAR saídas? */
    canList: () => boolean;
    /** Este navegador sabe ENCAMINHAR som para uma saída escolhida? (precisa de um AudioContext.) */
    canRoute: () => boolean;
    /** As saídas já conhecidas, sem pedir permissão — muitas vêm sem nome, e isso é o desenho do navegador. */
    list: () => Promise<readonly MediaDeviceInfo[]>;
    /** Pede permissão para que as saídas tenham NOME, e devolve-as. */
    detect: () => Promise<readonly MediaDeviceInfo[]>;
  };
  /** Category catalog (platform/audio-mixer.ts's AUDIO_CATS) — pure data, injected like game.js's own import. */
  audioCats: readonly AudioCatDef[];
  /** Shared helper (game.js): toggles a button's .is-on/aria-pressed. Used by many other panels too — not ours. */
  toggleBtn: (b: HTMLElement, on: boolean) => void;
  /** Shared: current player count (core/state.ts's numPlayers, read live via game.js). */
  getNumPlayers: () => number;
  /** Shared: the live players array (core/state.ts) — only `.audioSink`/`._ac`/`._acOut` are touched here. */
  getPlayers: () => SinkPlayer[];
  /** Master mute (platform/audio.ts's soundOn), read/write live via game.js's re-export. */
  getSoundOn: () => boolean;
  setSoundOn: (on: boolean) => void;
  /** Master volume 0..1 (platform/audio.ts's volume). */
  getVolume: () => number;
  setVolume: (v: number) => void;
  /** The live per-category mixer state (platform/audio.ts's audioCat) — mutated in place, never reassigned. */
  getAudioCat: () => Record<string, AudioCatState> | null;
  /** Re-applies a category's gain to the audio graph AND persists it (platform/audio.ts's setCatGain). */
  setCatGain: (cat: string) => void;
  /** Narration engine/voice panel API (platform/tts.ts's createTts() instance). */
  tts: TtsPanel;
  /** Core collision state (NOT owned by this panel — core/collision.ts reads it via isModoCego). The toggle's
   *  widget lives inside #audio; the state and its gameplay side effects (setupExtras) stay in game.js. */
  getBlindMode: () => boolean;
  setBlindMode?: (on: boolean) => void;
  /** Core collision state (cane hit spacing). Same reasoning as modo cego. */
  getCaneBlockDiv: () => number;
  setCaneBlockDiv: (div: number) => void;
  /**
   * Move a prosa das linhas para o rodapé (`ui/settings-panel` → `fillExplain`). Chamado a CADA render.
   *
   * ⚠️ NÃO É OPCIONAL POR ELEGÂNCIA: `fillExplain` roda uma vez quando o overlay é frontalizado e move o
   * `.opt-hint` de dentro de cada linha para o rodapé. Este painel RECONSTRÓI as linhas, e as linhas novas
   * voltam com a prosa lá dentro — então a explicação aparece duas vezes, no rodapé e sob o rótulo, a
   * partir do primeiro clique. O `CLAUDE.md` §4 regista exatamente isto, e a issue #109 já o consertou
   * uma vez noutros painéis.
   *
   * Opcional na assinatura porque um consumidor pode montar o painel sem a casca (um teste, o segundo
   * consumidor): sem casca não há rodapé para duplicar.
   */
  fillExplain?: (card: HTMLElement | null) => void;
}

export interface SettingsAudioApi {
  /** Re-renders the whole #audio overlay content (master, categories, nav-sound, TTS panel, sinks, modo-cego and
   *  cane-div sync) and re-wires whatever it (re)creates. Idempotent; game.js's openAudio() calls it every open. */
  renderAudio: () => void;
  /** Refreshes the #opt-modocego button. Exported because game.js's setModoCego() calls it directly. */
  reflectBlindMode: () => void;
  /** Refreshes the #opt-tts button + #tts-engine selection. Exported because the pause-menu icon bar's
   *  iconAct('tts', …) toggles audioCat.tts.on itself and then calls this. */
  reflectTts: () => void;
}

/**
 * MONTA O INTERIOR DESTE PAINEL — os treze controles e os dois contentores que ele alcança e nunca criou.
 *
 * 🔴 É O MAIOR CONTRATO INVISÍVEL DOS OITO. 📏 Medido em 2026-09-11: este ficheiro procura `#audio-master`,
 * `#audio-master-vol`, `#navsound-master`, `#navsound-list`, `#opt-modocego`, `#cane-div`, `#opt-menuindex`,
 * `#opt-tts`, `#tts-engine`, `#tts-voice`, `#tts-vol`, `#opt-tts-test`, `#audio-detect` e `#audio-sinks` — e
 * nada no tipo o diz. O markup vivia no `app/index.html`, que saiu com o cartucho (#111); desde então o painel
 * de acessibilidade AUDITIVA abria com o cartão, o título e o botão de repor.
 *
 * ⚠️ E A TAG DE CADA UM IMPORTA, o que torna este o pior sítio para adivinhar: `#cane-div`, `#tts-engine` e
 * `#tts-voice` têm de ser `<select>` — o painel escreve `.value` neles —, e os três volumes têm de ser
 * `<input type=range>`. Num `<button>`, escrever `.value` não dá erro nenhum: cria uma propriedade que
 * ninguém lê, e a escolha da criança some em silêncio.
 *
 * 📌 A ORDEM É A DECISÃO (ADR-0044 §2), e ela vai do geral para o particular: o som primeiro, porque é o que
 * mais gente procura; a navegação sonora a seguir, com o seu volume acima da lista que ele governa; depois o
 * modo cego e a bengala, que andam juntos; a voz inteira num bloco, do interruptor ao teste; e as saídas de
 * áudio por último, porque são escolha de APARELHO e não preferência.
 *
 * ⚠️ `#opt-sound` NÃO É CRIADO AQUI, e a ausência é deliberada: ele é o espelho deste ajuste na barra rápida,
 * fora do painel. O `reflectMaster` alcança-o com guarda (`if (sb)`), porque um jogo pode não ter barra.
 *
 * Idempotente: chamar duas vezes reaproveita o que já existe em vez de o duplicar.
 */
export function mountAudioInside(ctx: PanelShellCtx, card: HTMLElement, lista: HTMLElement): void {
  // Each entry is either a control row or a CONTAINER the panel fills with rows of its own.
  const pieces: (ControlRowSpec | { readonly container: string; readonly label?: string })[] = [
    /*
     * 🔴 A COMPOSIÇÃO DO ADR-0151 E DAS ERRATAS DELE (2026-09-12), na ordem do geral para o particular:
     *   · o MODO CEGO primeiro, porque é o modo em que os outros sons passam a ser a tela — e SEM a dica: «é
     *     redundante. Quem precisa sabe o que é»;
     *   · a BENGALA ao lado dele (e só num jogo que responde que alguém anda, ADR-0153);
     *   · o SONAR, a GUARDA e a GUIA, cada um com o seu interruptor e o seu volume: são a lista da casca;
     *   · a NARRAÇÃO e o seu volume, com o ÍNDICE FALADO logo a seguir, porque é a narração que ele encurta.
     * 🔴 O SOM e o VOLUME GERAIS MUDARAM-SE para o painel «Áudio» (`mountSoundInside`): o Dev primeiro tirou-os
     * («Volume geral é o do computador») e no mesmo dia devolveu-os — «toggle + barra para som geral voltam» —, e
     * voltam para o painel do som, não para o da acessibilidade. SAIU o VOLUME DA NAVEGAÇÃO, que era um segundo
     * lugar para os três volumes da lista (um lugar por escolha, D2 do registo).
     */
    // ⚠️ Their own short keys, not the bar's `icon.blind`/`icon.tts`: those carry «(navegação sonora)» and «(TTS)», and
    // a row keeps no explanation in parentheses (ADR-0158).
    { id: 'opt-modocego', label: t('audio.modocego') },
    { id: 'cane-div', label: t('audio.cane'), hint: t('audio.cane.dica'), shape: 'escolha' },
    { container: '@lista' }, // a lista da casca: sonar, guarda e guia
    { id: 'opt-tts', label: t('audio.narracao'), hint: t('audio.tts.dica') },
    { id: 'tts-vol', label: t('audio.ttsVol'), shape: 'cursor' },
    // ADR-0183 §1, ADR-0196: the speech rate, 254 to 504 by 50 — six positions, so a list (ADR-0130 erratum)
    { id: 'tts-ppm', label: t('audio.ttsPpm'), hint: t('audio.ttsPpm.dica'), shape: 'escolha' },
    // ADR-0185: the child picks the voice, among the voices that speak the language — a list, since English passes five
    { id: 'tts-voz', label: t('audio.voz'), shape: 'escolha' },
    { id: 'opt-menuindex', label: t('audio.menuindex'), hint: t('audio.menuindex.dica') },
    /*
     * 🔴 SAÍRAM QUATRO LINHAS em 2026-09-12 (ADR-0151), pelas palavras do Dev:
     *   · o MOTOR, a VOZ e o TESTAR VOZ — «quem escolhe a voz é o jogo (cartucho), não o jogador. Jogador só
     *     habilita/desabilita o TTS»;
     *   · as SAÍDAS DE ÁUDIO POR JOGADOR e o «detectar» — «navegadores não são bons nisso».
     * 📌 A fiação do `initSettingsAudio` para esses ids CONTINUA e está guardada (`if (el)`): um jogo com
     * marcação própria não parte. O que muda é que a engine deixou de OFERECER a escolha à criança.
     */
  ];

  /*
   * ⚠️ REETIQUETA EM VEZ DE SALTAR o que já existe, e é por isso que esta função é chamada também do
   * `render()` de cada abertura.
   *
   * 🔴 📏 MEDIDO NUM NAVEGADOR COM `lang="en"` em 2026-09-12: este painel servia o TÍTULO em inglês e as
   * LINHAS em português, na mesma tela. A moldura foi corrigida quando `MountPanelSpec.rotulos` passou a
   * resolver-se a cada abertura; o interior ficou para trás, porque corria uma vez e capturava o texto do
   * intervalo de arranque — `initI18n` aplica o idioma de recuo de forma síncrona e PEDE o preferido, que
   * chega depois. Nenhum teste unitário o apanhava: todos correm num idioma só.
   */
  // ADR-0158: the rows go BEFORE the reset, never after it — the reset is the panel's last item, and «Voltar» its first.
  const actions = card.querySelector<HTMLElement>(':scope > .overlay__actions');
  for (const piece of pieces) {
    if ('container' in piece) {
      if (piece.container === '@lista') { card.insertBefore(lista, actions); continue; }
      const jaHa = ctx.find('#' + piece.container);
      if (jaHa) {
        if (piece.label) jaHa.setAttribute('aria-label', piece.label);
        continue;
      }
      const c = ctx.create('div');
      c.id = piece.container;
      c.className = 'ctrl-list';
      c.setAttribute('role', 'group');
      if (piece.label) c.setAttribute('aria-label', piece.label);
      card.insertBefore(c, actions);
      continue;
    }
    const alreadyThere = ctx.find('#' + piece.id);
    if (alreadyThere) {
      const linha = alreadyThere.closest<HTMLElement>('.ctrl-row');
      if (linha) labelRow(linha, piece);
      continue;
    }
    card.insertBefore(controlRow(ctx, piece).row, actions);
  }
}

/**
 * MONTA O INTERIOR DO PAINEL «ÁUDIO» (ADR-0151 §2 item 4): o som geral — interruptor e volume — e, a seguir, a
 * lista da casca com as quatro categorias de gosto (música, ambiente, interacção, earcons).
 *
 * ⚠️ OS IDS SÃO OS QUE `initSettingsAudio` JÁ ESCUTA (`#audio-master`, `#audio-master-vol`, `#audio-list`): o
 * painel mudou de sítio e o contrato invisível não. E a mesma regra de ordem: montar ANTES do `init`.
 * Idempotente e reetiquetável, como o irmão auditivo.
 */
export function mountSoundInside(ctx: PanelShellCtx, card: HTMLElement, lista: HTMLElement): void {
  const actions = card.querySelector<HTMLElement>(':scope > .overlay__actions');
  const rows: ControlRowSpec[] = [
    { id: 'audio-master', label: t('audio.som'), hint: t('audio.som.dica') },
    { id: 'audio-master-vol', label: t('audio.volume'), shape: 'cursor' },
  ];
  for (const piece of rows) {
    const alreadyThere = ctx.find('#' + piece.id);
    if (alreadyThere) {
      const linha = alreadyThere.closest<HTMLElement>('.ctrl-row');
      if (linha) labelRow(linha, piece);
      continue;
    }
    card.insertBefore(controlRow(ctx, piece).row, lista.parentNode === card ? lista : actions);
  }
  if (lista.parentNode !== card) card.insertBefore(lista, actions);
}

// ---------------------------------------------------------------------------------------------
// DOM-facing (thin) — requires `document`/injected ctx
// ---------------------------------------------------------------------------------------------

export function initSettingsAudio(ctx: SettingsAudioCtx): SettingsAudioApi {
  // ⚠️ PADRÃO DA ENGINE (ADR-0106 §4): quem injecta manda; quem não injecta deixa de ficar sem modo cego.
  // O `setBlindModeValue` faz as três coisas que o `core/state` diz que um setter faz — grava, persiste, avisa
  // — e nada mais: os efeitos (refazer os extras do nível) são reação, e quem reage assina o evento.
  const setModoCego = ctx.setBlindMode ?? state.setBlindModeValue;

  let audioDevices: MediaDeviceInfo[] = [];

  /*
   * ⚠️ O NAVEGADOR VIAJA COMO QUATRO FUNÇÕES, e não como um global alcançado lá dentro: um módulo NOVO que alcança
   * `document` ou `window` é recusado pela catraca do passo 7d (o tecto do alcance é ZERO). Este ficheiro continua a
   * alcançá-los — é dívida declarada dele —, e o que passa para baixo são portas.
   */
  const voice = createVoiceSettings(ctx, {
    newOption: () => ctx.newElement('option'),
    systemVoices: () => [...ctx.speech.voices()],
    speakSample: (sample, chosen) => ctx.speech.speakSample(sample, chosen),
    whenVoicesChange: (again) => ctx.speech.whenVoicesChange(again),
  });

  function reflectMaster(): void {
    const b = ctx.$<HTMLButtonElement>('#audio-master');
    if (b) {
      b.classList.toggle('is-on', ctx.getSoundOn());
      b.setAttribute('aria-pressed', String(ctx.getSoundOn()));
      b.textContent = toggleLabel(ctx.getSoundOn()); // the dictionary's words, no glyph in the name (ADR-0159 rule 12)
    }
    const v = ctx.$<HTMLInputElement>('#audio-master-vol');
    if (v) v.value = String(volPercent(ctx.getVolume()));
    const sb = ctx.$<HTMLElement>('#opt-sound');
    if (sb) ctx.toggleBtn(sb, ctx.getSoundOn());
  }

  /**
   * The kit's ctx comes from the LIST NODE itself, not from a global `document` nor from a new contract field —
   * `ownerDocument` is the document that list lives in, which is where its rows have to be born. Same shape as
   * `ui/settings-caa`, and it is what removes this file's reach to `document` without touching `SettingsAudioCtx`.
   */
  const kitCtx = (list: HTMLElement): PanelShellCtx => ({
    find: (sel) => ctx.$<HTMLElement>(sel),
    create: (tag) => list.ownerDocument.createElement(tag),
  });

  /**
   * The same document, but KEEPING the element type.
   *
   * 📌 `PanelShellCtx.criar` is `string → HTMLElement` on purpose: the shell only ever appends generic nodes, and
   * widening it would be a one-way door on a published shape (ADR-0172). The sinks section needs a `<select>` that
   * answers `.value`, so the typed factory lives HERE, over the same `ownerDocument`, instead of the contract
   * growing a field for one caller.
   */
  const makerFor = (host: HTMLElement) =>
    <K extends keyof HTMLElementTagNameMap>(tag: K): HTMLElementTagNameMap[K] =>
      host.ownerDocument.createElement(tag);

  /**
   * ONE CATEGORY ROW, in nodes: label, volume slider and toggle.
   *
   * 📌 NOT A KIT ROW, and not by taste: 📏 measured on 2026-09-23, `controlRow` builds «a label, a hint and ONE
   * control» and this row carries TWO — the volume and the on/off of the same category. Same reason the visual
   * panel's four paper-colour row stayed hand-built: inventing a shape for it would be giving a second answer to
   * the question «what is a row».
   */
  function buildCatRow(kit: PanelShellCtx, k: string): HTMLElement {
    const row = kit.create('div');
    row.className = 'ctrl-row';
    const text = kit.create('span');
    text.appendChild(kit.create('strong'));
    row.appendChild(text);
    const box = kit.create('span');
    box.style.cssText = 'display:flex;gap:.5rem;align-items:center;flex-shrink:0';
    const vol = kit.create('input');
    vol.className = 'vol';
    vol.setAttribute('type', 'range');
    vol.setAttribute('min', '0');
    vol.setAttribute('max', '100');
    vol.setAttribute('step', '5');
    vol.setAttribute('data-avol', k);
    box.appendChild(vol);
    const toggle = kit.create('button');
    toggle.className = 'mode-btn switch';
    toggle.setAttribute('type', 'button');
    toggle.setAttribute('aria-pressed', 'false');
    toggle.setAttribute('data-acat', k);
    box.appendChild(toggle);
    row.appendChild(box);
    return row;
  }

  /** Creates what is missing IN THE RIGHT POSITION, rewrites the words of what stayed, removes what is no longer asked for. */
  function mountCatRows(list: HTMLElement, keys: readonly string[]): void {
    const kit = kitCtx(list);
    let previous: HTMLElement | null = null;
    // ⚠️ WHAT SURVIVES IS WHAT THE HOST STILL NAMES, not simply what is in `keys`. A row whose category lost its
    // name would otherwise stay on screen with the old label — asked for by the key list, offered by nobody.
    const named = new Set<string>();
    for (const k of keys) {
      const c = ctx.audioCats.find((x) => x.k === k);
      if (!c) continue; // a category this host does not name: what has no name is not offered
      named.add(k);
      let row = list.querySelector<HTMLElement>(`[data-acat="${k}"]`)?.closest<HTMLElement>('.ctrl-row') ?? null;
      if (!row) {
        row = buildCatRow(kit, k);
        // ⚠️ INSERTED in place, never appended and reordered: a node that changes parent is removed and put back,
        // and the browser blurs it on removal — that would take the cursor from whoever is setting the volume.
        list.insertBefore(row, previous ? previous.nextSibling : list.firstChild);
      }
      const label = t(c.lbl);
      const strong = row.querySelector<HTMLElement>('strong');
      if (strong) strong.textContent = label;
      row.querySelector(`[data-avol="${k}"]`)?.setAttribute('aria-label', t('audio.cat.volumeDe', { c: label }));
      row.querySelector(`[data-acat="${k}"]`)?.setAttribute('aria-label', label);
      previous = row;
    }
    for (const b of [...list.querySelectorAll<HTMLElement>('[data-acat]')]) {
      if (!named.has(b.dataset.acat ?? '')) b.closest('.ctrl-row')?.remove();
    }
  }

  /** The STATE of each row — the volume where it is and the toggle saying what it says. */
  function reflectCatRows(list: HTMLElement, keys: readonly string[]): void {
    const state = ctx.getAudioCat();
    if (!state) return;
    for (const k of keys) {
      const a = state[k];
      if (!a) continue;
      const vol = list.querySelector<HTMLInputElement>(`input[data-avol="${k}"]`);
      if (vol) vol.value = String(volPercent(a.vol));
      const toggle = list.querySelector<HTMLElement>(`button[data-acat="${k}"]`);
      if (toggle) { toggle.classList.toggle('is-on', a.on); toggle.setAttribute('aria-pressed', String(a.on)); }
    }
  }

  /** The listeners, ONCE per list and by delegation — rows come and go, the list stays. */
  function wireCatControls(el: HTMLElement): void {
    if (el.dataset.catsWired) return;
    el.dataset.catsWired = '1';
    el.addEventListener('click', (ev) => {
      const b = (ev.target as HTMLElement | null)?.closest<HTMLElement>('button[data-acat]');
      const k = b?.dataset.acat;
      if (!b || !k) return;
      const state = ctx.getAudioCat(); if (!state || !state[k]) return;
      state[k].on = !state[k].on;
      ctx.setCatGain(k);
      b.classList.toggle('is-on', state[k].on);
      b.setAttribute('aria-pressed', String(state[k].on));
      refreshMarks(); // the mark follows the CHANGE, not only the redraw — see the note in refreshMarks
    });
    el.addEventListener('input', (ev) => {
      const s = (ev.target as HTMLElement | null)?.closest<HTMLInputElement>('input[data-avol]');
      const k = s?.dataset.avol;
      if (!s || !k) return;
      const state = ctx.getAudioCat(); if (!state || !state[k]) return;
      state[k].vol = (+s.value) / 100;
      state[k].on = true;
      ctx.setCatGain(k);
      const bb = el.querySelector<HTMLButtonElement>('button[data-acat="' + k + '"]');
      if (bb) { bb.classList.add('is-on'); bb.setAttribute('aria-pressed', 'true'); }
      refreshMarks();
    });
  }

  function renderCategoryList(sel: string, keys: readonly string[]): void {
    const el = ctx.$<HTMLElement>(sel);
    const state = ctx.getAudioCat();
    if (!el || !state) return;
    mountCatRows(el, keys);
    reflectCatRows(el, keys);
    wireCatControls(el);
    // The prose goes back to the footer after the rows change (CLAUDE.md §4, #109) — in the card of WHOEVER holds
    // this list: since ADR-0151 there are two panels, and the other one's footer is not this child's.
    ctx.fillExplain?.(el.closest<HTMLElement>('.overlay__card'));
  }

  function renderNavSound(): void {
    renderCategoryList('#navsound-list', NAV_CATS);
    const m = ctx.$<HTMLInputElement>('#navsound-master');
    const state = ctx.getAudioCat();
    if (m && state) m.value = String(navMasterVolume(state, NAV_CATS));
  }

  // 📌 As duas perguntas são do HOSPEDEIRO desde o ADR-0227, e continuam DUAS porque produzem frases
  // diferentes: «este navegador não consegue» e «não há aparelho nenhum» não são a mesma notícia para quem
  // procura uns auscultadores (era um dos cinco ramos cegos que a sonda deste painel achou em 23/09).
  const hasEnumerateDevices = (): boolean => ctx.audioOutputs.canList();
  const hasAudioContextCtor = (): boolean => ctx.audioOutputs.canRoute();

  function renderSinks(devices: readonly MediaDeviceInfo[]): void {
    const el = ctx.$<HTMLElement>('#audio-sinks');
    if (!el) return;
    // 📌 The document comes from the list node, never from the global one — same shape as the rest of this file
    // since the conversion to nodes, and it is what removes the reach to `document` without asking the contract
    // for a new field (ADR-0221 step 7d).
    const make = makerFor(el);
    while (el.firstChild) el.removeChild(el.firstChild);
    if (!devices.length) {
      const supported = sinksSupported(hasEnumerateDevices(), hasAudioContextCtor());
      // ⚠️ TWO SENTENCES, not one: «this browser CANNOT do it» and «there is no device yet» are different things to
      // a child who is looking for their own headphones, and the dictionary has always had both.
      const hint = make('p');
      hint.className = 'opt-hint';
      hint.textContent = t(supported ? 'audio.sinksHint' : 'audio.sinksUnsupported');
      el.appendChild(hint);
      return;
    }
    const players = ctx.getPlayers();
    const n = Math.max(1, ctx.getNumPlayers());
    for (let i = 0; i < n; i++) {
      const p = players[i];
      const row = make('div'); row.className = 'ctrl-row';
      const lbl = make('label'); lbl.textContent = t('audio.playerN', { n: i + 1 }); lbl.htmlFor = 'sink-p' + i;
      const sel = make('select'); sel.className = 'vol'; sel.id = 'sink-p' + i;
      const o0 = make('option'); o0.value = ''; o0.textContent = t('audio.sinkShared'); sel.appendChild(o0);
      devices.forEach((d, k) => {
        const o = make('option'); o.value = d.deviceId; o.textContent = sinkOptionLabel(d, k); sel.appendChild(o);
      });
      sel.value = sinkSelectValue(p);
      sel.addEventListener('change', () => {
        if (!p) return;
        p.audioSink = sel.value || null;
        ctx.store.set('incl_sink_p' + i, p.audioSink || '');
        if (p._ac) { try { p._ac.close(); } catch (e) { /* noop */ } p._ac = null; p._acOut = null; }
        ctx.srSay(t(p.audioSink ? 'sr.audio.sinkChanged' : 'sr.audio.sinkDefault', { n: i + 1 }));
      });
      row.appendChild(lbl); row.appendChild(sel); el.appendChild(row);
    }
  }

  async function enumerateSinks(): Promise<void> {
    // sem pedir permissão: só as saídas já conhecidas
    try { audioDevices = [...await ctx.audioOutputs.list()]; } catch (e) { /* a porta recusou; a lista fica como está */ }
    renderSinks(audioDevices);
  }

  async function detectAudioDevices(): Promise<void> {
    // ⚠️ A LISTA ESVAZIA-SE quando a detecção falha, e o `enumerateSinks` acima NÃO a esvazia: ali um erro é
    // «não consegui perguntar» e aqui é «a criança pediu e a resposta é nenhuma». As duas frases que o painel
    // desenha a seguir são diferentes, e por isso os dois `catch` também são.
    try { audioDevices = [...await ctx.audioOutputs.detect()]; } catch (e) { audioDevices = []; }
    renderSinks(audioDevices);
  }

  function reflectModoCego(): void {
    const b = ctx.$<HTMLButtonElement>('#opt-modocego');
    if (b) { ctx.toggleBtn(b, ctx.getBlindMode()); b.textContent = toggleLabel(ctx.getBlindMode()); }
  }

  function renderAudio(): void {
    reflectMaster();
    renderCategoryList('#audio-list', GEN_CATS);
    renderNavSound();
    reflectModoCego();
    voice.render();
    const cd = ctx.$<HTMLSelectElement>('#cane-div');
    if (cd) cd.value = String(ctx.getCaneBlockDiv());
    void enumerateSinks(); // sem await no original: dispara e segue (lista assíncrona atualiza sozinha)
    refreshMarks();
  }

  /**
   * A marca de "saiu do padrão" (ADR-0029).
   *
   * Chamada de dentro dos HANDLERS de mudança, e não só do `renderAudio()`. Pendurei-a primeiro no render, e
   * no jogo a marca não aparecia: mexer numa categoria atualiza aquela linha sozinha, sem redesenhar o painel.
   * O ADR-0029 já avisava disso — "pode envelhecer na tela se um painel esquecer de atualizar depois de uma
   * mudança" — e eu escrevi o aviso e caí nele na mesma tarde. A regra que sobra: a marca anda com quem
   * ESCREVE o valor, nunca com quem desenha.
   *
   * O recorte é o MESMO do reset deste menu, e isso não é economia —
   * é a regra: só pode ser marcado o que tem padrão em DEFAULTS/`defaultAudioCat`. O motor de voz e a saída
   * de áudio por jogador não têm, porque são escolha de DISPOSITIVO e não preferência restaurável; marcá-los
   * exigiria inventar uma segunda opinião sobre o que é "padrão" para um fone.
   */
  function refreshMarks(): void {
    const state = ctx.getAudioCat();
    const didChange: boolean[] = [];
    const mark = (sel: string, changed: boolean): void => {
      didChange.push(changed);
      markChanged(ctx.$<HTMLElement>(sel)?.closest<HTMLElement>('.ctrl-row') ?? null, changed);
    };
    mark('#opt-modocego', ctx.getBlindMode() !== DEFAULTS.blindMode);
    mark('#cane-div', ctx.getCaneBlockDiv() !== DEFAULTS.caneBlockDiv);
    // ⚠️ DUAS MARCAS DE MENU, uma por painel: a de «Áudio» acesa por um sonar mudado mandaria a criança
    // procurar no painel errado.
    const fromSound: boolean[] = [];
    for (const c of ctx.audioCats) {
      const d = defaultAudioCat(c.k);
      const a = state?.[c.k];
      const changedHere = !!a && (a.on !== d.on || a.vol !== d.vol);
      if ((GEN_CATS as readonly string[]).includes(c.k)) {
        fromSound.push(changedHere);
        markChanged(ctx.$<HTMLElement>(`[data-acat="${c.k}"]`)?.closest<HTMLElement>('.ctrl-row') ?? null, changedHere);
      } else mark(`[data-acat="${c.k}"]`, changedHere);
    }
    markMenuChanged(ctx.$<HTMLElement>('[data-act="audio"]'), didChange);
    markMenuChanged(ctx.$<HTMLElement>('[data-act="som"]'), fromSound);
  }

  // ----- widgets estáticos (existem sempre no #audio; fiados UMA vez, nunca recriados por renderAudio) -----

  const audioMasterBtn = ctx.$<HTMLButtonElement>('#audio-master');
  if (audioMasterBtn) audioMasterBtn.addEventListener('click', () => {
    const next = !ctx.getSoundOn();
    ctx.setSoundOn(next);
    reflectMaster();
    ctx.srSay(t(next ? 'sr.audio.soundOn' : 'sr.audio.soundOff'));
  });
  const audioMasterVol = ctx.$<HTMLInputElement>('#audio-master-vol');
  if (audioMasterVol) audioMasterVol.addEventListener('input', () => {
    const v = (+audioMasterVol.value) / 100;
    ctx.setVolume(v);
    if (v > 0 && !ctx.getSoundOn()) { ctx.setSoundOn(true); reflectMaster(); }
  });

  const navMasterEl = ctx.$<HTMLInputElement>('#navsound-master');
  if (navMasterEl) navMasterEl.addEventListener('input', () => {
    const v = (+navMasterEl.value) / 100;
    const state = ctx.getAudioCat();
    if (state) NAV_CATS.forEach((k) => { state[k].vol = v; state[k].on = true; ctx.setCatGain(k); });
    renderNavSound();
  });

  /*
   * ⚠️ ESTE BOTÃO ERA O ÚNICO DESTE PAINEL QUE NÃO ANUNCIAVA. Medido em 2026-09-08: os cinco irmãos daqui
   * anunciam (som, TTS, divisor da bengala, índice de menu, saída de áudio) e o modo cego não — ele parecia
   * anunciar porque UM cartucho o fazia a partir do próprio `setModoCego`, e o painel herdava o efeito.
   *
   * ⚠️ E ISSO PASSOU A EXPOR SILÊNCIO no mesmo dia: desde que o campo ganhou padrão da engine
   * (`setBlindModeValue`, que grava/persiste/avisa e NÃO fala), um jogo que não injecta o seu próprio setter
   * ficava com este botão mudo. Um alternador que muda estado sem o dizer é invisível para quem usa leitor de
   * tela — a mesma família de defeito que o `reflectTTS` e o `reflectModoCego` já custaram aqui.
   *
   * O anúncio pertence a QUEM É ACCIONADO, não ao setter: `core/state` diz que o setter faz três coisas e só
   * três. ⚠️ Consequência de lockstep, escrita para não se descobrir depois: quando o `game-platformer` subir
   * de versão, tem de TIRAR o `srSay` do `setModoCego` dele, senão a criança ouve o estado duas vezes.
   */
  const mcBtn = ctx.$<HTMLButtonElement>('#opt-modocego');
  if (mcBtn) {
    mcBtn.addEventListener('click', () => {
      setModoCego(!ctx.getBlindMode());
      reflectModoCego();
      ctx.srSay(t(ctx.getBlindMode() ? 'sr.blind.on' : 'sr.blind.off'));
    });
  }

  const caneDivSel = ctx.$<HTMLSelectElement>('#cane-div');
  if (caneDivSel) {
    caneDivSel.value = String(ctx.getCaneBlockDiv());
    caneDivSel.addEventListener('change', () => {
      const div = parseCaneDiv(caneDivSel.value);
      ctx.setCaneBlockDiv(div);
      ctx.srSay(caneDivMessage(div));
    });
  }

  //
  // A regra dura é o escopo: este botão restaura o que o menu AUDITIVO contém e nada mais. Um reset que
  // alcançasse fora de si seria pior que a armadilha que ele existe para desfazer — a criança que desfaz um
  // ajuste de som e perde de quebra a configuração motora fica sem conseguir jogar, e sem entender por quê.
  //
  // O que é deste menu: o modo cego, o espaçamento da bengala e as nove categorias do mixer. O motor de voz
  // e a saída de áudio por jogador NÃO entram — são escolha de dispositivo, não preferência restaurável, e
  // zerá-las tiraria da criança o fone que é dela numa sala compartilhada.
  /** Repõe as categorias de `keys` (as que existirem no mixer) no estado de fábrica. */
  function resetCategories(keys: readonly string[]): void {
    const state = ctx.getAudioCat();
    if (!state) return;
    for (const k of keys) {
      if (!state[k]) continue;
      const d = defaultAudioCat(k);
      state[k]!.on = d.on; state[k]!.vol = d.vol;
      ctx.setCatGain(k);
    }
  }
  const resetBtn = ctx.$<HTMLButtonElement>('#audio-reset');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    setModoCego(DEFAULTS.blindMode);
    ctx.setCaneBlockDiv(DEFAULTS.caneBlockDiv);
    // 🔴 DESDE O ADR-0151 ESTE MENU NÃO TEM A MÚSICA: repor aqui a música seria alcançar fora de si — a regra do
    // escopo, acima. Tudo o que não é das categorias de gosto é deste painel.
    resetCategories(ctx.audioCats.map((c) => c.k).filter((k) => !(GEN_CATS as readonly string[]).includes(k)));
    renderAudio(); reflectModoCego();
    ctx.srSay(t('sr.audio.reset'));
  });
  // O «repor» do painel ÁUDIO: as categorias de gosto e nada mais.
  const soundReset = ctx.$<HTMLButtonElement>('#som-reset');
  if (soundReset) soundReset.addEventListener('click', () => {
    resetCategories(GEN_CATS);
    renderAudio();
    ctx.srSay(t('sr.audio.reset'));
  });

  const audioDetectBtn = ctx.$<HTMLButtonElement>('#audio-detect');
  if (audioDetectBtn) audioDetectBtn.addEventListener('click', () => { void detectAudioDevices(); });

  reflectMaster(); // estado inicial do botão/slider mestre, antes de qualquer abertura do painel

  /*
   * ⚠️ O PAINEL ASSINA O EVENTO, e isto não é uma ideia nova: é a decisão que o `core/state` já tinha
   * escrito ao lado do `setBlindModeValue` — «o setter faz três coisas e só três: grava, persiste, avisa. Os
   * efeitos … são reação, e quem reage assina o evento».
   *
   * Sem esta assinatura, um jogo que NÃO injecta o seu próprio `setModoCego` liga o modo cego pelo ícone da
   * barra e o botão `#opt-modocego` deste painel continua a dizer «Desligado», com `aria-pressed=false` — o
   * controlo a mentir o estado para o leitor de tela. É o gémeo exacto do defeito do `reflectTTS` que já está
   * registado no `ui/pause-icons`, e não vale a pena descobri-lo uma terceira vez.
   *
   * ⚠️ É seguro para quem JÁ reflecte a partir do seu próprio setter: reflectir é idempotente — relê o estado
   * e reescreve o botão. Um anúncio duplicado seria outra história, e por isso a assinatura NÃO anuncia: o
   * ícone da barra já diz `sr.icon.blindOn`/`Off` por si.
   */
  state.on('blindMode', () => { reflectModoCego(); });

  return { renderAudio, reflectBlindMode: reflectModoCego, reflectTts: voice.reflectTts };
}
