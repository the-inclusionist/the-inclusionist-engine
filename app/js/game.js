// SPDX-License-Identifier: GPL-3.0-or-later
// The Inclusionist v4 — port do Lúdico real sobre PixiJS.
// VERSIONAMENTO (recalculado do git em 2026-07-02): MINOR +1 a cada feature (patch zera);
// PATCH +1 a cada conserto/ajuste; docs/chore não mudam versão. INCL_VERSION agora é DISPLAY (bump em mudança relevante); o cache é por content-hash do vite-plugin-pwa (Estágio 1) — sem sw.js/bump manual.
import * as PIXI from 'pixi.js'; // PixiJS 7.4.2 via npm (Vite empacota; aposenta o <script> global vendor/pixi.min.js)
import i18n from './core/i18n.js'; // internacionalização
import * as tiles from './core/tiles.js'; // legend + parser do mapa em glifo
import * as store from './platform/storage.js'; // camada de persistência
import { phase, setPhaseValue, quizLevel, setQuizLevelValue, numPlayers, setNumPlayersValue, cenario as CENARIO, setCenarioValue, activity as ACTIVITY, setActivityValue, vizMode, initVizMode, coins, setCoins, players } from './core/state.js'; // estado (as 8 mega-variáveis)
import { startLoop } from './core/loop.js'; // driver do loop
import { initDebugPanel } from './ui/debug-panel.js'; // painel ?debug (Tier 1)
import { createAttract } from './game/attract.js'; // modo demonstração (Tier 1)
import { isValidActivityId, DEFAULT_ACTIVITY_ID } from './game/activities-registry.js';
import { puTaken, takePu } from './game/powerups.js'; // Estágio 4 (Tier 2): predicados de coleta de power-up
import { ELEV_SPEED, buildElevators, elevAt, getElevShafts, initElevators } from './game/elevators.js'; // Estágio 4 (Tier 2): geometria de elevador (cadeirante)
import { fmtFrac, fracGraphic, fracSpeak, speakChoice } from './game/fractions.js'; // Estágio 4 (Tier 2): matemática/render de frações
import { BRAILLE, brailleText } from './game/braille.js'; // Estágio 4 (Tier 2): cela braille + fala (atividade cego)
import { SOMASUB_SHAPES, somaSubName, SILABAS_WORDS, SILABA_POOL, WORD_INITIALS } from './game/activity-content.js'; // Estágio 4 (Tier 2): dados das atividades (formas + sílabas)
import { LETTER_NAME, soletra, ferreiroDistractors } from './game/literacy-distractors.js'; // Estágio 4 (Tier 2): nomes de letra + distratores pré-silábicos
import { JUICE, saveJuice, easeOut3, spawnParticle, puffDust, burstSparkle, addShake, addHitstop, setSquash, stepFx, drawFx, initFx, tickHitstop, shakeAmp, getParticles, getHitstopT, getShakeT } from './render/fx.js'; // Estágio 4 (Tier 2): juice (partículas/shake/hitstop/squash)
import { parallaxPlaceholder, themeSkyTexture, themeHillsTexture } from './render/scene-parallax.js'; // Estágio 4 (Tier 2): geradores de textura do parallax
import { isGroundType, worldCanvas, worldToTexture, initWorldTex } from './render/world-tex.js'; // Estágio 4 (Tier 2): builder da textura NORMAL do mundo
import { drawCane, drawRunCane, drawChair } from './render/wheelchair-sprites.js'; // Estágio 4 (Tier 2): bengala + cadeira (a11y motora)
import { loadKB, saveKB, resetKB } from './input/keyboard.js'; // Fase 2: config de teclado (subsistema input)
import { AUDIO_CATS } from './platform/audio-mixer.js'; // Fase 2: categorias do mixer (dados); audioCat/catNode/setCatGain vêm de audio.js
import { FONT_GROUPS } from './ui/fonts.js'; // Fase 2: tipografia (catálogo + persistência)
import { $, $$, toggleBtn } from './ui/dom.js';
import { initSettingsAudio } from './ui/settings-audio.js';
import { initSettingsControls, ACT_LABEL, keyName } from './ui/settings-controls.js';
import { initSettingsVisual, ROLE_LABELS } from './ui/settings-visual.js';
import { initSettingsEmpathy } from './ui/settings-empathy.js';
import { initSettingsMotor } from './ui/settings-motor.js';
import { initSettingsMotion, motionOpen, setSelectedPlayer as setSelectedMotionPlayer } from './ui/settings-motion.js';
import { initSettingsTypo } from './ui/settings-typo.js';
import { initTitle } from './ui/title.js';
import { createTitleScene } from './render/title-scene.js'; // Fase 2.27: atalho de querySelector (Tier 1)
import { VIZ_MODES, VIZ_BY_KEY, VIZ_FILTER, VIZ_CYCLE } from './render/viz-modes.js'; // Fase 2: modos visuais de a11y (dados)
import { PAD_DESIGNS } from './input/devices.js'; // Fase 2: rótulos de gamepad/toque (dados)
import { keys, padCur, padPrevAct, padPrevStart, PAD_DEAD, held } from './input/state.js'; // Fase 2.22: estado de input + held
import { audioCtx, ensureAC, SFX, soundOn, volume, setSoundOn, setVolume, audioOut, hearingLoss, setHearingLossGraph, setMasterMuted, audioCat, initAudioMixer, catNode, setCatGain, tone, tonePan, noiseBuffer, noiseHit, _footCount } from './platform/audio.js'; // Fase 2: base + mestre + mixer + sínteses (oscilador + ruído)
import { gameSay } from './platform/speech.js';
import { createAudioJingles } from './platform/audio-jingles.js'; // Tier 2 (áudio r1): jingles de vitória/enigma/fogos
import { createAudioEarcons } from './platform/audio-earcons.js'; // Tier 2 (áudio r2): earcons (sfx) + porta + legendas
import { createAudioNav } from './platform/audio-nav.js'; // Tier 2 (áudio r3): pistas espaciais (bengala/sonar/guarda/guia/nado)
import { createAudioAmbient } from './platform/audio-ambient.js'; // Tier 2 (áudio r4): trilha de ambiente + trovão
import { createTts } from './platform/tts.js'; // Tier 2 (#38): narração por voz (Piper neural lazy + fallback Web Speech)
import { SPR, TEX_IDLE, TEX_WALK, TEX_RUN, FLAVORS, TEX_JUMP_UP, TEX_JUMP_DOWN, TEX_CLIMB, TEX_FLY, TEX_CLING_WALL, TEX_CLING_CEIL, TEX_SWIM, TEX_SWIMIDLE, initCharacterSprites } from './render/sprites.js';
import { makeCanvas, tex, pixDisc } from './render/canvas.js';
import { createSceneSky } from './render/scene-sky.js'; // Tier 2 (#43): céu — nuvens (#21) + decor viva da v3
import { coinCanvas, coinTexture, treeCanvas, treeTexture, powerupCanvas } from './render/props.js';
import { outlineCanvas } from './render/sprite-fx.js'; // Fase 2: voz do letramento (pt-BR sempre-ativa)
import * as weather from './render/weather.js'; // Onda A: clima visual (chuva/trovao/clarao)
import { lqFilter, setLq, getLqT, initLqFilter } from './render/lq-filter.js'; // Onda A: realce de contraste L->Q
import * as traffic from './game/traffic.js'; // Onda A: carros + semaforo da rua da frente
import * as life from './game/life.js'; // Onda A: vida ambiente (pombos/gatos/caes/adultos)
import { initSceneCity } from './render/scene-city.js'; // Onda A: deco da Cidade + fx de tiles vivos
import { initTextures, SHAPE_TEX, letterTexture, pupTexFor } from './render/textures.js'; // Onda A: texturas de moeda/forma/letra + power-up
import { DIRECT_CFG, HC_ROLE, HC_ROLE_DEF, saveHcRole, worldTexFor, coinTexFor, directBgTexture,
  directSpriteCanvas, directSpriteTexture, clearWorldTexCache, clearCoinTexCache, initHighContrast } from './render/high-contrast.js'; // Onda A: Renderizacao Direta (alto contraste)
import { initCoinSpawning, rebuildCoins, addCoinsForOwner, respawnCoinsForOwner, showPower, getCoinSprites } from './game/coin-spawning.js'; // Onda A: materializacao dos sprites de moeda
import { initKeyboardRuntime } from './input/keyboard-runtime.js'; // Onda A: esquema de teclas por jogador
import { initTouch, padLayoutFromId } from './input/touch.js'; // Onda A: geometria fisica do pad + config de toque
import { initGamepad } from './input/gamepad.js'; // Onda A: leitura da Gamepad API + assistente de mapeamento
import { initActivitiesMenu, attachAbbr, QL_NAME, PM_BTNS } from './ui/activities-menu.js'; // Onda A: menus do titulo + inicio de partida
import { initPauseIcons, iconsMarkup } from './ui/pause-icons.js'; // Onda A: menu de pausa por tela + barra de icones de a11y
import { initHud } from './ui/hud.js'; // Onda A: HUD por tela (moedas/poder/abandono/selo de espera)
import { screenGrid, screenBaseSize } from './core/screens.js'; // grade de telas (fonte unica)
import { initPhysics, stepPlayer as stepPhysics } from './game/physics.js'; // B1: fisica do jogador (ancorada nas trajetorias-ouro)
import { initQuiz } from './game/quiz.js'; // B3: o desafio educativo (geracao + markup + efeito)
import { initSettingsPanel } from './ui/settings-panel.js'; // B4: o que as cascas dos paineis realmente compartilham
import { initViewports } from './render/viewports.js'; // B2: fabrica de imagem dos modos de visao
import { initVizSetters } from './render/viz-setters.js'; // Onda A: aplicacao dos modos de visao acessivel
import { initLevelGeometry, buildRamps, buildRopes, drawElevators, buildDarkRegions,
  buildWcGeom as lgBuildWcGeom, rebuildExtras as lgRebuildExtras, setupExtras as lgSetupExtras } from './game/level-geometry.js'; // Onda A: rampas/cordas/elevador/escuridao/extras
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
import { LOGICAL_W, LOGICAL_H, TILE, COIN_TARGET, TUNE, ANIM, EASY, TILE_COLOR } from './core/constants.js';
import { Z } from './core/layers.js'; // #69/ADR-0020: ordem-z canônica (nomeada) do render
import { rnd, randInt, shuffle } from './core/rng.js'; // Fase 2.26: RNG semeado (Tier 1)
import { initCollision, caneBlockPx, isSolidType, tileAt, solidTile, solidAt, surfTop, isWcRampRiser, rampSurfaceY } from './core/collision.js'; // Estágio 4: colisão de grade (determinística; ctx por closures)
import { BOX, SPAWN_X, SPAWN_Y, makePlayer, jumpVel, isBouncyGroundBelow, touchingWall, clingSides, firstClingSide, spiderReattach, wrapConvex } from './game/player.js'; // Estágio 4: entidade + geometria de colisão do jogador
import { initCoins, findCoinCandidates, pickCoins, takeCoin } from './game/coins.js'; // Estágio 4: posicionamento dos coletáveis (pools vêm daqui)
import { srSay, srAlert, setVlibrasSay } from './core/a11y-sr.js'; // Estágio 4 (Tier 1): anúncios p/ leitor de tela (+ Libras injetado)
import { CRT, crtScanVars, applyCrt } from './render/crt.js'; // Estágio 4 (Tier 1): estética CRT (scanlines/vinheta/cantos)
import { initMinimap, markSeen, redrawMinimapIfDirty, drawMinimapPlayer, resetMinimap, setMinimapCorner, setMinimapVisible, getMinimap, minimapSeenCount } from './render/minimap.js'; // Estágio 4 (Tier 1): minimapa + fog-of-war
import { vlibrasSay, vlibrasOpen, toggleLibras, vlTick, librasOpen, LIBRAS_RESERVE, setOnLibrasChange } from './ui/vlibras.js'; // Estágio 4 (Tier 1): intérprete VLibras (modo pessoa surda)
import { layout } from './ui/layout.js'; // Estágio 4 (Tier 1): escala do jogo (múltiplo inteiro de 320×180 em px reais)
import { eyeMode, setEyeMode, startEyeControl, stopEyeControl, loadWebGazer } from './ui/webcam.js'; // Estágio 4 (Tier 1): jogar com os olhos (WebGazer)
// Empatia MOTORA (global, muda a jogabilidade) — declarados cedo pois isSolidType os usa (cadeirante: trampolim vira elevador atravessável)
let oneButton=store.getBool('incl_onebtn');
let wheelchair=store.getBool('incl_wheelchair');
// Modo cego (A12e auditiva): SÓ as ajudas de áudio (bengala + sonar + guarda + narração), sem tela preta. Empatia cegueira liga por padrão.
let modoCego=store.getBool('incl_modocego');
let caneBlockDiv=store.getNum('incl_cane_div',1)||1; // 1 = 1 batida/bloco; 2 = 1 batida/meio bloco (por DISTÂNCIA pisada)
// caneBlockPx/isSolidType/tileAt/solidTile/solidAt/surfTop/isWcRampRiser/rampSurfaceY extraídos p/ core/collision.js
// (Estágio 4). Estado que a colisão lê (caneBlockDiv/wheelchair/modoCego/wcSolid/gateTiles/gateOpen) SEGUE aqui —
// a colisão o acessa por closures via initCollision(ctx), logo abaixo (após o WORLD ficar pronto).
// TILE_COLOR agora vem de core/constants.js (importado acima).

/* ===================== mundo ===================== */
// Mundo carregado do texto-glifo assets/levels/clarity.map.txt (Fase 1.2). Construtor em core/world.js.
import { buildWorldFromText } from './core/world.js';
// top-level await: game.js é módulo → o corpo abaixo só roda após o mapa carregar (pré-cacheado no SW).
const WORLD = buildWorldFromText(await (await fetch('assets/levels/clarity.map.txt')).text());
const WORLD_W = WORLD[0].length, WORLD_H = WORLD.length;
const WORLD_PX_W = WORLD_W*TILE, WORLD_PX_H = WORLD_H*TILE;
initWorldTex({ world: WORLD, W: WORLD_W, H: WORLD_H }); // Estágio 4: liga o builder da textura do mundo ao mapa carregado
// E12: portão dinâmico — seus tiles são sólidos enquanto fechado (gateOpen=true ⇒ comporta normal)
let gateTiles=new Set(), gateOpen=true, gate=null;
// Cadeirante: sólidos SÓ-CADEIRANTE (pontes/plataformas que não existem no modo normal) — não altera CLARITY_MAP.
let wcSolid=new Set();
// Mundo + estado prontos → liga a colisão (core/collision.js). As closures leem o estado VIVO daqui:
// wheelchair/modoCego/caneBlockDiv/wcSolid/gateTiles/gateOpen mudam neste módulo e a colisão sempre vê o atual.
initCollision({ world: WORLD, W: WORLD_W, H: WORLD_H,
  isWheelchair: ()=>wheelchair, isModoCego: ()=>modoCego, caneDiv: ()=>caneBlockDiv,
  wcSolid: ()=>wcSolid, gateTiles: ()=>gateTiles, gateOpen: ()=>gateOpen });
initCoins({ world: WORLD, W: WORLD_W, H: WORLD_H, anyEasy: ()=>anyEasy(), isWheelchair: ()=>wheelchair }); // Estágio 4: posicionamento de coletáveis (usa solidAt já ligado acima)
// Itens do mapa Clarity → viram ITENS/barreira (não tiles): 7=pulo-turbo, 8=voo, 11=chave; 10=portão.
// Removemos o tile do grid (vira ar) e o item/barreira é desenhado/colidido à parte; some ao pegar/abrir.
const MAP_ITEMS=[], MAP_GATE=[];
for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++){ const t=WORLD[y][x];
  if(t===7){ MAP_ITEMS.push({tx:x,ty:y,kind:'superjump'}); WORLD[y][x]=1; }  // super-pulo (máximo)
  else if(t===8){ MAP_ITEMS.push({tx:x,ty:y,kind:'fly'}); WORLD[y][x]=1; }    // voo
  else if(t===11){ MAP_ITEMS.push({tx:x,ty:y,kind:'key'}); WORLD[y][x]=1; }   // chave
  else if(t===12){ MAP_ITEMS.push({tx:x,ty:y,kind:'turbo'}); WORLD[y][x]=1; } // super-corrida
  else if(t===13){ MAP_ITEMS.push({tx:x,ty:y,kind:'ultrajump'}); WORLD[y][x]=1; } // ultra-pulo
  else if(t===14){ MAP_ITEMS.push({tx:x,ty:y,kind:'wallcling'}); WORLD[y][x]=1; } // ventosa
  else if(t===10){ MAP_GATE.push({tx:x,ty:y}); WORLD[y][x]=1; } // portão
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
let hcOutlineFg=1, hcOutlineBg=1;
hcOutlineFg=Math.max(0,Math.min(2,store.getNum(store.KEYS.outfg,1)|0));
hcOutlineBg=Math.max(0,Math.min(2,store.getNum(store.KEYS.outbg,1)|0));
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
let letterCase='lower'; // 'lower' | 'upper' (E7: selecionável)
const disp=(s)=> letterCase==='upper'?String(s).toUpperCase():String(s).toLowerCase();
// E8: Braille (modo pessoa cega). Padrão de pontos da cela por letra (Grau 1, PT).
// BRAILLE/NUMW/brailleText extraídos p/ game/braille.js (Estágio 4).
let blindMode=false; // modo pessoa cega: no Sílabas, dita os pontos Braille
// Lote C: cada jogador tem SEU conjunto de n itens em posições ALEATÓRIAS próprias e com a COR do dono
// (owner). Todos os itens de todos os jogadores existem no mundo; cada um coleta só os `owner===seu i`.
// pickCoins extraído p/ game/coins.js; aqui só o cálculo dos POOLS a partir do MODE (coins não conhece MODE/quiz).
const coinPools=()=>({ shapes: MODE==='somasub'?SOMASUB_SHAPES.map(s=>s.id):[], letters: MODE==='silabas'?WORD_INITIALS:[] });

/* ===================== estado ===================== */
// $ (querySelector) migrado p/ ui/dom.js (Fase 2.27 / Tier 1)
// BOX/SPAWN_X/SPAWN_Y/makePlayer + geometria de colisão do jogador (isBouncyGroundBelow/touchingWall/clingSides/
// firstClingSide/spiderReattach/wrapConvex) extraídos p/ game/player.js (Estágio 4). P1 = players[0] (compat solo).
const POWER_MSG={superjump:'Super-pulo! O pulo fica sempre na altura máxima.',ultrajump:'Ultra-pulo! Pulos de distância gigante.',turbo:'Super-corrida! Correndo você fica bem mais rápido.',fly:'Voo! No ar, aperte Pular para começar a voar; Pular de novo encerra.',wallcling:'Escalada (aranha)! No ar, aperte Correr perto de uma parede/teto para grudar; engatinha e contorna quinas; Correr de novo solta.'};
// Ícones canônicos dos power-ups (decisão do José 2026-07-02): 👟 corrida/bengala · 🕷️ escalada · 🎈 voo (jetpack) · 🐇 super pulo · 🦘 ultra pulo
const POWER_SHORT={off:'—',superjump:'🐇 Super-pulo',ultrajump:'🦘 Ultra-pulo',turbo:'👟 Super-corrida',fly:'🎈 Voo',wallcling:'🕷️ Escalada',runcane:'👟 Bengala de corrida'};
// showPower migrou para game/coin-spawning.ts (Onda A) — o HUD do poder ativo nasce do mesmo modulo que
// materializa os itens.
// jumpVel + isBouncyGroundBelow/touchingWall/clingSides/firstClingSide/spiderReattach/wrapConvex → game/player.js (Estágio 4)
players.push(makePlayer(0)); let player=players[0]; // 'players' vem de core/state.js (Fase 2, mega-var 8; nunca reatribuído, só mutado in-place); 'player'=players[0] fica local
// 'numPlayers' agora vem de core/state.js (Fase 2, mega-variável 3). Escrita via setNumPlayers()/joinPlayer.
let collected=0, ended=false; setCoins(pickCoins(COIN_TARGET, coinPools())); // coins: mega-var 7 em core/state.js (reatribuição via setCoins)
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
let jumpEdge=false, optionsOpen=false, movementOpen=false, visualOpen=false, empathyOpen=false, audioOpen=false;
// Gamepad (B3/L1): estado por controle. padCur[gi]=ações seguradas neste frame; associação pad↔jogador vive em p.pad.
// padCur/padPrevAct/padPrevStart + PAD_DEAD movidos p/ input/state.js (Fase 2.22)  // // zona morta = primeira METADE do curso (ergonomia — José 2026-07-02)
// Config de teclado extraída p/ input/keyboard.js (Fase 2): esquemas, defaults, loadKB/saveKB/resetKB.
let KB=loadKB();
// saveKB agora vem de input/keyboard.js (recebe o KB como argumento)
// kbFor/actionOf/whichPlayer/assignControls/applyControls migraram para input/keyboard-runtime.ts (Onda A).
// KB fica aqui (o painel de controles o edita e persiste); o modulo o le fresco a cada chamada.
const kbRuntime = initKeyboardRuntime({ getKB: () => KB, getNumPlayers: () => numPlayers, getPlayers: () => players });
const kbFor = (i) => kbRuntime.kbFor(i);
let controls=KB.solo; // alias do P1 (navegação do quiz + GAME_KEYS)
let KJUMP=controls.jump, KLEFT=controls.left, KRIGHT=controls.right, KUP=controls.up, KDOWN=controls.down, KRUN=controls.run;
let GAME_KEYS=[...KJUMP,...KLEFT,...KRIGHT,...KUP,...KDOWN];
// O modulo CALCULA o estado; a atribuicao fica aqui, porque um modulo nao reatribui o `let` de outro.
function applyControls(){ const st=kbRuntime.computeControlsState();
  controls=st.controls; KJUMP=st.jump; KLEFT=st.left; KRIGHT=st.right; KUP=st.up; KDOWN=st.down; KRUN=st.run; GAME_KEYS=st.gameKeys; }
// Tint distintivo por jogador (P1 = normal). L2: paleta CB-SAFE opcional (Okabe & Ito 2008 — laranja/azul-céu/
// amarelo distinguíveis em protan/deutan/tritan) SÓ para jogadores/itens/efeitos — o CENÁRIO fica com cores naturais.
const PCOLOR_DEF=[0xffffff,0xff9a9a,0x8affc0,0xffe08a], PCOLOR_CB=[0xffffff,0xe69f00,0x56b4e9,0xf0e442];
let cbSafe=store.getBool(store.KEYS.cbsafe,false);
const PCOLOR=(cbSafe?PCOLOR_CB:PCOLOR_DEF).slice(); // mutável in-place (todos referenciam PCOLOR)
let ownerColors=store.getBool(store.KEYS.ownercolors,true); // itens na cor do dono (padrão ligado)
const assignControls = () => kbRuntime.assignControls();
assignControls();
// Conflito: uma tecla não pode ser de dois jogadores no MESMO modo. Retorna o índice do outro dono, ou -1.
addEventListener('keydown',(e)=>{
  if(attractCtl.onInput()){ e.preventDefault(); return; } // qualquer tecla encerra a demo
  if(ctrlPanel.handleCaptureKeydown(e))return; // remap: a proxima tecla vira o controle (ui/settings-controls.ts)
  // Diálogo aberto: só bloqueia o jogo se o elemento estiver DE FATO visível (flag preso não trava mais o teclado).
  const dlgVis=(id)=>{ const el=$('#'+id); return el && !el.hidden; };
  // Cadeia de Escape, verbatim do encadeamento que substituiu: fecha o PRIMEIRO registrado que estiver
  // aberto. MEDIDO no navegador: com o jogo pausado ela nao e alcancada — menuNavKey esta em fase de
  // CAPTURA, trata Escape como 'voltar', da stopPropagation e resolve pelo topo da pilha (z-index).
  // Como os paineis so abrem pausado, na pratica quem fecha e sempre o de cima. Mantida como estava.
  { const id=overlays.escapeTarget(); if(id){ if(e.code==='Escape')overlays.closeById(id); return; } }
  if(dlgVis('touchcfg')){ if(e.code==='Escape'){ const t=$('#touchcfg'); if(t)t.hidden=true; } return; }
  if(dlgVis('padwiz')){ if(e.code==='Escape')gamepadApi.closePadWiz(false); return; } // wizard de gamepad: Esc cancela
  // Fim de fase / título: qualquer tecla com função de PULO (de qualquer jogador) ou de PAUSA aciona o
  // botão principal — sem depender do foco do mouse (report do José: clicar na tela tirava o foco do botão).
  { const isJump=KJUMP.includes(e.code)||players.some((p,i)=>actionOf(e.code,i)==='jump');
    const isPause=e.code==='Escape'||e.code==='Enter';
    const winOv=$('#win-overlay');
    if(winOv&&!winOv.hidden){ if(isJump||isPause){ e.preventDefault(); const b=$('#btn-again'); if(b)b.click(); } return; }
    if(phase==='title'){ // menu inicial: setas navegam, PULO/Enter confirma, ESPECIAL/Esc volta — SÓ O JOGADOR 1
      hideTouchControls(); // teclado no splash oculta os controles virtuais (report do José)
      const kp=whichPlayer(e.code);
      if(numPlayers>1&&kp>0){ srSay('Aguarde o Jogador 1 escolher o jogo.'); e.preventDefault(); return; }
      const k={ yes:isJump||e.code==='Enter', no:e.code==='Escape'||players.some((p,i)=>actionOf(e.code,i)==='especial'),
        up:KUP.includes(e.code)||e.code==='ArrowUp', down:KDOWN.includes(e.code)||e.code==='ArrowDown',
        left:KLEFT.includes(e.code), right:KRIGHT.includes(e.code) };
      if(k.yes||k.no||k.up||k.down||k.left||k.right){ e.preventDefault(); navTitle(k); }
      return; } }
  // Lote B: Alt+1/2/3/4 (fileira de números) ativa dinamicamente 1..4 telas (aviso c). Alt fica livre (solo não o usa).
  const anyQuiz=players.some(p=>p.quiz);
  if(e.altKey && !e.ctrlKey && /^Digit[1234]$/.test(e.code) && (phase==='playing'||phase==='paused') && !anyQuiz){
    e.preventDefault(); activateScreens(+e.code.slice(5)); return; }
  if(!anyQuiz && (e.code==='Escape'||e.code==='Enter') && (phase==='playing'||phase==='paused')){ togglePause(); e.preventDefault(); return; } // E14: Esc ou Enter central (NumpadEnter não pausa)
  if(anyQuiz){ // L3: navegação do quiz POR JOGADOR — a tecla age no quiz do DONO dela (genéricas → P1)
    const qpi=whichPlayer(e.code);
    const qpl = qpi>=0 ? (players[qpi]&&players[qpi].quiz?players[qpi]:null) : (player.quiz?player:null);
    if(qpl){
      const act=qpi>=0?actionOf(e.code,qpl.i):null;
      const L=act?act==='left':KLEFT.includes(e.code), R=act?act==='right':KRIGHT.includes(e.code),
            U=act?act==='up':KUP.includes(e.code), D=act?act==='down':KDOWN.includes(e.code),
            J=act?act==='jump':KJUMP.includes(e.code),
            E=act?act==='especial':((qpl.ctrl.especial||[]).includes(e.code)); // ESPECIAL = apagar última sílaba/letra
      if(qpl.quiz.kind==='braille'){
        if(U)announceBraille(qpl); else if(J)quizConfirm(qpl);
        if(GAME_KEYS.includes(e.code))e.preventDefault(); return;
      }
      if(L)quizMove(qpl,-1); else if(R)quizMove(qpl,1); else if(U)quizMove(qpl,-3); else if(D)quizMove(qpl,3); else if(J)quizConfirm(qpl); else if(E)quizErase(qpl);
      if(GAME_KEYS.includes(e.code))e.preventDefault(); return;
    }
    // tecla de um jogador SEM quiz cai no jogo normal (a partida dele continua)
  }
  // Fácil (solo): atalhos de acessibilidade — Ctrl=Especial, Shift=Trocar poder (sem usar Win/Alt/AltGr)
  const easyKey = players[0].easy && numPlayers<=1 && (e.code==='ControlLeft'||e.code==='ControlRight'||e.code==='ShiftLeft'||e.code==='ShiftRight');
  const isGameKey = easyKey || GAME_KEYS.includes(e.code) || players.some(p=>p.ctrl && Object.values(p.ctrl).some(arr=>arr.includes(e.code)));
  if(isGameKey){ e.preventDefault(); hideTouchControls('teclado'); } // E13: jogar no teclado oculta os botões de toque
  for(const p of players){ if(p.waiting && actionOf(e.code,p.i)){ p.waiting=false; // tecla DAQUELE jogador ativa a tela em espera
    hud.clearWaitingBadge(p.i); srSay('Jogador '+(p.i+1)+' entrou!'); } }
  if(!keys.has(e.code)){ for(const p of players){ if(!p.ctrl)continue;
    if(p.ctrl.jump.includes(e.code)) p.jumpEdge=true;
    if(p.ctrl.run.includes(e.code) && !p.easy) p.runEdge=true; // Fácil: sem correr
    if(p.ctrl.left.includes(e.code)) p.leftEdge=true;        // alternância: edge de direção
    if(p.ctrl.right.includes(e.code)) p.rightEdge=true;
    if(p.ctrl.swap&&p.ctrl.swap.includes(e.code)) p.swapEdge=true;
    if(p.ctrl.especial&&p.ctrl.especial.includes(e.code)) p.specialEdge=true; }
    if(easyKey){ if(e.code.startsWith('Control')) player.specialEdge=true; else player.swapEdge=true; } }
  if(oneButton && isGameKey){ for(const k of [...keys]) if(isGameKeyCode(k)) keys.delete(k); } // empatia: um botão de jogo por vez → solta os demais
  keys.add(e.code); });
addEventListener('keyup',(e)=>keys.delete(e.code));
addEventListener('blur',()=>keys.clear());
const anyOf=(arr)=>arr.some(k=>keys.has(k));
// held(pl,act) movido p/ input/state.js (Fase 2.22) // teclado OU gamepad do jogador

/* ===================== a11y ===================== */
// vlibrasSay + _vl* + vlibrasOpen/toggleLibras/vlTick/librasOpen/LIBRAS_RESERVE extraídos p/ ui/vlibras.js (Estágio 4, Tier 1).
setVlibrasSay(vlibrasSay); // registra a fala em Libras (ui/vlibras) no core/a11y-sr

/* ===== E9: áudio (WebAudio) + legendas (C1) + assistência (C2) ===== */
// SFX (definições de som) extraído p/ platform/audio.js (Fase 2).
let captionsOn=true, capTimer=null; // soundOn/volume/audioCtx vêm de platform/audio.js (Fase 2)
const anyEasy=()=>players.some(p=>p.easy); // efeitos de MUNDO do Fácil (moedas no chão) ligam se QUALQUER jogador usa Fácil
const isGameKeyCode=(c)=>GAME_KEYS.includes(c)||players.some(p=>p.ctrl&&Object.values(p.ctrl).some(a=>a.includes(c)));
// Modo Fácil (deficiência motora): gravidade ×2/3, pulo ×8/7, andar ×0.7, sem perigos, sem correr,
// hitbox de coleta +4px, moedas no chão, proteção de borda, pula-pula suave (segurar = flutuar descendo).
// EASY (modo fácil) migrado p/ core/constants.js (Estágio 4, dado de dificuldade — junto de TUNE/ANIM).
// Movimento reduzido (WCAG 2.3.3 AA). 5 alvos; padrão herda prefers-reduced-motion; persistido.
// Hoje agem 'parallax' e 'walk'; 'decor/items/particles' ficam prontos e ligam quando a Cidade animar.
const RM_KEYS=['parallax','decor','items','particles']; // animações de CENA (globais)
const RM_CHAR=[ {k:'walk',prop:'rmWalk',lbl:'Personagem em movimento (andar, escalar, nadar, pular)'},
  {k:'breath',prop:'rmBreath',lbl:'Respiração (parado)'}, {k:'flavor',prop:'rmFlavor',lbl:'Gracinhas (animações de descanso)'} ]; // animações do PERSONAGEM (por jogador)
const RM_DEFAULT=!!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const rm=(()=>{ const s=store.getJSON(store.KEYS.reducedMotion,null); if(s&&typeof s==='object'){ const o={}; RM_KEYS.forEach(k=>o[k]=!!s[k]); return o; }
  const o={}; RM_KEYS.forEach(k=>o[k]=RM_DEFAULT); return o; })();
function saveRM(){ store.setJSON(store.KEYS.reducedMotion,rm); }
// Movimento por alternância (1 dedo): tocar a direção trava a marcha; segurar acelera; pulo não interrompe. Persistido.
function loadPlayerA11y(p,i){ const v=store.get(store.KEYS.vizP(i)); if(v&&VIZ_BY_KEY[v])p.viz=v;
  p.audioSink=store.get(store.KEYS.sinkP(i))||null; // saída de áudio própria do jogador (setSinkId)
  p.easy=store.getBool(store.KEYS.easyP(i)); p.toggleMove=store.getBool(store.KEYS.toggleMoveP(i));
  p.rmWalk=store.getBool(store.KEYS.rmWalkP(i)); p.rmBreath=store.getBool(store.KEYS.rmBreathP(i)); p.rmFlavor=store.getBool(store.KEYS.rmFlavorP(i));
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
  srSay('Simulação de perda auditiva '+(on?'ligada: sons fracos ficam abafados e os agudos são cortados; falas ficam difíceis de entender.':'desligada.')); }
// ===== F1: barramento de áudio por CATEGORIA (cada uma: liga/desliga + volume). Pendura no nó mestre. =====
// AUDIO_CATS (categorias) + carga/persistência + default TTS-off extraídos p/ platform/audio-mixer.js (Fase 2).
// audioCat + catNode + setCatGain (mixer por categoria) extraídos p/ platform/audio.js (Fase 2).
// ===== F2: efeitos de interação com o ambiente (passos por superfície, portas, escada) — ruído filtrado sintetizado =====
// noiseBuffer + FOOT + noiseHit + _footCount (synth de ruído) extraídos p/ platform/audio.js (Fase 2). _noiseBuf era var morta.
// material sob os pés (Cidade = concreto → 'piso') — usado pelo som do PASSO (game.js); não é pista espacial, fica aqui.
function surfaceUnder(pl){ const t=tileAt(Math.floor(pl.x/TILE),Math.floor((pl.y+1)/TILE)); if(t!==2&&t!==6&&t!==5)return null; return CENARIO==='cidade'?'piso':'pedra'; }
const caneOn=(pl)=>{ const m=VIZ_BY_KEY[pl.viz]; return modoCego || !!(m&&(m.kind==='blind'||m.kind==='lowvision')); }; // predicado de visão (movimento/render) — fica no game.js
// caneColor extraído p/ render/wheelchair-sprites.js (Estágio 4).
// TTS (narração por voz: Piper neural lazy + fallback Web Speech) extraído p/ platform/tts.ts (Tier 2, #38). Criado ANTES do
// audio-nav porque o nav injeta narrate. As funções de painel (populateTTS*/reflectTTS) ficam no game.js (→ #54) e usam get/set.
const tts = createTts({ srSay, srAlert, ensureAC, catNode, audioOut, getSoundOn: () => soundOn, getVolume: () => volume, getAudioCat: () => audioCat });
// Pistas espaciais a11y (bengala · sonar · guarda de beirada · guia · nado, por dispositivo) extraídas p/ platform/audio-nav.ts
// (Tier 2, áudio r3). playerCtx/panFor/needsAudioCues expostos na API porque a guarda de beirada + o gate de movimento os
// chamam de fora do cluster. Estado do guia (_guideCount) e SURF_MAT vivem agora no módulo. Uso: nav.<fn>.
const nav = createAudioNav({ tileAt, solidAt, held, tonePan, noiseHit, srSay, narrate: tts.narrate, BOX, TILE, LOGICAL_W, VIZ_BY_KEY,
  getCoins: () => coins, getPlayers: () => players, getNumPlayers: () => numPlayers, getCenario: () => CENARIO,
  getModoCego: () => modoCego, getAudioCtx: () => audioCtx, getSoundOn: () => soundOn, getAudioCat: () => audioCat });
// ===== F4: camadas de AMBIENTE (loops sintetizados) + PISTA/GUIA auditivo (beacon em laço) =====
// Trilha de ambiente sintetizada + trovão extraídos p/ platform/audio-ambient.ts (Tier 2, áudio r4). O clima VISUAL fica no
// game.js (updateWeather/drawWeather) e migra p/ render depois. Uso: ambient.updateAmbient / ambient.thunder.
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

/* ===== Parallax: 3 camadas de FUNDO atrás do tileset (Camada 1 = tileset+personagem).
   Camada 4 (fator 0.10) é a mais distante e "quase não se mexe" — receberá a maior
   imagem possível do PixelLab. Vivem DENTRO do camera (contra-posicionadas p/ ficarem
   fixas na tela) para também aparecerem nas render-textures do multiplayer.
   tilePosition faz o scroll fracionado → ilusão de profundidade. */
const PARALLAX=[
  {key:'sky',  factor:0.10, fy:0}, // Camada 4 — mais distante (céu/horizonte), maior imagem
  {key:'far',  factor:0.28, fy:0}, // Camada 3
  {key:'near', factor:0.52, fy:0}, // Camada 2 — mais próxima do tileset (fy=0: parallax horizontal clássico; textura=altura do viewport → sem repetição vertical)
];
/* L6 (REFEITO — fiel à v3.1.100): os 4 temas usam EXATAMENTE o céu, as nuvens, as montanhas, a grama
   e a decoração viva de lá (fórmulas copiadas). BLOCOS = Clarity SEM recolor (a v3 não recoloria tiles
   por tema). NENHUM tema tem chuva — chuva é só da Cidade. */
const CENARIOS={
  cidade:   {nome:'Cidade', v3:false},
  campo:    {nome:'Dia no Campo',       v3:true, sky:['#86c5e8','#cfeecb'], cloud:['#ffffff','#d4e6f5'], hills:['#9fd47e','#6fb84e'], decor:['nuvens','passaros','borboletas']},
  cemiterio:{nome:'Amanhecer no Campo', v3:true, sky:['#2b2540','#5a4f6b'], cloud:['#d9c4dd','#a98fb6'], hills:['#4a5f55','#33473d'], decor:['nuvens','passaros','sparkles','minhocas','nevoa']},
  espaco:   {nome:'Noite no Campo',     v3:true, sky:['#05030f','#161033'], cloud:['#3a3550','#262238'], hills:['#1e3030','#142024'], decor:['nuvens','sparkles','vagalumes']},
  floresta: {nome:'Floresta',           v3:true, sky:['#3f6b50','#8fbf73'], cloud:['#cfe6b8','#a7cf86'], hills:['#2f5e35','#1f4226'], decor:['nuvens','passaros','borboletas']},
};
const THEME_FLORA={ // v3 exato — grama/flores por tema
  campo:    {base:'#52933c',top:'#7cc35a',bLt:'#8fd968',bDk:'#46822f',center:'#ffe14d',petals:['#ffe14d','#ff7eb6','#ffffff','#ff6b6b']},
  cemiterio:{base:'#46624f',top:'#5e7d68',bLt:'#6f9079',bDk:'#3a5244',center:'#f0e6d0',petals:['#c9b6e8','#e7c9dd','#b6c9e8']},
  espaco:   {base:'#2d4650',top:'#40606a',bLt:'#557f88',bDk:'#26404a',center:'#fff6c0',petals:['#d6ecff','#ffffff','#cfffe8']},
  floresta: {base:'#3a7a34',top:'#5fa84a',bLt:'#6fc255',bDk:'#2f6329',center:'#ffe14d',petals:['#c98ce0','#ffffff','#ffd166','#ff7eb6']},
};
const hexN=s=>parseInt(String(s).slice(1),16);
// parallaxPlaceholder/themeSkyTexture/themeHillsTexture extraídos p/ render/scene-parallax.js (Estágio 4).
// updateParallax (scroll/render-graph) fica aqui por ora.
const parallaxLayers=PARALLAX.map((p,i)=>{
  const ts=new PIXI.TilingSprite(parallaxPlaceholder(i),LOGICAL_W,LOGICAL_H);
  camera.addChildAt(ts,i); // i=0 (sky) fica no fundo; depois far, near; tileset entra por cima
  return ts;
});
const parallaxTexNormal=parallaxLayers.map(ts=>ts.texture); // texturas normais (recoloridas p/ o fundo no alto contraste)
function updateParallax(camX,camY){
  for(let i=0;i<parallaxLayers.length;i++){ const ts=parallaxLayers[i],p=PARALLAX[i];
    ts.x=camX; ts.y=camY;                                  // anula o camera → fixa na tela
    if(rm.parallax){ ts.tilePosition.set(0,0); continue; } // movimento reduzido: fundo vira papel de parede estático
    ts.tilePosition.x=-camX*p.factor; ts.tilePosition.y=-camY*p.fy;
  }
  // L6: decor de TELA da v3 (estrelas atrás dos morros · nuvens/pássaros à frente deles · névoa na frente de tudo)
  if(typeof starsG!=='undefined'){ starsG.position.set(camX,camY); skyDecoG.position.set(camX,camY); fogG.position.set(camX,camY); }
}
/* Tema de cenário: troca as 3 texturas de parallax por assets/cenarios/<tema>/c{4,3,2}.png.
   Sem tema definido → placeholders. Persiste em localStorage. */
let _vidaReady=false; // _vidaReady: camadas de vida/tráfego/tema já existem (applyCenarioVida pode rodar). CENARIO vem de core/state.js (Fase 2, mega-var 4)
function loadTileImages(theme){ return new Promise(res=>{
  const fill=new Image(), surf=new Image(); let n=0, fail=false;
  const done=()=>{ if(fail)return; if(++n===2) res({fill,surface:surf}); };
  fill.onload=done; surf.onload=done; fill.onerror=surf.onerror=()=>{fail=true;res(null);};
  fill.src='assets/cenarios/'+theme+'/tile_fill.png'; surf.src='assets/cenarios/'+theme+'/tile_surface.png';
}); }
function setCenario(theme){ if(!CENARIOS[theme])theme='cidade';
  setCenarioValue(theme); // core/state.js: valor + persistência (incl_cenario) + evento; a validação e o trabalho de textura ficam aqui
  const T=CENARIOS[theme];
  if(T.v3){ // fiel à v3: céu-gradiente + 2 bandas de morros (fórmulas de lá); sem PNG (a arte por tema entra depois)
    const texs=[themeSkyTexture(T),themeHillsTexture(T,false),themeHillsTexture(T,true)];
    parallaxLayers.forEach((ts,i)=>{ parallaxTexNormal[i]=texs[i]; vp.clearParallaxTexCache(); if(vizMode==='normal') ts.texture=texs[i]; });
  } else parallaxLayers.forEach((ts,i)=>{ const n=[4,3,2][i], img=new Image(); // Cidade: PNG com fallback p/ placeholder
    img.onload=()=>{ if(CENARIO!==theme)return; const t=PIXI.Texture.from(img); t.baseTexture.scaleMode=PIXI.SCALE_MODES.NEAREST;
      parallaxTexNormal[i]=t; vp.clearParallaxTexCache(); if(vizMode==='normal') ts.texture=t; };
    img.onerror=()=>{ if(CENARIO!==theme)return; const t=parallaxPlaceholder(i);
      parallaxTexNormal[i]=t; vp.clearParallaxTexCache(); if(vizMode==='normal') ts.texture=t; };
    img.src='assets/cenarios/'+theme+'/c'+n+'.png'; });
  loadTileImages(theme).then(tiles=>{ if(CENARIO!==theme)return;
    worldCanvasNormal=worldCanvas(tiles); worldTexNormal=tex(worldCanvasNormal); clearWorldTexCache(); // v3: blocos Clarity SEM recolor
    if(vizReady) reapplyVizAll(); else if(worldSprite) worldSprite.texture=worldTexNormal; });
  // (o Cenário saiu do menu de pausa — a escolha é do J1 no splash, antes de começar)
  if(_vidaReady) sceneCity.applyCenarioVida(); // liga/desliga carros/deco da cidade e semeia as peculiaridades do tema
  if(vizReady) reapplyVizAll(); // reaplica o cenário recolorido (só após o init montar tudo)
  // incl_cenario agora é persistido por setCenarioValue (core/state.js)
}
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
let hcMode = vizMode!=='normal'; // mantém o nome p/ o resto do código (agora = "modo de cor acessível ativo")
let vizReady=false; // só após todas as dependências de applyViz existirem (evita TDZ no init via setCenario)
let worldCanvasNormal=worldCanvas();
let worldTexNormal=tex(worldCanvasNormal);
const worldSprite=new PIXI.Sprite(worldTexNormal); camera.addChild(worldSprite);
// L6: camadas de decor de TELA da v3 (contra-posicionadas no updateParallax, como o parallax)
var starsG=new PIXI.Graphics();   camera.addChildAt(starsG, camera.getChildIndex(parallaxLayers[1]));  // estrelas ATRÁS dos morros
var skyDecoG=new PIXI.Graphics(); camera.addChildAt(skyDecoG, camera.getChildIndex(worldSprite));      // nuvens/pássaros à frente dos morros, atrás dos tiles
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
try{ setCenario((v=>v==='noite'?'espaco':v)(store.get(store.KEYS.cenario,'cidade'))); }catch(e){ setCenario('cidade'); } // migra a chave antiga 'noite'
const coinCanvasNormal=coinCanvas();
const coinTex=tex(coinCanvasNormal);
// As texturas NORMAIS ja existem: ligue o alto contraste. worldCanvasNormal/worldTexNormal sao `let`
// (setCenario os reescreve ao trocar de tema), entao entram por getter e nao por valor.
initHighContrast({ W: WORLD_W, H: WORLD_H, outlineFg: () => hcOutlineFg, outlineBg: () => hcOutlineBg,
  getWorldCanvasNormal: () => worldCanvasNormal, getWorldTexNormal: () => worldTexNormal,
  coinCanvasNormal, coinTexNormal: coinTex });
// caches de modos acessíveis (preguiçosos), invalidados ao trocar de cenário (worldCanvasNormal muda)
let _lastSharedViz=null; // cache do modo aplicado (otimizacao do render MP) — NAO e do alto contraste:
// e escrito por rebuildCoins/rebuildExtras/applySharedTextures/setPlayerViz/reapplyVizAll. Fica aqui.
// _worldTexHC/_coinTexHC/worldTexFor/coinTexFor migraram para render/high-contrast.ts (Onda A).
// shapeTexture/SHAPE_TEX/letterTexture migraram para render/textures.ts (Onda A). O init vem AQUI porque
// o primeiro uso (rebuildCoins, logo abaixo) precisa dos caches ja preenchidos.
initTextures({ disp, directCfg: DIRECT_CFG, directSpriteCanvas });
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
let powerups=[];
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
  decorSeed = (Math.random()*1e9)>>>0; // #69: nova semente por fase
  const _blind = modoCego || players.some(p=>{const m=VIZ_BY_KEY[p.viz];return m&&m.kind==='blind';});
  ({ powerups, gateTiles, gate, gateOpen } = lgSetupExtras(MAP_ITEMS, MAP_GATE, { wheelchair, blind:_blind }));
  rebuildExtras();
}
setupExtras();

// Fácil: retângulo translúcido mostrando a hitbox de coleta tolerante (sob o player)
const easyHitbox=new PIXI.Graphics(); camera.addChild(easyHitbox);
// Cadeirante: RAMPAS desenhadas sobre os degraus de 1 tile (sobre o mundo, abaixo do player)
camera.addChildAt(rampLayer, camera.getChildIndex(worldSprite)+1); // z-order INTOCADO: mesma posicao de sempre
// buildRamps + WC_BRIDGES migraram para game/level-geometry.ts (Onda A).
// WC_ELEVATORS (fossos só-cadeirante) movidos p/ game/elevators.js (Estágio 4).
function buildWcGeom(){ wcSolid = lgBuildWcGeom(wheelchair); } // envolucro: o modulo calcula, o game.js segue dono do wcSolid
buildWcGeom();
buildRamps(); // desenha as rampas + coberturas (lava, pontes) se já iniciar em modo cadeirante
// CORDAS FLUTUANTES na superfície da água (o cego atravessa por elas; visual para todos)
camera.addChildAt(ropeLayer, camera.getChildIndex(worldSprite)+1); // z-order INTOCADO: mesma posicao de sempre
// buildRopes migrou para game/level-geometry.ts (Onda A).
buildRopes();
// ELEVADOR (cadeirante): trampolim = plataforma LARGA, escada = plataforma FINA. Toque ↑/↓ = viaja até a parada segura.
// ELEV_SPEED/elevShafts/buildElevators/elevAt extraídos p/ game/elevators.js (Estágio 4). drawElevators (cabine
// de vidro) fica aqui e lê os poços por getElevShafts(). WC_ELEVATORS foi p/ o módulo; WC_BRIDGES fica (ramps).
initElevators({ W: WORLD_W, H: WORLD_H, isWheelchair: () => wheelchair }); // liga o módulo às dims + estado
buildElevators();
const elevLayer=new PIXI.Graphics(); camera.addChildAt(elevLayer, camera.getChildIndex(worldSprite)+1);
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
const LIFE_TEX=(()=>{ const mk=(w,h,paint)=>{ const cv=makeCanvas(w,h),c=cv.getContext('2d'); paint((x,y,ww,hh,col)=>{c.fillStyle=col;c.fillRect(x,y,ww,hh);}); return tex(cv); };
  const pombo=f=>mk(7,6,px=>{ px(1,2,4,2,'#9aa3b2'); px(0,3,2,1,'#7d8695');
    if(f===0){ px(4,1,2,2,'#b9c2d0'); px(6,2,1,1,'#e0a23c'); } else { px(4,3,2,2,'#b9c2d0'); px(6,4,1,1,'#e0a23c'); } // cabeça alta / bicando
    px(2,5,1,1,'#c96a2e'); px(4,5,1,1,'#c96a2e'); });
  const pomboFly=f=>mk(8,7,px=>{ px(2,3,4,2,'#9aa3b2'); px(6,2,2,2,'#b9c2d0'); px(7,3,1,1,'#e0a23c');
    if(f===0)px(1,0,4,2,'#c8d0dc'); else px(1,5,4,2,'#c8d0dc'); });                                  // asa cima/baixo
  const gato=f=>mk(12,8,px=>{ px(1,3,8,3,'#454b58'); px(8,1,3,3,'#454b58'); px(8,0,1,1,'#454b58'); px(10,0,1,1,'#454b58');
    px(0,2,1,3,'#454b58'); px(9,2,1,1,'#9fe07a');
    if(f===0){ px(2,6,1,2,'#454b58'); px(7,6,1,2,'#454b58'); } else { px(3,6,1,2,'#454b58'); px(6,6,1,2,'#454b58'); } });
  const cao=f=>mk(13,9,px=>{ px(1,3,9,4,'#8a6a44'); px(9,1,4,4,'#8a6a44'); px(12,2,1,2,'#3a2d1c'); px(9,0,2,2,'#6d5334');
    px(0,2,1,3,'#8a6a44');
    if(f===0){ px(2,7,1,2,'#6d5334'); px(8,7,1,2,'#6d5334'); } else { px(3,7,1,2,'#6d5334'); px(7,7,1,2,'#6d5334'); } });
  return { pombo:[pombo(0),pombo(1)], pomboFly:[pomboFly(0),pomboFly(1)], gato:[gato(0),gato(1)], cao:[cao(0),cao(1)] };
})();
// Adultos = SILHUETAS 16×32 (mesma proporção/tamanho do personagem), formatos distintos M/F (pedido do José)
const ADULT_TEX=(()=>{ const col='#262b38';
  const mk=paint=>{ const cv=makeCanvas(16,32),c=cv.getContext('2d'); c.fillStyle=col;
    const px=(x,y,w,h)=>c.fillRect(x,y,w,h); paint(px); return tex(cv); };
  const legs=(px,f,skirt)=>{ if(skirt){ px(4,20,8,6); if(f===0){px(5,26,2,6);px(9,26,2,6);}else{px(4,26,2,6);px(10,26,2,6);} }
    else { if(f===0){px(5,20,3,12);px(9,20,3,11);} else {px(4,20,3,11);px(10,20,3,12);} } };
  const arms=(px,f)=>{ if(f===0){px(2,10,2,8);px(12,10,2,8);} else {px(2,11,2,7);px(12,9,2,8);} };
  const V=[ // 3 silhuetas masculinas + 3 femininas, todas 16×32
    f=>px=>{ px(4,0,8,6); px(3,6,10,14); arms(px,f); legs(px,f,false); },                              // M1: ombros largos
    f=>px=>{ px(5,0,6,5); px(3,1,10,2); px(5,5,6,15); arms(px,f); legs(px,f,false); },                 // M2: magro, de boné
    f=>px=>{ px(4,1,8,5); px(2,6,12,14); arms(px,f); legs(px,f,false); },                              // M3: troncudo
    f=>px=>{ px(4,0,8,6); px(11,3,3,10); px(4,6,8,10); px(3,16,10,5); arms(px,f); legs(px,f,true); },  // F1: rabo de cavalo + saia
    f=>px=>{ px(3,0,10,6); px(2,4,3,13); px(11,4,3,13); px(5,6,6,10); px(4,16,8,5); legs(px,f,true); },// F2: cabelo longo + vestido
    f=>px=>{ px(3,0,10,7); px(4,7,8,9); px(3,16,10,5); arms(px,f); legs(px,f,true); },                 // F3: chanel + saia
  ];
  return V.map(v=>[mk(v(0)),mk(v(1))]); })();
// LIFE_KINDS/creatures/_lifeSpawnT/spawnCreature/stepLife migraram para game/life.ts (Onda A).
// inDark/lifeSurfaceAt/lifeSurfaceLowAt/streetCols FICAM: render/scene-city usa lifeSurfaceAt tambem.
function inDark(tx,ty){ for(const r of darkRegions){ if(r.set.has(tx+','+ty))return true; } return false; } // célula de área secreta?
function lifeSurfaceAt(tx){ for(let ty=3;ty<WORLD_H-1;ty++){ if(solidAt(tx,ty)&&!solidAt(tx,ty-1)&&tileAt(tx,ty-1)!==3&&tileAt(tx,ty)!==9&&tileAt(tx,ty-1)!==9&&!inDark(tx,ty-1)) return ty; } return -1; } // superfície AO AR LIVRE (fora das secretas), a MAIS ALTA; ty-1!==9 = nada spawna DENTRO da lava
function lifeSurfaceLowAt(tx){ for(let ty=WORLD_H-2;ty>3;ty--){ if(solidAt(tx,ty)&&!solidAt(tx,ty-1)&&tileAt(tx,ty-1)!==3&&tileAt(tx,ty)!==9&&tileAt(tx,ty-1)!==9&&!inDark(tx,ty-1)) return ty; } return -1; } // idem, a MAIS BAIXA (calçada/fachada); ty-1!==9 = fora da lava
let _streetCols=null; // colunas ABERTAS da rua/fachada (superfície mais baixa, fora das secretas) — computadas 1×
function streetCols(){ if(_streetCols)return _streetCols; _streetCols=[];
  for(let tx=2;tx<WORLD_W-2;tx++){ const ty=lifeSurfaceLowAt(tx); if(ty>0&&ty*TILE>WORLD_PX_H*0.55)_streetCols.push([tx,ty]); }
  return _streetCols; }
life.initLife({ layer: lifeLayer, makeSprite: (t) => new PIXI.Sprite(t), lifeTex: LIFE_TEX, adultTex: ADULT_TEX,
  lifeSurfaceAt, lifeSurfaceLowAt, streetCols, decoSprites, rm, W: WORLD_W, pxW: WORLD_PX_W, pxH: WORLD_PX_H });
/* ===================== L5: CARROS (camada da FRENTE) + SEMÁFORO funcional — procedural ===================== */
// Carros cruzam a rua À FRENTE do player (carLayer re-erguido em ensureSprites); param no vermelho/amarelo
// do semáforo e seguem no verde. Ciclo LENTO (verde 8s → amarelo 2s → vermelho 6s) — sem flashes (WCAG 2.3.1).
const carLayer=new PIXI.Container(); camera.addChild(carLayer);
const CAR_TEX=(()=>{ const mk=(body,dark,top)=>{ const cv=makeCanvas(78,36),c=cv.getContext('2d'); // 3× NATIVO (detalhado, sem upscale)
  const px=(x,y,w,h,cl)=>{c.fillStyle=cl;c.fillRect(x,y,w,h);};
  px(3,14,72,13,body); px(3,25,72,2,dark);              // corpo + saia escura
  px(1,16,2,8,dark); px(75,16,2,8,dark);                // para-choques
  px(15,4,40,11,top); px(17,6,36,9,body);               // cabine (teto escuro + faixa)
  px(19,7,14,7,'#bcd6ee'); px(37,7,14,7,'#bcd6ee');     // vidros
  px(20,8,4,2,'#eef6ff'); px(38,8,4,2,'#eef6ff');       // brilho dos vidros
  px(34,7,3,7,top); px(53,10,4,4,dark);                 // coluna B + retrovisor
  px(3,14,72,1,'rgba(255,255,255,.28)');                // realce superior da lataria
  px(0,17,3,5,'#ffd9a0'); px(75,17,3,5,'#ff6a5a');      // farol / lanterna
  const wheel=(wx)=>{ px(wx-2,22,18,6,dark); px(wx,24,14,11,'#10131a'); px(wx+3,27,8,5,'#2b3140'); px(wx+5,29,4,2,'#8a93a8'); }; // caixa de roda + pneu + calota
  wheel(11); wheel(53);
  return tex(cv); };
  return [mk('#c8452e','#7d2717','#a03a24'),mk('#2e6fc8','#193f7d','#2757a0'),mk('#3aa15b','#1f6336','#2f8a4c'),mk('#c8a12e','#7d641a','#a8862a')]; })();
// R-cidade (José 2026-07-03): o cenário é o INTERIOR de um prédio; a parte mais baixa é a FACHADA e a
// rua fica NA FRENTE dela → carros (3×) e placas de PARE vivem na BASE do mundo, na camada da frente.
// cars/_carT/STREET_Y/SEM/drawSemaforo/initTraffic/spawnCar/setFrontDim/stepTraffic migraram para
// game/traffic.ts (Onda A). carLayer e CAR_TEX ficam: a camada tem z-order soldado aqui e a textura
// e pintura de canvas, nao logica de transito.
traffic.initTraffic({ carLayer, CAR_TEX, SpriteCtor: PIXI.Sprite, GraphicsCtor: PIXI.Graphics,
  WORLD_PX_W, WORLD_PX_H, WORLD_W, getRm: () => rm });
/* ===================== L5: DECORAÇÃO POR ZONA (procedural, desenhada UMA vez) =====================
   Rua: calçada+meio-fio, postes com brilho ESTÁVEL, placas (PARE/faixa), letreiros nas fachadas.
   Caixa d'água: paredes de tanque + linha d'água. Interior de prédio (alto): janelas.
   Secretas (darkRegions): entulho/viga/pichação — desenhados ABAIXO do darkLayer (só aparecem revelados). */
const cityDecoG=new PIXI.Graphics(); lifeLayer.addChildAt(cityDecoG,0); // atrás dos bichos, à frente do mundo
const abandonG=new PIXI.Graphics(); camera.addChildAt(abandonG, camera.getChildIndex(darkLayer)); // SOB a escuridão
// buildCityDeco migrou para render/scene-city.ts (Onda A); a chamada de boot desceu para junto do init,
// depois que TODAS as camadas dele existem (lavaFxG/waterFxG nascem mais abaixo).
/* ===================== L5+: CÉU — nuvens à deriva + pássaros cruzando (procedural) =====================
   Atrás dos tiles (sobre o parallax). Nuvens derivam devagar e dão a volta; pássaros de 2 quadros cruzam
   o céu de vez em quando. rm.decor congela nuvens e remove pássaros. */
const skyLayer=new PIXI.Container(); camera.addChildAt(skyLayer, camera.getChildIndex(worldSprite));
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
let grassDensity=1, decorSeed=0; // flora: fração de superfícies com grama (0..1; base p/ ESTAÇÕES) + semente randômica por fase — #69
const sceneSky = createSceneSky({ skyLayer, starsG, skyDecoG, fogG, grassG, themeFxG, themeFxBackG, CLOUD_TEX, BIRD_TEX, SpriteCtor: PIXI.Sprite,
  hexN, rnd, randInt, WORLD_PX_W, WORLD_PX_H, WORLD_W, WORLD_H, TILE, LOGICAL_W, LOGICAL_H, BOX,
  CENARIOS, THEME_FLORA, DIRECT_CFG, solidAt, tileAt,
  getCenario: () => CENARIO, getVizMode: () => vizMode, getPlayers: () => players, getFxClock: () => fxClock, getRm: () => rm,
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
let vpPause=[], pauseActor=0; // gameHudEl/vpHudDom/vpQuitDom/vpScreens migraram para ui/hud.ts (Onda A)
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
  setPauseActor: (i) => { pauseActor = i; },
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
  $, powerShort: POWER_SHORT,
  buildScreenPause: (i) => pauseIcons.buildScreenPause(i),
  onScreensBuilt: (panes) => { vpPause = panes;
    // No 1o build do init, LETRA/PAD_DESIGNS ainda estao em TDZ — o try/catch ignora e o fluxo de init
    // preenche logo depois. Preservado verbatim, inclusive o engolir de qualquer erro.
    try{ applyLetra(false); }catch(e){}
    try{ renderPauseLegend(); }catch(e){} },
});
const buildGameHud  = () => hud.buildGameHud();
const updateGameHud = () => hud.updateGameHud();
function configureRender(){
  vpSpr.forEach(s=>s.destroy()); vpSpr=[]; vpTex.forEach(t=>t.destroy(true)); vpTex=[];
  if(vpFrames){ vpFrames.destroy(); vpFrames=null; }
  vpDots.forEach(g=>g.destroy()); vpDots=[];
  if(numPlayers<=1){
    if(camera.parent!==app.stage) app.stage.addChildAt(camera,0);
    setMinimapVisible(true); app.renderer.resize(LOGICAL_W,LOGICAL_H); buildGameHud();
  } else {
    if(camera.parent) camera.parent.removeChild(camera); // câmera renderizada manualmente nas RTs
    setMinimapVisible(false);
    const { cols, rows } = screenGrid(numPlayers); // era a copia DIVERGENTE (sem a guarda de 1 tela)
    app.renderer.resize(LOGICAL_W*cols, LOGICAL_H*rows);
    const positions=[];
    for(let i=0;i<numPlayers;i++){
      let x=(i%cols)*LOGICAL_W, y=Math.floor(i/cols)*LOGICAL_H;
      if(numPlayers===3 && i===2) x=(LOGICAL_W*cols-LOGICAL_W)/2; // 3 telas: a 3ª centralizada na linha de baixo
      const rt=PIXI.RenderTexture.create({width:LOGICAL_W,height:LOGICAL_H}); rt.baseTexture.scaleMode=PIXI.SCALE_MODES.NEAREST;
      const s=new PIXI.Sprite(rt); s.x=x; s.y=y;
      app.stage.addChild(s); vpTex.push(rt); vpSpr.push(s); positions.push([x,y]);
    }
    // linha de moldura por tela (1px lógico; escala por k junto com o canvas) — separa e enquadra como a tela única
    vpFrames=new PIXI.Graphics();
    for(const [x,y] of positions){ vpFrames.lineStyle(1,0xcdd6f2,0.95); vpFrames.drawRect(x+0.5,y+0.5,LOGICAL_W-1,LOGICAL_H-1); }
    app.stage.addChild(vpFrames);
    vpDots=positions.map(([x,y])=>{ const g=new PIXI.Graphics(); g.x=x+LOGICAL_W-9; g.y=y+9; g.visible=false; app.stage.addChild(g); return g; }); // bolinhas por viewport (acima de tudo, sem filtro)
    buildGameHud(); applyVpFilters(); updateVpDots();
  }
}

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
  coinPools: ()=>coinPools(), rebuildCoins, updateHud, setCollected: (n)=>{ collected=n; },
});
function stepPlayer(pl,dt){
  const _p=stepPhysics(pl,dt); if(!_p.ran)return; const dir=_p.dir; // fisica em game/physics.ts
  // coletar (P1 abre quiz nos modos didáticos; MP é Lúdico). Fácil: hitbox de coleta +4px por lado.
  const pad=pl.easy?EASY.pad:0;
  const box={x:pl.x-BOX.w/2-pad,y:pl.y-BOX.h-pad,w:BOX.w+2*pad,h:BOX.h+2*pad};
  coins.forEach((cn,i)=>{ if(cn.taken||cn.owner!==pl.i)return; // Lote C: só coleta os itens da SUA cor
    const big=(MODE!=='ludico'); const sz=big?15:9, ox=big?3:0;
    if(box.x<cn.x+sz-ox&&box.x+box.w>cn.x-ox&&box.y<cn.y+sz-ox&&box.y+box.h>cn.y-ox){
      if(MODE==='somasub'&&cn.shape){ if(!pl.quiz) openQuiz(pl,i,cn.shape); }       // L3: quiz POR JOGADOR (MP incluso)
      else if(MODE==='silabas'&&cn.letter){ if(!pl.quiz) openSilabas(pl,i,cn.letter); }
      else { takeCoin(cn); getCoinSprites()[i].visible=false; pl.collected++; if(pl===player)collected=pl.collected; earcons.sfx('coin'); // some p/ todas as telas (item tem 1 dono)
        burstSparkle(cn.x+5,cn.y+5,ownerColors?(PCOLOR[cn.owner]||0xffd23f):0xffd23f,8); // JUICE: brilho na cor do dono (segue a opção)
        updateHud(); { const msg=(numPlayers>1?`Jogador ${pl.i+1}: `:'')+`Moeda ${pl.collected} de ${COIN_TARGET}.`; srSay(msg); tts.narrate(msg); }
        if(pl.collected>=COIN_TARGET)win(pl); }
    }});
  // E12: power-ups + chave (por jogador) e portão (compartilhado)
  powerups.forEach(pu=>{ if(puTaken(pu,pl.i))return;
    if(box.x<pu.x+12 && box.x+box.w>pu.x && box.y<pu.y+12 && box.y+box.h>pu.y){
      takePu(pu,pl.i); if((numPlayers<=1||pu.kind==='key') && pu.sprite)pu.sprite.visible=false; const who=numPlayers>1?`Jogador ${pl.i+1}: `:''; // chave: some p/ todos; demais: por viewport (no draw)
      burstSparkle(pu.x+6,pu.y+6,0xfff1a8,10); addHitstop(3); // JUICE: power-up = brilho dourado + micro hit-stop
      if(pu.kind==='key'){ pl.hasKey=true; earcons.sfx('key'); srAlert(who+'pegou a chave. Toque no portão para abri-lo.'); } // chave individual: só quem pegou fica com ela (mas o portão, aberto, vale p/ todos)
      else if(pu.kind==='runcane'){ pl.runCane=true; earcons.sfx('power'); const pm=who+'Bengala de corrida! Agora dá para correr — segure Correr.'; srSay(pm); tts.narrate(pm); } // cego: habilita correr (bengala com roda)
      else { if(!pl.owned.includes(pu.kind))pl.owned.push(pu.kind); pl.activePower=pu.kind; pl.clinging=false; pl.flying=false; earcons.sfx('power'); showPower(pl); const pm=who+(POWER_MSG[pu.kind]||'Poder ativado!'); srSay(pm+' (Trocar poder cicla entre os coletados.)'); tts.narrate(pm); } // entra no inventário; ativo = o último pego
    }});
  if(gate && !gateOpen && pl.hasKey){ // portão (vários tiles) abre se o portador da chave o toca (margem: vale por cima/ao lado)
    const m=4; for(const gt of gate){ const X=gt.tx*TILE, Y=gt.ty*TILE;
      if(box.x<X+TILE+m && box.x+box.w>X-m && box.y<Y+TILE+m && box.y+box.h>Y-m){ gateOpen=true; rebuildExtras(); earcons.sfx('gate'); earcons.doorSound('madeira'); srAlert('Portão aberto!'); addShake(2,12); break; } } // JUICE: portão pesado sacode a tela
  }
  // animação por frames (E15). 'moving' baseado no INPUT (direção segurada), NÃO em vx — a colisão
  // zera vx por frames e isso resetava o ciclo (só apareciam 2 quadros). Assim os 8 quadros tocam contínuos.
  // E16: estado aéreo ESTÁVEL — subindo (vy<0) entra na hora; cair/sair de borda só após coyote-time.
  // Evita o flicker walk↔jump no pouso (onGround pisca 1 frame ao repousar). 'grounded' p/ anim.
  const COYOTE=5, grounded = pl.airTime<=COYOTE;
  const airborne = !pl.clinging && ((pl.vy<0 && !pl.onGround) || !grounded);
  const moving=(dir!==0) && grounded && !pl.clinging;
  pl.walking = moving && !pl.inWater && !pl.onLadder && !pl.flying; // andando no chão (para a bengala: só aparece andando)
  pl.running = pl.walking && held(pl,'run') && !!pl.runCane;        // correndo (bengala de corrida): só com o item
  pl.anim += dt;                                   // idle (1 quadro; clock contínuo)
  pl.walkAnim += dt;                               // clock do passo NUNCA reseta → ciclo de 8 sem reinício
  const II=TEX_IDLE;
  const wcFreeze = wheelchair || pl.rmWalk; // cadeirante: pernas paradas (sentado) — mesma via do movimento reduzido
  let tx; pl.idleNow=false;
  // E17: prioridade ventosa → escada → água → voo → aéreo(pulo) → andando → idle
  // movimento reduzido: pl.rmWalk congela TODA a locomoção (escalar, escada, nado, pulo) num quadro único
  if(pl.clinging){ const ceil=(pl.clingN==='U'); // E18f: teto e parede usam ciclos distintos
    const CL = ceil ? TEX_CLING_CEIL : TEX_CLING_WALL;
    if(!pl.rmWalk && (pl.vx!==0||pl.vy!==0)) pl.climbFrame=(Math.floor(pl.walkAnim/ANIM.clingHold))%CL.length; // só avança ao mover; parado MANTÉM o quadro
    tx = CL[(pl.rmWalk?0:(pl.climbFrame||0))%CL.length]; }
  else if(pl.onLadder){ const CB=TEX_CLIMB;
    if(wheelchair){ tx = II[0]; }                                  // ELEVADOR cadeirante: pose PARADA (idle), não de escada
    else { const climbing=(pl.vy!==0)&&!pl.rmWalk; tx = climbing ? CB[Math.floor(pl.walkAnim/ANIM.climbHold)%CB.length] : CB[0]; } }
  else if(pl.inWater){ const stroking=((dir!==0)||held(pl,'jump'))&&!wcFreeze; // movendo = braçada+pernas; parado/congelado/cadeirante = pernas paradas
    const SW = stroking ? TEX_SWIM : TEX_SWIMIDLE;
    tx = wcFreeze ? SW[0] : SW[Math.floor(pl.walkAnim/ANIM.swimHold)%SW.length]; }
  else if(pl.flying)              tx = TEX_FLY;
  else if(airborne){ if(wcFreeze) tx = wheelchair ? II[0] : TEX_JUMP_UP; // cadeirante caindo = pose neutra sentado; congelado = pulo num quadro
    else tx = pl.vy<0 ? TEX_JUMP_UP : TEX_JUMP_DOWN; }           // subindo: pernas recolhidas / caindo: estendidas
  else if(moving){
    if(wcFreeze){ tx = II[0]; }                                    // cadeirante/movimento reduzido: anda sem ciclo de passos (pose neutra)
    else { const running=held(pl,'run');                         // E19: correr (Correr segurado) ≠ andar — passada/cadência distintas
      const M = running ? TEX_RUN : TEX_WALK;
      const hold = running ? ANIM.runHold : ANIM.walkHold;
      tx = M[Math.floor(pl.walkAnim/hold)%M.length]; } }
  else { pl.idleNow=true; pl.idleTime+=dt;                       // E20: parado → respira; após flavorDelay, toca uma gracinha
    if(!pl.rmFlavor){                                             // gracinhas (toggle próprio — há quem se incomode)
      if(pl.flavor<0 && pl.idleTime>ANIM.flavorDelay){ pl.flavor=Math.floor(rnd()*FLAVORS.length); pl.flavorT=0; }
      if(pl.flavor>=0){ const F=FLAVORS[pl.flavor]; const step=Math.floor(pl.flavorT/F.hold); pl.flavorT+=dt;
        if(step>=F.seq.length){ pl.flavor=-1; pl.idleTime=0; } else { tx=F.tex[F.seq[step]]; } }
    } else pl.flavor=-1;
    if(pl.flavor<0) tx = pl.rmBreath ? II[0] : II[Math.floor(pl.anim/ANIM.idleHold)%II.length]; } // respiração: congela (quadro 0) ou cicla
  if(!pl.idleNow){ pl.idleTime=0; pl.flavor=-1; }                 // saiu do idle → zera gracinha
  pl._tx=tx;                                                     // quadro base (cor) p/ recolor por viewport
  if(pl.sprite) pl.sprite.texture=playerVizTex(tx, pl.viz);      // solo/default; no MP o draw troca por viewport
}
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
  // E1 (corrigido): revela a área secreta ENQUANTO houver jogador dentro e RE-ESCURECE ao sair.
  // Não é inversão — só mostra o que estava escondido e some de novo ao deixar o ambiente.
  for(const reg of darkRegions){
    let occ=false;
    for(const pl of players){
      const tx0=Math.floor((pl.x-BOX.w/2)/TILE),tx1=Math.floor((pl.x+BOX.w/2-0.01)/TILE);
      const ty0=Math.floor((pl.y-BOX.h)/TILE),ty1=Math.floor((pl.y-0.01)/TILE);
      for(let ty=ty0;ty<=ty1&&!occ;ty++)for(let tx=tx0;tx<=tx1;tx++){ if(reg.set.has(tx+','+ty)){occ=true;break;} }
      if(occ)break;
    }
    const target=occ?0:1, step=0.08*dt;
    if(reg.gfx.alpha!==target){
      reg.gfx.alpha = target>reg.gfx.alpha ? Math.min(target,reg.gfx.alpha+step) : Math.max(target,reg.gfx.alpha-step);
      reg.gfx.visible = reg.gfx.alpha>0.001;
    }
    if(occ && !reg.announced){ reg.announced=true; srSay('Área secreta revelada.'); }
    else if(!occ && reg.gfx.alpha>=1) reg.announced=false; // re-anuncia na próxima entrada
  }
}
function placeCam(pl){
  let camX=pl.x-LOGICAL_W/2, camY=(pl.y-BOX.h/2)-LOGICAL_H/2;
  camX=Math.max(0,Math.min(camX,WORLD_PX_W-LOGICAL_W)); camY=Math.max(0,Math.min(camY,WORLD_PX_H-LOGICAL_H));
  const k=shakeAmp(); if(k>0){ // JUICE: tremor decai linearmente (render/fx); re-clampa p/ não mostrar o vazio
    camX=Math.max(0,Math.min(camX+(rnd()*2-1)*k,WORLD_PX_W-LOGICAL_W)); camY=Math.max(0,Math.min(camY+(rnd()*2-1)*k,WORLD_PX_H-LOGICAL_H)); }
  camera.x=-Math.round(camX); camera.y=-Math.round(camY); updateParallax(camX,camY); return {camX,camY};
}
function draw(){
  for(const pl of players){ if(!pl.sprite)continue;
    pl.sprite.x=pl.x; pl.sprite.y=pl.y+1;
    const q=(JUICE.squash&&!pl.rmWalk&&pl.sqT>0)?(pl.sq||0)*easeOut3(pl.sqT/8):0; // JUICE: squash&stretch com easing, ancorado nos pés
    pl.sprite.scale.set((pl.facing<0?-1:1)*(1-q*0.7), 1+q); // sem escala procedural de respiração (parecia mastigar) — respiração é por FRAMES
    pl.sprite.alpha = pl.hurtTimer>0 ? (Math.floor(pl.hurtTimer/4)%2?0.4:1) : 1;
  }
  drawElevators(elevLayer); // cadeirante: plataforma do elevador sob os pés (largo/fino)
  drawFx(); // JUICE: partículas (poeira/brilhos) na camada acima dos players
  const shimOn=JUICE.shimmer&&!rm.items; // JUICE: cintilar dos itens (respeita Movimento Reduzido de itens)
  caneLayer.clear(); // modo cego: bengala SÓ andando (corrida = bengala de roda); nada parado/nadando/voando/escada
  for(const pl of players){ if(!caneOn(pl)||!pl.sprite||!pl.sprite.visible)continue;
    if(pl.running) drawRunCane(caneLayer,pl); else if(pl.walking) drawCane(caneLayer,pl); }
  chairLayer.clear(); // cadeirante: desenha a cadeira nos jogadores (exceto nadando/voando)
  if(wheelchair){ for(const pl of players){ if(pl.sprite&&pl.sprite.visible&&!pl.inWater&&!pl.flying) drawChair(chairLayer,pl); } }
  easyHitbox.clear(); // Fácil: hitbox de coleta tolerante (retângulo translúcido) — só para os jogadores em Fácil
  const pad=EASY.pad; for(const pl of players){ if(!pl.easy)continue;
    easyHitbox.lineStyle(1,0xffffff,0.45); easyHitbox.beginFill(0xffffff,0.10);
    easyHitbox.drawRect(pl.x-BOX.w/2-pad, pl.y-BOX.h-pad, BOX.w+2*pad, BOX.h+2*pad); easyHitbox.endFill(); }
  if(numPlayers<=1){
    const _cs=getCoinSprites(); for(let j=0;j<_cs.length;j++){ const s=_cs[j]; if(s)s.alpha=shimOn?0.8+0.2*Math.sin(fxClock*0.12+j*1.7):1; }
    const {camX,camY}=placeCam(players[0]);
    markSeen(camX,camY); redrawMinimapIfDirty();
    drawMinimapPlayer(players[0].x, players[0].y - BOX.h/2);
  } else {
    // Otimização: se TODOS estão no mesmo modo (caso comum), troca as texturas UMA vez; senão, por viewport.
    const v0=players[0].viz, allSame=players.every(p=>p.viz===v0), anyOverlay=players.some(p=>{const m=VIZ_BY_KEY[p.viz];return m&&m.kind==='lowvision';});
    if(allSame) applySharedTextures(v0);
    for(let i=0;i<numPlayers;i++){ const viz=players[i].viz;
      if(!allSame) applySharedTextures(viz);                      // só troca por viewport quando os modos diferem
      const _cs2=getCoinSprites(); for(let j=0;j<_cs2.length;j++){ const s=_cs2[j]; if(!s)continue; const cn=coins[j]; s.visible=!cn.taken;
        s.alpha=((cn.owner===i)?1:0.4)*(shimOn?0.8+0.2*Math.sin(fxClock*0.12+j*1.7):1); } // Lote C: item alheio esmaecido (cor do dono); JUICE: cintilar multiplicativo
      for(const pu of powerups){ if(pu.sprite)pu.sprite.visible=!puTaken(pu,i); }                            // chave some p/ todos; demais são por jogador
      placeCam(players[i]); app.renderer.render(camera,{renderTexture:vpTex[i]});
      if(anyOverlay) renderVpOverlay(i,viz);                      // passada extra só se algum jogador está em baixa visão
    }
  }
  weather.drawWeather(); // chuva/clarão em tela-espaço, sobre tudo
  updateGameHud(); // HUD por jogador (moedas + poder) em DOM sobreposto (alta definição)
}

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
function updateHud(){
  if(numPlayers<=1) $('#hud-coins').textContent=String(players[0].collected);
  else $('#hud-coins').textContent=players.map((p,i)=>`P${i+1}:${p.collected}`).join('  ');
}
function win(pl){ ended=true; if(captionsOn)showCaption('🔊 Vitória! 🎆'); jingles.playVictory(); $('#hud-objective').textContent='Concluído! 🎉';
  if(pl&&pl.sprite) for(let i=0;i<4;i++) burstSparkle(pl.x+(rnd()-0.5)*24, pl.y-BOX.h/2-rnd()*12, PCOLOR[i]||0xffd23f, 10); // JUICE: confete nas 4 cores
  const who = numPlayers>1 ? `Jogador ${(pl?pl.i:0)+1} venceu! ` : '';
  $('#win-msg').textContent=`${who}Coletou as ${COIN_TARGET} moedas.`;
  $('#win-overlay').hidden=false; srAlert(`${who}Coletou as ${COIN_TARGET} moedas.`); tts.narrate(`${who}Venceu! Coletou as ${COIN_TARGET} moedas.`); $('#btn-again').focus(); }
function restartGame(){
  players.forEach(p=>closeQuiz(p)); // L3: quiz é por jogador
  setCoins(pickCoins(COIN_TARGET, coinPools()));
  rebuildCoins();
  setupExtras(); // E12: re-posiciona power-ups + chave; portão volta a fechar
  darkRegions.forEach(r=>{ r.announced=false; r.gfx.alpha=1; r.gfx.visible=true; }); // re-escurece segredos
  resetMinimap(); // fim de fase: o MINIMAPA volta a ficar escuro (fog-of-war zera)
  collected=0; ended=false;
  players.forEach(resetPlayerState);
  updateHud();
  $('#hud-objective').textContent = numPlayers>1 ? `${numPlayers} jogadores — corrida pelas ${COIN_TARGET} moedas` : MODE==='somasub' ? 'Resolva 10 contas' : MODE==='silabas' ? 'Monte 10 palavras' : 'Colete 10 moedas';
  $('#win-overlay').hidden=true;
  // (dicas de início removidas — o rodapé do splash mostra os controles)
  srSay(numPlayers>1 ? `${numPlayers} jogadores, cada um na sua tela. Corram pelas moedas.` : MODE==='somasub' ? 'Modo Soma-Sub. Toque nas figuras e resolva as contas.' : MODE==='silabas' ? 'Modo Sílabas. Toque nas letras e monte as palavras.' : 'Nova rodada. Colete 10 moedas.');
}
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
// B3: o desafio educativo. So entra aqui o que um import nao alcanca: as `let` do game.js, as instancias
// criadas no boot (audio/HUD/menu) e os efeitos de outros slices (moeda, HUD, vitoria, toque). Os
// callbacks sao arrows de proposito: touchCtl, respawnFigure, win e updateHud nascem mais abaixo.
const quizApi = initQuiz({
  $, getScreen: (i) => hud.getScreen(i),
  disp, isBlindMode: () => blindMode, isModoCego: () => modoCego,
  actCat, tabSel, fracNot, QL_NAME,
  srSay, srAlert, gameSay, narrate: (t) => tts.narrate(t),
  sfx: (n) => earcons.sfx(n), playPuzzleSolved: () => jingles.playPuzzleSolved(),
  burstSparkle,
  hideTouchControls: () => hideTouchControls(),
  updateHud: () => updateHud(), win: (pl) => win(pl),
  respawnFigure: (i) => respawnFigure(i),
  syncCollected: (pl) => { if(pl===player) collected = pl.collected; }, // `collected` e let do game.js
});
// fmtFrac/fracGraphic/fracSpeak/speakChoice + _pieUnit/_sqGrid/FRAC_GFX extraidos p/ game/fractions.js (Estagio 4).
// fmtFrac/fracGraphic/fracSpeak/speakChoice + _pieUnit/_sqGrid/FRAC_GFX extraídos p/ game/fractions.js (Estágio 4).
const MODE_LABELS={ludico:'🪙 Lúdico',somasub:'🔷 Soma-Sub',silabas:'🔤 Sílabas'};
const MODES=['ludico','somasub','silabas'];
function setMode(m){
  MODE=m; // modos liberados em qualquer nº de telas (L3: quiz abre POR JOGADOR, na tela de quem tocou)
  const b=$('#opt-mode'); if(b){ b.textContent=MODE_LABELS[m]; b.setAttribute('aria-label','Modo: '+MODE_LABELS[m]+'. Toque para trocar.'); }
  restartGame(); $('#game-region').focus();
}
const optModeBtn=$('#opt-mode'); // botão único: cicla os 3 modos
if(optModeBtn)optModeBtn.addEventListener('click',()=>{
  const m=MODES[(MODES.indexOf(MODE)+1)%MODES.length]; setMode(m); srSay('Modo '+MODE_LABELS[m].replace(/^\S+\s/,'')+'.');
});
/* E11: nº de jogadores (1–4 telas lado a lado, simulação compartilhada) */
function setNumPlayers(n){
  n=Math.max(1,Math.min(4,n|0));
  if(n>players.length){ for(let i=players.length;i<n;i++){ const p=makePlayer(i); loadPlayerA11y(p,i); players.push(p); } }
  else if(n<players.length){ players.length=n; }
  player=players[0]; setNumPlayersValue(n);
  assignControls(); ensureSprites(); // p.pad é PRESERVADO no objeto do jogador (associação direta, sem lista posicional)
  const TEL=['👤 1 tela','👥 2 telas','👨‍👧 3 telas','👨‍👩‍👧‍👦 4 telas'];
  const tb=$('#opt-telas'); if(tb){ tb.textContent=TEL[n-1]; tb.setAttribute('aria-label','Telas: '+n+'. Toque para trocar.'); }
  if(n>1) hideTouchControls(); // E13: várias telas → sem controle por toque (ambíguo)
  configureRender();
  if(typeof reapplyVizAll==='function') reapplyVizAll(); // solo: filtro/overlay/bolinha global; MP: limpa global + filtros por viewport
  restartGame(); layout(); $('#game-region').focus();
}
// Lote B: cabe N telas na janela atual? (piso k=2 ⇒ cada viewport ≥640×360). Espelha a conta do layout().
function fitsN(n){ const wrap=$('#stage-wrap'); if(!wrap)return true;
  const availW=(wrap.clientWidth||320)-(librasOpen?LIBRAS_RESERVE:0), availH=wrap.clientHeight||180;
  const { w: baseW, h: baseH } = screenBaseSize(n);
  return availW>=2*(baseW-10) && availH>=2*(baseH-10); }
// Celular/tablet: ponteiro grosso + sem hover (não dispara em notebook com touch). No mobile o jogo é 1 tela só.
function isMobile(){ try{ return matchMedia('(pointer:coarse)').matches && matchMedia('(hover:none)').matches; }catch(e){ return 'ontouchstart' in window; } }
// Ativa dinamicamente N telas (Alt+1/2/3/4). CRESCER = novos jogadores ENTRAM no jogo em andamento (sem reinício,
// L1 — correção do José 2026-07-02); DIMINUIR = nova rodada (remover jogador muda a corrida).
function activateScreens(n){ n=Math.max(1,Math.min(4,n|0));
  if(isMobile() && n>1){ srAlert('No celular o jogo roda em uma tela só.'); return; } // B2: mobile = 1 jogador
  if(n===numPlayers){ srSay(n>1?(n+' telas já ativas.'):'1 tela.'); return; }
  if(n>numPlayers){ if(!fitsN(n)){ srAlert('Não cabem '+n+' telas nesta janela — cada tela precisa de ao menos 640×360. Aumente a janela ou use tela cheia.'); return; }
    while(numPlayers<n){ if(!joinPlayer(null))break; } srSay(numPlayers+' telas ativas.'); return; }
  setNumPlayers(n); srSay(n>1?(n+' telas ativas — nova rodada.'):'1 tela — nova rodada.'); }

/* ===================== B3/L1: entrada de gamepad ===================== */
// Reseta UM jogador ao spawn (rodada nova só na tela dele). Compartilha os campos com o restartGame.
function resetPlayerState(p,i){ p.x=SPAWN_X+i*22; p.y=SPAWN_Y; p.vx=p.vy=0; p.hurtTimer=0; p.collected=0; p.jumpBuffer=0; p.waterStroke=0; p.onLadder=false; p.quiz=null; p.quit=false; p.runCane=false; p.activePower='off'; p.owned=[]; p.swapEdge=false; p.specialEdge=false; p.hasKey=false; if(i===0)showPower(p); p.jumpChain=0; p.groundIdle=0; p.clinging=false; p.clingN=null; p.flying=false; p.idleTime=0; p.flavor=-1; if(p.sprite){p.sprite.alpha=1;p.sprite.visible=true;} }
// L1: gera/renova os itens de UM dono sem tocar os dos outros (entrada/recomeço em jogo EM ANDAMENTO).
// addCoinsForOwner/respawnCoinsForOwner migraram para game/coin-spawning.ts (Onda A).
function respawnPlayer(k){ const p=players[k]; if(!p)return; resetPlayerState(p,k); respawnCoinsForOwner(k); // recomeça SÓ este jogador: coleta tudo do zero, itens re-sorteados
  if(typeof updateGameHud==='function')updateGameHud(); srSay('Jogador '+(k+1)+' recomeçou nesta tela.'); }
// L1: entra num jogo EM ANDAMENTO (sem reiniciar a rodada dos outros): cria o jogador, a tela e os itens dele.
function joinPlayer(padIdx){
  if(isMobile()){ srAlert('No celular o jogo roda em uma tela só.'); return false; }
  if(numPlayers>=4){ srAlert('Já são 4 jogadores.'); return false; }
  if(!fitsN(numPlayers+1)){ srAlert('Não cabe mais uma tela nesta janela — cada tela precisa de ao menos 640×360.'); return false; }
  const i=players.length, p=makePlayer(i); loadPlayerA11y(p,i); if(padIdx!=null)p.pad=padIdx; players.push(p); setNumPlayersValue(players.length);
  assignControls(); ensureSprites(); hideTouchControls(); // teclado migra p/ o esquema N jogadores; toque sai (ambíguo em MP)
  configureRender(); if(typeof reapplyVizAll==='function')reapplyVizAll(); layout();
  resetPlayerState(p,i); addCoinsForOwner(i); // itens PRÓPRIOS dão spawn; os dos outros ficam intactos
  const TEL=['👤 1 tela','👥 2 telas','👨‍👧 3 telas','👨‍👩‍👧‍👦 4 telas']; const tb=$('#opt-telas'); if(tb)tb.textContent=TEL[numPlayers-1];
  srSay('Jogador '+(i+1)+' entrou no jogo em andamento.'); return true; }
// Mapa padrão (Gamepad API "standard"): 0=pulo/sim · 1=especial/não · 2=correr/interagir (X/esquerda) · 3=troca ·
// D-pad 12-15 + analógico esq. · RB/RT também correm · 9=START (pausa). Controles fora do padrão → wizard de mapeamento.
// Direções pelas FONTES PADRÃO (stick 0/1, D-pad botões 12-15, POV hat em eixos altos ≥6): o controle tem
// DOIS direcionais — quem mapeou só o stick continua com o D-pad vivo (menus!) e vice-versa.
// stdDirs/padActions/pollPads + o assistente de mapeamento inteiro migraram para input/gamepad.ts (Onda A).
// A Gamepad API entra como ADAPTADOR (getGamepads), que e o que torna o assistente testavel sem navegador.
// spriteBase e dependencia DECLARADA: era o `SPR` que o game.js usava como se fosse global e derrubava o
// assistente ao abrir (ver o commit de correcao).
const gamepadApi = initGamepad({
  getGamepads: () => (navigator.getGamepads ? navigator.getGamepads() : []), $, srSay, srAlert, frontOverlay,
  getPhase: () => phase, setPhase,
  isAttractActive: () => attractCtl.isAttract(), stopAttract: () => attractCtl.stopAttract(),
  isTouchMode: () => document.body.classList.contains('touch-mode'), hideTouchControls: () => hideTouchControls(),
  getPlayers: () => players, getNumPlayers: () => numPlayers,
  navTitle, sharedDialogOpen, navDialog, getPauseMenu: (i) => vpPause[i], navPause,
  setPauseActor: (i) => { pauseActor = i; },
  quizMove, quizConfirm, quizErase, announceBraille,
  joinPlayer, respawnPlayer,
  clearWaitingBadge: (i) => hud.clearWaitingBadge(i),
  spriteBase: SPR,
});
// Desconectar NÃO abandona o jogo: o teclado é sempre fallback. Só solta a associação do pad.
addEventListener('gamepaddisconnected',(e)=>{ try{ const owner=players.findIndex(p=>p.pad===e.gamepad.index);
  if(owner>=0){ players[owner].pad=-1; srAlert('Controle do Jogador '+(owner+1)+' desconectado — o teclado continua funcionando. Aperte START para reassociar.'); }
  delete padCur[e.gamepad.index]; }catch(err){} });

/* ===== L1: wizard de mapeamento de gamepad (DirectInput e controles fora do padrão) =====
   Captura botões por índice; analógicos como limiar por eixo/sinal ({ax,s}); D-pad "POV hat" do
   DirectInput como VALOR de eixo ({av,v}, casamento por proximidade ±0.13 — os 8 passos do hat
   distam ~0.286). Mapa salvo por gamepad.id em localStorage → vale p/ aquele modelo de controle. */
// O assistente de mapeamento (padMapFor/bindActive/padWiz*/PADWIZ_STEPS + a fiacao do #padwiz-cancel)
// migrou inteiro para input/gamepad.ts (Onda A).

const optTelasBtn=$('#opt-telas'); // botão único: cicla 1→2→3→4 telas
if(optTelasBtn)optTelasBtn.addEventListener('click',()=>{ setNumPlayers((numPlayers%4)+1); srSay(numPlayers+(numPlayers>1?' telas.':' tela.')); });
// Botão único de LETRAS: ABC (padrão) → abc → Braille
const LETRA=[ // L3: Braille saiu do ciclo — o ditado passivo agora segue o Modo cego (a11y) e o nível 5 é o "escritor cego"
  {lbl:'🔠 ABC',     caso:'upper', blind:false, say:'Letras maiúsculas.'},
  {lbl:'🔡 abc',     caso:'lower', blind:false, say:'Letras minúsculas.'},
];
// L3: nível do quiz de alfabetização (1..5), persistido; rótulo vivo nos menus de pausa
function setQuizLevel(n,announce){ setQuizLevelValue(n); // core/state.js: clampa 1..5, persiste e emite; a reflexão de UI fica aqui
  document.querySelectorAll('.pm-nivel').forEach(x=>{ x.textContent='📚 Nível '+quizLevel+' · '+QL_NAME[quizLevel]; });
  if(announce) srSay('Nível '+quizLevel+': '+QL_NAME[quizLevel]+'.'); }
let letraIdx=0;
function applyLetra(announce){ const s=LETRA[letraIdx]; letterCase=s.caso; blindMode=s.blind;
  const b=$('#opt-letra'); if(b){ b.textContent=s.lbl; b.classList.toggle('is-on',letraIdx>0); b.setAttribute('aria-pressed',String(letraIdx>0)); }
  document.querySelectorAll('.pm-letra').forEach(x=>{ x.textContent=s.lbl; }); // ABC nos menus de pausa por tela
  if(typeof rebuildCoins==='function' && MODE==='silabas') rebuildCoins();
  players.forEach(p=>{ if(p.quiz)renderQuiz(p); }); // L3: re-renderiza o quiz de quem estiver num
  if(announce) srSay(s.say);
}
const optLetraBtn=$('#opt-letra'); if(optLetraBtn)optLetraBtn.addEventListener('click',()=>{ letraIdx=(letraIdx+1)%LETRA.length; applyLetra(true); });
applyLetra(false); // estado inicial = ABC (maiúsculas, padrão)
// E9: toggles de Som / Legendas / Fácil
const soundBtn=$('#opt-sound'), capBtn=$('#opt-captions');
if(soundBtn){ soundBtn.setAttribute('aria-haspopup','dialog'); soundBtn.addEventListener('click',openAudio); } // botão de áudio agora abre o mixer
if(capBtn) capBtn.addEventListener('click',()=>{ captionsOn=!captionsOn; toggleBtn(capBtn,captionsOn); srSay('Legendas '+(captionsOn?'ligadas.':'desligadas.')); });
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
  getSelVizPlayer: () => selVizPlayer, setSelVizPlayer: (i) => { selVizPlayer = i; },
  getSharedViz: () => _lastSharedViz, setSharedViz: (m) => { _lastSharedViz = m; },
  invalidateSharedViz: () => { _lastSharedViz = null; },
  setHcMode: (on) => { hcMode = on; },
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
function setModoCego(on){ if(modoCego===on)return; modoCego=on; store.setBool('incl_modocego',on); if(typeof setupExtras==='function')setupExtras(); if(typeof reflectModoCego==='function')audioPanel.reflectModoCego(); srSay('Modo cego '+(on?'ligado: bengala e pistas de áudio ativas. O 1º item de poder vira a bengala de corrida.':'desligado.')); }
// setPlayerViz/applyVizGlobal migraram para render/viz-setters.ts (Onda A).
const empathy = initSettingsEmpathy({ $, srSay, store, renderVizGroup, reflectMotorEmpathy, reflectVizButtons, frontOverlay, setHearingLoss, setOneButton, setWheelchair, getOneButton: () => oneButton, getWheelchair: () => wheelchair, setEmpathyOpen: (v) => { empathyOpen = v; } }); // painel de empatia: ui/settings-empathy.ts (registra #opt-empathy, #opt-hearing, #opt-onebtn, #opt-wheelchair + restaura o grafo de audio)
// updateVizIndicator/reapplyVizAll migraram para render/viz-setters.ts (Onda A).
// Modos que AJUDAM (A12e visual) vs SIMULAÇÕES de empatia (Modo empatia)
const isSimKind=k=>k==='filter'||k==='lowvision'||k==='blind';
const VIZ_SIM=VIZ_MODES.filter(m=>isSimKind(m.kind));
let selVizPlayer=0;
// renderVizGroup migrou para render/viz-setters.ts (Onda A).
function setOwnerColors(on){ ownerColors=!!on; store.setBool(store.KEYS.ownercolors,ownerColors);
  rebuildCoins(); srSay('Itens na cor do dono '+(on?'ligados.':'desligados: todos na cor original.')); }
function setCbSafe(on){ cbSafe=!!on; store.setBool(store.KEYS.cbsafe,cbSafe);
  const src=cbSafe?PCOLOR_CB:PCOLOR_DEF; PCOLOR.length=0; src.forEach(c=>PCOLOR.push(c)); // troca IN-PLACE (todos referenciam PCOLOR)
  rebuildCoins(); ensureSprites(); srSay('Paleta segura para daltonismo '+(on?'ligada (Okabe-Ito).':'desligada.')); }
function setRoleColor(k,hex){ const rgb=hexRgb(hex); if(!rgb||!HC_ROLE[k])return; HC_ROLE[k]=rgb; saveHcRole();
  _rebakeDirect(); rebuildExtras(); srSay('Cor de '+ROLE_LABELS[k]+' alterada.'); }
function resetRoleColors(){ for(const k in HC_ROLE_DEF)HC_ROLE[k]=HC_ROLE_DEF[k].slice(); saveHcRole();
  _rebakeDirect(); rebuildExtras(); visual.render(); srSay('Cores do color-blocking restauradas ao padrão.'); }
// Dois contornos configuráveis (1º plano personagem/itens · 2º plano perímetro de plataforma/água/lava).
// _rebakeDirect migrou para render/viz-setters.ts (Onda A) como viz.rebakeDirect.
function setOutlineFg(v){ hcOutlineFg=Math.max(0,Math.min(2,v|0)); store.set(store.KEYS.outfg,hcOutlineFg); _rebakeDirect(); visual.render(); srSay('Contorno do primeiro plano: '+['nenhum','fino','grosso'][hcOutlineFg]+'.'); }
function setOutlineBg(v){ hcOutlineBg=Math.max(0,Math.min(2,v|0)); store.set(store.KEYS.outbg,hcOutlineBg); _rebakeDirect(); visual.render(); srSay('Contorno do segundo plano: '+['nenhum','fino','grosso'][hcOutlineBg]+'.'); }
const visual = initSettingsVisual({ $, srSay, getVisualSettings: () => ({ lq: getLqT(), ownerColors, cbSafe, outlineFg: hcOutlineFg, outlineBg: hcOutlineBg, roleColors: HC_ROLE }), getSelectedPlayer: () => selVizPlayer, setSelectedPlayer: (i) => { selVizPlayer = i; }, setPlayerViz, setLq, setOwnerColors, setCbSafe, setOutlineFg, setOutlineBg, setRoleColor, resetRoleColors }); // painel visual: ui/settings-visual.ts
function reflectVizButtons(){ const help=players.some(p=>{const m=VIZ_BY_KEY[p.viz];return m&&m.kind==='hcnew';});
  const sim=players.some(p=>isSimKind((VIZ_BY_KEY[p.viz]||{}).kind));
  const bv=$('#opt-visual'); if(bv)bv.classList.toggle('is-on',help); const be=$('#opt-empathy'); if(be)be.classList.toggle('is-on',sim||hearingLoss||oneButton||wheelchair); }
// "tela = canvas": reparenta os diálogos de a11y para dentro do #game-region (ficam presos ao canvas)
// e empilha o último aberto por cima (z crescente). frontOverlay é chamado em cada open*.
// _ovZ/fillExplain/frontOverlay migraram para ui/settings-panel.ts (B4).
(function inCanvasMenus(){ const gr=document.getElementById('game-region'); if(!gr)return;
  ['audio','movement','options','animation','visual','empathy','touchcfg','help','padwiz','typo','title-overlay'].forEach(id=>{ const el=document.getElementById(id); if(el)gr.appendChild(el); }); // NENHUMA tela fora do canvas (decisão definitiva do José — splash incluso)
  // Botões puramente on/off viram TOGGLE (switch) — o texto "Ligado/Desligado" fica oculto (font-size:0).
  ['opt-facil','opt-altmove','opt-hearing','opt-onebtn','opt-wheelchair','opt-modocego','opt-tts','opt-eyes','audio-master','opt-captions','motion-master'].forEach(id=>{ const b=document.getElementById(id); if(b)b.classList.add('switch'); });
})();
function openVisual(){ const ov=$('#visual'); if(!ov)return; visual.render(); ov.hidden=false; frontOverlay(ov); visualOpen=true; const f=ov.querySelector('button[data-viz]')||ov.querySelector('button'); if(f)f.focus(); }
function closeVisual(){ const ov=$('#visual'); if(!ov)return; ov.hidden=true; visualOpen=false; const b=$('#opt-visual'); if(b)b.focus(); }
const visualBtn=$('#opt-visual'); if(visualBtn)visualBtn.addEventListener('click',openVisual);
const visualClose=$('#visual-close'); if(visualClose)visualClose.addEventListener('click',closeVisual);
// Empatia motora: um-botão e cadeirante
function reflectMotorEmpathy(){ const a=$('#opt-onebtn'); if(a){ a.classList.toggle('is-on',oneButton); a.setAttribute('aria-pressed',String(oneButton)); a.textContent=oneButton?'❚❚ Ligado':'▶ Desligado'; }
  const b=$('#opt-wheelchair'); if(b){ b.classList.toggle('is-on',wheelchair); b.setAttribute('aria-pressed',String(wheelchair)); b.textContent=wheelchair?'❚❚ Ligado':'▶ Desligado'; } reflectVizButtons(); }
function setOneButton(on){ oneButton=on; store.setBool('incl_onebtn',on); reflectMotorEmpathy(); srSay('Um botão por vez '+(on?'ligado: só uma tecla/botão de cada vez.':'desligado.')); }
function setWheelchair(on){ wheelchair=on; store.setBool('incl_wheelchair',on);
  players.forEach(p=>{ if(on && p.activePower!=='fly' && p.activePower!=='turbo') p.activePower='off'; if(on) p.owned=p.owned.filter(k=>k==='fly'||k==='turbo'); showPower(p); });
  setupExtras(); rebuildCoins(); buildWcGeom(); buildRamps(); buildElevators(); reflectMotorEmpathy(); // só voo/super-corrida; moedas no chão; escada/trampolim viram elevador; rampas+pontes; lava vira chão
  srSay('Modo cadeirante '+(on?'ligado: sem pulo; rampas e elevadores no lugar de degraus e escada; moedas no chão; só voo e super-corrida.':'desligado.')); }
// bolinha indicadora: duplo toque/clique → volta às cores normais (em cegueira é a única saída visível)
(function vizIndicator(){ const el=$('#viz-indicator'); if(!el)return; let last=-9999;
  el.addEventListener('pointerdown',(e)=>{ e.preventDefault(); const t=e.timeStamp||0; if(t-last<450){ setPlayerViz(0,'normal'); last=-9999; srSay('Cores normais reativadas.'); } else last=t; }); })();
loadPlayerA11y(players[0],0); // carrega viz/easy/alternância persistidos do jogador 1 (migra chaves antigas)
vizReady=true; applyVizGlobal(players[0].viz); // estado inicial (solo)

/* TIPOGRAFIA — menu próprio na pausa (saiu da Sensibilidade visual, pedido do José 2026-07-02).
   3 grupos, UMA fonte ativa (radio), pré-visualização com o pangrama "Juiz foge e bota fita de cetim
   na xícara". Todas as fontes hospedadas são SIL OFL 1.1 (política do fonts.css); as canônicas EdSP
   mantêm o mecanismo antigo (Lexend preserva o espaçamento BDA via data-fonte="dislexia"). */
// Tipografia: catalogo em ui/fonts.js, painel em ui/settings-typo.js. Antes: FONT_GROUPS/loadFontKey extraídos p/ ui/fonts.js (Fase 2, tipografia).
const typo = initSettingsTypo({ $, srSay, store, root: document.documentElement }); // painel de tipografia: ui/settings-typo.ts (aplica a fonte persistida no init)
let typoOpen=false;
function openTypo(){ const ov=$('#typo'); if(!ov)return; typo.render(); ov.hidden=false; frontOverlay(ov); typoOpen=true;
  const f=ov.querySelector('button[data-font]:not([disabled])')||ov.querySelector('button'); if(f)f.focus(); }
function closeTypo(){ const ov=$('#typo'); if(!ov)return; ov.hidden=true; typoOpen=false; menuFocus(sharedDialogOpen()); }
{ const b=$('#typo-close'); if(b)b.addEventListener('click',closeTypo); }

/* F1: menu de áudio (mixer por categoria) — o botão "Som" abre este menu */
function openAudio(){ const ov=$('#audio'); if(!ov)return; ensureAC(); audioPanel.renderAudio(); audioPanel.reflectModoCego(); audioPanel.reflectTts(); const cd=$('#cane-div'); if(cd)cd.value=String(caneBlockDiv); ov.hidden=false; frontOverlay(ov); audioOpen=true; const f=ov.querySelector('button'); if(f)f.focus(); }
function closeAudio(){ const ov=$('#audio'); if(!ov)return; ov.hidden=true; audioOpen=false; const b=$('#opt-sound'); if(b)b.focus(); }
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
const touchCtl = initTouch({ $, srSay, store, root: document.documentElement, isMobile,
  viewport: () => ({ w: window.innerWidth, h: window.innerHeight }),
  frontOverlay, onPadDesignApplied: () => { if(typeof renderPauseLegend==='function') renderPauseLegend(); } });
// (o proprio initTouch ja aplica o desenho salvo no fim da sua inicializacao)
addEventListener('gamepadconnected', (e)=>{ try{ const d=touchCtl.applyPadDesign(padLayoutFromId(e.gamepad.id)); const sel=$('#pad-design'); if(sel)sel.value=d; srSay('Controle conectado: layout '+d+'.'); }catch(err){} }); // A2: layout pelo id do controle
const padDesignSel=$('#pad-design'); if(padDesignSel){ padDesignSel.value=touchCtl.getPadDesign(); padDesignSel.addEventListener('change',()=>{ touchCtl.applyPadDesign(padDesignSel.value); srSay('Desenho dos botões: '+padDesignSel.value+'.'); }); } // A4: escolha manual
// JOGAR COM OS OLHOS: eyeMode/eyeSet/onGaze/startEyeControl/stopEyeControl/loadWebGazer → ui/webcam.js (Estágio 4, Tier 1).
const eyesBtn=$('#opt-eyes'); if(eyesBtn)eyesBtn.addEventListener('click',()=>{ setEyeMode(!eyeMode); toggleBtn(eyesBtn,eyeMode); eyesBtn.textContent=eyeMode?'❚❚ Ligado':'▶ Desligado';
  if(eyeMode){ loadWebGazer(startEyeControl); srSay('Jogar com os olhos: carregando a webcam (permita o acesso).'); } else { stopEyeControl(); srSay('Jogar com os olhos desligado.'); } });
const audioCloseBtn=$('#audio-close'); if(audioCloseBtn)audioCloseBtn.addEventListener('click',closeAudio);
const audioPanel = initSettingsAudio({ $, srSay, store, audioCats: AUDIO_CATS, toggleBtn, getNumPlayers: () => numPlayers, getPlayers: () => players, getSoundOn: () => soundOn, setSoundOn, getVolume: () => volume, setVolume, getAudioCat: () => audioCat, setCatGain, tts, getModoCego: () => modoCego, setModoCego, getCaneBlockDiv: () => caneBlockDiv, setCaneBlockDiv: (d) => { caneBlockDiv = d; } }); // painel de audio: ui/settings-audio.ts

/* E10: remap de controles + persistência (B2) */
const ctrlPanel = initSettingsControls({ $, srSay, srAlert, store: { saveKB, resetKB }, kb: KB, setKB: (k) => { KB = k; }, kbFor, getNumPlayers: () => numPlayers, applyControls, assignControls }); // painel de controles: ui/settings-controls.ts (registra #ctrl-reset e os botoes de remap)
function openOptions(){ const ov=$('#options'); if(!ov)return; ctrlPanel.render(pauseActor); ov.hidden=false; frontOverlay(ov); optionsOpen=true; const f=ov.querySelector('button'); if(f)f.focus(); } // E3: edita o controle do jogador que abriu
function closeOptions(){ const ov=$('#options'); if(!ov)return; ov.hidden=true; optionsOpen=false; ctrlPanel.cancelCapture(); const b=$('#opt-controls'); if(b)b.focus(); }
const ctrlBtn=$('#opt-controls'); if(ctrlBtn)ctrlBtn.addEventListener('click',openOptions);
// AJUDA (do menu de pausa): controles DO jogador que abriu (pauseActor) + notas desta build.
function openHelp(){ const ov=$('#help'); if(!ov)return; const c=$('#help-content'); const pa=pauseActor||0; const map=kbFor(pa);
  const rows=Object.keys(ACT_LABEL).map(a=>`<div class="ctrl-row"><span>${ACT_LABEL[a]}</span><span>${(map[a]||[]).map(keyName).map(k=>'<kbd>'+k+'</kbd>').join(' ')||'—'}</span></div>`).join('');
  if(c)c.innerHTML=`<h3 class="panel-sub">Seus controles${numPlayers>1?' · Jogador '+(pa+1):''} <span class="panel-sub__tag">teclado</span></h3><div class="ctrl-list">${rows}</div>`+
    `<h3 class="panel-sub">Notas desta build</h3><div class="ctrl-list">`+
    `<div class="ctrl-row"><span>Power-ups: 👟 super-corrida · 🕷️ escalada · 🎈 voo · 🐇 super-pulo · 🦘 ultra-pulo · 🔑 chave abre o 🚪 portão.</span></div>`+
    `<div class="ctrl-row"><span>2–4 jogadores: telas lado a lado, cada uma com seu menu e sua configuração.</span></div>`+
    `<div class="ctrl-row"><span>v${INCL_VERSION} — PixiJS (WebGL, fallback Canvas) · texto/UI no DOM (acessibilidade) · offline via PWA.</span></div></div>`;
  ov.hidden=false; frontOverlay(ov); const f=ov.querySelector('button'); if(f)f.focus(); }
function closeHelp(){ const ov=$('#help'); if(!ov)return; ov.hidden=true; menuFocus(sharedDialogOpen()); }
const helpCloseBtn=$('#help-close'); if(helpCloseBtn)helpCloseBtn.addEventListener('click',closeHelp);
const ctrlClose=$('#ctrl-close'); if(ctrlClose)ctrlClose.addEventListener('click',closeOptions);

/* Movimento reduzido (WCAG 2.3.3) + Pause/Stop/Hide (2.2.2) */
const RM_LABEL={parallax:'Parallax do fundo', decor:'Decoração (nuvens, grama)', items:'Animação de itens (moedas)', walk:'Personagem em movimento (andar, escalar, nadar, pular)', breath:'Respiração (parado)', flavor:'Gracinhas (animações de descanso)', particles:'Partículas e cintilação'};
const RM_SOON=new Set([]); // todos os alvos agem: parallax (fundo), decor (chuva/vida da Cidade), items (cintilar), particles (juice)
const motion = initSettingsMotion({ $, srSay, store, frontOverlay, toggleBtn, rm, saveRM, rmKeys: RM_KEYS, rmChar: RM_CHAR }); // painel de movimento/CRT: ui/settings-motion.ts
// MENU Movimento (GAG: alternância) — separado do menu Animação (WCAG: movimento reduzido)
function openMovement(){ const ov=$('#movement'); if(!ov)return; motor.renderMovPlayers(); motor.reflectFacil(); motor.reflectAltMove(); renderMapHub(); ov.hidden=false; frontOverlay(ov); movementOpen=true; const f=ov.querySelector('button'); if(f)f.focus(); }
function closeMovement(){ const ov=$('#movement'); if(!ov)return; ov.hidden=true; movementOpen=false; const b=$('#opt-movement'); if(b)b.focus(); }
// Submenu "Configurar botões de tela touch"
// openTouchCfg/closeTouchCfg migraram para input/touch.ts (Onda A).
const touchCfgBtn=$('#opt-touchcfg'); if(touchCfgBtn)touchCfgBtn.addEventListener('click',()=>touchCtl.openTouchCfg());
const touchCfgClose=$('#touchcfg-close'); if(touchCfgClose)touchCfgClose.addEventListener('click',()=>touchCtl.closeTouchCfg());
// HUB de mapeamento (por jogador): teclado funciona (abre o remap); gamepad/olhos/setores/fala = em construção.
function mapSoon(nome){ srAlert(nome+': em construção — chega junto com os subsistemas de webcam e fala.'); }
function renderMapHub(){ const el=$('#map-hub'); if(!el)return; const np=numPlayers;
  const items=[
    {lbl:'⌨ Mapear teclado para modo 1 jogador', mode:1, act:openOptions},
    {lbl:'⌨ Mapear teclado para modo 2 jogadores', mode:2, act:openOptions},
    {lbl:'⌨ Mapear teclado para modo 3 jogadores', mode:3, act:openOptions},
    {lbl:'⌨ Mapear teclado para modo 4 jogadores', mode:4, act:openOptions},
    {lbl:'🎮 Mapear gamepad', act:()=>gamepadApi.openPadWiz()}, // L1: wizard (DirectInput e afins) — mapa salvo por modelo de controle
    {lbl:'👁 Mapear olhos e boca', soon:true},
    {lbl:'🎯 Mapear setores de olhar', soon:true},
    {lbl:'🎤 Mapear palavras (fala)', soon:true},
  ];
  el.innerHTML='<h3 class="panel-sub">Mapear controles <span class="panel-sub__tag">por jogador</span></h3>'+
    items.map((it,i)=>{ const off=it.mode&&it.mode!==np, dis=it.soon||off; // teclado: só habilita no modo com esse nº de telas (o resto fica cinza)
      const note=it.soon?' <em style="opacity:.7">(em construção)</em>':'';
      return `<div class="ctrl-row${dis?' row-off':''}"><span>${it.lbl}${note}</span><button class="mode-btn" type="button" data-map="${i}"${dis?' disabled':''}>${it.soon?'Em breve':'Abrir'}</button></div>`; }).join('');
  el.querySelectorAll('button[data-map]').forEach(b=>b.addEventListener('click',()=>{ const it=items[+b.dataset.map]; if(it.soon){ mapSoon(it.lbl.replace(/^\S+\s/,'')); return; } if(it.mode&&it.mode!==np){ srAlert('Disponível só no modo '+it.mode+' jogador'+(it.mode>1?'es':'')+'. Troque o nº de telas na barra do topo.'); return; } it.act(); }));
}
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
window.__incl={app,get player(){return players[0];},players,get numPlayers(){return numPlayers;},setNumPlayers,activateScreens,fitsN,isMobile,pollPads:()=>gamepadApi.pollPads(),update,openPadWiz:()=>gamepadApi.openPadWiz(),padWizTick:()=>gamepadApi.padWizTick(),padMapFor:(id)=>gamepadApi.padMapFor(id),get padWiz(){return gamepadApi.getPadWiz();},get phase(){return phase;},get padPrev(){return padPrevAct;},get coins(){return coins;},get collected(){return players[0].collected;},get powerups(){return powerups;},get gateOpen(){return gateOpen;},get gate(){return gate;},get ended(){return ended;},restartGame,get hcMode(){return hcMode;},setHC(v){setPlayerViz(0,v?'hc-direto':'normal');},get vizMode(){return players[0].viz;},applyViz(v){setPlayerViz(0,v);},setPlayerViz,VIZ_MODES,get footCount(){return _footCount;},get sonarCount(){return nav.sonarCount;},get guideCount(){return nav.guideCount;},get narrateCount(){return tts.narrateCount;},sonar:()=>nav.sonar(players[0]),setHearingLoss,darkRegions,decoLayer,get minimap(){return getMinimap();},parallaxLayers,PARALLAX,setCenario,get cenario(){return CENARIO;},
  get mmSeen(){return minimapSeenCount();},get MODE(){return MODE;},get letterCase(){return letterCase;},get blindMode(){return blindMode;},brailleText,tileAt,WORLD_W,WORLD_H,TUNE,
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
  get grassDensity(){return grassDensity;},setGrassDensity(v){grassDensity=Math.max(0,Math.min(1,+v||0));}, // 1=todas as superfícies; 0.6=60% (estações)
  get decorCounts(){ const n=g=>g.geometry&&g.geometry.graphicsData?g.geometry.graphicsData.length:0; return {stars:n(starsG),skyDeco:n(skyDecoG),fog:n(fogG),grass:n(grassG),front:n(themeFxG)}; }};
{ const v='v'+INCL_VERSION; document.title=`The Inclusionist · ${v} (PixiJS)`; // versão: fonte única = INCL_VERSION
  const e1=document.querySelector('h1 .ver'); if(e1)e1.textContent='· '+v;
  const e2=document.getElementById('title-ver'); if(e2)e2.textContent=v; }
srSay('Jogo carregado. Colete 10 moedas. Suba escadas com W/S, nade segurando pulo na água.');

/* dicas de início: somem ao pular ou após 8s */
function hideTips(){} // dicas de início REMOVIDAS (José 2026-07-04); stub mantém os call-sites

/* ===== Layout: jogo em múltiplos inteiros de 320x180, centralizado; VLibras = 5:9 ao lado =====
   Usa o BOTÃO NATIVO do VLibras (reposicionado à direita do jogo). Detecta abertura/fechamento
   por polling e, ao abrir, reserva o slot 5:9 (jogo desloca à esquerda, conjunto 21:9 centraliza)
   e encaixa+escala o painel no slot. */
// layout() extraído p/ ui/layout.js (Estágio 4, Tier 1) — fecha o cluster: importa librasOpen/LIBRAS_RESERVE de ui/vlibras.
addEventListener('resize', layout);
setOnLibrasChange(layout); // ui/vlibras: reflui o layout ao abrir/fechar o intérprete (callback injetado)
setInterval(vlTick, 250);
layout(); requestAnimationFrame(layout); setTimeout(layout, 1500);
window.__incl.layout=layout; window.__incl.get_librasOpen=()=>librasOpen;

/* ===================== E14: shell — título/splash + pausa ===================== */
function setPhase(p){
  setPhaseValue(p); // core/state.js: só o valor + evento; a reação de UI abaixo fica aqui
  if(p!=='playing')hideTouchControls(); // menu ativo (título/pausa) = sem controle virtual
  // GAG: na pausa, silencia TODO o som do jogo (loops de ambiente/chuva inclusive) — o áudio volta ao retomar.
  setMasterMuted(p!=='playing'); // nó mestre em platform/audio.js: silencia na pausa/título
  const t=$('#title-overlay'), pa=$('#pause-overlay');
  if(t)t.hidden = p!=='title';
  if(pa)pa.hidden = true; // pausa GLOBAL aposentada (Etapa 2): agora é uma por tela (vpPause)
  vpPause.forEach(sp=>{ sp.hidden = p!=='paused'; });
  const tc=$('#touch-controls'); // controles de toque somem na pausa (o menu por tela é clicável direto) e voltam ao retomar
  if(tc){ if(p==='paused'){ if(!tc.hidden){ tc.dataset.wasOn='1'; tc.hidden=true; } }
    else if(p==='playing'){ if(tc.dataset.wasOn==='1' && numPlayers<=1)tc.hidden=false; delete tc.dataset.wasOn; }
    else { tc.hidden=true; delete tc.dataset.wasOn; } }
  const pb=$('#btn-pause'); if(pb)pb.setAttribute('aria-pressed',String(p==='paused'));
  if(p==='playing'){ const gr=$('#game-region'); if(gr)gr.focus(); }
  else if(p==='paused'){ if(typeof pauseSelect==='function')pauseSelect(); if(typeof reflectPauseIcons==='function')reflectPauseIcons(); }
  else if(p==='title'){ updateTitleLegend(); const b=$('#tm-main button'); if(b)b.focus(); }
}
// NAVEGAÇÃO UNIVERSAL de menus: qualquer menu aberto (pausa OU submenu) é navegável por up/down/left/right/
// sim/não — as MESMAS ações valem para teclado, controle, olhos e fala. sim = confirma/alterna/entra;
// não = volta ao menu anterior (na raiz, volta ao jogo = Continuar). left/right ajustam select/slider.
// A ORDEM aqui E a cadeia de Escape (verbatim do encadeamento anterior). touchcfg e help entram sem
// flag: ficam fora da cadeia, exatamente como estavam.
overlays.register('options',  { close:()=>closeOptions(),  isOpen:()=>optionsOpen });
overlays.register('movement', { close:()=>closeMovement(), isOpen:()=>movementOpen });
overlays.register('animation',{ close:()=>motion.close(),  isOpen:()=>motionOpen });
overlays.register('visual',   { close:()=>closeVisual(),   isOpen:()=>visualOpen });
overlays.register('empathy',  { close:()=>empathy.close(), isOpen:()=>empathyOpen });
overlays.register('audio',    { close:()=>closeAudio(),    isOpen:()=>audioOpen });
overlays.register('typo',     { close:()=>closeTypo(),     isOpen:()=>typoOpen });
overlays.register('touchcfg', { close:()=>touchCtl.closeTouchCfg() });
overlays.register('help',     { close:()=>closeHelp() });
// Ações do menu de pausa (compartilhadas pelos menus por tela). Ao abrir um submenu de a11y, escopa ao
// jogador que agiu (pauseActor) — o diálogo abre na aba dele (Etapa 3 remove as abas).
const pauseActs={ resume:()=>setPhase('playing'),
  letra:()=>{ letraIdx=(letraIdx+1)%LETRA.length; applyLetra(true); },
  nivel:()=>setQuizLevel(quizLevel%5+1,true), // L3: cicla 1..5
  tipo:()=>openTypo(),
  addplayer:()=>{ // R-splash 2: só AUMENTA (nunca diminui); a tela nova ESPERA um botão do jogador entrar
    if(numPlayers>=4){ srAlert('Máximo de 4 jogadores.'); return; }
    if(!fitsN(numPlayers+1)){ srAlert('Não cabe outra tela nesta janela — aumente a janela ou use tela cheia.'); return; }
    if(joinPlayer(null)){ const p=players[numPlayers-1]; p.waiting=true;
      hud.showWaitingBadge(p.i);
      setPhase('playing'); srAlert('Jogador '+(p.i+1)+': aperte um botão para entrar.'); } },
  audio:()=>openAudio(),
  motora:()=>{ motor.setSelPlayer(pauseActor); openMovement(); },
  anim:()=>{ setSelectedMotionPlayer(pauseActor); motion.open(); },
  visual:()=>{ selVizPlayer=pauseActor; openVisual(); },
  empatia:()=>{ selVizPlayer=pauseActor; empathy.open(); }, print:()=>printMode(), quit:()=>quitGame(), ajuda:()=>openHelp() };
// Roteamento de input por jogador: cada tecla é do jogador dono dela (kbFor). Genéricas → jogador 0.
const actionOf = (code,pi) => kbRuntime.actionOf(code,pi);
const whichPlayer = (code) => kbRuntime.whichPlayer(code);
function sharedDialogOpen(){ const ov=[...document.querySelectorAll('#game-region .overlay')].filter(o=>!o.hidden); if(!ov.length)return null; ov.sort((a,b)=>(+getComputedStyle(a).zIndex||0)-(+getComputedStyle(b).zIndex||0)); return ov[ov.length-1]; }
function menuItems(menu){ const card=menu.querySelector('.overlay__card, .pause-card')||menu; return [...card.querySelectorAll('button:not([disabled]), select:not([disabled]), input[type=range]:not([disabled])')].filter(el=>el.offsetParent!==null); }
function menuFocus(menu){ if(!menu)return; const it=menuItems(menu); if(it.length){ const cur=it.indexOf(document.activeElement); (cur>=0?it[cur]:it[0]).focus(); } }
function dialogBack(menu){ if(!overlays.closeById(menu.id))menu.hidden=true; menuFocus(sharedDialogOpen()); }
function navDialog(menu,k){ const items=menuItems(menu); if(!items.length)return; let idx=items.indexOf(document.activeElement); if(idx<0){ idx=0; items[0].focus(); } const cur=items[idx];
  if(k.no){ dialogBack(menu); return; }
  if(k.left||k.right){ const d=k.right?1:-1;
    if(cur.tagName==='SELECT'){ cur.selectedIndex=Math.max(0,Math.min(cur.options.length-1,cur.selectedIndex+d)); cur.dispatchEvent(new Event('change',{bubbles:true})); return; }
    if(cur.tagName==='INPUT'){ const st=+cur.step||1; cur.value=Math.max(+cur.min,Math.min(+cur.max,(+cur.value)+d*st)); cur.dispatchEvent(new Event('input',{bubbles:true})); return; }
    idx=Math.max(0,Math.min(items.length-1,idx+d)); items[idx].focus(); return; }
  if(k.up||k.down){ idx=Math.max(0,Math.min(items.length-1,idx+(k.down?1:-1))); items[idx].focus(); return; }
  if(k.yes){ if(cur.tagName==='SELECT'){ cur.selectedIndex=(cur.selectedIndex+1)%cur.options.length; cur.dispatchEvent(new Event('change',{bubbles:true})); return; } if(cur.tagName==='INPUT')return; cur.click(); return; } }
function pauseSetSel(menu,el){ if(!el)return; menu.querySelectorAll('.pm-sel,.pi-sel').forEach(b=>b.classList.remove('pm-sel','pi-sel')); el.classList.add(el.classList.contains('pi-btn')?'pi-sel':'pm-sel');
  const cap=menu.querySelector('.pause-icons-cap'); if(cap){ if(el.classList.contains('pi-btn')){ cap.textContent=el.getAttribute('aria-label')||''; } else cap.textContent=''; } }
function navPause(menu,pi,k){ const icons=[...menu.querySelectorAll('.pi-btn')], items=[...menu.querySelectorAll('.pm-btn')];
  if(k.no){ setPhase('playing'); return; } // "não" na raiz → volta ao jogo (retoma todos)
  let cur=menu.querySelector('.pi-sel')||menu.querySelector('.pm-sel'); if(!cur)cur=items[0];
  if(k.yes){ pauseActor=pi; if(cur)cur.click(); return; }
  const cols=2;
  if(cur.classList.contains('pi-btn')){ // zona dos ícones (linha horizontal)
    let idx=icons.indexOf(cur); if(idx<0)idx=0;
    if(k.left)idx=Math.max(0,idx-1); else if(k.right)idx=Math.min(icons.length-1,idx+1);
    else if(k.down){ pauseSetSel(menu, items[0]); return; } // desce da barra → menu (Continuar)
    pauseSetSel(menu, icons[idx]); return; // "cima" na barra: fica
  }
  let idx=items.indexOf(cur); if(idx<0)idx=0;
  if(k.up){ if(idx<cols && icons.length){ pauseSetSel(menu, icons[Math.min(idx,icons.length-1)]); return; } idx=Math.max(0,idx-cols); } // sobe da 1ª linha → barra de ícones
  else if(k.down)idx=Math.min(items.length-1,idx+cols);
  else if(k.left)idx=Math.max(0,idx-1); else if(k.right)idx=Math.min(items.length-1,idx+1);
  pauseSetSel(menu, items[idx]); }
function menuNavKey(e){ if(phase!=='paused'||ctrlPanel.isCapturing())return;
  const pw=$('#padwiz'); if(pw&&!pw.hidden){ if(e.code==='Escape'){ gamepadApi.closePadWiz(false); e.preventDefault(); e.stopPropagation(); } return; } // wizard por cima: só Esc (cancela)
  const C=e.code;
  const owner=whichPlayer(C); const pi=owner<0?0:owner; const act=owner>=0?actionOf(C,pi):null;
  const yes=C==='Space'||C==='KeyJ'||C==='Enter'||C==='NumpadEnter'||act==='jump';
  const no=C==='Escape'||act==='especial';
  const up=C==='ArrowUp'||C==='KeyW'||act==='up', down=C==='ArrowDown'||C==='KeyS'||act==='down';
  const left=C==='ArrowLeft'||C==='KeyA'||act==='left', right=C==='ArrowRight'||C==='KeyD'||act==='right';
  if(!(yes||no||up||down||left||right))return; e.preventDefault(); e.stopPropagation();
  const k={yes,no,up,down,left,right};
  const dlg=sharedDialogOpen(); if(dlg){ navDialog(dlg,k); return; } // diálogo de a11y aberto: navega ele (compartilhado nesta etapa)
  const menu=vpPause[pi]; if(menu&&!menu.hidden)navPause(menu,pi,k); } // senão: menu de pausa do próprio jogador
addEventListener('keydown', menuNavKey, true);
function pauseSelect(){ vpPause.forEach(sp=>{ const items=[...sp.querySelectorAll('.pm-btn')]; items.forEach(b=>b.classList.remove('pm-sel')); if(items[0])items[0].classList.add('pm-sel'); }); } // 1º item (Continuar) selecionado em cada tela
function printMode(){ vpPause.forEach(sp=>sp.hidden=true); // Print: esconde as pausas → vê a tela limpa; qualquer botão volta
  const back=(e)=>{ if(e&&e.preventDefault)try{e.preventDefault();}catch(_){} window.removeEventListener('keydown',back,true); window.removeEventListener('pointerdown',back,true);
    if(phase==='paused'){ vpPause.forEach(sp=>sp.hidden=false); pauseSelect(); } };
  setTimeout(()=>{ window.addEventListener('keydown',back,true); window.addEventListener('pointerdown',back,true); }, 80);
  srSay('Modo Print: veja a tela sem menus. Aperte qualquer botão para voltar.'); }
function releaseKey(pl){ // portador saiu do jogo → a chave volta para a posição inicial (fica disponível de novo)
  if(!pl||!pl.hasKey)return; pl.hasKey=false;
  const key=powerups.find(p=>p.kind==='key'); if(key){ key.taken=false; key.by=[]; if(key.sprite)key.sprite.visible=true; srAlert('A chave voltou para o lugar de origem.'); } }
function quitGame(){ // Sair: single → volta ao MENU INICIAL; MP → tela do jogador fica preta; TODOS saindo → menu inicial
  if(numPlayers<=1){ restartGame(); setPhase('title'); titleUI.show('tm-main'); srSay('Jogo abandonado. Escolha a próxima atividade.'); }
  else { const q=pauseActor||0; releaseKey(players[q]); players[q].quit=true;
    if(players.every(p=>p.quit)){ players.forEach(p=>{p.quit=false;}); restartGame(); setPhase('title'); titleUI.show('tm-main'); // trocar de jogo = todo mundo sai
      srSay('Todos saíram. Escolham a próxima atividade.'); return; }
    setPhase('playing'); srSay('Jogador '+(q+1)+' abandonou o jogo.'); } }
function togglePause(){ if(phase==='playing')setPhase('paused'); else if(phase==='paused')setPhase('playing'); }
/* ===== Menu inicial (v3): principal → submenus de atividade → (tabuada/divisão) seletor de números ===== */
// _tabFor/titleButtons/navTitle/buildTitleMenus migraram para ui/activities-menu.ts (Onda A).
// padKind/updateTitleLegend + os dois ouvintes de gamepad NAO sao do menu: sao a legenda por
// dispositivo do splash (slice do gamepad). Estavam no meio do intervalo removido e voltaram.
function padKind(){ let kind='kb'; const pads=navigator.getGamepads?navigator.getGamepads():[];
  for(const gp of pads){ if(!gp)continue; kind=(gp.mapping==='standard')?'x':'d'; if(kind==='x')break; }
  return kind; }
function updateTitleLegend(){ const el=$('#title-legend'); if(!el)return; // 2 LINHAS, com o que está CONFIGURADO p/ o jogador da tela
  const chip=(txt,col,word)=>`<span class="lg"><span class="lg-ico"${col?` style="background:${col}"`:''}>${txt}</span>${word?' '+word:''}</span>`;
  const touch=document.body.classList.contains('touch-mode');
  let gp=null; const pads=navigator.getGamepads?navigator.getGamepads():[];
  const p1pad=(players[0]&&players[0].pad>=0)?players[0].pad:-1;
  for(const g of pads){ if(!g)continue; if(p1pad>=0){ if(g.index===p1pad){gp=g;break;} } else if(!gp)gp=g; }
  let l1,l2;
  if(touch){ const set=PAD_DESIGNS.generic; // joystick VIRTUAL: 0/1/2/3 + START
    l1=chip('✜',null,'movimentar-se')+chip('START',null,'pausa');
    l2=chip(set['0'][0],set['0'][1],'pular')+chip(set['1'][0],set['1'][1],'especial')+chip(set['2'][0],set['2'][1],'correr')+chip(set['3'][0],set['3'][1],'trocar');
  } else if(gp){ // joystick FÍSICO: layout do modelo (XInput colorido / DirectInput números) + mapa custom do wizard
    const layout=gp.mapping==='standard'?padLayoutFromId(gp.id):'generic';
    const set=PAD_DESIGNS[layout]||PAD_DESIGNS.generic;
    const custom=gp.mapping!=='standard'?gamepadApi.padMapFor(gp.id):null;
    const bOf=(k,def)=>{ const b=custom&&custom[k]; return (b&&typeof b.b==='number')?String(b.b):def; };
    const gy=k=>set[k]||[k,'#3a4a6a'];
    const J=gy(bOf('jump','0')),E=gy(bOf('especial','1')),R=gy(bOf('run','2')),S=gy(bOf('swap','3'));
    l1=chip('✜',null,'movimentar-se')+chip('START',null,'pausa');
    l2=chip(J[0],J[1],'pular')+chip(E[0],E[1],'especial')+chip(R[0],R[1],'correr')+chip(S[0],S[1],'trocar');
  } else { const m=kbFor(0), K=a=>keyName((m[a]||[])[0]||'?'); // TECLADO: teclas configuradas (remap respeitado)
    l1=chip(`${K('up')} ${K('left')} ${K('down')} ${K('right')}`,null,'movimentar-se')+chip('Enter',null,'pausa');
    l2=chip(K('jump'),null,'pular')+chip(K('especial'),null,'especial')+chip(K('run'),null,'correr')+chip(K('swap'),null,'trocar'); }
  el.innerHTML=`<span class="lg-row">${l1}</span><span class="lg-row">${l2}</span>`;
  const w=$('#title-wait'); if(w)w.hidden=numPlayers<=1; } // MP: aviso "Aguarde o Jogador 1"
addEventListener('gamepadconnected',()=>{ if(phase==='title')updateTitleLegend(); });
addEventListener('gamepaddisconnected',()=>{ if(phase==='title')updateTitleLegend(); });
// O despachante do menu do titulo (teclado do #np-btn, rodape de descricao e o click) migrou para
// ui/activities-menu.ts, que liga os proprios ouvintes no #title-overlay. Sobrou aqui a barra de
// icones de a11y do splash, que e do slice de pausa.
(function titleIconsSetup(){ const ov=$('#title-overlay'); if(!ov)return;
  // Icones de a11y da pausa TAMBEM no topo do splash (mesmas acoes, escopo do Jogador 1)
  const ti=$('#title-icons'); if(ti){ ti.innerHTML=iconsMarkup(); // fonte unica do markup (antes copiado aqui e no modulo)
    ti.addEventListener('click',(e)=>{ const ib=e.target.closest('.pi-btn'); if(!ib)return; pauseActor=0; pauseIcons.iconAct(ib.dataset.pi,0);
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
(function touchSetup(){
  const tc=$('#touch-controls'); if(!tc)return;
  // alternancia por modalidade: toque/clique MOSTRA; teclado/controle OCULTA (hideTouchControls).
  if(/[?&]touch=1/.test(location.search)){ showTouchControls(); }
  addEventListener('pointerdown',()=>{ if(attractCtl.onInput()){ return; } showTouchControls(); }, true); // toque revela (e encerra a demo)
  addEventListener('touchstart',()=>{ showTouchControls(); }, {capture:true,passive:true});
  const codeFor=(act)=>(controls[act]&&controls[act][0])||null; // mapeia p/ a 1ª tecla de P1 (remapeável)
  const press=(act)=>{ const c=codeFor(act); if(!c)return; if(!keys.has(c)){ keys.add(c);
    players.forEach(p=>{ if(!p.ctrl)return;
      if(act==='jump'&&p.ctrl.jump.includes(c))p.jumpEdge=true;
      if(act==='run'&&p.ctrl.run.includes(c))p.runEdge=true;
      if(act==='left'&&p.ctrl.left.includes(c))p.leftEdge=true;   // alternância: tap na direção
      if(act==='right'&&p.ctrl.right.includes(c))p.rightEdge=true;
      if(act==='swap'&&p.ctrl.swap&&p.ctrl.swap.includes(c))p.swapEdge=true;
      if(act==='especial'&&p.ctrl.especial&&p.ctrl.especial.includes(c))p.specialEdge=true; }); }
    if(act==='jump')hideTips(); };
  const release=(act)=>{ const c=codeFor(act); if(c)keys.delete(c); };
  const doTouch=(a,on)=>{ if(a==='pause'){ if(on)togglePause(); return; } on?press(a):release(a); }; // ação mapeável (função de cada botão)
  tc.querySelectorAll('.touch-btn').forEach(b=>{ const slot='b'+b.dataset.btn;  // função vem do touchMap (remapeável)
    const down=(e)=>{ e.preventDefault(); doTouch(touchCtl.getTouchMap()[slot],true); };
    const up=(e)=>{ e.preventDefault(); doTouch(touchCtl.getTouchMap()[slot],false); };
    b.addEventListener('pointerdown',down); b.addEventListener('pointerup',up);
    b.addEventListener('pointerleave',up); b.addEventListener('pointercancel',up);
    b.addEventListener('contextmenu',(e)=>e.preventDefault());
  });
  // START (enter): faz a função mapeada (padrão pausar); se for ação momentânea, pressiona e solta.
  const startBtn=$('#touch-start'); if(startBtn)startBtn.addEventListener('click',()=>{ const a=touchMap.start; if(a==='pause'){ togglePause(); } else { doTouch(a,true); setTimeout(()=>doTouch(a,false),140); } });
  // joystick digital: base (círculo grande) + manopla (círculo menor) que desliza p/ a direção tocada → 8 direções
  const stick=$('#touch-stick'), knob=stick&&stick.querySelector('.touch-knob');
  if(stick&&knob){
    let pid=null; // deslocamento (R) e zona-morta (DEAD) vêm de touchCtl.getStickTravelPx()/touchCtl.getStickDeadPx() (mm, config em A12e motora)
    const dirState={left:false,right:false,up:false,down:false};
    const setDir=(d,on)=>{ if(dirState[d]===on)return; dirState[d]=on; doTouch(touchCtl.getTouchMap()[d],on); }; // direção física → função mapeada
    const move=(px,py)=>{ const R=touchCtl.getStickTravelPx(), DEAD=touchCtl.getStickDeadPx(); const r=stick.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
      let dx=px-cx, dy=py-cy; const m=Math.hypot(dx,dy)||1; const f=m>R?R/m:1;
      knob.style.transform=`translate(${dx*f}px,${dy*f}px)`;
      setDir('left',dx<-DEAD); setDir('right',dx>DEAD); setDir('up',dy<-DEAD); setDir('down',dy>DEAD); };
    const reset=()=>{ knob.style.transform='translate(0,0)'; ['left','right','up','down'].forEach(d=>setDir(d,false)); pid=null; };
    stick.addEventListener('pointerdown',(e)=>{ e.preventDefault(); pid=e.pointerId; try{stick.setPointerCapture(pid);}catch(_){} move(e.clientX,e.clientY); });
    stick.addEventListener('pointermove',(e)=>{ if(pid!==e.pointerId)return; e.preventDefault(); move(e.clientX,e.clientY); });
    const end=(e)=>{ if(pid!==e.pointerId)return; e.preventDefault(); reset(); };
    stick.addEventListener('pointerup',end); stick.addEventListener('pointercancel',end);
    stick.addEventListener('lostpointercapture',reset); stick.addEventListener('contextmenu',(e)=>e.preventDefault());
  }
  // D-pad em CRUZ (estilo alternativo ao analógico): superfície tocável dividida em 8 setores por hit-test
  // (dá diagonais como um D-pad físico). Zona-morta central evita disparo por encostar no meio.
  const cross=$('#touch-cross');
  if(cross){ const arms={up:cross.querySelector('.dpad-up'),down:cross.querySelector('.dpad-down'),left:cross.querySelector('.dpad-left'),right:cross.querySelector('.dpad-right')};
    const cst={left:false,right:false,up:false,down:false}; let cpid=null;
    const cset=(d,on)=>{ if(cst[d]===on)return; cst[d]=on; doTouch(touchCtl.getTouchMap()[d],on); if(arms[d])arms[d].classList.toggle('on',on); }; // direção física → função mapeada
    const at=(px,py)=>{ const r=cross.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2; const dx=px-cx, dy=py-cy; const dead=r.width*0.18; // ~18% do lado = miolo neutro
      cset('left',dx<-dead); cset('right',dx>dead); cset('up',dy<-dead); cset('down',dy>dead); };
    const crst=()=>{ ['left','right','up','down'].forEach(d=>cset(d,false)); cpid=null; };
    cross.addEventListener('pointerdown',(e)=>{ e.preventDefault(); cpid=e.pointerId; try{cross.setPointerCapture(cpid);}catch(_){} at(e.clientX,e.clientY); });
    cross.addEventListener('pointermove',(e)=>{ if(cpid!==e.pointerId)return; e.preventDefault(); at(e.clientX,e.clientY); });
    const cend=(e)=>{ if(cpid!==e.pointerId)return; e.preventDefault(); crst(); };
    cross.addEventListener('pointerup',cend); cross.addEventListener('pointercancel',cend);
    cross.addEventListener('lostpointercapture',crst); cross.addEventListener('contextmenu',(e)=>e.preventDefault());
  }
  window.__incl.showTouch=()=>{ tc.hidden=false; }; // p/ testes em desktop
})();

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
