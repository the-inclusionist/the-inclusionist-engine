// SPDX-License-Identifier: AGPL-3.0-or-later
// The Inclusionist v4 — port do Lúdico real sobre PixiJS.
// ESTE ARQUIVO CHAMAVA-SE game.js ate a etapa D2 da modularizacao. O nome mudou porque o conteudo mudou: o
// jogo saiu daqui para 55 modulos em core/game/input/platform/render/ui, e o que restou e COMPOSITION ROOT —
// cria as instancias, liga uma na outra e registra os ouvintes. Se voce veio procurar como o jogo funciona,
// nao e aqui: e a fisica em game/physics, o desenho em render/draw, a rodada em game/session, o teclado em
// input/keydown. Os cabecalhos dos modulos ainda dizem 'extraido do game.js', e devem continuar dizendo:
// aquele era o nome do arquivo quando cada um saiu de la.
// VERSIONAMENTO (recalculado do git em 2026-07-02): MINOR +1 a cada feature (patch zera);
// PATCH +1 a cada conserto/ajuste; docs/chore não mudam versão. INCL_VERSION agora é DISPLAY (bump em mudança relevante); o cache é por content-hash do vite-plugin-pwa (Estágio 1) — sem sw.js/bump manual.
import * as PIXI from 'pixi.js'; // PixiJS 7.4.2 via npm (Vite empacota; aposenta o <script> global vendor/pixi.min.js)
import i18n, { t } from './core/i18n.js'; // internacionalização
import * as tiles from './core/tiles.js'; // legend + parser do mapa em glifo
import * as store from './platform/storage.js'; // camada de persistência
import { emit, vizMode, initVizMode, modoCego, setModoCegoValue, caneBlockDiv, setCaneBlockDivValue, wheelchair, setWheelchairValue, oneButton, setOneButtonValue, cbSafe, setCbSafeValue, ownerColors, setOwnerColorsValue, hcOutlineFg, setOutlineFgValue, hcOutlineBg, setOutlineBgValue, letterCase, setLetterCaseValue, captionsOn, setCaptionsOnValue, menuIndexOn, defaultReducedMotion } from './core/state.js'; // estado compartilhado
import { cenario as CENARIO, setCenarioValue, activity as ACTIVITY, setActivityValue } from './game/state.js'; // GAME (ADR-0038, Fase B)
import { createRunState } from './core/run-state.js'; // ADR-0038 Fase B: a RODADA como fábrica
import { criarCenasDoJogo, type Fase } from './game/cenas.js'; // as três cenas DESTE jogo (ADR-0030 C3)
import type { FatosDaCena } from './core/scenes.js';
import type { Powerup } from './game/level-geometry.js'; // o tipo do power-up é do JOGO

// ⚠️ A POSIÇÃO É O CONTRATO. A primeira versão declarou isto 380 linhas abaixo, e o boot morreu com
// `Cannot read properties of undefined (reading 'gateOpen')`: o `initCollision` da linha ~162 já lê a
// instância. Sem minificar seria um erro de TDZ com nome; minificado, `const` de topo vira `var` e o erro
// vira um `undefined` silencioso. Terceira vez que esta armadilha morde este arquivo — as outras foram o
// `setPlayerViz` e os auxiliares `jogadores()`/`controlados()`.

/**
 * A RODADA (ADR-0038, Fase B). A raiz de composição POSSUI a instância; ninguém mais a alcança por
 * import. O genérico é `Powerup` porque o tipo do power-up é do JOGO — a engine declara a forma da lista
 * e quem cria diz de quê ela é. Era `readonly unknown[]` em `core/state`, e o `unknown` custava três
 * erros de tipo aqui embaixo.
 */
const rodada = createRunState<Powerup>({ aoTrocarJogadores: (n) => emit('numPlayers', n) });
// `players` é um APELIDO, não uma cópia: a lista da rodada nunca é reatribuída (só mutada no lugar), então
// um `const` aponta para o mesmo array para sempre — e as 44 leituras deste arquivo seguem escritas igual.
// Ver a nota do campo em `core/run-state`, que é onde essa garantia está declarada.
const players = rodada.players;
// Os dois módulos que leem a contagem sem ter ctx: a escala das telas e a ancoragem da scanline. Ligados
// AQUI, junto da criação da rodada, e não lá embaixo — um `initLayout` esquecido não dá erro nenhum, só
// devolve 1 para sempre, e o multi-tela nasceria com a grade de um jogador.
/* ===================== AS CENAS (ADR-0030 C3, passo 3 da Fase B) =====================
   `phase: 'title'|'playing'|'paused'` SAIU de `core/state`. As três cenas e as regras de ir de uma para a
   outra moram em `game/cenas` — do lado do JOGO, porque o vocabulário é dele —, e o que atravessa de volta
   para a engine são três BOOLEANOS (`FatosDaCena`). É a mesma correção que o `consumer-quiz` obrigou a
   fazer no `menu-nav` (`getPhase()` → `isNavigable()`), registrada em `core/constants` como o erro a não
   repetir.

   ⚠️ O QUE ESTE PASSO NÃO FAZ: as cenas ainda não têm CORPO. As três regras do `core/scenes` — update só no
   topo, draw de baixo para cima, input só no topo — continuam sendo os `if (!mundoRodando) return`
   espalhados. Encaminhar o quadro pela pilha muda o laço principal, e misturar isso com "quem pergunta o
   quê" tornaria qualquer regressão inatribuível. Fica para a fatia seguinte. */
// O `aoTrocar` é ARROW e não valor, e isso é o que o torna válido aqui: `shell` é um `const` declarado
// ~1.500 linhas abaixo, e só a resolução na hora da chamada o tira da TDZ. A primeira troca de cena é o
// `setPhase('title')` do boot, lá embaixo, depois de a casca existir. (Mesmo padrão do ctx da pausa.)
const cenas = criarCenasDoJogo(() => shell.aplicarCena());
const fatosDaCena = (): FatosDaCena => cenas.fatos();
initLayout({ numJogadores: () => rodada.numPlayers });
// `a11yVisualAtiva`: ALGUM jogador fora do modo `normal`. O CRT é decoração GLOBAL — uma só para a tela
// inteira —, então não há como escurecer as bordas de meia tela; se decoração e acessibilidade de qualquer
// criança se contradizem, quem cede é a decoração (ADR-0020, "precedência a11y > estética").
initCrt({
  numJogadores: () => rodada.numPlayers,
  a11yVisualAtiva: () => players.some((p) => { const m = VIZ_BY_KEY[p.viz]; return !!m && m.kind !== 'normal'; }),
});
import type { Player, PlayerView } from './core/entity.js'; // a entidade da ENGINE, e a vista mínima dela
import type { GamePlayer, ControlledGamePlayer } from './game/entity.js'; // as deste JOGO — ver `jogadores`/`controlados`
import type { ModalIntent } from './input/keydown.js'; // a intenção direcional do ADR-0033
import type { RenderTextureLike, SpriteLike, GraphicsLike } from './render/screen-pipeline.js'; // o ctx de lá declara estes
import type { MotionSceneKey, MotionSceneFlags, MotionCharDef } from './ui/settings-motion.js'; // as quatro chaves de movimento reduzido
import type { HcRoleKey } from './render/hc-role-data.js'; // HC_ROLE é Record<HcRoleKey, …>: a chave não é `string`
import { quizLevel, setQuizLevelValue, coins, setCoins } from './game/state.js'; // item 19: o estado DESTE jogo
import { startLoop } from './core/loop.js'; // driver do loop
import { initDebugPanel } from './ui/debug-panel.js'; // painel ?debug (Tier 1)
import { createAttract } from './game/attract.js'; // modo demonstração (Tier 1)
import { isValidActivityId, DEFAULT_ACTIVITY_ID, modeForActivity, type GameMode }
  from './educational/activities-registry.js'; // ADR-0040: o MODE deriva daqui, e a derivação mora no currículo

import { buildElevators, elevAt, getElevShafts, initElevators } from './game/elevators.js'; // Estágio 4 (Tier 2): geometria de elevador (cadeirante)
import { fmtFrac, fracGraphic, speakChoice } from './game/fractions.js'; // Estágio 4 (Tier 2): matemática/render de frações
import { brailleText } from './game/braille.js'; // Estágio 4 (Tier 2): cela braille + fala (atividade cego)
import { SOMASUB_SHAPES, WORD_INITIALS } from './game/activity-content.js'; // Estágio 4 (Tier 2): dados das atividades (formas + sílabas)
import { JUICE, saveJuice, puffDust, burstSparkle, addShake, addHitstop, setSquash, stepFx, initFx, tickHitstop, getParticles, getHitstopT, getShakeT } from './render/fx.js'; // Estágio 4 (Tier 2): juice (partículas/shake/hitstop/squash)
import { parallaxPlaceholder, themeSkyTexture, themeHillsTexture, themeCitySkyTexture, themeSkylineTexture } from './render/scene-parallax.js'; // Estágio 4 (Tier 2): geradores de textura do parallax
import { worldCanvas, initWorldTex } from './render/world-tex.js'; // Estágio 4 (Tier 2): builder da textura NORMAL do mundo
import { kb, initKB, setKB, saveKB, resetKB } from './input/keyboard.js'; // Fase 2: config de teclado (subsistema input)
import { AUDIO_CATS } from './platform/audio-mixer.js'; // Fase 2: categorias do mixer (dados); audioCat/catNode/setCatGain vêm de audio.js
import { FONT_GROUPS } from './ui/fonts.js'; // Fase 2: tipografia (catálogo + persistência)
import { $, $$, toggleBtn, toggleLabel } from './ui/dom.js';
import { initSettingsAudio } from './ui/settings-audio.js';
import { initSettingsControls, ACT_LABEL, keyName } from './ui/settings-controls.js';
import { initSettingsVisual, ROLE_LABELS } from './ui/settings-visual.js';
import { initSettingsCaa } from './ui/settings-caa.js';
import { cityTiles } from './render/city-tiles.js'; // #16: os tiles da Cidade como dados, não como PNG // 7º menu: Comunicação Aumentada e Alternativa (ADR-0028)
import { initSettingsEmpathy } from './ui/settings-empathy.js';
import { initSettingsMotor, playerPrefix } from './ui/settings-motor.js';
import { initSettingsMotion, setSelectedPlayer as setSelectedMotionPlayer } from './ui/settings-motion.js';
import { initSettingsTypo } from './ui/settings-typo.js';
import { initTitle } from './ui/title.js';
import { createTitleScene } from './render/title-scene.js'; // Fase 2.27: atalho de querySelector (Tier 1)
import { VIZ_MODES, VIZ_BY_KEY, VIZ_CYCLE, simulatesDisability } from './render/viz-modes.js'; // Fase 2: modos visuais de a11y (dados)
import { PAD_DESIGNS } from './input/devices.js'; // Fase 2: rótulos de gamepad/toque (dados)
import { keys, padCur, padPrevAct, held } from './input/state.js'; // Fase 2.22: estado de input + held
import { audioCtx, ensureAC, soundOn, volume, setSoundOn, setVolume, audioOut, hearingLoss, setHearingLossGraph, setMasterMuted, audioCat, initAudioMixer, catNode, setCatGain, tone, tonePan, noiseBuffer, noiseHit, _footCount } from './platform/audio.js'; // Fase 2: base + mestre + mixer + sínteses (oscilador + ruído)
import { gameSay } from './platform/speech.js';
import { createAudioJingles } from './platform/audio-jingles.js'; // Tier 2 (áudio r1): jingles de vitória/enigma/fogos
import { createAudioEarcons } from './platform/audio-earcons.js'; // Tier 2 (áudio r2): earcons (sfx) + porta + legendas
import { createAudioSonar } from './platform/audio-sonar.js'; // item 19: navegacao sonora, a metade que serve a QUALQUER genero
import { createAudioNav } from './platform/audio-nav.js'; // Tier 2 (áudio r3): bengala e nado cego (a metade que le o mundo)
import { createAudioAmbient } from './platform/audio-ambient.js'; // Tier 2 (áudio r4): trilha de ambiente + trovão
import { createTts } from './platform/tts.js'; // Tier 2 (#38): narração por voz (Piper neural lazy + fallback Web Speech)
import { SPR, TEX_IDLE, TEX_WALK, TEX_RUN, FLAVORS, TEX_JUMP_UP, TEX_JUMP_DOWN, TEX_CLIMB, TEX_FLY, TEX_CLING_WALL, TEX_CLING_CEIL, TEX_SWIM, TEX_SWIMIDLE, initCharacterSprites } from './render/sprites.js';
import { tex, pixelTexture } from './render/canvas.js'; // `makeCanvas` saiu junto: o painter é quem o chama agora
import { CENARIOS, THEME_FLORA, hexN } from './render/cenario-data.js'; // D2-b: catalogo dos cenarios (folha: dado puro, zero deps)
import { PARALLAX, createParallax } from './render/parallax.js'; // D2-b: as 3 camadas de fundo — fatores, rolagem e troca de tema
import { createSetCenario } from './render/set-cenario.js'; // D2-b: a troca de cenario (orquestracao; leva o loadTileImages)
import { createSceneSky } from './render/scene-sky.js'; // Tier 2 (#43): céu — nuvens (#21) + decor viva da v3
import { coinCanvas, treeCanvas, powerupCanvas } from './game/props.js'; // item 19: a arte dos props e do JOGO, nao da engine
import { createCityTextures } from './render/city-tex.js'; // D3-a: arte procedural da rua (bichos, pedestres, carros)
import * as weather from './render/weather.js'; // Onda A: clima visual (chuva/trovao/clarao)
import { lqFilter, setLq, getLqT, initLqFilter } from './render/lq-filter.js'; // Onda A: realce de contraste L->Q
import * as traffic from './game/traffic.js'; // Onda A: carros + semaforo da rua da frente
import * as life from './game/life.js'; // Onda A: vida ambiente (pombos/gatos/caes/adultos)
import { initSceneCity } from './render/scene-city.js'; // Onda A: deco da Cidade + fx de tiles vivos
import { initTextures, SHAPE_TEX, letterTexture, pupTexFor } from './render/textures.js'; // Onda A: texturas de moeda/forma/letra + power-up
import { DIRECT_CFG, HC_ROLE, HC_ROLE_DEF, saveHcRole, spriteTexFor, directSpriteCanvas, clearWorldTexCache, initHighContrast } from './render/high-contrast.js'; // Onda A: Renderizacao Direta (alto contraste)
import { initCoinSpawning, rebuildCoins, showPower, getCoinSprites } from './game/coin-spawning.js'; // Onda A: materializacao dos sprites de moeda
import { puTaken } from './game/powerups.js'; // item 19: a regra "chave e global, o resto e por jogador" saiu do render/draw
import { initKeyboardRuntime } from './input/keyboard-runtime.js';
import { initTouchBindings } from './input/touch-bindings.js'; // D3-b: gesto de toque -> entrada (traducao + geometria)
import { initKeydown } from './input/keydown.js'; // D2-a: o roteador de teclado (a cadeia de precedencia) // Onda A: esquema de teclas por jogador
import { initTouch, padLayoutFromId } from './input/touch.js'; // Onda A: geometria fisica do pad + config de toque
import { initGamepad } from './input/gamepad.js'; // Onda A: leitura da Gamepad API + assistente de mapeamento
import { initActivitiesMenu, attachAbbr, QL_NAME, PM_BTNS, PM_OPTIONS_BTNS } from './ui/activities-menu.js'; // Onda A: menus do titulo + inicio de partida
import { initPauseIcons, iconsMarkup } from './ui/pause-icons.js';
import { initShell, pauseLegendHtml } from './ui/shell.js'; // C3: a casca — em que TELA o jogo esta (fase, pausa, legenda do titulo)
import { initMenuNav } from './ui/menu-nav.js'; // C3: navegacao universal de menus (teclado/controle/olhos/fala) // Onda A: menu de pausa por tela + barra de icones de a11y
import { initHud } from './ui/hud.js'; // Onda A: HUD por tela (moedas/poder/abandono/selo de espera)
import { initScreenPipeline } from './render/screen-pipeline.js'; // D3-c: topologia do render por tela (grade, render-textures, molduras, bolinhas)
import { initSecretAreas } from './game/secret-areas.js'; // D3-c: area secreta revelada por presenca + anuncio ao leitor de tela
import { initMapHub } from './ui/map-hub.js'; // D3-c: painel "Mapear controles" do menu de Movimento
import { initPhysics, stepPlayer as stepPhysics } from './game/physics.js'; // B1: fisica do jogador (ancorada nas trajetorias-ouro)
import { initQuiz } from './game/quiz.js'; // B3: o desafio educativo (geracao + markup + efeito)
import { initSettingsPanel } from './ui/settings-panel.js'; // B4: o que as cascas dos paineis realmente compartilham
import { initViewports } from './render/viewports.js'; // B2: fabrica de imagem dos modos de visao
import { initSession } from './game/session.js'; // C2: o ciclo de vida da RODADA (MODE_LABELS/MODES saíram com o #opt-mode)
import { initDraw } from './render/draw.js'; // C1: camera + o quadro + a escolha de quadro do personagem
import { initVizSetters } from './render/viz-setters.js'; // Onda A: aplicacao dos modos de visao acessivel
import { roleOf } from './game/tile-roles.js'; // Passo 7: a tabela tile->papel e' do JOGO, nao do alto contraste
import { initLevelGeometry, buildRamps, buildRopes, drawElevators, buildDarkRegions, buildWcGeom as lgBuildWcGeom, rebuildExtras as lgRebuildExtras, setupExtras as lgSetupExtras } from './game/level-geometry.js'; // Onda A: rampas/cordas/elevador/escuridao/extras
if(typeof window!=='undefined') window.__tiles = tiles; // hook de teste (Preview); world.js passa a usar na etapa 2
initCharacterSprites(); // cria as texturas do personagem no boot — o import de sprites.js é PURO (sem I/O). Fase 2.24
initAudioMixer();        // carrega o estado do mixer no boot — o import de audio.js é PURO (não lê localStorage). Fase 2.25
// Versão vem do CARIMBO DE BUILD (git describe → tag de marketing na produção; SHA nos demais). Injetado pelo
// Vite (__BUILD__, ver vite.config.ts). Tira o 'v' inicial da tag (o display já prefixa 'v'). Fallback defensivo.
const INCL_VERSION = String((typeof __BUILD__ !== 'undefined' && __BUILD__.version) || '6.36.1').replace(/^v/, '');
// Mundo autêntico (CLARITY_MAP+buildWorld portados do v3.1.100), spawn real de moedas,
// física com escada/água/trampolim, animações (idle/walk/climb). Texto/UI no DOM (a11y).

'use strict';

/* ===================== constantes ===================== */
// Constantes puras extraídas para core/constants.js (modularização Fase B).
import { LOGICAL_W, LOGICAL_H, TILE, COIN_TARGET, TUNE, ANIM } from './core/constants.js';
import { Z } from './core/layers.js'; // #69/ADR-0020: ordem-z canônica (nomeada) do render
import { rnd, randInt, shuffle } from './core/rng.js'; // Fase 2.26: RNG semeado (Tier 1)
import { initCollision, tileAt, solidAt, surfTop } from './core/collision.js'; // Estágio 4: colisão de grade (determinística; ctx por closures)
import { BOX, makePlayer } from './game/player.js'; // Estágio 4: entidade + geometria de colisão do jogador
import { initCoins, findCoinCandidates, pickCoins } from './game/coins.js'; // Estágio 4: posicionamento dos coletáveis (pools vêm daqui)
import { srSay, srAlert, setVlibrasSay } from './core/a11y-sr.js'; // Estágio 4 (Tier 1): anúncios p/ leitor de tela (+ Libras injetado)
import { CRT, applyCrt, initCrt } from './render/crt.js'; // Estágio 4 (Tier 1): estética CRT (scanlines/vinheta/cantos)
import { initMinimap, markSeen, redrawMinimapIfDirty, drawMinimapPlayer, resetMinimap, setMinimapVisible, getMinimap, minimapSeenCount } from './render/minimap.js'; // Estágio 4 (Tier 1): minimapa + fog-of-war
import { vlibrasSay, vlibrasOpen, toggleLibras, vlTick, librasOpen, setOnLibrasChange } from './ui/vlibras.js'; // Estágio 4 (Tier 1): intérprete VLibras (modo pessoa surda)
import { layout, initLayout } from './ui/layout.js'; // Estágio 4 (Tier 1): escala do jogo (múltiplo inteiro de 320×180 em px reais)
import { eyeMode, setEyeMode, startEyeControl, stopEyeControl, loadWebGazer } from './ui/webcam.js'; // Estágio 4 (Tier 1): jogar com os olhos (WebGazer)
// Empatia MOTORA (global, muda a jogabilidade): `oneButton`/`wheelchair` migraram para core/state.js (#50) —
// bindings vivos, escrita pelos setEfeito abaixo. isSolidType os usa, e continua vendo sempre o valor atual.
// Modo cego (A12e auditiva) migrou para core/state.js (#50): `modoCego` é binding vivo, escrita por setModoCego() abaixo.
// `caneBlockDiv` migrou para core/state.js (#50): 1 = 1 batida/bloco; 2 = 1 batida/meio bloco (por DISTÂNCIA pisada)
// caneBlockPx/isSolidType/tileAt/solidTile/solidAt/surfTop/isWcRampRiser/rampSurfaceY extraídos p/ core/collision.js
// (Estágio 4). Estado que a colisão lê (caneBlockDiv/wheelchair/modoCego/wcSolid/gateTiles/gateOpen) SEGUE aqui —
// a colisão o acessa por closures via initCollision(ctx), logo abaixo (após o WORLD ficar pronto).
// TILE_COLOR agora vem de core/constants.js (importado acima).

/* ===================== mundo ===================== */
// Mundo carregado do texto-glifo assets/levels/clarity.map.txt (Fase 1.2). Construtor em core/world.js.
import { buildWorldFromText } from './core/world.js';
// top-level await: main.js é módulo → o corpo abaixo só roda após o mapa carregar (pré-cacheado no SW).
/* ===================== O IDIOMA VEM ANTES DE QUALQUER COISA SER MONTADA =====================
   `initI18n()` era a ULTIMA linha do boot, e para pt isso nao custava nada. Para en/es custava metade da
   interface: o `applyDom` conserta o markup estatico (`data-i18n`), mas o que o JavaScript monta — os botoes
   de cenario, os de atividade — ja tinha capturado o texto de pt, e nada reconstruia. O sintoma era
   `t('cen.cidade')` devolver "City" com o botao na tela dizendo "Cidade".
   O `await` custa UM chunk, e so' para quem nao joga em portugues; em pt ele resolve na hora. */
i18n.initI18n();
await i18n.idiomaPronto();
const WORLD = buildWorldFromText(await (await fetch('assets/levels/clarity.map.txt')).text());
const WORLD_W = WORLD[0].length, WORLD_H = WORLD.length;
const WORLD_PX_W = WORLD_W*TILE, WORLD_PX_H = WORLD_H*TILE;
initWorldTex({ world: WORLD, W: WORLD_W, H: WORLD_H }); // Estágio 4: liga o builder da textura do mundo ao mapa carregado
// E12: o portão dinâmico (gateTiles/gateOpen/gate) migrou para core/state.js (#50) — seus tiles são
// sólidos enquanto fechado.
// Cadeirante: sólidos SÓ-CADEIRANTE (pontes/plataformas que não existem no modo normal) — não altera CLARITY_MAP.
// `wcSolid` migrou para core/state.js (#50).
// Mundo + estado prontos → liga a colisão (core/collision.js). As closures leem o estado VIVO daqui:
// wheelchair/modoCego/caneBlockDiv/wcSolid/gateTiles/gateOpen mudam neste módulo e a colisão sempre vê o atual.
initCollision({ world: WORLD, W: WORLD_W, H: WORLD_H,
  isWheelchair: ()=>wheelchair, isModoCego: ()=>modoCego, caneDiv: ()=>caneBlockDiv,
  wcSolid: ()=>rodada.wcSolid, gateTiles: ()=>rodada.gateTiles, gateOpen: ()=>rodada.gateOpen });
initCoins({ numJogadores: () => rodada.numPlayers, world: WORLD, W: WORLD_W, H: WORLD_H, anyEasy: ()=>anyEasy(), isWheelchair: ()=>wheelchair }); // Estágio 4: posicionamento de coletáveis (usa solidAt já ligado acima)
// Itens do mapa Clarity → viram ITENS/barreira (não tiles): 7=pulo-turbo, 8=voo, 11=chave; 10=portão.
// Removemos o tile do grid (vira ar) e o item/barreira é desenhado/colidido à parte; some ao pegar/abrir.
const MAP_ITEMS: { tx: number; ty: number; kind: string }[] = [], MAP_GATE: { tx: number; ty: number }[] = [];
for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++){ const tile=WORLD[y][x]; // `tile` e não `t`: o `t` local esconde o tradutor (ver tests/translator-shadow)
  if(tile===7){ MAP_ITEMS.push({tx:x,ty:y,kind:'superjump'}); WORLD[y][x]=1; }  // super-pulo (máximo)
  else if(tile===8){ MAP_ITEMS.push({tx:x,ty:y,kind:'fly'}); WORLD[y][x]=1; }    // voo
  else if(tile===11){ MAP_ITEMS.push({tx:x,ty:y,kind:'key'}); WORLD[y][x]=1; }   // chave
  else if(tile===12){ MAP_ITEMS.push({tx:x,ty:y,kind:'turbo'}); WORLD[y][x]=1; } // super-corrida
  else if(tile===13){ MAP_ITEMS.push({tx:x,ty:y,kind:'ultrajump'}); WORLD[y][x]=1; } // ultra-pulo
  else if(tile===14){ MAP_ITEMS.push({tx:x,ty:y,kind:'wallcling'}); WORLD[y][x]=1; } // ventosa
  else if(tile===10){ MAP_GATE.push({tx:x,ty:y}); WORLD[y][x]=1; } // portão
}
// regiões secretas = componentes conexos de tiles 0 (escuridão). Acendem ao entrar.
// buildDarkRegions migrou para game/level-geometry.ts (Onda A) — agora e puro e recebe as dimensoes.

/* ===================== sprite do personagem ===================== */
// PLAYER_IDLE/WALK/CLIMB/HURT (mapa de caracteres do sprite anterior ao PixelLab) migraram para
// render/textures.ts junto do TEX que os consumia — os dois ja nao tinham chamador. Ficavam aqui so
// como copia.
// (paleta APP movida p/ render/sprite-fx.js na Fase 2.21)

/* ===================== canvas → textura ===================== */
// makeCanvas/tex/pixDisc migrados p/ render/canvas.js (Fase 2.18).

// outlineCanvas/spriteToCanvas (+ _silhouette/OUTLINE_DARK/APP) migrados p/ render/sprite-fx.js (Fase 2.21)

// isGroundType/worldCanvas/worldToTexture extraídos p/ render/world-tex.js (Estágio 4). WORLD injetado por
// initWorldTex (logo após o mapa carregar). worldToTextureDirect/worldTexFor (alto contraste) + stepTileFx
// (água/lava animadas) ficam aqui.
// Renderizacao Direta (alto contraste de acessibilidade) migrou para render/high-contrast.ts (Onda A):
// _dimDesat, DIRECT_CFG, os 3 niveis de contraste e o repinte por papel vivem la. Aqui ficam so os dois
// contornos configuraveis, que os paineis mutam e o modulo le por getter.
// Dois contornos configuráveis (0=nenhum · 1=fino/1px · 2=grosso/2px):
//  fg = 1º plano (personagem/itens) — WCAG 2.4.7 foco visível; bg = 2º plano (perímetro externo de
//  plataforma/água/lava — delimita navegável × não-navegável) — WCAG 1.4.11 contraste ≥3:1.
// hcOutlineFg/hcOutlineBg migraram para core/state.js (#50), com a saturação 0..2 e a leitura do
// armazenamento numa passada só — aqui eram um `let` provisório seguido de duas reatribuições.
// HC_ROLE_DEF/HC_ROLE/saveHcRole (color-blocking por papel, customizavel e persistido) migraram para
// render/high-contrast.ts (Onda A). rgbHex foi junto e nao voltou: tinha ZERO chamadores aqui.
// A tupla é declarada, não inferida: a função devolve SEMPRE três casas, e o destino (`HC_ROLE`, uma
// `Record<HcRoleKey, [number, number, number]>`) exige exatamente três. Inferido como `number[]`, o valor
// certo não entrava no lugar certo.
const hexRgb=(h: string): [number, number, number] | null =>{ const m=/^#?([0-9a-f]{6})$/i.exec(h); if(!m)return null; const n=parseInt(m[1],16); return [n>>16&255,n>>8&255,n&255]; };
// _roleOf/worldToTextureDirect/directBgTexture/directSpriteCanvas/directSpriteTexture migraram para
// render/high-contrast.ts (Onda A).
// Alto contraste (re-adicionado): recolore cada tile pela PALETA do grupo (gradient-map por matiz, mantém claro-escuro).
// coinCanvas/coinTexture/treeCanvas/treeTexture migrados p/ render/props.js (Fase 2.19), e de la para game/props.js (item 19)

/* ===================== moedas (spawn real) ===================== */
// findCoinCandidates/pickCoins/takeCoin extraídos p/ game/coins.js (Estágio 4, posicionamento).
// RNG semeado (rnd/randInt/shuffle/_seed) migrado p/ core/rng.js (Fase 2.26 / Tier 1)
// O MODO DE JOGO, DERIVADO — não armazenado (ADR-0040). Era um `let` com dois caminhos de escrita, e eles
// divergiam: ciclar o `#opt-mode` deixava o MODE em 'silabas' com `activity` ainda em 'ludico', as moedas
// nasciam como letras e o despacho do quiz continuava lendo a categoria da atividade antiga (issue #54,
// reproduzido no jogo publicado). `MODE === modeForCategory(activityCategory(activity))` valia para TODA
// atividade do catálogo, ou seja, o `let` não carregava informação nenhuma que o `activity` já não tivesse.
// Agora é uma função: um caminho de leitura, nenhum de escrita, e a divergência é impossível por construção.
const MODE = (): GameMode => modeForActivity(ACTIVITY);
// SOMASUB_SHAPES/somaSubName/SILABAS_WORDS/SILABA_POOL/WORD_INITIALS extraídos p/ game/activity-content.js (Estágio 4).
/* L3: quiz de alfabetização em 5 NÍVEIS (psicogênese da língua escrita — Ferreiro & Teberosky):
   1 pré-silábico — escolher a palavra BEM escrita entre 3 (2 malformadas); o jogo SOLETRA a opção sob o cursor.
   2 silábico c/ valor — montar por SÍLABAS; o jogo LÊ a sílaba sob o cursor.
   3 silábico-alfabético — montar por SÍLABAS; o jogo SOLETRA as letras da sílaba.
   4 escritor (alfabético) — montar por LETRAS numa grade; o jogo fala o NOME da letra.
   5 escritor cego — montar por LETRAS; o jogo dita a CELA BRAILLE de cada letra. */
// 'quizLevel' agora vem de core/state.js (Fase 2, mega-variável 2). Leitura = binding vivo; escrita via setQuizLevel().
// LETTER_NAME/soletra/ferreiroDistractors extraídos p/ game/literacy-distractors.js (Estágio 4).
// malform() REMOVIDO: era código morto (0 chamadas) — distrator de sílaba nunca ligado.
// `letterCase` migrou para core/state.js (#50) — 'mixed' | 'upper', escolha pedagógica, hoje feita no menu de
// CAA (ADR-0028). 'mixed' NÃO força minúscula: devolve o texto como ele é, que é o que "maiúsculas e
// minúsculas" quer dizer. Forçar minúscula num nome próprio ensinaria a criança a escrevê-lo errado.
const disp=(s: unknown)=> letterCase==='upper'?String(s).toUpperCase():String(s);
// E8: Braille (modo pessoa cega). Padrão de pontos da cela por letra (Grau 1, PT).
// BRAILLE/NUMW/brailleText extraídos p/ game/braille.js (Estágio 4).
// `blindMode` REMOVIDO: era escrito só por applyLetra a partir de `LETRA[i].blind`, e as duas entradas da
// tabela têm `blind:false` desde que o Braille saiu do ciclo do botão ABC (ver o comentário da LETRA). Nascia
// falso e nunca mudava. Quem decide o ditado passivo hoje é o Modo cego (a11y) e o nível 5.
// Lote C: cada jogador tem SEU conjunto de n itens em posições ALEATÓRIAS próprias e com a COR do dono
// (owner). Todos os itens de todos os jogadores existem no mundo; cada um coleta só os `owner===seu i`.
// pickCoins extraído p/ game/coins.js; aqui só o cálculo dos POOLS a partir do MODE (coins não conhece MODE/quiz).
const coinPools=()=>({ shapes: MODE()==='somasub'?SOMASUB_SHAPES.map(s=>s.id):[], letters: MODE()==='silabas'?WORD_INITIALS:[] });

/* ===================== estado ===================== */
// $ (querySelector) migrado p/ ui/dom.js (Fase 2.27 / Tier 1)
// BOX/SPAWN_X/SPAWN_Y/makePlayer + geometria de colisão do jogador (isBouncyGroundBelow/touchingWall/clingSides/
// firstClingSide/spiderReattach/wrapConvex) extraídos p/ game/player.js (Estágio 4). P1 = players[0] (compat solo).
/* ===================== o vocabulario dos PODERES (item 14: i18n) =====================
   ERAM DUAS TABELAS DE `const` COM TEXTO EM PORTUGUES, e por isso estavam CONGELADAS no idioma do boot: um
   `const` de modulo resolve UMA vez e nunca mais. Trocar de idioma no menu deixaria o poder falando portugues
   no meio do ingles — e `POWER_MSG` e' FALADO pelo leitor de tela quando o poder muda, ou seja, o defeito
   caia justamente em quem nao tem a tela para desempatar.
   Sao FUNCOES, e nao tabelas de chaves, de proposito: uma tabela de chaves obriga cada consumidor a lembrar
   de chamar `t()`, e esquecer e' silencioso (o HUD mostraria `hud.power.fly`). Uma funcao resolve no momento
   do uso e nao tem como ficar velha. Os quatro consumidores (ui/hud, game/coin-spawning, game/physics,
   game/session) recebem a funcao por injecao, como ja recebiam a tabela. */
const POWER_KINDS = ['superjump', 'ultrajump', 'turbo', 'fly', 'wallcling'];
const POWER_SHORT_KINDS = [...POWER_KINDS, 'runcane'];
/** Frase falada do poder. `off` tem frase propria; o que nao for poder conhecido cai no generico. */
const POWER_MSG = (k: string) => t(k === 'off' ? 'sr.power.none' : POWER_KINDS.includes(k) ? 'sr.power.' + k : 'sr.power.generic');
// Ícones canônicos dos power-ups (decisão do José 2026-07-02): 👟 corrida/bengala · 🕷️ escalada · 🎈 voo (jetpack) · 🐇 super pulo · 🦘 ultra pulo
/** Rótulo curto do HUD. Desconhecido cai em `off` ('—'), que era o `|| '—'` de cada consumidor. */
const POWER_SHORT = (k: string) => t('hud.power.' + (POWER_SHORT_KINDS.includes(k) ? k : 'off'));
// showPower migrou para game/coin-spawning.ts (Onda A) — o HUD do poder ativo nasce do mesmo modulo que
// materializa os itens.
// jumpVel + isBouncyGroundBelow/touchingWall/clingSides/firstClingSide/spiderReattach/wrapConvex → game/player.js (Estágio 4)
// ↓ ESTES DOIS AUXILIARES SUBIRAM PARA CÁ, e a posição é o contrato: o `let player` logo abaixo é o
// primeiro consumidor deles. Enquanto ficavam mais embaixo, usá-los ali era TDZ — o `tsc` o disse com
// todas as letras (TS2448), e a versão minificada não diria: `const` de topo vira `var`, e o erro que
// seria um throw vira um `undefined` silencioso. Já aconteceu neste arquivo, com o `setPlayerViz`.
/**
 * OS JOGADORES DESTE JOGO, e o único lugar onde a vista se estreita.
 *
 * `core/state.players` é `Player[]` porque a engine não conhece `quiz` — foi exatamente isso que o ADR-0033
 * decidiu ao tirar o campo de `core/entity`. Quem PÕE `GamePlayer` naquele array é este arquivo, que é a raiz
 * de composição do jogo, então é aqui que ele volta a ser lido como tal. O `as` não afirma nada que este
 * arquivo já não garanta.
 *
 * É função e não constante DE PROPÓSITO: `players` é `export let`, e uma constante congelaria a referência no
 * instante do import. Hoje ninguém reatribui (conferido em toda a árvore) — mas "hoje ninguém" é a premissa
 * que envelhece pior, e a função custa uma chamada.
 */
const jogadores = (): GamePlayer[] => players as GamePlayer[];

/**
 * OS JOGADORES DEPOIS DE `assignControls`, que é a mesma vista com uma invariante a mais.
 *
 * `Player.ctrl` é `KeyScheme | null` porque ANTES do boot ele é mesmo nulo. `input/keyboard-runtime` e
 * `game/physics` declaram `ctrl` não-nulo porque só rodam depois — e o `core/entity` já dá nome a isso em
 * `ControlledPlayer`, dizendo que usá-lo é afirmar "eu só rodo depois do boot".
 *
 * Quem pode afirmar isso é a raiz de composição, porque é ela que chama `assignControls`. Então a afirmação
 * mora aqui, uma vez, em vez de cada módulo redeclarar `ctrl` como não-nulo e ninguém ler aquilo como
 * afirmação — que é exatamente o que o comentário do `core/entity` diz ter acontecido antes.
 */
const controlados = (): ControlledGamePlayer[] => players as ControlledGamePlayer[];

players.push(makePlayer(0));
// 'numPlayers' (Fase 2, mega-variável 3). Escrita via setNumPlayers()/joinPlayer.
setCoins(pickCoins(COIN_TARGET, coinPools())); // coins: mega-var 7 em core/state.js (reatribuição via setCoins)
// Itens INDIVIDUAIS por jogador (multiplayer em telas separadas): cada moeda/letra/forma é coletada
// independentemente por cada jogador. Só a CHAVE é compartilhada (ver powerups). taken = espelho do P1 (solo).
// takeCoin extraído p/ game/coins.js (Estágio 4)
// puTaken/takePu extraídos p/ game/powerups.js (Estágio 4). Estado/spawn/render (powerups/setupExtras/
// rebuildExtras/pupTexFor) + o portão seguem aqui por ora (acoplados a PIXI + textura + gate).
// 'phase' agora vem de core/state.js (Fase 2, mega-variável 1). Leitura = binding vivo; escrita só via setPhase().

/* ===================== input ===================== */
/* B4: o que as nove cascas de painel REALMENTE compartilham — empilhamento de overlay, o rodape de
   explicacao, e o registro que substitui a tabela de fechamento e a cadeia de Escape. As nove funcoes
   de abrir e fechar FICAM: elas sao as diferencas (o que renderizam antes, o que focam,
   para onde o foco volta), e uma casca generica precisaria de seis parametros de excecao para cobri-las.
   AQUI e nao la embaixo: frontOverlay deixou de ser declaracao icada e a 1a leitura dele e o ctx do
   initGamepad, avaliado eager. */
const overlays = initSettingsPanel({ $, $$, doc: document, computedZ: (el)=>+getComputedStyle(el).zIndex||0 });
const { frontOverlay } = overlays;
// As seis flags `*Open` que moravam aqui morreram: quem sabe se um painel esta aberto e o proprio DOM, e o
// registro de ui/settings-panel le de la (D1). `jumpEdge` estava nesta mesma linha e tambem morreu: era
// global sem leitor nenhum — a borda de pulo que o jogo usa e `p.jumpEdge`, campo do jogador, outra coisa.
// Gamepad (B3/L1): estado por controle. padCur[gi]=ações seguradas neste frame; associação pad↔jogador vive em p.pad.
// padCur/padPrevAct/padPrevStart + PAD_DEAD movidos p/ input/state.js (Fase 2.22)  // // zona morta = primeira METADE do curso (ergonomia — José 2026-07-02)
// Config de teclado extraída p/ input/keyboard.js (Fase 2): esquemas, defaults, loadKB/saveKB/resetKB.
initKB(); // o mapa de teclas vive em input/keyboard (#50); aqui só o disparo da leitura persistida
// saveKB agora vem de input/keyboard.js (recebe o KB como argumento)
// kbFor/actionOf/whichPlayer/assignControls/applyControls migraram para input/keyboard-runtime.ts (Onda A).
// KB fica aqui (o painel de controles o edita e persiste); o modulo o le fresco a cada chamada.

// ⚠️ AS DUAS VISTAS MORAM AQUI, ANTES DO PRIMEIRO CONSUMIDOR, e a posição é o contrato.
// `controlados()` nasceu 500 linhas abaixo, ao lado de `jogadores()`, e o boot morreu com
// "b_ is not a function": o `initKeyboardRuntime` desta linha chama `getPlayers()` durante a própria
// inicialização, quando o `const` ainda não tinha sido avaliado. `jogadores()` não sofria disso por
// acidente — todos os usos dele vêm depois. Quem mover isto daqui quebra o boot, e não o tsc.
const kbRuntime = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => rodada.numPlayers, getPlayers: () => controlados() });
const kbFor = (i: number) => kbRuntime.kbFor(i);
// controls/KJUMP..KRUN/GAME_KEYS nao moram mais aqui (D1): eram oito copias de kbRuntime.computeControlsState(),
// e `applyControls` existia so para refaze-las. A memoria foi para dentro de input/keyboard-runtime, que e quem
// faz a conta; aqui sobrou o gatilho de invalidacao, que e o que o painel de controles precisa chamar.
function applyControls(){ kbRuntime.refreshControls(); }
// Tint distintivo por jogador (P1 = normal). L2: paleta CB-SAFE opcional (Okabe & Ito 2008 — laranja/azul-céu/
// amarelo distinguíveis em protan/deutan/tritan) SÓ para jogadores/itens/efeitos — o CENÁRIO fica com cores naturais.
const PCOLOR_DEF=[0xffffff,0xff9a9a,0x8affc0,0xffe08a], PCOLOR_CB=[0xffffff,0xe69f00,0x56b4e9,0xf0e442];
// `cbSafe` migrou para core/state.js (#50).
const PCOLOR=(cbSafe?PCOLOR_CB:PCOLOR_DEF).slice(); // mutável in-place (todos referenciam PCOLOR)
// `ownerColors` migrou para core/state.js (#50) — itens na cor do dono (padrão ligado).
const assignControls = () => kbRuntime.assignControls();
assignControls();
/* ===================== TECLADO -> input/keydown.ts (D2-a) =====================
   O roteador inteiro (a cadeia de nove guardas) migrou. O modulo separa DECIDIR de EXECUTAR:
   `decideKeydown(evento, estado)` e pura e roda no project `node`; so o envelope toca o mundo.
   `keyup` foi junto (e a outra metade do `keys.add`); `blur` NAO — ele limpa codigos que o toque e a webcam
   tambem injetam, e e rede de ciclo de vida da JANELA, nao do teclado.
   TODO o ctx e LAZY de proposito: attractCtl/ctrlPanel/gamepadApi/hud/navTitle/activateScreens/togglePause/
   hideTouchControls/quiz* sao `const`/`function` declarados centenas de linhas ABAIXO daqui. O ouvinte
   original so funcionava porque o corpo dele nunca era lido antes da primeira tecla, e e essa preguica que as
   setas preservam — passar qualquer um deles por VALOR derruba o boot em TDZ.
   Fica no lugar exato do ouvinte antigo, e nao mais abaixo: descer mudaria a ORDEM DE REGISTRO dos ouvintes
   de bolha da janela, e hoje este e o primeiro. */
const keydownApi = initKeydown({
  isTelaDeTitulo: () => fatosDaCena().telaDeTitulo,
  // VERBATIM do `phase === 'playing' || phase === 'paused'`: `!telaDeTitulo` NÃO seria a mesma coisa — numa
  // cena que ninguém previu (um mapa), Alt+N e a tecla de pausa devem ficar quietos, não agir.
  isEmJogo: () => { const f = fatosDaCena(); return f.mundoRodando || f.menuDePausa; },
  attractOnInput: () => attractCtl.onInput(),
  handleCaptureKeydown: (e) => ctrlPanel.handleCaptureKeydown(e),
  getNumPlayers: () => rodada.numPlayers, getPlayers: () => players,
  getControls: () => kbRuntime.controlsState(),
  heldKeys: keys, isOneButton: () => oneButton,
  actionOf: (code, i) => kbRuntime.actionOf(code, i),
  whichPlayer: (code) => kbRuntime.whichPlayer(code),
  $, escapeTarget: () => overlays.escapeTarget(), closeOverlayById: (id) => overlays.closeById(id),
  closePadWiz: (save) => gamepadApi.closePadWiz(save),
  hideTouchControls: (r) => hideTouchControls(r), srSay: (m) => srSay(m),
  navTitle: (k) => navTitle(k), activateScreens: (n) => activateScreens(n), togglePause: () => togglePause(),
  modalInput: (i, intent) => modalInput(i, intent), hasModal: (i) => temModal(i),
  clearWaitingBadge: (i) => hud.clearWaitingBadge(i),
  win: window,
});
keydownApi.attach();
addEventListener('blur',()=>keys.clear());
// held(pl,act) movido p/ input/state.js (Fase 2.22) // teclado OU gamepad do jogador

/* ===================== a11y ===================== */
// vlibrasSay + _vl* + vlibrasOpen/toggleLibras/vlTick/librasOpen extraídos p/ ui/vlibras.js (Estágio 4, Tier 1).
setVlibrasSay(vlibrasSay); // registra a fala em Libras (ui/vlibras) no core/a11y-sr

/* ===== E9: áudio (WebAudio) + legendas (C1) + assistência (C2) ===== */
// SFX (definicoes de som) extraido p/ platform/audio.js (Fase 2), e de la para game/earcons.js (item 19):
// sete dos dez earcons sao deste jogo, e as legendas eram pt-BR cru dentro da engine.
import { SFX } from './game/earcons.js';
let capTimer: ReturnType<typeof setTimeout> | null = null; // `captionsOn` migrou para core/state.js (#50); soundOn/volume/audioCtx vêm de platform/audio.js
const anyEasy=()=>players.some(p=>p.easy); // efeitos de MUNDO do Fácil (moedas no chão) ligam se QUALQUER jogador usa Fácil
// Modo Fácil (deficiência motora): gravidade ×2/3, pulo ×8/7, andar ×0.7, sem perigos, sem correr,
// hitbox de coleta +4px, moedas no chão, proteção de borda, pula-pula suave (segurar = flutuar descendo).
// EASY (modo fácil) migrado p/ core/constants.js (Estágio 4, dado de dificuldade — junto de TUNE/ANIM).
// Movimento reduzido (WCAG 2.3.3 AA). 5 alvos; padrão herda prefers-reduced-motion; persistido.
// Hoje agem 'parallax' e 'walk'; 'decor/items/particles' ficam prontos e ligam quando a Cidade animar.
// `MotionSceneKey`, e não `string[]`: quem declara as quatro chaves é `ui/settings-motion`, que também as
// desenha. Como texto solto, um erro de digitação aqui só apareceria em execução — como uma linha de menu
// que simplesmente não aparece.
const RM_KEYS: readonly MotionSceneKey[] = ['parallax', 'decor', 'items', 'particles']; // animações de CENA (globais)
// `lbl` guarda a CHAVE i18n, nao o texto: ui/settings-motion resolve com t() na hora de desenhar a linha.
// Era texto em portugues repetido palavra por palavra na RM_LABEL daquele modulo — tres tabelas dos mesmos
// rotulos (esta, a de la, e uma TERCEIRA morta aqui embaixo), e mudar um rotulo pedia tres edicoes.
// O campo `k` SAIU: ninguém o lê. Os dois consumidores (`ui/settings-motion` e `ui/pause-icons`) usam só
// `prop` e `lbl`, e o tipo que eles declaram — `MotionCharDef` — nem sequer o tem. Era mais um resto do
// monólito, como o argumento descartado de `applyLetra`.
const RM_CHAR: readonly MotionCharDef[] = [ {prop:'rmWalk',lbl:'rm.walk'},
  {prop:'rmBreath',lbl:'rm.breath'}, {prop:'rmFlavor',lbl:'rm.flavor'} ]; // animações do PERSONAGEM (por jogador)
// O padrão ganhou nome em core/state (defaultReducedMotion) porque o reset do painel precisa do MESMO valor.
// O `as MotionSceneFlags` nos dois acumuladores abaixo: o laço preenche EXATAMENTE as quatro chaves de
// `RM_KEYS`, que é o que o tipo exige — mas o objeto nasce vazio, e o compilador não acompanha um
// preenchimento por laço. É afirmação sobre o laço logo ao lado, não sobre dado de fora.
const rm=(()=>{ const s=store.getJSON(store.KEYS.reducedMotion,null); if(s&&typeof s==='object'){ const o = {} as MotionSceneFlags; RM_KEYS.forEach(k=>o[k]=!!s[k]); return o; }
  const o = {} as MotionSceneFlags; RM_KEYS.forEach(k=>o[k]=defaultReducedMotion()); return o; })();
function saveRM(){ store.setJSON(store.KEYS.reducedMotion,rm); }
// Movimento por alternância (1 dedo): tocar a direção trava a marcha; segurar acelera; pulo não interrompe. Persistido.
function loadPlayerA11y(p: Player,i: number){ const v=store.get(store.KEYS.vizP(i)); if(v&&VIZ_BY_KEY[v])p.viz=v;
  p.audioSink=store.get(store.KEYS.sinkP(i))||null; // saída de áudio própria do jogador (setSinkId)
  p.easy=store.getBool(store.KEYS.easyP(i)); p.toggleMove=store.getBool(store.KEYS.toggleMoveP(i));
  // CONSERTO: os três alvos de PERSONAGEM nasciam SEMPRE `false`, embora o comentário do bloco acima diga
  // "5 alvos; padrão herda prefers-reduced-motion". Só os 4 de CENA herdavam. Quem pediu menos movimento no
  // sistema ganhava o parallax congelado e o personagem andando — metade do pedido, e a metade que se move
  // mais. Agora os cinco herdam, que é o que o código já dizia fazer.
  const rmDef=defaultReducedMotion();
  p.rmWalk=store.getBool(store.KEYS.rmWalkP(i),rmDef); p.rmBreath=store.getBool(store.KEYS.rmBreathP(i),rmDef); p.rmFlavor=store.getBool(store.KEYS.rmFlavorP(i),rmDef);
  if(i===0){ const ov=store.get(store.KEYS.viz); if(ov&&VIZ_BY_KEY[ov]&&store.get(store.KEYS.vizP(0))==null)p.viz=ov; // migra chaves antigas
    if(store.getBool(store.KEYS.toggleMoveLegacy)&&store.get(store.KEYS.toggleMoveP(0))==null)p.toggleMove=true; } }
function setToggleMove(i: number,on: boolean){ const p=players[i]; if(!p)return; p.toggleMove=on; store.setBool(store.KEYS.toggleMoveP(i),on); if(!on)p.walkDir=0;
  srSay(playerPrefix(i,rodada.numPlayers)+t(on?'sr.motor.toggleMoveOn':'sr.motor.toggleMoveOff')); }
function showCaption(txt: string){ const el=$('#caption'); if(!el||!txt)return; el.textContent=txt; el.classList.add('show'); if(capTimer!==null)clearTimeout(capTimer); capTimer=setTimeout(()=>{el.classList.remove('show'); el.textContent='';},1300); }
// Earcons + ponte com legendas extraídos p/ platform/audio-earcons.ts (Tier 2, áudio rodada 2). captionsOn/showCaption
// VIVEM aqui (UI alterna captionsOn; win() reusa showCaption) → entram por injeção. Chamado como earcons.sfx(...).
const earcons = createAudioEarcons({ SFX, ensureAC, catNode, audioOut, noiseHit,
  getSoundOn: () => soundOn, getVolume: () => volume, getCaptionsOn: () => captionsOn, showCaption });
// ===== Vitória: jingle 8-bit ascendente + fogos de artifício (assobio subindo → estouro/crepitar) =====
// ensureAC() (ciclo do AudioContext) extraído p/ platform/audio.js (Fase 2).
// Modo empatia — perda auditiva: passa-baixas (perda de agudos) + EXPANSÃO DESCENDENTE (frames fracos abafados → dificulta a fala).
// Todos os sons passam por um nó mestre; a cadeia é religada quando o modo liga/desliga.
// Nó mestre (hearingLoss/audioOut/buildHearingChain/wireMaster) extraído p/ platform/audio.js (Fase 2).
function setHearingLoss(on: boolean){ setHearingLossGraph(on); store.setBool('incl_hearingloss',on); // grafo em platform/audio.js; persistência via store
  srSay(t(on?'sr.empathy.hearingOn':'sr.empathy.hearingOff')); }
// ===== F1: barramento de áudio por CATEGORIA (cada uma: liga/desliga + volume). Pendura no nó mestre. =====
// AUDIO_CATS (categorias) + carga/persistência + default TTS-off extraídos p/ platform/audio-mixer.js (Fase 2).
// audioCat + catNode + setCatGain (mixer por categoria) extraídos p/ platform/audio.js (Fase 2).
// ===== F2: efeitos de interação com o ambiente (passos por superfície, portas, escada) — ruído filtrado sintetizado =====
// noiseBuffer + FOOT + noiseHit + _footCount (synth de ruído) extraídos p/ platform/audio.js (Fase 2). _noiseBuf era var morta.
// material sob os pés (Cidade = concreto → 'piso') — usado pelo som do PASSO (main.js); não é pista espacial, fica aqui.
function surfaceUnder(pl: PlayerView<'x' | 'y'>){ const tile=tileAt(Math.floor(pl.x/TILE),Math.floor((pl.y+1)/TILE)); if(tile!==2&&tile!==6&&tile!==5)return null; return CENARIO==='cidade'?'piso':'pedra'; }
// Tipado pelo que LÊ, não pelo que recebe: assim serve ao `Player` inteiro e às vistas estreitas que os
// módulos declaram (`PhysicsPlayer` é um `Pick`, e um `Player` inteiro não é atribuível a ele).
const caneOn=(pl: PlayerView<'viz'>)=>{ const m=VIZ_BY_KEY[pl.viz]; return modoCego || !!(m&&(m.kind==='blind'||m.kind==='lowvision')); }; // predicado de visão (movimento/render) — fica no main.js
// caneColor extraído p/ render/wheelchair-sprites.js (Estágio 4).
// TTS (narração por voz: Piper neural lazy + fallback Web Speech) extraído p/ platform/tts.ts (Tier 2, #38). Criado ANTES do
// audio-nav porque o nav injeta narrate. As funções de painel (populateTTS*/reflectTTS) ficam no main.js (→ #54) e usam get/set.
const tts = createTts({ srSay, srAlert, ensureAC, catNode, audioOut, getSoundOn: () => soundOn, getVolume: () => volume, getAudioCat: () => audioCat });
// Pistas espaciais a11y (bengala · sonar · guarda de beirada · guia · nado, por dispositivo) extraídas p/ platform/audio-nav.ts
// (Tier 2, áudio r3). playerCtx/panFor/needsAudioCues expostos na API porque a guarda de beirada + o gate de movimento os
// chamam de fora do cluster. Estado do guia (_guideCount) e SURF_MAT vivem agora no módulo. Uso: nav.<fn>.
// A NAVEGACAO SONORA, contra o CONTRATO (item 19). As tres perguntas que substituiram `getCoins`+`TILE`:
//   · `topology()`  — a metrica. Esta plataforma e um espaco CONTINUO com `unit = TILE`, e por isso os
//     limiares de "muito perto/perto/longe" continuam valendo 4 e 9 TILES, como no original.
//   · `targetsOf(i)` — onde estao os alvos deste jogador. Era o laco `if (cn.taken || cn.owner !== pl.i)`
//     dentro do sonar; agora e o JOGO que filtra, e o sonar so compara distancias.
//   · `nameAt(at)`   — como se chama o que esta ali. Era `t('sr.nav.coin')` cravado.
const sonarNav = createAudioSonar({
  topology: () => ({ kind: 'continuous', width: WORLD_PX_W, height: WORLD_PX_H, unit: TILE }),
  targetsOf: (i) => coins.filter((cn) => !cn.taken && cn.owner === i).map((cn) => ({ x: cn.x, y: cn.y })),
  nameAt: () => ({ text: t('hud.nome.moeda'), gender: 'f', plural: false }),
  tonePan, srSay, narrate: tts.narrate,
  VIZ_BY_KEY, getModoCego: () => modoCego, LOGICAL_W,
  getPlayers: () => players, getNumPlayers: () => rodada.numPlayers,
  getAudioCtx: () => audioCtx, getSoundOn: () => soundOn, getAudioCat: () => audioCat,
});
const nav = createAudioNav({ tileAt, solidAt, held, tonePan, noiseHit, BOX, TILE,
  getCenario: () => CENARIO, sonar: sonarNav });
// ===== F4: camadas de AMBIENTE (loops sintetizados) + PISTA/GUIA auditivo (beacon em laço) =====
// Trilha de ambiente sintetizada + trovão extraídos p/ platform/audio-ambient.ts (Tier 2, áudio r4). O clima VISUAL fica no
// main.js (updateWeather/drawWeather) e migra p/ render depois. Uso: ambient.updateAmbient / ambient.thunder.
const ambient = createAudioAmbient({ ensureAC, getAudioCtx: () => audioCtx, catNode, audioOut, noiseBuffer, tileAt, TILE,
  getSoundOn: () => soundOn, getVolume: () => volume, getAudioCat: () => audioCat, getPlayers: () => players, getRainLevel: () => weather.getRainLevel() });
// ===== CLIMA: chuva de verdade (visual + trovão), o áudio segue o visual =====
let weatherLayer=null; // criado após o `app` existir; o ESTADO do clima (nivel/gotas/clarao) mora em render/weather
// thunder (rumor do trovão) extraído p/ platform/audio-ambient.ts (Tier 2, áudio r4). Chamado por updateWeather como ambient.thunder.
// updateWeather/drawWeather migraram para render/weather.ts (Onda A). A camada segue criada aqui.
// updateGuide (beacon do guia) extraído p/ platform/audio-nav.ts (Tier 2, áudio r3). Chamado no loop como nav.updateGuide.
// Narração TTS (Piper neural lazy + fallback Web Speech + estado) extraída p/ platform/tts.ts (Tier 2, #38). A instância `tts`
// é criada acima (antes do audio-nav, que injeta narrate). Uso: tts.narrate / tts.ttsSpeak / tts.loadTTS; o painel usa
// tts.get/setEngineSel + tts.get/setVoiceObj + tts.getEngine.
// Fala de JOGO essencial (nome da palavra/sílaba/letra/fonema nos desafios de alfabetização): SEMPRE toca, mesmo com
// o toggle 'Narração (TTS)' DESLIGADO — via voz nativa do navegador, fora do mixer (José 2026-07-04). Respeita o volume mestre.
// Escolhe uma voz pt-BR (Brasil), evitando pt-PT (José: sílabas soavam "estranhas / pt-pt?"). Não cacheia — getVoices é barato e carrega assíncrono.
// ptbrVoice + gameSay (voz do letramento) extraídos p/ platform/speech.js (Fase 2).
// tone (synth de oscilador básico) extraído p/ platform/audio.js (Fase 2).
// Jingles (vitória · enigma · fogos) extraídos p/ platform/audio-jingles.ts (Tier 2, áudio rodada 1). DI por closure:
// soundOn/volume vivos via getters (o mixer os reatribui). firework é interno ao módulo (só playVictory o usa).
const jingles = createAudioJingles({ tone, ensureAC, catNode, audioOut, getSoundOn: () => soundOn, getVolume: () => volume });

/* ===================== Pixi ===================== */
PIXI.settings.ROUND_PIXELS=true;
const app=new PIXI.Application({width:LOGICAL_W,height:LOGICAL_H,backgroundColor:0x05070f,
  antialias:false,resolution:1,powerPreference:'low-power'});
const pixiMount = $('#pixi-mount');
// Sem o ponto de montagem não existe jogo — então falha, e falha DIZENDO o quê. Hoje já quebrava nesta
// linha, com "Cannot read properties of null (reading 'appendChild')", que não ajuda quem editou o HTML.
// A MENSAGEM É O SELETOR, e a frase mora aqui. O gate do item 14 proíbe literal de prosa neste arquivo —
// em qualquer idioma — e a última porta dele, a lista de exceções, tem teto DEZ e está cheia, de
// propósito: "passar disso quer dizer que alguém está perdoando texto em vez de traduzi-lo". Subir o
// teto para caber uma mensagem minha seria afrouxar o gate para caber nele.
//
// E o resultado é melhor do que a frase seria: o seletor é a INFORMAÇÃO (o que falta no HTML), a pilha
// dá o lugar, e a explicação fica onde quem edita o código a encontra. Antes disto, a mesma falha vinha
// como "Cannot read properties of null (reading 'appendChild')", que não diz nem o quê nem onde.
if (!pixiMount) throw new Error('#pixi-mount');
/**
 * A TELA, uma vez, com o tipo que ela tem em EXECUÇÃO.
 *
 * No PixiJS 7 o `app.view` é `ICanvas` — uma interface que existe para o Pixi poder desenhar fora do DOM
 * (worker, OffscreenCanvas). Ela não é `Node` e não tem `setAttribute`, então `appendChild`, o atributo
 * `aria-hidden` e o `style.filter` do filtro de baixa qualidade não compilam contra ela. Mas o que este
 * arquivo cria é uma `PIXI.Application` de navegador, e ali o `view` É um `<canvas>` do DOM.
 *
 * A afirmação mora aqui, uma vez, em vez de três `as` espalhados — e o `aria-hidden` explica por que ela
 * importa: a tela é escondida do leitor de tela DE PROPÓSITO, porque o jogo fala pelo DOM (pilar 2), e um
 * `as` esquecido num desses pontos é uma regressão de acessibilidade, não um aviso de tipo.
 */
const view = app.view as unknown as HTMLCanvasElement;
pixiMount.appendChild(view);
view.setAttribute('aria-hidden','true');
const camera=new PIXI.Container(); app.stage.addChild(camera);
weatherLayer=new PIXI.Graphics(); app.stage.addChild(weatherLayer); // CLIMA (chuva/clarão) em tela-espaço, mantido no topo em draw
weather.initWeather({ mundoRodando: () => fatosDaCena().mundoRodando, weatherLayer, stage: app.stage, screen: app.screen, getRm: () => rm, thunder: (i) => ambient.thunder(i),
  temChuva: () => !!(CENARIO && CENARIOS[CENARIO]?.chuva) }); // a PERGUNTA, não o id: o catálogo é daqui
/* Tela de título da v3 (render/title-scene.ts): céu em gradiente + nuvens andando dir→esq + grama pontilhada */
const titleG=new PIXI.Graphics(); app.stage.addChildAt(titleG, app.stage.getChildIndex(weatherLayer));
const titleScene = createTitleScene({ titleG, screen: app.screen, getRm: () => rm }); // cena PIXI: render/title-scene.ts (camada criada acima, injetada)
const titleUI = initTitle({ $ }); // navegacao dos submenus do titulo: ui/title.ts
/* ===================== ATTRACT MODE → extraído para game/attract.ts (Tier 1) =====================
   O controlador `attractCtl` é criado no fim do módulo (quando players/CENARIO/setCenario/restartGame/
   kbFor/etc. já existem). Aqui ficam só as chamadas: attractCtl.{isAttract,stepAttract,titleIdleTick,onInput,recordTick}. */

/* ===== Parallax: as 3 camadas de FUNDO atras do tileset -> render/parallax.ts (D2-b) =====
   Os fatores de profundidade (PARALLAX), a conta da rolagem (posicoesParallax/updateParallax) e o vestir das
   camadas por tema (aplicarTemaParallax) moram la. AQUI fica so a MONTAGEM no render-graph, e ela tem de ficar
   NESTE ponto: `camera` acabou de nascer, `starsG` (logo abaixo) e inserido relativo a parallaxLayers[1], e o
   setCenario do boot ja precisa das 3 camadas de pe para vesti-las com o tema salvo.
   `vp` (viewports) e as camadas de decor de TELA nascem DEPOIS deste ponto -> entram embrulhados em seta. */
const parallaxApi = createParallax({
  camera, criarAzulejo: (t, w, h) => new PIXI.TilingSprite(t as never, w, h), // a porta pede a fábrica
  placeholderTex: parallaxPlaceholder, skyTex: themeSkyTexture, hillsTex: themeHillsTexture, // render/scene-parallax
  citySkyTex: themeCitySkyTexture, skylineTex: themeSkylineTexture, // ADR-0042: a Cidade é gerada, não baixada
  // `Imagem`/`texturaDeImagem`/`escalaNearest` saíram: eram a carga dos três PNG da Cidade, e com ela a
  // corrida que cada `onload` tinha de conferir (`getCenario() !== theme`). Não há mais o que baixar.
  rm, getCenario: () => CENARIO, getVizMode: () => vizMode,
  clearParallaxTexCache: () => vp.clearParallaxTexCache(), // `vp` e const declarado ABAIXO: seta resolve na chamada
  getDecorDeTela: () => [starsG, nuvemG, skyDecoG, fogG],  // `var` icados: undefined no boot, e o modulo guarda
});
const { layers: parallaxLayers, texNormal: parallaxTexNormal, updateParallax } = parallaxApi;
/* Tema de cenario: valida, persiste, veste o fundo e refaz a textura do mundo -> render/set-cenario.ts (D2-b).
   `loadTileImages` foi junto, virou `carregarTilesDoTema` e MORREU no item 17 (os tiles da Cidade sao dados
   agora, em render/city-tiles) — a troca de cenario e sincrona. `_vidaReady` FICA aqui: e a flag de boot da cena da
   cidade, escrita la embaixo. Tudo o que nasce depois deste ponto entra por getter/seta — o setCenario do boot
   roda dentro de um try/catch MUDO, e uma dependencia em TDZ aqui nao daria erro: daria "o tema salvo sumiu". */
let _vidaReady=false; // camadas de vida/trafego/tema ja existem (applyCenarioVida pode rodar). CENARIO vem de core/state.js
const { setCenario } = createSetCenario({
  setCenarioValue, getCenario: () => CENARIO,
  aplicarTemaParallax: parallaxApi.aplicarTemaParallax,
  // Os tiles da Cidade vêm DESENHADOS (render/city-tiles); os outros temas caem nos blocos v3 com `null`.
  // Era `Imagem: Image` + download; virou uma função síncrona, e com ela foram embora a guarda de corrida e
  // os 404 de boot dos quatro temas que nunca tiveram arte própria.
  getTiles: (tema) => tema === 'cidade' ? cityTiles() : null,
  worldCanvas, tex, clearWorldTexCache,
  // O `t` chega `unknown` — a `set-cenario` trata textura como handle opaco, e deve mesmo. A raiz e o
  // unico lugar que sabe o nome dele, e e aqui que ele o recupera.
  setWorldTextures: (cv, t) => { worldCanvasNormal = cv; worldTexNormal = t as PIXI.Texture; }, // `let` declarados ABAIXO (so escritos no .then)
  isVizReady: () => vizReady, reapplyVizAll: () => reapplyVizAll(),             // `reapplyVizAll` e const de viz-setters, la embaixo
  getWorldSprite: () => worldSprite,                                            // nasce depois; so lido no .then
  isVidaReady: () => _vidaReady, applyCenarioVida: () => sceneCity.applyCenarioVida(),
});
// Modos de cor. kind: normal=arte crua · hcnew=Renderização Direta (alto contraste, 3 níveis) ·
// filter=simulação/correção de daltonismo (SVG na canvas) · lowvision/blind=empatia.
// VIZ_MODES/VIZ_BY_KEY/VIZ_FILTER/VIZ_CYCLE extraídos p/ render/viz-modes.js (Fase 2, dados de a11y visual).
/* L2: Realce de contraste Linear→Quadrático (PESQUISA-ALTO-CONTRASTE §2.3, decisão do José: slider).
   Curva de tom POR PIXEL na tela inteira: I' = (1−t)·linear(I) + t·quadS(I), onde
   linear = α(I−μ)+μ (contrast stretching, α=1.3, μ=0.5) e quadS = curva S por partes (2I² | 1−2(1−I)²).
   GPU via SVG feComponentTransfer type=table (17 amostras, sRGB — mesma decisão da daltonização),
   composto com os filtros CVD no CSS filter do canvas. Global (tela toda; por-viewport = adiado). */
// lqT / lqCurve / ensureLqFilter / lqFilter / setLq migraram para render/lq-filter.ts (Onda A); lqName tambem,
// e ja nao tinha chamador aqui (o rotulo do painel vem de ui/settings-visual, que reexporta o do modulo).
// A RECOMPOSICAO do filtro CSS fica: ela mistura o modo de visao ativo e invalida caches de textura,
// coisas que nao sao do realce L->Q.
initLqFilter({ onChange: () => { if(app&&view){ if(rodada.numPlayers<=1)applyVizGlobal(players[0].viz); else view.style.filter=lqFilter(); } } });
// vizMode vem de core/state.js (Fase 2, mega-var 6). Init de boot SEM persistir (preserva o rastreio de prefers-contrast):
initVizMode((()=>{ try{ const v=store.get('incl_viz',null); if(v&&VIZ_CYCLE.includes(v))return v; }catch(e){}
  // A guarda `window.matchMedia &&` saiu: o `tsc` acusa TS2774 porque ela testa uma função que SEMPRE existe
  // no DOM, e uma condição sempre verdadeira lida por quem revisa parece proteção contra algo. Ela vinha de
  // antes do TypeScript; `matchMedia` existe desde o IE10 e o alvo do pilar 1 é Chromium.
  return matchMedia('(prefers-contrast: more)').matches ? 'hc-direto' : 'normal'; })()); // prefere-contraste → alto contraste 3:1
let vizReady=false; // só após todas as dependências de applyViz existirem (evita TDZ no init via setCenario)
let worldCanvasNormal=worldCanvas();
let worldTexNormal=tex(worldCanvasNormal);
const worldSprite=new PIXI.Sprite(worldTexNormal); camera.addChild(worldSprite);
// L6: camadas de decor de TELA da v3 (contra-posicionadas no updateParallax, como o parallax)
var starsG=new PIXI.Graphics();   camera.addChild(starsG);   // estrelas ATRÁS dos morros — pelo zIndex 3500 (bloco R1)
var nuvemG=new PIXI.Graphics();   camera.addChild(nuvemG);   // MANTA de nuvens: na frente do céu (esconde o sol), ATRÁS dos morros
var skyDecoG=new PIXI.Graphics(); camera.addChild(skyDecoG); // nuvens/pássaros à frente dos morros, atrás dos tiles — zIndex 6500
var fogG=new PIXI.Graphics();     camera.addChild(fogG);                                                // névoa: FRENTE (re-erguida com o carLayer)
/* ===== FABRICA de imagem dos modos de visao -> render/viewports.ts (B2) =====
   AQUI, e nao junto dos outros setters la embaixo: o setCenario logo abaixo ja chama
   vp.clearParallaxTexCache(), sincrono, DENTRO de um try/catch. Com o init mais tarde, quem tivesse
   'espaco' ou 'noite' salvo cairia em ReferenceError engolido pelo catch — o tema escolhido sumiria
   sem uma linha de log. treeTexNormal e lvOverlaySpr nascem depois: entram por getter, por isso.
   As seis matrizes de daltonismo agora tem UMA fonte (render/cvd-matrices) e o SVG do index.html e
   GERADO daqui, em vez de escrito a mao — antes eram duas copias, uma por caminho de render. */
const vp = initViewports({
  ColorMatrixFilter: PIXI.ColorMatrixFilter, BlurFilter: PIXI.BlurFilter,
  parallaxTexNormal, getTreeTexNormal: () => treeTexNormal,
  getLvOverlaySpr: () => lvOverlaySpr, renderizarEm: (o, alvo, limpar) => app.renderer.render(o as never, { renderTexture: alvo as never, clear: limpar }), getVpTex: () => vpTex,
  cvdDefsHost: $('#cvd-defs'),
});
const { parallaxTexFor, treeTexFor, playerVizTex, pixiFilterFor, renderVpOverlay } = vp;
// APLICA o cenário que `game/state` já leu do armazenamento (e já migrou de 'noite' para 'espaco'). Ler é
// de quem guarda o valor; aplicar — texturas, parallax, tema — é do composition root.
try{ setCenario(CENARIO); }catch(e){ setCenario('cidade'); } // herda a chave de escopo antigo; 'noite' e a migracao mais velha ainda
const coinCanvasNormal=coinCanvas();
const coinTex=tex(coinCanvasNormal);
// As texturas NORMAIS ja existem: ligue o alto contraste. worldCanvasNormal/worldTexNormal sao `let`
// (setCenario os reescreve ao trocar de tema), entao entram por getter e nao por valor.
initHighContrast({ W: WORLD_W, H: WORLD_H, roleOf, outlineFg: () => hcOutlineFg, outlineBg: () => hcOutlineBg,
  getWorldCanvasNormal: () => worldCanvasNormal, getWorldTexNormal: () => worldTexNormal,
  // Os sprites que ESTE jogo quer recoloridos por modo. A engine cacheia por (id, modo) e nao sabe o que
  // 'coin' significa — outro jogo declara 'peca', 'silaba', o que for.
  sprites: () => ({ coin: { canvas: coinCanvasNormal, tex: coinTex } }) });
// caches de modos acessíveis (preguiçosos), invalidados ao trocar de cenário (worldCanvasNormal muda)
let _lastSharedViz: string | null = null; // cache do modo aplicado (otimizacao do render MP) — NAO e do alto contraste:
// e escrito por rebuildCoins/rebuildExtras/applySharedTextures/setPlayerViz/reapplyVizAll. Fica aqui.
// _worldTexHC/_coinTexHC/worldTexFor/coinTexFor migraram para render/high-contrast.ts (Onda A).
// shapeTexture/SHAPE_TEX/letterTexture migraram para render/textures.ts (Onda A). O init vem AQUI porque
// o primeiro uso (rebuildCoins, logo abaixo) precisa dos caches ja preenchidos.
// OS SETE PODERES DESTE JOGO, com a arte deles. A lista era `PUP_KINDS` cravada dentro do `render/textures`
// e o desenho vinha por import de `render/props` — os dois sairam no item 19: a lista e do jogo, e a arte
// mudou de camada para `game/props`.
const PODERES = ['superjump', 'ultrajump', 'turbo', 'fly', 'wallcling', 'key', 'runcane'];
initTextures({ shapes: SOMASUB_SHAPES.map(s => s.id), powerups: PODERES.map((kind) => ({ kind, canvas: powerupCanvas(kind) })),
  disp, directCfg: DIRECT_CFG, directSpriteCanvas });
const coinContainer=new PIXI.Container(); camera.addChild(coinContainer);
// coinSprites/rebuildCoins migraram para game/coin-spawning.ts (Onda A). rebuildCoins mantem o contrato
// SEM argumentos: os nove chamadores (boot, novo round, quatro paineis de acessibilidade, Modo Facil,
// silabas, restart) nao mudam — so a definicao saiu daqui.
initCoinSpawning({ coinContainer, createSprite: (t) => new PIXI.Sprite(t as never), coinTexFor: (m) => spriteTexFor('coin', m),
  shapeTexFor: (id) => SHAPE_TEX[id], letterTexFor: letterTexture, pcolor: PCOLOR,
  getMode: () => MODE(), getOwnerColors: () => ownerColors, invalidateSharedViz: () => { _lastSharedViz=null; },
  powerShort: POWER_SHORT, $ });
rebuildCoins();
// camada de escuridão das áreas secretas (acima de mundo/moedas, ABAIXO do player → player sempre visível)
const darkLayer=new PIXI.Container(); camera.addChild(darkLayer);
const darkRegions=buildDarkRegions(WORLD_W, WORLD_H).map(tiles=>{
  const gfx=new PIXI.Graphics(); gfx.beginFill(0x04060d,1);
  for(const [tx,ty] of tiles) gfx.drawRect(tx*TILE,ty*TILE,TILE,TILE);
  gfx.endFill(); darkLayer.addChild(gfx);
  return { set:new Set(tiles.map(([tx,ty])=>tx+','+ty)), gfx, announced:false };
});
// TEX (pipeline de sprite anterior ao PixelLab, ZERO chamadores) e o bloco PIP_* (conversao procedural
// adiada, tambem sem chamador) migraram para render/textures.ts (Onda A) — preservados la, nao apagados.
// FASE ATUAL: usa o PIXEL ART do PixelLab DIRETO (PNG, tamanho NATIVO de cada frame — aspect ratio
// próprio, sem padronizar). A conversão procedural (PIP_* acima) fica para uma fase posterior.
// E15: cadência de animação (ANIM) migrada p/ core/constants.js (Fase 2.16) — regulável no painel ?debug=true.
// Fonte única dos sprites: assets/sprites/menino/<animação>/<i>.png (cor, editado no Aseprite).
// Alto contraste: o quadro de cor é remapeado em tempo real para a PALETA do jogador da variação ativa (sem silhuetas _hc).
// Texturas do personagem (TEX_*/FLAVORS) migradas p/ render/sprites.js (Fase 2.17).
// E4: decoração de fundo (árvores) ATRÁS do jogador — sempre visível, NÃO some ao pular
const decoLayer=new PIXI.Container(); camera.addChild(decoLayer);
const treeCanvasNormal=treeCanvas(), treeTexNormal=tex(treeCanvasNormal); // árvore = grupo fundo (recolorida no alto contraste)
// _treeTexHC/treeTexFor migraram para render/viewports.ts (B2).
const decoSprites=[];
(function placeTrees(){ let last=-99; // R-cidade: árvores SÓ na parte mais baixa (por onde o personagem anda)
  for(let tx=2;tx<WORLD_W-2;tx++){
    for(let ty=WORLD_H-9;ty<WORLD_H-1;ty++){
      if(tileAt(tx,ty)===1 && solidAt(tx,ty+1) && tileAt(tx,ty+1)!==5 && tileAt(tx,ty-1)===1){ // NUNCA em cima de trampolim
        if(tx-last>=5){ const s=new PIXI.Sprite(treeTexNormal); s.anchor.set(0.5,1); s.x=tx*TILE+TILE/2; s.y=(ty+1)*TILE; decoLayer.addChild(s); decoSprites.push(s); last=tx; }
        break;
      }
    }
  }
})();
/* ===================== E12: power-ups + chave/portão ===================== */
// powerupCanvas migrado p/ render/props.js (Fase 2.20)
// PUP_CANVAS/PUP_TEX/_pupTexHC/pupTexFor migraram para render/textures.ts (Onda A); initTextures acima
// ja montou o cache.
const extraLayer=new PIXI.Container(); camera.addChild(extraLayer); // power-ups + portão (atrás do player)
// `powerups` migrou para core/state.js (#50) — nasce junto com o portão, em setLevelExtras.
// As camadas do modulo nascem AQUI, mas o addChild/addChildAT de cada uma continua exatamente onde estava:
// no PixiJS a ordem de insercao E a ordem de desenho, entao icar a construcao e seguro e icar a montagem
// no grafo NAO e. So o construtor subiu.
const rampLayer=new PIXI.Graphics();
const ropeLayer=new PIXI.Graphics();
initLevelGeometry({ W: WORLD_W, H: WORLD_H, getPlayers: () => rodada.players, isWheelchair: () => wheelchair,
  rampLayer, ropeLayer, extraLayer,
  wcSolid: () => rodada.wcSolid, powerups: () => rodada.powerups, gateTiles: () => rodada.gateTiles,
  gate: () => rodada.gate, gateOpen: () => rodada.gateOpen,
  pupTexFor, isDirectMode: (mode) => !!DIRECT_CFG[mode], gateRoleColor: () => HC_ROLE.gate });
// Envolucros finos: o modulo CALCULA e DESENHA; o estado compartilhado (powerups/gate/wcSolid) segue morando
// aqui porque colisao e o laco do jogador tambem o leem e escrevem.
function rebuildExtras(){ lgRebuildExtras(); _lastSharedViz=null; }
function setupExtras(){
  rodada.setDecorSeed((Math.random()*1e9)>>>0); // #69: nova semente por fase
  const _blind = modoCego || players.some(p=>{const m=VIZ_BY_KEY[p.viz];return m&&m.kind==='blind';});
  rodada.setLevelExtras(lgSetupExtras(MAP_ITEMS, MAP_GATE, { wheelchair, blind:_blind })); // era desestruturação em bloco; binding importado não se atribui
  rebuildExtras();
}
setupExtras();

// Fácil: retângulo translúcido mostrando a hitbox de coleta tolerante (sob o player)
const easyHitbox=new PIXI.Graphics(); camera.addChild(easyHitbox);
// Cadeirante: RAMPAS desenhadas sobre os degraus de 1 tile (sobre o mundo, abaixo do player)
camera.addChild(rampLayer);   // ordem pelo Z.SCENERY_INTERACT (bloco R1), não pela posição de inserção
// buildRamps + WC_BRIDGES migraram para game/level-geometry.ts (Onda A).
// WC_ELEVATORS (fossos só-cadeirante) movidos p/ game/elevators.js (Estágio 4).
function buildWcGeom(){ rodada.setWcSolid(lgBuildWcGeom(wheelchair)); } // o módulo calcula; a RODADA guarda
buildWcGeom();
buildRamps(); // desenha as rampas + coberturas (lava, pontes) se já iniciar em modo cadeirante
// CORDAS FLUTUANTES na superfície da água (o cego atravessa por elas; visual para todos)
camera.addChild(ropeLayer);   // ordem pelo Z.SCENERY_INTERACT+10 (bloco R1)
// buildRopes migrou para game/level-geometry.ts (Onda A).
buildRopes();
// ELEVADOR (cadeirante): trampolim = plataforma LARGA, escada = plataforma FINA. Toque ↑/↓ = viaja até a parada segura.
// ELEV_SPEED/elevShafts/buildElevators/elevAt extraídos p/ game/elevators.js (Estágio 4). drawElevators (cabine
// de vidro) fica aqui e lê os poços por getElevShafts(). WC_ELEVATORS foi p/ o módulo; WC_BRIDGES fica (ramps).
initElevators({ W: WORLD_W, H: WORLD_H, isWheelchair: () => wheelchair }); // liga o módulo às dims + estado
buildElevators();
const elevLayer=new PIXI.Graphics(); camera.addChild(elevLayer); // ordem pelo Z.SCENERY_INTERACT+20 (bloco R1)
// Estilo VIDRO PREDIAL (rodoviária/shopping/aeroporto): fosso de vidro translúcido (vê o background),
// moldura cinza/branco/azul, escada some virando blocos de elevador, e a cabine PERMANECE onde foi deixada.
// drawElevators migrou para game/level-geometry.ts (Onda A) — game/elevators ja registrava que quem desenha
// a cabine e quem escreve a posicao dela.
const caneLayer=new PIXI.Graphics(); camera.addChild(caneLayer); // bengala (modo cego)
// drawCane/drawRunCane extraídos p/ render/wheelchair-sprites.js (Estágio 4). caneLayer (acima) fica aqui.
const chairLayer=new PIXI.Graphics(); camera.addChild(chairLayer); // cadeira de rodas (modo cadeirante)
// drawChair extraído p/ render/wheelchair-sprites.js (Estágio 4). chairLayer (acima) fica aqui.

/* ===================== L5: VIDA AMBIENTE (Cidade) — pombos, gatos, cães e adultos, 100% procedural =====================
   Cosmético puro: sem colisão, sem dano (revoada de pombo ≠ susto de perigo). ATRÁS do player.
   Pool de 8, spawn perto da câmera, 2 quadros por bicho; rm.decor (Movimento Reduzido de cena) desliga tudo. */
const lifeLayer=new PIXI.Container(); camera.addChild(lifeLayer);
const CITY_TEX=createCityTextures(); // pombos/gatos/caes, silhuetas de adulto e carros (render/city-tex.ts) — I/O de canvas SO aqui, no boot
// LIFE_KINDS/creatures/_lifeSpawnT/spawnCreature/stepLife migraram para game/life.ts (Onda A).
// inDark/lifeSurfaceAt/lifeSurfaceLowAt/streetCols FICAM: render/scene-city usa lifeSurfaceAt tambem.
function inDark(tx: number,ty: number){ for(const r of darkRegions){ if(r.set.has(tx+','+ty))return true; } return false; } // célula de área secreta?
function lifeSurfaceAt(tx: number){ for(let ty=3;ty<WORLD_H-1;ty++){ if(solidAt(tx,ty)&&!solidAt(tx,ty-1)&&tileAt(tx,ty-1)!==3&&tileAt(tx,ty)!==9&&tileAt(tx,ty-1)!==9&&!inDark(tx,ty-1)) return ty; } return -1; } // superfície AO AR LIVRE (fora das secretas), a MAIS ALTA; ty-1!==9 = nada spawna DENTRO da lava
function lifeSurfaceLowAt(tx: number){ for(let ty=WORLD_H-2;ty>3;ty--){ if(solidAt(tx,ty)&&!solidAt(tx,ty-1)&&tileAt(tx,ty-1)!==3&&tileAt(tx,ty)!==9&&tileAt(tx,ty-1)!==9&&!inDark(tx,ty-1)) return ty; } return -1; } // idem, a MAIS BAIXA (calçada/fachada); ty-1!==9 = fora da lava
let _streetCols: [number, number][] | null = null; // colunas ABERTAS da rua/fachada (superfície mais baixa, fora das secretas) — computadas 1×
function streetCols(){ if(_streetCols)return _streetCols; _streetCols=[];
  for(let tx=2;tx<WORLD_W-2;tx++){ const ty=lifeSurfaceLowAt(tx); if(ty>0&&ty*TILE>WORLD_PX_H*0.55)_streetCols.push([tx,ty]); }
  return _streetCols; }
life.initLife({ getPlayers: () => rodada.players, getNumPlayers: () => rodada.numPlayers, layer: lifeLayer, makeSprite: (t) => new PIXI.Sprite(t as never), lifeTex: CITY_TEX.lifeTex, adultTex: CITY_TEX.adultTex,
  lifeSurfaceAt, lifeSurfaceLowAt, streetCols, decoSprites, rm, W: WORLD_W, pxW: WORLD_PX_W, pxH: WORLD_PX_H });
/* ===================== L5: CARROS (camada da FRENTE) + SEMÁFORO funcional — procedural ===================== */
// Carros cruzam a rua À FRENTE do player (carLayer re-erguido em ensureSprites); param no vermelho/amarelo
// do semáforo e seguem no verde. Ciclo LENTO (verde 8s → amarelo 2s → vermelho 6s) — sem flashes (WCAG 2.3.1).
const carLayer=new PIXI.Container(); camera.addChild(carLayer);
// R-cidade (José 2026-07-03): o cenário é o INTERIOR de um prédio; a parte mais baixa é a FACHADA e a
// rua fica NA FRENTE dela → carros (3×) e placas de PARE vivem na BASE do mundo, na camada da frente.
// cars/_carT/STREET_Y/SEM/drawSemaforo/initTraffic/spawnCar/setFrontDim/stepTraffic migraram para
// game/traffic.ts (Onda A). carLayer FICA (o z-order dele e soldado aqui); a textura saiu para
// render/city-tex.ts (D3-a), junto com a dos bichos e a dos pedestres.
traffic.initTraffic({ carLayer, CAR_TEX: CITY_TEX.carTex,
  criarSprite: (t) => new PIXI.Sprite(t as never), criarDesenho: () => new PIXI.Graphics(),
  WORLD_PX_W, WORLD_PX_H, WORLD_W, getRm: () => rm });
/* ===================== L5: DECORAÇÃO POR ZONA (procedural, desenhada UMA vez) =====================
   Rua: calçada+meio-fio, postes com brilho ESTÁVEL, placas (PARE/faixa), letreiros nas fachadas.
   Caixa d'água: paredes de tanque + linha d'água. Interior de prédio (alto): janelas.
   Secretas (darkRegions): entulho/viga/pichação — desenhados ABAIXO do darkLayer (só aparecem revelados). */
const cityDecoG=new PIXI.Graphics(); lifeLayer.addChildAt(cityDecoG,0); // atrás dos bichos, à frente do mundo
const abandonG=new PIXI.Graphics(); camera.addChild(abandonG); // SOB a escuridão — pelo Z.TILES+400 contra o TILES+500 do darkLayer
// buildCityDeco migrou para render/scene-city.ts (Onda A); a chamada de boot desceu para junto do init,
// depois que TODAS as camadas dele existem (lavaFxG/waterFxG nascem mais abaixo).
/* ===================== L5+: CÉU — nuvens à deriva + pássaros cruzando (procedural) =====================
   Atrás dos tiles (sobre o parallax). Nuvens derivam devagar e dão a volta; pássaros de 2 quadros cruzam
   o céu de vez em quando. rm.decor congela nuvens e remove pássaros. */
const skyLayer=new PIXI.Container(); camera.addChild(skyLayer); // ordem pelo zIndex 6700 (bloco R1)
// Estes dois usavam `makeCanvas` + `getContext('2d')` na mão — o par que `render/canvas.pixelTexture` existe
// para eliminar, e cujo comentário já cita "os três `mk` locais do main.js". Eram mais dois que ficaram para
// trás. Reusar o painter também resolve, de graça, onze avisos de `getContext` possivelmente nulo: o `!` mora
// num lugar só, dentro do helper, em vez de aparecer em cada bloco de arte.
const NUVEM = 'rgba(225,232,244,0.85)';
const CLOUD_TEX = [0, 1].map((v) => { const w = v ? 46 : 30, h = v ? 12 : 9;
  return pixelTexture(w, h, (px) => {
    px(4, 4, w - 8, h - 5, NUVEM); px(0, 6, w, h - 7, NUVEM); px(8, 0, w - 20, 6, NUVEM); px(w - 16, 2, 10, 5, NUVEM);
  });
});
const PASSARO = '#20242e';
const BIRD_TEX = [0, 1].map((f) => pixelTexture(7, 4, (px) => {
  if (f === 0) { px(0, 0, 3, 1, PASSARO); px(4, 0, 3, 1, PASSARO); px(2, 1, 3, 1, PASSARO); }
  else { px(0, 2, 3, 1, PASSARO); px(4, 2, 3, 1, PASSARO); px(2, 1, 3, 1, PASSARO); }
}));
// clouds/birds + seedClouds + stepSky extraídos p/ render/scene-sky.ts (#43). skyLayer/CLOUD_TEX/BIRD_TEX ficam aqui
// (criação = z-order do render-graph) e são injetados. Uso no loop: sceneSky.stepSky(dt).
/* ===================== L6 (fiel à v3): decoração viva por tema — fórmulas COPIADAS da v3.1.100 =====================
   Tela: estrelas (starsG, atrás dos morros) · nuvens+pássaros (skyDecoG, à frente dos morros) · névoa (fogG, frente).
   Mundo: grama+flores c/ vento (grassG, atrás do player) · minhocas/vagalumes/borboletas (themeFxG, FRENTE, como na v3). */
const grassG=new PIXI.Graphics(); lifeLayer.addChildAt(grassG,0);
const themeFxG=new PIXI.Graphics(); camera.addChild(themeFxG);          // fauna à FRENTE do player (worms + metade das borboletas)
const themeFxBackG=new PIXI.Graphics(); camera.addChild(themeFxBackG);  // fauna ao FUNDO (vaga-lumes + metade das borboletas) — #69
// Lógica do céu (stepSky/stepV3Decor + nuvens/pássaros/estrelas/névoa/grama/bichos) extraída p/ render/scene-sky.ts (#43).
// As 6 camadas acima são criadas AQUI (z-order do render-graph, intocado) e INJETADAS; o módulo só as anima. getFxClock é lazy.
const sceneSky = createSceneSky({ skyLayer, starsG, skyDecoG, nuvemG, fogG, grassG, themeFxG, themeFxBackG, CLOUD_TEX, BIRD_TEX, criarSprite: (t) => new PIXI.Sprite(t as never),
  hexN, rnd, randInt, WORLD_PX_W, WORLD_PX_H, WORLD_W, WORLD_H, TILE, LOGICAL_W, LOGICAL_H, BOX,
  CENARIOS, THEME_FLORA, DIRECT_CFG, solidAt, tileAt,
  getCenario: () => CENARIO, getVizMode: () => vizMode, getPlayers: () => players, getFxClock: () => fxClock, getRm: () => rm,
  getAglomeracao: () => weather.getAglomeracao(), // o MESMO relógio da chuva: as nuvens fecham antes da 1ª gota
  getGrassDensity: () => rodada.grassDensity, getDecorSeed: () => rodada.decorSeed });
// drawV3Cloud + drawV3Grass extraídos p/ render/scene-sky.ts (#43) — funções de desenho puras usadas por stepV3Decor.
// stepV3Decor (decor viva da v3: estrelas/nuvens/pássaros/névoa/grama/minhocas/vagalumes/borboletas) extraído p/
// render/scene-sky.ts (#43). Camadas injetadas. Uso no loop: sceneSky.stepV3Decor().
// applyCenarioVida migrou para render/scene-city.ts (Onda A): la ele so mexe nas camadas dele e chama de
// volta o gancho onCenarioChange, por onde o transito reage. O estado inicial e ligado junto do init.
/* ===================== Tiles vivos da v3 (água FORE + lava) — drawTile animado, fiel ===================== */
const lavaFxG=new PIXI.Graphics(); lifeLayer.addChildAt(lavaFxG,0);   // tracinhos da lava (ATRÁS do player, como o map-back)
const waterFxG=new PIXI.Graphics(); decoLayer.addChild(waterFxG);     // corais/algas/peixes no BACKGROUND (camada das árvores — pedido do José; ficam atrás de player E carros)
const sceneCity = initSceneCity({ cityDecoG, abandonG, lavaFxG, waterFxG, skyLayer, darkRegions,
  solidAt, tileAt, lifeSurfaceAt, WORLD_W, WORLD_H, TILE, WORLD_PX_W, WORLD_PX_H, LOGICAL_W, LOGICAL_H, BOX,
  DIRECT_CFG, getCenario: () => CENARIO, getVizMode: () => vizMode, getPlayers: () => players,
  getFxClock: () => fxClock, getRm: () => rm,
  onCenarioChange: (city) => { carLayer.visible = city; if(!city) traffic.clearCars(); } });
sceneCity.buildCityDeco();
_vidaReady=true; sceneCity.applyCenarioVida(); // estado inicial (CENARIO já veio do setCenario do boot)
const playerSprite=new PIXI.Sprite(TEX_IDLE[0]); playerSprite.anchor.set(0.5,1); camera.addChild(playerSprite);
players[0].sprite=playerSprite;
// (re-add-ao-topo removido — carLayer/themeFxG/fogG posicionados pelo zIndex canônico do bloco R1, logo abaixo; #69)
/* ===================== L2: JUICE — micro-efeitos de resposta (toggles independentes no ?debug) =====================
   Cada efeito respeita o Movimento Reduzido do jogador: partículas→rm.particles, cintilar→rm.items,
   tremor de tela→rm.parallax (movimento de câmera), squash→rmWalk (personagem). Hit-stop é PAUSA, não movimento. */
// JUICE/saveJuice/easeOut3/particles/shake/hit-stop extraídos p/ render/fx.js (Estágio 4). fxClock FICA aqui
// (clock GERAL de animação — o cintilar das moedas + ctx o leem). initFx injeta fxG+rm logo após criar fxG.
let fxClock=0;
const fxG=new PIXI.Graphics(); camera.addChild(fxG); // acima dos players (re-erguida em ensureSprites)
initFx({ getPlayers: () => players, fxG, rm }); // Estágio 4: liga o módulo fx à camada PIXI + reduce-motion
// ===== R1 (#69, ADR-0020): ORDEM-Z CANÔNICA do MUNDO — zIndex declarativo (core/layers.ts) sobrepõe os
// addChildAt(getChildIndex) + os re-add-ao-topo (que ficam redundantes: o zIndex decide a ordem). Filhos ANINHADOS
// (grassG/cityDecoG/lavaFxG no lifeLayer; waterFxG no decoLayer) mantêm a ordem interna do pai. Alvo: no-op visual.
camera.sortableChildren = true;
parallaxLayers[0].zIndex = Z.PARALLAX_4; starsG.zIndex = 3500; parallaxLayers[1].zIndex = Z.PARALLAX_3; parallaxLayers[2].zIndex = Z.PARALLAX_2;
// A manta de nuvens entra em PARALLAX_4+600, que é o slot que core/layers já reservava para "nuvens de céu em
// PARALLAX_*+offset": à FRENTE do gradiente de céu (3000) — é assim que ela esconde o sol — e ATRÁS das duas
// bandas de morro (4000 e 5000), que é o que faz as árvores do fundo passarem na frente dela. Pedido do Dev.
nuvemG.zIndex = Z.PARALLAX_4 + 600;
skyDecoG.zIndex = 6500; skyLayer.zIndex = 6700; decoLayer.zIndex = Z.BG_DECOR;
// Área SECRETA (darkRegions): conteúdo (abandonG) + escuridão que o cobre — camada do MEIO, à frente dos tiles mas ATRÁS
// da fauna/itens/player (NÃO é o DARK_WORLD de modo cego). Senão a escuridão da região cobre borboletas/grama. (#69)
abandonG.zIndex = Z.TILES + 400; // 8400 — conteúdo secreto, sobre os tiles
worldSprite.zIndex = Z.TILES;
rampLayer.zIndex = Z.SCENERY_INTERACT; ropeLayer.zIndex = Z.SCENERY_INTERACT + 10; elevLayer.zIndex = Z.SCENERY_INTERACT + 20;
lifeLayer.zIndex = Z.FAUNA_BACK; extraLayer.zIndex = Z.ITEMS - 500; coinContainer.zIndex = Z.ITEMS;
playerSprite.zIndex = Z.PLAYER; caneLayer.zIndex = Z.PLAYER + 10; chairLayer.zIndex = Z.PLAYER + 20;
fxG.zIndex = Z.VFX_FRONT; carLayer.zIndex = Z.VEHICLES; themeFxG.zIndex = Z.FAUNA_FRONT; themeFxBackG.zIndex = Z.FLORA_BACK + 500; fogG.zIndex = Z.WEATHER - 500;
darkLayer.zIndex = Z.TILES + 500; easyHitbox.zIndex = Z.WORLD_A11Y; // darkLayer = escuridão da área SECRETA (meio, atrás dos atores), NÃO DARK_WORLD (#69)
// spawnParticle/puffDust/burstSparkle/addShake/addHitstop/setSquash/stepFx/drawFx extraídos p/ render/fx.js
// (Estágio 4). Importados no topo; fxG+rm injetados por initFx; shake/hit-stop lidos por getters/shakeAmp/tickHitstop.
/* L2: Estética CRT (menu Sensibilidade visual) — scanlines/vinheta/cantos em 3 NÍVEIS (0=desligado,
   1=pequeno, 2=grande), só CSS. Cantos: 0=tela quadrada, 1=padrão de sempre (8px), 2=arredondadão (24px).
   Migra o formato booleano antigo (true→ligado; round true→2, false→1). */
// CRT/crtScanVars/applyCrt extraídos p/ render/crt.js (Estágio 4, Tier 1). Boot: aplica as classes CSS agora.
applyCrt();
/* E11: sprites por jogador + render multi-viewport (render-to-texture) */
let allPSprites=[playerSprite];
function ensureSprites(){
  for(let i=allPSprites.length;i<rodada.numPlayers;i++){ const s=new PIXI.Sprite(TEX_IDLE[0]); s.anchor.set(0.5,1); s.zIndex=Z.PLAYER; camera.addChild(s); allPSprites.push(s); }
  // (re-add-ao-topo removido — fxG/carLayer/themeFxG/fogG governados pelo zIndex canônico (bloco R1); sortableChildren re-ordena; #69)
  allPSprites.forEach((s,i)=>{ s.visible=i<rodada.numPlayers; s.tint=PCOLOR[i]||0xffffff; if(i<rodada.numPlayers)players[i].sprite=s; });
}
let vpTex: RenderTextureLike[] = [], vpSpr: SpriteLike[] = [], vpFrames: GraphicsLike | null = null, vpDots: GraphicsLike[] = [];
// HUD por jogador em DOM SOBREPOSTO (alta definição, não pixela): moedas (1ª coluna) + poder (2ª coluna), por viewport.
let vpBars: HTMLElement[] = [];  // as BARRAS RÁPIDAS por tela (ADR-0044, item 7) — REATRIBUÍDA por buildGameHud
let vpPause: HTMLElement[] = []; // `pauseActor` migrou para core/state.js (#50). gameHudEl/vpHudDom/vpQuitDom/vpScreens -> ui/hud.ts
// Menu de pausa POR TELA (Etapa 2): um por jogador, dentro da .player-screen dele.
// Barra de atalhos de a11y no topo da pausa (por tela). Sons (cego/TTS) só com saída própria; webcam/voz em construção.
/* ===================== PAUSA POR TELA + ICONES DE A11Y -> ui/pause-icons.ts =====================
   PAUSE_ICONS, calmMode, buildScreenPause, hasPrivateOutput, applyCalm, iconAct, iconLabel,
   reflectIconBtn e reflectPauseIcons migraram. `pauseActor` FICA aqui (seis leitores fora do modulo,
   e o ctx do gamepad ja o escreve); o modulo so escreve, por setPauseActor. `pauseActs` entra por
   GETTER porque e um const ~1200 linhas abaixo — passa-lo direto explodiria na TDZ no boot. */
const pauseIcons = initPauseIcons({
  getPlayers: () => players, getNumPlayers: () => rodada.numPlayers,
  srSay, srAlert,
  pmButtons: PM_BTNS,
  optionsButtons: PM_OPTIONS_BTNS,
  // O ROTULO PRONTO de um botao dinamico (item 19). A frase era montada dentro do `ui/pause-icons` — que e
  // ENGINE — a partir do `quizLevel` e da tabela `QL_NAME`, e trazia "Nivel" em pt-BR CRU. Agora quem monta
  // e o jogo, que sabe o que e um nivel, como ele se chama e em que idioma dize-lo.
  dynLabel: (b) => (b.nivel ? (t('pause.nivel', { n: quizLevel, nome: QL_NAME[quizLevel] })) : null),
  getPauseActs: () => pauseActs,            // LAZY: pauseActs e const bem abaixo (TDZ)
  setPauseActor: (i) => rodada.setPauseActor(i),
  getPauseScreens: () => vpPause,           // buildGameHud REATRIBUI vpPause -> getter, nao a array
  getA11yBars: () => vpBars,                // idem: `let` reatribuido a cada remontagem do HUD
  getModoCego: () => modoCego, setModoCego,
  getAudioCat: () => audioCat, setCatGain,
  reflectTtsPanel: () => audioPanel.reflectTts(), // LAZY: audioPanel e const bem abaixo
  // LIGADO. Estava morto desde que reflectTTS foi extraida para ui/settings-audio: a guarda
  // `typeof reflectTTS==='function'` virou sempre falsa e ninguem notou. O sintoma existe e nao e
  // cosmetico — o painel de audio e o icone da pausa ficam ambos VISIVEIS ao mesmo tempo, entao
  // ligar o TTS pelo icone deixava o botao do painel dizendo 'Desligado' com aria-pressed=false,
  // ou seja, mentindo o estado para leitor de tela.
  reflectTtsPanelEnabled: true,
  isLibrasOn: vlibrasOpen, toggleLibras,
  rm, saveRM, rmKeys: RM_KEYS, rmChar: RM_CHAR,
  setToggleMove,
  // ⚠️ PASSADO PREGUIÇOSAMENTE, e o motivo é um aviso do compilador que eu NÃO consegui explicar.
  //
  // `setPlayerViz` é desestruturado de `viz` ~380 linhas ABAIXO, e o `tsc` acusa TS2448 — uso antes da
  // declaração. Reproduzi o padrão isolado no navegador e ele estoura mesmo: "Cannot access 'setPlayerViz'
  // before initialization". Só que o jogo BOOTA, e `window.__incl.setPlayerViz` é uma função — ou seja, na
  // prática esta linha não estoura, e eu não sei dizer por quê. (Cheguei a comparar a ordem no bundle, mas
  // a comparação era inválida: eu media posições de strings que também existem dentro dos módulos.)
  //
  // Envolver num lambda adia a leitura do binding para a hora da CHAMADA, que é sempre depois do boot. Isso
  // é correto nos dois cenários — no que eu entendo e no que eu não entendo — e é por isso que está assim
  // em vez de um `as` ou de uma reordenação que eu justificaria com uma história inventada.
  setPlayerViz: (...a: Parameters<typeof setPlayerViz>) => setPlayerViz(...a),
});
const reflectPauseIcons = () => pauseIcons.reflectPauseIcons();
function reflectTitleIcons(){ pauseIcons.reflectIconsIn($('#title-icons'),0); } // icones do SPLASH (escopo do J1)
// Contêiner "tela do jogador" por viewport (Etapa 1): hospeda o HUD; nas próximas etapas, a pausa e os menus.
/* ===================== HUD POR TELA -> ui/hud.ts =====================
   O painel de pausa NAO e do HUD: entra como fabrica injetada e o modulo so anexa o retorno — foi isso
   que permitiu extrair os dois em paralelo sem se tocarem. Os paineis criados dentro do laco voltam
   pelo gancho, porque `vpPause` e binding daqui e modulo nao reatribui binding alheio. */
const hud = initHud({
  getPlayers: () => players, getNumPlayers: () => rodada.numPlayers,
  // O OBJETIVO deste jogo, na forma do campo 5 do contrato (core/contract.Objective). O HUD nao sabe mais o
  // QUE se junta: quem declara e a raiz de composicao, ou seja, o jogo. O nome segue em pt-BR porque ele
  // atravessa como PARAMETRO (pilar 3), e o genero/plural existem para as frases que precisam concordar.
  hudObjective: (i) => ({
    // Resolvido a CADA quadro, e nao no boot: uma tabela lida uma vez ficaria congelada no idioma do boot —
    // o mesmo defeito que o item 14 tirou dos rotulos de poder.
    name: { text: t('hud.nome.moedas'), gender: 'f', plural: true },
    have: (players[i] && players[i].collected) || 0,
    need: COIN_TARGET,
  }),
  hudIcon: '🪙',
  $, powerShort: POWER_SHORT,
  buildScreenPause: (i) => pauseIcons.buildScreenPause(i),
  buildQuickBar: (i) => pauseIcons.buildQuickBar(i),
  onBarsBuilt: (bars) => { vpBars = bars; },
  onScreensBuilt: (panes) => { vpPause = panes;
    // No 1o build do init, LETRA/PAD_DESIGNS ainda estao em TDZ — o try/catch ignora e o fluxo de init
    // preenche logo depois. Preservado verbatim, inclusive o engolir de qualquer erro.
    // O `false` que estava aqui alimentava um parâmetro que `applyLetra` não tem — ele vinha sendo
    // DESCARTADO em silêncio desde que a função perdeu a assinatura antiga, e um argumento ignorado sugere
    // um comportamento que não existe. O `try/catch` continua verbatim: ele é a proteção real, contra o TDZ
    // do primeiro build, e é isso que o comentário acima preserva.
    try{ applyLetra(); }catch(e){}
    try{ renderPauseLegend(); }catch(e){} },
});
const buildGameHud  = () => hud.buildGameHud();
const updateGameHud = () => hud.updateGameHud();
/* ===================== O PIPELINE DE RENDER POR TELA -> render/screen-pipeline.ts (D3-c) =====================
   A TOPOLOGIA do render saiu inteira (quantas render-textures, onde cada tela fica, moldura e bolinha). Aqui
   fica so o ENVOLUCRO — declaracao de funcao, portanto icada, porque initSession o recebe por REFERENCIA.
   applyVpFilters/updateVpDots sao const ~280 linhas ABAIXO: entram como setas preguicosas, e isso e seguro
   porque configureRender NUNCA roda no boot (so por setNumPlayers/joinPlayer/restartGame). Os quatro `let`
   (vpTex/vpSpr/vpFrames/vpDots) FICAM aqui, porque viewports/viz-setters/draw ja os leem por getter — dai o
   ctx trazer o par getter+setter de cada um, em vez de o modulo ser dono dos arrays. */
const screenPipeline = initScreenPipeline({
  RenderTexture: PIXI.RenderTexture, NEAREST: PIXI.SCALE_MODES.NEAREST,
  criarSprite: (t) => new PIXI.Sprite(t as never), criarDesenho: () => new PIXI.Graphics(),
  stage: app.stage, renderer: app.renderer, camera, // aqui é o `ResizableRenderer` (só `resize`), não a captura
  getNumPlayers: ()=>rodada.numPlayers,
  getVpTex: ()=>vpTex, setVpTex: (a)=>{ vpTex=a; },
  getVpSpr: ()=>vpSpr, setVpSpr: (a)=>{ vpSpr=a; },
  getVpFrames: ()=>vpFrames, setVpFrames: (g)=>{ vpFrames=g; },
  getVpDots: ()=>vpDots, setVpDots: (a)=>{ vpDots=a; },
  setMinimapVisible, buildGameHud: ()=>buildGameHud(),
  applyVpFilters: ()=>applyVpFilters(), updateVpDots: ()=>updateVpDots(), // LAZY: consts de viz-setters (TDZ)
});
function configureRender(){ screenPipeline.configureRender(); }

// E5: minimapa estilo Metroid (canto inferior esquerdo, fixo na tela, fog-of-war)
initMinimap(app.stage, WORLD_W, WORLD_H); // render/minimap (Estágio 4, Tier 1): container + fog-of-war (markSeen/redrawMinimapIfDirty/drawMinimapPlayer/resetMinimap/setMinimapCorner/…)
buildGameHud(); // HUD por jogador no init (single-screen; configureRender só roda ao trocar nº de telas)

/* ===================== física (por jogador — E11) -> game/physics.ts (B1) =====================
   sampleFeatures/resolveX/resolveY/triggerLava e o CORPO de fisica do stepPlayer moram no modulo, ancorados
   nos 600 quadros de tests/fixtures/physics-golden.json. O QUE FICA aqui e a outra metade do stepPlayer:
   coleta de moeda, quiz, power-ups, chave/portao e a animacao do sprite — dependem de MODE, coins, powerups,
   gate e texturas, que sao render/estado do monolito.
   `dir` e a unica variavel local que atravessa a fronteira, e por isso stepPlayer devolve {ran, dir}:
   `ran:false` reproduz o return seco de quiz/quit/waiting, que abortava a funcao INTEIRA, animacao inclusive. */
initPhysics({
  getPlayers: () => rodada.players,
  isWheelchair: ()=>wheelchair, isModoCego: ()=>modoCego, caneOn, WORLD_PX_H: ()=>WORLD_PX_H,
  sfx: (n)=>earcons.sfx(n), srSay, srAlert, hideTips, showPower, nav,
  tonePan, noiseHit, surfaceUnder,
  puffDust, setSquash, addShake, addHitstop, POWER_MSG,
  coinPools: ()=>coinPools(), rebuildCoins, updateHud,
});
// `GamePlayer` e não `Player`: as três chamadas abaixo — física, coleta e animação — leem `quiz`, e `quiz`
// é do JOGO (ADR-0033). Declarar o tipo da engine aqui obrigava cada uma delas a um cast, e era o mesmo
// defeito do `modalInput`: a assinatura contradizendo o que a função faz na primeira linha.
function stepPlayer(pl: ControlledGamePlayer,dt: number){
  const _p=stepPhysics(pl,dt); if(!_p.ran)return; const dir=_p.dir; // fisica em game/physics.ts
  sessionApi.collectFor(pl); // moeda/quiz, power-up/chave e portao -> game/session.ts (C2)
  // E15/E16/E17/E19/E20: a escolha do quadro (decisao PURA em render/player-anim.ts) e a aplicacao dela no
  // sprite (com o recolor do modo de visao) moram em render/draw.ts (C1). `dir` vem da fisica, acima.
  drawApi.animatePlayer(pl,dt,dir);
}
/* ===================== AREA SECRETA: presenca -> revelacao + anuncio -> game/secret-areas.ts (D3-c) =====
   `darkRegions` e const declarado LA EM CIMA e entra por VALOR (o modulo muta gfx.alpha/announced dos
   objetos, nunca troca o array) — por isso este init tem de vir DEPOIS daquela declaracao. `players` entra
   por getter: e a lista viva de core/state.ts, que cresce e encolhe. */
const secretAreas = initSecretAreas({ regions: darkRegions, getPlayers: ()=>players, box: BOX, tile: TILE, srSay });
function update(dt: number){
  if(!fatosDaCena().mundoRodando)return; // E14: congelado no título e na pausa
  if(tickHitstop(dt)) return; // JUICE: hit-stop congela o mundo por alguns ticks
  fxClock+=dt; // clock GERAL de animação (o stepFx não o incrementa mais — extraído p/ render/fx)
  stepFx(dt); // partículas + decaimento de tremor/squash (roda até no fim de jogo → confete da vitória anima)
  attractCtl.stepAttract(dt); // attract: robô/replay dirige o P1 (ANTES da física)
  attractCtl.recordTick(); // ?record=1: grava o P1 (fora da demo, jogando) em localStorage
  life.stepLife(dt); // L5: vida ambiente (pombos/gatos/cães/adultos) — cosmética, atrás do player
  traffic.stepTraffic(dt); // L5: carros (frente, na rua da base) + semáforo
  sceneSky.stepSky(dt); // L5: nuvens + pássaros no céu
  sceneSky.stepV3Decor(); // L6: decoração viva da v3 (estrelas/nuvens/pássaros/névoa/grama/minhocas/vagalumes/borboletas)
  sceneCity.stepTileFx(); // tiles vivos da v3: água (ondas/corais/algas/peixes, FORE) + lava (tracinhos)
  if(rodada.ended)return;
  players.forEach((p,i)=>{ if(p.quit&&p.jumpEdge){ p.jumpEdge=false; respawnPlayer(i); } }); // L1: quem saiu re-entra pelo PULO do teclado (ou START do pad, no pollPads)
  // `controlados()` e não `jogadores()`: a física e a animação leem `ctrl`, e esta é a vista que afirma o
  // que já é verdade aqui — o laço só roda DEPOIS de `assignControls`, então `ctrl` não é mais nulo.
  for(const pl of controlados()) stepPlayer(pl,dt);
  secretAreas.stepSecretAreas(dt); // E1: revela a area secreta enquanto houver jogador dentro, re-escurece ao sair e anuncia (game/secret-areas.ts, D3-c)
}
/* ===================== camera + quadro -> render/draw.ts (C1) =====================
   placeCam, draw e a cauda de animacao do stepPlayer moram no modulo. Aqui fica so o ENVOLUCRO de `draw` —
   declaracao de funcao, portanto icada, porque startLoop e window.__incl o capturam pelo NOME, mais abaixo.
   placeCam NAO ganha envolucro: fora do proprio draw ele nao tinha chamador nenhum.
   O ctx segue a regra da casa: o que o main.js REATRIBUI (vpTex, wheelchair, fxClock, powerups) entra por
   GETTER; camadas, camera e renderer entram por valor. `applySharedTextures` e `const` declarado ABAIXO
   (viz-setters), por isso entra embrulhado numa seta — passado direto, cairia em TDZ e derrubaria o boot. */
const drawApi = initDraw({
  getPlayers: () => players, getNumPlayers: () => rodada.numPlayers,
  camera, renderizarEm: (o, alvo, limpar) => app.renderer.render(o as never, { renderTexture: alvo as never, clear: limpar }),
  BOX, // a caixa do jogador ENTRA (como ja entrava em scene-city/scene-sky/audio-nav), nao e' importada la
  caneLayer, chairLayer, easyHitbox,
  getVpTex: ()=>vpTex, isWheelchair: ()=>wheelchair, getFxClock: ()=>fxClock, getPowerups: ()=>rodada.powerups,
  // OS ITENS DECLARADOS (item 19). O `render/draw` importava `getCoinSprites` de `game/coin-spawning` e
  // `puTaken` de `game/powerups` — as duas ultimas arestas de importacao da engine para o jogo. E trazia
  // junto TRES regras que sao deste jogo: item coletado some, item de outro dono fica esmaecido, e a chave
  // vale para todos enquanto os demais poderes sao por jogador. As tres moram aqui agora.
  getItemSprites: () => getCoinSprites(),
  itemVisibleTo: (j, _i) => !coins[j]?.taken, // `_i`: o item sumir é por ITEM, não por jogador
  itemOwnedBy: (j, i) => coins[j]?.owner === i,
  powerupVisibleTo: (pu, i) => !puTaken(pu, i),
  rm, WORLD_PX_W: ()=>WORLD_PX_W, WORLD_PX_H: ()=>WORLD_PX_H,
  caneOn, updateParallax,
  drawElevators: ()=>drawElevators(elevLayer),
  markSeen, redrawMinimapIfDirty, drawMinimapPlayer,
  applySharedTextures: (viz)=>applySharedTextures(viz),
  renderVpOverlay, playerVizTex,
  updateGameHud: ()=>updateGameHud(),
  playerTextures: ()=>({ idle:TEX_IDLE, walk:TEX_WALK, run:TEX_RUN, jumpUp:TEX_JUMP_UP, jumpDown:TEX_JUMP_DOWN,
    climb:TEX_CLIMB, fly:TEX_FLY, clingWall:TEX_CLING_WALL, clingCeil:TEX_CLING_CEIL,
    swim:TEX_SWIM, swimIdle:TEX_SWIMIDLE, flavors:FLAVORS }),
  held,
});
function draw(){ drawApi.drawFrame(); }

/* ===================== quiz -> game/quiz.ts (B3) =====================
   As 29 funcoes do desafio moram no modulo, em tres camadas: geracao (pura, so RNG), apresentacao
   (string->string) e efeito. Aqui ficam so os ENVOLUCROS — declaracao de funcao, portanto icados, para que
   os chamadores de cima (update, keydown, initGamepad, restartGame, applyLetra, window.__incl) nao mudem.
   respawnFigure NAO foi junto: apesar de colada ao bloco e chamada so pelo quiz, ela re-sorteia a posicao
   da moeda — e do slice de moedas, e entra no quiz por injecao. */
function openQuiz(pl: Parameters<typeof quizApi.openQuiz>[0],coinIndex: number,shapeId: Parameters<typeof quizApi.openQuiz>[2]){ quizApi.openQuiz(pl,coinIndex,shapeId); }
function openSilabas(pl: Parameters<typeof quizApi.openSilabas>[0],coinIndex: number,letter: Parameters<typeof quizApi.openSilabas>[2]){ quizApi.openSilabas(pl,coinIndex,letter); }
function renderQuiz(pl: Parameters<typeof quizApi.renderQuiz>[0]){ quizApi.renderQuiz(pl); }
function closeQuiz(pl: Parameters<typeof quizApi.closeQuiz>[0]){ quizApi.closeQuiz(pl); }
// A INTENCAO chega da engine; QUEM DECIDE o que ela significa e este jogo (ADR-0033). A grade de tres
// colunas e o desvio de Braille moravam dentro do `input/keydown` e do `input/gamepad`, em duas COPIAS —
// que e a pior forma de ter uma regra. Agora ela existe uma vez, aqui, do lado de quem e dono do desafio.
function modalInput(i: number, intent: ModalIntent) {
  const pl = jogadores()[i];
  if (!pl) return; // a guarda que vivia no input/keydown: quem resolve o índice é quem o valida
  if (pl.quiz && pl.quiz.kind === 'braille') {   // cego: cima DITA a cela, confirmar responde. Nada mais anda.
    if (intent === 'up') announceBraille(pl);
    else if (intent === 'confirm') quizConfirm(pl);
    return;
  }
  if (intent === 'left') quizMove(pl, -1);
  else if (intent === 'right') quizMove(pl, 1);
  else if (intent === 'up') quizMove(pl, -3);    // a GRADE e de 3 colunas — e e deste jogo
  else if (intent === 'down') quizMove(pl, 3);
  else if (intent === 'confirm') quizConfirm(pl);
  else if (intent === 'erase') quizErase(pl);
}
const temModal = (i: number) => !!(jogadores()[i] && jogadores()[i].quiz);
function quizMove(pl: Parameters<typeof quizApi.quizMove>[0],d: Parameters<typeof quizApi.quizMove>[1]){ quizApi.quizMove(pl,d); }
function quizConfirm(pl: Parameters<typeof quizApi.quizConfirm>[0]){ quizApi.quizConfirm(pl); }
function quizErase(pl: Parameters<typeof quizApi.quizErase>[0]){ quizApi.quizErase(pl); }
function announceBraille(pl: Parameters<typeof quizApi.announceBraille>[0]){ quizApi.announceBraille(pl); }
function respawnFigure(i: number){
  const occ=new Set(); coins.forEach((c,j)=>{ if(j!==i)occ.add(c.x+','+c.y); });
  for(const cand of shuffle(findCoinCandidates())){ const x=cand.tx*TILE+3,y=cand.ty*TILE+3;
    if(!occ.has(x+','+y)){ coins[i].x=x;coins[i].y=y;coins[i].taken=false; // dono (owner) preservado
      const s=getCoinSprites()[i]; s.x=(MODE()==='somasub')?x-3:x; s.y=(MODE()==='somasub')?y-3:y; s.visible=true; return; } }
}

/* ===================== vitória ===================== */
/* ===================== rodada -> game/session.ts (C2) =====================
   updateHud/win/restartGame, setMode, o numero de telas (setNumPlayers/fitsN/isMobile/activateScreens), a vida
   de UM jogador (resetPlayerState/respawnPlayer/joinPlayer), o abandono (releaseKey/quitGame) e o BLOCO DE
   COLETA que morava dentro do stepPlayer moram no modulo. Aqui ficam so os ENVOLUCROS — declaracao de funcao,
   portanto icados, porque os chamadores estao ACIMA: initPhysics captura `updateHud`, o keydown de Alt+1..4
   chama `activateScreens`, update() chama `respawnPlayer` e initActivitiesMenu captura isMobile/fitsN/
   setNumPlayers/restartGame. resetPlayerState e releaseKey NAO ganham envolucro: fora do modulo nao tinham
   chamador nenhum. MODE_LABELS/MODES desceram junto e voltam por import: eram `const` declarados ABAIXO deste
   ponto, e passa-los por valor cairia em TDZ no boot.
   O ctx segue a regra da casa: o que o main.js REATRIBUI (MODE, collected, ended, powerups, gate, gateOpen,
   pauseActor, ownerColors, captionsOn, player) entra por GETTER/SETTER; PCOLOR, darkRegions e os callbacks
   estaveis entram por valor. `reapplyVizAll` e `const` declarado ABAIXO (viz-setters), por isso vem embrulhado
   numa seta — passado direto, cairia em TDZ e derrubaria o boot. */
const sessionApi = initSession({
  getPlayers: () => players, getNumPlayers: () => rodada.numPlayers, setNumPlayers: (n) => rodada.setNumPlayers(n),
  $, librasReserve: ()=>0, // o intérprete NÃO empurra mais a tela (ver ui/vlibras + ui/layout); fica p/ o overlay sob demanda
  isCoarsePointer: ()=>{ try{ return matchMedia('(pointer:coarse)').matches && matchMedia('(hover:none)').matches; }catch(e){ return 'ontouchstart' in window; } },
  getMode: ()=>MODE(), // sem `setModeValue`: o MODE deriva de `activity` e não tem caminho de escrita (ADR-0040)
  setEnded: (v) => rodada.setEnded(v),
  getPowerups: ()=>rodada.powerups, getGate: ()=>rodada.gate, isGateOpen: ()=>rodada.gateOpen,
  setGateOpen: (v) => rodada.setGateOpen(v),
  getPauseActor: ()=>rodada.pauseActor, ownerColors: ()=>ownerColors, captionsOn: ()=>captionsOn,
  // `setPlayerRef` SAIU: o `let player` que ele reatribuía era sempre `players[0]`, e `players[0]` não
  // muda de identidade — nem quando o array cresce nem quando encolhe (n ≥ 1 sempre). A dança de
  // referência vinha do monólito e não movia nada. Agora é derivado, como o MODE (ADR-0040).
  PCOLOR, darkRegions, getPlayerRef: ()=>jogadores()[0]!,
  srSay, srAlert, narrate: (t)=>tts.narrate(t),
  sfx: (n)=>earcons.sfx(n), doorSound: (m)=>earcons.doorSound(m), playVictory: ()=>jingles.playVictory(),
  showCaption,
  burstSparkle, addShake, addHitstop, rnd,
  POWER_MSG,
  coinPools: ()=>coinPools(), setupExtras, rebuildExtras, resetMinimap,
  // A PONTE ENTRE DUAS VISTAS QUE NÃO SE FALAM. `game/session` declara o que ELE lê do jogador
  // (`SessionPlayer`) e `game/quiz` declara o que ELE lê (`QuizPlayer`). O objeto que atravessa é o mesmo
  // `GamePlayer`, e as duas são DESCRIÇÕES PARCIAIS dele — o `session` aqui só REPASSA um jogador que não
  // interpreta, e declarar uma vista para um valor repassado é o que produz o conflito.
  //
  // ⚠️ O `as` NÃO CONSERTA O ERRO, e está aqui de propósito: ele troca um erro que ENGANA ("SessionPlayer
  // não é QuizPlayer", que soa como vista mal escolhida) por um que APONTA A CAUSA ("GamePlayer não é
  // QuizPlayer, porque `PlayerQuiz` não é `Quiz`"). O defeito real é que `game/entity` redescreve como
  // `PlayerQuiz` o que `game/quiz` já possui como união `Quiz` — issue #79, mesmo formato do #78.
  openQuiz: (pl,i,sh)=>openQuiz(pl as GamePlayer,i,sh),
  openSilabas: (pl,i,l)=>openSilabas(pl as GamePlayer,i,l),
  closeQuiz: (pl)=>closeQuiz(pl as GamePlayer),
  loadPlayerA11y, assignControls, ensureSprites, configureRender,
  reapplyVizAll: ()=>reapplyVizAll(), layout, hideTouchControls, updateGameHud,
  voltarAoTitulo: () => setPhase('title'), entrarNoJogo: () => setPhase('playing'),
  titleShowMain: () => titleUI.show('tm-main'), // qual submenu é decisão da casca, não do jogo
});
function updateHud(){ sessionApi.updateHud(); }
// Os invólucros que só REPASSAM tomam o tipo do delegado. O passe mecânico tinha posto `Player` neles pela
// tabela de nomes, enquanto os OUTROS parâmetros dos mesmos invólucros já usavam `Parameters<>` — a
// inconsistência era minha, e é ela que produzia metade dos conflitos `XPlayer` ↔ `Player`.
function win(pl: Parameters<typeof sessionApi.win>[0]){ sessionApi.win(pl); }
function restartGame(){ sessionApi.restartGame(); }
function setNumPlayers(n: number){ sessionApi.setNumPlayers(n); }
function fitsN(n: number){ return sessionApi.fitsN(n); }
function isMobile(){ return sessionApi.isMobile(); }
function activateScreens(n: number){ sessionApi.activateScreens(n); }
function respawnPlayer(k: Parameters<typeof sessionApi.respawnPlayer>[0]){ sessionApi.respawnPlayer(k); }
function joinPlayer(padIdx: Parameters<typeof sessionApi.joinPlayer>[0]){ return sessionApi.joinPlayer(padIdx); }
function quitGame(){ sessionApi.quitGame(); }
$('#btn-again')?.addEventListener('click',()=>{ restartGame(); $('#game-region')?.focus(); });
/* ===================== ATIVIDADES (menu inicial) -> ui/activities-menu.ts =====================
   O menu do titulo, a escolha de atividade e o inicio da partida moram no modulo. Fica aqui so a
   composicao: MODE entra como ATRIBUICAO NUA (setMode() tambem reinicia a rodada e move o foco, que
   nao e o que escolher atividade faz), e CENARIOS entra reduzido a {id,nome} — o resto e dado de
   textura de parallax e nao tem o que fazer dentro de um menu. */
if(!isValidActivityId(ACTIVITY)) setActivityValue(DEFAULT_ACTIVITY_ID); // valida o valor inicial contra o catalogo
const activitiesMenu = initActivitiesMenu({
  getPlayers: () => players, getNumPlayers: () => rodada.numPlayers,
  $, getActiveElement: () => document.activeElement, srSay, srAlert,
  titleShow: titleUI.show,
  cenarios: Object.keys(CENARIOS).map(c => ({ id: c, nome: CENARIOS[c].nome })),
  setCenario,
  getActivityId: () => ACTIVITY, setActivityId: setActivityValue, // estado do JOGO, entregue pela raiz
  setQuizLevel, isMobile, fitsN, setNumPlayers, restartGame, setPhase, hideTips,
  enterFullscreen: () => { try{ const el=document.documentElement, rf=el.requestFullscreen||el.webkitRequestFullscreen; if(rf)rf.call(el); }catch(e){} },
});
// Só o que a raiz de fato usa. `startActivity`, `reallyStart`, `titleButtons`, `buildTitleMenus` e
// `menuItems` saíram em 2026-08-26: eram desestruturados e nunca lidos — resto da migração para
// `ui/activities-menu`, que hoje os chama por dentro. `noUnusedLocals` os encontrou.
const { actCat, setActivity, navTitle, tabSel, fracNot } = activitiesMenu;
// B3: o desafio educativo. So entra aqui o que um import nao alcanca: as `let` do main.js, as instancias
// criadas no boot (audio/HUD/menu) e os efeitos de outros slices (moeda, HUD, vitoria, toque). Os
// callbacks sao arrows de proposito: touchCtl, respawnFigure, win e updateHud nascem mais abaixo.
const quizApi = initQuiz({
  $, getScreen: (i) => hud.getScreen(i),
  getNumPlayers: () => rodada.numPlayers,
  disp, isModoCego: () => modoCego,
  actCat, tabSel, fracNot, QL_NAME,
  srSay, srAlert, gameSay, narrate: (t) => tts.narrate(t),
  sfx: (n) => earcons.sfx(n), playPuzzleSolved: () => jingles.playPuzzleSolved(),
  burstSparkle,
  hideTouchControls: () => hideTouchControls(),
  updateHud: () => updateHud(), win: (pl) => win(pl),
  respawnFigure: (i) => respawnFigure(i),
});
// fmtFrac/fracGraphic/fracSpeak/speakChoice + _pieUnit/_sqGrid/FRAC_GFX extraidos p/ game/fractions.js (Estagio 4).
// fmtFrac/fracGraphic/fracSpeak/speakChoice + _pieUnit/_sqGrid/FRAC_GFX extraídos p/ game/fractions.js (Estágio 4).
// O `#opt-mode` SAIU (ADR-0040). Ele ciclava o MODE sem tocar em `activity` — era o segundo caminho de
// escrita, e o que a issue #54 reproduziu. Com o MODE derivado ele não teria o que ciclar. Era superfície
// de depuração, dentro de `#topbar-tools hidden`, revelada só por `?debug=true`; quem troca de atividade é
// o menu de atividades, que grava `activity` e reinicia a rodada — e o MODE segue sozinho.
// Mapa padrão (Gamepad API "standard"): 0=pulo/sim · 1=especial/não · 2=correr/interagir (X/esquerda) · 3=troca ·
// D-pad 12-15 + analógico esq. · RB/RT também correm · 9=START (pausa). Controles fora do padrão → wizard de mapeamento.
// Direções pelas FONTES PADRÃO (stick 0/1, D-pad botões 12-15, POV hat em eixos altos ≥6): o controle tem
// DOIS direcionais — quem mapeou só o stick continua com o D-pad vivo (menus!) e vice-versa.
// stdDirs/padActions/pollPads + o assistente de mapeamento inteiro migraram para input/gamepad.ts (Onda A).
// A Gamepad API entra como ADAPTADOR (getGamepads), que e o que torna o assistente testavel sem navegador.
// spriteBase e dependencia DECLARADA: era o `SPR` que o main.js usava como se fosse global e derrubava o
// assistente ao abrir (ver o commit de correcao).
const gamepadApi = initGamepad({
  getGamepads: () => (navigator.getGamepads ? navigator.getGamepads() : []), $, srSay, srAlert, frontOverlay,
  mundoRodando: () => fatosDaCena().mundoRodando, menuDePausa: () => fatosDaCena().menuDePausa,
  pausar: () => setPhase('paused'), retomar: () => setPhase('playing'),
  isAttractActive: () => attractCtl.isAttract(), stopAttract: () => attractCtl.stopAttract(),
  isTouchMode: () => document.body.classList.contains('touch-mode'), hideTouchControls: () => hideTouchControls(),
  getPlayers: () => players, getNumPlayers: () => rodada.numPlayers,
  navTitle, sharedDialogOpen, navDialog, getPauseMenu: (i) => vpPause[i], navPause,
  // O modo `accessibility` do ADR-0044 (item 7): o direcional dirige a barra rapida em vez do personagem.
  naBarraDe: (i) => pauseIcons.naBarraDe(i),
  navBar: (i, k, temStart) => pauseIcons.navBar(i, k, temStart),
  setPauseActor: (i) => rodada.setPauseActor(i),
  modalInput, hasModal: temModal,
  joinPlayer, respawnPlayer,
  clearWaitingBadge: (i) => hud.clearWaitingBadge(i),
  spriteBase: SPR,
});
// Desconectar NÃO abandona o jogo: o teclado é sempre fallback. Só solta a associação do pad.
addEventListener('gamepaddisconnected',(e)=>{ try{ const owner=players.findIndex(p=>p.pad===e.gamepad.index);
  if(owner>=0){ players[owner].pad=-1; srAlert(t('sr.pad.disconnected',{n:owner+1})); }
  delete padCur[e.gamepad.index]; }catch(err){} });

/* ===== L1: wizard de mapeamento de gamepad (DirectInput e controles fora do padrão) =====
   Captura botões por índice; analógicos como limiar por eixo/sinal ({ax,s}); D-pad "POV hat" do
   DirectInput como VALOR de eixo ({av,v}, casamento por proximidade ±0.13 — os 8 passos do hat
   distam ~0.286). Mapa salvo por gamepad.id em localStorage → vale p/ aquele modelo de controle. */
// O assistente de mapeamento (padMapFor/bindActive/padWiz*/PADWIZ_STEPS + a fiacao do #padwiz-cancel)
// migrou inteiro para input/gamepad.ts (Onda A).

const optTelasBtn=$('#opt-telas'); // botão único: cicla 1→2→3→4 telas
// Pelo activateScreens, e nao pelo setNumPlayers cru: o botao e o Alt+N sao o MESMO pedido por dois caminhos,
// e so um deles checava se as telas cabem. Pelo botao dava para pedir 2 telas numa janela pequena e o canvas
// saia pela borda, cortado. Vem junto a recusa no celular (1 tela, decisao registrada) e o crescer sem
// reiniciar a rodada — quem entra, entra no jogo em andamento. O anuncio agora e do proprio activateScreens.
if(optTelasBtn)optTelasBtn.addEventListener('click',()=>{ activateScreens((rodada.numPlayers%4)+1); });
// Botão único de LETRAS: ABC (padrão) → abc → Braille
// L3: nível do quiz de alfabetização (1..5), persistido; rótulo vivo nos menus de pausa
function setQuizLevel(n: number, announce: boolean){ setQuizLevelValue(n); // core/state.js: clampa 1..5, persiste e emite; a reflexão de UI fica aqui
  // `QL_NAME` atravessa por PARAMETRO e NAO vira chave: sao os niveis da psicogenese de Ferreiro, e o pilar 3
  // do ADR-0010 diz que curriculo de alfabetizacao nao se traduz — reescreve-se por idioma. A moldura traduz.
  document.querySelectorAll('.pm-nivel').forEach(x=>{ x.textContent=t('pause.level',{n:quizLevel,v:QL_NAME[quizLevel]}); });
  if(announce) srSay(t('sr.quiz.levelSet',{n:quizLevel,v:QL_NAME[quizLevel]})); } // QL_NAME é CURRÍCULO: atravessa sem traduzir
// A TABELA `LETRA` E O CICLO MORRERAM (ADR-0028). Eram duas posições — ABC/abc — num botão da pausa, e a
// caixa da letra virou UMA escolha dentro do menu de Comunicação Aumentada e Alternativa, ao lado dos
// conjuntos de pictogramas. Um ciclo de duas posições não comporta nove opções, e o motivo de o menu existir
// é que para algumas crianças o pictograma É a escrita.
//
// `applyLetra` fica, sem a parte que era do ciclo: ela REFLETE a escolha no jogo (re-render do quiz, moedas
// do modo sílabas, rótulo do atalho). Quem MUDA agora é o painel; quem ANUNCIA também é ele, com o nome do
// conjunto escolhido — daí o `announce` sair daqui.
function applyLetra(){
  // O DOM (menus, HUD, legendas) via CSS; a canvas via `disp()`, que a PIXI usa ao desenhar. São dois caminhos
  // de texto no jogo, e o botão só ligava um deles — daí "letras maiúsculas" não alcançar os menus.
  document.documentElement.dataset.letras = letterCase;
  if(typeof rebuildCoins==='function' && MODE()==='silabas') rebuildCoins();
  jogadores().forEach(p=>{ if(p.quiz)renderQuiz(p); }); // L3: re-renderiza o quiz de quem estiver num
}
applyLetra(); // estado inicial: reflete a caixa persistida no atributo que o CSS lê
function setLetterCaseAndApply(c: Parameters<typeof setLetterCaseValue>[0]){ setLetterCaseValue(c); applyLetra(); }
const optLetraBtn=$('#opt-letra'); if(optLetraBtn)optLetraBtn.addEventListener('click',()=>{ caa.open(); });
// E9: toggles de Som / Legendas / Fácil
const soundBtn=$('#opt-sound'), capBtn=$('#opt-captions');
// REFLETE O VALOR PERSISTIDO no boot. O markup do #opt-captions crava `is-on`/`aria-pressed="true"`, e isso
// era correto por acidente enquanto `captionsOn` sempre nascia ligado. Com a persistência do ADR-0028 o markup
// passou a poder mentir: a criança desliga as legendas, recarrega, e o botão diz que estão ligadas enquanto
// elas não estão — o pior estado possível para um controle de acessibilidade, porque quem depende dele não
// tem como desempatar. Acrescentar persistência a um valor expõe todo lugar que presumia o padrão.
if(capBtn) toggleBtn(capBtn, captionsOn);
if(soundBtn){ soundBtn.setAttribute('aria-haspopup','dialog'); soundBtn.addEventListener('click',openAudio); } // botão de áudio agora abre o mixer
if(capBtn) capBtn.addEventListener('click',()=>{ setCaptionsOnValue(!captionsOn); toggleBtn(capBtn,captionsOn); srSay(t(captionsOn?'sr.captions.on':'sr.captions.off')); });
const motor = initSettingsMotor({ $, srSay, store, players, getNumPlayers: () => rodada.numPlayers, setToggleMove, rebuildCoins }); // painel motor: ui/settings-motor.ts (registra #opt-facil, #opt-altmove e as abas)

/* Modos de visualização: Normal + Alto contraste + simulações/correções. A FABRICA (parallaxTexFor,
   treeTexFor, playerVizTex, pixiFilterFor, o overlay de baixa visao e as matrizes CVD) migrou para
   render/viewports.ts (B2); a POLITICA ja estava em render/viz-setters.ts (Onda A). */
// (`vpDot` saiu em 2026-08-26: era um `PIXI.Graphics` construído no boot e nunca usado — as bolinhas de
//  viewport são criadas por `render/screen-pipeline`. Objeto alocado que ninguém desenha.)
const lvOverlaySpr=new PIXI.Sprite(PIXI.Texture.EMPTY);
// _playerDirect/playerVizTex migraram para render/viewports.ts (B2).
/* ===================== MODOS DE VISAO ACESSIVEL -> render/viz-setters.ts =====================
   Saiu a POLITICA (qual modo vale onde); a FABRICA (como um modo vira pixel) ja mora em
   render/viewports.ts, extraida no B2. _lastSharedViz fica: nao e cache de visao, e o registro
   de qual modo o pipeline estatico aplicou por ultimo, escrito de sete lugares.
   Init AQUI porque empathy/visual recebem renderVizGroup/setPlayerViz POR REFERENCIA logo abaixo, e
   declaracao icada virou const. Tudo no ctx e arrow preguicosa: nada e avaliado no init. */
const viz = initVizSetters({
  $, body: document.body, srSay,
  // `aplicarFiltroCss` no lugar de `app`: o `view.style` do PixiJS e `ICanvasStyle`, que nem TEM `filter`
  // (ele existe para a OffscreenCanvas, onde nao ha CSS). Em producao o `view` e uma canvas do DOM de
  // verdade — e saber disso e trabalho da raiz, nao do `viz-setters`.
  // DUAS SUPERFÍCIES, e é a raiz que sabe quais são: a canvas (o mundo) e o `#dom-layer` (os menus).
  // MELHORIA cai nas duas; EMPATIA só no mundo — e o menu, que é o instrumento de sair da simulação, fica
  // legível. Ver `AlcanceDoFiltro` em `render/port` e a issue #82.
  aplicarFiltroCss: (css, alcance) => {
    const v = app.view as unknown as HTMLCanvasElement | null;
    if (v && v.style) v.style.filter = css;
    const dom = $<HTMLElement>('#dom-layer');
    if (dom) dom.style.filter = alcance === 'mundo-e-menus' ? css : '';
  },
  aplicarAltoContrasteNoDom: (ligado) => { const d = $<HTMLElement>('#dom-layer'); if (d) d.classList.toggle('hc', ligado); },
  camera, worldSprite, parallaxLayers, decoSprites,
  getVpSpr: () => vpSpr, getVpDots: () => vpDots,
  getItemSprites: getCoinSprites, itemTexId: 'coin', // item 19: o NOME dos itens e do jogo, nao do render
  getPowerups: () => rodada.powerups,
  getPlayers: () => players, getNumPlayers: () => rodada.numPlayers,
  getSelVizPlayer: () => rodada.selVizPlayer, setSelVizPlayer: (i) => rodada.setSelVizPlayer(i),
  getSharedViz: () => _lastSharedViz, setSharedViz: (m) => { _lastSharedViz = m; },
  invalidateSharedViz: () => { _lastSharedViz = null; },
  parallaxTexFor, treeTexFor, playerVizTex, pixiFilterFor,
  clearPlayerDirectCache: vp.clearPlayerDirectCache,
  setFrontDim: (on) => traffic.setFrontDim(on),
  rebuildExtras: () => rebuildExtras(), rebuildCoins: () => rebuildCoins(),
  setModoCego: (on) => setModoCego(on),
  hideTouchControls: (r) => hideTouchControls(r),
  reflectVizButtons: () => reflectVizButtons(),
  renderVisualPanel: () => visual.render(), renderEmpathyPanel: () => empathy.render(),
});
// `updateVizIndicator` saiu: desestruturado e nunca lido desde que migrou para `render/viz-setters`.
const { applySharedTextures, updateVpDots, applyVpFilters, setPlayerViz,
        applyVizGlobal, reapplyVizAll, renderVizGroup } = viz;
const _rebakeDirect = viz.rebakeDirect;
// renderVpOverlay migrou para render/viewports.ts (B2).
// updateVpDots/applyVpFilters migraram para render/viz-setters.ts (Onda A).
// O ESTADO mora em core/state (setModoCegoValue: grava, persiste, avisa). Aqui ficam só os EFEITOS — refazer
// os extras do nível, refletir o painel, anunciar —, que são reação e pertencem ao composition root. A guarda
// de igualdade também está no setter: se o valor não mudou, ele não avisa e nada disto roda.
function setModoCego(on: boolean){ const antes=modoCego; setModoCegoValue(on); if(modoCego===antes)return;
  // A guarda que estava aqui — `typeof reflectModoCego==='function'` — testava um nome LIVRE que não existe
  // neste arquivo desde que a função saiu para `ui/settings-audio`. E `typeof` sobre identificador não
  // declarado devolve 'undefined' em vez de lançar, então ela virou SEMPRE falsa e ninguém percebeu.
  // É a gêmea exata do bug do `reflectTTS` já documentado no ctx de `pause-icons` acima, e o sintoma é o
  // mesmo: ligar o modo cego pelo ícone da pausa ou pela simulação de cegueira deixava o `#opt-modocego`
  // dizendo 'Desligado' com aria-pressed=false — o controle mentindo o estado para o leitor de tela.
  // A do `setupExtras` sai junto: é declaração de função hoisted (linha 677), a guarda é sempre verdadeira.
  // `audioPanel` é const bem abaixo (1418), e o corpo desta função só roda por interação — nenhum caminho
  // de boot a chama: `loadPlayerA11y` escreve `p.viz` DIRETO, sem passar por `setPlayerViz`.
  setupExtras(); audioPanel.reflectModoCego();
  srSay(t(on?'sr.blind.on':'sr.blind.off')); }
// setPlayerViz/applyVizGlobal migraram para render/viz-setters.ts (Onda A).
const caa = initSettingsCaa({ $, srSay, frontOverlay, fillExplain: (c)=>overlays.fillExplain(c), restoreFocus: (id)=>overlays.restoreFocus(id),
  getLetterCase: () => letterCase, setLetterCase: setLetterCaseAndApply }); // 7º menu (ADR-0028): ui/settings-caa.ts
const empathy = initSettingsEmpathy({ $, srSay, store, renderVizGroup, reflectMotorEmpathy, reflectVizButtons, frontOverlay, restoreFocus: (id)=>overlays.restoreFocus(id), setHearingLoss, setOneButton, setWheelchair, getOneButton: () => oneButton, getWheelchair: () => wheelchair, getPlayers: () => players, setPlayerViz }); // painel de empatia: ui/settings-empathy.ts (registra #opt-empathy, #opt-hearing, #opt-onebtn, #opt-wheelchair + restaura o grafo de audio)
// updateVizIndicator/reapplyVizAll migraram para render/viz-setters.ts (Onda A).
// Simulações de empatia: o predicado mora em render/viz-modes (simulatesDisability), fonte única. A cópia
// local respondia pelo `kind` e contava as 3 correções de daltonismo como simulação (#60); `VIZ_SIM`, derivada
// dela, era declarada e nunca lida — a terceira cópia do mesmo erro, e morta.
// renderVizGroup migrou para render/viz-setters.ts (Onda A).
function setOwnerColors(on: boolean){ const antes=ownerColors; setOwnerColorsValue(on); if(ownerColors===antes)return;
  rebuildCoins(); srSay(t(ownerColors?'sr.visual.ownerColorsOn':'sr.visual.ownerColorsOff')); }
function setCbSafe(on: boolean){ const antes=cbSafe; setCbSafeValue(on); if(cbSafe===antes)return;
  const src=cbSafe?PCOLOR_CB:PCOLOR_DEF; PCOLOR.length=0; src.forEach(c=>PCOLOR.push(c)); // troca IN-PLACE (todos referenciam PCOLOR)
  rebuildCoins(); ensureSprites(); srSay(t(cbSafe?'sr.visual.cbSafeOn':'sr.visual.cbSafeOff')); }
function setRoleColor(k: HcRoleKey, hex: string){ const rgb=hexRgb(hex); if(!rgb||!HC_ROLE[k])return; HC_ROLE[k]=rgb; saveHcRole();
  _rebakeDirect(); rebuildExtras(); srSay(t('sr.visual.roleColorSet',{v:ROLE_LABELS[k]})); } // ROLE_LABELS ainda é pt-BR
function resetRoleColors(){
  // `for…in` devolve `string`, e HC_ROLE é `Record<HcRoleKey, …>` — o `as` cobre uma limitação do TS ao
  // enumerar chaves, não uma dúvida sobre o dado. O `.slice()` continua sendo o que impede o reset de
  // APONTAR para o array de padrões em vez de copiá-lo, e é a razão de ele existir.
  for (const k of Object.keys(HC_ROLE_DEF) as HcRoleKey[]) HC_ROLE[k] = HC_ROLE_DEF[k].slice() as [number, number, number];
  saveHcRole();
  _rebakeDirect(); rebuildExtras(); visual.render(); srSay(t('sr.visual.roleColorsReset')); }
// Dois contornos configuráveis (1º plano personagem/itens · 2º plano perímetro de plataforma/água/lava).
// _rebakeDirect migrou para render/viz-setters.ts (Onda A) como viz.rebakeDirect.
// A tabela ['nenhum','fino','grosso'] estava escrita DUAS vezes, uma em cada função, para o mesmo trio de
// espessuras — e em pt-BR fixo. Virou chave i18n indexada pelo próprio nível.
const OUTLINE_KEY=['outline.none','outline.thin','outline.thick'];
function setOutlineFg(v: number){ const antes=hcOutlineFg; setOutlineFgValue(v); if(hcOutlineFg===antes)return;
  _rebakeDirect(); visual.render(); srSay(t('sr.visual.outlineFg',{v:t(OUTLINE_KEY[hcOutlineFg])})); }
function setOutlineBg(v: number){ const antes=hcOutlineBg; setOutlineBgValue(v); if(hcOutlineBg===antes)return;
  _rebakeDirect(); visual.render(); srSay(t('sr.visual.outlineBg',{v:t(OUTLINE_KEY[hcOutlineBg])})); }
const visual = initSettingsVisual({ $, srSay, renderVizGroup, getPlayers: () => players, getNumPlayers: () => rodada.numPlayers, getVisualSettings: () => ({ lq: getLqT(), ownerColors, cbSafe, outlineFg: hcOutlineFg, outlineBg: hcOutlineBg, roleColors: HC_ROLE }), getSelectedPlayer: () => rodada.selVizPlayer, setSelectedPlayer: (i) => rodada.setSelVizPlayer(i), setPlayerViz, setLq, setOwnerColors, setCbSafe, setOutlineFg, setOutlineBg, setRoleColor, resetRoleColors }); // painel visual: ui/settings-visual.ts
function reflectVizButtons(){ const help=players.some(p=>{const m=VIZ_BY_KEY[p.viz];return m&&m.kind==='hcnew';});
  const sim=players.some(p=>simulatesDisability(p.viz));
  const bv=$('#opt-visual'); if(bv)bv.classList.toggle('is-on',help); const be=$('#opt-empathy'); if(be)be.classList.toggle('is-on',sim||hearingLoss||oneButton||wheelchair); }
// "tela = canvas": reparenta os diálogos de a11y para dentro do #game-region (ficam presos ao canvas)
// e empilha o último aberto por cima (z crescente). frontOverlay é chamado em cada open*.
// _ovZ/fillExplain/frontOverlay migraram para ui/settings-panel.ts (B4).
(function inCanvasMenus(){ const gr=document.getElementById('game-region'); if(!gr)return;
  // NENHUMA tela fora do canvas (decisão definitiva do José — splash incluso). A regra agora é ESTRUTURAL:
  // todo `.overlay` que ainda esteja fora do #game-region entra. Era uma lista de 11 ids escrita à mão, e ela
  // já tinha esquecido DOIS — o menu de CAA, que por isso abria do tamanho da janela em vez do tamanho do
  // jogo, e o #win-overlay, que nunca esteve na lista. Uma lista que precisa ser lembrada esquece em silêncio:
  // não há erro, só uma tela no lugar errado, e ninguém liga uma coisa à outra.
  // O alvo é a CAMADA DOM, não o `#game-region`: é ela que recebe o filtro de acessibilidade (issue #82), e
  // um modal que ficasse fora dela seria o único pedaço de menu sem correção de daltonismo. A regra segue
  // ESTRUTURAL — `.overlay`, não uma lista de ids —, que é o que impediu os dois esquecimentos de antes.
  const camada=document.getElementById('dom-layer')||gr;
  document.querySelectorAll('.overlay').forEach(el=>{ if(!camada.contains(el))camada.appendChild(el); });
  // Botões puramente on/off viram TOGGLE (switch) — o texto "Ligado/Desligado" fica oculto (font-size:0).
  ['opt-facil','opt-altmove','opt-hearing','opt-onebtn','opt-wheelchair','opt-modocego','opt-tts','opt-eyes','audio-master','opt-captions','motion-master'].forEach(id=>{ const b=document.getElementById(id); if(b)b.classList.add('switch'); });
})();
function openVisual(){ const ov=$('#visual'); if(!ov)return; visual.render(); ov.hidden=false; frontOverlay(ov); const f=ov.querySelector<HTMLElement>('button[data-viz]')||ov.querySelector('button'); if(f)f.focus(); }
// Foco de volta para QUEM ABRIU (WCAG 2.4.3), pelo registro de ui/settings-panel. Antes cada um focava um
// `#opt-*` fixo, e SEIS desses nove ids nao existem no documento — sao ganchos de uma barra de botoes futura.
// O `if(b)b.focus()` engolia isso calado, entao o foco caia no <body> e quem navega por teclado voltava ao
// comeco da pagina. Recuo: o dialogo que ficou por baixo.
function closeVisual(){ const ov=$('#visual'); if(!ov)return; ov.hidden=true; if(!overlays.restoreFocus('visual'))menuFocus(sharedDialogOpen()); }
const visualBtn=$('#opt-visual'); if(visualBtn)visualBtn.addEventListener('click',openVisual);
const visualClose=$('#visual-close'); if(visualClose)visualClose.addEventListener('click',closeVisual);
// Empatia motora: um-botão e cadeirante
function reflectMotorEmpathy(){ const a=$('#opt-onebtn'); if(a){ toggleBtn(a,oneButton); a.textContent=toggleLabel(oneButton); }
  const b=$('#opt-wheelchair'); if(b){ toggleBtn(b,wheelchair); b.textContent=toggleLabel(wheelchair); } reflectVizButtons(); }
// Estado em core/state; aqui só os EFEITOS (refletir o painel, anunciar). Mesma forma que setModoCego.
function setOneButton(on: boolean){ const antes=oneButton; setOneButtonValue(on); if(oneButton===antes)return;
  reflectMotorEmpathy(); srSay(t(on?'sr.motor.oneButtonOn':'sr.motor.oneButtonOff')); }
// Estado em core/state; aqui a REAÇÃO, que neste caso é grande: o modo cadeirante refaz a geometria do
// nível inteiro. Por isso ele não caberia dentro de um setter — e por isso o setter não o conhece.
function setWheelchair(on: boolean){ const antes=wheelchair; setWheelchairValue(on); if(wheelchair===antes)return;
  players.forEach(p=>{ if(on && p.activePower!=='fly' && p.activePower!=='turbo') p.activePower='off'; if(on) p.owned=p.owned.filter(k=>k==='fly'||k==='turbo'); showPower(p); });
  setupExtras(); rebuildCoins(); buildWcGeom(); buildRamps(); buildElevators(); reflectMotorEmpathy(); // só voo/super-corrida; moedas no chão; escada/trampolim viram elevador; rampas+pontes; lava vira chão
  srSay(t(on?'sr.motor.wheelchairOn':'sr.motor.wheelchairOff')); }
// bolinha indicadora: duplo toque/clique → volta às cores normais (em cegueira é a única saída visível)
(function vizIndicator(){ const el=$('#viz-indicator'); if(!el)return; let last=-9999;
  // `agora` e não `t`: o local chamava-se `t` e SOMBREAVA o tradutor — `t('sr.visual...')` virou "chamar um
  // número". Quinta vez que este nome de uma letra morde neste arquivo; aqui doeria mais que nas outras,
  // porque este duplo-toque é a ÚNICA saída visível de quem ligou a simulação de cegueira.
  el.addEventListener('pointerdown',(e)=>{ e.preventDefault(); const agora=e.timeStamp||0; if(agora-last<450){ setPlayerViz(0,'normal'); last=-9999; srSay(t('sr.visual.normalColors')); } else last=agora; }); })();
// O pad de toque nasce AQUI, e nao 50 linhas abaixo, porque a linha seguinte pode precisar dele: aplicar o
// modo de visao no boot passa por render/viz-setters, que esconde os controles de toque quando o modo e
// cegueira. O envolucro `hideTouchControls` e declaracao icada, mas o corpo dele dereferencia `touchCtl`, e
// icar a funcao nao iça a constante: com `incl_viz_p0=blind` salvo, o boot morria inteiro em TDZ — tela
// branca, sem mensagem, e so voltava limpando o armazenamento. Mesma doenca que o simNaoGlyphs ja teve neste
// arquivo; ali a cura foi ler do armazenamento, aqui e existir antes de quem chama.
const touchCtl = initTouch({ $, srSay, store, root: document.documentElement, isMobile,
  // O pad virtual so aparece com UM jogador, JOGANDO, e sem desafio aberto. A politica e do JOGO (item 19):
  // era uma linha dentro do `input/touch` lendo `numPlayers`, `phase` e `players[].quiz` por importacao — e a
  // ultima dizia que a camada de TOQUE sabia que existe atividade de alfabetizacao. Mesmo movimento do
  // achado 10: injeta-se o BOOLEANO, nao o estado.
  padAllowed: () => rodada.numPlayers <= 1 && fatosDaCena().mundoRodando && !jogadores().some((p) => p.quiz),
  viewport: () => ({ w: window.innerWidth, h: window.innerHeight }),
  frontOverlay, onPadDesignApplied: () => { if(typeof renderPauseLegend==='function') renderPauseLegend(); } });
// (o proprio initTouch ja aplica o desenho salvo no fim da sua inicializacao)
loadPlayerA11y(players[0],0); // carrega viz/easy/alternância persistidos do jogador 1 (migra chaves antigas)
vizReady=true; applyVizGlobal(players[0].viz); // estado inicial (solo)

/* TIPOGRAFIA — menu próprio na pausa (saiu da Sensibilidade visual, pedido do José 2026-07-02).
   3 grupos, UMA fonte ativa (radio), pré-visualização com o pangrama "Juiz foge e bota fita de cetim
   na xícara". Todas as fontes hospedadas são SIL OFL 1.1 (política do fonts.css); as canônicas EdSP
   mantêm o mecanismo antigo (Lexend preserva o espaçamento BDA via data-fonte="dislexia"). */
// Tipografia: catalogo em ui/fonts.js, painel em ui/settings-typo.js. Antes: FONT_GROUPS/loadFontKey extraídos p/ ui/fonts.js (Fase 2, tipografia).
const typo = initSettingsTypo({ $, srSay, store, root: document.documentElement }); // painel de tipografia: ui/settings-typo.ts (aplica a fonte persistida no init)
function openTypo(){ const ov=$('#typo'); if(!ov)return; typo.render(); ov.hidden=false; frontOverlay(ov);   const f=ov.querySelector<HTMLElement>('button[data-font]:not([disabled])')||ov.querySelector('button'); if(f)f.focus(); }
function closeTypo(){ const ov=$('#typo'); if(!ov)return; ov.hidden=true; if(!overlays.restoreFocus('typo'))menuFocus(sharedDialogOpen()); }
{ const b=$('#typo-close'); if(b)b.addEventListener('click',closeTypo); }

/* F1: menu de áudio (mixer por categoria) — o botão "Som" abre este menu */
function openAudio(){ const ov=$('#audio'); if(!ov)return; ensureAC(); audioPanel.renderAudio(); audioPanel.reflectModoCego(); audioPanel.reflectTts(); const cd=$<HTMLSelectElement>('#cane-div'); if(cd)cd.value=String(caneBlockDiv); ov.hidden=false; frontOverlay(ov); const f=ov.querySelector('button'); if(f)f.focus(); }
function closeAudio(){ const ov=$('#audio'); if(!ov)return; ov.hidden=true; if(!overlays.restoreFocus('audio'))menuFocus(sharedDialogOpen()); }
// A12e auditiva: Modo cego (só áudio) + seleção de voz (Web Speech agora; neurais em breve)
// Botões abreviados: hover/foco DESCOMPACTA o número em letras (o "12" vira as 12 letras contando p/ baixo), suave;
// recomprime ao sair. Genérico: varre a barra (.mode-btn) E o menu de pausa (.pm-btn) casando A12e/S11e.
// ABBR_MID/attachAbbr migraram para ui/activities-menu.ts (Onda A). A VARREDURA abaixo fica onde
// esta: ela e sensivel a quando os .pm-btn existem.
document.querySelectorAll<HTMLElement>('.mode-btn, .pm-btn').forEach(attachAbbr); // `attachAbbr` lê `.title`/`.dataset`
// Saída de áudio POR JOGADOR (setSinkId): detecta fones/caixas e atribui 1 por jogador
// DESIGN DOS BOTÕES na tela por controle (Gamepad API: 0=baixo/pulo·sim, 1=direita/especial·não, 2=esquerda/interação, 3=cima/troca-poder)
// PAD_DESIGNS extraído p/ input/devices.js (Fase 2).
// padDesign/applyPadDesign migraram para input/touch.ts (Onda A). simNaoGlyphs/renderPauseLegend FICAM:
// sao a legenda Sim/Nao da pausa, nao geometria de toque — o modulo as avisa por onPadDesignApplied.
// Le o desenho do ARMAZENAMENTO, nao de touchCtl: o initTouch chama applyPadDesign() antes de retornar, e
// esse gancho cai aqui com o `const touchCtl` ainda em TDZ. O modulo persiste o valor ANTES de disparar o
// gancho, entao o armazenamento e a fonte correta e sempre esta pronta.
function simNaoGlyphs(){ const d=store.get('incl_paddesign','generic'); const set=PAD_DESIGNS[d]||PAD_DESIGNS.generic; const inv=(d==='sony'||d==='nintendo');
  return { sim:set[inv?'1':'0'], nao:set[inv?'0':'1'] }; }
// A MONTAGEM saiu daqui e virou `pauseLegendHtml` em ui/shell (ADR-0044, item 4). Não foi só mudança de casa:
// a legenda carregava `aria-hidden="true"` e era invisível justamente para quem não vê o glifo. Agora os chips
// ficam visíveis e MUDOS e uma frase `sr-only` diz a mesma coisa em palavras — e a montagem virou testável em
// node, que é o que permite o gate `tests/pause-legend.node.test.js` existir.
function renderPauseLegend(){ const g=simNaoGlyphs();
  const html=pauseLegendHtml(g.sim as [string,string], g.nao as [string,string]);
  document.querySelectorAll('.pause-legend').forEach(el=>{ el.innerHTML=html; }); } // todas as pausas por tela
// START (pílula): função vem do touchMap (padrão pausar) — a fiação fica no touchSetup, junto do doTouch.
// padLayoutFromId migrou para input/touch.ts (Onda A) — a deteccao do modelo pelo id do controle e
// dado de apresentacao dos botoes, nao leitura da Gamepad API. A fiacao (gamepadconnected e o seletor
// #pad-design) desce para junto do initTouch, abaixo.
// TAMANHO FÍSICO (mm) dos botões de toque — NÃO px. WCAG mede alvos de toque físicos, não botões
// virtuais sobre canvas. Conversão mm→px ancorada no iPhone 16 a tela cheia (aresta longa 141,1mm
// do display 1179×2556 @460ppi → ~6,04 px CSS/mm). No aparelho-alvo fica exato; noutros, proporcional.
// Defaults baseados na ciência (botões que se SEGURA + multitoque, não toque fino):
//  botão 12,5mm (piso 11mm > alvo de polegar Parhi 9,6mm; segurar cansa mais em botão pequeno),
//  folga 3mm (evita apertar 2 sem esticar o polegar), analógico 18mm (capuz físico ~18–20mm),
//  deslocamento 4,5mm. Faixa criança↔adulto estreita: crianças NÃO devem ir a alvos minúsculos.
// Geometria fisica do pad (mm -> px), presets, direcional e o mapa de toque migraram para input/touch.ts
// (Onda A). As dimensoes de tela entram INJETADAS: o modulo nunca le window.innerWidth.
addEventListener('gamepadconnected', (e)=>{ try{ const d=touchCtl.applyPadDesign(padLayoutFromId(e.gamepad.id)); const sel=$<HTMLSelectElement>('#pad-design'); if(sel)sel.value=d; srSay(t('sr.pad.connected',{v:d})); }catch(err){} }); // A2: layout pelo id do controle
const padDesignSel=$<HTMLSelectElement>('#pad-design'); if(padDesignSel){ padDesignSel.value=touchCtl.getPadDesign(); padDesignSel.addEventListener('change',()=>{ touchCtl.applyPadDesign(padDesignSel.value); srSay(t('sr.pad.design',{v:padDesignSel.value})); }); } // A4: escolha manual
// JOGAR COM OS OLHOS: eyeMode/eyeSet/onGaze/startEyeControl/stopEyeControl/loadWebGazer → ui/webcam.js (Estágio 4, Tier 1).
const eyesBtn=$('#opt-eyes'); if(eyesBtn)eyesBtn.addEventListener('click',()=>{ setEyeMode(!eyeMode); toggleBtn(eyesBtn,eyeMode); eyesBtn.textContent=toggleLabel(eyeMode);
  if(eyeMode){ loadWebGazer(startEyeControl); srSay(t('sr.eyes.loading')); } else { stopEyeControl(); srSay(t('sr.eyes.off')); } });
const audioCloseBtn=$('#audio-close'); if(audioCloseBtn)audioCloseBtn.addEventListener('click',closeAudio);
const audioPanel = initSettingsAudio({ $, srSay, store, audioCats: AUDIO_CATS, toggleBtn, getNumPlayers: () => rodada.numPlayers, getPlayers: () => players, getSoundOn: () => soundOn, setSoundOn, getVolume: () => volume, setVolume, getAudioCat: () => audioCat, setCatGain, tts, getModoCego: () => modoCego, setModoCego, getCaneBlockDiv: () => caneBlockDiv, setCaneBlockDiv: setCaneBlockDivValue }); // painel de audio: ui/settings-audio.ts
// REFLETE O MODO CEGO PERSISTIDO no boot. `incl_modocego` sobrevive à sessão desde sempre, mas nada refletia o
// valor no botão ao abrir o jogo: com o modo LIGADO, o `#opt-modocego` dizia "Desligado" e reportava
// `aria-pressed="false"`. Para quem usa leitor de tela isso é WCAG 4.1.2 (nome, papel, VALOR) quebrado no
// controle de que essa pessoa depende — e sem a tela para desempatar, a informação errada é a única que há.
// Verificado numa carga limpa: gravado "1", botão "Desligado". O cadeirante, ao lado, refletia certo.
audioPanel.reflectModoCego();

/* E10: remap de controles + persistência (B2) */
const ctrlPanel = initSettingsControls({ $, srSay, srAlert, store: { saveKB, resetKB }, kb, setKB, kbFor, getNumPlayers: () => rodada.numPlayers, applyControls, assignControls }); // painel de controles: ui/settings-controls.ts (registra #ctrl-reset e os botoes de remap)
function openOptions(){ const ov=$('#options'); if(!ov)return; ctrlPanel.render(rodada.pauseActor); ov.hidden=false; frontOverlay(ov); const f=ov.querySelector('button'); if(f)f.focus(); } // E3: edita o controle do jogador que abriu
function closeOptions(){ const ov=$('#options'); if(!ov)return; ov.hidden=true; ctrlPanel.cancelCapture(); if(!overlays.restoreFocus('options'))menuFocus(sharedDialogOpen()); }
const ctrlBtn=$('#opt-controls'); if(ctrlBtn)ctrlBtn.addEventListener('click',openOptions);
// AJUDA (do menu de pausa): controles DO jogador que abriu (pauseActor) + notas desta build.
function openHelp(){ const ov=$('#help'); if(!ov)return; const c=$('#help-content'); const pa=rodada.pauseActor||0; const map=kbFor(pa);
  const rows=Object.keys(ACT_LABEL).map(a=>`<div class="ctrl-row"><span>${t(ACT_LABEL[a])}</span><span>${(map[a]||[]).map(keyName).map(k=>'<kbd>'+k+'</kbd>').join(' ')||'—'}</span></div>`).join('');
  // O cabecalho e' UMA FRASE por caso ('Seus controles' / 'Seus controles · Jogador N'), e nao um prefixo mais
  // um sufixo: uma lingua que ponha o numero do jogador ANTES do titulo so consegue se a frase inteira morar
  // no dicionario. Mesma decisao de `sr.audio.*` e dos anuncios motores.
  const titulo=rodada.numPlayers>1?t('help.controlsPlayer',{n:pa+1}):t('help.controls');
  const nota=(txt: string)=>`<div class="ctrl-row"><span>${txt}</span></div>`;
  if(c)c.innerHTML=`<h3 class="panel-sub">${titulo} <span class="panel-sub__tag">${t('help.keyboard')}</span></h3><div class="ctrl-list">${rows}</div>`+
    `<h3 class="panel-sub">${t('help.buildNotes')}</h3><div class="ctrl-list">`+
    nota(t('help.powerups'))+nota(t('help.multiplayer'))+nota(t('help.tech',{v:INCL_VERSION}))+`</div>`;
  ov.hidden=false; frontOverlay(ov); const f=ov.querySelector('button'); if(f)f.focus(); }
function closeHelp(){ const ov=$('#help'); if(!ov)return; ov.hidden=true; if(!overlays.restoreFocus('help'))menuFocus(sharedDialogOpen()); }
const helpCloseBtn=$('#help-close'); if(helpCloseBtn)helpCloseBtn.addEventListener('click',closeHelp);
const ctrlClose=$('#ctrl-close'); if(ctrlClose)ctrlClose.addEventListener('click',closeOptions);

/* Movimento reduzido (WCAG 2.3.3) + Pause/Stop/Hide (2.2.2) */
// (RM_LABEL e RM_SOON eram CODIGO MORTO aqui: nenhum leitor neste arquivo. Os que o painel usa vivem em
//  ui/settings-motion, e eram copia palavra por palavra destes. Apagados no item 14.)
const motion = initSettingsMotion({ $, srSay, store, getPlayers: () => players, getNumPlayers: () => rodada.numPlayers, frontOverlay, restoreFocus: (id)=>overlays.restoreFocus(id), toggleBtn, rm, saveRM, rmKeys: RM_KEYS, rmChar: RM_CHAR }); // painel de movimento/CRT: ui/settings-motion.ts
// MENU Movimento (GAG: alternância) — separado do menu Animação (WCAG: movimento reduzido)
function openMovement(){ const ov=$('#movement'); if(!ov)return; motor.renderMovPlayers(); motor.reflectFacil(); motor.reflectAltMove(); renderMapHub(); ov.hidden=false; frontOverlay(ov); const f=ov.querySelector('button'); if(f)f.focus(); }
function closeMovement(){ const ov=$('#movement'); if(!ov)return; ov.hidden=true; if(!overlays.restoreFocus('movement'))menuFocus(sharedDialogOpen()); }
// Submenu "Configurar botões de tela touch"
// openTouchCfg/closeTouchCfg migraram para input/touch.ts (Onda A).
const touchCfgBtn=$('#opt-touchcfg'); if(touchCfgBtn)touchCfgBtn.addEventListener('click',()=>touchCtl.openTouchCfg());
const touchCfgClose=$('#touchcfg-close'); if(touchCfgClose)touchCfgClose.addEventListener('click',()=>touchCtl.closeTouchCfg());
/* ===================== HUB "MAPEAR CONTROLES" -> ui/map-hub.ts (D3-c) =====================
   A tabela de linhas, o markup e as duas frases faladas sairam; `mapSoon` foi junto (nao tinha outro
   chamador). Fica o ENVOLUCRO, declaracao de funcao e portanto icada, porque openMovement — que aparece
   ACIMA deste ponto — o chama pelo nome. */
const mapHub = initMapHub({ $, srAlert, getNumPlayers: ()=>rodada.numPlayers, openOptions, openPadWiz: ()=>gamepadApi.openPadWiz() });
function renderMapHub(){ mapHub.render(); }
const movBtn=$('#opt-movement'); if(movBtn)movBtn.addEventListener('click',openMovement);
const movClose=$('#movement-close'); if(movClose)movClose.addEventListener('click',closeMovement);
const animClose=$('#animation-close'); if(animClose)animClose.addEventListener('click',()=>motion.close()); // #opt-animation NAO existe no app (era referencia morta); so o fechar e real

/* ===================== FPS ===================== */
let fpsAccum=0,fpsFrames=0,fpsMin=Infinity,fpsWarm=0;
function fpsTick(){ const fps=app.ticker.FPS; fpsWarm++; fpsAccum+=fps; fpsFrames++;
  if(fpsWarm>60&&fps<fpsMin)fpsMin=fps;
  // O HUD de FPS vive na barra de depuração (`?debug=true`). Ele existe no HTML de hoje, mas isto roda a
  // cada 30 quadros: um `?.` custa nada e tira o loop de dependeder de um elemento opcional.
  if(fpsFrames>=30){ const f=$('#hud-fps'); if(f)f.textContent=String(Math.round(fpsAccum/fpsFrames));
    const fm=$('#hud-fpsmin'); if(fm)fm.textContent=fpsMin===Infinity?'–':String(Math.round(fpsMin));
    fpsAccum=0;fpsFrames=0; }
}

/* ===================== loop ===================== */
startLoop(app.ticker, (dt)=>{ gamepadApi.pollPads(); update(dt); draw();
  titleG.visible=fatosDaCena().telaDeTitulo; if(titleG.visible)titleScene.draw(); // cena do título da v3 cobre o mundo
  attractCtl.titleIdleTick(titleG.visible); // attract após 60s parado no menu (José)
  setMinimapVisible(!titleG.visible&&rodada.numPlayers<=1); document.body.classList.toggle('at-title',titleG.visible); // HUD/minimapa não vazam no menu
  fpsTick();
  if(fatosDaCena().mundoRodando){ weather.updateWeather(); ambient.updateAmbient(); nav.updateGuide(); } }); // F4: clima + ambiente + guia auditivo (só durante o jogo)
window.__incl={app,get player(){return players[0];},players,get numPlayers(){return rodada.numPlayers;},setNumPlayers,activateScreens,fitsN,isMobile,pollPads:()=>gamepadApi.pollPads(),update,openPadWiz:()=>gamepadApi.openPadWiz(),padWizTick:()=>gamepadApi.padWizTick(),padMapFor:(id: Parameters<typeof gamepadApi.padMapFor>[0])=>gamepadApi.padMapFor(id),get padWiz(){return gamepadApi.getPadWiz();},get phase(){return cenas.fase();},get padPrev(){return padPrevAct;},get coins(){return coins;},get collected(){return players[0].collected;},get powerups(){return rodada.powerups;},get gateOpen(){return rodada.gateOpen;},get gate(){return rodada.gate;},get ended(){return rodada.ended;},restartGame,get hcMode(){return (VIZ_BY_KEY[vizMode]||{}).kind==='hcnew';} /* derivado de vizMode (D1); era `let` espelho */,setHC(v: boolean){setPlayerViz(0,v?'hc-direto':'normal');},get vizMode(){return players[0].viz;},applyViz(v: Parameters<typeof setPlayerViz>[1]){setPlayerViz(0,v);},setPlayerViz,VIZ_MODES,get footCount(){return _footCount;},get sonarCount(){return nav.sonarCount;},get guideCount(){return nav.guideCount;},get narrateCount(){return tts.narrateCount;},sonar:()=>nav.sonar(controlados()[0]!),setHearingLoss,darkRegions,decoLayer,get minimap(){return getMinimap();},parallaxLayers,PARALLAX,setCenario,get cenario(){return CENARIO;},
  get mmSeen(){return minimapSeenCount();},get MODE(){return MODE();},get letterCase(){return letterCase;},brailleText,tileAt,WORLD_W,WORLD_H,TUNE,
  JUICE,addShake,addHitstop,burstSparkle,puffDust,draw,get particles(){return getParticles();},get hitstopT(){return getHitstopT();},get shakeT(){return getShakeT();},CRT,applyCrt,setLq,get lqT(){return getLqT();},
  setOwnerColors,setCbSafe,setRoleColor,resetRoleColors,PCOLOR,HC_ROLE,get ownerColors(){return ownerColors;},get cbSafe(){return cbSafe;},
  setQuizLevel,get quizLevel(){return quizLevel;},openSilabas,quizMove,quizConfirm,quizErase,get quiz(){return jogadores()[0].quiz;},INCL_VERSION,fmtFrac,fracGraphic,speakChoice,get fracNot(){return fracNot;},
  setGameFont:typo.setFont,openTypo,get fontKey(){return typo.getFontKey();},FONT_GROUPS,get mmSeen2(){return minimapSeenCount();},
  startAttract:()=>attractCtl.startAttract(),stopAttract:()=>attractCtl.stopAttract(),get attract(){return attractCtl.isAttract();}, // attract → game/attract.ts
  loadTTS:tts.loadTTS,ttsSpeak:tts.ttsSpeak,narrate:tts.narrate,get ttsEngine(){return tts.getEngine();},get ttsLoading(){return tts.loading;},get ttsFailed(){return tts.failed;},setTtsEngineSel(v: Parameters<typeof tts.setEngineSel>[0]){tts.setEngineSel(v);},
  updateWeather:weather.updateWeather,get rainLevel(){return weather.getRainLevel();},set weatherT(v){weather.setWeatherT(v);},get weatherT(){return weather.getWeatherT();},rm,
  spawnCreature:life.spawnCreature,stepLife:life.stepLife,get creatures(){return life.getCreatures();},spawnCar:traffic.spawnCar,get cars(){return traffic.getCars();},SEM:traffic.SEM,get STREET_Y(){return traffic.getStreetY();},
  get elevShafts(){return getElevShafts();},elevAt,get BOX(){return BOX;},get wheelchair(){return wheelchair;},setWheelchair,buildElevators,buildRamps,solidAt,surfTop, // debug cadeirante
  get clouds(){return sceneSky.getClouds();},get birds(){return sceneSky.getBirds();},stepSky:(dt: number)=>sceneSky.stepSky(dt),CENARIOS,stepV3Decor:()=>sceneSky.stepV3Decor(),
  get grassDensity(){return rodada.grassDensity;},setGrassDensity:(v: number)=>rodada.setGrassDensity(v), // o clamp mora no setter da RODADA
  get decorCounts(){ const n=(g: PIXI.Graphics)=>g.geometry&&g.geometry.graphicsData?g.geometry.graphicsData.length:0; return {stars:n(starsG),skyDeco:n(skyDecoG),fog:n(fogG),grass:n(grassG),front:n(themeFxG)}; }};
{ const v='v'+INCL_VERSION; document.title=`The Inclusionist · ${v} (PixiJS)`; // versão: fonte única = INCL_VERSION
  const e1=document.querySelector('h1 .ver'); if(e1)e1.textContent='· '+v;
  const e2=document.getElementById('title-ver'); if(e2)e2.textContent=v; }
srSay(t('sr.boot.loaded',{n:COIN_TARGET})); // o "10" era cravado; agora é o alvo de verdade

/* dicas de início: somem ao pular ou após 8s */
function hideTips(){} // dicas de início REMOVIDAS (José 2026-07-04); stub mantém os call-sites

/* ===== Layout: jogo em múltiplos inteiros de 320x180, centralizado; VLibras = 5:9 ao lado =====
   Usa o BOTÃO NATIVO do VLibras (reposicionado à direita do jogo). Detecta abertura/fechamento
   por polling e, ao abrir, reserva o slot 5:9 (jogo desloca à esquerda, conjunto 21:9 centraliza)
   e encaixa+escala o painel no slot. */
// layout() extraído p/ ui/layout.js (Estágio 4, Tier 1). O acoplamento com ui/vlibras acabou: o intérprete não empurra.
addEventListener('resize', layout);
setOnLibrasChange(layout); // ui/vlibras: reflui o layout ao abrir/fechar o intérprete (callback injetado)
setInterval(vlTick, 250);
layout(); requestAnimationFrame(layout); setTimeout(layout, 1500);
window.__incl.layout=layout; window.__incl.get_librasOpen=()=>librasOpen;

/* ===================== E14: shell — título/splash + pausa -> ui/shell.ts (C3) =====================
   setPhase/pauseActs/pauseSelect/printMode/togglePause/updateTitleLegend migraram. O que fica aqui sao
   ENVELOPES ICADOS (`function`), e nao `const`: `setPhase` ja esta nos ctx de game/session, input/gamepad,
   game/attract e ui/activities-menu, montados em outros pontos do arquivo — so o icamento faz aquelas quatro
   fiacoes continuarem valendo sem serem tocadas. Mesmo padrao de hideTouchControls/restartGame/quitGame.
   Tudo o que a tabela de pausa chama entra como CALLBACK, nao como valor: motor/motion/empathy/hud sao
   `const` declarados ABAIXO, e so a resolucao na hora da chamada os tira da TDZ. (selVizPlayer saiu desta
   lista: migrou para core/state no #50, e um import nao tem TDZ para escapar.) */
const shell = initShell({
  fatosDaCena, retomarJogo: () => setPhase('playing'),
  getPlayers: () => players, getNumPlayers: () => rodada.numPlayers,
  $, win: window, setMasterMuted, srSay, srAlert,
  getPauseScreens: () => vpPause,                  // `let` REATRIBUIDO por buildGameHud -> getter
  getPauseActor: () => rodada.pauseActor,          // seis leitores -> um campo da RODADA
  hideTouchControls: () => hideTouchControls(),
  reflectPauseIcons: () => reflectPauseIcons(),
  getGamepads: () => (navigator.getGamepads ? navigator.getGamepads() : []),
  isTouchMode: () => document.body.classList.contains('touch-mode'),
  padLayoutFromId, padMapFor: (id) => gamepadApi.padMapFor(id), kbFor, keyName,
  openCaa: () => caa.open(),
  setQuizLevel, getQuizLevel: () => quizLevel,
  openTypo: () => openTypo(), openAudio: () => openAudio(), openMovement: () => openMovement(),
  openVisual: () => openVisual(), openHelp: () => openHelp(), quitGame: () => quitGame(),
  fitsN: (n) => fitsN(n), joinPlayer: (padIdx) => joinPlayer(padIdx),
  showWaitingBadge: (i) => hud.showWaitingBadge(i),
  setMotorPlayer: (i) => motor.setSelPlayer(i),
  setMotionPlayer: (i) => setSelectedMotionPlayer(i),
  openMotion: () => motion.open(), openEmpathy: () => empathy.open(),
  setSelVizPlayer: (i) => rodada.setSelVizPlayer(i),
});
/* `setPhase`/`togglePause` são ENVELOPES ICADOS sobre `game/cenas`. Continuam como `function` e não `const`
   pelo mesmo motivo de sempre: eles já estão nos ctx de game/session, input/gamepad, game/attract e
   ui/activities-menu, montados acima desta linha — só o içamento faz aquelas fiações valerem sem serem
   tocadas. A REGRA de cada transição (pausar empilha, sair da pausa desempilha, o título não alterna) mora
   lá, onde tem teste; aqui fica só o encaminhamento. */
function setPhase(p: Fase){ cenas.irPara(p); }
function togglePause(){ cenas.alternarPausa(); }
function updateTitleLegend(){ shell.updateTitleLegend(); }
// NAVEGAÇÃO UNIVERSAL de menus: qualquer menu aberto (pausa OU submenu) é navegável por up/down/left/right/
// sim/não — as MESMAS ações valem para teclado, controle, olhos e fala. sim = confirma/alterna/entra;
// não = volta ao menu anterior (na raiz, volta ao jogo = Continuar). left/right ajustam select/slider.
// A ORDEM aqui E a cadeia de Escape (verbatim do encadeamento anterior). touchcfg e help entram sem
// flag: ficam fora da cadeia, exatamente como estavam.
overlays.register('options',  { close:()=>closeOptions(),  inEscapeChain:true });
overlays.register('movement', { close:()=>closeMovement(), inEscapeChain:true });
overlays.register('animation',{ close:()=>motion.close(),  inEscapeChain:true });
overlays.register('visual',   { close:()=>closeVisual(),   inEscapeChain:true });
overlays.register('empathy',  { close:()=>empathy.close(), inEscapeChain:true });
overlays.register('audio',    { close:()=>closeAudio(),    inEscapeChain:true });
overlays.register('caa',      { close:()=>caa.close(),     inEscapeChain:true });
overlays.register('typo',     { close:()=>closeTypo(),     inEscapeChain:true });
// Estes dois ficavam FORA da cadeia — heranca do monolito, onde nunca tiveram flag `*Open`. Media no
// navegador: com o jogo pausado o Escape nem chega aqui, porque menu-nav o consome na fase de CAPTURA e da
// stopPropagation. Ou seja, o comportamento certo de hoje vinha de uma rede acidental, e a cadeia — que e o
// recuo — estava errada. Agora os nove estao nela. Para o #touchcfg isso ainda melhora o fechamento: pela
// cadeia passa por closeTouchCfg(), que devolve o foco, em vez do ramo do roteador, que so escondia.
overlays.register('touchcfg', { close:()=>touchCtl.closeTouchCfg(), inEscapeChain:true });
overlays.register('help',     { close:()=>closeHelp(),              inEscapeChain:true });
const pauseActs = shell.pauseActs; // tabela de acoes dos .pm-btn -> ui/shell.ts (ui/pause-icons le por getPauseActs)
// Roteamento de input por jogador: cada tecla é do jogador dono dela (kbFor). Genéricas → jogador 0.
const actionOf = (code: Parameters<typeof kbRuntime.actionOf>[0],pi: number) => kbRuntime.actionOf(code,pi);
const whichPlayer = (code: Parameters<typeof kbRuntime.whichPlayer>[0]) => kbRuntime.whichPlayer(code);
/* ===================== NAVEGACAO UNIVERSAL de menus -> ui/menu-nav.ts (C3) =====================
   sharedDialogOpen/menuItems/menuFocus/dialogBack/navDialog/pauseSetSel/navPause/menuNavKey migraram.
   `sharedDialogOpen` agora e ALIAS de overlays.topVisibleOverlay: as duas eram a MESMA funcao escrita duas
   vezes — mesmo escopo, mesmo filtro, mesma ordenacao por z-index. Os envelopes abaixo sao `function`
   (icadas) porque o ctx de input/gamepad, montado bem acima, referencia sharedDialogOpen/navDialog/navPause
   por NOME; e closeTypo/closeHelp chamam menuFocus(sharedDialogOpen()) de mais acima ainda. */
const menuNav = initMenuNav({
  $, getActiveElement: () => document.activeElement,
  isNavigable: () => fatosDaCena().menuDePausa, // aqui menu e' coisa de pausa; noutro jogo pode ser sempre (ver o ctx)
  // O modo `accessibility` (ADR-0044, item 7) roda com o jogo ANDANDO, e por isso e' perguntado antes do
  // guarda de "navegavel". Quem sabe quem esta nele e' `ui/pause-icons`, dono da barra.
  srSay,
  comIndice: () => menuIndexOn,
  naBarraDe: (i) => pauseIcons.naBarraDe(i),
  navBar: (i, k) => pauseIcons.navBar(i, k),
  topVisibleOverlay: () => overlays.topVisibleOverlay(), closeById: (id) => overlays.closeById(id),
  getPauseMenu: (i) => vpPause[i],                 // `let vpPause` REATRIBUIDO por buildGameHud -> getter
  setPhase: (p) => setPhase(p),
  setPauseActor: (i) => rodada.setPauseActor(i),
  isCapturing: () => ctrlPanel.isCapturing(),
  closePadWiz: (save) => gamepadApi.closePadWiz(save), // LAZY: quebra o ciclo menu-nav <-> input/gamepad
  whichPlayer, actionOf,
  win: window,
});
function sharedDialogOpen(){ return menuNav.sharedDialogOpen(); }
function menuFocus(menu: Parameters<typeof menuNav.menuFocus>[0]){ menuNav.menuFocus(menu); }
function navDialog(menu: Parameters<typeof menuNav.navDialog>[0],k: Parameters<typeof menuNav.navDialog>[1]){ menuNav.navDialog(menu,k); }
function navPause(menu: Parameters<typeof menuNav.navPause>[0],pi: number,k: Parameters<typeof menuNav.navPause>[2]){ menuNav.navPause(menu,pi,k); }
menuNav.attach(); // addEventListener('keydown', menuNavKey, true) — MESMA fase de CAPTURA
/* ===== Menu inicial (v3): principal → submenus de atividade → (tabuada/divisão) seletor de números ===== */
// _tabFor/titleButtons/navTitle/buildTitleMenus migraram para ui/activities-menu.ts (Onda A).
// updateTitleLegend migrou para ui/shell.ts (C3) — e legenda da TELA de titulo, nao navegacao de menu; o
// envelope icado fica la em cima, junto do resto da casca. padKind() foi APAGADO: input/touch.ts ja exporta
// a mesma funcao desde a Onda A e a copia daqui nao tinha chamador nenhum (codigo morto duplicado).
addEventListener('gamepadconnected',()=>{ if(fatosDaCena().telaDeTitulo)updateTitleLegend(); });
addEventListener('gamepaddisconnected',()=>{ if(fatosDaCena().telaDeTitulo)updateTitleLegend(); });
// O despachante do menu do titulo (teclado do #np-btn, rodape de descricao e o click) migrou para
// ui/activities-menu.ts, que liga os proprios ouvintes no #title-overlay. Sobrou aqui a barra de
// icones de a11y do splash, que e do slice de pausa.
(function titleIconsSetup(){ const ov=$('#title-overlay'); if(!ov)return;
  // Icones de a11y da pausa TAMBEM no topo do splash (mesmas acoes, escopo do Jogador 1)
  const ti=$('#title-icons'); if(ti){ ti.innerHTML=iconsMarkup(); // fonte unica do markup (antes copiado aqui e no modulo)
    // ⚠️ O `<HTMLElement>` no `closest` é para o `dataset` da linha de baixo ser tipado. O comentário que
    // explicava isso ficou NO MEIO da linha em 2026-08-25 (d889254) e comeu o resto dela — as duas chamadas
    // abaixo passaram 36 commits comentadas, e nada acusou. Comentário de fim de linha fica em linha própria.
    ti.addEventListener('click',(e)=>{ const ib=(e.target as Element | null)?.closest<HTMLElement>('.pi-btn'); if(!ib)return;
      rodada.setPauseActor(0); pauseIcons.iconAct(ib.dataset.pi||'',0);
      reflectTitleIcons(); if(typeof reflectPauseIcons==='function')reflectPauseIcons(); srSay(ib.getAttribute('aria-label')||''); });
    reflectTitleIcons(); }
})();
(function shellSetup(){
  // (O ajudante `wire` e a chamada `wire('btn-pause', …)` SAÍRAM em 2026-08-26. O id nunca existiu no
  //  documento — o botão saiu da barra e a fiação ficou "guardada p/ compat", ligando um ouvinte a nada. O
  //  `noUnusedLocals`, ligado hoje, mostrou que o ajudante existia SÓ para essa chamada. Quem pausa por
  //  toque é o `#touch-start`, e é nele que o `aria-pressed` passa a cair — ver `ui/shell`.)
  // Barra de topo (título da PÁGINA + ferramentas): só com ?debug=true. O jogo já mostra o título no splash,
  // então a barra fica oculta por padrão (CSS body:not(.dbg) .topbar) e libera a vertical p/ o canvas.
  if(/[?&]debug=true/.test(location.search))document.body.classList.add('dbg');
  const tools=$('#topbar-tools'); if(tools){ if(/[?&]debug=true/.test(location.search))tools.hidden=false;
    const db=$('#btn-debug'); if(db)db.addEventListener('click',()=>{ const p=$('#debug-panel'); if(p){ p.hidden=!p.hidden; db.setAttribute('aria-pressed',String(!p.hidden)); } }); } // abre/fecha o painel de afinação
  // Menu de pausa: agora é POR TELA (buildScreenPause + pauseActs no escopo do módulo). Nada aqui.
  setPhase('title'); // estado inicial: tela de título
  // (o `initI18n()` que ficava aqui subiu para o TOPO do arquivo — ver a nota la'. Ficar por ultimo era o
  //  defeito: a interface toda ja tinha sido montada no idioma errado.)
})();

/* ===================== E13: controles de toque (mobile) ===================== */
// oculta os botões de toque (chamado quando o jogador usa teclado/controle, p/ não atrapalhar)
// minimapa: no toque vai pro canto SUPERIOR DIREITO (o direcional, embaixo à esq., não o cobre); senão, inferior esquerdo
// setMinimapCorner extraído p/ render/minimap.js (Estágio 4, Tier 1).
// teclado/controle → esconde os botões e devolve o minimapa ao canto inferior esquerdo
// hideTouchControls/showTouchControls migraram para input/touch.ts (Onda A).
// DECLARACOES de funcao, nao const: o setPhase('title') do boot chama hideTouchControls antes desta linha,
// e so o icamento faz isso funcionar — era assim no original. O corpo so toca touchCtl na hora da chamada.
// ⚠️ `reason?: string` escrito à mão, e NÃO `Parameters<typeof …>[0]`: aquele idioma perde a OPCIONALIDADE.
// O delegado declara `hideTouchControls(reason?: string)`, mas `Parameters<>[0]` devolve `string | undefined`
// como parâmetro OBRIGATÓRIO — e os três pontos que chamam sem argumento pararam de compilar. O idioma
// continua certo para parâmetro obrigatório; para opcional, ele mente.
function hideTouchControls(reason?: string){ touchCtl.hideTouchControls(reason); }
function showTouchControls(){ touchCtl.showTouchControls(); }
/* Amarras do toque -> input/touch-bindings.ts (D3-b). LAZY de proposito: `attractCtl` e `const` declarado
   ABAIXO desta linha (TDZ). `keys` e `const` mutado in place -> entra por VALOR; showTouchControls/hideTips/
   togglePause sao declaracoes icadas e ja existem aqui, entao entram por referencia direta.
   `getStartAction` le do dono do mapa (touchCtl). Antes alcancava um `touchMap` pelado, que e variavel
   privada do closure de input/touch.ts e nunca existiu aqui: o botao START do pad lancava ReferenceError e
   nao fazia nada. */
const touchBindings = initTouchBindings({
  $, win: window, getSearch: () => location.search,
  getControls: () => kbRuntime.controlsState().controls,
  getPlayers: () => players, heldKeys: keys,
  attractOnInput: () => attractCtl.onInput(),
  showTouchControls, hideTips, togglePause,
  getTouchMap: () => touchCtl.getTouchMap(),
  getStartAction: () => touchCtl.getTouchMap().start, // era `touchMap.start` — nome que nunca existiu neste escopo
  getStickTravelPx: () => touchCtl.getStickTravelPx(),
  getStickDeadPx: () => touchCtl.getStickDeadPx(),
});
touchBindings.attach();
window.__incl.showTouch = () => touchBindings.revealForTests(); // p/ testes em desktop

/* ===================== ATTRACT: cria o controlador (deps já definidas) → game/attract.ts ===================== */
const attractCtl = createAttract({
  CENARIOS, keys,
  getPlayers: () => players, getCenario: () => CENARIO, // bindings vivos (reatribuídos)
  mundoRodando: () => fatosDaCena().mundoRodando,
  entrarNoJogo: () => setPhase('playing'), voltarAoTitulo: () => setPhase('title'),
  setCenario, setActivity, restartGame, randInt, kbFor, srSay, srAlert, $,
});

/* ===================== ?debug=true: painel de afinação ao vivo (extraído → ui/debug-panel.ts) ===================== */
initDebugPanel({ TUNE, ANIM, JUICE, saveJuice });

/* ===================== PWA ===================== */
// PWA/SW agora gerados pelo vite-plugin-pwa (Estágio 1); registro injetado no build. Ver vite.config.ts.
