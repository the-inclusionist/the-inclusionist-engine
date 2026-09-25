// SPDX-License-Identifier: AGPL-3.0-or-later
// RAW PORTUGUESE IN THE ENGINE LAYERS — pillar 3 across every published layer, not one file.
//
// ========================= WHAT IT CATCHES =========================
// Raw Portuguese crosses module boundaries with the code that carries it: a level button's label built as
// `'📚 Nível ' + level + ' · ' + qlName[level]`, earcon captions such as '🔊 Coletou', '🔊 Ai! Dano', '🔊 Portão abriu'.
// Captions are what a DEAF child reads in place of the sound; in an English build they would read Portuguese — exactly
// the information the caption exists to give. Neither would be found hunting translation bugs: they live wherever a
// narrow scan does not go.
//
// ========================= WHY THE SIEVE IS NARROW =========================
// A raw scan over the engine layers returns hundreds of candidates, most of them NOISE: 'KeyA', 'ControlLeft',
// 'Atkinson Hyperlegible', 'CC BY-SA', 'select[data-slot]'. A debt list of noise is not a gate: it is a file nobody
// reads, and a gate nobody reads is worse than none, because it takes the place of one that would work.
//
// So there is a PRECISION filter: the literal must look like PORTUGUESE PROSE — an accent/cedilla, or an isolated pt-BR
// function word. Key, font and licence names pass; a sentence does not.
//
// WHAT IT DOES NOT CATCH, said so nobody trusts it too much: text with no accent and no function word — 'Coletou' alone
// would escape. It is the price of precision, and the choice is deliberate: a wide sieve here would produce a list
// nobody would maintain.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ_REPO = process.cwd().endsWith(join('app')) ? join(process.cwd(), '..') : process.cwd();
const RAIZ = join(RAIZ_REPO, 'app', 'js');
const CR = String.fromCharCode(13);

/**
 * ⚠️ THE LAYER LIST COMES FROM `tsconfig.pkg.json` — whoever publishes decides what published engine is. A hand copy
 * drifts both ways: one named an `audio` layer that never existed (the `if (!existsSync)` swallowed it silently) and
 * missed `educational` and `i18n`, which are published. «Copiar seria a divergência clássica», as
 * `tests/engine-package.node.test.js` warns about itself.
 *
 * ⚠️ AND A NEW LAYER ENTERS BY DEFAULT, which beats having to classify it. `CAMADAS` is the published MINUS the exempt,
 * so whoever adds a layer to the package need not remember this file: it is born watched, and if it brings prose the
 * debt case fails naming the module. Measured with a one-line `inventada` layer — without prose it passes (watched,
 * not suspect), with prose it fails.
 *
 * Staying OUT is what takes a deliberate act: entering `CAMADAS_ISENTAS`, with a written reason.
 */
function camadasPublicadas() {
  const bruto = readFileSync(join(RAIZ_REPO, 'tsconfig.pkg.json'), 'utf8').split(CR).join('');
  const cfg = JSON.parse(bruto);
  return (cfg.include ?? [])
    .map((p) => p.split('\\').join('/'))
    .filter((p) => p.startsWith('app/js/'))
    .map((p) => p.slice('app/js/'.length))
    .filter((c) => c && !c.includes('/'))
    .sort();
}

/**
 * The published layers this sieve does NOT scan, each with its reason. An exemption without a reason is loosening in
 * disguise; an exemption without a list is a hole nobody sees.
 */
const CAMADAS_ISENTAS = new Map([
  ['i18n', 'são os DICIONÁRIOS: medir texto neles seria proibir o produto de ter palavras'],
  ['educational', 'ADR-0032 + pilar 3: currículo é REESCRITO por idioma, não traduzido — o pt-BR daqui não '
    + 'entra nos dicionários de propósito, e são 26 literais que estão certos onde estão'],
]);

const CAMADAS = camadasPublicadas().filter((c) => !CAMADAS_ISENTAS.has(c));

const MODULOS = CAMADAS.flatMap((c) => {
  const dir = join(RAIZ, c);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.ts')).map((f) => `${c}/${f}`);
});
const fonte = (m) => readFileSync(join(RAIZ, ...m.split('/')), 'utf8').split(CR).join('');

/** CODE lines: no comments. Prose in a comment goes to no screen. */
function linhasDeCodigo(texto) {
  const out = [];
  let bloco = false;
  texto.split('\n').forEach((ln, i) => {
    const t = ln.trim();
    if (bloco) { if (t.includes('*/')) bloco = false; return; }
    if (t.startsWith('/*')) { if (!t.includes('*/')) bloco = true; return; }
    if (t.startsWith('//') || t.startsWith('*')) return;
    out.push([i + 1, ln.replace(/\/\/.*$/, '')]);
  });
  return out;
}

/** Technical BY SHAPE — rules copied on purpose (see the final case). */
const TECNICO = [
  /^[#.[]/,                        // CSS selector
  /^[a-z][a-zA-Z0-9]*$/,           // one-word identifier
  /^[a-z0-9_]+$/,                  // snake_case / id (lower case on purpose: UI text starts upper case)
  /^[a-z]+([.-][a-z0-9]*)+$/i,     // i18n key, class, file
  /^(https?:)?\//,                 // url / path
  /^[\s\d\W]*$/,                   // only symbols, digits or spaces
  /^[a-z]+\/[a-z0-9.-]+$/i,        // mime / short path
];

/** Does it look like pt-BR PROSE? An accent/cedilla, or an ISOLATED function word (with boundaries, or 'mode' matches 'de'). */
const ACENTO = /[áàâãéêíóôõúüç]/i;
const PALAVRA_PT = /\b(de|da|do|das|dos|para|com|sem|em|no|na|nos|nas|um|uma|os|as|ou|que|ao|aos|pelo|pela|seu|sua|mais|todos|toda|cada)\b/i;
const pareceProsa = (s) => ACENTO.test(s) || PALAVRA_PT.test(s);

const semMarcacao = (s) => s.replace(/\$\{[^}]*\}/g, '').replace(/<[^>]*>/g, '').trim();
const STR = new RegExp("(['\"`])((?:\\\\.|(?!\\1)[^\\\\])*)\\1", 'g');

/** A module's literals that look like Portuguese interface text. */
function crus(m) {
  const out = [];
  for (const [n, ln] of linhasDeCodigo(fonte(m))) {
    for (const mm of ln.matchAll(STR)) {
      const s = mm[2];
      if (s.length < 2) continue;
      if (TECNICO.some((re) => re.test(s))) continue;
      if (s.includes('<') && !/[A-Za-zÀ-ü]{2}/.test(semMarcacao(s))) continue; // a frame with no text
      if (!pareceProsa(s)) continue;
      out.push(`${n}: ${JSON.stringify(s.slice(0, 60))}`);
    }
  }
  return out;
}

/**
 * KNOWN debt — a CEILING per module, and it only shrinks.
 *
 * A ceiling and not equality, for the same reason as the fixtures gate: a module gains and loses literals for a thousand
 * reasons unrelated to language, and a case failing at every innocent edit would be loosened at the first rush. What it
 * forbids is the one thing that matters — raw text GROWING.
 */
/**
 * EXEMPT, and the exemption is one of CLASSIFICATION, not debt.
 *
 * A ceiling is the wrong treatment for `ui/debug-panel.ts`: it would force pushing a number every time a debugging
 * instrument gains a line, and pushing a ceiling that "only shrinks" is exactly the loosening this table exists to
 * prevent. Pretending it is debt turns the rule into a nuisance, and a nuisance rule is a loosened rule.
 *
 * The panel is not the GAME's interface. It only exists with `?debug=true`, and its reader is whoever programs — the same
 * person `core/contract` writes its `throw` messages for. Translating a debugging instrument into three languages would
 * cost maintenance and reach no child, which is what pillar 3 protects.
 *
 * ⚠️ THE BAR TO ENTER HERE IS NARROW, and there are TWO doors, both with the same test behind them: «traduzir isto
 * alcançaria alguma criança?». A panel a child can open does not enter — it goes in the table below, with a ceiling,
 * like all the others.
 *
 * 1. The module is UNREACHABLE without a development flag (`ui/debug-panel.ts`).
 * 2. 🔴 The raw text is READ BY NOBODY — it is SAID by a child and heard by a model (`input/voice-map.ts`, issue #184).
 *    The vocabulary tables are what the child speaks in pt, es and en, and they are already PER LANGUAGE: the choice
 *    `t()` would make is made one level up, in `voiceWordsFor`. And their accents are DATA, not prose — 📏 measured in a
 *    browser: with «acao» instead of «ação», the pt model answered «Ignoring word missing in vocabulary» and the
 *    controller's first position went mute, with no error anywhere. Putting these words under the ceiling would force a
 *    choice between paying debt for writing CORRECT Portuguese and writing a word the recogniser does not have — and the
 *    second option costs the child.
 */
const ISENTOS = new Set(['ui/debug-panel.ts', 'input/voice-map.ts']);

const CRU_CONHECIDO = {
  // ⚠️ THE NUMBERS COME FROM HERE, not from an outside script: a separate scan once counted differently (it lost the prose
  // matcher's word boundaries, and `mode` matched `de`), and the gate rightly failed. Whoever updates this table, update
  // it by what THIS file reports; it is the same lesson as the fixtures gate.

  /* --- SETTINGS PANELS: labels and hints built in markup, still without `data-i18n`. --- */
  'ui/settings-motion.ts': 6,   // ⚠️ A BLIND SPOT of this sieve, the size of the defect it exists to catch: it counts
                               // literals `pareceProsa` recognises as interface text, and a ONE-word fragment — a role's
                               // name glued to a number by concatenation — does not look like prose. So the form
                               // «palavra + variável», which is exactly how raw Portuguese survives in generated
                               // markup, crosses the whole ledger unseen (fixing this module's seat suffix to
                               // `t('pause.cardSeat')` did not move its count).
  // The color-blocking roles' names (`ROLE_LABELS`, `ui/visual-choices`), still DECLARED debt: «perigo (lava)» is ONE
  // game's word, and what names them to the child is each colour's accessible name, where they cross through `{param}`.
  'ui/visual-choices.ts': 3,
  'ui/settings-aac.ts': 5,
  'ui/locale-flags.ts': 2,       // each language named IN ITSELF, beside its flag: a child who cannot read the current language still finds theirs
  // ✅ Entries leave by being FIXED, not only by counting: `ui/hud.ts` (the «aperte um botão para entrar» badge, now
  // `hud.waitBadge` — its own key, not `sr.player.pressToJoin`: that one is for whoever listens, this one says WHICH
  // button, because whoever reads it has other people around), `ui/settings-panel.ts` (the footer's idle
  // `EXPLAIN_IDLE`, now resolved at each `fillExplain`, so it follows the language), `ui/settings-controls.ts` (#125),
  // `input/gamepad.ts` (#123) and `ui/aac-sets.ts` (its set notes and licence texts left with the sets ADR-0233 dropped).
  //
  // The `[Zero]` case — the list keeps no module that is already clean — is what forces them out: an orphan entry makes
  // the table lie about the debt's size, and a debt that looks bigger than it is ends up ignored as a whole.

  /* --- CURRICULUM, which is different from the others: pillar 3 says REWRITE per language, not translate. --- */

  /* --- OUTSIDE `ui/`: fewer, each for a reason of its own. --- */
  'input/touch.ts': 8,             // 'mão de criança' / 'mão de adulto' — a classification, but it GOES to the screen;
                                   // and the two `touchGaps` lines (ADR-0143 §4), split into literals to fit the width —
                                   // gaps read by whoever INTEGRATES the engine, not text a child reads (the sieve is by
                                   // SHAPE and cannot tell). 📌 They end the silence of a game left without a pad with
                                   // nothing saying so; shortening them to pay this ledger less would pay with the part
                                   // that serves the reader — the sentence names the way out (`preset`, «remapeie um
                                   // slot») AND what the child loses.
  // ⚠️ `input/gamepad.ts` is out: its five wizard sentences go through `t('pad.wiz.*')`. Three of them (`' — aperte: '`,
  // `'Mapeados: '`, `'. Agora SOLTE tudo.'`) had neither accent nor function word — exactly the hole this file's header
  // declares («'Coletou' sozinha teria escapado») — and a `wizSay` parameter named `t` shadowing `core/i18n`'s `t` had
  // kept them raw.
  'render/viz-setters.ts': 1,

  /* --- PROGRAMMER MESSAGES, not interface: `throw`s and conformance lists that whoever writes a preset reads in the
   *     console. They stay on the list anyway, WITH the reason — a sieve by SHAPE cannot tell "what the child reads" from
   *     "what the dev reads", and an exception without a count is an open door. --- */
  'boot/create-game.ts': 20,       // the `throw` message and the host's gaps
  // The two that came from the root, and the reason they stay raw did not change with the move: whoever reads them
  // INTEGRATES the engine — the one saying there is no neural voice and the one saying the pause actor was not passed
  // both name the field to declare. `problems` is an English diagnostic channel by decision (ADR-0169).
  'core/cartridge-problems.ts': 2,
                                   // 📌 (About `boot/create-game.ts` above.) Its lines are HOST gaps read by whoever
                                   // integrates the engine, each naming the way out and what the child loses: the
                                   // declared world not found (ADR-0087); the first screen's missing accessibility bar
                                   // (#114); a bar element that accepts no content or click (without the line, a double
                                   // with no `addEventListener` brought the WHOLE boot down); the pause actor with more
                                   // than one seat (`declines.semAtorDePausa`); the pause menu's place (`host.pauseHost`
                                   // inside `#game-region`, ADR-0106); the missing neural-voice port (ADR-0065 §3); the
                                   // pause host OUTSIDE `#game-region` (the arrows do not move inside a panel outside
                                   // `'#game-region .overlay'`); the help not mounted without `preset` (ADR-0147 §4); and
                                   // the GAME drawing over the accessibility bar (ADR-0148 §3), a defect that fails
                                   // nowhere else. Sentences are split into literals to fit the width, and shortening
                                   // them to pay this ledger less would pay with the only part that serves the reader.
  'platform/vosk-runtime.ts': 1,     // ⚠️ ONE `throw` MESSAGE FOR WHOEVER BUILDS A DELIVERY, in the mould of `core/contract`'s:
                                     // the bundle loaded and did not define the global — the delivery has the wrong file.
                                     // No child reads it; whoever reads it built the delivery, and is the only person who can
                                     // fix it. The sieve is by SHAPE and cannot tell the two apart.
  'platform/heavy-catalogue.ts': 6, // ⚠️ THE REASONS A HEAVY THING HAS NO SOURCE, and a child never reads them: they tell
                                   // WHOEVER BUILDS A GAME why a subsystem has nowhere to come from yet. They are ADR-0119's
                                   // whole mechanism — the difference between «este subsistema ainda não tem de onde vir»
                                   // and «este subsistema está tratado» — and putting them through `t()` would ask the
                                   // three dictionaries to carry the state of issues.
                                   // 📌 The heavy-files gate demands each have MORE THAN 40 CHARACTERS: shortening them
                                   // to pay this ledger less would pay with the only part that serves the reader.
                                   // 📏 The sieve counts LITERALS, not sentences — each reason splits in two to fit the
                                   // width; the number is measured, not estimated.
  'platform/onnx-runtime.ts': 1,   // «the heavy catalogue has no address for …» — thrown at whoever BUILDS a game, when an id of
                                   // the heavy catalogue is asked for and is not there. A child never reaches it: it fires before
                                   // a voice or a reading exists, and the engine turns it into the refusal the caller reports
                                   // (ADR-0169). It lived in `kokoro-runtime` until the graph runner became one module for both.
  'platform/reading-runtime.ts': 2, // «the project has no model for …» and «this model has no token for … transcription» —
                                   // both errors for whoever BUILDS a game: a language outside the three, and a model whose
                                   // tokenizer lacks the transcribe instruction. The child never reaches them: their
                                   // `listen()` becomes the refusal the caller reports (ADR-0169), and that line is translated.
  'platform/reading.ts': 1,        // «reading has no microphone here» — said to whoever MOUNTS the engine without sound
                                   // capture; the line the child and the adult read is `problems`', which names the missing half.
  'platform/heavy.ts': 1,        // «sem Cache Storage ou sem fetch» — the state of an environment without the two
                                   // primitives, which in production is an old browser and in the gate the vacuum case.
                                   // It goes in a report's `erro` field, which the engine shows nobody: the game decides
                                   // whether it reaches a screen, and then IT chooses the words (ADR-0111 — the word
                                   // that reaches a person is the GAME's).
  'core/genres.ts': 3,             // The engine's genre list (ADR-0156): two genre NAMES with an apostrophe («Shoot 'em
                                   // ups», «Beat 'em up games»), kept exactly as the Dev transcribed them, and the
                                   // refusal a cartridge's author reads when a genre is not in the list. Data and a
                                   // message for whoever writes a cartridge (ADR-0169), never text a child sees.
  'core/contract.ts': 1,           // ⚠️ `conformanceProblems` is in English, but ADR-0087's `world` field brought a
                                   // sentence — «declare the element that IS the game» — that the sieve by SHAPE counts as
                                   // prose, whatever its language. A new field with its message, not an old module
                                   // getting worse.
  'core/actions.ts': 2,            // `presetProblems`' «the child would see an unlabelled control» and
                                   // `actionSetProblems`' «a game with no action cannot be played». ⚠️ IN ENGLISH, and
                                   // counted all the same: the sieve is by SHAPE — prose with word boundaries — and
                                   // English prose has the same shape as Portuguese. Recording is cheaper than teaching
                                   // the sieve to tell languages apart, and more honest: an exception without a count is
                                   // an open door. Whoever reads these writes a preset (ADR-0085).
};

describe('texto cru em português nas camadas de ENGINE (o buraco do gate do item 14)', () => {
  it('[Right] NENHUM módulo NOVO passa a ter texto de interface em português cru', () => {
    const novos = MODULOS.filter((m) => !(m in CRU_CONHECIDO) && !ISENTOS.has(m))
      .flatMap((m) => crus(m).map((l) => `${m}:${l}`));
    expect(novos, 'texto cru em módulo de engine — passe por t() ou registre o motivo').toEqual([]);
  });

  it('[Boundary] a dívida de cada módulo é um TETO: só encolhe', () => {
    const cresceram = {};
    for (const [m, teto] of Object.entries(CRU_CONHECIDO)) {
      const n = crus(m).length;
      if (n > teto) cresceram[m] = `${teto} → ${n}`;
    }
    expect(cresceram, 'módulo ganhou texto cru novo — o pilar 3 anda para trás').toEqual({});
  });

  it('[Zero] a lista não guarda módulo que já se limpou', () => {
    // Without this case the list would become a graveyard: entries for modules already translated would keep
    // authorising the text to come back, and nobody would know the gate stopped protecting that file.
    for (const m of Object.keys(CRU_CONHECIDO)) {
      expect(crus(m).length, `${m} já não tem texto cru — apague-o de CRU_CONHECIDO`).toBeGreaterThan(0);
    }
  });

  it('[Interface] o total é CONTÁVEL, e o número é o tamanho do que falta', () => {
    // Not decoration: it is the difference between "pillar 3 holds" and "pillar 3 holds in one file". Both the total and
    // the number of entries are ceilings: a ceiling that only rises is a budget; this one falls when someone fixes, and
    // it rises only as a conscious trade — integration diagnostics (read by whoever builds a game or mounts the engine,
    // never by a child) that end a silence nothing else reported. Putting integration diagnostics in the three
    // dictionaries would ask pt, en and es to carry the installer's manual.
    //
    // 🔴 WHAT THIS NUMBER DOES NOT MEASURE: a ONE-word fragment glued to a number by concatenation does not look like
    // prose, so the form «palavra + variável» — how raw Portuguese survives in generated markup — crosses this ledger
    // unseen (the two «Jogador N» the Dev pointed out were both in it). The total is a floor, not a portrait.
    // 🔴 And the entries ceiling exists so that splitting a module hurts too: a list of exceptions that grows without the
    // total growing is still a longer list for whoever reads it.
    const total = Object.values(CRU_CONHECIDO).reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(84);
    expect(Object.keys(CRU_CONHECIDO).length).toBeLessThanOrEqual(21);
  });

  it('[Cross-check] o crivo ainda pega o que os DOIS achados de hoje eram', () => {
    // The case that keeps this file from becoming decoration. If someone tightened `TECNICO` or `pareceProsa` until the
    // gate went green, these two sentences — which really existed, in engine modules — would pass again. They are the
    // floor of what the sieve must see.
    const comoEra = (s) => !TECNICO.some((re) => re.test(s)) && pareceProsa(s);
    expect(comoEra('📚 Nível 2 · Silábico'), 'o rótulo do menu de pausa').toBe(true);
    expect(comoEra('🔊 Portão abriu'), 'a legenda do earcon do portão').toBe(true);
    // And the reverse: what was noise stays noise, or the list fills with noise again.
    expect(comoEra('ControlLeft')).toBe(false);
    expect(comoEra('Atkinson Hyperlegible')).toBe(false);
    expect(comoEra('select[data-slot]')).toBe(false);
  });
});

// ==========================================================================================================
// ⚠️ EVERY PUBLISHED LAYER IS SCANNED OR EXEMPT WITH A REASON — NONE STAYS OUT SILENTLY
//
// A hand-copied layer list drifts both ways (it once named `audio`, which never existed, and missed `educational` and
// `i18n`, which are published), and `if (!existsSync)` swallows the error without a word. `engine-package.node.test.js`
// warns against exactly this about itself.
// ==========================================================================================================
describe('nenhuma camada publicada fica fora do crivo em silencio', () => {
  const PUBLICADAS = camadasPublicadas();

  it('[Interface] a leitura do config acha camadas — senao tudo abaixo seria vazio', () => {
    expect(PUBLICADAS.length, 'o `include` do tsconfig.pkg.json nao deu camada nenhuma').toBeGreaterThan(4);
    expect(PUBLICADAS).toContain('core');
  });

  it('⚠️ [Right] camada publicada entra por OMISSAO — esquecer nao a deixa de fora', () => {
    // ⚠️ Not «every layer is scanned OR exempt»: that CANNOT FAIL, because `CAMADAS` is the published MINUS the exempt, so
    // an orphan is impossible by construction — an assertion that cannot fail is noise dressed as rigour.
    //
    // What stands is the real property: a new layer is born WATCHED. Whoever adds it to the package need not remember this
    // file — and if it brings prose, the debt case fails naming the module. Measured with a one-line `inventada` layer.
    expect(CAMADAS).toEqual(PUBLICADAS.filter((c) => !CAMADAS_ISENTAS.has(c)));
    expect(CAMADAS.length, 'a lista varrida esvaziou-se').toBeGreaterThan(3);
  });

  it('⚠️ [Zero] nenhuma ISENCAO e orfa, e cada uma carrega o motivo', () => {
    // This one really fails: an exemption for a layer no longer published makes the list lie about the hole's size, the
    // rule of the other ledgers in this tree.
    for (const [camada, motivo] of CAMADAS_ISENTAS) {
      expect(PUBLICADAS, `${camada} esta isenta e ja nao e publicada — a isencao ficou orfa`).toContain(camada);
      expect(motivo.length, `motivo curto demais para ser motivo: ${camada}`).toBeGreaterThan(40);
    }
  });

  it('⚠️ [Zero] e nenhuma camada VARRIDA e fantasma — era o caso do `audio`', () => {
    const fantasmas = CAMADAS.filter((c) => !existsSync(join(RAIZ, c)));
    expect(fantasmas, 'camada na lista que nao existe no disco: o crivo diz que a vigia e nao vigia nada').toEqual([]);
  });

  it('⚠️ [Cross-check] a isencao do `educational` CARREGA PESO — varre-lo acharia prosa', () => {
    // An exemption that changes nothing is decoration, and decoration is what survives a distracted clean-up. This case
    // proves ADR-0032's decision is the only thing separating that layer from the debt table.
    const dir = join(RAIZ, 'educational');
    const achados = readdirSync(dir).filter((f) => f.endsWith('.ts')).flatMap((f) => crus('educational/' + f));
    expect(achados.length, 'o `educational` deixou de ter prosa pt-BR; a isencao dele virou decoracao').toBeGreaterThan(10);
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · putting `"app/js/audio"` back in `tsconfig.pkg.json`'s `include` → the [Zero] no-phantom-layer case fails. It was
//     this file's real state before the fix, and `if (!existsSync)` swallowed it.
//   · exempting a layer that is not published → the [Zero] no-orphan-exemption case fails.
//   · adding an `inventada` layer to the package WITH a pt-BR sentence inside → the [Right] no-new-module case fails
//     naming `inventada/x.ts`. The proof that inclusion by default works: whoever adds a layer need not remember this
//     file.
//   · ⚠️ the SAME `inventada` layer WITHOUT prose inside → no case fails, and that is right: a new layer is watched, not
//     suspect. This mutation showed the first wording of the case above was empty — «toda camada esta varrida OU
//     isenta» cannot fail, because `CAMADAS` is defined as the published minus the exempt.
