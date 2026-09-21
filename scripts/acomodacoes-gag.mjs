// SPDX-License-Identifier: AGPL-3.0-or-later
//
// A PRIORIDADE DAS ACOMODAÇÕES PELA GAME ACCESSIBILITY GUIDELINES — a segunda coluna (fase 2a, passo 2).
//
// 🔴 PORQUÊ ISTO EXISTE: o `CLAUDE.md` põe «WCAG 2.2 + GAG» como pilar, e o estudo das acomodações citou só a
// WCAG. O catálogo saiu do que a engine já tinha mais o que eu inferi dos géneros — e lida a GAG, faltavam
// acomodações e uma estava mal priorizada (`velocidadeDoTexto` é Basic, o estudo pusera-a na cauda).
//
// 🎯 DUAS COLUNAS, E AMBAS CONTAM: o ALCANCE (medido pelas chaves de `lib/acomodacoes.mjs`) e o NÍVEL GAG
// (Basic → Intermediate → Advanced). O que entra primeiro é a intersecção: **Basic × alcance alto**.
//
// ⚠️ O TEXTO DA GAG NÃO ENTRA NESTE REPOSITÓRIO. A página não declara licença, e por isso aqui ficam só os
// SLUGS — o identificador de cada directriz na URL dela — e a minha classificação. O texto, o nível e o eixo
// lêem-se da página, ao vivo ou de uma cópia local.
//
// ⚠️ E A PÁGINA NÃO TEM REVISÃO: a lista é fixada por uma impressão digital (data + sha256 dos pares
// eixo/nível/slug). Se a GAG mudar, isto reprova em vez de classificar uma lista que já não é a que foi lida.
//
// ⚠️ SEIS GUARDAS, e nenhuma é zelo:
//   1. a lista lida não é a fixada · 2. uma directriz da página SEM classificação · 3. uma classificação de um
//   slug que a página não tem · 4. uma acomodação citada que não existe no catálogo · 5. uma razão desconhecida
//   6. uma directriz que não vira acomodação e NÃO diz porquê
//
//   node scripts/acomodacoes-gag.mjs [--gag copia-da-full-list.html] [caminho-do-catalogo.html]
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CATALOGO_PADRAO, lerCatalogo } from './lib/taxonomia.mjs';
import { ACOM, medir } from './lib/acomodacoes.mjs';

const GAG_URL = 'https://gameaccessibilityguidelines.com/full-list/';
const FIXADA = { lida: '2026-09-12', sha256: '88c0a63738192e514d07ddb98cee57b7ebe1098d00d2df82518467d8280743f1' };
const NIVEIS = ['Basic', 'Intermediate', 'Advanced'];
const EIXOS_GAG = ['Motor', 'Cognitive', 'Vision', 'Hearing', 'Speech', 'General'];

/* ===================== AS RAZÕES para uma directriz NÃO virar acomodação ===================== */
const RAZOES = {
  autoria: 'regra de DESENHO que quem escreve o jogo segue — não é um ajuste que a criança liga',
  'regra-da-engine': 'a engine já o faz sempre, sem interruptor — a nota diz onde',
  processo: 'processo de estúdio (testes, feedback, embalagem) — não é código de jogo',
  'fora-do-escopo': 'a engine não tem a coisa a que a directriz se aplica — a nota diz porquê',
  'conflito-com-pilar': '⚠️ choca com um pilar do ADR-0010 — não se resolve aqui',
};

/* ===================== AS 105 DIRECTRIZES =====================
 * Valor = lista de acomodações do catálogo que a cumprem, OU `{ razao, nota }`.
 * Ordem: a da página (Motor, Cognitive, Vision, Hearing, Speech, General); uma directriz que aparece em dois
 * eixos é classificada UMA vez, onde aparece primeiro.
 */
const D = {
  // — Motor —
  'include-an-option-to-adjust-the-game-speed': ['velocidadeDoJogo'],
  'include-toggle-slider-for-any-haptics': { razao: 'fora-do-escopo', nota: 'a engine não tem vibração (o único «rumble» é áudio, `render/weather`); o interruptor nasce com ela, pelo ADR-0106 §5' },
  'ensure-interactive-elements-virtual-controls-are-large-and-well-spaced-particularly-on-small-or-touch-screens': ['tamanhoDoAlvo'],
  'include-an-option-to-adjust-the-sensitivity-of-controls': ['sensibilidadeDoControle'],
  'ensure-that-all-areas-of-the-user-interface-can-be-accessed-using-the-same-input-method-as-the-gameplay': { razao: 'regra-da-engine', nota: 'teclado e controle entram pelo mesmo `ui/menu-nav.ts` (`input/gamepad.ts` chama `navDialog`/`navPause`); o toque NÃO foi conferido' },
  'ensure-controls-are-as-simple-as-possible-or-provide-a-simpler-alternative': ['umBotaoSo'],
  'allow-controls-to-be-remapped-reconfigured': ['remapearTeclas'],
  'do-not-rely-on-motion-tracking-of-specific-body-types': { razao: 'autoria', nota: 'vale para quem usar a webcam como entrada (fase 6)' },
  'provide-a-macro-system': ['macros'],
  'allow-interfaces-to-be-resized': ['tamanhoDaInterface'],
  'allow-interfaces-to-be-rearranged': ['rearranjarInterface'],
  'avoid-provide-alternatives-to-requiring-buttons-to-be-held-down': ['alternanciaDeMarcha', 'alternanciaDoCorrer'],
  'if-producing-a-pc-game-support-windowed-mode-for-compatibility-with-overlaid-virtual-keyboards': { razao: 'fora-do-escopo', nota: 'é uma PWA no navegador; a janela é a do sistema' },
  'avoid-repeated-inputs-button-mashing-quick-time-events': ['entradaRepetida'],
  'ensure-that-all-key-actions-can-be-carried-out-by-digital-controls-pad-keys-presses-with-more-complex-input-eg-analogue-speech-gesture-not-required-and-included-only-as-supplementary-al': { razao: 'regra-da-engine', nota: '`core/actions.ts`: as acções são posições digitais; ponteiro contínuo é declaração à parte (`needsPointer`)' },
  'ensure-that-multiple-simultaneous-actions-eg-click-drag-or-swipe-are-not-required-and-included-only-as-a-supplementary-alternative-input-method': { razao: 'regra-da-engine', nota: '`GameDeclaration.holdsAtOnce()` é obrigatório e o alcance avisa (ADR-0104)' },
  'make-interactive-elements-that-require-accuracy-eg-cursor-touch-controlled-menu-options-stationary': { razao: 'autoria', nota: 'o jogo decide se um alvo se mexe' },
  'support-more-than-one-input-device': { razao: 'regra-da-engine', nota: '`input/keyboard.ts`, `input/gamepad.ts`, `input/touch.ts`' },
  'provide-very-simple-control-schemes-that-are-compatible-with-assistive-technology-devices-such-as-switch-or-eye-tracking': ['umBotaoSo'],
  'include-a-cool-down-period-post-acceptance-delay-of-0-5-seconds-between-inputs': ['intervaloEntreEntradas'],
  'do-not-make-precise-timing-essential-to-gameplay-offer-alternatives-actions-that-can-be-carried-out-while-paused-or-a-skip-mechanism': ['janelaDeAcerto', 'velocidadeDoJogo', 'pularTrecho'],
  'allow-play-in-both-landscape-and-portrait': { razao: 'conflito-com-pilar', nota: 'o pilar 5 fixa 320×180 (Libras 420×180), que é paisagem; retrato pediria outra grelha de pixel' },
  // — Cognitive —
  'avoid-flickering-images-and-repetitive-patterns': ['reducaoCena'],
  'allow-players-to-progress-through-text-prompts-at-their-own-pace': ['velocidadeDoTexto'],
  'include-interactive-tutorials': { razao: 'autoria', nota: 'o tutorial é conteúdo do jogo' },
  'use-simple-clear-language': ['dificuldadeLexical'],
  'allow-the-game-to-be-started-without-the-need-to-navigate-through-multiple-levels-of-menus': { razao: 'autoria', nota: 'o fluxo até jogar é do jogo; não conferi que a engine o garanta' },
  'use-simple-clear-text-formatting': ['tipografia'],
  'use-an-easily-readable-default-font-size': ['tipografia'],
  'highlight-important-words': ['realceDePalavras'],
  'provide-a-choice-of-text-colour-low-high-contrast-choice-as-a-minimum': ['altoContraste'],
  'provide-gameplay-thumbnails-with-game-saves': { razao: 'autoria', nota: 'jogos de minutos raramente gravam; quem gravar, mostra' },
  'support-voice-chat-as-well-as-text-for-multiplayer-games': { razao: 'fora-do-escopo', nota: 'não há conversa online: o multijogador é local (pilar 7) e a privacidade infantil (pilar 4) não a admite' },
  'ensure-no-essential-information-especially-instructions-is-conveyed-by-text-alone-reinforce-with-visuals-and-or-speech': ['narracao', 'libras'],
  'if-using-a-long-overarching-narrative-provide-summaries-of-progress': { razao: 'autoria', nota: 'narrativa é do jogo' },
  'employ-a-simple-clear-narrative-structure': { razao: 'autoria', nota: 'narrativa é do jogo' },
  'include-a-means-of-practicing-without-failure-such-as-a-practice-level-or-sandbox-mode': ['dificuldade'],
  'indicate-allow-reminder-of-controls-during-gameplay': ['ajudaDosControles'],
  'indicate-allow-reminder-of-current-objectives-during-gameplay': ['lembreteDoObjetivo'],
  'include-contextual-in-game-helpguidancetips': ['dicaOuRealce'],
  'give-a-clear-indication-that-interactive-elements-are-interactive': { razao: 'autoria', nota: 'o jogo desenha o que é interactivo' },
  'ensure-sound-music-choices-for-each-key-objects-events-are-distinct-from-each-other': { razao: 'autoria', nota: 'desenho de som do jogo' },
  'provide-an-option-to-turn-off-hide-background-movement': ['reducaoCena'],
  'provide-separate-volume-controls-or-mutes-for-effects-speech-and-background-music': ['som'],
  'provide-an-option-to-turn-off-hide-all-non-interactive-elements': ['reducaoCena'],
  'allow-all-narrative-and-instructions-to-be-replayed': ['repetirInstrucao'],
  'avoid-any-sudden-unexpected-movement-or-events': ['intensidade'],
  'provide-an-option-to-disable-blood-and-gore': { razao: 'autoria', nota: 'o catálogo é infantil; um jogo que tenha sangue oferece-o' },
  'provide-pre-recorded-voiceovers-for-all-text-including-menus-and-installers': ['narracao'],
  'use-symbol-based-chat-smileys-etc': { razao: 'fora-do-escopo', nota: 'não há conversa online (ver voice chat acima)' },
  // — Vision —
  'provide-high-contrast-between-text-ui-and-background': ['altoContraste'],
  'avoid-vr-simulation-sickness-triggers': ['balancoDaCamara'],
  'if-the-game-uses-field-of-view-3d-engine-only-set-an-appropriate-default-for-the-expected-viewing-environment': ['balancoDaCamara'],
  'ensure-no-essential-information-is-conveyed-by-a-fixed-colour-alone': ['correcaoDaltonismo', 'naipesDistinguiveis'],
  'avoid-placing-essential-temporary-information-outside-the-players-eye-line': { razao: 'autoria', nota: 'o jogo decide onde escreve; a engine só reserva a barra (ADR-0148)' },
  'ensure-manual-website-are-provided-in-a-screenreader-friendly-format': { razao: 'processo', nota: 'documentação publicada' },
  'provide-a-choice-of-cursor-crosshair-colours-designs': ['corDoPonteiro'],
  'provide-an-option-to-adjust-contrast': ['altoContraste'],
  'ensure-screenreader-support-for-mobile-devices': ['leitorDeTela'],
  'use-surround-sound': ['navegacaoSonora'],
  'avoid-or-provide-option-to-disable-any-difference-between-controller-movement-and-camera-movement': ['balancoDaCamara'],
  'if-the-game-uses-field-of-view-3d-engine-only-allow-a-means-for-it-to-be-adjusted': ['balancoDaCamara'],
  'provide-an-audio-description-track': ['audiodescricao'],
  'simulate-binaural-recording': ['navegacaoSonora'],
  'use-distinct-sound-music-design-for-all-objects-and-events': { razao: 'autoria', nota: 'desenho de som do jogo' },
  'ensure-screenreader-support-including-menus-installers': ['leitorDeTela'],
  'ensure-that-all-key-actions-can-be-carried-out-by-digital-controls-pads-keys-presses-with-more-complex-input-eg-analogue-gesture-not-required-and-included-only-as-supplementary-alternati': { razao: 'regra-da-engine', nota: 'a mesma do eixo Motor: `core/actions.ts`' },
  'allow-easy-orientation-to-movement-along-compass-points': ['blindMode'],
  'provide-a-voiced-gps': ['navegacaoSonora'],
  'provide-a-pingable-sonar-style-audio-map': ['blindMode'],
  'allow-the-font-size-to-be-adjusted': ['tipografia'],
  // — Hearing —
  'if-any-subtitles-captions-are-used-present-them-in-a-clear-easy-to-read-way': ['legendasDeSom'],
  'ensure-no-essential-information-is-conveyed-by-sounds-alone': ['legendasDeSom'],
  'provide-subtitles-for-all-important-speech': { razao: 'regra-da-engine', nota: 'a fala da engine é leitura de texto que já está na tela (narração); fala GRAVADA por um jogo precisa da legenda dele' },
  'provide-a-stereo-mono-toggle': ['monoEstereo'],
  'ensure-that-all-important-supplementary-information-eg-the-direction-you-are-being-shot-from-conveyed-by-audio-is-replicated-in-text-visuals': ['legendasDeSom'],
  'allow-subtitle-caption-presentation-to-be-customised': ['legendasDeSom'],
  'provide-a-visual-indication-of-who-is-currently-speaking': { razao: 'autoria', nota: 'quem fala é personagem do jogo' },
  'provide-captions-or-visuals-for-significant-background-sounds': ['legendasDeSom'],
  'ensure-subtitles-captions-are-or-can-be-turned-on-before-any-sound-is-played': { razao: 'regra-da-engine', nota: '`captionsOn` nasce `true` (`core/state.ts`)' },
  'provide-subtitles-for-supplementary-speech': { razao: 'regra-da-engine', nota: 'a mesma da fala importante: a narração lê texto visível' },
  'keep-background-noise-to-minimum-during-speech': ['som'],
  'provide-visual-means-of-communicating-in-multiplayer': { razao: 'fora-do-escopo', nota: 'não há conversa online' },
  'support-text-chat-as-well-as-voice-for-multiplayer': { razao: 'fora-do-escopo', nota: 'não há conversa online' },
  'allow-a-preference-to-be-set-for-playing-online-multiplayer-with-players-who-will-only-play-with-are-willing-to-play-without-voice-chat': { razao: 'fora-do-escopo', nota: 'não há multijogador online (pilar 7)' },
  'provide-signing': ['libras'],
  'ensure-that-subtitles-captions-are-cut-down-to-and-presented-at-an-appropriate-words-per-minute-for-the-target-age-group': ['velocidadeDoTexto'],
  // — Speech —
  'ensure-that-speech-input-is-not-required-and-included-only-as-a-supplementary-alternative-input-method': { razao: 'autoria', nota: 'a engine ainda não tem entrada por voz (fase 6); quando tiver, é suplementar' },
  'base-speech-recognition-on-individual-words-from-a-small-vocabulary-eg-yes-no-open-instead-of-long-phrases-or-multi-syllable-words': { razao: 'autoria', nota: 'entrada por voz, fase 6' },
  'base-speech-recognition-on-hitting-a-volume-threshold-eg-50-instead-of-words': { razao: 'autoria', nota: 'entrada por voz, fase 6' },
  // — General —
  'solicit-accessibility-feedback': { razao: 'processo', nota: 'processo do projecto' },
  'ensure-that-all-settings-are-saved-remembered': { razao: 'regra-da-engine', nota: '`platform/storage.ts` `KEYS`' },
  'provide-details-of-accessibility-features-in-game': { razao: 'regra-da-engine', nota: 'a barra de acessibilidade e o rodapé que explica cada linha (`CLAUDE.md` §4)' },
  'provide-details-of-accessibility-features-on-packaging-and-or-website': { razao: 'processo', nota: 'página pública' },
  'offer-a-wide-choice-of-difficulty-levels': ['dificuldade'],
  'allow-gameplay-to-be-fine-tuned-by-exposing-as-many-variables-as-possible': ['dificuldade'],
  'allow-a-preference-to-be-set-for-playing-online-multiplayer-with-without-others-who-are-using-accessibility-features-that-could-give-a-competitive-advantage': { razao: 'fora-do-escopo', nota: 'não há multijogador online' },
  'provide-an-autosave-feature': { razao: 'autoria', nota: 'jogos de minutos; quem tiver progresso longo grava' },
  'provide-a-manual-save-feature': { razao: 'autoria', nota: 'idem' },
  'include-assist-modes-such-as-auto-aim-and-assisted-steering': ['assistencia'],
  'offer-a-means-to-bypass-gameplay-elements-that-arent-part-of-the-core-mechanic-via-settings-or-in-game-skip-option': ['pularTrecho'],
  'include-some-people-with-impairments-amongst-play-testing-participants': { razao: 'processo', nota: 'teste com pessoas' },
  'allow-difficulty-level-to-be-altered-during-gameplay-either-through-settings-or-adaptive-difficulty': ['dificuldade'],
  'allow-settings-to-be-saved-to-different-profiles-at-either-game-or-platform-level': ['perfis'],
  'include-every-relevant-category-of-impairment-motor-cognitive-etc-amongst-play-testing-participants-in-representative-numbers-based-on-age-demographic-of-target-audience': { razao: 'processo', nota: 'teste com pessoas' },
};

/* ===================== ler a GAG ===================== */
const args = process.argv.slice(2);
const iGag = args.indexOf('--gag');
const copia = iGag >= 0 ? args.splice(iGag, 2)[1] : null;
const html = copia ? readFileSync(copia, 'utf8') : await (await fetch(GAG_URL, { headers: { 'User-Agent': 'the-inclusionist-engine/estudo (educational accessibility research)' } })).text();
const inicio = html.indexOf('<h2>Motor</h2>');
const fim = html.indexOf('</article>', inicio);
if (inicio < 0 || fim < 0) { console.error('a estrutura da GAG mudou: não achei <h2>Motor</h2> … </article>'); process.exit(2); }
const lidas = [];
let eixo = null, nivel = null;
for (const m of html.slice(inicio, fim).matchAll(/<h2[^>]*>([^<]+)<\/h2>|<h3[^>]*>([^<]+)<\/h3>|<li class="icon"><svg[^>]*>[\s\S]*?<\/svg><a href="https:\/\/gameaccessibilityguidelines\.com\/([^"/]+)\/">([^<]+)<\/a>/g)) {
  // 📌 E SÃO DUAS DEFESAS DE PROPÓSITO, o que as mutações mostraram: tirar uma só não reprova nada, porque a outra
  // segura; tiradas as duas, a impressão digital muda e a guarda 1 reprova. Nenhuma das duas é inerte.
  // ⚠️ A barra lateral da página também tem `<li class="icon">` sob um `<h2 id=…>` («All guidelines»: /basic/,
  // /full-list/…), e a guarda 2 apanhou-os na primeira corrida como «directrizes sem classificação». Por isso um
  // `<h2>` qualquer ZERA o nível, e só entra o que está sob um dos seis eixos da GAG.
  if (m[1]) { eixo = m[1]; nivel = null; } else if (m[2]) nivel = m[2];
  else if (EIXOS_GAG.includes(eixo) && NIVEIS.includes(nivel)) lidas.push({ eixo, nivel, slug: m[3] });
}
const impressao = createHash('sha256').update(lidas.map((l) => `${l.eixo}|${l.nivel}|${l.slug}`).sort().join('\n')).digest('hex');

/* ===================== as seis guardas ===================== */
const problemas = [];
if (FIXADA.sha256 && impressao !== FIXADA.sha256) problemas.push(`a GAG mudou desde ${FIXADA.lida}: ${impressao.slice(0, 12)} ≠ ${FIXADA.sha256.slice(0, 12)} — reclassificar antes de confiar`);
const slugs = new Set(lidas.map((l) => l.slug));
for (const s of slugs) if (!(s in D)) problemas.push(`directriz SEM classificação: ${s}`);
for (const s of Object.keys(D)) if (!slugs.has(s)) problemas.push(`classificação de um slug que a página NÃO tem: ${s}`);
for (const [s, v] of Object.entries(D)) {
  if (Array.isArray(v)) {
    if (!v.length) problemas.push(`${s}: lista vazia — ou acomodações, ou { razao, nota }`);
    for (const a of v) if (!(a in ACOM)) problemas.push(`${s}: acomodação «${a}» não existe no catálogo`);
  } else {
    if (!(v.razao in RAZOES)) problemas.push(`${s}: razão «${v.razao}» desconhecida`);
    if (!v.nota) problemas.push(`${s}: não vira acomodação e NÃO diz porquê`);
  }
}
const categorias = lerCatalogo(args[0] ?? CATALOGO_PADRAO, 'node scripts/acomodacoes-gag.mjs [--gag copia.html] <catalogo.html>');
const medida = medir(categorias);
problemas.push(...medida.problemas);
if (problemas.length) { for (const p of problemas) console.error('⚠️ ' + p); process.exit(1); }

/* ===================== cruzar ===================== */
const { linhas, TOTAL } = medida;
const gagDe = {};
for (const l of lidas) {
  const v = D[l.slug];
  if (!Array.isArray(v)) continue;
  for (const a of v) (gagDe[a] ??= []).push(l);
}
const melhor = (ls) => Math.min(...ls.map((l) => NIVEIS.indexOf(l.nivel)));
const tabela = linhas.map((l) => {
  const g = gagDe[l.k] ?? [];
  return { ...l, nivel: g.length ? melhor(g) : 9, eixosGag: [...new Set(g.map((x) => `${x.eixo[0]}${x.nivel[0]}`))], nDir: new Set(g.map((x) => x.slug)).size };
}).sort((a, b) => a.nivel - b.nivel || b.nJogos - a.nJogos);
const pct = (n) => `${Math.round((n / TOTAL) * 100)}%`;

console.log(`GAG: ${slugs.size} directrizes (${lidas.length} entradas por eixo) · impressão ${impressao.slice(0, 12)} · lida ${copia ? 'de cópia' : 'ao vivo'}`);
const porRazao = {};
for (const v of Object.values(D)) { const r = Array.isArray(v) ? 'acomodação' : v.razao; porRazao[r] = (porRazao[r] ?? 0) + 1; }
console.log('classificação: ' + Object.entries(porRazao).map(([r, n]) => `${r} ${n}`).join(' · ') + '\n');
console.log('nível  acomodação               tem?  alcance  directrizes  eixos GAG (M/C/V/H/S/G × B/I/A)');
console.log('─'.repeat(100));
for (const t of tabela) {
  const n = t.nivel === 9 ? '  —  ' : NIVEIS[t.nivel].slice(0, 5).padEnd(5);
  console.log(`${n}  ${t.k.padEnd(24)} ${t.tem ? ' sim' : ' NÃO'}  ${pct(t.nJogos).padStart(6)}  ${String(t.nDir || '').padStart(6)}       ${t.eixosGag.join(' ')}`);
}
console.log('\n=== 🎯 A INTERSECÇÃO: Basic × a engine NÃO tem, por alcance ===');
for (const t of tabela.filter((x) => x.nivel === 0 && !x.tem)) console.log(`  ${t.k.padEnd(24)} ${pct(t.nJogos).padStart(5)}  — ${t.o}`);
console.log('\n=== fora da GAG (nenhuma directriz as pede) ===');
console.log('  ' + tabela.filter((x) => x.nivel === 9).map((x) => x.k).join(', '));
console.log('\n=== as que NÃO viram acomodação ===');
for (const [r, desc] of Object.entries(RAZOES)) {
  const ss = Object.entries(D).filter(([, v]) => !Array.isArray(v) && v.razao === r);
  if (!ss.length) continue;
  console.log(`\n  ${r} (${ss.length}) — ${desc}`);
  for (const [s, v] of ss) console.log(`    ${s.slice(0, 70).padEnd(70)} ${v.nota}`);
}
