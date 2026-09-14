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
import { t, bcp47 } from '../core/i18n.js';
import { DEFAULTS } from '../core/state.js';
// O módulo INTEIRO, e não os nomes soltos: `menuIndexOn` é ligação viva e `setMenuIndexOnValue` a muda — ler
// pelo namespace deixa isso à vista em cada uso, em vez de parecer uma constante importada.
import * as state from '../core/state.js';
import { RITMOS_DA_FALA } from '../core/speech-rate.js';
import { markChanged, markMenuChanged } from './changed-mark.js';
import { defaultAudioCat } from '../platform/audio-mixer.js';
import type { PlayerView } from '../core/entity.js';
import type { PlayerAudioOut } from '../platform/audio-sonar.js'; // ADR-0039: o dono declara `_ac`/`_acOut`
import type { DomQuery } from '../core/dom-query.js';
import type { PanelShellCtx } from './panel-shell.js';
import { linhaDeControle, rotularLinha, type ControlRowSpec } from './panel-widgets.js';

// `DomQuery` mora em `core/dom-query` desde 2026-08-26: esta linha estava copiada em DEZESSEIS
// módulos, e as cópias divergiram. Reexportada para quem já a importava daqui.
export type { DomQuery } from '../core/dom-query.js';

/** Minimal platform/storage.ts shape this module needs (get/set only — no direct localStorage access). */
export interface AudioStore {
  get(key: string, fallback?: string | null): string | null;
  set(key: string, value: string | number | boolean): boolean;
}

/** `lbl` is an i18n key (a key missing from the dictionaries is shown as written). */
export interface AudioCatDef { k: string; lbl: string; }
export interface AudioCatState { on: boolean; vol: number; }

export interface TtsPanelEngine { id: string; speak: (text: string) => void; }
/** Minimal shape of the injected `tts` (platform/tts.ts's createTts() instance) this panel drives. */
export interface TtsPanel {
  getEngineSel: () => string;
  setEngineSel: (v: string) => void;
  getEngine: () => TtsPanelEngine | null;
  getVoiceObj: () => SpeechSynthesisVoice | null;
  setVoiceObj: (v: SpeechSynthesisVoice | null) => void;
  loadTTS: () => void;
  narrate: (text: string) => void;
  /**
   * ESTA MONTAGEM TEM MOTOR NEURAL? (ADR-0094) OPCIONAL, e a ausência vale `true`: um falso de teste
   * escrito antes deste campo não tem opinião sobre motores neurais, e fazê-lo esconder o Piper mudaria o
   * que esse teste afirma sem que ninguém tenha escrito a mudança.
   */
  neuralDisponivel?: boolean;
  /** The voices of the language (ADR-0185). Optional: a panel driven without them offers no «Voz» list and locks nothing. */
  vozes?: () => readonly VozDoPainel[];
  vozAtual?: () => VozDoPainel | null;
  setVoz?: (id: string) => boolean;
}

/** A voice as this panel lists it: the provider's identifier, `locale-name-quality`. */
export interface VozDoPainel { readonly voice: string; readonly engine?: string; readonly boa?: boolean }

/** The name a child sees for a voice: the middle of its identifier — `pt_BR-faber-medium` is «Faber». */
function nomeDaVoz(v: VozDoPainel): string {
  // a browser voice is named by the browser (ADR-0200); Piper ids read `locale-name-quality`; Kokoro ids read `xx_name` (`pf_dora`)
  // («Microsoft Maria - Portuguese (Brazil)» is «Microsoft Maria»: the language is already the list's, and no parentheses, ADR-0158)
  if (v.voice.startsWith('webspeech:')) return v.voice.slice('webspeech:'.length).replace(/\s*\([^)]*\)/g, '').split(' - ')[0]!.trim();
  const nome = v.voice.includes('-') ? (v.voice.split('-')[1] ?? v.voice) : (v.voice.split('_')[1] ?? v.voice);
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}
/**
 * What the list SHOWS: a Piper voice carries a feather — the Dev: «uma vez que elas carregam bem menos dados de Kokoro para a
 * memória por vez» — and Kokoro's two good voices, Heart and Bella, a heart (ADR-0198 §3). Only shown: what is said is the name
 * alone (ADR-0159 rule 12, no glyph in a spoken name).
 */
function rotuloDaVoz(v: VozDoPainel): string {
  return (v.engine === 'piper' ? '🪶 ' : v.boa ? '❤️ ' : '') + nomeDaVoz(v);
}

/** The rows a missing voice locks (ADR-0185 §4): narration, its volume and rate, the spoken index, and the voice. */
const LINHAS_DA_FALA: readonly string[] = ['#opt-tts', '#tts-vol', '#tts-ppm', '#opt-menuindex', '#tts-voz'];

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
  getModoCego: () => boolean;
  setModoCego?: (on: boolean) => void;
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
  reflectModoCego: () => void;
  /** Refreshes the #opt-tts button + #tts-engine selection. Exported because the pause-menu icon bar's
   *  iconAct('tts', …) toggles audioCat.tts.on itself and then calls this. */
  reflectTts: () => void;
}

// ---------------------------------------------------------------------------------------------
// Pure logic (no `document`, testable in node)
// ---------------------------------------------------------------------------------------------

/** Categorias de NAVEGAÇÃO SONORA (bengala/sonar/guarda/guia) — volume geral separado do som do jogo. */
export const NAV_CATS = ['sonar', 'guard', 'guide'] as const;
/** Categorias GERAIS do jogo (TTS fica na seção Voz, fora desta lista). */
// ⚠️ SÃO DO PAINEL «ÁUDIO» desde o ADR-0151, e não do auditivo: o que é gosto (música, ambiente) não mora ao lado
// do que é acessibilidade (sonar, guarda, guia). E `other` saiu — não controlava som nenhum.
export const GEN_CATS = ['music', 'ambient', 'interact', 'earcons'] as const;

/** 0..1 -> 0..100 rounded (slider display value). */
export function volPercent(v: number): number {
  return Math.round(v * 100);
}

/** One category row's markup (volume slider + on/off switch). Pure — resolves label/state from the given data,
 *  never from a global. Returns '' for an unknown/missing category (defensive; never hit with real catalogs). */
export function catRowHTML(k: string, cats: readonly AudioCatDef[], state: Readonly<Record<string, AudioCatState>>): string {
  const c = cats.find((x) => x.k === k);
  const a = state[k];
  if (!c || !a) return '';
  const rotulo = t(c.lbl);
  return `<div class="ctrl-row"><span><strong>${rotulo}</strong></span><span style="display:flex;gap:.5rem;align-items:center;flex-shrink:0">` +
    `<input class="vol" type="range" min="0" max="100" step="5" value="${volPercent(a.vol)}" data-avol="${k}" aria-label="${t('audio.cat.volumeDe', { c: rotulo })}">` +
    `<button class="mode-btn switch${a.on ? ' is-on' : ''}" data-acat="${k}" type="button" aria-pressed="${a.on}" aria-label="${rotulo}"></button></span></div>`;
}

/** Full innerHTML for a category list (#audio-list or #navsound-list). Pure string building — no DOM. */
export function catsListHTML(keys: readonly string[], cats: readonly AudioCatDef[], state: Readonly<Record<string, AudioCatState>>): string {
  return keys.map((k) => catRowHTML(k, cats, state)).join('');
}

/** #navsound-master's value: the loudest of the nav categories, as a 0..100 slider value. */
export function navMasterVolume(state: Readonly<Record<string, AudioCatState>>, navCats: readonly string[] = NAV_CATS): number {
  return volPercent(Math.max(...navCats.map((k) => state[k].vol)));
}

/** Cane-hit spacing select -> validated int (garbage/empty -> 1, "a batida por bloco"). */
export function parseCaneDiv(raw: string): number {
  return (+raw) || 1;
}

/** srSay text for a cane-hit spacing choice. The two halves are ONE sentence per case, not a shared prefix
 *  plus a tail: a language that renders this as "One tap per block (cane)" needs to move the word "cane". */
export function caneDivMessage(div: number): string {
  return t(div === 2 ? 'sr.audio.caneHalfBlock' : 'sr.audio.canePerBlock');
}

/** #tts-engine's option catalog: (value, i18n KEY of the label). The engine NAMES are proper nouns and stay
 *  put; what translates is the parenthetical that explains each one. Keys, not text — see input/devices. */
export const TTS_ENGINE_OPTIONS: readonly (readonly [string, string])[] = [
  ['webspeech', 'tts.engine.webspeech'],
  ['piper', 'tts.engine.piper'],
  ['kokoro', 'tts.engine.kokoro'],
  ['kitten', 'tts.engine.kitten'],
  ['espeak', 'tts.engine.espeak'],
];

/**
 * Os motores que ESTA MONTAGEM pode de facto oferecer (ADR-0094).
 *
 * ⚠️ Desde que o motor neural passou a chegar por PORTA (`ctx.carregarVozNeural`), «o Piper existe» deixou
 * de ser verdade sobre a engine e passou a ser verdade sobre o JOGO. Oferecer uma opção que não pode
 * funcionar é pior que uma opção a menos: quem a escolhe fica à espera de um download que nunca começa, e
 * quem navega por escuta não tem como ver que não começou.
 *
 * Só o `piper` é filtrado. `kokoro`/`kitten`/`espeak` também não funcionam hoje — «ainda não entraram» —,
 * mas isso é anterior a este registro e escondê-los aqui mudaria comportamento que ninguém pediu para mudar.
 */
export function opcoesDeMotor(neuralDisponivel: boolean): readonly (readonly [string, string])[] {
  return neuralDisponivel ? TTS_ENGINE_OPTIONS : TTS_ENGINE_OPTIONS.filter(([v]) => v !== 'piper');
}

export interface VoiceLike { name: string; lang: string; }

/**
 * As vozes do sistema no idioma pedido; sem nenhuma, a lista inteira.
 *
 * Chamava-se `pickPtVoices` e filtrava `/^pt/i` fixo, de modo que o jogo em inglês oferecia à pessoa uma
 * lista de vozes PORTUGUESAS para ler texto em inglês. O nome dizia a verdade sobre o que fazia e mentia
 * sobre o que devia fazer.
 *
 * A comparação é pelo PREFIXO de idioma, não pela etiqueta inteira: quem joga em pt-BR também deve poder
 * escolher uma voz pt-PT se for a única instalada, e o navegador de uma escola raramente tem a variante
 * exata. O recuo para a lista inteira fica: uma lista vazia seria pior que uma lista no idioma errado, que
 * ao menos a pessoa pode ouvir e rejeitar.
 */
export function pickVoicesFor<T extends VoiceLike>(voices: readonly T[], lang: string): readonly T[] {
  const pref = lang.slice(0, 2).toLowerCase();
  const iguais = voices.filter((v) => v.lang.slice(0, 2).toLowerCase() === pref);
  return iguais.length ? iguais : voices;
}

/** "<name> (<lang>)" option label. */
export function voiceLabel(v: VoiceLike): string {
  return v.name + ' (' + v.lang + ')';
}

/** Whether the browser can list/switch audio outputs at all (gates the #audio-sinks hint copy). */
export function sinksSupported(hasEnumerateDevices: boolean, hasAudioContextCtor: boolean): boolean {
  return hasEnumerateDevices && hasAudioContextCtor;
}

export interface SinkDeviceLike { deviceId: string; label?: string; }

/** A device's option label, falling back to a 1-based "Saída N" when the browser withholds the real label
 *  (no getUserMedia permission granted yet). */
export function sinkOptionLabel(d: SinkDeviceLike, index: number): string {
  return d.label || t('audio.sinkFallback', { n: index + 1 });
}

/** A player's current sink select value ('' = default/shared). */
export function sinkSelectValue(p: { audioSink?: string | null } | undefined): string {
  return (p && p.audioSink) || '';
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
export function montarInteriorDoAudio(ctx: PanelShellCtx, card: HTMLElement, lista: HTMLElement): void {
  // Cada entrada: ou uma linha de controle, ou um CONTENTOR que o painel preenche por `innerHTML`.
  const pecas: (ControlRowSpec | { readonly contentor: string; readonly rotulo?: string })[] = [
    /*
     * 🔴 A COMPOSIÇÃO DO ADR-0151 E DAS ERRATAS DELE (2026-09-12), na ordem do geral para o particular:
     *   · o MODO CEGO primeiro, porque é o modo em que os outros sons passam a ser a tela — e SEM a dica: «é
     *     redundante. Quem precisa sabe o que é»;
     *   · a BENGALA ao lado dele (e só num jogo que responde que alguém anda, ADR-0153);
     *   · o SONAR, a GUARDA e a GUIA, cada um com o seu interruptor e o seu volume: são a lista da casca;
     *   · a NARRAÇÃO e o seu volume, com o ÍNDICE FALADO logo a seguir, porque é a narração que ele encurta.
     * 🔴 O SOM e o VOLUME GERAIS MUDARAM-SE para o painel «Áudio» (`montarInteriorDoSom`): o Dev primeiro tirou-os
     * («Volume geral é o do computador») e no mesmo dia devolveu-os — «toggle + barra para som geral voltam» —, e
     * voltam para o painel do som, não para o da acessibilidade. SAIU o VOLUME DA NAVEGAÇÃO, que era um segundo
     * lugar para os três volumes da lista (um lugar por escolha, D2 do registo).
     */
    // ⚠️ Their own short keys, not the bar's `icon.blind`/`icon.tts`: those carry «(navegação sonora)» and «(TTS)», and
    // a row keeps no explanation in parentheses (ADR-0158).
    { id: 'opt-modocego', rotulo: t('audio.modocego') },
    { id: 'cane-div', rotulo: t('audio.cane'), dica: t('audio.cane.dica'), forma: 'escolha' },
    { contentor: '@lista' }, // a lista da casca: sonar, guarda e guia
    { id: 'opt-tts', rotulo: t('audio.narracao'), dica: t('audio.tts.dica') },
    { id: 'tts-vol', rotulo: t('audio.ttsVol'), forma: 'cursor' },
    // ADR-0183 §1, ADR-0196: the speech rate, 254 to 504 by 50 — six positions, so a list (ADR-0130 erratum)
    { id: 'tts-ppm', rotulo: t('audio.ttsPpm'), dica: t('audio.ttsPpm.dica'), forma: 'escolha' },
    // ADR-0185: the child picks the voice, among the voices that speak the language — a list, since English passes five
    { id: 'tts-voz', rotulo: t('audio.voz'), forma: 'escolha' },
    { id: 'opt-menuindex', rotulo: t('audio.menuindex'), dica: t('audio.menuindex.dica') },
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
  const acoes = card.querySelector<HTMLElement>(':scope > .overlay__actions');
  for (const peca of pecas) {
    if ('contentor' in peca) {
      if (peca.contentor === '@lista') { card.insertBefore(lista, acoes); continue; }
      const jaHa = ctx.procurar('#' + peca.contentor);
      if (jaHa) {
        if (peca.rotulo) jaHa.setAttribute('aria-label', peca.rotulo);
        continue;
      }
      const c = ctx.criar('div');
      c.id = peca.contentor;
      c.className = 'ctrl-list';
      c.setAttribute('role', 'group');
      if (peca.rotulo) c.setAttribute('aria-label', peca.rotulo);
      card.insertBefore(c, acoes);
      continue;
    }
    const jaExiste = ctx.procurar('#' + peca.id);
    if (jaExiste) {
      const linha = jaExiste.closest<HTMLElement>('.ctrl-row');
      if (linha) rotularLinha(linha, peca);
      continue;
    }
    card.insertBefore(linhaDeControle(ctx, peca).linha, acoes);
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
export function montarInteriorDoSom(ctx: PanelShellCtx, card: HTMLElement, lista: HTMLElement): void {
  const acoes = card.querySelector<HTMLElement>(':scope > .overlay__actions');
  const linhas: ControlRowSpec[] = [
    { id: 'audio-master', rotulo: t('audio.som'), dica: t('audio.som.dica') },
    { id: 'audio-master-vol', rotulo: t('audio.volume'), forma: 'cursor' },
  ];
  for (const peca of linhas) {
    const jaExiste = ctx.procurar('#' + peca.id);
    if (jaExiste) {
      const linha = jaExiste.closest<HTMLElement>('.ctrl-row');
      if (linha) rotularLinha(linha, peca);
      continue;
    }
    card.insertBefore(linhaDeControle(ctx, peca).linha, lista.parentNode === card ? lista : acoes);
  }
  if (lista.parentNode !== card) card.insertBefore(lista, acoes);
}

// ---------------------------------------------------------------------------------------------
// DOM-facing (thin) — requires `document`/injected ctx
// ---------------------------------------------------------------------------------------------

export function initSettingsAudio(ctx: SettingsAudioCtx): SettingsAudioApi {
  // ⚠️ PADRÃO DA ENGINE (ADR-0106 §4): quem injecta manda; quem não injecta deixa de ficar sem modo cego.
  // O `setModoCegoValue` faz as três coisas que o `core/state` diz que um setter faz — grava, persiste, avisa
  // — e nada mais: os efeitos (refazer os extras do nível) são reação, e quem reage assina o evento.
  const setModoCego = ctx.setModoCego ?? state.setModoCegoValue;

  let audioDevices: MediaDeviceInfo[] = [];

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

  function wireCatControls(el: HTMLElement): void {
    el.querySelectorAll<HTMLButtonElement>('button[data-acat]').forEach((b) => {
      b.addEventListener('click', () => {
        const k = b.dataset.acat; if (!k) return;
        const state = ctx.getAudioCat(); if (!state || !state[k]) return;
        state[k].on = !state[k].on;
        ctx.setCatGain(k);
        b.classList.toggle('is-on', state[k].on);
        b.setAttribute('aria-pressed', String(state[k].on));
        refreshMarks(); // a marca acompanha a MUDANÇA, não só o redesenho — ver a nota em refreshMarks
      });
    });
    el.querySelectorAll<HTMLInputElement>('input[data-avol]').forEach((s) => {
      s.addEventListener('input', () => {
        const k = s.dataset.avol; if (!k) return;
        const state = ctx.getAudioCat(); if (!state || !state[k]) return;
        state[k].vol = (+s.value) / 100;
        state[k].on = true;
        ctx.setCatGain(k);
        const bb = el.querySelector<HTMLButtonElement>('button[data-acat="' + k + '"]');
        if (bb) { bb.classList.add('is-on'); bb.setAttribute('aria-pressed', 'true'); }
        refreshMarks();
      });
    });
  }

  function renderCategoryList(sel: string, keys: readonly string[]): void {
    const el = ctx.$<HTMLElement>(sel);
    const state = ctx.getAudioCat();
    if (!el || !state) return;
    el.innerHTML = catsListHTML(keys, ctx.audioCats, state);
    wireCatControls(el);
    // A prosa volta para o rodapé depois de as linhas serem reconstruídas (CLAUDE.md §4, #109) — no cartão
    // de QUEM tem esta lista: desde o ADR-0151 são dois painéis, e o rodapé do outro não é o desta criança.
    ctx.fillExplain?.(el.closest<HTMLElement>('.overlay__card'));
  }

  function renderNavSound(): void {
    renderCategoryList('#navsound-list', NAV_CATS);
    const m = ctx.$<HTMLInputElement>('#navsound-master');
    const state = ctx.getAudioCat();
    if (m && state) m.value = String(navMasterVolume(state, NAV_CATS));
  }

  function reflectTts(): void {
    const b = ctx.$<HTMLButtonElement>('#opt-tts');
    const state = ctx.getAudioCat();
    const on = !!(state && state.tts && state.tts.on);
    if (b) { ctx.toggleBtn(b, on); b.textContent = toggleLabel(on); }
    const e = ctx.$<HTMLSelectElement>('#tts-engine');
    if (e) e.value = ctx.tts.getEngineSel();
  }

  /**
   * O alternador do ÍNDICE "6 de 10" (ADR-0044, item 3).
   *
   * Ele mora ao lado da narração por voz e não num painel de visual, porque é a NARRAÇÃO que ele muda: quem
   * desliga o índice está encurtando o que ouve a cada passo, e é aqui que essa pessoa vem quando o que ouve
   * incomoda.
   */
  function reflectMenuIndex(): void {
    const b = ctx.$<HTMLButtonElement>('#opt-menuindex');
    if (b) { ctx.toggleBtn(b, state.menuIndexOn); b.textContent = toggleLabel(state.menuIndexOn); }
  }

  function populateTtsEngines(): void {
    const sel = ctx.$<HTMLSelectElement>('#tts-engine');
    if (!sel || sel.dataset.filled) return;
    sel.dataset.filled = '1';
    opcoesDeMotor(ctx.tts.neuralDisponivel !== false).forEach(([v, l]) => {
      const o = document.createElement('option'); o.value = v; o.textContent = t(l); sel.appendChild(o);
    });
    sel.value = ctx.tts.getEngineSel();
  }

  function populateTtsVoices(): void {
    const sel = ctx.$<HTMLSelectElement>('#tts-voice');
    if (!sel) return;
    let voices: SpeechSynthesisVoice[] = [];
    try { voices = (window.speechSynthesis && window.speechSynthesis.getVoices()) || []; } catch (e) { /* noop */ }
    const list = pickVoicesFor(voices, bcp47());
    sel.innerHTML = '';
    if (!list.length) {
      const o = document.createElement('option'); o.textContent = t('audio.noSystemVoices'); sel.appendChild(o);
      ctx.tts.setVoiceObj(null);
      return;
    }
    list.forEach((v) => {
      const o = document.createElement('option'); o.value = v.name; o.textContent = voiceLabel(v); sel.appendChild(o);
    });
    const saved = ctx.store.get('incl_tts_voice', null);
    const pick = list.find((v) => v.name === saved) || list[0];
    sel.value = pick.name;
    ctx.tts.setVoiceObj(pick);
  }

  const semVoz = (): boolean => !!ctx.tts.vozes && ctx.tts.vozes().length === 0;

  /** The speech rate list: each step «N PPM», the stored one selected (ADR-0183 §1). */
  function renderRitmo(): void {
    const sel = ctx.$<HTMLSelectElement>('#tts-ppm');
    if (!sel) return;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    for (const ppm of RITMOS_DA_FALA) {
      const o = document.createElement('option'); o.value = String(ppm); o.textContent = t('visual.legenda.ppm', { n: ppm }); sel.appendChild(o);
    }
    sel.value = String(state.speechPpm);
  }

  function renderVozes(): void {
    const sel = ctx.$<HTMLSelectElement>('#tts-voz');
    if (!sel || !ctx.tts.vozes) return;
    const lista = ctx.tts.vozes();
    sel.replaceChildren(); // options built node by node: no markup sink
    if (!lista.length) {
      const o = document.createElement('option'); o.textContent = t('audio.voz.nenhuma'); sel.appendChild(o);
      return;
    }
    for (const v of lista) {
      const o = document.createElement('option'); o.value = v.voice; o.textContent = rotuloDaVoz(v); sel.appendChild(o);
    }
    sel.value = ctx.tts.vozAtual?.()?.voice ?? lista[0]!.voice;
  }

  /**
   * No voice speaks the language (ADR-0185 §4): the four speech rows are LOCKED with the reason, never hidden (ADR-0161).
   * `aria-disabled` and not `disabled`, so the keyboard still reaches the row and hears why.
   */
  function travarFala(): void {
    const travar = semVoz();
    for (const id of LINHAS_DA_FALA) {
      const el = ctx.$<HTMLElement>(id);
      if (!el) continue;
      if (travar) { el.setAttribute('aria-disabled', 'true'); el.dataset.motivo = t('audio.semVoz'); }
      else { el.removeAttribute('aria-disabled'); delete el.dataset.motivo; }
    }
  }

  function hasEnumerateDevices(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices);
  }
  function hasAudioContextCtor(): boolean {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    return typeof (w.AudioContext || w.webkitAudioContext) !== 'undefined';
  }

  function renderSinks(devices: readonly MediaDeviceInfo[]): void {
    const el = ctx.$<HTMLElement>('#audio-sinks');
    if (!el) return;
    el.innerHTML = '';
    if (!devices.length) {
      const supported = sinksSupported(hasEnumerateDevices(), hasAudioContextCtor());
      el.innerHTML = '<p class="opt-hint">' +
        t(supported ? 'audio.sinksHint' : 'audio.sinksUnsupported') +
        '</p>';
      return;
    }
    const players = ctx.getPlayers();
    const n = Math.max(1, ctx.getNumPlayers());
    for (let i = 0; i < n; i++) {
      const p = players[i];
      const row = document.createElement('div'); row.className = 'ctrl-row';
      const lbl = document.createElement('label'); lbl.textContent = t('audio.playerN', { n: i + 1 }); lbl.setAttribute('for', 'sink-p' + i);
      const sel = document.createElement('select'); sel.className = 'vol'; sel.id = 'sink-p' + i;
      const o0 = document.createElement('option'); o0.value = ''; o0.textContent = t('audio.sinkShared'); sel.appendChild(o0);
      devices.forEach((d, k) => {
        const o = document.createElement('option'); o.value = d.deviceId; o.textContent = sinkOptionLabel(d, k); sel.appendChild(o);
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
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        const devs = await navigator.mediaDevices.enumerateDevices();
        audioDevices = devs.filter((d) => d.kind === 'audiooutput');
      }
    } catch (e) { /* sem pedir permissão: só lista as saídas já conhecidas */ }
    renderSinks(audioDevices);
  }

  async function detectAudioDevices(): Promise<void> {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => {});
      const devs = await navigator.mediaDevices.enumerateDevices();
      audioDevices = devs.filter((d) => d.kind === 'audiooutput');
    } catch (e) { audioDevices = []; }
    renderSinks(audioDevices);
  }

  function reflectModoCego(): void {
    const b = ctx.$<HTMLButtonElement>('#opt-modocego');
    if (b) { ctx.toggleBtn(b, ctx.getModoCego()); b.textContent = toggleLabel(ctx.getModoCego()); }
  }

  function renderAudio(): void {
    reflectMaster();
    renderCategoryList('#audio-list', GEN_CATS);
    renderNavSound();
    reflectModoCego();
    reflectTts();
    // 🔴 FALTAVA, e só o caso do painel montado pela engine o viu (2026-09-12): o índice nasce LIGADO, o botão nascia
    // sem estado, e o painel abria a dizer «desligado» — o controle a mentir para o leitor de tela outra vez.
    reflectMenuIndex();
    populateTtsEngines();
    populateTtsVoices();
    renderVozes();
    renderRitmo();
    travarFala();
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
    const mudou: boolean[] = [];
    const marcar = (sel: string, changed: boolean): void => {
      mudou.push(changed);
      markChanged(ctx.$<HTMLElement>(sel)?.closest<HTMLElement>('.ctrl-row') ?? null, changed);
    };
    marcar('#opt-modocego', ctx.getModoCego() !== DEFAULTS.modoCego);
    marcar('#cane-div', ctx.getCaneBlockDiv() !== DEFAULTS.caneBlockDiv);
    // ⚠️ DUAS MARCAS DE MENU, uma por painel: a de «Áudio» acesa por um sonar mudado mandaria a criança
    // procurar no painel errado.
    const doSom: boolean[] = [];
    for (const c of ctx.audioCats) {
      const d = defaultAudioCat(c.k);
      const a = state?.[c.k];
      const mudouAqui = !!a && (a.on !== d.on || a.vol !== d.vol);
      if ((GEN_CATS as readonly string[]).includes(c.k)) {
        doSom.push(mudouAqui);
        markChanged(ctx.$<HTMLElement>(`[data-acat="${c.k}"]`)?.closest<HTMLElement>('.ctrl-row') ?? null, mudouAqui);
      } else marcar(`[data-acat="${c.k}"]`, mudouAqui);
    }
    markMenuChanged(ctx.$<HTMLElement>('[data-act="audio"]'), mudou);
    markMenuChanged(ctx.$<HTMLElement>('[data-act="som"]'), doSom);
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
   * (`setModoCegoValue`, que grava/persiste/avisa e NÃO fala), um jogo que não injecta o seu próprio setter
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
      setModoCego(!ctx.getModoCego());
      reflectModoCego();
      ctx.srSay(t(ctx.getModoCego() ? 'sr.blind.on' : 'sr.blind.off'));
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

  /*
   * A LOCKED SPEECH ROW DOES NOTHING AND SAYS WHY (ADR-0185 §4). In the CAPTURE phase on the control itself, so it runs
   * before the row's own listener and stops it; a moved range goes back to the stored volume, a changed list to the voice in use.
   * The footer shows the reason when the row takes focus: the card hears `focusin` after the row's own explanation.
   */
  for (const id of LINHAS_DA_FALA) {
    const el = ctx.$<HTMLElement>(id);
    if (!el) continue;
    const recusar = (e: Event): void => {
      if (el.getAttribute('aria-disabled') !== 'true') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      if (id === '#tts-vol') { const cat = ctx.getAudioCat(); if (cat?.tts) (el as HTMLInputElement).value = String(volPercent(cat.tts.vol)); }
      if (id === '#tts-voz') renderVozes();
      if (id === '#tts-ppm') renderRitmo();
      ctx.srSay(el.dataset.motivo ?? t('audio.semVoz'));
    };
    for (const tipo of ['click', 'input', 'change']) el.addEventListener(tipo, recusar, true);
    el.closest<HTMLElement>('.overlay__card')?.addEventListener('focusin', (e) => {
      if (e.target !== el || el.getAttribute('aria-disabled') !== 'true') return;
      const rodape = el.closest<HTMLElement>('.overlay__card')?.querySelector<HTMLElement>('.opt-explain');
      if (rodape) rodape.textContent = el.dataset.motivo ?? '';
    });
  }

  const vozSel = ctx.$<HTMLSelectElement>('#tts-voz');
  if (vozSel) vozSel.addEventListener('change', () => {
    if (!ctx.tts.setVoz?.(vozSel.value)) { renderVozes(); return; }
    const v = ctx.tts.vozAtual?.();
    if (v) ctx.srSay(t('sr.audio.voz', { nome: nomeDaVoz(v) }));
  });

  const ritmoSel = ctx.$<HTMLSelectElement>('#tts-ppm');
  if (ritmoSel) ritmoSel.addEventListener('change', () => {
    state.setSpeechPpmValue(Number(ritmoSel.value));
    renderRitmo();
    ctx.srSay(`${t('audio.ttsPpm')}: ${t('visual.legenda.ppm', { n: state.speechPpm })}`);
  });

  const ttsBtn = ctx.$<HTMLButtonElement>('#opt-tts');
  if (ttsBtn) ttsBtn.addEventListener('click', () => {
    const state = ctx.getAudioCat(); if (!state) return;
    state.tts.on = !state.tts.on;
    ctx.setCatGain('tts');
    reflectTts();
    ctx.srSay(t(state.tts.on ? 'sr.audio.ttsOn' : 'sr.audio.ttsOff'));
    if (state.tts.on) ctx.tts.narrate(t('sr.audio.ttsOnSpoken'));
  });
  const idxBtn = ctx.$<HTMLButtonElement>('#opt-menuindex');
  if (idxBtn) idxBtn.addEventListener('click', () => {
    state.setMenuIndexOnValue(!state.menuIndexOn);
    reflectMenuIndex();
    // O anúncio da troca NÃO leva índice: ele não é item de lista nenhuma, e um "1 de 1" aqui seria ruído
    // justamente no momento em que a criança está julgando se o ruído incomoda.
    ctx.srSay(t(state.menuIndexOn ? 'sr.menu.indexOn' : 'sr.menu.indexOff'));
  });

  const ttsEngSel = ctx.$<HTMLSelectElement>('#tts-engine');
  if (ttsEngSel) ttsEngSel.addEventListener('change', () => {
    ctx.tts.setEngineSel(ttsEngSel.value);
    ctx.store.set('incl_tts_engine', ttsEngSel.value);
    if (ttsEngSel.value !== 'webspeech') ctx.tts.loadTTS();
    const opt = ttsEngSel.options[ttsEngSel.selectedIndex];
    ctx.tts.narrate(t('sr.audio.engineSet', { motor: opt ? opt.text : '' }));
  });
  const ttsVoiceSel = ctx.$<HTMLSelectElement>('#tts-voice');
  if (ttsVoiceSel) ttsVoiceSel.addEventListener('change', () => {
    try {
      const vs = window.speechSynthesis.getVoices();
      ctx.tts.setVoiceObj(vs.find((v) => v.name === ttsVoiceSel.value) || null);
      ctx.store.set('incl_tts_voice', ttsVoiceSel.value);
    } catch (e) { /* noop */ }
    ctx.tts.narrate(t('sr.audio.voicePicked'));
  });
  const ttsTestBtn = ctx.$<HTMLButtonElement>('#opt-tts-test');
  if (ttsTestBtn) ttsTestBtn.addEventListener('click', () => {
    const txt = t('audio.voiceSample');
    const engine = ctx.tts.getEngine();
    if (ctx.tts.getEngineSel() !== 'webspeech' && engine && engine.speak) {
      try { engine.speak(txt); } catch (e) { /* noop */ } // motor neural já carregado
    } else {
      try {
        const ss = window.speechSynthesis;
        if (ss) {
          ss.cancel();
          const u = new SpeechSynthesisUtterance(txt);
          u.lang = 'pt-BR';
          const vo = ctx.tts.getVoiceObj();
          if (vo) u.voice = vo;
          u.rate = 1; u.volume = 1;
          ss.speak(u);
        }
      } catch (e) { /* noop */ } // fallback audível (volume 1) + dispara download do neural
      if (ctx.tts.getEngineSel() !== 'webspeech') ctx.tts.loadTTS();
    }
    ctx.srSay(t('sr.audio.testingVoice'));
  });
  // ---- restaurar os padrões DESTE menu (ADR-0028) ----
  //
  // A regra dura é o escopo: este botão restaura o que o menu AUDITIVO contém e nada mais. Um reset que
  // alcançasse fora de si seria pior que a armadilha que ele existe para desfazer — a criança que desfaz um
  // ajuste de som e perde de quebra a configuração motora fica sem conseguir jogar, e sem entender por quê.
  //
  // O que é deste menu: o modo cego, o espaçamento da bengala e as nove categorias do mixer. O motor de voz
  // e a saída de áudio por jogador NÃO entram — são escolha de dispositivo, não preferência restaurável, e
  // zerá-las tiraria da criança o fone que é dela numa sala compartilhada.
  /** Repõe as categorias de `keys` (as que existirem no mixer) no estado de fábrica. */
  function reporCategorias(keys: readonly string[]): void {
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
    setModoCego(DEFAULTS.modoCego);
    ctx.setCaneBlockDiv(DEFAULTS.caneBlockDiv);
    // 🔴 DESDE O ADR-0151 ESTE MENU NÃO TEM A MÚSICA: repor aqui a música seria alcançar fora de si — a regra do
    // escopo, acima. Tudo o que não é das categorias de gosto é deste painel.
    reporCategorias(ctx.audioCats.map((c) => c.k).filter((k) => !(GEN_CATS as readonly string[]).includes(k)));
    renderAudio(); reflectModoCego(); reflectTts(); reflectMenuIndex();
    ctx.srSay(t('sr.audio.reset'));
  });
  // O «repor» do painel ÁUDIO: as categorias de gosto e nada mais.
  const resetDoSom = ctx.$<HTMLButtonElement>('#som-reset');
  if (resetDoSom) resetDoSom.addEventListener('click', () => {
    reporCategorias(GEN_CATS);
    renderAudio();
    ctx.srSay(t('sr.audio.reset'));
  });

  try { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = populateTtsVoices; } catch (e) { /* noop */ }

  const ttsVolEl = ctx.$<HTMLInputElement>('#tts-vol');
  if (ttsVolEl) ttsVolEl.addEventListener('input', () => {
    const state = ctx.getAudioCat(); if (!state) return;
    state.tts.vol = (+ttsVolEl.value) / 100;
    state.tts.on = true;
    ctx.setCatGain('tts');
    reflectTts();
  });

  const audioDetectBtn = ctx.$<HTMLButtonElement>('#audio-detect');
  if (audioDetectBtn) audioDetectBtn.addEventListener('click', () => { void detectAudioDevices(); });

  reflectMaster(); // estado inicial do botão/slider mestre, antes de qualquer abertura do painel

  /*
   * ⚠️ O PAINEL ASSINA O EVENTO, e isto não é uma ideia nova: é a decisão que o `core/state` já tinha
   * escrito ao lado do `setModoCegoValue` — «o setter faz três coisas e só três: grava, persiste, avisa. Os
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
  state.on('modoCego', () => { reflectModoCego(); });

  return { renderAudio, reflectModoCego, reflectTts };
}
