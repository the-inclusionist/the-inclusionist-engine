// SPDX-License-Identifier: GPL-3.0-or-later
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
import { phase, quizLevel, setQuizLevelValue, numPlayers, cenario as CENARIO, setCenarioValue, activity as ACTIVITY, setActivityValue, vizMode, initVizMode, coins, setCoins, players, modoCego, setModoCegoValue, caneBlockDiv, setCaneBlockDivValue, wheelchair, setWheelchairValue, oneButton, setOneButtonValue, cbSafe, setCbSafeValue, ownerColors, setOwnerColorsValue, hcOutlineFg, setOutlineFgValue, hcOutlineBg, setOutlineBgValue, letterCase, setLetterCaseValue, captionsOn, setCaptionsOnValue, defaultReducedMotion, selVizPlayer, setSelVizPlayerValue, pauseActor, setPauseActorValue, grassDensity, setGrassDensityValue, decorSeed, setDecorSeedValue, gateTiles, gateOpen, gate, powerups, setLevelExtras, setGateOpenValue, wcSolid, setWcSolidValue, ended, setEndedValue } from './core/state.js'; // estado compartilhado
import { startLoop } from './core/loop.js'; // driver do loop
import { initDebugPanel } from './ui/debug-panel.js'; // painel ?debug (Tier 1)
import { createAttract } from './game/attract.js'; // modo demonstração (Tier 1)
import { isValidActivityId, DEFAULT_ACTIVITY_ID } from './game/activities-registry.js';

import { buildElevators, elevAt, getElevShafts, initElevators } from './game/elevators.js'; // Estágio 4 (Tier 2): geometria de elevador (cadeirante)
import { fmtFrac, fracGraphic, speakChoice } from './game/fractions.js'; // Estágio 4 (Tier 2): matemática/render de frações
import { brailleText } from './game/braille.js'; // Estágio 4 (Tier 2): cela braille + fala (atividade cego)
import { SOMASUB_SHAPES, WORD_INITIALS } from './game/activity-content.js'; // Estágio 4 (Tier 2): dados das atividades (formas + sílabas)
import { JUICE, saveJuice, puffDust, burstSparkle, addShake, addHitstop, setSquash, stepFx, initFx, tickHitstop, getParticles, getHitstopT, getShakeT } from './render/fx.js'; // Estágio 4 (Tier 2): juice (partículas/shake/hitstop/squash)
import { parallaxPlaceholder, themeSkyTexture, themeHillsTexture } from './render/scene-parallax.js'; // Estágio 4 (Tier 2): geradores de textura do parallax
import { worldCanvas, initWorldTex } from './render/world-tex.js'; // Estágio 4 (Tier 2): builder da textura NORMAL do mundo
import { kb, initKB, setKB, saveKB, resetKB } from './input/keyboard.js'; // Fase 2: config de teclado (subsistema input)
import { AUDIO_CATS } from './platform/audio-mixer.js'; // Fase 2: categorias do mixer (dados); audioCat/catNode/setCatGain vêm de audio.js
import { FONT_GROUPS } from './ui/fonts.js'; // Fase 2: tipografia (catálogo + persistência)
import { $, $$, toggleBtn } from './ui/dom.js';
import { initSettingsAudio } from './ui/settings-audio.js';
import { initSettingsControls, ACT_LABEL, keyName } from './ui/settings-controls.js';
import { initSettingsVisual, ROLE_LABELS } from './ui/settings-visual.js';
import { initSettingsCaa } from './ui/settings-caa.js';
import { cityTiles } from './render/city-tiles.js'; // #16: os tiles da Cidade como dados, não como PNG // 7º menu: Comunicação Aumentada e Alternativa (ADR-0028)
import { initSettingsEmpathy } from './ui/settings-empathy.js';
import { initSettingsMotor } from './ui/settings-motor.js';
import { initSettingsMotion, setSelectedPlayer as setSelectedMotionPlayer } from './ui/settings-motion.js';
import { initSettingsTypo } from './ui/settings-typo.js';
import { initTitle } from './ui/title.js';
import { createTitleScene } from './render/title-scene.js'; // Fase 2.27: atalho de querySelector (Tier 1)
import { VIZ_MODES, VIZ_BY_KEY, VIZ_CYCLE, simulatesDisability } from './render/viz-modes.js'; // Fase 2: modos visuais de a11y (dados)
import { PAD_DESIGNS } from './input/devices.js'; // Fase 2: rótulos de gamepad/toque (dados)
import { keys, padCur, padPrevAct, held } from './input/state.js'; // Fase 2.22: estado de input + held
import { audioCtx, ensureAC, SFX, soundOn, volume, setSoundOn, setVolume, audioOut, hearingLoss, setHearingLossGraph, setMasterMuted, audioCat, initAudioMixer, catNode, setCatGain, tone, tonePan, noiseBuffer, noiseHit, _footCount } from './platform/audio.js'; // Fase 2: base + mestre + mixer + sínteses (oscilador + ruído)
import { gameSay } from './platform/speech.js';
import { createAudioJingles } from './platform/audio-jingles.js'; // Tier 2 (áudio r1): jingles de vitória/enigma/fogos
import { createAudioEarcons } from './platform/audio-earcons.js'; // Tier 2 (áudio r2): earcons (sfx) + porta + legendas
import { createAudioNav } from './platform/audio-nav.js'; // Tier 2 (áudio r3): pistas espaciais (bengala/sonar/guarda/guia/nado)
import { createAudioAmbient } from './platform/audio-ambient.js'; // Tier 2 (áudio r4): trilha de ambiente + trovão
import { createTts } from './platform/tts.js'; // Tier 2 (#38): narração por voz (Piper neural lazy + fallback Web Speech)
import { SPR, TEX_IDLE, TEX_WALK, TEX_RUN, FLAVORS, TEX_JUMP_UP, TEX_JUMP_DOWN, TEX_CLIMB, TEX_FLY, TEX_CLING_WALL, TEX_CLING_CEIL, TEX_SWIM, TEX_SWIMIDLE, initCharacterSprites } from './render/sprites.js';
import { makeCanvas, tex } from './render/canvas.js';
import { CENARIOS, THEME_FLORA, hexN } from './render/cenario-data.js'; // D2-b: catalogo dos cenarios (folha: dado puro, zero deps)
import { PARALLAX, createParallax } from './render/parallax.js'; // D2-b: as 3 camadas de fundo — fatores, rolagem e troca de tema
import { createSetCenario } from './render/set-cenario.js'; // D2-b: a troca de cenario (orquestracao; leva o loadTileImages)
import { createSceneSky } from './render/scene-sky.js'; // Tier 2 (#43): céu — nuvens (#21) + decor viva da v3
import { coinCanvas, treeCanvas } from './render/props.js';
import { createCityTextures } from './render/city-tex.js'; // D3-a: arte procedural da rua (bichos, pedestres, carros)
import * as weather from './render/weather.js'; // Onda A: clima visual (chuva/trovao/clarao)
import { lqFilter, setLq, getLqT, initLqFilter } from './render/lq-filter.js'; // Onda A: realce de contraste L->Q
import * as traffic from './game/traffic.js'; // Onda A: carros + semaforo da rua da frente
import * as life from './game/life.js'; // Onda A: vida ambiente (pombos/gatos/caes/adultos)
import { initSceneCity } from './render/scene-city.js'; // Onda A: deco da Cidade + fx de tiles vivos
import { initTextures, SHAPE_TEX, letterTexture, pupTexFor } from './render/textures.js'; // Onda A: texturas de moeda/forma/letra + power-up
import { DIRECT_CFG, HC_ROLE, HC_ROLE_DEF, saveHcRole, coinTexFor, directSpriteCanvas, clearWorldTexCache, initHighContrast } from './render/high-contrast.js'; // Onda A: Renderizacao Direta (alto contraste)
import { initCoinSpawning, rebuildCoins, showPower, getCoinSprites } from './game/coin-spawning.js'; // Onda A: materializacao dos sprites de moeda
import { initKeyboardRuntime } from './input/keyboard-runtime.js';
import { initTouchBindings } from './input/touch-bindings.js'; // D3-b: gesto de toque -> entrada (traducao + geometria)
import { initKeydown } from './input/keydown.js'; // D2-a: o roteador de teclado (a cadeia de precedencia) // Onda A: esquema de teclas por jogador
import { initTouch, padLayoutFromId } from './input/touch.js'; // Onda A: geometria fisica do pad + config de toque
import { initGamepad } from './input/gamepad.js'; // Onda A: leitura da Gamepad API + assistente de mapeamento
import { initActivitiesMenu, attachAbbr, QL_NAME, PM_BTNS } from './ui/activities-menu.js'; // Onda A: menus do titulo + inicio de partida
import { initPauseIcons, iconsMarkup } from './ui/pause-icons.js';
import { initShell } from './ui/shell.js'; // C3: a casca — em que TELA o jogo esta (fase, pausa, legenda do titulo)
import { initMenuNav } from './ui/menu-nav.js'; // C3: navegacao universal de menus (teclado/controle/olhos/fala) // Onda A: menu de pausa por tela + barra de icones de a11y
import { initHud } from './ui/hud.js'; // Onda A: HUD por tela (moedas/poder/abandono/selo de espera)
import { initScreenPipeline } from './render/screen-pipeline.js'; // D3-c: topologia do render por tela (grade, render-textures, molduras, bolinhas)
import { initSecretAreas } from './game/secret-areas.js'; // D3-c: area secreta revelada por presenca + anuncio ao leitor de tela
import { initMapHub } from './ui/map-hub.js'; // D3-c: painel "Mapear controles" do menu de Movimento
import { initPhysics, stepPlayer as stepPhysics } from './game/physics.js'; // B1: fisica do jogador (ancorada nas trajetorias-ouro)
import { initQuiz } from './game/quiz.js'; // B3: o desafio educativo (geracao + markup + efeito)
import { initSettingsPanel } from './ui/settings-panel.js'; // B4: o que as cascas dos paineis realmente compartilham
import { initViewports } from './render/viewports.js'; // B2: fabrica de imagem dos modos de visao
import { initSession, MODE_LABELS, MODES } from './game/session.js'; // C2: o ciclo de vida da RODADA
import { initDraw } from './render/draw.js'; // C1: camera + o quadro + a escolha de quadro do personagem
import { initVizSetters } from './render/viz-setters.js'; // Onda A: aplicacao dos modos de visao acessivel
import { roleOf } from './game/tile-roles.js'; // Passo 7: a tabela tile->papel e' do JOGO, nao do alto contraste
import { initLevelGeometry, buildRamps, buildRopes, drawElevators, buildDarkRegions, buildWcGeom as lgBuildWcGeom, rebuildExtras as lgRebuildExtras, setupExtras as lgSetupExtras } from './game/level-geometry.js'; // Onda A: rampas/cordas/elevador/escuridao/extras
if(typeof window!=='undefined') window.__tiles = tiles; // hook de teste (Preview); world.js passa a usar na etapa 2
initCharacterSprites(); // cria as texturas do personagem no boot — o import de sprites.js é PURO (sem I/O). Fase 2.24
initAudioMixer();        // carrega o estado do mixer no boot — o import de audio.js é PURO (não lê localStorage). Fase 2.25
// Versão vem do CARIMBO DE BUILD (git describe → tag de marketing na produção; SHA nos demais). Injetado pelo
// Vite (__BUILD__, ver vite.config.ts). Tira o 'v' inicial da tag (o display já prefixa 'v'). Fallback defensivo.
const INCL_VERSION = String((typeof __BUILD__ !== 'undefined' && __BUILD__.version) || '4.164.25').replace(/^v/, '');
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
import { CRT, applyCrt } from './render/crt.js'; // Estágio 4 (Tier 1): estética CRT (scanlines/vinheta/cantos)
import { initMinimap, markSeen, redrawMinimapIfDirty, drawMinimapPlayer, resetMinimap, setMinimapVisible, getMinimap, minimapSeenCount } from './render/minimap.js'; // Estágio 4 (Tier 1): minimapa + fog-of-war
import { vlibrasSay, vlibrasOpen, toggleLibras, vlTick, librasOpen, setOnLibrasChange } from './ui/vlibras.js'; // Estágio 4 (Tier 1): intérprete VLibras (modo pessoa surda)
import { layout } from './ui/layout.js'; // Estágio 4 (Tier 1): escala do jogo (múltiplo inteiro de 320×180 em px reais)
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
  wcSolid: ()=>wcSolid, gateTiles: ()=>gateTiles, gateOpen: ()=>gateOpen });
initCoins({ world: WORLD, W: WORLD_W, H: WORLD_H, anyEasy: ()=>anyEasy(), isWheelchair: ()=>wheelchair }); // Estágio 4: posicionamento de coletáveis (usa solidAt já ligado acima)
// Itens do mapa Clarity → viram ITENS/barreira (não tiles): 7=pulo-turbo, 8=voo, 11=chave; 10=portão.
// Removemos o tile do grid (vira ar) e o item/barreira é desenhado/colidido à parte; some ao pegar/abrir.
const MAP_ITEMS=[], MAP_GATE=[];
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
const hexRgb=h=>{ const m=/^#?([0-9a-f]{6})$/i.exec(h); if(!m)return null; const n=parseInt(m[1],16); return [n>>16&255,n>>8&255,n&255]; };
// _roleOf/worldToTextureDirect/directBgTexture/directSpriteCanvas/directSpriteTexture migraram para
// render/high-contrast.ts (Onda A).
// Alto contraste (re-adicionado): recolore cada tile pela PALETA do grupo (gradient-map por matiz, mantém claro-escuro).
// coinCanvas/coinTexture/treeCanvas/treeTexture migrados p/ render/props.js (Fase 2.19)

/* ===================== moedas (spawn real) ===================== */
// findCoinCandidates/pickCoins/takeCoin extraídos p/ game/coins.js (Estágio 4, posicionamento).
// RNG semeado (rnd/randInt/shuffle/_seed) migrado p/ core/rng.js (Fase 2.26 / Tier 1)
// modos de jogo
let MODE='ludico'; // 'ludico' | 'somasub' (silabas vem na E7)
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
const disp=(s)=> letterCase==='upper'?String(s).toUpperCase():String(s);
// E8: Braille (modo pessoa cega). Padrão de pontos da cela por letra (Grau 1, PT).
// BRAILLE/NUMW/brailleText extraídos p/ game/braille.js (Estágio 4).
// `blindMode` REMOVIDO: era escrito só por applyLetra a partir de `LETRA[i].blind`, e as duas entradas da
// tabela têm `blind:false` desde que o Braille saiu do ciclo do botão ABC (ver o comentário da LETRA). Nascia
// falso e nunca mudava. Quem decide o ditado passivo hoje é o Modo cego (a11y) e o nível 5.
// Lote C: cada jogador tem SEU conjunto de n itens em posições ALEATÓRIAS próprias e com a COR do dono
// (owner). Todos os itens de todos os jogadores existem no mundo; cada um coleta só os `owner===seu i`.
// pickCoins extraído p/ game/coins.js; aqui só o cálculo dos POOLS a partir do MODE (coins não conhece MODE/quiz).
const coinPools=()=>({ shapes: MODE==='somasub'?SOMASUB_SHAPES.map(s=>s.id):[], letters: MODE==='silabas'?WORD_INITIALS:[] });

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
const POWER_MSG = (k) => t(k === 'off' ? 'sr.power.none' : POWER_KINDS.includes(k) ? 'sr.power.' + k : 'sr.power.generic');
// Ícones canônicos dos power-ups (decisão do José 2026-07-02): 👟 corrida/bengala · 🕷️ escalada · 🎈 voo (jetpack) · 🐇 super pulo · 🦘 ultra pulo
/** Rótulo curto do HUD. Desconhecido cai em `off` ('—'), que era o `|| '—'` de cada consumidor. */
const POWER_SHORT = (k) => t('hud.power.' + (POWER_SHORT_KINDS.includes(k) ? k : 'off'));
// showPower migrou para game/coin-spawning.ts (Onda A) — o HUD do poder ativo nasce do mesmo modulo que
// materializa os itens.
// jumpVel + isBouncyGroundBelow/touchingWall/clingSides/firstClingSide/spiderReattach/wrapConvex → game/player.js (Estágio 4)
players.push(makePlayer(0)); let player=players[0]; // 'players' vem de core/state.js (Fase 2, mega-var 8; nunca reatribuído, só mutado in-place); 'player'=players[0] fica local
// 'numPlayers' agora vem de core/state.js (Fase 2, mega-variável 3). Escrita via setNumPlayers()/joinPlayer.
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
const kbRuntime = initKeyboardRuntime({ getKB: () => kb, getNumPlayers: () => numPlayers, getPlayers: () => players });
const kbFor = (i) => kbRuntime.kbFor(i);
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
  attractOnInput: () => attractCtl.onInput(),
  handleCaptureKeydown: (e) => ctrlPanel.handleCaptureKeydown(e),
  getNumPlayers: () => numPlayers, getPlayers: () => players,
  getControls: () => kbRuntime.controlsState(),
  heldKeys: keys, isOneButton: () => oneButton,
  actionOf: (code, i) => kbRuntime.actionOf(code, i),
  whichPlayer: (code) => kbRuntime.whichPlayer(code),
  $, escapeTarget: () => overlays.escapeTarget(), closeOverlayById: (id) => overlays.closeById(id),
  closePadWiz: (save) => gamepadApi.closePadWiz(save),
  hideTouchControls: (r) => hideTouchControls(r), srSay: (m) => srSay(m),
  navTitle: (k) => navTitle(k), activateScreens: (n) => activateScreens(n), togglePause: () => togglePause(),
  quizMove: (pl, d) => quizMove(pl, d), quizConfirm: (pl) => quizConfirm(pl), quizErase: (pl) => quizErase(pl),
  announceBraille: (pl) => announceBraille(pl),
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
// SFX (definições de som) extraído p/ platform/audio.js (Fase 2).
let capTimer=null; // `captionsOn` migrou para core/state.js (#50); soundOn/volume/audioCtx vêm de platform/audio.js
const anyEasy=()=>players.some(p=>p.easy); // efeitos de MUNDO do Fácil (moedas no chão) ligam se QUALQUER jogador usa Fácil
// Modo Fácil (deficiência motora): gravidade ×2/3, pulo ×8/7, andar ×0.7, sem perigos, sem correr,
// hitbox de coleta +4px, moedas no chão, proteção de borda, pula-pula suave (segurar = flutuar descendo).
// EASY (modo fácil) migrado p/ core/constants.js (Estágio 4, dado de dificuldade — junto de TUNE/ANIM).
// Movimento reduzido (WCAG 2.3.3 AA). 5 alvos; padrão herda prefers-reduced-motion; persistido.
// Hoje agem 'parallax' e 'walk'; 'decor/items/particles' ficam prontos e ligam quando a Cidade animar.
const RM_KEYS=['parallax','decor','items','particles']; // animações de CENA (globais)
// `lbl` guarda a CHAVE i18n, nao o texto: ui/settings-motion resolve com t() na hora de desenhar a linha.
// Era texto em portugues repetido palavra por palavra na RM_LABEL daquele modulo — tres tabelas dos mesmos
// rotulos (esta, a de la, e uma TERCEIRA morta aqui embaixo), e mudar um rotulo pedia tres edicoes.
const RM_CHAR=[ {k:'walk',prop:'rmWalk',lbl:'rm.walk'},
  {k:'breath',prop:'rmBreath',lbl:'rm.breath'}, {k:'flavor',prop:'rmFlavor',lbl:'rm.flavor'} ]; // animações do PERSONAGEM (por jogador)
// O padrão ganhou nome em core/state (defaultReducedMotion) porque o reset do painel precisa do MESMO valor.
const rm=(()=>{ const s=store.getJSON(store.KEYS.reducedMotion,null); if(s&&typeof s==='object'){ const o={}; RM_KEYS.forEach(k=>o[k]=!!s[k]); return o; }
  const o={}; RM_KEYS.forEach(k=>o[k]=defaultReducedMotion()); return o; })();
function saveRM(){ store.setJSON(store.KEYS.reducedMotion,rm); }
// Movimento por alternância (1 dedo): tocar a direção trava a marcha; segurar acelera; pulo não interrompe. Persistido.
function loadPlayerA11y(p,i){ const v=store.get(store.KEYS.vizP(i)); if(v&&VIZ_BY_KEY[v])p.viz=v;
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
function setToggleMove(i,on){ const p=players[i]; if(!p)return; p.toggleMove=on; store.setBool(store.KEYS.toggleMoveP(i),on); if(!on)p.walkDir=0;
  srSay((numPlayers>1?'Jogador '+(i+1)+': ':'')+'Movimento por alternância '+(on?'ligado: toque a direção para andar sem segurar; toque de novo para parar; segure para ir mais rápido. O pulo não interrompe a caminhada.':'desligado.')); }
function showCaption(txt){ const el=$('#caption'); if(!el||!txt)return; el.textContent=txt; el.classList.add('show'); clearTimeout(capTimer); capTimer=setTimeout(()=>{el.classList.remove('show'); el.textContent='';},1300); }
// Earcons + ponte com legendas extraídos p/ platform/audio-earcons.ts (Tier 2, áudio rodada 2). captionsOn/showCaption
// VIVEM aqui (UI alterna captionsOn; win() reusa showCaption) → entram por injeção. Chamado como earcons.sfx(...).
const earcons = createAudioEarcons({ SFX, ensureAC, catNode, audioOut, noiseHit,
  getSoundOn: () => soundOn, getVolume: () => volume, getCaptionsOn: () => captionsOn, showCaption });
// ===== Vitória: jingle 8-bit ascendente + fogos de artifício (assobio subindo → estouro/crepitar) =====
// ensureAC() (ciclo do AudioContext) extraído p/ platform/audio.js (Fase 2).
// Modo empatia — perda auditiva: passa-baixas (perda de agudos) + EXPANSÃO DESCENDENTE (frames fracos abafados → dificulta a fala).
// Todos os sons passam por um nó mestre; a cadeia é religada quando o modo liga/desliga.
// Nó mestre (hearingLoss/audioOut/buildHearingChain/wireMaster) extraído p/ platform/audio.js (Fase 2).
function setHearingLoss(on){ setHearingLossGraph(on); store.setBool('incl_hearingloss',on); // grafo em platform/audio.js; persistência via store
  srSay(t(on?'sr.empathy.hearingOn':'sr.empathy.hearingOff')); }
// ===== F1: barramento de áudio por CATEGORIA (cada uma: liga/desliga + volume). Pendura no nó mestre. =====
// AUDIO_CATS (categorias) + carga/persistência + default TTS-off extraídos p/ platform/audio-mixer.js (Fase 2).
// audioCat + catNode + setCatGain (mixer por categoria) extraídos p/ platform/audio.js (Fase 2).
// ===== F2: efeitos de interação com o ambiente (passos por superfície, portas, escada) — ruído filtrado sintetizado =====
// noiseBuffer + FOOT + noiseHit + _footCount (synth de ruído) extraídos p/ platform/audio.js (Fase 2). _noiseBuf era var morta.
// material sob os pés (Cidade = concreto → 'piso') — usado pelo som do PASSO (main.js); não é pista espacial, fica aqui.
function surfaceUnder(pl){ const tile=tileAt(Math.floor(pl.x/TILE),Math.floor((pl.y+1)/TILE)); if(tile!==2&&tile!==6&&tile!==5)return null; return CENARIO==='cidade'?'piso':'pedra'; }
const caneOn=(pl)=>{ const m=VIZ_BY_KEY[pl.viz]; return modoCego || !!(m&&(m.kind==='blind'||m.kind==='lowvision')); }; // predicado de visão (movimento/render) — fica no main.js
// caneColor extraído p/ render/wheelchair-sprites.js (Estágio 4).
// TTS (narração por voz: Piper neural lazy + fallback Web Speech) extraído p/ platform/tts.ts (Tier 2, #38). Criado ANTES do
// audio-nav porque o nav injeta narrate. As funções de painel (populateTTS*/reflectTTS) ficam no main.js (→ #54) e usam get/set.
const tts = createTts({ srSay, srAlert, ensureAC, catNode, audioOut, getSoundOn: () => soundOn, getVolume: () => volume, getAudioCat: () => audioCat });
// Pistas espaciais a11y (bengala · sonar · guarda de beirada · guia · nado, por dispositivo) extraídas p/ platform/audio-nav.ts
// (Tier 2, áudio r3). playerCtx/panFor/needsAudioCues expostos na API porque a guarda de beirada + o gate de movimento os
// chamam de fora do cluster. Estado do guia (_guideCount) e SURF_MAT vivem agora no módulo. Uso: nav.<fn>.
const nav = createAudioNav({ tileAt, solidAt, held, tonePan, noiseHit, srSay, narrate: tts.narrate, BOX, TILE, LOGICAL_W, VIZ_BY_KEY,
  getCoins: () => coins, getPlayers: () => players, getNumPlayers: () => numPlayers, getCenario: () => CENARIO,
  getModoCego: () => modoCego, getAudioCtx: () => audioCtx, getSoundOn: () => soundOn, getAudioCat: () => audioCat });
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
$('#pixi-mount').appendChild(app.view);
app.view.setAttribute('aria-hidden','true');
const camera=new PIXI.Container(); app.stage.addChild(camera);
weatherLayer=new PIXI.Graphics(); app.stage.addChild(weatherLayer); // CLIMA (chuva/clarão) em tela-espaço, mantido no topo em draw
weather.initWeather({ weatherLayer, stage: app.stage, screen: app.screen, getRm: () => rm, thunder: (i) => ambient.thunder(i) });
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
  camera, TilingSprite: PIXI.TilingSprite,
  placeholderTex: parallaxPlaceholder, skyTex: themeSkyTexture, hillsTex: themeHillsTexture, // render/scene-parallax
  Imagem: Image, texturaDeImagem: (img) => PIXI.Texture.from(img), escalaNearest: PIXI.SCALE_MODES.NEAREST,
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
  setWorldTextures: (cv, t) => { worldCanvasNormal = cv; worldTexNormal = t; }, // `let` declarados ABAIXO (so escritos no .then)
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
initLqFilter({ onChange: () => { if(app&&app.view){ if(numPlayers<=1)applyVizGlobal(players[0].viz); else app.view.style.filter=lqFilter(); } } });
// vizMode vem de core/state.js (Fase 2, mega-var 6). Init de boot SEM persistir (preserva o rastreio de prefers-contrast):
initVizMode((()=>{ try{ const v=store.get('incl_viz',null); if(VIZ_CYCLE.includes(v))return v; }catch(e){}
  return (window.matchMedia && matchMedia('(prefers-contrast: more)').matches) ? 'hc-direto' : 'normal'; })()); // prefere-contraste → alto contraste 3:1
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
  getLvOverlaySpr: () => lvOverlaySpr, renderer: app.renderer, getVpTex: () => vpTex,
  cvdDefsHost: $('#cvd-defs'),
});
const { parallaxTexFor, treeTexFor, playerVizTex, pixiFilterFor, renderVpOverlay } = vp;
try{ setCenario((v=>v==='noite'?'espaco':v)(store.getComLegado(store.KEYS.cenario,store.KEYS.cenarioLegado,'cidade'))); }catch(e){ setCenario('cidade'); } // herda a chave de escopo antigo; 'noite' e a migracao mais velha ainda
const coinCanvasNormal=coinCanvas();
const coinTex=tex(coinCanvasNormal);
// As texturas NORMAIS ja existem: ligue o alto contraste. worldCanvasNormal/worldTexNormal sao `let`
// (setCenario os reescreve ao trocar de tema), entao entram por getter e nao por valor.
initHighContrast({ W: WORLD_W, H: WORLD_H, roleOf, outlineFg: () => hcOutlineFg, outlineBg: () => hcOutlineBg,
  getWorldCanvasNormal: () => worldCanvasNormal, getWorldTexNormal: () => worldTexNormal,
  coinCanvasNormal, coinTexNormal: coinTex });
// caches de modos acessíveis (preguiçosos), invalidados ao trocar de cenário (worldCanvasNormal muda)
let _lastSharedViz=null; // cache do modo aplicado (otimizacao do render MP) — NAO e do alto contraste:
// e escrito por rebuildCoins/rebuildExtras/applySharedTextures/setPlayerViz/reapplyVizAll. Fica aqui.
// _worldTexHC/_coinTexHC/worldTexFor/coinTexFor migraram para render/high-contrast.ts (Onda A).
// shapeTexture/SHAPE_TEX/letterTexture migraram para render/textures.ts (Onda A). O init vem AQUI porque
// o primeiro uso (rebuildCoins, logo abaixo) precisa dos caches ja preenchidos.
initTextures({ shapes: SOMASUB_SHAPES.map(s => s.id), disp, directCfg: DIRECT_CFG, directSpriteCanvas });
const coinContainer=new PIXI.Container(); camera.addChild(coinContainer);
// coinSprites/rebuildCoins migraram para game/coin-spawning.ts (Onda A). rebuildCoins mantem o contrato
// SEM argumentos: os nove chamadores (boot, novo round, quatro paineis de acessibilidade, Modo Facil,
// silabas, restart) nao mudam — so a definicao saiu daqui.
initCoinSpawning({ coinContainer, createSprite: (t) => new PIXI.Sprite(t), coinTexFor,
  shapeTexFor: (id) => SHAPE_TEX[id], letterTexFor: letterTexture, pcolor: PCOLOR,
  getMode: () => MODE, getOwnerColors: () => ownerColors, invalidateSharedViz: () => { _lastSharedViz=null; },
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
initLevelGeometry({ W: WORLD_W, H: WORLD_H, isWheelchair: () => wheelchair,
  rampLayer, ropeLayer, extraLayer,
  wcSolid: () => wcSolid, powerups: () => powerups, gateTiles: () => gateTiles, gate: () => gate, gateOpen: () => gateOpen,
  pupTexFor, isDirectMode: (mode) => !!DIRECT_CFG[mode], gateRoleColor: () => HC_ROLE.gate });
// Envolucros finos: o modulo CALCULA e DESENHA; o estado compartilhado (powerups/gate/wcSolid) segue morando
// aqui porque colisao e o laco do jogador tambem o leem e escrevem.
function rebuildExtras(){ lgRebuildExtras(); _lastSharedViz=null; }
function setupExtras(){
  setDecorSeedValue((Math.random()*1e9)>>>0); // #69: nova semente por fase
  const _blind = modoCego || players.some(p=>{const m=VIZ_BY_KEY[p.viz];return m&&m.kind==='blind';});
  setLevelExtras(lgSetupExtras(MAP_ITEMS, MAP_GATE, { wheelchair, blind:_blind })); // era desestruturação em bloco; binding importado não se atribui
  rebuildExtras();
}
setupExtras();

// Fácil: retângulo translúcido mostrando a hitbox de coleta tolerante (sob o player)
const easyHitbox=new PIXI.Graphics(); camera.addChild(easyHitbox);
// Cadeirante: RAMPAS desenhadas sobre os degraus de 1 tile (sobre o mundo, abaixo do player)
camera.addChild(rampLayer);   // ordem pelo Z.SCENERY_INTERACT (bloco R1), não pela posição de inserção
// buildRamps + WC_BRIDGES migraram para game/level-geometry.ts (Onda A).
// WC_ELEVATORS (fossos só-cadeirante) movidos p/ game/elevators.js (Estágio 4).
function buildWcGeom(){ setWcSolidValue(lgBuildWcGeom(wheelchair)); } // o módulo calcula; o estado mora em core/state
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
function inDark(tx,ty){ for(const r of darkRegions){ if(r.set.has(tx+','+ty))return true; } return false; } // célula de área secreta?
function lifeSurfaceAt(tx){ for(let ty=3;ty<WORLD_H-1;ty++){ if(solidAt(tx,ty)&&!solidAt(tx,ty-1)&&tileAt(tx,ty-1)!==3&&tileAt(tx,ty)!==9&&tileAt(tx,ty-1)!==9&&!inDark(tx,ty-1)) return ty; } return -1; } // superfície AO AR LIVRE (fora das secretas), a MAIS ALTA; ty-1!==9 = nada spawna DENTRO da lava
function lifeSurfaceLowAt(tx){ for(let ty=WORLD_H-2;ty>3;ty--){ if(solidAt(tx,ty)&&!solidAt(tx,ty-1)&&tileAt(tx,ty-1)!==3&&tileAt(tx,ty)!==9&&tileAt(tx,ty-1)!==9&&!inDark(tx,ty-1)) return ty; } return -1; } // idem, a MAIS BAIXA (calçada/fachada); ty-1!==9 = fora da lava
let _streetCols=null; // colunas ABERTAS da rua/fachada (superfície mais baixa, fora das secretas) — computadas 1×
function streetCols(){ if(_streetCols)return _streetCols; _streetCols=[];
  for(let tx=2;tx<WORLD_W-2;tx++){ const ty=lifeSurfaceLowAt(tx); if(ty>0&&ty*TILE>WORLD_PX_H*0.55)_streetCols.push([tx,ty]); }
  return _streetCols; }
life.initLife({ layer: lifeLayer, makeSprite: (t) => new PIXI.Sprite(t), lifeTex: CITY_TEX.lifeTex, adultTex: CITY_TEX.adultTex,
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
traffic.initTraffic({ carLayer, CAR_TEX: CITY_TEX.carTex, SpriteCtor: PIXI.Sprite, GraphicsCtor: PIXI.Graphics,
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
const CLOUD_TEX=[0,1].map(v=>{ const w=v?46:30,h=v?12:9,cv=makeCanvas(w,h),c=cv.getContext('2d');
  c.fillStyle='rgba(225,232,244,0.85)';
  c.fillRect(4,4,w-8,h-5); c.fillRect(0,6,w,h-7); c.fillRect(8,0,w-20,6); c.fillRect(w-16,2,10,5);
  return tex(cv); });
const BIRD_TEX=[0,1].map(f=>{ const cv=makeCanvas(7,4),c=cv.getContext('2d'); c.fillStyle='#20242e';
  if(f===0){ c.fillRect(0,0,3,1); c.fillRect(4,0,3,1); c.fillRect(2,1,3,1); } else { c.fillRect(0,2,3,1); c.fillRect(4,2,3,1); c.fillRect(2,1,3,1); }
  return tex(cv); });
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
const sceneSky = createSceneSky({ skyLayer, starsG, skyDecoG, nuvemG, fogG, grassG, themeFxG, themeFxBackG, CLOUD_TEX, BIRD_TEX, SpriteCtor: PIXI.Sprite,
  hexN, rnd, randInt, WORLD_PX_W, WORLD_PX_H, WORLD_W, WORLD_H, TILE, LOGICAL_W, LOGICAL_H, BOX,
  CENARIOS, THEME_FLORA, DIRECT_CFG, solidAt, tileAt,
  getCenario: () => CENARIO, getVizMode: () => vizMode, getPlayers: () => players, getFxClock: () => fxClock, getRm: () => rm,
  getAglomeracao: () => weather.getAglomeracao(), // o MESMO relógio da chuva: as nuvens fecham antes da 1ª gota
  getGrassDensity: () => grassDensity, getDecorSeed: () => decorSeed });
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
initFx({ fxG, rm }); // Estágio 4: liga o módulo fx à camada PIXI + reduce-motion
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
  for(let i=allPSprites.length;i<numPlayers;i++){ const s=new PIXI.Sprite(TEX_IDLE[0]); s.anchor.set(0.5,1); s.zIndex=Z.PLAYER; camera.addChild(s); allPSprites.push(s); }
  // (re-add-ao-topo removido — fxG/carLayer/themeFxG/fogG governados pelo zIndex canônico (bloco R1); sortableChildren re-ordena; #69)
  allPSprites.forEach((s,i)=>{ s.visible=i<numPlayers; s.tint=PCOLOR[i]||0xffffff; if(i<numPlayers)players[i].sprite=s; });
}
let vpTex=[], vpSpr=[], vpFrames=null, vpDots=[];
// HUD por jogador em DOM SOBREPOSTO (alta definição, não pixela): moedas (1ª coluna) + poder (2ª coluna), por viewport.
let vpPause=[]; // `pauseActor` migrou para core/state.js (#50). gameHudEl/vpHudDom/vpQuitDom/vpScreens -> ui/hud.ts
// Menu de pausa POR TELA (Etapa 2): um por jogador, dentro da .player-screen dele.
// Barra de atalhos de a11y no topo da pausa (por tela). Sons (cego/TTS) só com saída própria; webcam/voz em construção.
/* ===================== PAUSA POR TELA + ICONES DE A11Y -> ui/pause-icons.ts =====================
   PAUSE_ICONS, calmMode, buildScreenPause, hasPrivateOutput, applyCalm, iconAct, iconLabel,
   reflectIconBtn e reflectPauseIcons migraram. `pauseActor` FICA aqui (seis leitores fora do modulo,
   e o ctx do gamepad ja o escreve); o modulo so escreve, por setPauseActor. `pauseActs` entra por
   GETTER porque e um const ~1200 linhas abaixo — passa-lo direto explodiria na TDZ no boot. */
const pauseIcons = initPauseIcons({
  srSay, srAlert,
  pmButtons: PM_BTNS, qlName: QL_NAME,
  getPauseActs: () => pauseActs,            // LAZY: pauseActs e const bem abaixo (TDZ)
  setPauseActor: setPauseActorValue,
  getPauseScreens: () => vpPause,           // buildGameHud REATRIBUI vpPause -> getter, nao a array
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
  setToggleMove, setPlayerViz,
});
const reflectPauseIcons = () => pauseIcons.reflectPauseIcons();
function reflectTitleIcons(){ pauseIcons.reflectIconsIn($('#title-icons'),0); } // icones do SPLASH (escopo do J1)
// Contêiner "tela do jogador" por viewport (Etapa 1): hospeda o HUD; nas próximas etapas, a pausa e os menus.
/* ===================== HUD POR TELA -> ui/hud.ts =====================
   O painel de pausa NAO e do HUD: entra como fabrica injetada e o modulo so anexa o retorno — foi isso
   que permitiu extrair os dois em paralelo sem se tocarem. Os paineis criados dentro do laco voltam
   pelo gancho, porque `vpPause` e binding daqui e modulo nao reatribui binding alheio. */
const hud = initHud({
  hudTarget: COIN_TARGET, $, powerShort: POWER_SHORT,
  buildScreenPause: (i) => pauseIcons.buildScreenPause(i),
  onScreensBuilt: (panes) => { vpPause = panes;
    // No 1o build do init, LETRA/PAD_DESIGNS ainda estao em TDZ — o try/catch ignora e o fluxo de init
    // preenche logo depois. Preservado verbatim, inclusive o engolir de qualquer erro.
    try{ applyLetra(false); }catch(e){}
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
  RenderTexture: PIXI.RenderTexture, SpriteCtor: PIXI.Sprite, GraphicsCtor: PIXI.Graphics, NEAREST: PIXI.SCALE_MODES.NEAREST,
  stage: app.stage, renderer: app.renderer, camera,
  getNumPlayers: ()=>numPlayers,
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
  isWheelchair: ()=>wheelchair, isModoCego: ()=>modoCego, caneOn, WORLD_PX_H: ()=>WORLD_PX_H,
  sfx: (n)=>earcons.sfx(n), srSay, srAlert, hideTips, showPower, nav,
  tonePan, noiseHit, surfaceUnder,
  puffDust, setSquash, addShake, addHitstop, POWER_MSG,
  coinPools: ()=>coinPools(), rebuildCoins, updateHud,
});
function stepPlayer(pl,dt){
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
function update(dt){
  if(phase!=='playing')return; // E14: congelado no título e na pausa
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
  if(ended)return;
  players.forEach((p,i)=>{ if(p.quit&&p.jumpEdge){ p.jumpEdge=false; respawnPlayer(i); } }); // L1: quem saiu re-entra pelo PULO do teclado (ou START do pad, no pollPads)
  for(const pl of players) stepPlayer(pl,dt);
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
  camera, renderer: app.renderer,
  BOX, // a caixa do jogador ENTRA (como ja entrava em scene-city/scene-sky/audio-nav), nao e' importada la
  caneLayer, chairLayer, easyHitbox,
  getVpTex: ()=>vpTex, isWheelchair: ()=>wheelchair, getFxClock: ()=>fxClock, getPowerups: ()=>powerups,
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
function openQuiz(pl,coinIndex,shapeId){ quizApi.openQuiz(pl,coinIndex,shapeId); }
function openSilabas(pl,coinIndex,letter){ quizApi.openSilabas(pl,coinIndex,letter); }
function renderQuiz(pl){ quizApi.renderQuiz(pl); }
function closeQuiz(pl){ quizApi.closeQuiz(pl); }
function quizMove(pl,d){ quizApi.quizMove(pl,d); }
function quizConfirm(pl){ quizApi.quizConfirm(pl); }
function quizErase(pl){ quizApi.quizErase(pl); }
function announceBraille(pl){ quizApi.announceBraille(pl); }
function respawnFigure(i){
  const occ=new Set(); coins.forEach((c,j)=>{ if(j!==i)occ.add(c.x+','+c.y); });
  for(const cand of shuffle(findCoinCandidates())){ const x=cand.tx*TILE+3,y=cand.ty*TILE+3;
    if(!occ.has(x+','+y)){ coins[i].x=x;coins[i].y=y;coins[i].taken=false; // dono (owner) preservado
      const s=getCoinSprites()[i]; s.x=(MODE==='somasub')?x-3:x; s.y=(MODE==='somasub')?y-3:y; s.visible=true; return; } }
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
  $, librasReserve: ()=>0, // o intérprete NÃO empurra mais a tela (ver ui/vlibras + ui/layout); fica p/ o overlay sob demanda
  isCoarsePointer: ()=>{ try{ return matchMedia('(pointer:coarse)').matches && matchMedia('(hover:none)').matches; }catch(e){ return 'ontouchstart' in window; } },
  getMode: ()=>MODE, setModeValue: (m)=>{ MODE=m; },
  setEnded: setEndedValue,
  getPowerups: ()=>powerups, getGate: ()=>gate, isGateOpen: ()=>gateOpen, setGateOpen: setGateOpenValue,
  getPauseActor: ()=>pauseActor, ownerColors: ()=>ownerColors, captionsOn: ()=>captionsOn,
  PCOLOR, darkRegions, getPlayerRef: ()=>player, setPlayerRef: (p)=>{ player=p; },
  srSay, srAlert, narrate: (t)=>tts.narrate(t),
  sfx: (n)=>earcons.sfx(n), doorSound: (m)=>earcons.doorSound(m), playVictory: ()=>jingles.playVictory(),
  showCaption,
  burstSparkle, addShake, addHitstop, rnd,
  POWER_MSG,
  coinPools: ()=>coinPools(), setupExtras, rebuildExtras, resetMinimap,
  openQuiz: (pl,i,sh)=>openQuiz(pl,i,sh), openSilabas: (pl,i,l)=>openSilabas(pl,i,l), closeQuiz: (pl)=>closeQuiz(pl),
  loadPlayerA11y, assignControls, ensureSprites, configureRender,
  reapplyVizAll: ()=>reapplyVizAll(), layout, hideTouchControls, updateGameHud,
  setPhase, titleShow: (id)=>titleUI.show(id),
});
function updateHud(){ sessionApi.updateHud(); }
function win(pl){ sessionApi.win(pl); }
function restartGame(){ sessionApi.restartGame(); }
function setMode(m){ sessionApi.setMode(m); }
function setNumPlayers(n){ sessionApi.setNumPlayers(n); }
function fitsN(n){ return sessionApi.fitsN(n); }
function isMobile(){ return sessionApi.isMobile(); }
function activateScreens(n){ sessionApi.activateScreens(n); }
function respawnPlayer(k){ sessionApi.respawnPlayer(k); }
function joinPlayer(padIdx){ return sessionApi.joinPlayer(padIdx); }
function quitGame(){ sessionApi.quitGame(); }
$('#btn-again').addEventListener('click',()=>{ restartGame(); $('#game-region').focus(); });
/* ===================== ATIVIDADES (menu inicial) -> ui/activities-menu.ts =====================
   O menu do titulo, a escolha de atividade e o inicio da partida moram no modulo. Fica aqui so a
   composicao: MODE entra como ATRIBUICAO NUA (setMode() tambem reinicia a rodada e move o foco, que
   nao e o que escolher atividade faz), e CENARIOS entra reduzido a {id,nome} — o resto e dado de
   textura de parallax e nao tem o que fazer dentro de um menu. */
if(!isValidActivityId(ACTIVITY)) setActivityValue(DEFAULT_ACTIVITY_ID); // valida o valor inicial contra o catalogo
const activitiesMenu = initActivitiesMenu({
  $, getActiveElement: () => document.activeElement, srSay, srAlert,
  titleShow: titleUI.show,
  cenarios: Object.keys(CENARIOS).map(c => ({ id: c, nome: CENARIOS[c].nome })),
  setCenario,
  setModeValue: (m) => { MODE = m; },
  setQuizLevel, isMobile, fitsN, setNumPlayers, restartGame, setPhase, hideTips,
  enterFullscreen: () => { try{ const el=document.documentElement, rf=el.requestFullscreen||el.webkitRequestFullscreen; if(rf)rf.call(el); }catch(e){} },
});
const { actCat, setActivity, startActivity, reallyStart,
        navTitle, titleButtons, buildTitleMenus, tabSel, fracNot } = activitiesMenu;
// B3: o desafio educativo. So entra aqui o que um import nao alcanca: as `let` do main.js, as instancias
// criadas no boot (audio/HUD/menu) e os efeitos de outros slices (moeda, HUD, vitoria, toque). Os
// callbacks sao arrows de proposito: touchCtl, respawnFigure, win e updateHud nascem mais abaixo.
const quizApi = initQuiz({
  $, getScreen: (i) => hud.getScreen(i),
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
const optModeBtn=$('#opt-mode'); // botão único: cicla os 3 modos
if(optModeBtn)optModeBtn.addEventListener('click',()=>{
  const m=MODES[(MODES.indexOf(MODE)+1)%MODES.length]; setMode(m); srSay(t('sr.mode.set',{v:MODE_LABELS[m].replace(/^\S+\s/,'')})); /* MODE_LABELS ainda é pt-BR: ver a nota do item 14 no topo */
});
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
  getPhase: () => phase, setPhase,
  isAttractActive: () => attractCtl.isAttract(), stopAttract: () => attractCtl.stopAttract(),
  isTouchMode: () => document.body.classList.contains('touch-mode'), hideTouchControls: () => hideTouchControls(),
  getPlayers: () => players, getNumPlayers: () => numPlayers,
  navTitle, sharedDialogOpen, navDialog, getPauseMenu: (i) => vpPause[i], navPause,
  setPauseActor: setPauseActorValue,
  quizMove, quizConfirm, quizErase, announceBraille,
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
if(optTelasBtn)optTelasBtn.addEventListener('click',()=>{ activateScreens((numPlayers%4)+1); });
// Botão único de LETRAS: ABC (padrão) → abc → Braille
// L3: nível do quiz de alfabetização (1..5), persistido; rótulo vivo nos menus de pausa
function setQuizLevel(n,announce){ setQuizLevelValue(n); // core/state.js: clampa 1..5, persiste e emite; a reflexão de UI fica aqui
  document.querySelectorAll('.pm-nivel').forEach(x=>{ x.textContent='📚 Nível '+quizLevel+' · '+QL_NAME[quizLevel]; });
  if(announce) srSay(t('sr.quiz.levelSet',{n:quizLevel,v:QL_NAME[quizLevel]})); } // QL_NAME ainda é pt-BR
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
  if(typeof rebuildCoins==='function' && MODE==='silabas') rebuildCoins();
  players.forEach(p=>{ if(p.quiz)renderQuiz(p); }); // L3: re-renderiza o quiz de quem estiver num
}
applyLetra(); // estado inicial: reflete a caixa persistida no atributo que o CSS lê
function setLetterCaseAndApply(c){ setLetterCaseValue(c); applyLetra(); }
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
const motor = initSettingsMotor({ $, srSay, store, players, getNumPlayers: () => numPlayers, setToggleMove, rebuildCoins }); // painel motor: ui/settings-motor.ts (registra #opt-facil, #opt-altmove e as abas)

/* Modos de visualização: Normal + Alto contraste + simulações/correções. A FABRICA (parallaxTexFor,
   treeTexFor, playerVizTex, pixiFilterFor, o overlay de baixa visao e as matrizes CVD) migrou para
   render/viewports.ts (B2); a POLITICA ja estava em render/viz-setters.ts (Onda A). */
const lvOverlaySpr=new PIXI.Sprite(PIXI.Texture.EMPTY), vpDot=new PIXI.Graphics();
// _playerDirect/playerVizTex migraram para render/viewports.ts (B2).
/* ===================== MODOS DE VISAO ACESSIVEL -> render/viz-setters.ts =====================
   Saiu a POLITICA (qual modo vale onde); a FABRICA (como um modo vira pixel) ja mora em
   render/viewports.ts, extraida no B2. _lastSharedViz fica: nao e cache de visao, e o registro
   de qual modo o pipeline estatico aplicou por ultimo, escrito de sete lugares.
   Init AQUI porque empathy/visual recebem renderVizGroup/setPlayerViz POR REFERENCIA logo abaixo, e
   declaracao icada virou const. Tudo no ctx e arrow preguicosa: nada e avaliado no init. */
const viz = initVizSetters({
  $, body: document.body, srSay,
  app, camera, worldSprite, parallaxLayers, decoSprites,
  getVpSpr: () => vpSpr, getVpDots: () => vpDots,
  getCoinSprites, getPowerups: () => powerups,
  getPlayers: () => players, getNumPlayers: () => numPlayers,
  getSelVizPlayer: () => selVizPlayer, setSelVizPlayer: setSelVizPlayerValue,
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
const { applySharedTextures, updateVpDots, applyVpFilters, setPlayerViz,
        applyVizGlobal, reapplyVizAll, updateVizIndicator, renderVizGroup } = viz;
const _rebakeDirect = viz.rebakeDirect;
// renderVpOverlay migrou para render/viewports.ts (B2).
// updateVpDots/applyVpFilters migraram para render/viz-setters.ts (Onda A).
// O ESTADO mora em core/state (setModoCegoValue: grava, persiste, avisa). Aqui ficam só os EFEITOS — refazer
// os extras do nível, refletir o painel, anunciar —, que são reação e pertencem ao composition root. A guarda
// de igualdade também está no setter: se o valor não mudou, ele não avisa e nada disto roda.
function setModoCego(on){ const antes=modoCego; setModoCegoValue(on); if(modoCego===antes)return;
  if(typeof setupExtras==='function')setupExtras(); if(typeof reflectModoCego==='function')audioPanel.reflectModoCego();
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
function setOwnerColors(on){ const antes=ownerColors; setOwnerColorsValue(on); if(ownerColors===antes)return;
  rebuildCoins(); srSay(t(ownerColors?'sr.visual.ownerColorsOn':'sr.visual.ownerColorsOff')); }
function setCbSafe(on){ const antes=cbSafe; setCbSafeValue(on); if(cbSafe===antes)return;
  const src=cbSafe?PCOLOR_CB:PCOLOR_DEF; PCOLOR.length=0; src.forEach(c=>PCOLOR.push(c)); // troca IN-PLACE (todos referenciam PCOLOR)
  rebuildCoins(); ensureSprites(); srSay(t(cbSafe?'sr.visual.cbSafeOn':'sr.visual.cbSafeOff')); }
function setRoleColor(k,hex){ const rgb=hexRgb(hex); if(!rgb||!HC_ROLE[k])return; HC_ROLE[k]=rgb; saveHcRole();
  _rebakeDirect(); rebuildExtras(); srSay(t('sr.visual.roleColorSet',{v:ROLE_LABELS[k]})); } // ROLE_LABELS ainda é pt-BR
function resetRoleColors(){ for(const k in HC_ROLE_DEF)HC_ROLE[k]=HC_ROLE_DEF[k].slice(); saveHcRole();
  _rebakeDirect(); rebuildExtras(); visual.render(); srSay(t('sr.visual.roleColorsReset')); }
// Dois contornos configuráveis (1º plano personagem/itens · 2º plano perímetro de plataforma/água/lava).
// _rebakeDirect migrou para render/viz-setters.ts (Onda A) como viz.rebakeDirect.
// A tabela ['nenhum','fino','grosso'] estava escrita DUAS vezes, uma em cada função, para o mesmo trio de
// espessuras — e em pt-BR fixo. Virou chave i18n indexada pelo próprio nível.
const OUTLINE_KEY=['outline.none','outline.thin','outline.thick'];
function setOutlineFg(v){ const antes=hcOutlineFg; setOutlineFgValue(v); if(hcOutlineFg===antes)return;
  _rebakeDirect(); visual.render(); srSay(t('sr.visual.outlineFg',{v:t(OUTLINE_KEY[hcOutlineFg])})); }
function setOutlineBg(v){ const antes=hcOutlineBg; setOutlineBgValue(v); if(hcOutlineBg===antes)return;
  _rebakeDirect(); visual.render(); srSay(t('sr.visual.outlineBg',{v:t(OUTLINE_KEY[hcOutlineBg])})); }
const visual = initSettingsVisual({ $, srSay, renderVizGroup, getVisualSettings: () => ({ lq: getLqT(), ownerColors, cbSafe, outlineFg: hcOutlineFg, outlineBg: hcOutlineBg, roleColors: HC_ROLE }), getSelectedPlayer: () => selVizPlayer, setSelectedPlayer: setSelVizPlayerValue, setPlayerViz, setLq, setOwnerColors, setCbSafe, setOutlineFg, setOutlineBg, setRoleColor, resetRoleColors }); // painel visual: ui/settings-visual.ts
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
  document.querySelectorAll('.overlay').forEach(el=>{ if(!gr.contains(el))gr.appendChild(el); });
  // Botões puramente on/off viram TOGGLE (switch) — o texto "Ligado/Desligado" fica oculto (font-size:0).
  ['opt-facil','opt-altmove','opt-hearing','opt-onebtn','opt-wheelchair','opt-modocego','opt-tts','opt-eyes','audio-master','opt-captions','motion-master'].forEach(id=>{ const b=document.getElementById(id); if(b)b.classList.add('switch'); });
})();
function openVisual(){ const ov=$('#visual'); if(!ov)return; visual.render(); ov.hidden=false; frontOverlay(ov); const f=ov.querySelector('button[data-viz]')||ov.querySelector('button'); if(f)f.focus(); }
// Foco de volta para QUEM ABRIU (WCAG 2.4.3), pelo registro de ui/settings-panel. Antes cada um focava um
// `#opt-*` fixo, e SEIS desses nove ids nao existem no documento — sao ganchos de uma barra de botoes futura.
// O `if(b)b.focus()` engolia isso calado, entao o foco caia no <body> e quem navega por teclado voltava ao
// comeco da pagina. Recuo: o dialogo que ficou por baixo.
function closeVisual(){ const ov=$('#visual'); if(!ov)return; ov.hidden=true; if(!overlays.restoreFocus('visual'))menuFocus(sharedDialogOpen()); }
const visualBtn=$('#opt-visual'); if(visualBtn)visualBtn.addEventListener('click',openVisual);
const visualClose=$('#visual-close'); if(visualClose)visualClose.addEventListener('click',closeVisual);
// Empatia motora: um-botão e cadeirante
function reflectMotorEmpathy(){ const a=$('#opt-onebtn'); if(a){ a.classList.toggle('is-on',oneButton); a.setAttribute('aria-pressed',String(oneButton)); a.textContent=oneButton?'❚❚ Ligado':'▶ Desligado'; }
  const b=$('#opt-wheelchair'); if(b){ b.classList.toggle('is-on',wheelchair); b.setAttribute('aria-pressed',String(wheelchair)); b.textContent=wheelchair?'❚❚ Ligado':'▶ Desligado'; } reflectVizButtons(); }
// Estado em core/state; aqui só os EFEITOS (refletir o painel, anunciar). Mesma forma que setModoCego.
function setOneButton(on){ const antes=oneButton; setOneButtonValue(on); if(oneButton===antes)return;
  reflectMotorEmpathy(); srSay(t(on?'sr.motor.oneButtonOn':'sr.motor.oneButtonOff')); }
// Estado em core/state; aqui a REAÇÃO, que neste caso é grande: o modo cadeirante refaz a geometria do
// nível inteiro. Por isso ele não caberia dentro de um setter — e por isso o setter não o conhece.
function setWheelchair(on){ const antes=wheelchair; setWheelchairValue(on); if(wheelchair===antes)return;
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
function openTypo(){ const ov=$('#typo'); if(!ov)return; typo.render(); ov.hidden=false; frontOverlay(ov);   const f=ov.querySelector('button[data-font]:not([disabled])')||ov.querySelector('button'); if(f)f.focus(); }
function closeTypo(){ const ov=$('#typo'); if(!ov)return; ov.hidden=true; if(!overlays.restoreFocus('typo'))menuFocus(sharedDialogOpen()); }
{ const b=$('#typo-close'); if(b)b.addEventListener('click',closeTypo); }

/* F1: menu de áudio (mixer por categoria) — o botão "Som" abre este menu */
function openAudio(){ const ov=$('#audio'); if(!ov)return; ensureAC(); audioPanel.renderAudio(); audioPanel.reflectModoCego(); audioPanel.reflectTts(); const cd=$('#cane-div'); if(cd)cd.value=String(caneBlockDiv); ov.hidden=false; frontOverlay(ov); const f=ov.querySelector('button'); if(f)f.focus(); }
function closeAudio(){ const ov=$('#audio'); if(!ov)return; ov.hidden=true; if(!overlays.restoreFocus('audio'))menuFocus(sharedDialogOpen()); }
// A12e auditiva: Modo cego (só áudio) + seleção de voz (Web Speech agora; neurais em breve)
// Botões abreviados: hover/foco DESCOMPACTA o número em letras (o "12" vira as 12 letras contando p/ baixo), suave;
// recomprime ao sair. Genérico: varre a barra (.mode-btn) E o menu de pausa (.pm-btn) casando A12e/S11e.
// ABBR_MID/attachAbbr migraram para ui/activities-menu.ts (Onda A). A VARREDURA abaixo fica onde
// esta: ela e sensivel a quando os .pm-btn existem.
document.querySelectorAll('.mode-btn, .pm-btn').forEach(attachAbbr);
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
function renderPauseLegend(){ const g=simNaoGlyphs();
  const chip=(s,word)=>`<span class="lg"><span class="lg-ico" style="background:${s[1]}">${s[0]}</span> ${word}</span>`;
  const html=chip(g.sim,'Sim')+chip(g.nao,'Não');
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
addEventListener('gamepadconnected', (e)=>{ try{ const d=touchCtl.applyPadDesign(padLayoutFromId(e.gamepad.id)); const sel=$('#pad-design'); if(sel)sel.value=d; srSay(t('sr.pad.connected',{v:d})); }catch(err){} }); // A2: layout pelo id do controle
const padDesignSel=$('#pad-design'); if(padDesignSel){ padDesignSel.value=touchCtl.getPadDesign(); padDesignSel.addEventListener('change',()=>{ touchCtl.applyPadDesign(padDesignSel.value); srSay(t('sr.pad.design',{v:padDesignSel.value})); }); } // A4: escolha manual
// JOGAR COM OS OLHOS: eyeMode/eyeSet/onGaze/startEyeControl/stopEyeControl/loadWebGazer → ui/webcam.js (Estágio 4, Tier 1).
const eyesBtn=$('#opt-eyes'); if(eyesBtn)eyesBtn.addEventListener('click',()=>{ setEyeMode(!eyeMode); toggleBtn(eyesBtn,eyeMode); eyesBtn.textContent=eyeMode?'❚❚ Ligado':'▶ Desligado';
  if(eyeMode){ loadWebGazer(startEyeControl); srSay(t('sr.eyes.loading')); } else { stopEyeControl(); srSay(t('sr.eyes.off')); } });
const audioCloseBtn=$('#audio-close'); if(audioCloseBtn)audioCloseBtn.addEventListener('click',closeAudio);
const audioPanel = initSettingsAudio({ $, srSay, store, audioCats: AUDIO_CATS, toggleBtn, getNumPlayers: () => numPlayers, getPlayers: () => players, getSoundOn: () => soundOn, setSoundOn, getVolume: () => volume, setVolume, getAudioCat: () => audioCat, setCatGain, tts, getModoCego: () => modoCego, setModoCego, getCaneBlockDiv: () => caneBlockDiv, setCaneBlockDiv: setCaneBlockDivValue }); // painel de audio: ui/settings-audio.ts
// REFLETE O MODO CEGO PERSISTIDO no boot. `incl_modocego` sobrevive à sessão desde sempre, mas nada refletia o
// valor no botão ao abrir o jogo: com o modo LIGADO, o `#opt-modocego` dizia "Desligado" e reportava
// `aria-pressed="false"`. Para quem usa leitor de tela isso é WCAG 4.1.2 (nome, papel, VALOR) quebrado no
// controle de que essa pessoa depende — e sem a tela para desempatar, a informação errada é a única que há.
// Verificado numa carga limpa: gravado "1", botão "Desligado". O cadeirante, ao lado, refletia certo.
audioPanel.reflectModoCego();

/* E10: remap de controles + persistência (B2) */
const ctrlPanel = initSettingsControls({ $, srSay, srAlert, store: { saveKB, resetKB }, kb, setKB, kbFor, getNumPlayers: () => numPlayers, applyControls, assignControls }); // painel de controles: ui/settings-controls.ts (registra #ctrl-reset e os botoes de remap)
function openOptions(){ const ov=$('#options'); if(!ov)return; ctrlPanel.render(pauseActor); ov.hidden=false; frontOverlay(ov); const f=ov.querySelector('button'); if(f)f.focus(); } // E3: edita o controle do jogador que abriu
function closeOptions(){ const ov=$('#options'); if(!ov)return; ov.hidden=true; ctrlPanel.cancelCapture(); if(!overlays.restoreFocus('options'))menuFocus(sharedDialogOpen()); }
const ctrlBtn=$('#opt-controls'); if(ctrlBtn)ctrlBtn.addEventListener('click',openOptions);
// AJUDA (do menu de pausa): controles DO jogador que abriu (pauseActor) + notas desta build.
function openHelp(){ const ov=$('#help'); if(!ov)return; const c=$('#help-content'); const pa=pauseActor||0; const map=kbFor(pa);
  const rows=Object.keys(ACT_LABEL).map(a=>`<div class="ctrl-row"><span>${t(ACT_LABEL[a])}</span><span>${(map[a]||[]).map(keyName).map(k=>'<kbd>'+k+'</kbd>').join(' ')||'—'}</span></div>`).join('');
  if(c)c.innerHTML=`<h3 class="panel-sub">Seus controles${numPlayers>1?' · Jogador '+(pa+1):''} <span class="panel-sub__tag">teclado</span></h3><div class="ctrl-list">${rows}</div>`+
    `<h3 class="panel-sub">Notas desta build</h3><div class="ctrl-list">`+
    `<div class="ctrl-row"><span>Power-ups: 👟 super-corrida · 🕷️ escalada · 🎈 voo · 🐇 super-pulo · 🦘 ultra-pulo · 🔑 chave abre o 🚪 portão.</span></div>`+
    `<div class="ctrl-row"><span>2–4 jogadores: telas lado a lado, cada uma com seu menu e sua configuração.</span></div>`+
    `<div class="ctrl-row"><span>v${INCL_VERSION} — PixiJS (WebGL, fallback Canvas) · texto/UI no DOM (acessibilidade) · offline via PWA.</span></div></div>`;
  ov.hidden=false; frontOverlay(ov); const f=ov.querySelector('button'); if(f)f.focus(); }
function closeHelp(){ const ov=$('#help'); if(!ov)return; ov.hidden=true; if(!overlays.restoreFocus('help'))menuFocus(sharedDialogOpen()); }
const helpCloseBtn=$('#help-close'); if(helpCloseBtn)helpCloseBtn.addEventListener('click',closeHelp);
const ctrlClose=$('#ctrl-close'); if(ctrlClose)ctrlClose.addEventListener('click',closeOptions);

/* Movimento reduzido (WCAG 2.3.3) + Pause/Stop/Hide (2.2.2) */
// (RM_LABEL e RM_SOON eram CODIGO MORTO aqui: nenhum leitor neste arquivo. Os que o painel usa vivem em
//  ui/settings-motion, e eram copia palavra por palavra destes. Apagados no item 14.)
const motion = initSettingsMotion({ $, srSay, store, frontOverlay, restoreFocus: (id)=>overlays.restoreFocus(id), toggleBtn, rm, saveRM, rmKeys: RM_KEYS, rmChar: RM_CHAR }); // painel de movimento/CRT: ui/settings-motion.ts
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
const mapHub = initMapHub({ $, srAlert, getNumPlayers: ()=>numPlayers, openOptions, openPadWiz: ()=>gamepadApi.openPadWiz() });
function renderMapHub(){ mapHub.render(); }
const movBtn=$('#opt-movement'); if(movBtn)movBtn.addEventListener('click',openMovement);
const movClose=$('#movement-close'); if(movClose)movClose.addEventListener('click',closeMovement);
const animClose=$('#animation-close'); if(animClose)animClose.addEventListener('click',()=>motion.close()); // #opt-animation NAO existe no app (era referencia morta); so o fechar e real

/* ===================== FPS ===================== */
let fpsAccum=0,fpsFrames=0,fpsMin=Infinity,fpsWarm=0;
function fpsTick(){ const fps=app.ticker.FPS; fpsWarm++; fpsAccum+=fps; fpsFrames++;
  if(fpsWarm>60&&fps<fpsMin)fpsMin=fps;
  if(fpsFrames>=30){ $('#hud-fps').textContent=String(Math.round(fpsAccum/fpsFrames));
    $('#hud-fpsmin').textContent=fpsMin===Infinity?'–':String(Math.round(fpsMin)); fpsAccum=0;fpsFrames=0; }
}

/* ===================== loop ===================== */
startLoop(app.ticker, (dt)=>{ gamepadApi.pollPads(); update(dt); draw();
  titleG.visible=(phase==='title'); if(titleG.visible)titleScene.draw(); // cena do título da v3 cobre o mundo
  attractCtl.titleIdleTick(titleG.visible); // attract após 60s parado no menu (José)
  setMinimapVisible(!titleG.visible&&numPlayers<=1); document.body.classList.toggle('at-title',titleG.visible); // HUD/minimapa não vazam no menu
  fpsTick();
  if(phase==='playing'){ weather.updateWeather(); ambient.updateAmbient(); nav.updateGuide(); } }); // F4: clima + ambiente + guia auditivo (só durante o jogo)
window.__incl={app,get player(){return players[0];},players,get numPlayers(){return numPlayers;},setNumPlayers,activateScreens,fitsN,isMobile,pollPads:()=>gamepadApi.pollPads(),update,openPadWiz:()=>gamepadApi.openPadWiz(),padWizTick:()=>gamepadApi.padWizTick(),padMapFor:(id)=>gamepadApi.padMapFor(id),get padWiz(){return gamepadApi.getPadWiz();},get phase(){return phase;},get padPrev(){return padPrevAct;},get coins(){return coins;},get collected(){return players[0].collected;},get powerups(){return powerups;},get gateOpen(){return gateOpen;},get gate(){return gate;},get ended(){return ended;},restartGame,get hcMode(){return (VIZ_BY_KEY[vizMode]||{}).kind==='hcnew';} /* derivado de vizMode (D1); era `let` espelho */,setHC(v){setPlayerViz(0,v?'hc-direto':'normal');},get vizMode(){return players[0].viz;},applyViz(v){setPlayerViz(0,v);},setPlayerViz,VIZ_MODES,get footCount(){return _footCount;},get sonarCount(){return nav.sonarCount;},get guideCount(){return nav.guideCount;},get narrateCount(){return tts.narrateCount;},sonar:()=>nav.sonar(players[0]),setHearingLoss,darkRegions,decoLayer,get minimap(){return getMinimap();},parallaxLayers,PARALLAX,setCenario,get cenario(){return CENARIO;},
  get mmSeen(){return minimapSeenCount();},get MODE(){return MODE;},get letterCase(){return letterCase;},brailleText,tileAt,WORLD_W,WORLD_H,TUNE,
  JUICE,addShake,addHitstop,burstSparkle,puffDust,draw,get particles(){return getParticles();},get hitstopT(){return getHitstopT();},get shakeT(){return getShakeT();},CRT,applyCrt,setLq,get lqT(){return getLqT();},
  setOwnerColors,setCbSafe,setRoleColor,resetRoleColors,PCOLOR,HC_ROLE,get ownerColors(){return ownerColors;},get cbSafe(){return cbSafe;},
  setMode,setQuizLevel,get quizLevel(){return quizLevel;},openSilabas,quizMove,quizConfirm,quizErase,get quiz(){return players[0].quiz;},INCL_VERSION,fmtFrac,fracGraphic,speakChoice,get fracNot(){return fracNot;},
  setGameFont:typo.setFont,openTypo,get fontKey(){return typo.getFontKey();},FONT_GROUPS,get mmSeen2(){return minimapSeenCount();},
  startAttract:()=>attractCtl.startAttract(),stopAttract:()=>attractCtl.stopAttract(),get attract(){return attractCtl.isAttract();}, // attract → game/attract.ts
  loadTTS:tts.loadTTS,ttsSpeak:tts.ttsSpeak,narrate:tts.narrate,get ttsEngine(){return tts.getEngine();},get ttsLoading(){return tts.loading;},get ttsFailed(){return tts.failed;},setTtsEngineSel(v){tts.setEngineSel(v);},
  updateWeather:weather.updateWeather,get rainLevel(){return weather.getRainLevel();},set weatherT(v){weather.setWeatherT(v);},get weatherT(){return weather.getWeatherT();},rm,
  spawnCreature:life.spawnCreature,stepLife:life.stepLife,get creatures(){return life.getCreatures();},spawnCar:traffic.spawnCar,get cars(){return traffic.getCars();},SEM:traffic.SEM,get STREET_Y(){return traffic.getStreetY();},
  get elevShafts(){return getElevShafts();},elevAt,get BOX(){return BOX;},get wheelchair(){return wheelchair;},setWheelchair,buildElevators,buildRamps,solidAt,surfTop, // debug cadeirante
  get clouds(){return sceneSky.getClouds();},get birds(){return sceneSky.getBirds();},stepSky:(dt)=>sceneSky.stepSky(dt),CENARIOS,stepV3Decor:()=>sceneSky.stepV3Decor(),
  get grassDensity(){return grassDensity;},setGrassDensity:setGrassDensityValue, // o clamp mora no setter de core/state, não aqui
  get decorCounts(){ const n=g=>g.geometry&&g.geometry.graphicsData?g.geometry.graphicsData.length:0; return {stars:n(starsG),skyDeco:n(skyDecoG),fog:n(fogG),grass:n(grassG),front:n(themeFxG)}; }};
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
  $, win: window, setMasterMuted, srSay, srAlert,
  getPauseScreens: () => vpPause,                  // `let` REATRIBUIDO por buildGameHud -> getter
  getPauseActor: () => pauseActor,                 // `let` com seis leitores -> getter
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
  setSelVizPlayer: setSelVizPlayerValue,
});
function setPhase(p){ shell.setPhase(p); }
function togglePause(){ shell.togglePause(); }
function pauseSelect(){ shell.pauseSelect(); }
function printMode(){ shell.printMode(); }
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
const actionOf = (code,pi) => kbRuntime.actionOf(code,pi);
const whichPlayer = (code) => kbRuntime.whichPlayer(code);
/* ===================== NAVEGACAO UNIVERSAL de menus -> ui/menu-nav.ts (C3) =====================
   sharedDialogOpen/menuItems/menuFocus/dialogBack/navDialog/pauseSetSel/navPause/menuNavKey migraram.
   `sharedDialogOpen` agora e ALIAS de overlays.topVisibleOverlay: as duas eram a MESMA funcao escrita duas
   vezes — mesmo escopo, mesmo filtro, mesma ordenacao por z-index. Os envelopes abaixo sao `function`
   (icadas) porque o ctx de input/gamepad, montado bem acima, referencia sharedDialogOpen/navDialog/navPause
   por NOME; e closeTypo/closeHelp chamam menuFocus(sharedDialogOpen()) de mais acima ainda. */
const menuNav = initMenuNav({
  $, getActiveElement: () => document.activeElement,
  isNavigable: () => phase === 'paused', // aqui menu e' coisa de pausa; noutro jogo pode ser sempre (ver o ctx)
  topVisibleOverlay: () => overlays.topVisibleOverlay(), closeById: (id) => overlays.closeById(id),
  getPauseMenu: (i) => vpPause[i],                 // `let vpPause` REATRIBUIDO por buildGameHud -> getter
  setPhase: (p) => setPhase(p),
  setPauseActor: setPauseActorValue,
  isCapturing: () => ctrlPanel.isCapturing(),
  closePadWiz: (save) => gamepadApi.closePadWiz(save), // LAZY: quebra o ciclo menu-nav <-> input/gamepad
  whichPlayer, actionOf,
  win: window,
});
function sharedDialogOpen(){ return menuNav.sharedDialogOpen(); }
function menuItems(menu){ return menuNav.menuItems(menu); }
function menuFocus(menu){ menuNav.menuFocus(menu); }
function dialogBack(menu){ menuNav.dialogBack(menu); }
function navDialog(menu,k){ menuNav.navDialog(menu,k); }
function navPause(menu,pi,k){ menuNav.navPause(menu,pi,k); }
menuNav.attach(); // addEventListener('keydown', menuNavKey, true) — MESMA fase de CAPTURA
/* ===== Menu inicial (v3): principal → submenus de atividade → (tabuada/divisão) seletor de números ===== */
// _tabFor/titleButtons/navTitle/buildTitleMenus migraram para ui/activities-menu.ts (Onda A).
// updateTitleLegend migrou para ui/shell.ts (C3) — e legenda da TELA de titulo, nao navegacao de menu; o
// envelope icado fica la em cima, junto do resto da casca. padKind() foi APAGADO: input/touch.ts ja exporta
// a mesma funcao desde a Onda A e a copia daqui nao tinha chamador nenhum (codigo morto duplicado).
addEventListener('gamepadconnected',()=>{ if(phase==='title')updateTitleLegend(); });
addEventListener('gamepaddisconnected',()=>{ if(phase==='title')updateTitleLegend(); });
// O despachante do menu do titulo (teclado do #np-btn, rodape de descricao e o click) migrou para
// ui/activities-menu.ts, que liga os proprios ouvintes no #title-overlay. Sobrou aqui a barra de
// icones de a11y do splash, que e do slice de pausa.
(function titleIconsSetup(){ const ov=$('#title-overlay'); if(!ov)return;
  // Icones de a11y da pausa TAMBEM no topo do splash (mesmas acoes, escopo do Jogador 1)
  const ti=$('#title-icons'); if(ti){ ti.innerHTML=iconsMarkup(); // fonte unica do markup (antes copiado aqui e no modulo)
    ti.addEventListener('click',(e)=>{ const ib=e.target.closest('.pi-btn'); if(!ib)return; setPauseActorValue(0); pauseIcons.iconAct(ib.dataset.pi,0);
      reflectTitleIcons(); if(typeof reflectPauseIcons==='function')reflectPauseIcons(); srSay(ib.getAttribute('aria-label')||''); });
    reflectTitleIcons(); }
})();
(function shellSetup(){
  const wire=(id,fn)=>{ const b=$('#'+id); if(b)b.addEventListener('click',fn); };
  wire('btn-pause', togglePause); // (o botão saiu da barra; a fiação fica guardada p/ compat)
  // Barra de topo (título da PÁGINA + ferramentas): só com ?debug=true. O jogo já mostra o título no splash,
  // então a barra fica oculta por padrão (CSS body:not(.dbg) .topbar) e libera a vertical p/ o canvas.
  if(/[?&]debug=true/.test(location.search))document.body.classList.add('dbg');
  const tools=$('#topbar-tools'); if(tools){ if(/[?&]debug=true/.test(location.search))tools.hidden=false;
    const db=$('#btn-debug'); if(db)db.addEventListener('click',()=>{ const p=$('#debug-panel'); if(p){ p.hidden=!p.hidden; db.setAttribute('aria-pressed',String(!p.hidden)); } }); } // abre/fecha o painel de afinação
  // Menu de pausa: agora é POR TELA (buildScreenPause + pauseActs no escopo do módulo). Nada aqui.
  setPhase('title'); // estado inicial: tela de título
  i18n.initI18n(); // aplica as traduções data-i18n (docs/plano-i18n.md)
})();

/* ===================== E13: controles de toque (mobile) ===================== */
// oculta os botões de toque (chamado quando o jogador usa teclado/controle, p/ não atrapalhar)
// minimapa: no toque vai pro canto SUPERIOR DIREITO (o direcional, embaixo à esq., não o cobre); senão, inferior esquerdo
// setMinimapCorner extraído p/ render/minimap.js (Estágio 4, Tier 1).
// teclado/controle → esconde os botões e devolve o minimapa ao canto inferior esquerdo
// hideTouchControls/showTouchControls migraram para input/touch.ts (Onda A).
// DECLARACOES de funcao, nao const: o setPhase('title') do boot chama hideTouchControls antes desta linha,
// e so o icamento faz isso funcionar — era assim no original. O corpo so toca touchCtl na hora da chamada.
function hideTouchControls(reason){ touchCtl.hideTouchControls(reason); }
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
  getPlayers: () => players, getCenario: () => CENARIO, getPhase: () => phase, // bindings vivos (reatribuídos)
  setCenario, setActivity, restartGame, setPhase, randInt, kbFor, srSay, srAlert, $,
});

/* ===================== ?debug=true: painel de afinação ao vivo (extraído → ui/debug-panel.ts) ===================== */
initDebugPanel({ TUNE, ANIM, JUICE, saveJuice });

/* ===================== PWA ===================== */
// PWA/SW agora gerados pelo vite-plugin-pwa (Estágio 1); registro injetado no build. Ver vite.config.ts.
