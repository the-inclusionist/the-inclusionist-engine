// SPDX-License-Identifier: GPL-3.0-or-later
// The Inclusionist v4 — port do Lúdico real sobre PixiJS.
// VERSIONAMENTO (recalculado do git em 2026-07-02): MINOR +1 a cada feature (patch zera);
// PATCH +1 a cada conserto/ajuste; docs/chore não mudam versão. INCL_VERSION agora é DISPLAY (bump em mudança relevante); o cache é por content-hash do vite-plugin-pwa (Estágio 1) — sem sw.js/bump manual.
import * as PIXI from 'pixi.js'; // PixiJS 7.4.2 via npm (Vite empacota; aposenta o <script> global vendor/pixi.min.js)
import i18n from './core/i18n.js'; // internacionalização
import * as tiles from './core/tiles.js'; // legend + parser do mapa em glifo
import * as store from './platform/storage.js'; // camada de persistência
import { phase, setPhaseValue, quizLevel, setQuizLevelValue, numPlayers, setNumPlayersValue, cenario as CENARIO, setCenarioValue, activity as ACTIVITY, setActivityValue, vizMode, initVizMode, setVizModeValue, coins, setCoins, players } from './core/state.js'; // estado (as 8 mega-variáveis)
import { startLoop } from './core/loop.js'; // driver do loop
import { initDebugPanel } from './ui/debug-panel.js'; // painel ?debug (Tier 1)
import { createAttract } from './game/attract.js'; // modo demonstração (Tier 1)
import { puTaken, takePu } from './game/powerups.js'; // Estágio 4 (Tier 2): predicados de coleta de power-up
import { ELEV_SPEED, buildElevators, elevAt, getElevShafts, initElevators } from './game/elevators.js'; // Estágio 4 (Tier 2): geometria de elevador (cadeirante)
import { gcd, fmtFrac, fracGraphic, fracSpeak, speakChoice } from './game/fractions.js'; // Estágio 4 (Tier 2): matemática/render de frações
import { BRAILLE, brailleText } from './game/braille.js'; // Estágio 4 (Tier 2): cela braille + fala (atividade cego)
import { JUICE, saveJuice, easeOut3, spawnParticle, puffDust, burstSparkle, addShake, addHitstop, setSquash, stepFx, drawFx, initFx, tickHitstop, shakeAmp, getParticles, getHitstopT, getShakeT } from './render/fx.js'; // Estágio 4 (Tier 2): juice (partículas/shake/hitstop/squash)
import { parallaxPlaceholder, themeSkyTexture, themeHillsTexture } from './render/scene-parallax.js'; // Estágio 4 (Tier 2): geradores de textura do parallax
import { isGroundType, worldCanvas, worldToTexture, initWorldTex } from './render/world-tex.js'; // Estágio 4 (Tier 2): builder da textura NORMAL do mundo
import { drawCane, drawRunCane, drawChair } from './render/wheelchair-sprites.js'; // Estágio 4 (Tier 2): bengala + cadeira (a11y motora)
import { loadKB, saveKB, resetKB } from './input/keyboard.js'; // Fase 2: config de teclado (subsistema input)
import { AUDIO_CATS } from './platform/audio-mixer.js'; // Fase 2: categorias do mixer (dados); audioCat/catNode/setCatGain vêm de audio.js
import { FONT_GROUPS, FONT_BY_KEY, loadFontKey, saveFontKey } from './ui/fonts.js'; // Fase 2: tipografia (catálogo + persistência)
import { $ } from './ui/dom.js'; // Fase 2.27: atalho de querySelector (Tier 1)
import { VIZ_MODES, VIZ_BY_KEY, VIZ_FILTER, VIZ_CYCLE } from './render/viz-modes.js'; // Fase 2: modos visuais de a11y (dados)
import { PAD_DESIGNS, TOUCH_ACT_LABELS, TOUCH_DEFAULT } from './input/devices.js'; // Fase 2: rótulos de gamepad/toque (dados)
import { keys, padCur, padPrevAct, padPrevStart, PAD_DEAD, held } from './input/state.js'; // Fase 2.22: estado de input + held
import { audioCtx, ensureAC, SFX, soundOn, volume, setSoundOn, setVolume, audioOut, hearingLoss, setHearingLossGraph, setMasterMuted, audioCat, initAudioMixer, catNode, setCatGain, tone, tonePan, noiseBuffer, noiseHit, _footCount } from './platform/audio.js'; // Fase 2: base + mestre + mixer + sínteses (oscilador + ruído)
import { gameSay } from './platform/speech.js';
import { createAudioJingles } from './platform/audio-jingles.js'; // Tier 2 (áudio r1): jingles de vitória/enigma/fogos
import { createAudioEarcons } from './platform/audio-earcons.js'; // Tier 2 (áudio r2): earcons (sfx) + porta + legendas
import { createAudioNav } from './platform/audio-nav.js'; // Tier 2 (áudio r3): pistas espaciais (bengala/sonar/guarda/guia/nado)
import { createAudioAmbient } from './platform/audio-ambient.js'; // Tier 2 (áudio r4): trilha de ambiente + trovão
import { createTts } from './platform/tts.js'; // Tier 2 (#38): narração por voz (Piper neural lazy + fallback Web Speech)
import { TEX_IDLE, TEX_WALK, TEX_RUN, FLAVORS, TEX_JUMP_UP, TEX_JUMP_DOWN, TEX_CLIMB, TEX_FLY, TEX_CLING_WALL, TEX_CLING_CEIL, TEX_SWIM, TEX_SWIMIDLE, initCharacterSprites } from './render/sprites.js';
import { makeCanvas, tex, pixDisc } from './render/canvas.js';
import { cloudWrapX, createSceneSky } from './render/scene-sky.js'; // Tier 2 (#43): céu — nuvens (#21) + decor viva da v3
import { coinCanvas, coinTexture, treeCanvas, treeTexture, powerupCanvas } from './render/props.js';
import { outlineCanvas, spriteToCanvas } from './render/sprite-fx.js'; // Fase 2: voz do letramento (pt-BR sempre-ativa)
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
import { LOGICAL_W, LOGICAL_H, TILE, COIN_TARGET, TUNE, JUMP_BASE, ANIM, EASY, TILE_TYPES, TILE_COLOR } from './core/constants.js';
import { Z } from './core/layers.js'; // #69/ADR-0020: ordem-z canônica (nomeada) do render
import { rnd, randInt, shuffle } from './core/rng.js'; // Fase 2.26: RNG semeado (Tier 1)
import { initCollision, caneBlockPx, isSolidType, tileAt, solidTile, solidAt, surfTop, isWcRampRiser, rampSurfaceY } from './core/collision.js'; // Estágio 4: colisão de grade (determinística; ctx por closures)
import { BOX, SPAWN_X, SPAWN_Y, makePlayer, jumpVel, isBouncyGroundBelow, touchingWall, clingSides, firstClingSide, spiderReattach, wrapConvex } from './game/player.js'; // Estágio 4: entidade + geometria de colisão do jogador
import { initCoins, findCoinCandidates, pickCoins, positionEasyCoins, takeCoin } from './game/coins.js'; // Estágio 4: posicionamento dos coletáveis (pools vêm daqui)
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
function buildDarkRegions(){
  const seen=Array.from({length:WORLD_H},()=>new Array(WORLD_W).fill(false)),regions=[];
  for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++){
    if(tileAt(x,y)!==0||seen[y][x])continue;
    const stack=[[x,y]],tiles=[]; seen[y][x]=true;
    while(stack.length){ const [cx,cy]=stack.pop(); tiles.push([cx,cy]);
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nx=cx+dx,ny=cy+dy;
        if(nx>=0&&nx<WORLD_W&&ny>=0&&ny<WORLD_H&&!seen[ny][nx]&&tileAt(nx,ny)===0){seen[ny][nx]=true;stack.push([nx,ny]);}}}
    if(tiles.length>=2) regions.push(tiles); // ignora bolsões minúsculos
  }
  return regions;
}

/* ===================== sprite do personagem ===================== */
const PLAYER_IDLE = [
  '................','................','.....HHHHHH.....','....HHHHHHHH....',
  '....HHSSSSHH....','....HSSSSSSH....','....HSKSSKSH....','....HSSSSSSH....',
  '....HSSWWSSH....','....HSSSSSSH....','.....HSSSSH.....','......SSSS......',
  '.....RRRRRR.....','....RRRRRRRR....','...RRRRRRRRRR...','..SRRRRRRRRRRS..',
  '..SRRRRRRRRRRS..','..SRRRRRRRRRRS..','..SRRRRRRRRRRS..','...RRRRRRRRRR...',
  '...RRRRRRRRRR...','....RRRRRRRR....','....BBBBBBBB....','....BBBBBBBB....',
  '....BBB..BBB....','....BBB..BBB....','....BBB..BBB....','....BBB..BBB....',
  '....BBB..BBB....','....BBB..BBB....','...KKKK..KKKK...','...KKKK..KKKK...',
];
const PLAYER_WALK = [
  '................','................','.....HHHHHH.....','....HHHHHHHH....',
  '....HHSSSSHH....','....HSSSSSSH....','....HSKSSKSH....','....HSSSSSSH....',
  '....HSSWWSSH....','....HSSSSSSH....','.....HSSSSH.....','......SSSS......',
  '.....RRRRRR.....','....RRRRRRRR....','...RRRRRRRRRR...','..SRRRRRRRRRRS..',
  '..SRRRRRRRRRRS..','..SRRRRRRRRRRS..','..SRRRRRRRRRRS..','...RRRRRRRRRR...',
  '...RRRRRRRRRR...','....RRRRRRRR....','....BBBBBBBB....','...BBBB..BBB....',
  '..BBB....BBB....','.BBB.....BBB....','KKKK.....KKKK...','................',
  '................','................','................','................',
];
const PLAYER_CLIMB = [ // vista de costas, ALTURA CHEIA (pés na base) — corrige o "encolhimento" na escada
  '................','................','.....HHHHHH.....','....HHHHHHHH....',
  '....HHHHHHHH....','....HHHHHHHH....','....HHHHHHHH....','....HHHHHHHH....',
  '....HHHHHHHH....','....HHHHHHHH....','.....HHHHHH.....','......SSSS......',
  '.....RRRRRR.....','....RRRRRRRR....','...RRRRRRRRRR...','..SRRRRRRRRRRS..',
  '..SRRRRRRRRRRS..','..SRRRRRRRRRRS..','..SRRRRRRRRRRS..','...RRRRRRRRRR...',
  '...RRRRRRRRRR...','....RRRRRRRR....','....BBBBBBBB....','....BBBBBBBB....',
  '....BBB..BBB....','....BBB..BBB....','....BBB..BBB....','....BBB..BBB....',
  '....BBB..BBB....','....BBB..BBB....','...KKKK..KKKK...','...KKKK..KKKK...',
];
const PLAYER_HURT = [
  '................','................','.....HHHHHH.....','....HHHHHHHH....',
  '....HHSSSSHH....','....HSSSSSSH....','....HSWWWWSH....','....HSWKKWSH....',
  '....HSSSSSSH....','....HSKKKKSH....','.....HSSSSH.....','......SSSS......',
  '.....RRRRRR.....','....RRRRRRRR....','...RRRRRRRRRR...','..SRRRRRRRRRRS..',
  '..SRRRRRRRRR.S..','..SRRRRRRRR.SS..','...RRRRRRRRSS...','...RRRRRRRRRR...',
  '...RRRRRRRRRR...','....RRRRRRRR....','....BBBBBBBB....','....BBBBBBBB....',
  '....BBB..BBB....','....BBB..BBB....','....BBB..BBB....','....BBB..BBB....',
  '....BBB..BBB....','....BBB..BBB....','...KKKK..KKKK...','...KKKK..KKKK...',
];
// (paleta APP movida p/ render/sprite-fx.js na Fase 2.21)

/* ===================== canvas → textura ===================== */
// makeCanvas/tex/pixDisc migrados p/ render/canvas.js (Fase 2.18).

// outlineCanvas/spriteToCanvas (+ _silhouette/OUTLINE_DARK/APP) migrados p/ render/sprite-fx.js (Fase 2.21)

// isGroundType/worldCanvas/worldToTexture extraídos p/ render/world-tex.js (Estágio 4). WORLD injetado por
// initWorldTex (logo após o mapa carregar). worldToTextureDirect/worldTexFor (alto contraste) + stepTileFx
// (água/lava animadas) ficam aqui.
// Renderização Direta (alto contraste de acessibilidade — ver docs/PESQUISA-ALTO-CONTRASTE.md):
// fundo dessaturado+escuro (recua), estrutura com contorno CLARO, primeiro plano (player/itens) com contorno
// escuro → o que importa "salta". É a abordagem que a indústria usa; atinge o contraste por construção.
function _dimDesat(c,w,h,mul,blue,off){ off=off||0; const img=c.getImageData(0,0,w,h),d=img.data;
  for(let i=0;i<d.length;i+=4){ if(d[i+3]<8)continue; const l=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2], g=off+l*mul;
    d[i]=Math.min(255,g)|0; d[i+1]=Math.min(255,g*1.02)|0; d[i+2]=Math.min(255,g*blue)|0; } c.putImageData(img,0,0); }
// 3 níveis de contraste. off/mul = mapa da plataforma (mais off = mais clara → mais contraste); bgMul = fundo
// (menor = mais escuro/recuado); outline = espessura do contorno do 1º plano. Contraste plataforma×fundo ≈ 3 / 4,5 / 7.
const DIRECT_CFG={ 'hc-direto':{off:55,mul:0.5,bgMul:0.30}, 'hc-direto-45':{off:66,mul:0.5,bgMul:0.28}, 'hc-direto-7':{off:100,mul:0.48,bgMul:0.13} };
const HC_SEQ=['normal','hc-direto','hc-direto-45','hc-direto-7']; // ciclo do botão de contraste
const HC_LABEL={'normal':'off','hc-direto':'3:1','hc-direto-45':'4,5:1','hc-direto-7':'7:1'};
function _dcfg(mode){ return DIRECT_CFG[mode]||DIRECT_CFG['hc-direto']; }
// Dois contornos configuráveis (0=nenhum · 1=fino/1px · 2=grosso/2px):
//  fg = 1º plano (personagem/itens) — WCAG 2.4.7 foco visível; bg = 2º plano (perímetro externo de
//  plataforma/água/lava — delimita navegável × não-navegável) — WCAG 1.4.11 contraste ≥3:1.
let hcOutlineFg=1, hcOutlineBg=1;
try{ const v=localStorage.getItem('incl_outfg'); if(v!=null)hcOutlineFg=Math.max(0,Math.min(2,+v||0)); }catch(e){}
try{ const v=localStorage.getItem('incl_outbg'); if(v!=null)hcOutlineBg=Math.max(0,Math.min(2,+v||0)); }catch(e){}
// Color-blocking por PAPEL: perigo=laranja-quente, escalável/interativo(escada/trampolim)=ciano, água=azul,
// portão=magenta (papel próprio); estrutura(pedra/parede) fica no cinza-azulado do nível.
// L2: CUSTOMIZÁVEL — o usuário pode trocar a cor de cada papel (persistido); padrão = HC_ROLE_DEF.
const HC_ROLE_DEF={ hazard:[255,110,45], climb:[55,225,205], water:[70,140,255], gate:[194,58,212] };
const HC_ROLE=(()=>{ const d=JSON.parse(JSON.stringify(HC_ROLE_DEF));
  try{ const s=JSON.parse(localStorage.getItem('incl_hcrole')); if(s&&typeof s==='object')
    for(const k in d) if(Array.isArray(s[k])&&s[k].length===3) d[k]=s[k].map(n=>Math.max(0,Math.min(255,n|0))); }catch(e){}
  return d; })();
function saveHcRole(){ try{ localStorage.setItem('incl_hcrole',JSON.stringify(HC_ROLE)); }catch(e){} }
const rgbHex=a=>'#'+a.map(n=>n.toString(16).padStart(2,'0')).join('');
const hexRgb=h=>{ const m=/^#?([0-9a-f]{6})$/i.exec(h); if(!m)return null; const n=parseInt(m[1],16); return [n>>16&255,n>>8&255,n&255]; };
function _roleOf(t){ if(t===9)return 'hazard'; if(t===4||t===5||t===10)return 'climb'; if(t===3)return 'water'; return null; }
function worldToTextureDirect(srcCanvas, mode){ const cfg=_dcfg(mode);
  const cv=makeCanvas(srcCanvas.width,srcCanvas.height),c=cv.getContext('2d'); c.drawImage(srcCanvas,0,0);
  _dimDesat(c,cv.width,cv.height,cfg.mul,1.22,cfg.off); // base: estrutura vira cinza-azulado (mais clara = mais contraste)
  for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++){ const t=WORLD[y][x], role=_roleOf(t); if(!role)continue; const X=x*TILE,Y=y*TILE; // repinta tiles não-estruturais pela cor do papel
    if(t===4){ // ESCADA: preto + trilhos e degraus ciano → lê como escada (não faixa verde sólida)
      c.fillStyle='#0a0e14'; c.fillRect(X,Y,TILE,TILE);
      c.fillStyle='rgb('+HC_ROLE.climb.join(',')+')'; c.fillRect(X+1,Y,2,TILE); c.fillRect(X+TILE-3,Y,2,TILE);   // trilhos laterais (cor do papel, customizável)
      for(let ry=2;ry<TILE-1;ry+=5) c.fillRect(X+1,Y+ry,TILE-2,2);                               // degraus
      continue; }
    const rc=HC_ROLE[role], img=c.getImageData(X,Y,TILE,TILE), d=img.data, lo=role==='hazard'?0.58:0.44;
    for(let i=0;i<d.length;i+=4){ if(d[i+3]<8)continue; const g=(0.299*d[i]+0.587*d[i+1]+0.114*d[i+2])/255, f=lo+(1-lo)*g;
      d[i]=Math.min(255,rc[0]*f)|0; d[i+1]=Math.min(255,rc[1]*f)|0; d[i+2]=Math.min(255,rc[2]*f)|0; }
    c.putImageData(img,X,Y); }
  const th=hcOutlineBg; // contorno de 2º plano: SÓ o perímetro externo (bordas voltadas ao ar) — não em cada bloco
  if(th>0){ const air=(x,y)=>{ const t=tileAt(x,y); return t===0||t===1; }; c.fillStyle='rgba(200,222,255,0.97)';
    for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++){ const t=WORLD[y][x]; if(t===0||t===1)continue; const X=x*TILE,Y=y*TILE;
      if(air(x,y-1))c.fillRect(X,Y,TILE,th); if(air(x,y+1))c.fillRect(X,Y+TILE-th,TILE,th);
      if(air(x-1,y))c.fillRect(X,Y,th,TILE); if(air(x+1,y))c.fillRect(X+TILE-th,Y,th,TILE); } }
  return tex(cv);
}
function directBgTexture(srcTex,mode){ const cfg=_dcfg(mode); const cv=makeCanvas(Math.max(1,srcTex.orig.width),Math.max(1,srcTex.orig.height)); const dst=tex(cv);
  const paint=()=>{ const s=srcTex.baseTexture.resource&&srcTex.baseTexture.resource.source; if(!s||!s.width)return;
    cv.width=s.width;cv.height=s.height; const c=cv.getContext('2d'); c.clearRect(0,0,cv.width,cv.height); c.drawImage(s,0,0); _dimDesat(c,cv.width,cv.height,cfg.bgMul,1.2); dst.update(); };
  if(srcTex.baseTexture.valid)paint(); else srcTex.baseTexture.once('loaded',paint); return dst; }
// sprite de primeiro plano (player/moeda/power-up): mantém a cor da arte + contorno escuro (salta)
function directSpriteCanvas(srcCanvas,mode){ return hcOutlineFg>0 ? outlineCanvas(srcCanvas,hcOutlineFg) : srcCanvas; } // fg=0 → sem contorno
function directSpriteTexture(srcTex,mode){ if(hcOutlineFg<=0) return srcTex; const th=hcOutlineFg; const cv=makeCanvas(Math.max(1,srcTex.orig.width),Math.max(1,srcTex.orig.height)); const dst=tex(cv);
  const paint=()=>{ const s=srcTex.baseTexture.resource&&srcTex.baseTexture.resource.source; if(!s||!s.width)return;
    const o=outlineCanvas(s,th); cv.width=o.width;cv.height=o.height; const c=cv.getContext('2d'); c.clearRect(0,0,cv.width,cv.height); c.drawImage(o,0,0); dst.update(); };
  if(srcTex.baseTexture.valid)paint(); else srcTex.baseTexture.once('loaded',paint); return dst; }
// Alto contraste (re-adicionado): recolore cada tile pela PALETA do grupo (gradient-map por matiz, mantém claro-escuro).
// coinCanvas/coinTexture/treeCanvas/treeTexture migrados p/ render/props.js (Fase 2.19)

/* ===================== moedas (spawn real) ===================== */
// findCoinCandidates/pickCoins/takeCoin extraídos p/ game/coins.js (Estágio 4, posicionamento).
// RNG semeado (rnd/randInt/shuffle/_seed) migrado p/ core/rng.js (Fase 2.26 / Tier 1)
// modos de jogo
let MODE='ludico'; // 'ludico' | 'somasub' (silabas vem na E7)
const SOMASUB_SHAPES=[
  {id:'circulo',nome:'círculo'},{id:'triangulo',nome:'triângulo'},{id:'quadrado',nome:'quadrado'},
  {id:'retangulo',nome:'retângulo'},{id:'losango',nome:'losango'},{id:'paralelogramo',nome:'paralelogramo'},
  {id:'trapezio',nome:'trapézio'},{id:'pentagono',nome:'pentágono'},{id:'hexagono',nome:'hexágono'},{id:'oval',nome:'oval'},
];
const somaSubName=(id)=>{const x=SOMASUB_SHAPES.find(z=>z.id===id);return x?x.nome:id;};
// Sílabas: palavras de 2 sílabas + emoji (glifo Unicode = zero imagens binárias)
const SILABAS_WORDS=[
  {w:'gato',e:'🐱',s:['ga','to']},{w:'bola',e:'⚽',s:['bo','la']},{w:'casa',e:'🏠',s:['ca','sa']},
  {w:'pato',e:'🦆',s:['pa','to']},{w:'sapo',e:'🐸',s:['sa','po']},{w:'vaca',e:'🐄',s:['va','ca']},
  {w:'rato',e:'🐀',s:['ra','to']},{w:'lua',e:'🌙',s:['lu','a']},{w:'uva',e:'🍇',s:['u','va']},
  {w:'dado',e:'🎲',s:['da','do']},{w:'fogo',e:'🔥',s:['fo','go']},{w:'bolo',e:'🎂',s:['bo','lo']},
  {w:'ovo',e:'🥚',s:['o','vo']},{w:'gelo',e:'🧊',s:['ge','lo']},{w:'rosa',e:'🌹',s:['ro','sa']},
];
const SILABA_POOL=(()=>{const cons='bcdfgjlmnprstv'.split(''),vow='aeiou'.split(''),o=[];for(const c of cons)for(const v of vow)o.push(c+v);return o;})();
const WORD_INITIALS=[...new Set(SILABAS_WORDS.map(w=>w.w[0]))];
/* L3: quiz de alfabetização em 5 NÍVEIS (psicogênese da língua escrita — Ferreiro & Teberosky):
   1 pré-silábico — escolher a palavra BEM escrita entre 3 (2 malformadas); o jogo SOLETRA a opção sob o cursor.
   2 silábico c/ valor — montar por SÍLABAS; o jogo LÊ a sílaba sob o cursor.
   3 silábico-alfabético — montar por SÍLABAS; o jogo SOLETRA as letras da sílaba.
   4 escritor (alfabético) — montar por LETRAS numa grade; o jogo fala o NOME da letra.
   5 escritor cego — montar por LETRAS; o jogo dita a CELA BRAILLE de cada letra. */
// 'quizLevel' agora vem de core/state.js (Fase 2, mega-variável 2). Leitura = binding vivo; escrita via setQuizLevel().
const QL_NAME={1:'pré-silábico',2:'silábico',3:'silábico-alfabético',4:'escritor',5:'escritor cego'};
const LETTER_NAME={a:'á',b:'bê',c:'cê',d:'dê',e:'é',f:'éfe',g:'gê',h:'agá',i:'i',j:'jota',k:'cá',l:'éle',m:'ême',n:'êne',o:'ó',p:'pê',q:'quê',r:'érre',s:'ésse',t:'tê',u:'u',v:'vê',w:'dáblio',x:'xis',y:'ípsilon',z:'zê'};
const soletra=w=>String(w).split('').map(c=>LETTER_NAME[c]||c).join(', ');
function malform(w){ const vow='aeiou'; // distrator MALFORMADO plausível: troca uma vogal OU inverte um par vizinho
  for(let t=0;t<12;t++){ let out=w;
    if(rnd()<0.5){ const idxs=[...w].map((c,i)=>vow.includes(c)?i:-1).filter(i=>i>=0);
      if(idxs.length){ const i=idxs[randInt(0,idxs.length-1)], alt=vow.replace(w[i],''); out=w.slice(0,i)+alt[randInt(0,alt.length-1)]+w.slice(i+1); } }
    else if(w.length>=3){ const a=w.split(''), i=randInt(0,w.length-2); const x=a[i]; a[i]=a[i+1]; a[i+1]=x; out=a.join(''); }
    if(out!==w && !SILABAS_WORDS.some(x=>x.w===out)) return out; } // nunca devolve palavra real
  return w.split('').reverse().join(''); }
// Distratores de FERREIRO & TEBEROSKY (jogo "Descobrindo palavras", pré-silábico): a correta é a palavra normal;
// as erradas atacam as hipóteses pré-silábicas comuns: (a) símbolo/emoji → refuta hipótese ICÔNICA; (b) 4-8 letras
// repetidas → falta de VARIEDADE interna; (c) emoji NO MEIO; (d) 1 letra/sílaba (ou menos) OU 4+/sílaba → refuta TAMANHO=objeto.
const _FER_SYM=['★','◆','#','@','%','&','✦','◇','■','●'];
const _FER_EMO=['🐱','🍎','🌟','🚗','🐶','🎈','🐸','🍌','⭐','🎲','🌙','🔥'];
function ferreiroDistractors(item){ const w=item.w, n=item.s.length, L=w.length, pick=a=>a[randInt(0,a.length-1)], mid=Math.max(1,Math.floor(L/2));
  const a=()=> rnd()<0.5 ? pick(_FER_SYM)+w : w.slice(0,mid)+pick(_FER_SYM)+w.slice(mid);        // (a) símbolo
  const b=()=> pick(w).repeat(randInt(4,8));                                                      // (b) letra repetida 4-8×
  const c=()=> w.slice(0,mid)+pick(_FER_EMO)+w.slice(mid);                                        // (c) emoji no meio
  const d=()=> rnd()<0.5 ? w.slice(0,Math.max(1,n-1))                                             // (d-) ≤1 letra/sílaba
                         : w.split('').map(ch=>ch+ch+ch+ch).join('').slice(0,Math.max(n*4,8));     // (d+) 4+ letras/sílaba
  return [a(),b(),c(),d()]; }
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
function showPower(pl){ if(pl===players[0]){ const el=document.getElementById('hud-power'); if(el)el.textContent=(POWER_SHORT[pl.activePower]||'—')+(pl.owned&&pl.owned.length>1?' ('+pl.owned.length+')':''); } }
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
let jumpEdge=false, captureAction=null, captureMapRef=null, optionsOpen=false, movementOpen=false, animationOpen=false, visualOpen=false, empathyOpen=false, audioOpen=false;
// Gamepad (B3/L1): estado por controle. padCur[gi]=ações seguradas neste frame; associação pad↔jogador vive em p.pad.
// padCur/padPrevAct/padPrevStart + PAD_DEAD movidos p/ input/state.js (Fase 2.22)  // // zona morta = primeira METADE do curso (ergonomia — José 2026-07-02)
// Config de teclado extraída p/ input/keyboard.js (Fase 2): esquemas, defaults, loadKB/saveKB/resetKB.
let KB=loadKB();
// saveKB agora vem de input/keyboard.js (recebe o KB como argumento)
function kbFor(i){ if(numPlayers<=1)return KB.solo; if(numPlayers<=2)return KB.p2[i]||KB.p2[0]; if(numPlayers<=3)return KB.p3[i]||KB.p3[0]; return KB.p4[i]||KB.p4[0]; } // esquema do jogador i (modo 3 e 4 separados)
let controls=KB.solo; // alias do P1 (navegação do quiz + GAME_KEYS)
let KJUMP=controls.jump, KLEFT=controls.left, KRIGHT=controls.right, KUP=controls.up, KDOWN=controls.down, KRUN=controls.run;
let GAME_KEYS=[...KJUMP,...KLEFT,...KRIGHT,...KUP,...KDOWN];
function applyControls(){ controls=KB.solo; KJUMP=controls.jump;KLEFT=controls.left;KRIGHT=controls.right;KUP=controls.up;KDOWN=controls.down;KRUN=controls.run;
  const all=[]; players.forEach((p,i)=>{ const m=kbFor(i); for(const a in m) all.push(...m[a]); }); GAME_KEYS=all.length?all:[...KJUMP,...KLEFT,...KRIGHT,...KUP,...KDOWN]; }
// Tint distintivo por jogador (P1 = normal). L2: paleta CB-SAFE opcional (Okabe & Ito 2008 — laranja/azul-céu/
// amarelo distinguíveis em protan/deutan/tritan) SÓ para jogadores/itens/efeitos — o CENÁRIO fica com cores naturais.
const PCOLOR_DEF=[0xffffff,0xff9a9a,0x8affc0,0xffe08a], PCOLOR_CB=[0xffffff,0xe69f00,0x56b4e9,0xf0e442];
let cbSafe=(()=>{ try{ return localStorage.getItem('incl_cbsafe')==='1'; }catch(e){ return false; } })();
const PCOLOR=(cbSafe?PCOLOR_CB:PCOLOR_DEF).slice(); // mutável in-place (todos referenciam PCOLOR)
let ownerColors=(()=>{ try{ return localStorage.getItem('incl_ownercolors')!=='0'; }catch(e){ return true; } })(); // itens na cor do dono (padrão ligado)
function assignControls(){ players.forEach((p,i)=>p.ctrl=kbFor(i)); }
assignControls();
// Conflito: uma tecla não pode ser de dois jogadores no MESMO modo. Retorna o índice do outro dono, ou -1.
function keyUsedByOther(code, mapRef){ for(let i=0;i<numPlayers;i++){ const m=kbFor(i); if(m===mapRef)continue; for(const a in m){ if(m[a]&&m[a].indexOf(code)>=0)return i; } } return -1; }
addEventListener('keydown',(e)=>{
  if(attractCtl.onInput()){ e.preventDefault(); return; } // qualquer tecla encerra a demo
  if(captureAction){ // remap: a próxima tecla vira o novo controle (do jogador selecionado)
    if(e.code==='Escape'){ captureAction=null; captureMapRef=null; if(typeof renderControls==='function')renderControls(); e.preventDefault(); return; }
    const m=captureMapRef||controls; const other=keyUsedByOther(e.code, m);
    if(other>=0){ srAlert('Essa tecla já é do Jogador '+(other+1)+'. Escolha outra, ou Esc para cancelar.'); e.preventDefault(); return; } // não associa: segue capturando
    m[captureAction]=[e.code]; saveKB(KB); applyControls(); assignControls();
    captureAction=null; captureMapRef=null; if(typeof renderControls==='function')renderControls(); e.preventDefault(); return;
  }
  // Diálogo aberto: só bloqueia o jogo se o elemento estiver DE FATO visível (flag preso não trava mais o teclado).
  const dlgVis=(id)=>{ const el=$('#'+id); return el && !el.hidden; };
  if(optionsOpen && dlgVis('options')){ if(e.code==='Escape')closeOptions(); return; }
  if(movementOpen && dlgVis('movement')){ if(e.code==='Escape')closeMovement(); return; }
  if(animationOpen && dlgVis('animation')){ if(e.code==='Escape')closeAnimation(); return; }
  if(visualOpen && dlgVis('visual')){ if(e.code==='Escape')closeVisual(); return; }
  if(empathyOpen && dlgVis('empathy')){ if(e.code==='Escape')closeEmpathy(); return; }
  if(audioOpen && dlgVis('audio')){ if(e.code==='Escape')closeAudio(); return; }
  if(typoOpen && dlgVis('typo')){ if(e.code==='Escape')closeTypo(); return; }
  if(dlgVis('touchcfg')){ if(e.code==='Escape'){ const t=$('#touchcfg'); if(t)t.hidden=true; } return; }
  if(dlgVis('padwiz')){ if(e.code==='Escape')closePadWiz(false); return; } // wizard de gamepad: Esc cancela
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
    const scr=vpScreens[p.i], w=scr&&scr.querySelector('.vp-wait'); if(w)w.remove(); srSay('Jogador '+(p.i+1)+' entrou!'); } }
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
const rm=(()=>{ try{ const s=JSON.parse(localStorage.getItem('inclusionist.reducedmotion.v1')); if(s&&typeof s==='object'){ const o={}; RM_KEYS.forEach(k=>o[k]=!!s[k]); return o; } }catch(e){}
  const o={}; RM_KEYS.forEach(k=>o[k]=RM_DEFAULT); return o; })();
function saveRM(){ try{ localStorage.setItem('inclusionist.reducedmotion.v1',JSON.stringify(rm)); }catch(e){} }
// Movimento por alternância (1 dedo): tocar a direção trava a marcha; segurar acelera; pulo não interrompe. Persistido.
function loadPlayerA11y(p,i){ try{ const v=localStorage.getItem('incl_viz_p'+i); if(v&&VIZ_BY_KEY[v])p.viz=v;
  p.audioSink=localStorage.getItem('incl_sink_p'+i)||null; // saída de áudio própria do jogador (setSinkId)
  p.easy=localStorage.getItem('incl_easy_p'+i)==='1'; p.toggleMove=localStorage.getItem('incl_togglemove_p'+i)==='1';
  p.rmWalk=localStorage.getItem('incl_rmWalk_p'+i)==='1'; p.rmBreath=localStorage.getItem('incl_rmBreath_p'+i)==='1'; p.rmFlavor=localStorage.getItem('incl_rmFlavor_p'+i)==='1';
  if(i===0){ const ov=localStorage.getItem('incl_viz'); if(ov&&VIZ_BY_KEY[ov]&&localStorage.getItem('incl_viz_p0')==null)p.viz=ov; // migra chaves antigas
    if(localStorage.getItem('inclusionist.togglemove')==='1'&&localStorage.getItem('incl_togglemove_p0')==null)p.toggleMove=true; } }catch(e){} }
function setToggleMove(i,on){ const p=players[i]; if(!p)return; p.toggleMove=on; try{localStorage.setItem('incl_togglemove_p'+i,on?'1':'0');}catch(e){} if(!on)p.walkDir=0;
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
let _rainLevel=0, _weatherT=0; // _rainLevel = ponte clima→áudio (updateWeather escreve; audio-ambient lê). _ambient/_guideCount migraram
// Trilha de ambiente sintetizada + trovão extraídos p/ platform/audio-ambient.ts (Tier 2, áudio r4). O clima VISUAL fica no
// game.js (updateWeather/drawWeather) e migra p/ render depois. Uso: ambient.updateAmbient / ambient.thunder.
const ambient = createAudioAmbient({ ensureAC, getAudioCtx: () => audioCtx, catNode, audioOut, noiseBuffer, tileAt, TILE,
  getSoundOn: () => soundOn, getVolume: () => volume, getAudioCat: () => audioCat, getPlayers: () => players, getRainLevel: () => _rainLevel });
// ===== CLIMA: chuva de verdade (visual + trovão), o áudio segue o visual =====
let weatherLayer=null, _rainDrops=null, _flash=0, _thunderCD=240; // weatherLayer criado após o `app` existir
// thunder (rumor do trovão) extraído p/ platform/audio-ambient.ts (Tier 2, áudio r4). Chamado por updateWeather como ambient.thunder.
function updateWeather(){ _weatherT++;
  // L5 (rotina do José): tempo bom nos primeiros 30s; depois LOOP de 60s = garoa 5s → chuva 5s → garoa 5s → bom 45s.
  // rm.decor (Movimento Reduzido de cena) desliga a chuva visual — o áudio segue o visual (updateAmbient lê _rainLevel).
  const sec=_weatherT/60; let lvl=0;
  if(sec>=30 && !rm.decor && CENARIO==='cidade'){ const c=(sec-30)%60; lvl = c<5 ? 0.35 : c<10 ? 1 : c<15 ? 0.35 : 0; } // garoa=0,35 · chuva=1 — SÓ NA CIDADE (nenhum tema v3 tem chuva)
  const step=1/30; _rainLevel += Math.max(-step, Math.min(step, lvl-_rainLevel)); if(Math.abs(lvl-_rainLevel)<0.02)_rainLevel=lvl; // rampa ~1s (sem ligar "seco")
  if(_rainLevel>0.45){ _thunderCD--; if(_thunderCD<=0){ _thunderCD=200+Math.floor(rnd()*420); const inten=0.35+rnd()*0.65; _flash=Math.max(_flash,inten); ambient.thunder(inten); } } // trovão SÓ na chuva forte
  if(_flash>0) _flash=Math.max(0,_flash-0.05); }
function drawWeather(){ if(!weatherLayer)return; const g=weatherLayer; if(weatherLayer.parent===app.stage) app.stage.setChildIndex(weatherLayer, app.stage.children.length-1); g.clear();
  const W=app.screen.width, H=app.screen.height; if(_rainLevel<=0 && _flash<=0) return;
  if(_rainLevel>0){ g.beginFill(0x0a0e1a, _rainLevel*0.34); g.drawRect(0,0,W,H); g.endFill();                         // céu mais escuro
    if(!_rainDrops){ _rainDrops=[]; for(let i=0;i<110;i++)_rainDrops.push({x:rnd()*W,y:rnd()*H,len:6+rnd()*9,spd:8+rnd()*7}); }
    const mv=(phase==='playing'); g.lineStyle(1,0xaebfe0,0.5*_rainLevel); for(const d of _rainDrops){ if(mv){ d.y+=d.spd; d.x-=d.spd*0.35; if(d.y>H){ d.y=-d.len; d.x=rnd()*W; } if(d.x<0)d.x+=W; } g.moveTo(d.x,d.y); g.lineTo(d.x-2,d.y+d.len); } g.lineStyle(0); } // GAG: gotas congelam na pausa
  if(_flash>0){ g.beginFill(0xe4ecff, _flash*0.55); g.drawRect(0,0,W,H); g.endFill(); } }                            // clarão do relâmpago
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
/* Tela de título da v3 (drawTitleScene): céu em gradiente + nuvens andando dir→esq + grama pontilhada */
const titleG=new PIXI.Graphics(); app.stage.addChildAt(titleG, app.stage.getChildIndex(weatherLayer));
let titleT=0;
function drawTitleScene(){ const g=titleG; g.clear(); const W=app.screen.width,H=app.screen.height,k=H/LOGICAL_H;
  const HOR=Math.round(H*0.735);
  for(let y=0;y<HOR;y++){ const f=y/HOR; // rgb(26→58, 26→76, 58→180) — interpolação exata da v3
    g.beginFill((Math.round(26+32*f)<<16)|(Math.round(26+50*f)<<8)|Math.round(58+122*f)).drawRect(0,y,W,1).endFill(); }
  titleT++; const off=rm.parallax?0:titleT/6; // #21a: deriva sub-pixel (não mais Math.floor → sem "pula 1px a cada 6 frames")
  const cloud=(cx,cy)=>{ const x=cloudWrapX(cx*k-off, -28*k, W+28*k), s=k; // #21b: wrap pelo CORPO INTEIRO (nuvem = 28*k de largura)
    g.beginFill(0xf6f5f0).drawRect(x,cy*s,28*s,6*s).drawRect(x+6*s,(cy-4)*s,16*s,6*s).drawRect(x+2*s,(cy+6)*s,24*s,4*s).endFill(); };
  cloud(40,30); cloud(180,52); cloud(265,22); cloud(110,72);
  g.beginFill(0x3f7d20).drawRect(0,HOR,W,H-HOR).endFill();
  g.beginFill(0x2d5b16);
  for(let x=0;x<W;x+=3*k)g.drawRect(x,HOR,k,k);
  for(let x=1*k;x<W;x+=4*k)g.drawRect(x,HOR+3*k,k,k);
  for(let x=2*k;x<W;x+=5*k)g.drawRect(x,HOR+6*k,k,k);
  g.endFill(); }
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
const _parallaxTexHC={}; // cache: {mode: [tex,tex,tex]}
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
    parallaxLayers.forEach((ts,i)=>{ parallaxTexNormal[i]=texs[i]; for(const k in _parallaxTexHC)delete _parallaxTexHC[k]; if(vizMode==='normal') ts.texture=texs[i]; });
  } else parallaxLayers.forEach((ts,i)=>{ const n=[4,3,2][i], img=new Image(); // Cidade: PNG com fallback p/ placeholder
    img.onload=()=>{ if(CENARIO!==theme)return; const t=PIXI.Texture.from(img); t.baseTexture.scaleMode=PIXI.SCALE_MODES.NEAREST;
      parallaxTexNormal[i]=t; for(const k in _parallaxTexHC)delete _parallaxTexHC[k]; if(vizMode==='normal') ts.texture=t; };
    img.onerror=()=>{ if(CENARIO!==theme)return; const t=parallaxPlaceholder(i);
      parallaxTexNormal[i]=t; for(const k in _parallaxTexHC)delete _parallaxTexHC[k]; if(vizMode==='normal') ts.texture=t; };
    img.src='assets/cenarios/'+theme+'/c'+n+'.png'; });
  loadTileImages(theme).then(tiles=>{ if(CENARIO!==theme)return;
    worldCanvasNormal=worldCanvas(tiles); worldTexNormal=tex(worldCanvasNormal); _worldTexHC={}; // v3: blocos Clarity SEM recolor
    if(vizReady) reapplyVizAll(); else if(worldSprite) worldSprite.texture=worldTexNormal; });
  // (o Cenário saiu do menu de pausa — a escolha é do J1 no splash, antes de começar)
  if(_vidaReady) applyCenarioVida(); // liga/desliga carros/deco da cidade e semeia as peculiaridades do tema
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
let lqT=(()=>{ const v=parseFloat(localStorage.getItem('incl_lq')); return isFinite(v)?Math.max(0,Math.min(1,v)):0; })();
function lqCurve(t){ const N=17,a=1.3,out=[]; for(let i=0;i<N;i++){ const x=i/(N-1);
  const lin=Math.min(1,Math.max(0,a*(x-0.5)+0.5)), quad=x<0.5?2*x*x:1-2*(1-x)*(1-x);
  out.push(((1-t)*lin+t*quad).toFixed(4)); } return out.join(' '); }
function ensureLqFilter(){ let f=document.getElementById('lq-enh'); if(f)return f;
  const NS='http://www.w3.org/2000/svg', svg=document.createElementNS(NS,'svg');
  svg.setAttribute('width','0'); svg.setAttribute('height','0'); svg.setAttribute('aria-hidden','true'); svg.style.position='absolute';
  f=document.createElementNS(NS,'filter'); f.id='lq-enh'; f.setAttribute('color-interpolation-filters','sRGB');
  const ct=document.createElementNS(NS,'feComponentTransfer');
  ['feFuncR','feFuncG','feFuncB'].forEach(ch=>{ const fn=document.createElementNS(NS,ch); fn.setAttribute('type','table'); fn.setAttribute('tableValues',lqCurve(lqT)); ct.appendChild(fn); });
  f.appendChild(ct); svg.appendChild(f); document.body.appendChild(svg); return f; }
function lqFilter(){ if(lqT<=0)return ''; ensureLqFilter(); return 'url(#lq-enh)'; } // garante o nó ANTES do url() (referência solta esconderia o canvas)
function lqName(t){ return t<=0?'desligado':t<0.34?'linear':t<0.67?'misto':'quadrático'; }
function setLq(t){ lqT=Math.max(0,Math.min(1,t)); try{localStorage.setItem('incl_lq',String(lqT));}catch(e){}
  if(lqT>0){ const f=ensureLqFilter(), tv=lqCurve(lqT); f.querySelectorAll('feFuncR,feFuncG,feFuncB').forEach(fn=>fn.setAttribute('tableValues',tv)); }
  if(app&&app.view){ if(numPlayers<=1)applyVizGlobal(players[0].viz); else app.view.style.filter=lqFilter(); } } // recompõe o CSS filter
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
try{ setCenario((v=>v==='noite'?'espaco':v)(localStorage.getItem('incl_cenario')||'cidade')); }catch(e){ setCenario('cidade'); } // migra a chave antiga 'noite'
const coinCanvasNormal=coinCanvas();
const coinTex=tex(coinCanvasNormal);
// caches de modos acessíveis (preguiçosos), invalidados ao trocar de cenário (worldCanvasNormal muda)
let _worldTexHC={}, _coinTexHC={}, _lastSharedViz=null; // _lastSharedViz: cache do modo aplicado (otimização do render MP)
function worldTexFor(mode){
  if(DIRECT_CFG[mode]){ if(!_worldTexHC[mode])_worldTexHC[mode]=worldToTextureDirect(worldCanvasNormal,mode); return _worldTexHC[mode]; }
  return worldTexNormal; }
function coinTexFor(mode){
  if(DIRECT_CFG[mode]){ if(!_coinTexHC[mode])_coinTexHC[mode]=tex(directSpriteCanvas(coinCanvasNormal,mode)); return _coinTexHC[mode]; }
  return coinTex; }
function shapeTexture(id){
  const cv=makeCanvas(16,16),c=cv.getContext('2d');
  c.fillStyle='#7fdcff';c.strokeStyle='#04121a';c.lineWidth=1.5;
  const cx=8,cy=8,r=6; c.beginPath();
  switch(id){
    case 'circulo': c.arc(cx,cy,r,0,7); break;
    case 'oval': c.ellipse(cx,cy,r,r*0.66,0,0,7); break;
    case 'quadrado': c.rect(cx-r,cy-r,2*r,2*r); break;
    case 'retangulo': c.rect(cx-r,cy-r*0.6,2*r,r*1.2); break;
    case 'triangulo': c.moveTo(cx,cy-r);c.lineTo(cx+r,cy+r);c.lineTo(cx-r,cy+r);c.closePath(); break;
    case 'losango': c.moveTo(cx,cy-r);c.lineTo(cx+r,cy);c.lineTo(cx,cy+r);c.lineTo(cx-r,cy);c.closePath(); break;
    case 'paralelogramo': c.moveTo(cx-r+3,cy-r*0.6);c.lineTo(cx+r,cy-r*0.6);c.lineTo(cx+r-3,cy+r*0.6);c.lineTo(cx-r,cy+r*0.6);c.closePath(); break;
    case 'trapezio': c.moveTo(cx-r*0.5,cy-r*0.7);c.lineTo(cx+r*0.5,cy-r*0.7);c.lineTo(cx+r,cy+r*0.7);c.lineTo(cx-r,cy+r*0.7);c.closePath(); break;
    case 'pentagono': for(let i=0;i<5;i++){const a=-Math.PI/2+i*2*Math.PI/5;c[i?'lineTo':'moveTo'](cx+r*Math.cos(a),cy+r*Math.sin(a));}c.closePath(); break;
    case 'hexagono': for(let i=0;i<6;i++){const a=i*2*Math.PI/6;c[i?'lineTo':'moveTo'](cx+r*Math.cos(a),cy+r*Math.sin(a));}c.closePath(); break;
    default: c.arc(cx,cy,r,0,7);
  }
  c.fill();c.stroke(); return tex(cv);
}
const SHAPE_TEX={}; SOMASUB_SHAPES.forEach(s=>SHAPE_TEX[s.id]=shapeTexture(s.id));
function letterTexture(ch){
  const cv=makeCanvas(16,16),c=cv.getContext('2d');
  c.fillStyle='#ffd23f';c.strokeStyle='#1a1400';c.lineWidth=1.5;
  c.beginPath(); if(c.roundRect)c.roundRect(2,2,12,12,3); else c.rect(2,2,12,12); c.fill(); c.stroke();
  c.fillStyle='#1a1400';c.font='bold 11px system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';
  c.fillText(disp(ch),8,9); return tex(cv);
}
const coinContainer=new PIXI.Container(); camera.addChild(coinContainer);
let coinSprites=[];
// positionEasyCoins extraído p/ game/coins.js (Estágio 4, posicionamento — Fácil/cadeirante rebaixam a moeda).
function rebuildCoins(){
  positionEasyCoins();
  coinContainer.removeChildren().forEach(s=>s.destroy());
  coinSprites=coins.map(cn=>{
    let s;
    if(MODE==='somasub'&&cn.shape){ s=new PIXI.Sprite(SHAPE_TEX[cn.shape]); s.width=15;s.height=15; s.x=cn.x-3;s.y=cn.y-3; }
    else if(MODE==='silabas'&&cn.letter){ s=new PIXI.Sprite(letterTexture(cn.letter)); s.width=14;s.height=14; s.x=cn.x-2;s.y=cn.y-2; }
    else { s=new PIXI.Sprite(coinTexFor(vizMode)); s.x=cn.x;s.y=cn.y; }
    s.tint=ownerColors?(PCOLOR[cn.owner]||0xffffff):0xffffff; // Lote C: cor do dono (opção; solo=branco → sem alteração)
    s.visible=!cn.taken; coinContainer.addChild(s); return s;
  });
  _lastSharedViz=null; // moedas recriadas → força re-aplicar texturas por viewport no próximo draw
}
rebuildCoins();
// camada de escuridão das áreas secretas (acima de mundo/moedas, ABAIXO do player → player sempre visível)
const darkLayer=new PIXI.Container(); camera.addChild(darkLayer);
const darkRegions=buildDarkRegions().map(tiles=>{
  const gfx=new PIXI.Graphics(); gfx.beginFill(0x04060d,1);
  for(const [tx,ty] of tiles) gfx.drawRect(tx*TILE,ty*TILE,TILE,TILE);
  gfx.endFill(); darkLayer.addChild(gfx);
  return { set:new Set(tiles.map(([tx,ty])=>tx+','+ty)), gfx, announced:false };
});
const TEX={idle:tex(spriteToCanvas(PLAYER_IDLE)),walk:tex(spriteToCanvas(PLAYER_WALK)),climb:tex(spriteToCanvas(PLAYER_CLIMB)),hurt:tex(spriteToCanvas(PLAYER_HURT))};
/* E15: personagem em 3/4 (frente-direita, VIVO) — convertido de referência PixelLab v3 → procedural
   INDEXADO 23×32 (cores chapadas, sem PNG; GPL-clean). Olhos nítidos (largura natural; caixa de
   colisão segue 10×30, visual transborda). Idle respira por juice; corpo anima no andar; flip por direção. */
const PIP_W=24,PIP_H=32;
const PIP_PAL=['#fcd7ab','#e2aa86','#9d6e62','#5d2e22','#472a1e','#231c1c','#1e1011','#ff00ff','#050809','#010909'];
const PIP_IDLE=['.....99444446666888.....','...9444444444444448.....','..924444444444444488....','.9422442444444444439....','.94424222442424495338...','894444444424224495348...','964664444444444915548...','966664455444449101658...','966666595689998000859...','966659986991891000859...','96656919911011009819....','.99969111890000910119...','990099198999008998819...','902281890990001920929...','91133119889000089099....','.911111121500003409.....','....991100003330009.....','.....9821000000009......','.....999821111198.......','....92223999998429......','...9022222399823229.....','...99888822222283829....','...91118892222281008....','..9910000182224910089...','.939211001844449300829..','.9335821139999999229329.','92355589985335229999939.','939955955255552589..99..','99..99952555958129......','.....928899.9925489.....','....991999..99554339....','........................'];
const PIP_WALK=[
  ['.....5566655...........','...69344433365666......','..533344434444336......','.66224444444443466.....','.54324444443444436.....','6644442234424499346....','66466433422323999444...','66666344434434929445...','66666448944939313935...','66666659969856121945...','66666889992191000945...','6699681601102018929....','6921981999900040026....','9013891806960689926....','903382190550009905.....','.41231100220002306.....','...592100000220006.....','.....921100000006......','.....56661111186.......','....9622269999825......','....9522222992525......','....9968862222989......','....8910062222929......','.....810082222828......','.....8100922229919.....','.....9100996699914.....','.....6200092559916.....','.....5100094558988.....','.....98112989689.......','.....99889899119.......','.....9558...95554......','.....94444.............'],
  ['.....6656655...........','...68443344466665......','..933444444444336......','.98224444443344466.....','.63424444443444435.....','6544442244424499446....','65366434422413695444...','66566444434433618445...','66666449944939213845...','65656869969946122945...','66666889992191000845...','6588690911101019919....','6900881998600080026....','6012891509950499926....','813362191860005805.....','.51131100230002306.....','...992100000220019.....','.....921100000008......','.....98951111189.......','....8422299989924......','...99411222992925......','...89996992222999......','...99910082222999......','....981009222299.......','.....81009222299.......','.....89206198999.......','......9200095499.......','.....54622292499.......','.....9556999659........','.....999999.1198.......','.....9349...64444......','.....83455.............'],
  ['.....6665656...........','...96444444466665......','..633444443444446......','.55324444443444466.....','.64424444333444435.....','6644432244222369334....','66466433422413699444...','66666444444444929634...','66566339944948813934...','66666649969958121635...','66666999992081000945...','6699681922101016629....','6921991989800081016....','8002961505950499625....','903361160550005506.....','.50131110440003306.....','...861100000330004.....','.....961200000115......','.....59891111189.......','....9222266989926......','...99222222992629......','...99999992222999......','...99920060022999......','....99200610229........','....992229222299.......','.....992200999999......','.....999200925999......','.....55822292598.......','....95599999969........','....985589992289.......','....9489...933223......','....94469..............'],
  ['.....5665566...........','...98444443366666......','..644444444444446......','.96224444444444456.....','.63313444443443436.....','6543332243424469434....','65466434422324499434...','66666334444444939444...','66665349944936312934...','66666859958968122934...','66666999992081000934...','6686691611101009625....','6922991989800060015....','9013991508960699825....','903381190650006506.....','.51221110420002406.....','...992200000220006.....','.....931100000116......','......9991111169.......','.....522299899315......','...89222222992225......','...99888922222866......','...99200942222929......','....8100992222829......','....810099222298166....','....810899998899216....','....810099925999216....','....91006454459895.....','....91216355928........','.....99959992158.......','......8689.943444......','......94465............'],
  ['.....6665655...........','...56444444356665......','..633333344443446......','.86314444443444466.....','.83423434433434445.....','6633432243423399434....','66456434422413899434...','66566434434434828636...','66566349944949213935...','66666659969968111636...','66666989982091000645...','6699691922201018829....','6811991999900081016....','6002961505960499625....','603361160560005506.....','.51131100440002206.....','...981100000230015.....','.....961100000116......','.....99991111189.......','....9222296966825......','...89222222992625......','...99998922222996......','...99200932222826......','....62009922229138.....','....810099222299169....','....910699898899206....','....810099525599219....','....91008545559988.....','....82119946529........','.....99899991169.......','......9555.833323......','......95555............'],
  ['.....6556656...........','...56443344456566......','..833444444443336......','.56224444444443466.....','.64324434343444435.....','6644442244424499349....','65466444422313695444...','66566344444333619446...','66666439944939223945...','65665669969949121945...','66666899982190000845...','6699690911101019919....','6911991996600081026....','8113891609960499925....','913381191980005606.....','.51131100430002306.....','...992100000220019.....','.....821100000006......','.....99961111196.......','....9222269899924......','...99222222992625......','...99998922222995......','...89100922222929......','....92008822229215.....','....920089222299139....','....620099988999108....','....610009523399129....','....91000855249998.....','....9922299989998......','.....899999.81198......','.....99559..943445.....','.....995548............'],
];
const isPix=(ch)=>ch>='0'&&ch<='9'&&ch!=='7'; // dígito de cor válido (7 = fundo vazado, ignora); robusto p/ linhas curtas
function indexedToCanvas(rows){ const cv=makeCanvas(PIP_W,PIP_H),c=cv.getContext('2d'); for(let y=0;y<PIP_H;y++){const r=rows[y];if(!r)continue;for(let x=0;x<PIP_W;x++){const ch=r[x];if(!isPix(ch))continue;c.fillStyle=PIP_PAL[+ch];c.fillRect(x,y,1,1);}} return cv; }
function silhouetteCanvasIdx(rows){ const cv=makeCanvas(PIP_W,PIP_H),c=cv.getContext('2d'); c.fillStyle='#ffe600'; for(let y=0;y<PIP_H;y++){const r=rows[y];if(!r)continue;for(let x=0;x<PIP_W;x++){if(isPix(r[x]))c.fillRect(x,y,1,1);}} return cv; }
// FASE ATUAL: usa o PIXEL ART do PixelLab DIRETO (PNG, tamanho NATIVO de cada frame — aspect ratio
// próprio, sem padronizar). A conversão procedural (PIP_* acima) fica para uma fase posterior.
// E15: cadência de animação (ANIM) migrada p/ core/constants.js (Fase 2.16) — regulável no painel ?debug=true.
// Fonte única dos sprites: assets/sprites/menino/<animação>/<i>.png (cor, editado no Aseprite).
// Alto contraste: o quadro de cor é remapeado em tempo real para a PALETA do jogador da variação ativa (sem silhuetas _hc).
// Texturas do personagem (TEX_*/FLAVORS) migradas p/ render/sprites.js (Fase 2.17).
// E4: decoração de fundo (árvores) ATRÁS do jogador — sempre visível, NÃO some ao pular
const decoLayer=new PIXI.Container(); camera.addChild(decoLayer);
const treeCanvasNormal=treeCanvas(), treeTexNormal=tex(treeCanvasNormal); // árvore = grupo fundo (recolorida no alto contraste)
const _treeTexHC={}; function treeTexFor(mode){
  if(DIRECT_CFG[mode]){ if(!_treeTexHC[mode])_treeTexHC[mode]=directBgTexture(treeTexNormal,mode); return _treeTexHC[mode]; } // direto: decoração recua
  return treeTexNormal; }
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
const PUP_CANVAS={}, PUP_TEX={};
['superjump','ultrajump','turbo','fly','wallcling','key','runcane'].forEach(k=>{ PUP_CANVAS[k]=powerupCanvas(k); PUP_TEX[k]=tex(PUP_CANVAS[k]); });
const _pupTexHC={}; // {mode:{kind:tex}} — power-up com contorno (alto contraste direto)
function pupTexFor(kind,mode){ (_pupTexHC[mode]=_pupTexHC[mode]||{});
  if(DIRECT_CFG[mode]){ if(!_pupTexHC[mode][kind])_pupTexHC[mode][kind]=tex(directSpriteCanvas(PUP_CANVAS[kind],mode)); return _pupTexHC[mode][kind]; }
  return PUP_TEX[kind]; }
const extraLayer=new PIXI.Container(); camera.addChild(extraLayer); // power-ups + portão (atrás do player)
let powerups=[];
function rebuildExtras(){
  extraLayer.removeChildren().forEach(s=>s.destroy());
  powerups.forEach(pu=>{ const s=new PIXI.Sprite(pupTexFor(pu.kind,vizMode)); s.x=pu.x; s.y=pu.y; s.visible=!pu.taken; extraLayer.addChild(s); pu.sprite=s; });
  if(gate && !gateOpen){ const g=new PIXI.Graphics();
    const hc=!!DIRECT_CFG[vizMode]; // alto contraste: portão trancado = cor do papel "gate" (padrão magenta, customizável); normal = madeira
    const gc=HC_ROLE.gate, base=hc?((gc[0]<<16)|(gc[1]<<8)|gc[2]):0x8a5a2b, plank=hc?((((gc[0]*0.38)|0)<<16)|(((gc[1]*0.38)|0)<<8)|((gc[2]*0.38)|0)):0x5a3a1b;
    for(const k of gateTiles){ const [tx,ty]=k.split(',').map(Number); const X=tx*TILE,Y=ty*TILE;
      g.beginFill(base).drawRect(X,Y,TILE,TILE).endFill();
      g.beginFill(plank); for(let i=2;i<TILE;i+=5)g.drawRect(X+i,Y+1,2,TILE-2); g.endFill();
    }
    extraLayer.addChild(g);
  }
  _lastSharedViz=null; // power-ups/porta recriados → força re-aplicar texturas por viewport
}
function setupExtras(){
  decorSeed = (Math.random()*1e9)>>>0; // #69: nova semente por fase → a densidade escolhe superfícies diferentes a cada carga
  // itens e portão vêm das posições REAIS do mapa Clarity (não mais aleatórios)
  const _blind = modoCego || players.some(p=>{const m=VIZ_BY_KEY[p.viz];return m&&m.kind==='blind';}); // experiência de cego ativa?
  powerups = MAP_ITEMS.filter(it=> !wheelchair || it.kind==='fly'||it.kind==='turbo'||it.kind==='key') // cadeirante: só voo/super-corrida (chave mantida p/ o portão)
    .map(it=>({ x:it.tx*TILE+2, y:it.ty*TILE+2, kind:it.kind, taken:false, by:[], sprite:null })); // by[i]=1 → coletado por aquele jogador (chave é global)
  if(_blind){ const sj=powerups.find(pu=>pu.kind==='superjump'); if(sj) sj.kind='runcane'; } // cego: o item de SUPER-PULO vira a bengala de corrida (habilita correr)
  gateTiles = new Set(MAP_GATE.map(g=>g.tx+','+g.ty));
  gate = MAP_GATE.length ? MAP_GATE : null;
  gateOpen = MAP_GATE.length===0; // havendo portão, começa FECHADO (abre com a chave)
  rebuildExtras();
}
setupExtras();

// Fácil: retângulo translúcido mostrando a hitbox de coleta tolerante (sob o player)
const easyHitbox=new PIXI.Graphics(); camera.addChild(easyHitbox);
// Cadeirante: RAMPAS desenhadas sobre os degraus de 1 tile (sobre o mundo, abaixo do player)
const rampLayer=new PIXI.Graphics(); camera.addChildAt(rampLayer, camera.getChildIndex(worldSprite)+1);
function buildRamps(){ rampLayer.clear(); rampLayer.visible=wheelchair; if(!wheelchair)return;
  const sol=(x,y)=>solidTile(x,y), surf=(x,y)=> sol(x,y)&&!sol(x,y-1); // topo caminhável (solidTile já inclui lava/trampolim no cadeira → gera rampa em volta deles)
  const FILL=0x7b7f8b, EDGE=0x4a4e59, STRIPE=0xf2c200; // STRIPE = faixa amarela de acessibilidade (na superfície da rampa)
  for(let y=1;y<WORLD_H;y++)for(let x=0;x<WORLD_W-1;x++){ if(!surf(x,y))continue;
    if(surf(x+1,y-1)){ const X=(x+1)*TILE, yL=y*TILE, yU=(y-1)*TILE;                 // degrau SOBE p/ direita
      rampLayer.beginFill(FILL); rampLayer.moveTo(X-TILE,yL); rampLayer.lineTo(X,yU); rampLayer.lineTo(X,yL); rampLayer.closePath(); rampLayer.endFill();
      rampLayer.lineStyle(1,EDGE); rampLayer.moveTo(X-TILE,yL); rampLayer.lineTo(X,yU);
      rampLayer.lineStyle(2,STRIPE); rampLayer.moveTo(X-TILE,yL-1); rampLayer.lineTo(X,yU-1); rampLayer.lineStyle(0);
    } else if(surf(x+1,y+1)){ const X=(x+1)*TILE, yL=y*TILE, yD=(y+1)*TILE;          // degrau DESCE p/ direita
      rampLayer.beginFill(FILL); rampLayer.moveTo(X,yL); rampLayer.lineTo(X+TILE,yD); rampLayer.lineTo(X,yD); rampLayer.closePath(); rampLayer.endFill();
      rampLayer.lineStyle(1,EDGE); rampLayer.moveTo(X,yL); rampLayer.lineTo(X+TILE,yD);
      rampLayer.lineStyle(2,STRIPE); rampLayer.moveTo(X,yL-1); rampLayer.lineTo(X+TILE,yD-1); rampLayer.lineStyle(0);
    }
  }
  // cadeirante: LAVA (9) vira CHÃO seguro (bloco de concreto, com borda). O TRAMPOLIM (5) vira CHÃO NORMAL (José):
  // piso plano pisável, SEM contorno de bloco (era o contorno que o fazia parecer parede/"bloco acima"). Continua
  // sólido e é a base do elevador — a rampa leva o jogador do chão até ele e a cabine de vidro sobe/desce por cima.
  for(let y=0;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++){ const t=tileAt(x,y); if(t!==9&&t!==5)continue; const X=x*TILE,Y=y*TILE;
    rampLayer.beginFill(0x6f7481); rampLayer.drawRect(X,Y,TILE,TILE); rampLayer.endFill();
    rampLayer.beginFill(0x8a8f9c); rampLayer.drawRect(X,Y,TILE,3); rampLayer.endFill();               // topo claro = superfície pisável (chão)
    if(t===9){ rampLayer.lineStyle(1,0x4a4e59); rampLayer.drawRect(X+0.5,Y+0.5,TILE-1,TILE-1); rampLayer.lineStyle(0); } // só a LAVA tem borda de bloco; trampolim = chão liso
  }
  // cadeirante: PLATAFORMAS só-cadeirante (wcSolid) desenhadas como concreto (ex.: ponte que liga o elevador do corredor à escada)
  for(const k of wcSolid){ const [x,y]=k.split(',').map(Number); const X=x*TILE,Y=y*TILE;
    rampLayer.beginFill(0x6f7481); rampLayer.drawRect(X,Y,TILE,TILE); rampLayer.endFill();
    rampLayer.beginFill(0x8a8f9c); rampLayer.drawRect(X,Y,TILE,2); rampLayer.endFill();
    rampLayer.lineStyle(1,0x4a4e59); rampLayer.drawRect(X+0.5,Y+0.5,TILE-1,TILE-1); rampLayer.lineStyle(0);
  }
}
// Geometria só-cadeirante: plataformas que dão DESTINO aos elevadores (não existem no modo normal).
const WC_BRIDGES=[ {x:23,y:47},{x:24,y:47} ]; // ponte do elevador do corredor: liga o poço do trampolim B (x20-22) ao topo da escada (x25)
// WC_ELEVATORS (fossos só-cadeirante) movidos p/ game/elevators.js (Estágio 4).
function buildWcGeom(){ wcSolid=new Set(); if(!wheelchair)return; for(const b of WC_BRIDGES) wcSolid.add(b.x+','+b.y); }
buildWcGeom();
buildRamps(); // desenha as rampas + coberturas (lava, pontes) se já iniciar em modo cadeirante
// CORDAS FLUTUANTES na superfície da água (o cego atravessa por elas; visual para todos)
const ropeLayer=new PIXI.Graphics(); camera.addChildAt(ropeLayer, camera.getChildIndex(worldSprite)+1);
function buildRopes(){ ropeLayer.clear();
  for(let y=1;y<WORLD_H;y++)for(let x=0;x<WORLD_W;x++){ if(tileAt(x,y)!==3||tileAt(x,y-1)===3)continue; const X=x*TILE, Y=y*TILE+1; // topo da poça (superfície)
    ropeLayer.lineStyle(1,0xcaa96a,0.85); ropeLayer.moveTo(X,Y); ropeLayer.lineTo(X+TILE,Y); ropeLayer.lineStyle(0);
    ropeLayer.beginFill(0x8a6f3a); ropeLayer.drawRect(X+TILE/2-1,Y-1,2,2); ropeLayer.endFill(); } } // nó
buildRopes();
// ELEVADOR (cadeirante): trampolim = plataforma LARGA, escada = plataforma FINA. Toque ↑/↓ = viaja até a parada segura.
// ELEV_SPEED/elevShafts/buildElevators/elevAt extraídos p/ game/elevators.js (Estágio 4). drawElevators (cabine
// de vidro) fica aqui e lê os poços por getElevShafts(). WC_ELEVATORS foi p/ o módulo; WC_BRIDGES fica (ramps).
initElevators({ W: WORLD_W, H: WORLD_H, isWheelchair: () => wheelchair }); // liga o módulo às dims + estado
buildElevators();
const elevLayer=new PIXI.Graphics(); camera.addChildAt(elevLayer, camera.getChildIndex(worldSprite)+1);
// Estilo VIDRO PREDIAL (rodoviária/shopping/aeroporto): fosso de vidro translúcido (vê o background),
// moldura cinza/branco/azul, escada some virando blocos de elevador, e a cabine PERMANECE onde foi deixada.
function drawElevators(g){ g.clear(); if(!wheelchair)return;
  for(const s of getElevShafts()){ if(s.carY==null)s.carY=s.yBottom; for(const pl of players){ if(elevAt(pl)===s) s.carY=pl.y; } } // cabine segue quem está nela; senão fica
  const GLASS=0x9fd0e6, FRAME=0x8aa0b8, WHITE=0xeaf2f8, BLUE=0x4a78b0, INNER=0x24384d;
  for(const s of getElevShafts()){
    const x0=s.xMin*TILE, x1=(s.xMax+1)*TILE, w=x1-x0, yt=s.yTop-TILE, yb=s.yBottom, h=yb-yt; // vidro só ACIMA do chão (yBottom)
    g.beginFill(GLASS,0.14); g.drawRect(x0,yt,w,h); g.endFill();                                   // fosso de vidro (vê o background)
    for(const cx of s.cols)for(let ry=Math.floor(yt/TILE);ry<=Math.floor((yb-1)/TILE);ry++){ if(tileAt(cx,ry)!==4)continue; const X=cx*TILE,Y=ry*TILE; // ESCADA some → bloco de elevador
      g.beginFill(INNER,0.9); g.drawRect(X,Y,TILE,TILE); g.endFill(); g.beginFill(GLASS,0.22); g.drawRect(X,Y,TILE,TILE); g.endFill(); }
    g.lineStyle(1,BLUE,0.45); for(let yy=yt+TILE; yy<yb; yy+=TILE){ g.moveTo(x0,yy); g.lineTo(x1,yy); } for(let xx=x0+TILE; xx<x1; xx+=TILE){ g.moveTo(xx,yt); g.lineTo(xx,yb); } // divisões dos painéis
    g.lineStyle(2,FRAME,0.95); g.drawRect(x0,yt,w,h);                                               // contorno da estrutura
    g.lineStyle(2,WHITE,0.22); g.moveTo(x0+2,yt+h*0.6); g.lineTo(x0+w*0.55,yt+2); g.lineStyle(0);   // reflexo de vidro
    const cy=Math.round(s.carY);                                                                    // CABINE persistente
    g.beginFill(INNER,0.92); g.drawRect(x0+1,cy-15,w-2,15); g.endFill();
    g.beginFill(GLASS,0.35); g.drawRect(x0+2,cy-14,w-4,13); g.endFill();
    g.lineStyle(2,FRAME); g.drawRect(x0+1,cy-15,w-2,15); g.lineStyle(0);
    g.beginFill(0x2a3145); g.drawRect(x0,cy,w,4); g.endFill();                                      // piso da cabine
    g.beginFill(WHITE,0.85); g.drawRect(x0,cy-1,w,2); g.endFill();                                  // faixa clara
  }
  for(const pl of players){ if(pl.elevTarget==null)continue; const s=elevAt(pl); if(!s)continue; const y=Math.round(pl.y), up=pl.elevTarget<y, ax=(s.xMin*TILE+(s.xMax+1)*TILE)/2, ay=up?y-9:y+11; // seta de destino
    g.beginFill(0xf2c200); g.moveTo(ax,ay+(up?-4:4)); g.lineTo(ax-4,ay); g.lineTo(ax+4,ay); g.closePath(); g.endFill(); }
}
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
const LIFE_KINDS=[
  {k:'pombo', tex:'pombo', spd:0.15, peck:true, fly:true, alpha:0.95},
  {k:'gato',  tex:'gato',  spd:0.30, alpha:0.9},
  {k:'cao',   tex:'cao',   spd:0.35, alpha:0.9,  street:true},
  {k:'adulto',tex:null,   spd:0.25, alpha:0.8,  street:true}, // silhueta 16×32 (ADULT_TEX, 6 formatos M/F)
];
let creatures=[], _lifeSpawnT=0;
function inDark(tx,ty){ for(const r of darkRegions){ if(r.set.has(tx+','+ty))return true; } return false; } // célula de área secreta?
function lifeSurfaceAt(tx){ for(let ty=3;ty<WORLD_H-1;ty++){ if(solidAt(tx,ty)&&!solidAt(tx,ty-1)&&tileAt(tx,ty-1)!==3&&tileAt(tx,ty)!==9&&tileAt(tx,ty-1)!==9&&!inDark(tx,ty-1)) return ty; } return -1; } // superfície AO AR LIVRE (fora das secretas), a MAIS ALTA; ty-1!==9 = nada spawna DENTRO da lava
function lifeSurfaceLowAt(tx){ for(let ty=WORLD_H-2;ty>3;ty--){ if(solidAt(tx,ty)&&!solidAt(tx,ty-1)&&tileAt(tx,ty-1)!==3&&tileAt(tx,ty)!==9&&tileAt(tx,ty-1)!==9&&!inDark(tx,ty-1)) return ty; } return -1; } // idem, a MAIS BAIXA (calçada/fachada); ty-1!==9 = fora da lava
let _streetCols=null; // colunas ABERTAS da rua/fachada (superfície mais baixa, fora das secretas) — computadas 1×
function streetCols(){ if(_streetCols)return _streetCols; _streetCols=[];
  for(let tx=2;tx<WORLD_W-2;tx++){ const ty=lifeSurfaceLowAt(tx); if(ty>0&&ty*TILE>WORLD_PX_H*0.55)_streetCols.push([tx,ty]); }
  return _streetCols; }
function spawnCreature(force){ if(creatures.length>=10)return false;
  const pl=players[randInt(0,Math.max(0,numPlayers-1))]||players[0], ptx=Math.floor(pl.x/TILE);
  const K=LIFE_KINDS[[0,0,0,1,2,3][randInt(0,5)]]; // pombos com peso 3× ("cadê os pombos no chão?")
  if(K.street&&CENARIO!=='cidade')return false; // adultos/cães são vida URBANA; campo/floresta ficam com bichos + borboletas
  let tx,ty,fade=0;
  if(K.street){ // cães e adultos: banda baixa; CÃO de preferência perto de uma ÁRVORE (pedido do José)
    if(K.k==='cao'&&decoSprites.length&&rnd()<0.8){ const tr=decoSprites[randInt(0,decoSprites.length-1)];
      tx=Math.floor(tr.x/TILE)+(rnd()<0.5?-1:1)*randInt(1,3); if(tx<1||tx>=WORLD_W-1)return false;
      ty=lifeSurfaceLowAt(tx); if(ty<0)return false; fade=30; }
    else { const open=streetCols().filter(([cx])=>Math.abs(cx-ptx)<=22); if(!open.length)return false;
      [tx,ty]=open[randInt(0,open.length-1)]; fade=30; } } // rua: coluna aberta da fachada (pode ser visível → FADE-IN)
  else { tx=ptx+(rnd()<0.5?-1:1)*(Math.floor(LOGICAL_W/TILE/2)+2+randInt(0,5));
    if(tx<1||tx>=WORLD_W-1)return false; ty=lifeSurfaceAt(tx); if(ty<0)return false;
    if(CENARIO==='cidade' && ty*TILE>=WORLD_PX_H*0.55)return false; } // cidade: gatos e pombos SÓ nas partes ALTAS
  const tex2 = K.k==='adulto' ? ADULT_TEX[randInt(0,ADULT_TEX.length-1)] : LIFE_TEX[K.tex]; // adulto sorteia 1 dos 6 formatos
  const s=new PIXI.Sprite(tex2[0]); s.anchor.set(0.5,1); s.alpha=fade?0:K.alpha; lifeLayer.addChild(s);
  creatures.push({K,tex2,s,fade,x:tx*TILE+8,y:ty*TILE,dir:rnd()<0.5?-1:1,animT:0,f:0,state:'walk',stateT:0,vy:0});
  return true; }
function stepLife(dt){
  if(rm.decor){ if(creatures.length){ creatures.forEach(c=>c.s.destroy()); lifeLayer.removeChildren(); creatures=[]; } return; }
  if(++_lifeSpawnT>=60){ _lifeSpawnT=0; spawnCreature(); }
  for(let i=creatures.length-1;i>=0;i--){ const c=creatures[i], K=c.K;
    if(c.fade>0){ c.fade=Math.max(0,c.fade-dt); c.s.alpha=K.alpha*(1-c.fade/30); } // fade-in (spawn na rua pode ser visível)
    c.animT+=dt; if(c.animT>=12){ c.animT=0; c.f=1-c.f; }
    if(c.state==='fly'){ c.y+=c.vy*dt; c.x+=c.dir*0.9*dt; c.vy=Math.max(-1.6,c.vy-0.04*dt); c.s.texture=LIFE_TEX.pomboFly[c.f]; }
    else if(c.state==='peck'){ if((c.stateT-=dt)<=0)c.state='walk'; c.s.texture=LIFE_TEX.pombo[1]; }
    else { c.x+=c.dir*K.spd*dt;
      const ty=Math.floor(c.y/TILE), nx=Math.floor((c.x+c.dir*6)/TILE);
      if(nx<1||nx>=WORLD_W-1||!solidAt(nx,ty)||solidAt(nx,ty-1)||tileAt(nx,ty-1)===9) c.dir*=-1; // beirada/parede/LAVA à frente: meia-volta
      if(K.peck&&rnd()<0.004){ c.state='peck'; c.stateT=30; }
      c.s.texture=c.tex2[c.f]; }
    if(K.fly&&c.state!=='fly'){ for(const pl of players){ if(Math.abs(pl.x-c.x)<34&&Math.abs(pl.y-c.y)<26){ c.state='fly'; c.vy=-1.2; c.dir=(c.x<pl.x?-1:1); break; } } } // revoada cosmética
    c.s.x=Math.round(c.x); c.s.y=Math.round(c.y); c.s.scale.x=c.dir<0?-1:1;
    let near=false; for(const pl of players){ if(Math.abs(pl.x-c.x)<LOGICAL_W*1.6&&Math.abs(pl.y-c.y)<LOGICAL_H*1.6){near=true;break;} }
    if(!near||c.y<-30||c.x<8||c.x>WORLD_PX_W-8){ c.s.destroy(); lifeLayer.removeChild(c.s); creatures.splice(i,1); }
  } }
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
let cars=[], _carT=0; const STREET_Y=WORLD_PX_H;
const SEM={x:0,y:0,state:'green',t:0,pole:null};
function drawSemaforo(){ const g=SEM.pole; if(!g)return; g.clear(); const x=SEM.x,y=SEM.y; // 2× (proporção dos carros 3×)
  g.beginFill(0x3a4152).drawRect(x-2,y-52,4,52).endFill();
  g.beginFill(0x20242e).drawRect(x-8,y-86,16,36).endFill();
  const on={red:0xff4b3a,yellow:0xffd23f,green:0x37e15b}, ys={red:-82,yellow:-71,green:-60};
  for(const k of ['red','yellow','green']) g.beginFill(SEM.state===k?on[k]:0x11141c).drawRect(x-4,y+ys[k],8,8).endFill(); }
function initTraffic(){ SEM.x=Math.round(WORLD_PX_W/2); SEM.y=STREET_Y;
  SEM.pole=new PIXI.Graphics(); carLayer.addChild(SEM.pole); drawSemaforo();
  const g=new PIXI.Graphics(); carLayer.addChild(g); // placas de PARE ao longo da rua da frente (2×)
  for(let tx=6;tx<WORLD_W-6;tx+=14){ const X=tx*TILE; if(Math.abs(X-SEM.x)<48)continue;
    g.beginFill(0x8a919f).drawRect(X,STREET_Y-28,2,28).endFill();
    g.beginFill(0xd23a2e).drawRect(X-5,STREET_Y-42,12,14).endFill();
    g.beginFill(0xffffff).drawRect(X-3,STREET_Y-37,8,3).endFill(); } }
function spawnCar(){ if(cars.length>=3)return false; const dir=rnd()<0.5?1:-1;
  const s=new PIXI.Sprite(CAR_TEX[randInt(0,CAR_TEX.length-1)]); s.anchor.set(0.5,1); s.scale.x=dir; // textura já é 3× nativa
  s.y=STREET_Y; const x=dir>0?-90:WORLD_PX_W+90; s.x=x; if(_frontDim){ s.tint=0x4a5058; s.alpha=0.55; } carLayer.addChild(s);
  cars.push({s,x,dir,vx:dir*1.4}); return true; }
// Alto contraste: carros/placas/semáforo estão NA FRENTE mas são AMBIENTE — escurecem como o fundo
// para não competir com plataformas/itens (pedido do José 2026-07-03).
let _frontDim=false;
function setFrontDim(on){ _frontDim=!!on; const t=on?0x4a5058:0xffffff, a=on?0.55:1;
  carLayer.children.forEach(ch=>{ ch.tint=t; ch.alpha=a; }); }
function stepTraffic(dt){ if(CENARIO!=='cidade')return; // L6: trânsito é peculiaridade da Cidade
  SEM.t+=dt; const cyc=(SEM.t/60)%16, st=cyc<8?'green':cyc<10?'yellow':'red';
  if(st!==SEM.state){ SEM.state=st; drawSemaforo(); }
  if(rm.decor){ if(cars.length){ cars.forEach(c=>{ carLayer.removeChild(c.s); c.s.destroy(); }); cars=[]; } return; } // semáforo (sinalização) fica; carros (movimento) saem
  if(++_carT>=420+randInt(0,300)){ _carT=0; spawnCar(); }
  for(let i=cars.length-1;i>=0;i--){ const c=cars[i];
    const before=(SEM.x-c.x)*c.dir>44; let want=c.dir*1.4;                        // linha de parada (carro 3× = 78px)
    if(SEM.state!=='green'&&before&&(SEM.x-c.x)*c.dir<140) want=0;                // vermelho/amarelo: freia na aproximação
    c.vx+=Math.max(-0.08,Math.min(0.08,want-c.vx))*dt; if(want===0&&Math.abs(c.vx)<0.03)c.vx=0;
    c.x+=c.vx*dt; c.s.x=Math.round(c.x);
    if(c.x<-100||c.x>WORLD_PX_W+100){ c.s.destroy(); carLayer.removeChild(c.s); cars.splice(i,1); } } }
initTraffic();
/* ===================== L5: DECORAÇÃO POR ZONA (procedural, desenhada UMA vez) =====================
   Rua: calçada+meio-fio, postes com brilho ESTÁVEL, placas (PARE/faixa), letreiros nas fachadas.
   Caixa d'água: paredes de tanque + linha d'água. Interior de prédio (alto): janelas.
   Secretas (darkRegions): entulho/viga/pichação — desenhados ABAIXO do darkLayer (só aparecem revelados). */
const cityDecoG=new PIXI.Graphics(); lifeLayer.addChildAt(cityDecoG,0); // atrás dos bichos, à frente do mundo
const abandonG=new PIXI.Graphics(); camera.addChildAt(abandonG, camera.getChildIndex(darkLayer)); // SOB a escuridão
function buildCityDeco(){ const g=cityDecoG; g.clear(); const a=abandonG; a.clear();
  // ---- FACHADA (banda MAIS BAIXA, por onde o personagem anda): calçada + postes + letreiros.
  // Placas de PARE saíram daqui → moram na rua da FRENTE (initTraffic), junto dos carros (R-cidade).
  const BASE_TY=WORLD_H-9;
  for(let tx=1;tx<WORLD_W-1;tx++){ const ty=lifeSurfaceAt(tx); if(ty<BASE_TY)continue; const X=tx*TILE, y=ty*TILE;
    g.beginFill(0x9aa0ad,0.9).drawRect(X,y,TILE,2).endFill();            // calçada clara
    g.beginFill(0x565e70,1).drawRect(X,y+2,TILE,1).endFill();            // meio-fio
    if(tx%11===4){ g.beginFill(0x3a4152).drawRect(X+7,y-30,2,30).endFill(); g.beginFill(0x3a4152).drawRect(X+7,y-30,8,2).endFill(); // poste + braço
      g.beginFill(0xffe9a8,1).drawRect(X+13,y-29,3,3).endFill(); g.beginFill(0xffe9a8,0.18).drawRect(X+9,y-31,11,8).endFill(); }   // lâmpada + halo FIXO
    if(tx%9===2 && solidAt(tx,ty-3)){ const c=[0x37c9a0,0xff8c5a,0x64b0ff,0xffd23f][tx%4];                                          // letreiro na fachada
      g.beginFill(0x141824).drawRect(X+2,y-3.5*TILE,12,6).endFill(); g.beginFill(c,1).drawRect(X+3,y-3.5*TILE+1,10,4).endFill();
      g.beginFill(c,0.15).drawRect(X,y-3.5*TILE-2,16,10).endFill(); } }                                                             // brilho estável (sem piscar)
  // ---- CAIXA D'ÁGUA: paredes metálicas nas bordas do corpo d'água + linha d'água no topo
  let wx0=1e9,wx1=-1,wy0=1e9,wy1=-1;
  for(let ty=0;ty<WORLD_H;ty++)for(let tx=0;tx<WORLD_W;tx++){ if(tileAt(tx,ty)===3){ wx0=Math.min(wx0,tx);wx1=Math.max(wx1,tx);wy0=Math.min(wy0,ty);wy1=Math.max(wy1,ty); } }
  if(wx1>=0){ const X0=wx0*TILE,X1=(wx1+1)*TILE,Y0=wy0*TILE,Y1=(wy1+1)*TILE;
    g.beginFill(0x6a7486,0.85).drawRect(X0-3,Y0-6,3,Y1-Y0+6).drawRect(X1,Y0-6,3,Y1-Y0+6).endFill(); // paredes do tanque
    for(let ry=Y0;ry<Y1;ry+=12){ g.beginFill(0x49515f).drawRect(X0-3,ry,3,2).drawRect(X1,ry,3,2).endFill(); } // rebites
    g.beginFill(0xbfe6ff,0.5).drawRect(X0,Y0,X1-X0,1.5).endFill(); }                                  // linha d'água
  // (Janelas do "interior de prédio" removidas — não faziam sentido; R-cidade do José 2026-07-03.)
  // ---- ABANDONADO (darkRegions): entulho, viga e pichação — sob a escuridão
  for(const reg of darkRegions){ for(const key of reg.set){ const [tx,ty]=key.split(',').map(Number); const X=tx*TILE,Y=ty*TILE, h=(tx*13+ty*7)%10;
    if(solidAt(tx,ty+1)&&h<3){ a.beginFill(0x555b66).drawRect(X+2,Y+TILE-5,7,5).endFill(); a.beginFill(0x434955).drawRect(X+7,Y+TILE-3,6,3).endFill(); } // entulho
    else if(h===4){ a.beginFill(0x6b4e2e,0.9).drawRect(X,Y+3,TILE,3).endFill(); }                                                                          // viga exposta
    else if(h===7){ const c=[0xc94fd6,0x4fd67a,0xd6c94f][tx%3]; a.beginFill(c,0.55).drawRect(X+3,Y+6,9,2).drawRect(X+5,Y+9,6,2).endFill(); } } }          // pichação
}
buildCityDeco();
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
function applyCenarioVida(){ const city=CENARIO==='cidade';
  carLayer.visible=city; cityDecoG.visible=city; skyLayer.visible=city; // trânsito/deco/céu-da-cidade SÓ na Cidade
  if(!city&&cars.length){ cars.forEach(c=>{ carLayer.removeChild(c.s); c.s.destroy(); }); cars=[]; } }
_vidaReady=true; applyCenarioVida(); // estado inicial (CENARIO já veio do setCenario do boot)
/* ===================== Tiles vivos da v3 (água FORE + lava) — drawTile animado, fiel ===================== */
const lavaFxG=new PIXI.Graphics(); lifeLayer.addChildAt(lavaFxG,0);   // tracinhos da lava (ATRÁS do player, como o map-back)
const waterFxG=new PIXI.Graphics(); decoLayer.addChild(waterFxG);     // corais/algas/peixes no BACKGROUND (camada das árvores — pedido do José; ficam atrás de player E carros)
function stepTileFx(){ lavaFxG.clear(); waterFxG.clear();
  if(DIRECT_CFG[vizMode]||rm.decor) return; // HC repinta o mundo (color-blocking); viewDecor off na v3 = só a base estática
  const t=fxClock, seen=new Set();
  for(const pl of players){ if(pl.quit)continue;
    const camX=Math.max(0,Math.min(pl.x-LOGICAL_W/2,WORLD_PX_W-LOGICAL_W)), camY=Math.max(0,Math.min((pl.y-BOX.h/2)-LOGICAL_H/2,WORLD_PX_H-LOGICAL_H));
    const tx0=Math.max(0,Math.floor(camX/TILE)-1), tx1=Math.min(WORLD_W-1,Math.floor((camX+LOGICAL_W)/TILE)+1);
    const ty0=Math.max(0,Math.floor(camY/TILE)-1), ty1=Math.min(WORLD_H-1,Math.floor((camY+LOGICAL_H)/TILE)+1);
    for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){ const tt=tileAt(tx,ty); if(tt!==3&&tt!==9)continue;
      const k=tx+','+ty; if(seen.has(k))continue; seen.add(k); const X=tx*TILE,Y=ty*TILE;
      if(tt===9){ const off=(Math.floor(t/8)+X)%4; // lava v3: tracinhos claros que derivam
        lavaFxG.beginFill(0xff7755).drawRect(X+off,Y+3,3,1).drawRect(X+((off+6)%TILE),Y+8,3,1).endFill(); continue; }
      // ÁGUA v3: ondulação verde sutil que deriva
      waterFxG.beginFill(0x46a078,0.12).drawRect(X,Y+7+Math.round(2*Math.sin(tx*1.3+t*0.04)),TILE,2).endFill();
      if(tileAt(tx,ty-1)!==3){ const off=Math.sin(t*0.05+X*0.1)>0?1:0; // linha de superfície SÓ na borda de cima
        waterFxG.beginFill(0xffffff,0.35).drawRect(X+off,Y+1,TILE-off,1).endFill(); }
      if(solidAt(tx,ty+1)){ const h=(tx*2654435761)>>>0, kind=h%3; // leito: coral / algas (determinísticos por coluna)
        if(kind===0){ waterFxG.beginFill([0xe8743b,0xf2c14e,0x8c2f39][(h>>>3)%3])
          .drawRect(X+6,Y+9,2,7).drawRect(X+4,Y+10,2,4).drawRect(X+9,Y+8,2,5).drawRect(X+3,Y+12,1,2).drawRect(X+11,Y+11,1,2).endFill(); }
        else if(kind===1){ waterFxG.beginFill(0x3fae6a); const sway=2*Math.sin(t*0.06+tx); // algas balançando
          for(let a2=0;a2<9;a2++){ waterFxG.drawRect(X+7+Math.round(sway*(a2/9)),Y+15-a2,1,1);
            if(a2%2===0)waterFxG.drawRect(X+9+Math.round(sway*(a2/9)),Y+15-a2,1,1); } waterFxG.endFill(); } }
      else { const fh=(tx*40503+ty*12289)>>>0; // água aberta: peixinho esparso nadando (com olho!)
        if(fh%7===0){ const fx2=X+6+Math.round(5*Math.sin(t*0.04+tx+ty)), fy2=Y+7+Math.round(2*Math.sin(t*0.07+ty));
          const dir=Math.cos(t*0.04+tx+ty)>=0?1:-1;
          waterFxG.beginFill([0xe5484d,0x3a6ea5,0x48b06a][fh%3]).drawRect(fx2,fy2,3,2).drawRect(fx2-dir,fy2,1,2).endFill();
          waterFxG.beginFill(0xffffff,1).drawRect(fx2+(dir>0?2:0),fy2,1,1).endFill(); } } } }
}
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
let gameHudEl=null, vpHudDom=[], vpQuitDom=[], vpScreens=[], vpPause=[], pauseActor=0;
// Menu de pausa POR TELA (Etapa 2): um por jogador, dentro da .player-screen dele.
const PM_BTNS=[ {act:'resume',lbl:'▶ Continuar'},{act:'letra',lbl:'🔠 ABC',letra:true},{act:'tipo',lbl:'🔤 Tipografia'},{act:'addplayer',lbl:'👥 Adicionar jogador'},{act:'audio',lbl:'🦻 Acessibilidade auditiva'},{act:'motora',lbl:'♿ Acessibilidade motora'},{act:'anim',lbl:'🎞 Sensibilidade visual'},{act:'visual',lbl:'🎨 Acessibilidade visual'},{act:'empatia',lbl:'🫂 Modo empatia'},{act:'ajuda',lbl:'❓ Ajuda'},{act:'print',lbl:'📷 Print (ver a tela)'},{act:'quit',lbl:'🚪 Sair do jogo'} ];
// Barra de atalhos de a11y no topo da pausa (por tela). Sons (cego/TTS) só com saída própria; webcam/voz em construção.
const PAUSE_ICONS=[ {k:'blind',e:'🦯',n:'Modo cego (navegação sonora)'},{k:'tts',e:'🗨️',n:'Narração por voz (TTS)'},{k:'libras',e:'🤟',n:'Modo pessoa surda (Libras)'},{k:'tea',e:'🧩',n:'Modo TEA (calmo / silencioso)'},{k:'altmove',e:'🦾',n:'Teclas de alternância'},{k:'contrast',e:'🌗',n:'Alto contraste'},{k:'cvd',e:'🚥',n:'Correção de daltonismo (protan/deutan/tritan)'},{k:'face',e:'🧑',n:'Webcam — rosto',soon:true},{k:'eyes',e:'👀',n:'Webcam — olhos',soon:true},{k:'voice',e:'👄',n:'Comando de voz',soon:true} ];
let calmMode=0; // 0=normal · 1=calmo (reduz) · 2=silencioso (desliga) — nunca mexe em TTS/modo cego
function buildScreenPause(i){ const sp=document.createElement('div'); sp.className='screen-pause'; sp.hidden=true; sp.dataset.player=String(i);
  const icons=PAUSE_ICONS.map(ic=>'<button class="pi-btn'+(ic.soon?' pi-soon':'')+'" type="button" data-pi="'+ic.k+'" aria-label="'+ic.n+(ic.soon?' (em construção)':'')+'">'+ic.e+'</button>').join('');
  sp.innerHTML='<div class="pause-card" role="dialog" aria-modal="true" aria-label="Menu de pausa do jogador '+(i+1)+'">'+
    '<div class="pause-icons" role="group" aria-label="Atalhos de acessibilidade">'+icons+'</div><p class="pause-icons-cap" aria-live="polite"></p>'+
    '<h2><span data-i18n="pause.title">'+i18n.t('pause.title')+'</span>'+(numPlayers>1?' · Jogador '+(i+1):'')+'</h2><div class="pause-menu" role="menu">'+
    PM_BTNS.map(b=>{ const dyn=b.letra||b.nivel; const lbl=b.nivel?('📚 Nível '+quizLevel+' · '+QL_NAME[quizLevel]):(dyn?b.lbl:i18n.t('pause.'+b.act)); return '<button class="pm-btn'+(b.letra?' pm-letra':'')+(b.nivel?' pm-nivel':'')+'" role="menuitem" type="button" data-act="'+b.act+'"'+(dyn?'':(' data-i18n="pause.'+b.act+'"'))+'>'+lbl+'</button>'; }).join('')+
    '</div><p class="pause-legend" aria-hidden="true"></p></div>';
  sp.addEventListener('click',(e)=>{ const b=e.target.closest('.pm-btn'); if(b){ pauseActor=i; const act=b.dataset.act; if(pauseActs[act])pauseActs[act](); return; }
    const ib=e.target.closest('.pi-btn'); if(ib){ pauseActor=i; iconAct(ib.dataset.pi,i); reflectPauseIcons(); const cp=sp.querySelector('.pause-icons-cap'); if(cp)cp.textContent=ib.getAttribute('aria-label')||''; } });
  const cap=sp.querySelector('.pause-icons-cap');
  sp.querySelectorAll('.pi-btn').forEach(b=>{ const show=()=>{ cap.textContent=b.getAttribute('aria-label')||''; }; // legenda = aria-label (reflete o estado on/off atual)
    b.addEventListener('mouseenter',show); b.addEventListener('focus',show); });
  return sp; }
function hasPrivateOutput(i){ if(numPlayers<=1)return true; const p=players[i]; if(!p||!p.audioSink)return false; return !players.some((q,j)=>j!==i&&q&&q.audioSink===p.audioSink); }
function applyCalm(){ const scene=calmMode>=1; RM_KEYS.forEach(k=>{ rm[k]=scene; }); if(typeof saveRM==='function')saveRM();
  players.forEach(p=>RM_CHAR.forEach(c=>{ p[c.prop]=(calmMode===2); })); // silencioso congela o personagem também
  ['ambient','music','earcons','other','interact'].forEach(k=>{ if(audioCat[k]){ if(calmMode===0){audioCat[k].on=true;} else if(calmMode===1){audioCat[k].on=true;audioCat[k].vol=Math.min(audioCat[k].vol,0.3);} else {audioCat[k].on=false;} if(typeof setCatGain==='function')setCatGain(k); } }); } // TTS/sonar/guarda/guia intactos
function iconAct(k,i){ const ic=PAUSE_ICONS.find(x=>x.k===k);
  if(ic&&ic.soon){ srAlert(ic.n+': em construção — chega com os subsistemas de webcam/fala e o filtro de daltonismo.'); return; }
  if((k==='blind'||k==='tts')&&!hasPrivateOutput(i)){ srAlert('Só dá para mexer em som/TTS/modo cego com uma saída de áudio SÓ sua (não compartilhada). Escolha um dispositivo próprio em A12e auditiva.'); return; }
  if(k==='blind'){ setModoCego(!modoCego); srSay('Modo cego '+(modoCego?'ligado.':'desligado.')); }
  else if(k==='tts'){ audioCat.tts.on=!audioCat.tts.on; if(typeof setCatGain==='function')setCatGain('tts'); if(typeof reflectTTS==='function')reflectTTS(); srSay('Narração '+(audioCat.tts.on?'ligada.':'desligada.')); }
  else if(k==='libras'){ toggleLibras(); srSay('Modo pessoa surda: Libras '+(vlibrasOpen()?'ligado.':'desligado.')); } // abre/fecha o intérprete VLibras
  else if(k==='tea'){ calmMode=(calmMode+1)%3; applyCalm(); srSay('Modo TEA: '+['off','calmo','silencioso'][calmMode]+'.'); }
  else if(k==='altmove'){ if(typeof setToggleMove==='function')setToggleMove(i,!players[i].toggleMove); }
  else if(k==='contrast'){ const cur=(players[i]||{}).viz; let idx=HC_SEQ.indexOf(cur); idx=idx<0?0:idx; const nx=HC_SEQ[(idx+1)%HC_SEQ.length]; setPlayerViz(i,nx); srSay('Alto contraste: '+HC_LABEL[nx]+'.'); }
  else if(k==='cvd'){ const seq=['normal','fix-protan','fix-deuter','fix-tritan']; let idx=seq.indexOf((players[i]||{}).viz); idx=idx<0?1:(idx+1)%seq.length; setPlayerViz(i,seq[idx]); srSay('Correção de daltonismo: '+['off','protanopia','deuteranopia','tritanopia'][idx]+'.'); }
}
// Legenda do botão refletindo o ESTADO atual (on/off ou o nível). Vira o aria-label e o rodapé de legenda.
function iconLabel(k,i){ const ic=PAUSE_ICONS.find(x=>x.k===k); if(!ic)return '';
  if(ic.soon) return ic.n+' (em construção)';
  const p=players[i]||{};
  if(k==='blind')   return 'Modo cego (navegação sonora): '+(modoCego?'on':'off');
  if(k==='tts')     return 'Narração por voz (TTS): '+((audioCat.tts&&audioCat.tts.on)?'on':'off');
  if(k==='libras')  return 'Modo pessoa surda (Libras): '+(vlibrasOpen()?'on':'off');
  if(k==='tea')     return 'Modo TEA: '+['off','calmo','silencioso'][calmMode];
  if(k==='altmove') return 'Teclas de alternância: '+(p.toggleMove?'on':'off');
  if(k==='contrast'){ return 'Alto contraste: '+(HC_LABEL[p.viz]||'off'); }
  if(k==='cvd'){ const map={'fix-protan':'protanopia','fix-deuter':'deuteranopia','fix-tritan':'tritanopia'}; return 'Correção de daltonismo: '+(map[p.viz]||'off'); }
  return ic.n; }
function reflectIconBtn(b,i){ const k=b.dataset.pi; let on=false,dis=false; // aplica o estado visual a UM ícone (pausa OU splash)
  b.classList.remove('pi-calm','pi-cvd-protan','pi-cvd-deuter','pi-cvd-tritan');
  if(k==='blind'){ on=modoCego; dis=!hasPrivateOutput(i); }
  else if(k==='tts'){ on=!!(audioCat.tts&&audioCat.tts.on); dis=!hasPrivateOutput(i); }
  else if(k==='libras'){ on=vlibrasOpen(); }
  else if(k==='tea'){ on=(calmMode===2); if(calmMode===1)b.classList.add('pi-calm'); } // TEA: 1=redução (branco, .pi-calm) · 2=desligamento completo (amarelo, .pi-on) · 0=off (base)
  else if(k==='altmove'){ on=!!(players[i]&&players[i].toggleMove); }
  else if(k==='contrast'){ on=/^hc-direto/.test((players[i]||{}).viz||''); }
  else if(k==='cvd'){ const v=(players[i]||{}).viz||''; if(v==='fix-protan')b.classList.add('pi-cvd-protan'); else if(v==='fix-deuter')b.classList.add('pi-cvd-deuter'); else if(v==='fix-tritan')b.classList.add('pi-cvd-tritan'); } // fundo bicolor = o próprio sinal de ativo; off=base
  b.classList.toggle('pi-on',on); b.classList.toggle('pi-dis',dis);
  const active=on||b.classList.contains('pi-calm')||/pi-cvd-/.test(b.className); b.setAttribute('aria-pressed',String(active));
  if(!(PAUSE_ICONS.find(x=>x.k===k)||{}).soon) b.setAttribute('aria-label',iconLabel(k,i)); }
function reflectPauseIcons(){ vpPause.forEach((sp,i)=>{ sp.querySelectorAll('.pi-btn').forEach(b=>reflectIconBtn(b,i)); }); }
function reflectTitleIcons(){ const ti=$('#title-icons'); if(ti)ti.querySelectorAll('.pi-btn').forEach(b=>reflectIconBtn(b,0)); } // ícones do SPLASH (escopo do J1) — antes NÃO refletiam (bug do toggle TEA)
// Contêiner "tela do jogador" por viewport (Etapa 1): hospeda o HUD; nas próximas etapas, a pausa e os menus.
function screenRect(i){ const cols=numPlayers<=1?1:(numPlayers<=2?numPlayers:2), rows=numPlayers<=2?1:2;
  const col=i%cols, row=Math.floor(i/cols); let colFrac=col/cols;
  if(numPlayers===3 && i===2) colFrac=(1-1/cols)/2; // 3 telas: a 3ª centralizada na linha de baixo (casa com o render)
  return { L:(colFrac*100)+'%', T:(row/rows*100)+'%', W:(100/cols)+'%', H:(100/rows)+'%' }; }
function buildGameHud(){ if(!gameHudEl) gameHudEl=$('#game-hud'); if(!gameHudEl)return; gameHudEl.innerHTML=''; vpHudDom=[]; vpQuitDom=[]; vpScreens=[]; vpPause=[];
  for(let i=0;i<Math.max(1,numPlayers);i++){ const r=screenRect(i);
    const scr=document.createElement('div'); scr.className='player-screen'; scr.dataset.player=String(i); scr.style.left=r.L; scr.style.top=r.T; scr.style.width=r.W; scr.style.height=r.H;
    const d=document.createElement('div'); d.className='vphud';
    d.innerHTML='<span class="vphud-coins"><b class="vphud-ico">🪙</b> <b class="vphud-n">0</b> / '+COIN_TARGET+'</span><span class="vphud-power"><b class="vphud-ico">✨</b> <span class="vphud-pw">—</span></span>';
    scr.appendChild(d); vpHudDom.push(d);
    const q=document.createElement('div'); q.className='vphud-quit'; q.hidden=true; q.textContent='Jogo abandonado'; scr.appendChild(q); vpQuitDom.push(q);
    const sp=buildScreenPause(i); scr.appendChild(sp); vpPause.push(sp);
    gameHudEl.appendChild(scr); vpScreens.push(scr); }
  // reflete ABC + legenda sim/não nos menus recém-criados (no 1º build do init, LETRA/PAD_DESIGNS ainda estão
  // em TDZ — o try/catch ignora; applyLetra/applyPadDesign preenchem logo depois no fluxo de init).
  try{ applyLetra(false); }catch(e){}
  try{ renderPauseLegend(); }catch(e){}
}
function updateGameHud(){ for(let i=0;i<vpHudDom.length;i++){ const p=players[i]; if(!p)continue; const d=vpHudDom[i];
  const n=d.querySelector('.vphud-n'); if(n)n.textContent=String(p.collected); const pw=d.querySelector('.vphud-pw'); if(pw)pw.textContent=POWER_SHORT[p.activePower]||'—';
  if(vpQuitDom[i])vpQuitDom[i].hidden=!p.quit; if(d)d.style.visibility=p.quit?'hidden':'visible'; } } // jogador que saiu: tela preta "jogo abandonado"
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
    const cols=numPlayers<=2?numPlayers:2, rows=numPlayers<=2?1:2;
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

/* ===================== física (por jogador — E11) ===================== */
function sampleFeatures(pl){
  const l=pl.x-BOX.w/2,r=pl.x+BOX.w/2,t=pl.y-BOX.h,b=pl.y;
  let water=false,ladder=false,lava=false;
  for(let ty=Math.floor(t/TILE);ty<=Math.floor((b-0.01)/TILE);ty++)
    for(let tx=Math.floor(l/TILE);tx<=Math.floor((r-0.01)/TILE);tx++){
      const tt=tileAt(tx,ty); if(tt===3)water=true; if(tt===4)ladder=true; if(tt===9)lava=true; if(tt===5&&wheelchair)ladder=true; // cadeirante: trampolim = elevador (↑/↓)
    }
  if(wheelchair && elevAt(pl)) ladder=true; // cadeirante: toda a coluna do poço "segura" o jogador (plataforma), sem gravidade
  return {water,ladder,lava};
}
function resolveX(pl){
  const l=pl.x-BOX.w/2,r=pl.x+BOX.w/2,t=pl.y-BOX.h,b=pl.y;
  const c0=Math.floor(l/TILE),c1=Math.floor((r-0.01)/TILE),r0=Math.floor(t/TILE),r1=Math.floor((b-0.01)/TILE);
  for(let row=r0;row<=r1;row++)for(let col=c0;col<=c1;col++){ if(!solidAt(col,row))continue;
    if(wheelchair && isWcRampRiser(col,row))continue; // cadeirante: degrau com rampa não é parede — a rampa guia o Y
    const tl=col*TILE;
    if(pl.vx>0)pl.x=tl-BOX.w/2-0.01; else if(pl.vx<0)pl.x=tl+TILE+BOX.w/2+0.01;
    pl.vx=0; return;
  }
}
function resolveY(pl){
  const l=pl.x-BOX.w/2,r=pl.x+BOX.w/2,t=pl.y-BOX.h,b=pl.y;
  const c0=Math.floor(l/TILE),c1=Math.floor((r-0.01)/TILE),r0=Math.floor(t/TILE),r1=Math.floor((b-0.01)/TILE);
  for(let row=r0;row<=r1;row++)for(let col=c0;col<=c1;col++){ if(!solidAt(col,row))continue;
    const tt=row*TILE,type=tileAt(col,row);
    if(pl.vy>0){ pl.y=tt-0.01;
      if(type===5&&!wheelchair){ pl.vy = pl.easy ? -EASY.tramp : -(held(pl,'jump')?TUNE.trampMax:TUNE.trampBase); } // Fácil: quique suave. Cadeirante: sem quique (é elevador)
      else { pl.vy=0; pl.onGround=true; }
    } else if(pl.vy<0){ pl.y=tt+TILE+BOX.h+0.01; pl.vy=0; }
    return;
  }
}
function triggerLava(pl){
  if(pl.hurtTimer>0)return;
  setCoins(pickCoins(COIN_TARGET, coinPools())); rebuildCoins();
  players.forEach(p=>p.collected=0); collected=0; updateHud();
  earcons.sfx('hurt'); pl.hurtTimer=60; pl.vy=-10; pl.vx=(rnd()<0.5?-1:1)*5;
  addShake(3,14); addHitstop(4); // JUICE: dano é o impacto mais forte do jogo
  srAlert('Cuidado! Tocou na lava. As moedas voltaram para posições aleatórias.');
}
function stepPlayer(pl,dt){
  if(pl.quiz||pl.quit||pl.waiting)return; // em desafio; abandonou; ou ESPERANDO apertar um botão para entrar
  const run=held(pl,'run') && !pl.easy && !pl.toggleMove && (!caneOn(pl)||!!pl.runCane), turbo=pl.activePower==='turbo'; // cego só corre com a bengala de corrida
  let dir;
  if(pl.toggleMove){ // movimento por alternância (1 dedo): tocar trava a direção; segurar acelera
    if(pl.leftEdge)  pl.walkDir = pl.walkDir===-1?0:-1;   // toque inverte/para
    if(pl.rightEdge) pl.walkDir = pl.walkDir=== 1?0: 1;
    dir=pl.walkDir;
    const holding=(dir===-1&&held(pl,'left'))||(dir===1&&held(pl,'right'));
    pl.vx=dir*TUNE.hWalk*(holding?2/3:1/3);               // segurando = 2/3 · travado = 1/3
  } else {
    dir=(held(pl,'right')?1:0)-(held(pl,'left')?1:0); // Fácil: sem correr
    pl.vx=dir*(pl.easy?TUNE.hWalk*EASY.speed:(run?(turbo?TUNE.hTurbo:TUNE.hRun):TUNE.hWalk)); // E18: super-corrida (turbo); Fácil: andar ×0.7
  }
  if(dir!==0)pl.facing=dir; pl.leftEdge=false; pl.rightEdge=false;
  const feat=sampleFeatures(pl); pl.inWater=feat.water; pl.onLadder=feat.ladder;
  if(pl.hurtTimer>0)pl.hurtTimer-=dt;
  if(feat.lava && !pl.easy && !wheelchair && !modoCego) triggerLava(pl); // Fácil, cadeirante e CEGO: imunidade (lava vira chão)
  if(pl.jumpEdge)pl.jumpBuffer=7; else if(pl.jumpBuffer>0)pl.jumpBuffer--;
  // E18: ventosa (homem-aranha) — gruda na parede ao apertar Correr no ar; solta com Pular
  if(pl.clinging && (pl.onLadder||pl.inWater||pl.activePower!=='wallcling' || pl.onGround || clingSides(pl).D)) pl.clinging=false; // E18d: pés numa superfície estável (sólido logo abaixo) ENCERRAM; pendurado no teto (pés p/ cima) ou na parede alta continua
  if(pl.activePower==='wallcling' && !pl.clinging && pl.runEdge && !pl.onGround && !pl.onLadder && !pl.inWater && firstClingSide(pl)){ pl.clinging=true; pl.clingN=firstClingSide(pl); pl.vy=0; pl.vx=0; pl.jumpBuffer=0; earcons.sfx('power'); srSay('Modo aranha! Engatinha em paredes e teto; contorna quinas. Correr solta.'); }
  else if(pl.clinging && pl.runEdge){ pl.clinging=false; earcons.sfx('power'); srSay('Soltou da superfície.'); } // E18b: CANCELA só com Correr (não com Pular); a caixa não larga a superfície antes disso
  if(!pl.clinging) pl.clingN=null;
  // TROCAR PODER / SONAR: tap curto no swap = troca poder; SEGURAR o swap ou o acorde swap+especial = SONAR (F3).
  const doSwap=()=>{ if(!pl.owned.length)return; const seq=['off',...pl.owned]; let idx=seq.indexOf(pl.activePower); pl.activePower=seq[(idx+1)%seq.length];
    pl.clinging=false; pl.flying=false; earcons.sfx('power'); showPower(pl); srSay(pl.activePower==='off'?'Sem poder ativo.':(POWER_MSG[pl.activePower]||'Poder ativado!')); };
  const swapNow=held(pl,'swap');
  if(swapNow){ pl._swapT+=dt;
    if(!pl._swapSonar && (pl._swapT>18 || held(pl,'especial'))){ pl._swapSonar=true; nav.sonar(pl); } // segurar ~0,3s OU acorde swap+especial
  } else { if(pl._swapDown && !pl._swapSonar) doSwap(); pl._swapT=0; pl._swapSonar=false; } // soltou após tap curto → troca
  pl._swapDown=swapNow;
  // ESPECIAL: ação ainda não implementada (stub — apenas registra o gatilho)
  if(pl.specialEdge){ /* TODO: ação especial por poder/contexto */ }
  pl.jumpEdge=false; pl.runEdge=false; pl.swapEdge=false; pl.specialEdge=false;
  // E16c: voo é ALTERNADO pelo Pulo NO AR (com o poder ativo): pula no ar → liga; pula voando → desliga.
  // Tocar o solo ou a água também encerra. (Antes ligava ao coletar; agora exige o pulo no ar.)
  if(pl.activePower==='fly' && pl.jumpBuffer>0 && !pl.onGround){ pl.flying=!pl.flying; pl.jumpBuffer=0; earcons.sfx('power'); srSay(pl.flying?'Voo ativado! Cima/Baixo sobem e descem; Pular encerra.':'Voo encerrado.'); }
  if(pl.flying && (pl.onGround||pl.inWater||pl.activePower!=='fly')) pl.flying=false;
  let fired=false;
  if(pl.clinging){
    const sp=TUNE.climbSpeed; // E18c: movimento TANGENTE à face; a caixa fica colada até cancelar com Correr
    if(pl.clingN==='R')pl.facing=1; else if(pl.clingN==='L')pl.facing=-1;   // E18e: ALPINISMO — vira de frente PARA a parede
    if(pl.clingN==='U'||pl.clingN==='D'){ pl.vy=0; const h=held(pl,'left')?-1:held(pl,'right')?1:0; pl.vx=h*sp; if(h)pl.facing=h; } // teto/chão: anda na horizontal
    else { pl.vx=0; pl.vy = held(pl,'up')?-sp : held(pl,'down')?sp : 0; }                                        // parede: sobe/desce
  } else if(pl.onLadder){
    pl.vy=0;
    if(wheelchair){ // ELEVADOR: toque ↑/↓ = viaja sozinho até a parada segura (topo/base); andar p/ L/R numa parada sai
      const s=elevAt(pl);
      if(s){ if(pl.elevTarget==null && pl.y>s.yBottom+0.5) pl.y=s.yBottom; // DESAFUNDA: parado, cola no topo (yBottom) — a rampa deixava uns px dentro do tile
        if(held(pl,'up')&&s.yTop<pl.y-0.5) pl.elevTarget=s.yTop; else if(held(pl,'down')&&s.yBottom>pl.y+0.5) pl.elevTarget=s.yBottom;
        if((held(pl,'left')||held(pl,'right'))){ const col=held(pl,'right')?s.xMax+1:s.xMin-1, row=Math.floor(pl.y/TILE); if(surfTop(col,row)||surfTop(col,row+1)) pl.elevTarget=null; } } // sai p/ o piso ao lado, mesmo 1 tile ABAIXO (trampolim-bloco sobre o chão)
      if(pl.elevTarget!=null){ const dy=pl.elevTarget-pl.y;
        if(Math.abs(dy)<=ELEV_SPEED){ pl.y=pl.elevTarget; pl.vy=0; pl.elevTarget=null; } else pl.vy=Math.sign(dy)*ELEV_SPEED; }
    } else {
      if(held(pl,'up'))pl.vy=-TUNE.climbSpeed; else if(held(pl,'down'))pl.vy=TUNE.climbSpeed;
      if(pl.jumpBuffer>0){ pl.vy=(pl.activePower==='ultrajump')?-TUNE.ultraJumpVel:jumpVel(pl,pl.activePower==='superjump'?9:5); pl.onLadder=false; pl.jumpBuffer=0; earcons.sfx('jump'); hideTips(); }
    }
  } else if(pl.flying){ // voo ATIVO: Cima sobe / Baixo desce / plana parado. Pular alterna (tratado acima)
    pl.waterStroke=0; const fs=turbo?3.9:2.6;
    if(held(pl,'up')) pl.vy=-fs; else if(held(pl,'down')) pl.vy=fs; else pl.vy*=0.7;
    pl.vy=Math.max(-fs,Math.min(fs,pl.vy));
  } else {
    const g = (pl.inWater?0.10:TUNE.gravity)*(pl.easy?EASY.grav:1); // Fácil: gravidade ×2/3
    if(!(pl.onGround&&pl.vy>=0)) pl.vy += g*dt;
    if(pl.easy && held(pl,'jump') && pl.vy>EASY.slowFall && !pl.inWater) pl.vy=EASY.slowFall; // Fácil: segurar pulo = flutua descendo
    if(pl.inWater){
      if(held(pl,'jump')){ if(pl.waterStroke<=0){ pl.vy-=run?TUNE.waterJumpRun:TUNE.waterJump; pl.waterStroke=TUNE.waterStrokeFrames; } }
      else pl.waterStroke=0;
      if(pl.waterStroke>0)pl.waterStroke-=dt;
      pl.vy=Math.min(pl.vy,TUNE.waterMaxFall);
    } else {
      pl.waterStroke=0;
      if(pl.onGround&&pl.jumpBuffer>0&&!wheelchair){ // E18: pulo encadeado (bunny-hop). Cadeirante: sem pulo.
        if(run && isBouncyGroundBelow(pl) && pl.jumpChain>0) pl.jumpChain=Math.min(pl.jumpChain+1,3); else pl.jumpChain=1;
        pl.vy = (pl.activePower==='ultrajump') ? -TUNE.ultraJumpVel : jumpVel(pl, pl.activePower==='superjump'?9:[0,5,8,9][pl.jumpChain]);
        pl.onGround=false; pl.jumpBuffer=0; fired=true; earcons.sfx('jump'); hideTips();
        setSquash(pl,0.16); puffDust(pl.x,pl.y,3); // JUICE: estica ao saltar + poeira do impulso
      }
      pl.vy=Math.min(pl.vy,TUNE.maxFall);
    }
  }
  // Proteção de borda (Fácil e alternância) — andar não derruba em fosso; só cai segurando ↓ (não vale na água/escada/voo/aranha)
  if((pl.easy||pl.toggleMove||wheelchair) && pl.onGround && pl.vx!==0 && !held(pl,'down') && !pl.inWater && !pl.onLadder && !pl.flying && !pl.clinging){
    const dirX=pl.vx>0?1:-1, leadX=pl.x+dirX*(BOX.w/2)+pl.vx*dt, leadTx=Math.floor(leadX/TILE), belowTy=Math.floor((pl.y+1)/TILE);
    const grounded = solidAt(leadTx,belowTy) || (wheelchair && solidAt(leadTx,belowTy+1)); // cadeirante: rampa = chão a até 1 tile abaixo (não é fosso)
    if(!grounded) pl.vx=0;
  }
  const _preX=pl.x, _preY=pl.y;
  pl.x+=pl.vx*dt; resolveX(pl);
  // Cadeirante: anda COLADO na superfície da rampa 45° (sobe e desce a diagonal desenhada), em vez do antigo empurrão
  const _ry = (wheelchair && !pl.onLadder && !pl.inWater && !pl.flying) ? rampSurfaceY(pl.x, pl.y) : null;
  if(_ry!=null && Math.abs(_ry-pl.y)<=TILE+4 && (_ry<pl.y || pl.onGround)){
    pl.y=_ry; pl.vy=0; pl.onGround=true;                 // superfície da rampa (subindo sempre; descendo só se já apoiado)
  } else {
    pl.onGround=false; pl._fallV=pl.vy; pl.y+=pl.vy*dt; resolveY(pl); // _fallV: velocidade ANTES do resolve (p/ juice de pouso)
  }
  if(pl.clinging) spiderReattach(pl,_preX,_preY); // E18c: mantém contato e contorna quinas (parede↔teto↔topo)
  if(pl.onGround && pl.airTime>6 && !pl.inWater){ const v=pl._fallV||0; // JUICE: pouso após queda real (airTime ainda é o valor do ar)
    if(v>1.2){ puffDust(pl.x,pl.y,Math.min(8,2+Math.round(v))); setSquash(pl,-0.08-0.03*v); if(v>=TUNE.maxFall*0.85)addShake(2.5,10); } }
  if(pl.onGround && !fired){ if(++pl.groundIdle>10)pl.jumpChain=0; } else pl.groundIdle=0; // zera cadeia parado
  if(pl.onGround) pl.airTime=0; else pl.airTime+=dt; // E16: tempo no ar (estabiliza anim — onGround pisca ao repousar)
  // F2: passos por superfície · escada (madeira) · escalada (parede). Cadência = ritmo do andar/correr.
  if(!pl.inWater){
    if(caneOn(pl)){ if(pl.airTime<=5){ // modo cego: chão ESTÁVEL (coyote) evita o flicker do onGround
      if(dir!==0){ pl.caneDist=(pl.caneDist||0)+Math.abs(pl.vx*dt); if(pl.caneDist>=caneBlockPx()){ pl.caneDist=0; nav.caneTap(pl); } } // ANDANDO: batida por DISTÂNCIA
      else { pl.caneDist=0; if(held(pl,'run')){ pl.stepT+=dt; if(pl.stepT>=25){ pl.stepT=0; nav.caneTap(pl); } } else pl.stepT=99; } } } // PARADO: sem batida; segurar corrida = sondagem (batida no chão à frente)
    else if(pl.onGround && dir!==0){ const cad=(held(pl,'run')&&!pl.easy&&!pl.toggleMove)?11:17; pl.stepT+=dt; if(pl.stepT>=cad){ pl.stepT=0; const m=surfaceUnder(pl); if(m)noiseHit(m);
      if(run)puffDust(pl.x-pl.facing*5,pl.y,2); } } } // normal: passo no chão sob os pés · JUICE: correndo levanta poeira nos calcanhares
  else if(pl.onLadder && pl.vy!==0){ pl.stepT+=dt; if(pl.stepT>=20){ pl.stepT=0; noiseHit('madeira'); } }
  else if(pl.clinging && (pl.vx!==0||pl.vy!==0)){ pl.stepT+=dt; if(pl.stepT>=16){ pl.stepT=0; noiseHit('parede'); } }
  else if(pl.inWater && caneOn(pl)){ nav.waterNav(pl); } // NADO CEGO: guia por contato (paredes/chão/superfície-cordas)
  else pl.stepT=99; // parado → próximo passo soa logo ao recomeçar
  // F3: guarda de beirada — bipa ao caminhar em direção a um fosso (só quando a visão está comprometida: blind/baixa visão)
  if(nav.needsAudioCues(pl) && pl.onGround && dir!==0 && !pl.inWater && !pl.onLadder && !pl.flying && !pl.clinging){
    const leadTx=Math.floor((pl.x+dir*(BOX.w/2+TILE*0.5))/TILE), belowTy=Math.floor((pl.y+1)/TILE);
    if(!solidAt(leadTx,belowTy)){ pl.guardT+=dt; if(pl.guardT>=9){ pl.guardT=0; tonePan(760,0.06,'guard',nav.panFor((leadTx+0.5)*TILE,pl),0.16,'square',nav.playerCtx(pl)); } } else pl.guardT=99;
  } else pl.guardT=99;
  if(pl.y-BOX.h>WORLD_PX_H+40){ pl.x=SPAWN_X; pl.y=SPAWN_Y; pl.vx=pl.vy=0; }
  // coletar (P1 abre quiz nos modos didáticos; MP é Lúdico). Fácil: hitbox de coleta +4px por lado.
  const pad=pl.easy?EASY.pad:0;
  const box={x:pl.x-BOX.w/2-pad,y:pl.y-BOX.h-pad,w:BOX.w+2*pad,h:BOX.h+2*pad};
  coins.forEach((cn,i)=>{ if(cn.taken||cn.owner!==pl.i)return; // Lote C: só coleta os itens da SUA cor
    const big=(MODE!=='ludico'); const sz=big?15:9, ox=big?3:0;
    if(box.x<cn.x+sz-ox&&box.x+box.w>cn.x-ox&&box.y<cn.y+sz-ox&&box.y+box.h>cn.y-ox){
      if(MODE==='somasub'&&cn.shape){ if(!pl.quiz) openQuiz(pl,i,cn.shape); }       // L3: quiz POR JOGADOR (MP incluso)
      else if(MODE==='silabas'&&cn.letter){ if(!pl.quiz) openSilabas(pl,i,cn.letter); }
      else { takeCoin(cn); coinSprites[i].visible=false; pl.collected++; if(pl===player)collected=pl.collected; earcons.sfx('coin'); // some p/ todas as telas (item tem 1 dono)
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
  stepLife(dt); // L5: vida ambiente (pombos/gatos/cães/adultos) — cosmética, atrás do player
  stepTraffic(dt); // L5: carros (frente, na rua da base) + semáforo
  sceneSky.stepSky(dt); // L5: nuvens + pássaros no céu
  sceneSky.stepV3Decor(); // L6: decoração viva da v3 (estrelas/nuvens/pássaros/névoa/grama/minhocas/vagalumes/borboletas)
  stepTileFx(); // tiles vivos da v3: água (ondas/corais/algas/peixes, FORE) + lava (tracinhos)
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
    for(let j=0;j<coinSprites.length;j++){ const s=coinSprites[j]; if(s)s.alpha=shimOn?0.8+0.2*Math.sin(fxClock*0.12+j*1.7):1; }
    const {camX,camY}=placeCam(players[0]);
    markSeen(camX,camY); redrawMinimapIfDirty();
    drawMinimapPlayer(players[0].x, players[0].y - BOX.h/2);
  } else {
    // Otimização: se TODOS estão no mesmo modo (caso comum), troca as texturas UMA vez; senão, por viewport.
    const v0=players[0].viz, allSame=players.every(p=>p.viz===v0), anyOverlay=players.some(p=>{const m=VIZ_BY_KEY[p.viz];return m&&m.kind==='lowvision';});
    if(allSame) applySharedTextures(v0);
    for(let i=0;i<numPlayers;i++){ const viz=players[i].viz;
      if(!allSame) applySharedTextures(viz);                      // só troca por viewport quando os modos diferem
      for(let j=0;j<coinSprites.length;j++){ const s=coinSprites[j]; if(!s)continue; const cn=coins[j]; s.visible=!cn.taken;
        s.alpha=((cn.owner===i)?1:0.4)*(shimOn?0.8+0.2*Math.sin(fxClock*0.12+j*1.7):1); } // Lote C: item alheio esmaecido (cor do dono); JUICE: cintilar multiplicativo
      for(const pu of powerups){ if(pu.sprite)pu.sprite.visible=!puTaken(pu,i); }                            // chave some p/ todos; demais são por jogador
      placeCam(players[i]); app.renderer.render(camera,{renderTexture:vpTex[i]});
      if(anyOverlay) renderVpOverlay(i,viz);                      // passada extra só se algum jogador está em baixa visão
    }
  }
  drawWeather(); // chuva/clarão em tela-espaço, sobre tudo
  updateGameHud(); // HUD por jogador (moedas + poder) em DOM sobreposto (alta definição)
}

/* ===================== Soma-Sub: quiz (DOM, acessível) ===================== */
function quizWho(pl){ return numPlayers>1?('Jogador '+(pl.i+1)+': '):''; } // L3: prefixo nas falas do quiz em MP
function _mkChoices(answer,lo,hi){ const set=[String(answer)]; let g=0;
  while(set.length<9&&g++<400){ const s=String(randInt(lo,hi)); if(!set.includes(s))set.push(s); }
  return shuffle(set); }
function openQuiz(pl,coinIndex,shapeId){ // MATEMÁTICA: gerador POR ATIVIDADE (menu inicial); grade de 9
  const A=ACTIVITY, base={kind:'somasub',coinIndex,shape:shapeId,sel:0,tries:0,revealed:false}; let q,fala;
  if(A==='mat1'){ const n=randInt(1,9); // QUANTIDADE: bolinhas → número (grade fixa 1..9)
    q={...base,dots:n,answer:String(n),prob:'Quantas bolinhas?',choices:['1','2','3','4','5','6','7','8','9']};
    fala='Quantas bolinhas você vê?'; }
  else if(A==='mat2'){ const a=randInt(0,5),b=randInt(0,5); // SOMA FÁCIL: parcelas 0..5
    q={...base,prob:`${a} + ${b} = ?`,answer:String(a+b),choices:_mkChoices(a+b,0,10)};
    fala=`Quanto é ${a} mais ${b}?`; }
  else if(A==='mat4'){ const op=rnd()<0.5?'+':'−'; let a,b,ans; // SOMA E SUBTRAÇÃO 2: guarda na cabeça + dedos
    if(op==='+'){a=randInt(0,10);b=randInt(0,10);ans=a+b;} else {a=randInt(0,20);b=randInt(0,Math.min(10,a));ans=a-b;}
    q={...base,prob:`${a} ${op} ${b} = ?`,answer:String(ans),choices:_mkChoices(ans,0,20)};
    fala=`Quanto é ${a} ${op==='+'?'mais':'menos'} ${b}?`; }
  else if(A==='mat5'||A==='mat6'){ const on = tabSel.length ? tabSel[randInt(0,tabSel.length-1)] : 2; // número LIGADO (entra em qualquer posição)
    if(A==='mat5'){ // TABUADA: multiplicando E multiplicador de 0..10; o nº ligado pode ser qualquer um dos dois
      const other=randInt(0,10); let a,b; if(rnd()<0.5){a=on;b=other;}else{a=other;b=on;}
      q={...base,prob:`${a} × ${b} = ?`,answer:String(a*b),choices:_mkChoices(a*b,0,100)};
      fala=`Quanto é ${a} vezes ${b}?`; }
    else { // DIVISÃO inteira: divisor E quociente de 0..10 (divisor ≥1, sem ÷0); o nº ligado pode ser qualquer um dos dois
      const other=randInt(0,10); let divisor,quo;
      if(on===0){ quo=0; divisor=randInt(1,10); }                         // 0 só pode ser QUOCIENTE (0 ÷ divisor = 0)
      else if(rnd()<0.5){ quo=on; divisor=Math.max(1,other); }            // ligado = quociente
      else { divisor=on; quo=other; }                                     // ligado = divisor
      const dividend=divisor*quo;
      q={...base,prob:`${dividend} ÷ ${divisor} = ?`,answer:String(quo),choices:_mkChoices(quo,0,10)};
      fala=`Quanto é ${dividend} dividido por ${divisor}?`; } }
  else if(ACTIVITIES[A]&&ACTIVITIES[A].dens){ const dens=ACTIVITIES[A].dens; // FRAÇÕES (soma/sub; NOTAÇÃO sorteada entre as ligadas)
    const D=dens.reduce((l,d)=>l*d/gcd(l,d),1);
    let d1=dens[randInt(0,dens.length-1)], d2=dens[randInt(0,dens.length-1)], op=rnd()<0.5?'+':'−';
    let n1=randInt(1,d1), n2=randInt(1,d2);
    if(op==='−' && n1*(D/d1)<n2*(D/d2)){ const t1=n1,td=d1; n1=n2; d1=d2; n2=t1; d2=td; } // sem resultado negativo
    const N=op==='+'? n1*(D/d1)+n2*(D/d2) : n1*(D/d1)-n2*(D/d2);
    const ligadas=Object.keys(fracNot).filter(k=>fracNot[k]); const not=ligadas[randInt(0,ligadas.length-1)]||'v';
    const keyOf=v=>fmtFrac(v,D,'d');          // chave canônica REDUZIDA (compara a resposta), independe da notação
    // José: "gráficos SUBSTITUEM números" → cada operando/opção exibe GRÁFICO (fatias da atividade) OU número (sorteio)
    const dispChoice=v=>{ const g=fracGraphic(v,D); return (g&&rnd()<0.5)?g:fmtFrac(v,D,not); };
    const dispOp=(nn,dd)=>{ const g=fracGraphic(nn,dd); return (g&&rnd()<0.5)?g:fmtFrac(nn,dd,not); };
    const ansKey=keyOf(N), seen=new Set([ansKey]), vals=[N]; let gd=0; // 9 respostas DISTINTAS (por chave) → matriz 3×3
    while(vals.length<9&&gd++<400){ const v=randInt(0,4*D), kk=keyOf(v); if(!seen.has(kk)){ seen.add(kk); vals.push(v); } }
    const choices=shuffle(vals).map(v=>({key:keyOf(v), disp:dispChoice(v)}));
    q={...base,not,prob:`<span class="frac-op">${dispOp(n1,d1)}</span> ${op} <span class="frac-op">${dispOp(n2,d2)}</span> = ?`,answer:ansKey,choices};
    fala=`Quanto é ${fracSpeak(n1+'/'+d1)} ${op==='+'?'mais':'menos'} ${fracSpeak(n2+'/'+d2)}?`; }
  else { // SOMA E SUBTRAÇÃO 1 (padrão — dá para fazer nos dedos): soma ≤10, minuendo ≤10
    const op=rnd()<0.5?'+':'−'; let a,b,ans;
    if(op==='+'){a=randInt(0,9);b=randInt(0,10-a);ans=a+b;} else {a=randInt(0,10);b=randInt(0,a);ans=a-b;}
    q={...base,prob:`${a} ${op} ${b} = ?`,answer:String(ans),choices:_mkChoices(ans,0,10)};
    fala=`Quanto é ${a} ${op==='+'?'mais':'menos'} ${b}?`; } // sem o nome da forma
  pl.quiz=q; pl.vx=0;pl.vy=0;
  srSay(quizWho(pl)+fala);
  renderQuiz(pl);
}
let _recentWords=[]; // NÃO REPETIR a mesma palavra por 5 rounds (José): distância mínima de repetição = 5
function pickWord(letter){ const byL=SILABAS_WORDS.filter(w=>w.w[0]===letter);
  let cands=byL.filter(w=>!_recentWords.includes(w.w));                          // prefere a letra da moeda, sem repetir
  if(!cands.length)cands=SILABAS_WORDS.filter(w=>!_recentWords.includes(w.w));   // sem a letra, mas GARANTE não-repetição (15 palavras > 5)
  if(!cands.length)cands=byL.length?byL:SILABAS_WORDS;                           // salvaguarda
  const item=cands[randInt(0,cands.length-1)];
  _recentWords.push(item.w); if(_recentWords.length>5)_recentWords.shift();      // janela dos últimos 5
  return item; }
function openSilabas(pl,coinIndex,letter){ // L3: despacha pelo NÍVEL (1..5); modo cego mantém o ditado passivo (a11y)
  const cego = blindMode || modoCego || (VIZ_BY_KEY[(pl&&pl.viz)||'']||{}).kind==='blind';
  if(cego){ openBraille(pl,coinIndex,letter); return; } // E8: ditado de Braille
  if(quizLevel===1){ openPre(pl,coinIndex,letter); return; }
  if(quizLevel>=4){ openAlf(pl,coinIndex,letter); return; }
  const item=pickWord(letter);
  const correct=item.s.slice(), distract=[];
  for(const sy of shuffle(SILABA_POOL)){ if(distract.length>=7)break; if(!correct.includes(sy)&&!distract.includes(sy))distract.push(sy); }
  pl.quiz={kind:'silabas',hearSyl:(quizLevel===2),coinIndex,letter,word:item.w,emoji:item.e,correct,options:shuffle(correct.concat(distract)),boxes:[null,null],sel:0,tries:0,revealed:false}; // hearSyl: Descobrindo sílabas (nível 2) fala a sílaba no hover/seleção; Montando (3) não
  pl.vx=0;pl.vy=0;
  srSay(`${quizWho(pl)}Letra ${disp(item.w[0])}. Monte a palavra: ${item.w}.`); // letra da PRÓPRIA palavra (o não-repetir pode trocar a letra da moeda)
  gameSay(item.w); // ao abrir, fala a palavra SEMPRE (independente do toggle TTS) — José
  renderQuiz(pl);
}
// Nível 1 — pré-silábico: qual das 3 escritas é a certa? O jogo SOLETRA a opção sob o cursor.
function openPre(pl,coinIndex,letter){
  const item=pickWord(letter);
  const opts=[item.w]; // correta = palavra normal; 3 distratores de FERREIRO (símbolo/repetidas/emoji-no-meio/tamanho)
  for(const d of shuffle(ferreiroDistractors(item))){ if(opts.length>=4)break; if(!opts.includes(d))opts.push(d); }
  let guard=0; while(opts.length<4&&guard++<20){ const d=ferreiroDistractors(item)[randInt(0,3)]; if(!opts.includes(d))opts.push(d); }
  pl.quiz={kind:'pre',coinIndex,word:item.w,emoji:item.e,choices:shuffle(opts),sel:0,tries:0,revealed:false};
  pl.vx=0;pl.vy=0;
  srSay(`${quizWho(pl)}${item.w}. Qual é a escrita certa? O jogo soletra cada opção.`);
  gameSay(item.w); // fala o nome da imagem SEMPRE (independente do toggle TTS) — José
  renderQuiz(pl); quizSpeakSel(pl);
}
// Níveis 4/5 — escritor: montar a palavra LETRA a letra numa grade; 5 dita a cela Braille de cada letra.
function openAlf(pl,coinIndex,letter){
  const item=pickWord(letter);
  const need=[...new Set(item.w.split(''))], extra=[];
  for(const ch of shuffle('abcdefghijlmnoprstuvz'.split(''))){ if(need.length+extra.length>=12)break; if(!need.includes(ch)&&!extra.includes(ch))extra.push(ch); } // grade de 12 letras (espec do José)
  pl.quiz={kind:'alf',braille:quizLevel===5,coinIndex,word:item.w,emoji:item.e,
    options:shuffle(need.concat(extra)),boxes:Array(item.w.length).fill(null),sel:0,tries:0,revealed:false};
  pl.vx=0;pl.vy=0;
  srSay(`${quizWho(pl)}Escreva a palavra: ${item.w}. ${item.w.length} letras.`);
  renderQuiz(pl); quizSpeakSel(pl);
}
function quizSpeakSel(pl){ const q=pl.quiz; if(!q)return; // fala o item sob o cursor CONFORME O NÍVEL
  if(q.sel<0){ srSay(disp(q.word)); gameSay(q.word); return; } // cursor na PALAVRA do topo → fala a palavra
  if(q.kind==='pre'){ srSay(soletra(q.choices[q.sel])); return; }
  const N=q.options?q.options.length:0;
  if(q.sel>=N){ srSay(q.sel===N?'apagar':'ok'); return; }
  const it=q.options[q.sel];
  if(q.kind==='silabas'){ if(q.hearSyl){ srSay(disp(it)); gameSay(it); }                          // Descobrindo sílabas (2): sílaba INTEIRA, áudio SEMPRE (gameSay)
    else { srSay(soletra(it)); tts.narrate(soletra(it)); } }                                           // Montando (3): SOLETRA as letras, áudio só com TTS ligado (narrate)
  else if(q.kind==='alf') srSay(q.braille?brailleText(it):(LETTER_NAME[it]||it)); // 4 nome da letra · 5 SÓ os pontos da cela ("a"→"um")
}
function placeLetter(pl,ch){ const q=pl.quiz; if(!q)return; const idx=q.boxes.indexOf(null); if(idx<0)return;
  q.boxes[idx]=ch; earcons.sfx('place'); srSay(q.braille?brailleText(ch):(LETTER_NAME[ch]||ch)); renderQuiz(pl); } // braille: só os PONTOS
function eraseLastLetter(pl){ const q=pl.quiz; if(!q)return; for(let i=q.boxes.length-1;i>=0;i--){ if(q.boxes[i]!==null){ q.boxes[i]=null; break; } } renderQuiz(pl); }
function placeSilaba(pl,sy){ const q=pl.quiz; if(!q)return; const idx=q.boxes[0]===null?0:(q.boxes[1]===null?1:-1); if(idx<0)return; q.boxes[idx]=sy; earcons.sfx('place');
  if(q.hearSyl){ srSay(disp(sy)); gameSay(sy); } else { srSay(soletra(sy)); tts.narrate(soletra(sy)); } // Descobrindo: confirmação + refala a sílaba (sempre); Montando: SOLETRA as letras (só c/ TTS)
  renderQuiz(pl); }
function eraseLastSilaba(pl){ const q=pl.quiz; if(!q)return; if(q.boxes[1]!==null)q.boxes[1]=null; else if(q.boxes[0]!==null)q.boxes[0]=null; renderQuiz(pl); }
// E8: ditado de Braille (modo pessoa cega) — dita os pontos da cela por letra
function openBraille(pl,coinIndex,letter){
  const item=pickWord(letter);
  const cells=item.w.split('').map(ch=>({l:ch,dots:BRAILLE[ch]||[],text:brailleText(ch)}));
  pl.quiz={kind:'braille',coinIndex,letter,word:item.w,emoji:item.e,cells,revealed:false};
  pl.vx=0;pl.vy=0; renderQuiz(pl); announceBraille(pl);
}
function announceBraille(pl){ const q=pl.quiz; if(!q||q.kind!=='braille')return;
  srAlert(`${quizWho(pl)}${q.word}. `+q.cells.map(c=>`${c.l}: ${c.text}.`).join(' ')+' Pule para coletar.'); }
// choice pode ser STRING (matemática simples) ou {key,disp} (frações: gráfico OU número). key compara; disp exibe.
function cKey(c){ return (c&&typeof c==='object')?c.key:String(c); }
function cDisp(c){ return (c&&typeof c==='object')?c.disp:String(c); }
function somasubHtml(q){ // formato do jogo de sílabas: conta no topo + matriz 3×3 de 9 respostas (números ou gráficos)
  const choices=q.choices.map((c,i)=>`<button class="quiz-choice${i===q.sel?' sel':''}${q.revealed&&cKey(c)===q.answer?' reveal':''}" data-i="${i}" type="button">${cDisp(c)}</button>`).join('');
  const dots=q.dots?`<div class="quiz-dots" aria-label="${q.dots} bolinhas">${'●'.repeat(q.dots)}</div>`:'';
  const hint=q.revealed?'Resposta certa em destaque. Pule (L) para seguir.':(q.tries>0?'Quase! Tente de novo.':'Escolha e pule (L) para confirmar.');
  return `<div class="quiz-box quiz-box--math" role="dialog" aria-modal="true" aria-label="Desafio de matemática"><div class="quiz-prob">${q.prob||''}</div>${dots}<div class="quiz-grid">${choices}</div><div class="quiz-hint">${hint}</div></div>`;
}
function silabaHtml(q){
  const N=q.options.length;
  const boxes=`<div class="silaba-boxes">`+q.boxes.map(b=>`<span class="silaba-box${b!==null?' filled':''}">${b!==null?disp(b):''}</span>`).join('')+`</div>`;
  const opts=q.options.map((sy,i)=>`<button class="quiz-choice${i===q.sel?' sel':''}" data-i="${i}" type="button">${disp(sy)}</button>`).join('');
  const acts=`<button class="quiz-choice${q.sel===N?' sel':''}" data-i="${N}" type="button">Apagar</button><button class="quiz-choice${q.sel===N+1?' sel':''}" data-i="${N+1}" type="button">OK</button>`;
  const hint=q.revealed?`A palavra é "${disp(q.word)}". Pule (L) para seguir.`:'Monte a palavra. Pule (L) coloca/confirma.';
  return `<div class="quiz-box" role="dialog" aria-modal="true" aria-label="Monte a palavra"><button class="quiz-word${q.sel===-1?' sel':''}" data-i="-1" type="button" aria-label="Ouvir a palavra ${q.word} de novo">${q.emoji}</button><div class="quiz-letter">letra: ${disp(q.letter)}</div>${boxes}<div class="quiz-grid">${opts}</div><div class="silaba-actions">${acts}</div><div class="quiz-hint">${hint}</div></div>`;
}
function preHtml(q){ // nível 1: 3 escritas, só UMA certa
  const opts=q.choices.map((w,i)=>`<button class="quiz-choice${i===q.sel?' sel':''}${q.revealed&&w===q.word?' reveal':''}" data-i="${i}" type="button">${disp(w)}</button>`).join('');
  const hint=q.revealed?`A certa é "${disp(q.word)}". Pule (L) para seguir.`:(q.tries>0?'Quase! Tente de novo.':'Qual é a escrita certa? Pule (L) confirma.');
  return `<div class="quiz-box" role="dialog" aria-modal="true" aria-label="Escolha a palavra certa"><button class="quiz-word${q.sel===-1?' sel':''}" data-i="-1" type="button" aria-label="Ouvir a palavra ${q.word} de novo">${q.emoji}</button><div class="quiz-letter">nível 1 · ${QL_NAME[1]}</div><div class="quiz-grid">${opts}</div><div class="quiz-hint">${hint}</div></div>`;
}
function alfHtml(q){ // níveis 4/5: caixas do tamanho da palavra + grade de letras
  const N=q.options.length;
  const boxes=`<div class="silaba-boxes">`+q.boxes.map(b=>`<span class="silaba-box${b!==null?' filled':''}">${b!==null?disp(b):''}</span>`).join('')+`</div>`;
  const opts=q.options.map((ch,i)=>`<button class="quiz-choice${i===q.sel?' sel':''}" data-i="${i}" type="button">${disp(ch)}</button>`).join('');
  const acts=`<button class="quiz-choice${q.sel===N?' sel':''}" data-i="${N}" type="button">Apagar</button><button class="quiz-choice${q.sel===N+1?' sel':''}" data-i="${N+1}" type="button">OK</button>`;
  const hint=q.revealed?`A palavra é "${disp(q.word)}". Pule (L) para seguir.`:(q.braille?'Ouça a cela Braille de cada letra. Pule (L) coloca/confirma.':'Monte a palavra letra a letra. Pule (L) coloca/confirma.');
  return `<div class="quiz-box" role="dialog" aria-modal="true" aria-label="Escreva a palavra"><div class="quiz-emoji" aria-label="${q.word}">${q.emoji}</div><div class="quiz-letter">${q.braille?'nível 5 · '+QL_NAME[5]:'nível 4 · '+QL_NAME[4]}</div>${boxes}<div class="quiz-grid">${opts}</div><div class="silaba-actions">${acts}</div><div class="quiz-hint">${hint}</div></div>`;
}
function brailleHtml(q){
  const cells=q.cells.map(c=>{
    const dots=[1,4,2,5,3,6].map(n=>`<span class="bdot${c.dots.includes(n)?' on':''}"></span>`).join('');
    return `<div class="bcell"><div class="bcell-grid">${dots}</div><div class="bcell-l">${disp(c.l)}</div></div>`;
  }).join('');
  return `<div class="quiz-box" role="dialog" aria-modal="true" aria-label="Braille da palavra ${q.word}"><div class="quiz-emoji" aria-hidden="true">${q.emoji}</div><div class="quiz-letter">palavra: ${disp(q.word)}</div><div class="bcells">${cells}</div><div class="quiz-hint">Ouça os pontos. Pule (L) para coletar. (Cima repete)</div></div>`;
}
// L3: overlay do quiz POR JOGADOR — solo usa o #quiz global; MP cria um .quiz dentro da tela do jogador
function quizEl(pl){ if(numPlayers<=1) return $('#quiz');
  const scr=vpScreens[pl.i]; if(!scr) return $('#quiz');
  let q=scr.querySelector(':scope > .quiz'); if(!q){ q=document.createElement('div'); q.className='quiz'; q.hidden=true; scr.appendChild(q); }
  return q; }
function renderQuiz(pl){
  const q=pl.quiz, ov=quizEl(pl); if(!ov)return; if(!q){ov.hidden=true;return;}
  ov.innerHTML = q.kind==='braille' ? brailleHtml(q) : q.kind==='silabas' ? silabaHtml(q) : q.kind==='pre' ? preHtml(q) : q.kind==='alf' ? alfHtml(q) : somasubHtml(q);
  const box=ov.querySelector('.quiz-box'); if(box){ const n=Math.min(3,pl.alfWins||0); // 3 luzes de progresso (canto sup. dir.): acesa = amarela com brilho
    box.insertAdjacentHTML('afterbegin','<div class="quiz-wins" aria-label="'+n+' de 3 acertos para a moeda">'+[0,1,2].map(i=>'<span class="qw-dot'+(i<n?' on':'')+'"></span>').join('')+'</div>'); }
  ov.querySelectorAll('.quiz-choice,.quiz-word').forEach(b=>b.addEventListener('click',()=>{ if(pl.quiz){pl.quiz.sel=+b.dataset.i; quizConfirm(pl);} })); // .quiz-word (palavra do topo, data-i=-1) → repete a fala
  ov.hidden=false; hideTouchControls(); // quiz aberto = menu na tela → sem controle virtual
}
function quizErase(pl){ const q=pl.quiz; if(!q)return; // ESPECIAL: apaga a última sílaba/letra (jogos que MONTAM a palavra; NÃO no Descobrindo palavras/pre)
  if(q.kind==='silabas'){ eraseLastSilaba(pl); earcons.sfx('place'); }
  else if(q.kind==='alf'){ eraseLastLetter(pl); earcons.sfx('place'); } }
function quizMove(pl,d){ const q=pl.quiz; if(!q)return;
  const max = (q.kind==='silabas'||q.kind==='alf') ? q.options.length+1 : q.choices.length-1;
  const min = (q.kind==='pre'||q.kind==='silabas') ? -1 : 0; // -1 = a PALAVRA do topo (selecionável p/ repetir a fala) — jogos 1..3
  q.sel=Math.max(min,Math.min(max,q.sel+d)); renderQuiz(pl);
  if(q.kind==='silabas'||q.kind==='alf'||q.kind==='pre') quizSpeakSel(pl); // L3: leitura conforme o nível
  else srSay(speakChoice(cKey(q.choices[q.sel]))); // matemática: fala pela CHAVE (número/fração), mesmo quando exibido como gráfico
}
function quizTake(pl,q){ // coleta a figura do quiz (por jogador) e checa vitória
  takeCoin(coins[q.coinIndex]); if(coinSprites[q.coinIndex])coinSprites[q.coinIndex].visible=false;
  pl.collected++; if(pl===player)collected=pl.collected; updateHud();
  closeQuiz(pl); if(pl.collected>=COIN_TARGET)win(pl); }
function quizWin(pl,q){ // 3 VITÓRIAS = 1 MOEDA em TODOS os minigames, sem exceção (regra do José 2026-07-04)
  pl.alfWins=(pl.alfWins||0)+1;
  if(pl.alfWins<3){
    if(actCat()==='alf' && q.word){ // LETRAMENTO: som suave (o sfx de acerto já tocou) + REFALA a palavra + PAUSA → próxima palavra
      q.won=true; gameSay(q.word); srSay(quizWho(pl)+'Muito bem! '+disp(q.word)+'. '+pl.alfWins+' de 3.');
      setTimeout(()=>{ if(pl.quiz===q)closeQuiz(pl); }, 1200); return; } // a próxima abre ao encostar na moeda e é falada (openSilabas/openPre → gameSay)
    srSay(quizWho(pl)+'Acertou! '+pl.alfWins+' de 3 para ganhar a moeda.'); closeQuiz(pl); return; } // moeda FICA; encostado nela, a próxima pergunta abre sozinha
  // 3ª VITÓRIA: acende a 3ª luz + comemoração SUAVE (som tipo enigma-resolvido do Zelda), depois pega a moeda
  q.celebrating=true;
  const ov=quizEl(pl), dots=ov&&ov.querySelector('.quiz-wins');
  if(dots){ dots.querySelectorAll('.qw-dot').forEach(d=>d.classList.add('on')); dots.classList.add('celebrate'); }
  jingles.playPuzzleSolved(); if(typeof burstSparkle==='function')burstSparkle(pl.x, pl.y-16, 0xffe08a, 10); // faíscas gentis
  if(actCat()==='alf' && q.word)gameSay(q.word); // letramento: refala a palavra na 3ª vitória também
  srSay(quizWho(pl)+'Muito bem! Você ganhou a moeda!');
  setTimeout(()=>{ pl.alfWins=0; quizTake(pl,q); }, 900); } // deixa a 3ª luz + animação aparecerem antes de fechar
function quizConfirm(pl){
  const q=pl.quiz; if(!q||q.celebrating||q.won)return; // durante a comemoração/pausa pós-acerto, ignora entrada
  if(q.sel===-1 && q.word){ gameSay(q.word); return; } // PALAVRA do topo selecionada → repete a fala (VLibras gesticula, na etapa do modo surdo)
  if(q.revealed){ // SEM PENALIDADE na alfabetização: a moeda fica no lugar (nova pergunta ao tocar); matemática re-sorteia a figura
    if(actCat()==='alf'){ closeQuiz(pl); } else { respawnFigure(q.coinIndex); closeQuiz(pl); } return; }
  if(q.kind==='braille'){ earcons.sfx('coin'); srSay(quizWho(pl)+'Coletado!'); quizWin(pl,q); return; }
  if(q.kind==='pre'){ // nível 1: acertou a escrita?
    if(q.choices[q.sel]===q.word){
      earcons.sfx('correct'); srSay(`${quizWho(pl)}Acertou! ${disp(q.word)}: ${soletra(q.word)}.`); quizWin(pl,q);
    } else { q.tries++;
      if(q.tries>=2){ q.revealed=true; srAlert(`${quizWho(pl)}A certa é ${disp(q.word)}: ${soletra(q.word)}. Pule para seguir.`); }
      else { earcons.sfx('wrong'); srSay('Tente de novo.'); }
      renderQuiz(pl); }
    return;
  }
  if(q.kind==='alf'){ // níveis 4/5: montou a palavra inteira?
    const N=q.options.length;
    if(q.sel<N){ placeLetter(pl,q.options[q.sel]); return; }
    if(q.sel===N){ eraseLastLetter(pl); return; }
    if(q.boxes.join('')===q.word){ earcons.sfx('correct'); srSay(quizWho(pl)+'Acertou!'); quizWin(pl,q); }
    else { q.tries++;
      if(q.tries>=2){ q.revealed=true; q.boxes=q.word.split(''); srAlert(`${quizWho(pl)}A palavra é ${disp(q.word)}: ${soletra(q.word)}. Pule para seguir.`); }
      else { q.boxes=q.boxes.map(()=>null); earcons.sfx('wrong'); srSay('Tente de novo.'); }
      renderQuiz(pl); }
    return;
  }
  if(q.kind==='silabas'){
    const N=q.options.length;
    if(q.sel<N){ placeSilaba(pl,q.options[q.sel]); return; }
    if(q.sel===N){ eraseLastSilaba(pl); return; }
    if(q.boxes[0]===q.correct[0] && q.boxes[1]===q.correct[1]){ earcons.sfx('correct'); srSay(quizWho(pl)+'Acertou!'); quizWin(pl,q); }
    else { q.tries++;
      if(q.tries>=2){ q.revealed=true; q.boxes=q.correct.slice(); srAlert(`${quizWho(pl)}A palavra é ${disp(q.word)}. Pule para seguir.`); }
      else { q.boxes=[null,null]; earcons.sfx('wrong'); srSay('Tente de novo.'); }
      renderQuiz(pl);
    }
    return;
  }
  if(cKey(q.choices[q.sel])===q.answer){ earcons.sfx('correct'); srSay(quizWho(pl)+'Acertou!'); quizWin(pl,q); } // matemática também: 3 vitórias = 1 moeda (compara pela CHAVE, não pela exibição)
  else { q.tries++;
    if(q.tries>=2){q.revealed=true; srAlert(`${quizWho(pl)}A resposta é ${speakChoice(q.answer)}. Pule para seguir.`);} else earcons.sfx('wrong'); srSay('Tente de novo.');
    renderQuiz(pl);
  }
}
function closeQuiz(pl){ pl.quiz=null; const ov=quizEl(pl); if(ov)ov.hidden=true; }
function respawnFigure(i){
  const occ=new Set(); coins.forEach((c,j)=>{ if(j!==i)occ.add(c.x+','+c.y); });
  for(const cand of shuffle(findCoinCandidates())){ const x=cand.tx*TILE+3,y=cand.ty*TILE+3;
    if(!occ.has(x+','+y)){ coins[i].x=x;coins[i].y=y;coins[i].taken=false; // dono (owner) preservado
      const s=coinSprites[i]; s.x=(MODE==='somasub')?x-3:x; s.y=(MODE==='somasub')?y-3:y; s.visible=true; return; } }
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
/* ===================== ATIVIDADES (menu inicial novo) =====================
   Lúdico · Alfabetização (5 — 3 vitórias = 1 moeda, SEM penalidade no erro) · Matemática (11).
   Trocar de atividade = todo mundo sai do jogo → volta ao menu inicial. */
const ACTIVITIES={ // d = descrição do minigame (rodapé dos menus secundários)
  ludico:{cat:'ludico',nome:'Coletar 10 moedas'},
  alf1:{cat:'alf',nome:'Descobrindo palavras', sub:'BABA • BOLA • BEBE',        d:'Elaborado para ajudar a superar as hipóteses pré-silábicas.'},
  alf2:{cat:'alf',nome:'Descobrindo sílabas',  sub:'BA • BE • BI',              d:'Feito para ajudar a superar a hipótese silábica sem valor sonoro (uma letra errada por sílaba) e com valor sonoro (vogal ou consoante correta por sílaba), deixando claro que cada som é uma sílaba e cada sílaba tem sua forma correta de escrever.'},
  alf3:{cat:'alf',nome:'Montando palavras',    sub:'BA+BA • BE+BE • BO+LA',     d:'Feito para superar a fase da hipótese silábico-alfabética, desafiando o aluno a encontrar as sílabas corretas para montar a palavra.'},
  alf4:{cat:'alf',nome:'Escrevendo palavras',  sub:'B-A-B-A • B-O-L-A • B-E-B-E',d:'Atividade com o objetivo de treinar ortografia.'},
  alf5:{cat:'alf',nome:'Escrevendo em Braille',d:'Escreva letra por letra; o jogo dita os pontos da cela Braille (12 letras).'},
  mat1:{cat:'mat',nome:'Quantidade',           d:'Conte as bolinhas e escolha o número certo (1 a 9).'},
  mat2:{cat:'mat',nome:'Soma fácil',           d:'Somas com parcelas de 0 a 5.'},
  mat3:{cat:'mat',nome:'Soma e Subtração 1',   d:'Contas que dá para fazer nos dedos (até 10).'},
  mat4:{cat:'mat',nome:'Soma e Subtração 2',   d:'Guarde um número na cabeça e opere o outro nos dedos (até 20).'},
  mat5:{cat:'mat',nome:'Tabuada',pick:true,    d:'Escolha os números e treine a multiplicação.'},
  mat6:{cat:'mat',nome:'Divisão',pick:true,    d:'Escolha os números e treine a divisão.'},
  fr2:{cat:'mat',nome:'Soma e subtração com meios',dens:[2],           d:'Some e subtraia meios.'},
  fr3:{cat:'mat',nome:'Soma e subtração com terços',dens:[3],          d:'Some e subtraia terços.'},
  fr42:{cat:'mat',nome:'Soma e subtração com quartos e meios',dens:[4,2], d:'Some e subtraia quartos e meios.'},
  fr5:{cat:'mat',nome:'Soma e subtração com quintos',dens:[5],         d:'Some e subtraia quintos.'},
  fr632:{cat:'mat',nome:'Soma e subtração com sextos, terços e meios',dens:[6,3,2], d:'Some e subtraia sextos, terços e meios.'},
  fr2a6:{cat:'mat',nome:'Soma e subtração com frações de meio a sextos',dens:[2,3,4,5,6], d:'Some e subtraia frações de meios a sextos.'},
};
const ALF_LEVEL={alf1:1,alf2:2,alf3:3,alf4:4,alf5:5};
if(!ACTIVITIES[ACTIVITY]) setActivityValue('ludico'); // ACTIVITY vem de core/state.js (Fase 2, mega-var 5); valida o valor inicial contra as atividades existentes
let tabSel=(()=>{ try{ const s=JSON.parse(localStorage.getItem('incl_tabsel')); if(Array.isArray(s)&&s.length)return s.filter(n=>n>=0&&n<=10); }catch(e){} return [2,3,4,5]; })();
function actCat(){ return (ACTIVITIES[ACTIVITY]||{}).cat||'ludico'; }
function setActivity(id){ if(!ACTIVITIES[id])id='ludico'; setActivityValue(id); // core/state.js: valor + persistência (incl_activity) + evento; a validação fica aqui
  const cat=ACTIVITIES[id].cat;
  if(cat==='alf')setQuizLevel(ALF_LEVEL[id],false); // reusa os 5 níveis da psicogênese
  MODE = cat==='alf'?'silabas':cat==='mat'?'somasub':'ludico'; }
let _pendingAct='ludico', pendingPlayers=1, _cenBack='tm-main';
function startActivity(id){ // R-splash 2: depois do desafio, o JOGADOR 1 escolhe o CENÁRIO (aos demais, "aguarde")
  _pendingAct=id;
  _cenBack = (ACTIVITIES[id].pick)?'tm-tab' : ACTIVITIES[id].dens?'tm-fr' : ACTIVITIES[id].cat==='alf'?'tm-alf' : ACTIVITIES[id].cat==='mat'?'tm-mat' : 'tm-main';
  showTitleMenu('tm-cen'); srSay('Escolha o cenário.'); }
function reallyStart(){ const id=_pendingAct; setActivity(id);
  if(isMobile()){ if(pendingPlayers>1)pendingPlayers=1;
    try{ const el=document.documentElement, rf=el.requestFullscreen||el.webkitRequestFullscreen; if(rf)rf.call(el); }catch(e){} }
  players.forEach(p=>{ p.alfWins=0; });
  if(pendingPlayers!==numPlayers) setNumPlayers(pendingPlayers); else restartGame();
  setPhase('playing'); hideTips(); srSay(ACTIVITIES[id].nome+'. Jogo iniciado.'); }
// gcd/fracStr/DEN_NAME/fmtFrac/fracGraphic/fracSpeak/speakChoice extraídos p/ game/fractions.js (Estágio 4).
// As NOTAÇÕES (fracNot + FNOT_*) — estado/labels do menu — ficam aqui (painel de frações).
/* NOTAÇÕES de fração (menu "Fração"): vertical · diagonal · decimal · percentual · mista — toggles persistidos */
// NOTAÇÕES = opções de jogo (toggles). GRÁFICOS (círculo/quadrado) NÃO são opção — são intrínsecos à atividade (José).
let fracNot=(()=>{ const d={v:1,d:0,dec:0,pct:0,mix:0};
  try{ const s=JSON.parse(localStorage.getItem('incl_fracnot')); if(s&&typeof s==='object')for(const k in d)if(k in s)d[k]=s[k]?1:0; }catch(e){}
  if(!Object.values(d).some(x=>x))d.v=1; return d; })();
const FNOT_LBL={v:'Fracionária vertical',d:'Fracionária diagonal',dec:'Decimal',pct:'Percentual',mix:'Mista'};
// Rótulo do toggle = a PRÓPRIA notação (exemplo x/y), lado a lado → ocupa menos espaço (José). aria-label mantém a palavra.
const FNOT_SYM={ v:`<span class="fv"><b>x</b><b>y</b></span>`, d:'x/y', dec:'x,y', pct:'x%', mix:`x<span class="fv"><b>y</b><b>z</b></span>` };
const FNOT_DESC={ // rodapé (mesmo estilo do menu de pausa): explica cada notação
  v:'Liga a exibição de frações verticais.',
  d:'Liga a exibição de frações na horizontal.',
  dec:'Liga números que sempre aparecem com uma casa decimal.',
  pct:'Liga números percentuais.',
  mix:'Liga números inteiros e frações reduzidas.' };
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
  const cols=n<=1?1:(n<=2?n:2), rows=n<=2?1:2, baseW=320*cols, baseH=180*rows;
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
function addCoinsForOwner(owner){ const a=shuffle(findCoinCandidates());
  const sh=MODE==='somasub'?shuffle(SOMASUB_SHAPES.map(s=>s.id)):[], lt=MODE==='silabas'?shuffle(WORD_INITIALS):[];
  a.slice(0,Math.min(COIN_TARGET,a.length)).forEach((c,i2)=>coins.push({ x:c.tx*TILE+3, y:c.ty*TILE+3, owner, taken:false,
    shape:sh.length?sh[i2%sh.length]:'', letter:lt.length?lt[i2%lt.length]:'' }));
  rebuildCoins(); }
function respawnCoinsForOwner(owner){ setCoins(coins.filter(c=>c.owner!==owner)); addCoinsForOwner(owner); }
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
const HAT_STEPS=[[-1,1,0,0,0],[-0.7143,1,0,0,1],[-0.4286,0,0,0,1],[-0.1429,0,1,0,1],[0.1429,0,1,0,0],[0.4286,0,1,1,0],[0.7143,0,0,1,0],[1,1,0,1,0]]; // [v,cima,baixo,esq,dir]
function stdDirs(gp){ const b=i=>!!(gp.buttons[i]&&gp.buttons[i].pressed), ax=i=>gp.axes[i]||0;
  const d={ left:ax(0)<-PAD_DEAD||b(14), right:ax(0)>PAD_DEAD||b(15), up:ax(1)<-PAD_DEAD||b(12), down:ax(1)>PAD_DEAD||b(13) };
  for(let i=6;i<gp.axes.length;i++){ const v=gp.axes[i]; if(typeof v!=='number'||Math.abs(v)>1.001)continue; // repouso do hat (~1.286) fica fora de [-1,1]
    for(const [hv,u,dn,l,r] of HAT_STEPS){ if(Math.abs(v-hv)<=0.09){ if(u)d.up=true; if(dn)d.down=true; if(l)d.left=true; if(r)d.right=true; break; } } }
  return d; }
function padActions(gp){
  const custom=padMapFor(gp.id); // wizard salvo p/ este modelo → usa o mapa do usuário (_skip = cancelou: padrão)
  if(custom && !custom._skip){ const A=k=>bindActive(gp,custom[k]); const sd=stdDirs(gp);
    return { left:A('left')||sd.left, right:A('right')||sd.right, up:A('up')||sd.up, down:A('down')||sd.down,
      jump:A('jump'), run:A('run'), swap:A('swap'), especial:A('especial'), _start:A('jump')||A('start'), _pause:A('start') }; }
  const b=i=>!!(gp.buttons[i]&&gp.buttons[i].pressed), sd=stdDirs(gp);
  return { left:sd.left, right:sd.right, up:sd.up, down:sd.down,
    jump:b(0), run:b(2)||b(5)||b(7), swap:b(3), especial:b(1), _start:b(0)||b(9), _pause:b(9) }; }
function pollPads(){ if(padWiz)return; // durante o wizard, os pads falam só com ele
  const pads=navigator.getGamepads?navigator.getGamepads():[]; if(!pads)return;
  if(attractCtl.isAttract()){ for(const gp of pads){ if(gp&&gp.buttons.some(b=>b&&b.pressed)){ attractCtl.stopAttract(); return; } } return; } // botão de pad encerra a demo
  for(const gp of pads){ if(!gp)continue; const gi=gp.index;
    // L1: controle fora do padrão (DirectInput) SEM mapa salvo apertou algo → pausa geral + wizard direto
    if(gp.mapping!=='standard' && !padMapFor(gp.id) && gp.buttons.some(b=>b&&b.pressed)){
      padWizAutoResume=(phase==='playing'); if(phase==='playing')setPhase('paused');
      openPadWizFor(gp); return; }
    const cur=padActions(gp); const prev=padPrevAct[gi]||{};
    // botão físico usado → some o gamepad virtual (mesma regra do teclado)
    if(document.body.classList.contains('touch-mode') && (cur.left||cur.right||cur.up||cur.down||cur.jump||cur.run||cur.swap||cur.especial||cur._start)) hideTouchControls();
    const startEdge = cur._start && !padPrevStart[gi]; padPrevStart[gi]=cur._start;
    const pauseEdge = cur._pause && !prev._pause;
    const edge=k=>cur[k]&&!prev[k];
    padCur[gi]=cur; padPrevAct[gi]=cur;
    // Vitória: START/pulo fecham o modal (Jogar de novo)
    const winOv=$('#win-overlay'); if(winOv&&!winOv.hidden){ if(startEdge){ const b=$('#btn-again'); if(b)b.click(); } continue; }
    if(phase==='title'){ const k={yes:edge('jump')||startEdge, no:edge('especial'), up:edge('up'), down:edge('down'), left:edge('left'), right:edge('right')};
      const any=k.yes||k.no||k.up||k.down||k.left||k.right;
      const owner=players.findIndex(p=>p.pad===gi);
      if(numPlayers>1&&owner>0){ if(any)srSay('Aguarde o Jogador 1 escolher o jogo.'); continue; } // só o J1 escolhe
      if(any)navTitle(k); continue; } // menu inicial navegável pelo pad
    if(phase==='paused'){ const owner=players.findIndex(p=>p.pad===gi); const pi=owner<0?0:owner;
      if(pauseEdge){ setPhase('playing'); continue; } // START retoma
      const k={yes:edge('jump'), no:edge('especial'), up:edge('up'), down:edge('down'), left:edge('left'), right:edge('right')};
      if(k.yes||k.no||k.up||k.down||k.left||k.right){ const dlg=(typeof sharedDialogOpen==='function')&&sharedDialogOpen();
        if(dlg)navDialog(dlg,k); else { const menu=vpPause[pi]; if(menu&&!menu.hidden)navPause(menu,pi,k); } }
      continue; }
    if(phase==='playing'){ const owner=players.findIndex(p=>p.pad===gi);
      if(owner<0){ // atribuição POR ORDEM DE AÇÃO (R-splash 2): qualquer botão associa — 1º controle a agir → 1º jogador sem pad
        const anyEdge=edge('jump')||edge('run')||edge('swap')||edge('especial')||startEdge||edge('left')||edge('right')||edge('up')||edge('down');
        if(anyEdge){ const waitI=players.findIndex(p=>p&&p.waiting); const free=waitI>=0?waitI:players.findIndex(p=>p&&p.pad<0&&!p.quit);
          if(free>=0){ players[free].pad=gi;
            if(players[free].waiting){ players[free].waiting=false; const scr=vpScreens[free], w=scr&&scr.querySelector('.vp-wait'); if(w)w.remove(); }
            srSay('Controle associado ao Jogador '+(free+1)+'. O teclado continua funcionando.'); }
          else joinPlayer(gi); } }
      else if(players[owner].quit){ if(startEdge) respawnPlayer(owner); } // tela abandonada → recomeça SÓ ela
      else { const p=players[owner];
        if(pauseEdge){ setPhase('paused'); pauseActor=owner; continue; }  // START pausa (todos pausam; cada tela navega a sua)
        if(p.quiz){ // L3: o pad navega o quiz do PRÓPRIO jogador (o jogo dos outros segue)
          if(p.quiz.kind==='braille'){ if(edge('up'))announceBraille(p); else if(edge('jump'))quizConfirm(p); continue; }
          if(edge('left'))quizMove(p,-1); else if(edge('right'))quizMove(p,1);
          else if(edge('up'))quizMove(p,-3); else if(edge('down'))quizMove(p,3);
          else if(edge('jump'))quizConfirm(p);
          else if(edge('especial'))quizErase(p); // ESPECIAL = apagar última sílaba/letra
          continue; }
        if(edge('jump'))p.jumpEdge=true;
        if(edge('run')&&!p.easy)p.runEdge=true;
        if(edge('left'))p.leftEdge=true;
        if(edge('right'))p.rightEdge=true;
        if(edge('swap'))p.swapEdge=true;
        if(edge('especial'))p.specialEdge=true; } }
  } }
// Desconectar NÃO abandona o jogo: o teclado é sempre fallback. Só solta a associação do pad.
addEventListener('gamepaddisconnected',(e)=>{ try{ const owner=players.findIndex(p=>p.pad===e.gamepad.index);
  if(owner>=0){ players[owner].pad=-1; srAlert('Controle do Jogador '+(owner+1)+' desconectado — o teclado continua funcionando. Aperte START para reassociar.'); }
  delete padCur[e.gamepad.index]; }catch(err){} });

/* ===== L1: wizard de mapeamento de gamepad (DirectInput e controles fora do padrão) =====
   Captura botões por índice; analógicos como limiar por eixo/sinal ({ax,s}); D-pad "POV hat" do
   DirectInput como VALOR de eixo ({av,v}, casamento por proximidade ±0.13 — os 8 passos do hat
   distam ~0.286). Mapa salvo por gamepad.id em localStorage → vale p/ aquele modelo de controle. */
const _padMaps={}; // cache id → mapa custom (null = sem mapa, usa o padrão)
function padMapFor(id){ if(_padMaps[id]===undefined){ _padMaps[id]=store.getJSON('incl_padmap_'+id,null); } return _padMaps[id]; }
function bindActive(gp,bd){ if(!bd)return false;
  if(bd.b!=null) return !!(gp.buttons[bd.b]&&gp.buttons[bd.b].pressed);
  if(bd.ax!=null) return ((gp.axes[bd.ax]||0)*bd.s)>0.5;                 // analógico: limiar com sinal
  if(bd.av!=null) return Math.abs((gp.axes[bd.av]||0)-bd.v)<=0.13;       // hat: valor exato do passo
  return false; }
let padWiz=null; // {gi,id,step,base,map,timer,release,baseWait}
let padWizAutoResume=false; // wizard aberto automaticamente no meio do jogo → retoma ao fechar
const PADWIZ_STEPS=[['up','CIMA'],['down','BAIXO'],['left','ESQUERDA'],['right','DIREITA'],['jump','PULAR'],['run','CORRER / INTERAGIR'],['swap','TROCAR PODER'],['especial','ESPECIAL'],['start','START (pausa)']];
function padWizSay(t){ const el=$('#padwiz-prompt'); if(el)el.textContent=t; srSay(t); }
function openPadWiz(){ const ov=$('#padwiz'); if(!ov)return; ov.hidden=false; frontOverlay(ov);
  padWiz={gi:-1,id:'',step:-1,base:null,map:{},release:false,baseWait:false};
  padWizSay('Aperte QUALQUER botão no controle que deseja mapear.'); padWizDemo(null);
  const pr=$('#padwiz-progress'); if(pr)pr.textContent='';
  padWiz.timer=setInterval(padWizTick,30); }
// Wizard aberto AUTOMATICAMENTE (controle DirectInput sem mapa apertou algo): já sabemos qual controle é.
function openPadWizFor(gp){ const ov=$('#padwiz'); if(!ov)return; ov.hidden=false; frontOverlay(ov);
  padWiz={gi:gp.index,id:gp.id,step:-1,base:null,map:{},release:false,baseWait:true};
  padWizSay('Controle novo detectado: '+gp.id+'. O jogo pausou para você configurá-lo. SOLTE tudo para começar.'); padWizDemo(null);
  const pr=$('#padwiz-progress'); if(pr)pr.textContent='';
  padWiz.timer=setInterval(padWizTick,30); }
function closePadWiz(save){ if(!padWiz)return; clearInterval(padWiz.timer);
  if(save&&padWiz.id){ store.setJSON('incl_padmap_'+padWiz.id, padWiz.map);
    _padMaps[padWiz.id]=padWiz.map; srAlert('Mapeamento salvo para: '+padWiz.id+'.'); }
  else if(padWiz.id && !_padMaps[padWiz.id]) _padMaps[padWiz.id]={_skip:true}; // cancelou: usa o mapa PADRÃO nesta sessão (não salva; evita reabrir o wizard em loop)
  const gi=padWiz.gi; padWiz=null; const ov=$('#padwiz'); if(ov)ov.hidden=true;
  // sem edges fantasmas: o botão ainda SEGURADO do último passo (START) não pode pausar/agir ao retomar
  try{ const gp=(navigator.getGamepads?navigator.getGamepads():[])[gi]; if(gp){ const c=padActions(gp); padCur[gi]=c; padPrevAct[gi]=c; padPrevStart[gi]=c._start; } }catch(e){}
  if(padWizAutoResume){ padWizAutoResume=false; if(phase==='paused')setPhase('playing'); } }
// Demo do wizard com ANIMAÇÃO REAL (frames do jogo): subir/descer escada, andar, pular, correr;
// TROCA = slide dos ícones de power-up; START = palavra PAUSA; ESPECIAL = a definir (✨ provisório).
const PADWIZ_ANIM={
  up:   {seq:['escada/0','escada/1'], hold:9, cls:'pw-up'},
  down: {seq:['escada/1','escada/0'], hold:9, cls:'pw-down'},
  left: {seq:['andar/0','andar/1','andar/2','andar/3','andar/4','andar/5','andar/6','andar/7'], hold:4, cls:'pw-left', flip:1},
  right:{seq:['andar/0','andar/1','andar/2','andar/3','andar/4','andar/5','andar/6','andar/7'], hold:4, cls:'pw-right'},
  jump: {seq:['pulo/0','pulo/0','pulo/1','pulo/1'], hold:7, cls:'pw-jump'},
  run:  {seq:['correr/0','correr/1','correr/2','correr/3'], hold:3, cls:'pw-run'},
  swap: {fx:'👟 🕷️ 🎈 🐇 🦘', cls:'pw-swap', noimg:1},
  especial:{seq:['idle/0','idle/1','idle/2','idle/3'], hold:8, fx:'✨', cls:'pw-especial'},
  start:{fx:'PAUSA', cls:'pw-start', noimg:1},
};
let padWizAnim=null; // {seq,hold,t} — frames trocados no padWizTick
function padWizDemo(k){ const d=$('#padwiz-demo'), img=$('#padwiz-demo-img'), fx=$('#padwiz-demo-fx'); if(!d)return;
  const a=k?PADWIZ_ANIM[k]:null; d.className=a?a.cls:''; padWizAnim=null;
  if(fx)fx.textContent=(a&&a.fx)||'';
  if(img){ img.style.display=(a&&a.noimg)?'none':''; img.style.transform=(a&&a.flip)?'scaleX(-1)':'';
    if(a&&a.seq){ img.src=SPR+a.seq[0]+'.png'; padWizAnim={seq:a.seq,hold:a.hold||6,t:0}; }
    else if(!a) img.src=SPR+'idle/0.png'; } }
function padWizDemoTick(){ if(!padWizAnim)return; const a=padWizAnim; a.t++;
  const img=$('#padwiz-demo-img'); if(img)img.src=SPR+a.seq[Math.floor(a.t/a.hold)%a.seq.length]+'.png'; }
function padWizPrompt(){ const s=PADWIZ_STEPS[padWiz.step]; padWizSay((padWiz.step+1)+' de '+PADWIZ_STEPS.length+' — aperte: '+s[1]);
  padWizDemo(s[0]); // demonstração animada do que a ação FAZ
  const pr=$('#padwiz-progress'); if(pr)pr.textContent='Mapeados: '+(Object.keys(padWiz.map).join(' · ')||'—'); }
function padWizBind(bd){ padWiz.map[PADWIZ_STEPS[padWiz.step][0]]=bd; padWiz.step++; padWiz.release=true;
  if(padWiz.step>=PADWIZ_STEPS.length) closePadWiz(true); }
function padWizTick(){ if(!padWiz)return; padWizDemoTick(); const pads=navigator.getGamepads?navigator.getGamepads():[];
  if(padWiz.gi<0){ for(const gp of pads){ if(gp&&gp.buttons.some(b=>b&&b.pressed)){ padWiz.gi=gp.index; padWiz.id=gp.id; padWiz.baseWait=true; padWizSay('Controle: '+gp.id+'. Agora SOLTE tudo.'); break; } } return; }
  const gp=pads[padWiz.gi]; if(!gp)return;
  if(padWiz.baseWait){ if(!gp.buttons.some(b=>b&&b.pressed)){ padWiz.baseWait=false; padWiz.base={b:gp.buttons.map(x=>!!(x&&x.pressed)), a:gp.axes.slice()}; padWiz.step=0; padWizPrompt(); } return; }
  if(padWiz.release){ const idle = !gp.buttons.some((b,i)=>b&&b.pressed&&!padWiz.base.b[i]) && gp.axes.every((v,i)=>Math.abs((v||0)-padWiz.base.a[i])<0.35);
    if(idle){ padWiz.release=false; padWizPrompt(); } return; }
  // eixo em rastreio (~240ms): classifica pelo COMPORTAMENTO, não pela magnitude — nada de exigir curso
  // máximo (ergonomia). Valor que VARIA continuamente = analógico → limiar por sinal (ativa na metade do
  // curso); valor que salta e fica CONSTANTE = D-pad/POV hat (ou stick digital) → valor exato (±0.13).
  if(padWiz.axTrack){ const t=padWiz.axTrack, v=gp.axes[t.i]||0;
    if(Math.abs(v-t.last)>0.03)t.changes++; t.last=v;
    if(Math.abs(v-padWiz.base.a[t.i])>Math.abs(t.v-padWiz.base.a[t.i])) t.v=v;
    if(++t.ticks>=8){ const pv=t.v; padWiz.axTrack=null;
      padWizBind(t.changes>=2 ? {ax:t.i,s:pv>0?1:-1} : {av:t.i,v:Math.round(pv*10000)/10000}); }
    return; }
  for(let i=0;i<gp.buttons.length;i++){ if(gp.buttons[i]&&gp.buttons[i].pressed&&!padWiz.base.b[i]){ padWizBind({b:i}); return; } }
  for(let i=0;i<gp.axes.length;i++){ const v=gp.axes[i]||0; if(Math.abs(v-padWiz.base.a[i])>0.45){ padWiz.axTrack={i,v,last:v,changes:0,ticks:0}; return; } }
}
{ const c=$('#padwiz-cancel'); if(c)c.addEventListener('click',()=>closePadWiz(false)); }

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
function toggleBtn(b,on){ b.classList.toggle('is-on',on); b.setAttribute('aria-pressed',String(on)); }
const soundBtn=$('#opt-sound'), capBtn=$('#opt-captions'), facilBtn=$('#opt-facil');
if(soundBtn){ soundBtn.setAttribute('aria-haspopup','dialog'); soundBtn.addEventListener('click',openAudio); } // botão de áudio agora abre o mixer
if(capBtn) capBtn.addEventListener('click',()=>{ captionsOn=!captionsOn; toggleBtn(capBtn,captionsOn); srSay('Legendas '+(captionsOn?'ligadas.':'desligadas.')); });
let selMovPlayer=0; // jogador selecionado no painel Acessibilidade motora
if(facilBtn) facilBtn.addEventListener('click',()=>{ setEasy(selMovPlayer, !players[selMovPlayer].easy); });
function reflectFacil(){ const p=players[selMovPlayer], on=!!(p&&p.easy); if(facilBtn){ toggleBtn(facilBtn,on); facilBtn.textContent=on?'❚❚ Ligado':'▶ Desligado'; } reflectMovementBtn(); }
function reflectMovementBtn(){ const b=$('#opt-movement'); if(b)b.classList.toggle('is-on',players.some(p=>p.easy||p.toggleMove)); } // barra acende se QUALQUER jogador usa Fácil/alternância
function setEasy(i,on){ const p=players[i]; if(!p)return; p.easy=on; try{localStorage.setItem('incl_easy_p'+i,on?'1':'0');}catch(e){} reflectFacil(); rebuildCoins(); srSay((numPlayers>1?'Jogador '+(i+1)+': ':'')+'Modo Fácil '+(on?'ligado: gravidade menor, pulo mais alto, coleta tolerante, moedas no chão, sem perigos e sem quedas acidentais (segure ↓ para descer).':'desligado.')); }
function renderMovPlayers(){ const tabs=$('#movement-players'); if(!tabs)return; if(selMovPlayer>=numPlayers)selMovPlayer=0; tabs.hidden=true; // E3: sem abas — cada jogador edita só o seu (escopo = pauseActor)
  tabs.innerHTML = numPlayers<=1 ? '' : Array.from({length:numPlayers},(_,p)=>`<button class="mode-btn${p===selMovPlayer?' is-on':''}" data-mp="${p}" type="button">Jogador ${p+1}</button>`).join('');
  tabs.querySelectorAll('button[data-mp]').forEach(b=>b.addEventListener('click',()=>{ selMovPlayer=+b.dataset.mp; renderMovPlayers(); reflectFacil(); reflectAltMove(); })); }

/* Modos de visualização: Normal + Alto contraste (Renderização Direta) + simulações/correções (filtro) */
function parallaxTexFor(i,mode){
  if(DIRECT_CFG[mode]){ (_parallaxTexHC[mode]=_parallaxTexHC[mode]||[]); if(!_parallaxTexHC[mode][i])_parallaxTexHC[mode][i]=directBgTexture(parallaxTexNormal[i],mode); return _parallaxTexHC[mode][i]; } // direto: fundo recua
  return parallaxTexNormal[i]; }
/* ===== Cor POR JOGADOR (E11): cada viewport do multiplayer renderiza no modo do seu jogador.
   - solo: filtro CSS na canvas + texturas globais + overlay DOM + bolinha (applyVizGlobal).
   - MP: filtro PIXI por viewport + troca das texturas compartilhadas antes de cada render (no draw). */
const _vpFilterCache={};
function pixiFilterFor(mode){ if(mode in _vpFilterCache)return _vpFilterCache[mode]; let f=null;
  const CM=PIXI.ColorMatrixFilter, BL=PIXI.BlurFilter;
  // SIMULAÇÃO = Machado 2009 sev. 1.0 · CORREÇÃO = C = I + M_err·(I−Sim), M_err de Fidaner et al. (daltonize).
  // Valores canônicos — ver docs/PESQUISA-DALTONIZACAO.md. (PIXI aplica em sRGB = aproximação padrão web; idem SVG do solo.)
  const cvd={'sim-protan':[0.152286,1.052583,-0.204868,0,0, 0.114503,0.786281,0.099216,0,0, -0.003882,-0.048116,1.051998,0,0, 0,0,0,1,0],
             'sim-deuter':[0.367322,0.860646,-0.227968,0,0, 0.280085,0.672501,0.047413,0,0, -0.011820,0.042940,0.968881,0,0, 0,0,0,1,0],
             'sim-tritan':[1.255528,-0.076749,-0.178779,0,0, -0.078411,0.930809,0.147602,0,0, 0.004733,0.691367,0.303900,0,0, 0,0,0,1,0],
             'fix-protan':[1,0,0,0,0, 0.478897,0.476911,0.044192,0,0, 0.597282,-0.688692,1.091410,0,0, 0,0,0,1,0],
             'fix-deuter':[1,0,0,0,0, 0.162790,0.725047,0.112165,0,0, 0.454695,-0.645392,1.190697,0,0, 0,0,0,1,0],
             'fix-tritan':[1,0,0,0,0, -0.100459,1.122915,-0.022457,0,0, -0.183603,-0.637643,1.821245,0,0, 0,0,0,1,0]};
  if(cvd[mode]&&CM){ const c=new CM(); c.matrix=cvd[mode]; f=[c]; }
  else if(mode==='blind'&&CM){ const c=new CM(); c.brightness(0,false); f=[c]; }
  else if(mode==='lv-blur'&&BL){ f=[new BL(5)]; }
  else if(mode==='lv-haze'&&CM){ const c=new CM(); c.contrast(-0.45,false); c.brightness(1.12,true); f=[c]; }
  else if((mode==='lv-tunnel'||mode==='lv-diabetic'||mode==='lv-macular')&&BL){ f=[new BL(mode==='lv-tunnel'?1.5:2)]; }
  return _vpFilterCache[mode]=f;
}
// overlay de baixa visão como TEXTURA (renderizada no viewport por cima da cena)
function lvOverlayCanvas(lv){ const W=LOGICAL_W,H=LOGICAL_H,cv=makeCanvas(W,H),c=cv.getContext('2d'),cx=W/2,cy=H/2;
  if(lv==='haze'){ c.fillStyle='rgba(244,246,250,0.42)'; c.fillRect(0,0,W,H); }
  else if(lv==='tunnel'){ const g=c.createRadialGradient(cx,cy,H*0.12,cx,cy,H*0.6); g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.5,'rgba(0,0,0,.55)');g.addColorStop(1,'rgba(0,0,0,.99)'); c.fillStyle=g; c.fillRect(0,0,W,H); }
  else if(lv==='macular'){ const g=c.createRadialGradient(cx,cy,2,cx,cy,H*0.34); g.addColorStop(0,'rgba(12,12,15,.95)');g.addColorStop(.55,'rgba(12,12,15,.5)');g.addColorStop(1,'rgba(12,12,15,0)'); c.fillStyle=g; c.fillRect(0,0,W,H); }
  else if(lv==='diabetic'){ for(const[fx,fy,fr]of[[.22,.3,.1],[.64,.22,.075],[.8,.58,.11],[.4,.7,.085],[.16,.8,.07],[.54,.48,.06]]){ const x=fx*W,y=fy*H,r=fr*W,g=c.createRadialGradient(x,y,1,x,y,r); g.addColorStop(0,'rgba(10,10,14,.95)');g.addColorStop(.5,'rgba(10,10,14,.7)');g.addColorStop(1,'rgba(10,10,14,0)'); c.fillStyle=g; c.fillRect(x-r,y-r,2*r,2*r); } }
  return cv; }
const _lvOverlayTex={}; function lvOverlayTex(lv){ if(lv==='blur')return null; if(!_lvOverlayTex[lv])_lvOverlayTex[lv]=tex(lvOverlayCanvas(lv)); return _lvOverlayTex[lv]; }
const lvOverlaySpr=new PIXI.Sprite(PIXI.Texture.EMPTY), vpDot=new PIXI.Graphics();
let _playerDirect={};
function playerVizTex(base,mode){ if(!base)return base;
  if(DIRECT_CFG[mode]){ const mm=(_playerDirect[mode]=_playerDirect[mode]||new Map()); if(!mm.has(base))mm.set(base,directSpriteTexture(base,mode)); return mm.get(base); } // direto: player com contorno escuro → salta
  return base; }
// estáticos (mundo/parallax/moedas/itens) só re-aplicam quando o modo muda (_lastSharedViz declarado no topo do render)
function applySharedTextures(mode){
  if(mode!==_lastSharedViz){ _lastSharedViz=mode;
    setFrontDim(!!DIRECT_CFG[mode]); // HC: carros/placas/semáforo (frente) escurecem como fundo
    worldSprite.texture=worldTexFor(mode);
    parallaxLayers.forEach((ts,j)=>ts.texture=parallaxTexFor(j,mode));
    decoSprites.forEach(s=>s.texture=treeTexFor(mode));
    for(const s of coinSprites){ if(s)s.texture=coinTexFor(mode); }
    for(const pu of powerups){ if(pu.sprite)pu.sprite.texture=pupTexFor(pu.kind,mode); }
  }
  for(const pl of players){ if(pl.sprite&&pl._tx)pl.sprite.texture=playerVizTex(pl._tx,mode); } // player muda de quadro toda frame
}
function renderVpOverlay(i,mode){ const m=VIZ_BY_KEY[mode]; if(!m||m.kind!=='lowvision')return; // overlay de baixa visão DENTRO da render-texture (a bolinha fica por cima, fora do filtro)
  const t=lvOverlayTex(m.lv); if(t){ lvOverlaySpr.texture=t; app.renderer.render(lvOverlaySpr,{renderTexture:vpTex[i],clear:false}); }
}
// bolinhas indicadoras por viewport (sobre os sprites de saída → NÃO sofrem o filtro do viewport, ex. cegueira)
function updateVpDots(){ for(let i=0;i<vpDots.length;i++){ const g=vpDots[i], m=VIZ_BY_KEY[players[i]&&players[i].viz]; if(!g)continue;
  const on=m&&(m.kind==='blind'||m.kind==='lowvision'); g.visible=!!on; if(on){ g.clear(); g.lineStyle(1,0x000000,.6); g.beginFill(m.kind==='blind'?0xffffff:0x36d36a); g.drawCircle(0,0,5); g.endFill(); } } }
function applyVpFilters(){ for(let i=0;i<numPlayers;i++){ if(vpSpr[i])vpSpr[i].filters=pixiFilterFor(players[i].viz); } }
function setModoCego(on){ if(modoCego===on)return; modoCego=on; store.setBool('incl_modocego',on); if(typeof setupExtras==='function')setupExtras(); if(typeof reflectModoCego==='function')reflectModoCego(); srSay('Modo cego '+(on?'ligado: bengala e pistas de áudio ativas. O 1º item de poder vira a bengala de corrida.':'desligado.')); }
function setPlayerViz(i,mode){ const m=VIZ_BY_KEY[mode]||VIZ_BY_KEY.normal; players[i].viz=m.key; try{localStorage.setItem('incl_viz_p'+i,m.key);}catch(e){} _lastSharedViz=null;
  if(m.kind==='blind') setModoCego(true); // empatia cegueira total liga o modo cego (áudio) por padrão
  if(numPlayers<=1 && i===0){ applyVizGlobal(m.key); } else { applyVpFilters(); updateVpDots(); }
  reflectVizButtons(); if(typeof renderVisual==='function'){ renderVisual(); renderEmpathy(); } }
function applyVizGlobal(mode){
  const m=VIZ_BY_KEY[mode]||VIZ_BY_KEY.normal; mode=m.key;
  setVizModeValue(mode); hcMode=(m.kind==='hcnew'); // core/state.js: valor + persistência (incl_viz) + evento
  if(app&&app.view) app.view.style.filter=[VIZ_FILTER[mode]||'',lqFilter()].filter(Boolean).join(' '); // sim. daltonismo/baixa-visão/cegueira + realce L/Q compostos
  camera.filters = (m.kind==='hcnew') ? pixiFilterFor(mode) : null; // solo: alto contraste experimental = filtro GPU na câmera
  if(typeof setFrontDim==='function')setFrontDim(!!DIRECT_CFG[mode]); // HC: frente (carros/placas/semáforo) escurece como fundo
  worldSprite.texture=worldTexFor(mode);            // alto contraste direto = Renderização Direta · resto=normal
  parallaxLayers.forEach((ts,i)=>{ ts.texture=parallaxTexFor(i,mode); });
  decoSprites.forEach(s=>{ s.texture=treeTexFor(mode); });
  rebuildExtras(); rebuildCoins();
  // baixa visão = névoa+manchas (overlay) + bolinha verde; cegueira = tela preta (filtro) + esconde controles + bolinha branca
  document.body.classList.toggle('lowvision-mode', m.kind==='lowvision');
  document.body.classList.toggle('blind-mode', m.kind==='blind');
  const ov=$('#viz-overlay'); if(ov){ ov.hidden=(m.kind!=='lowvision'); ov.className=(m.kind==='lowvision'?('lv-'+m.lv):''); }
  if(m.kind==='blind'){ hideTouchControls('cegueira'); }
  updateVizIndicator(m.kind);
  if(typeof reflectVizButtons==='function') reflectVizButtons();
  if(typeof renderVisual==='function'){ renderVisual(); renderEmpathy(); }
}
// bolinha indicadora (canto sup. dir.): branca=cegueira, verde=baixa visão; toque/clique 2× volta ao normal
function updateVizIndicator(kind){ const el=$('#viz-indicator'); if(!el)return;
  const on=(kind==='blind'||kind==='lowvision'); el.hidden=!on;
  el.classList.toggle('blind',kind==='blind'); el.classList.toggle('low',kind==='lowvision');
  el.setAttribute('aria-label',(kind==='blind'?'Modo cegueira total':'Modo baixa visão')+'. Toque duas vezes para voltar às cores normais.'); }
function reapplyVizAll(){ _lastSharedViz=null; if(numPlayers<=1){ applyVizGlobal(players[0].viz); } else { app&&app.view&&(app.view.style.filter=lqFilter()); camera.filters=null; document.body.classList.remove('lowvision-mode','blind-mode'); const ov=$('#viz-overlay'); if(ov)ov.hidden=true; updateVizIndicator('normal'); applyVpFilters(); } } // MP: filtro CSS/overlay/bolinha globais OFF (por viewport agora)
// Modos que AJUDAM (A12e visual) vs SIMULAÇÕES de empatia (Modo empatia)
const isSimKind=k=>k==='filter'||k==='lowvision'||k==='blind';
const VIZ_SIM=VIZ_MODES.filter(m=>isSimKind(m.kind));
let selVizPlayer=0;
function renderVizGroup(listSel,tabsSel,modes){ const el=$(listSel); if(!el)return; if(selVizPlayer>=numPlayers)selVizPlayer=0;
  const tabs=$(tabsSel); if(tabs){ tabs.hidden=true; // E3: sem abas — cada jogador edita só o seu
    tabs.innerHTML = '';
    tabs.querySelectorAll('button[data-vp]').forEach(b=>b.addEventListener('click',()=>{ selVizPlayer=+b.dataset.vp; renderVisual(); renderEmpathy(); })); }
  const cur=players[selVizPlayer]?players[selVizPlayer].viz:'normal';
  el.innerHTML=modes.map(m=>{ const sel=m.key===cur; return `<div class="ctrl-row"><span><strong>${m.nome}</strong><br><span class="opt-hint" style="margin:0">${m.desc}</span></span>`+
    `<button class="mode-btn${sel?' is-on':''}" role="radio" aria-checked="${sel}" data-viz="${m.key}" type="button">${sel?'✓ Selecionado':'Selecionar'}</button></div>`; }).join('');
  el.querySelectorAll('button[data-viz]').forEach(btn=>btn.addEventListener('click',()=>{ setPlayerViz(selVizPlayer,btn.dataset.viz); srSay((numPlayers>1?'Jogador '+(selVizPlayer+1)+': ':'')+VIZ_MODES.find(m=>m.key===btn.dataset.viz).nome+'.'); }));
}
/* L2: opções de cor — itens por dono (toggle), paleta CB-safe (toggle) e color-blocking customizável (pickers) */
function setOwnerColors(on){ ownerColors=!!on; try{localStorage.setItem('incl_ownercolors',on?'1':'0');}catch(e){}
  rebuildCoins(); srSay('Itens na cor do dono '+(on?'ligados.':'desligados: todos na cor original.')); }
function setCbSafe(on){ cbSafe=!!on; try{localStorage.setItem('incl_cbsafe',on?'1':'0');}catch(e){}
  const src=cbSafe?PCOLOR_CB:PCOLOR_DEF; PCOLOR.length=0; src.forEach(c=>PCOLOR.push(c)); // troca IN-PLACE (todos referenciam PCOLOR)
  rebuildCoins(); ensureSprites(); srSay('Paleta segura para daltonismo '+(on?'ligada (Okabe-Ito).':'desligada.')); }
const ROLE_LBL={hazard:'perigo (lava)',climb:'escalável (escada/trampolim)',water:'água',gate:'portão'};
function setRoleColor(k,hex){ const rgb=hexRgb(hex); if(!rgb||!HC_ROLE[k])return; HC_ROLE[k]=rgb; saveHcRole();
  _rebakeDirect(); rebuildExtras(); srSay('Cor de '+ROLE_LBL[k]+' alterada.'); }
function resetRoleColors(){ for(const k in HC_ROLE_DEF)HC_ROLE[k]=HC_ROLE_DEF[k].slice(); saveHcRole();
  _rebakeDirect(); rebuildExtras(); renderVisual(); srSay('Cores do color-blocking restauradas ao padrão.'); }
function renderVisual(){ const el=$('#visual-list'); if(!el)return; if(selVizPlayer>=numPlayers)selVizPlayer=0; // Contraste = 1 select (Desligado/3:1/4,5:1/7:1); o contorno tem os 2 selects próprios (no HTML abaixo)
  const cur=players[selVizPlayer]?players[selVizPlayer].viz:'normal', val=HC_SEQ.includes(cur)?cur:'normal';
  el.innerHTML='<div class="ctrl-row"><span><strong>Alto contraste</strong> — recolore o cenário para destacar o que importa; escolha o nível de contraste.</span>'+
    '<select id="opt-contrast" aria-label="Nível de alto contraste"><option value="normal">Desligado</option><option value="hc-direto">3:1 (agradável)</option><option value="hc-direto-45">4,5:1</option><option value="hc-direto-7">7:1 (máximo)</option></select></div>'+
    '<div class="ctrl-row"><span><strong>Realce de contraste (Linear → Quadrático)</strong> — curva de tom na tela inteira: o começo da faixa estica o contraste (linear), o fim realça sombras e altas-luzes (curva S quadrática). Zero desliga. Vale para todos os jogadores.</span>'+
    '<span style="display:flex;align-items:center;gap:.4rem"><input type="range" id="opt-lq" min="0" max="100" step="5" style="width:9em" aria-label="Realce de contraste: zero desligado, começo linear, fim quadrático"><strong id="opt-lq-val" aria-hidden="true"></strong></span></div>'+
    '<div class="ctrl-row"><span><strong>Itens na cor do dono</strong> — no multiplayer, cada jogador vê os próprios itens na cor dele. Desligado: itens na cor original para todos.</span>'+
    `<button id="opt-ownercolors" class="mode-btn${ownerColors?' is-on':''}" type="button" aria-pressed="${ownerColors}">${ownerColors?'❚❚ Ligado':'▶ Desligado'}</button></div>`+
    '<div class="ctrl-row"><span><strong>Paleta segura para daltonismo</strong> — troca as cores de jogadores, itens e efeitos pela paleta Okabe-Ito (distinguível em protan/deutan/tritan). O cenário mantém as cores naturais.</span>'+
    `<button id="opt-cbsafe" class="mode-btn${cbSafe?' is-on':''}" type="button" aria-pressed="${cbSafe}">${cbSafe?'❚❚ Ligado':'▶ Desligado'}</button></div>`+
    '<div class="ctrl-row"><span><strong>Cores do color-blocking</strong> — nos modos de alto contraste, escolha a cor de cada papel: perigo, escalável, água e portão. ↺ restaura o padrão.</span>'+
    '<span style="display:flex;gap:.35rem;align-items:center">'+
    ['hazard','climb','water','gate'].map(k=>`<input type="color" id="opt-role-${k}" value="${rgbHex(HC_ROLE[k])}" aria-label="Cor de ${ROLE_LBL[k]}" style="inline-size:2.2em;block-size:1.8em;padding:0;border:1px solid #666;border-radius:4px;background:none">`).join('')+
    '<button id="opt-role-reset" class="mode-btn" type="button" aria-label="Restaurar cores padrão">↺</button></span></div>';
  const s=$('#opt-contrast'); if(s){ s.value=val; s.addEventListener('change',()=>{ setPlayerViz(selVizPlayer,s.value); srSay('Alto contraste: '+HC_LABEL[s.value]+'.'); }); }
  const lq=$('#opt-lq'), lqv=$('#opt-lq-val');
  if(lq){ const refl=()=>{ if(lqv)lqv.textContent=lqName(lqT); }; lq.value=String(Math.round(lqT*100)); refl();
    lq.addEventListener('input',()=>{ setLq(+lq.value/100); refl(); });
    lq.addEventListener('change',()=>srSay('Realce de contraste: '+lqName(lqT)+'.')); }
  const oc=$('#opt-ownercolors'); if(oc)oc.addEventListener('click',()=>{ setOwnerColors(!ownerColors); renderVisual(); });
  const cb=$('#opt-cbsafe'); if(cb)cb.addEventListener('click',()=>{ setCbSafe(!cbSafe); renderVisual(); });
  ['hazard','climb','water','gate'].forEach(k=>{ const inp=$('#opt-role-'+k); if(inp)inp.addEventListener('change',()=>setRoleColor(k,inp.value)); });
  const rr=$('#opt-role-reset'); if(rr)rr.addEventListener('click',resetRoleColors);
  if(typeof reflectOutlines==='function')reflectOutlines(); }
// Dois contornos configuráveis (1º plano personagem/itens · 2º plano perímetro de plataforma/água/lava).
function _rebakeDirect(){ // invalida os caches de textura direta (mundo depende de bg; sprites de fg) e re-renderiza
  for(const k in _worldTexHC)delete _worldTexHC[k]; for(const k in _coinTexHC)delete _coinTexHC[k]; for(const k in _pupTexHC)delete _pupTexHC[k]; _playerDirect={}; _lastSharedViz=null;
  if(numPlayers<=1)applyVizGlobal(players[0].viz); else applyVpFilters(); }
function reflectOutlines(){ const f=$('#opt-outline-fg'), b=$('#opt-outline-bg'); if(f)f.value=String(hcOutlineFg); if(b)b.value=String(hcOutlineBg); }
function setOutlineFg(v){ hcOutlineFg=Math.max(0,Math.min(2,v|0)); try{localStorage.setItem('incl_outfg',hcOutlineFg);}catch(e){} _rebakeDirect(); reflectOutlines(); srSay('Contorno do primeiro plano: '+['nenhum','fino','grosso'][hcOutlineFg]+'.'); }
function setOutlineBg(v){ hcOutlineBg=Math.max(0,Math.min(2,v|0)); try{localStorage.setItem('incl_outbg',hcOutlineBg);}catch(e){} _rebakeDirect(); reflectOutlines(); srSay('Contorno do segundo plano: '+['nenhum','fino','grosso'][hcOutlineBg]+'.'); }
{ const f=$('#opt-outline-fg'); if(f)f.addEventListener('change',()=>setOutlineFg(+f.value)); const b=$('#opt-outline-bg'); if(b)b.addEventListener('change',()=>setOutlineBg(+b.value)); reflectOutlines(); }
function renderEmpathy(){ renderVizGroup('#empathy-list','#empathy-players',VIZ_SIM); const h=$('#opt-hearing'); if(h){ toggleBtn(h,hearingLoss); h.textContent=hearingLoss?'❚❚ Ligado':'▶ Desligado'; } if(typeof reflectMotorEmpathy==='function')reflectMotorEmpathy(); }
function reflectVizButtons(){ const help=players.some(p=>{const m=VIZ_BY_KEY[p.viz];return m&&m.kind==='hcnew';});
  const sim=players.some(p=>isSimKind((VIZ_BY_KEY[p.viz]||{}).kind));
  const bv=$('#opt-visual'); if(bv)bv.classList.toggle('is-on',help); const be=$('#opt-empathy'); if(be)be.classList.toggle('is-on',sim||hearingLoss||oneButton||wheelchair); }
// "tela = canvas": reparenta os diálogos de a11y para dentro do #game-region (ficam presos ao canvas)
// e empilha o último aberto por cima (z crescente). frontOverlay é chamado em cada open*.
let _ovZ=60;
// Explicações no RODAPÉ (não embaixo de cada opção): coleta a descrição de cada linha para data-explain,
// deixa só o rótulo na linha e mostra a descrição num rodapé fixo ao focar/passar o mouse. Menos cansativo.
function fillExplain(card){ if(!card)return;
  let f=card.querySelector('.opt-explain');
  if(!f){ f=document.createElement('div'); f.className='opt-explain'; f.setAttribute('aria-live','polite'); f.dataset.idle='Passe o mouse ou navegue pelas opções para ver a explicação.'; f.textContent=f.dataset.idle; card.appendChild(f); }
  card.querySelectorAll('.ctrl-row').forEach(row=>{ if(row.dataset.explainDone)return;
    const span=row.querySelector(':scope > span'); const strong=span&&span.querySelector('strong'); if(!span||!strong){ row.dataset.explainDone='1'; return; }
    const hint=span.querySelector('.opt-hint');
    let desc = hint ? hint.textContent.trim() : span.textContent.slice(strong.textContent.length).replace(/^\s*[—–-]\s*/,'').trim();
    row.dataset.explainDone='1'; if(!desc)return;
    row.dataset.explain=desc; span.innerHTML=strong.outerHTML; // deixa só o rótulo curto
    const show=()=>{ f.textContent=desc; }; const clear=()=>{ f.textContent=f.dataset.idle||''; };
    row.addEventListener('mouseenter',show); row.addEventListener('focusin',show); row.addEventListener('mouseleave',clear); });
}
function frontOverlay(el){ if(!el)return; el.style.zIndex=String(++_ovZ); const card=el.querySelector('.overlay__card'); if(card)fillExplain(card); }
(function inCanvasMenus(){ const gr=document.getElementById('game-region'); if(!gr)return;
  ['audio','movement','options','animation','visual','empathy','touchcfg','help','padwiz','typo','title-overlay'].forEach(id=>{ const el=document.getElementById(id); if(el)gr.appendChild(el); }); // NENHUMA tela fora do canvas (decisão definitiva do José — splash incluso)
  // Botões puramente on/off viram TOGGLE (switch) — o texto "Ligado/Desligado" fica oculto (font-size:0).
  ['opt-facil','opt-altmove','opt-hearing','opt-onebtn','opt-wheelchair','opt-modocego','opt-tts','opt-eyes','audio-master','opt-captions','motion-master'].forEach(id=>{ const b=document.getElementById(id); if(b)b.classList.add('switch'); });
})();
function openVisual(){ const ov=$('#visual'); if(!ov)return; renderVisual(); ov.hidden=false; frontOverlay(ov); visualOpen=true; const f=ov.querySelector('button[data-viz]')||ov.querySelector('button'); if(f)f.focus(); }
function closeVisual(){ const ov=$('#visual'); if(!ov)return; ov.hidden=true; visualOpen=false; const b=$('#opt-visual'); if(b)b.focus(); }
function openEmpathy(){ const ov=$('#empathy'); if(!ov)return; renderEmpathy(); ov.hidden=false; frontOverlay(ov); empathyOpen=true; const f=ov.querySelector('button'); if(f)f.focus(); }
function closeEmpathy(){ const ov=$('#empathy'); if(!ov)return; ov.hidden=true; empathyOpen=false; const b=$('#opt-empathy'); if(b)b.focus(); }
const visualBtn=$('#opt-visual'); if(visualBtn)visualBtn.addEventListener('click',openVisual);
const visualClose=$('#visual-close'); if(visualClose)visualClose.addEventListener('click',closeVisual);
const empathyBtn=$('#opt-empathy'); if(empathyBtn)empathyBtn.addEventListener('click',openEmpathy);
const empathyClose=$('#empathy-close'); if(empathyClose)empathyClose.addEventListener('click',closeEmpathy);
const hearingBtn=$('#opt-hearing'); if(hearingBtn)hearingBtn.addEventListener('click',()=>{ setHearingLoss(!hearingLoss); renderEmpathy(); reflectVizButtons(); });
if(store.getBool('incl_hearingloss')) setHearingLossGraph(true); // hearingLoss vive em platform/audio.js
// Empatia motora: um-botão e cadeirante
function reflectMotorEmpathy(){ const a=$('#opt-onebtn'); if(a){ a.classList.toggle('is-on',oneButton); a.setAttribute('aria-pressed',String(oneButton)); a.textContent=oneButton?'❚❚ Ligado':'▶ Desligado'; }
  const b=$('#opt-wheelchair'); if(b){ b.classList.toggle('is-on',wheelchair); b.setAttribute('aria-pressed',String(wheelchair)); b.textContent=wheelchair?'❚❚ Ligado':'▶ Desligado'; } reflectVizButtons(); }
function setOneButton(on){ oneButton=on; store.setBool('incl_onebtn',on); reflectMotorEmpathy(); srSay('Um botão por vez '+(on?'ligado: só uma tecla/botão de cada vez.':'desligado.')); }
function setWheelchair(on){ wheelchair=on; store.setBool('incl_wheelchair',on);
  players.forEach(p=>{ if(on && p.activePower!=='fly' && p.activePower!=='turbo') p.activePower='off'; if(on) p.owned=p.owned.filter(k=>k==='fly'||k==='turbo'); showPower(p); });
  setupExtras(); rebuildCoins(); buildWcGeom(); buildRamps(); buildElevators(); reflectMotorEmpathy(); // só voo/super-corrida; moedas no chão; escada/trampolim viram elevador; rampas+pontes; lava vira chão
  srSay('Modo cadeirante '+(on?'ligado: sem pulo; rampas e elevadores no lugar de degraus e escada; moedas no chão; só voo e super-corrida.':'desligado.')); }
const oneBtn=$('#opt-onebtn'); if(oneBtn)oneBtn.addEventListener('click',()=>setOneButton(!oneButton));
const wheelBtn=$('#opt-wheelchair'); if(wheelBtn)wheelBtn.addEventListener('click',()=>setWheelchair(!wheelchair));
// bolinha indicadora: duplo toque/clique → volta às cores normais (em cegueira é a única saída visível)
(function vizIndicator(){ const el=$('#viz-indicator'); if(!el)return; let last=-9999;
  el.addEventListener('pointerdown',(e)=>{ e.preventDefault(); const t=e.timeStamp||0; if(t-last<450){ setPlayerViz(0,'normal'); last=-9999; srSay('Cores normais reativadas.'); } else last=t; }); })();
loadPlayerA11y(players[0],0); // carrega viz/easy/alternância persistidos do jogador 1 (migra chaves antigas)
vizReady=true; applyVizGlobal(players[0].viz); // estado inicial (solo)

/* TIPOGRAFIA — menu próprio na pausa (saiu da Sensibilidade visual, pedido do José 2026-07-02).
   3 grupos, UMA fonte ativa (radio), pré-visualização com o pangrama "Juiz foge e bota fita de cetim
   na xícara". Todas as fontes hospedadas são SIL OFL 1.1 (política do fonts.css); as canônicas EdSP
   mantêm o mecanismo antigo (Lexend preserva o espaçamento BDA via data-fonte="dislexia"). */
// FONT_GROUPS/FONT_BY_KEY/loadFontKey extraídos p/ ui/fonts.js (Fase 2, tipografia).
let fontKey=loadFontKey();
function setGameFont(k,announce){ const it=FONT_BY_KEY[k]; if(!it||it.off)return; fontKey=k;
  saveFontKey(k);
  const root=document.documentElement;
  if(k==='atkinson'){ root.dataset.fonte='padrao'; root.style.removeProperty('--font-custom'); }
  else if(k==='andika'){ root.dataset.fonte='alfabetizacao'; root.style.removeProperty('--font-custom'); }
  else if(k==='lexend'){ root.dataset.fonte='dislexia'; root.style.removeProperty('--font-custom'); } // mantém o espaçamento BDA
  else { root.dataset.fonte='custom'; root.style.setProperty('--font-custom', `'${it.fam}'${it.fb==='serif'?',Georgia,serif':it.fb==='cursive'?',cursive':''}`); }
  const pv=$('#typo-preview'); if(pv)pv.style.fontFamily=`'${it.fam}'`;
  if(announce)srSay('Tipografia: '+it.fam+'.'); }
function renderTypo(){ const el=$('#typo-list'); if(!el)return;
  el.innerHTML=FONT_GROUPS.map(g=>`<h3 class="panel-sub">${g.g}</h3>`+g.items.map(it=>{
    const on=fontKey===it.k, dis=!!it.off, note=it.d?it.d+(dis?' — '+it.off:''):(dis?it.off:'');
    return `<div class="ctrl-row"><span style="font-family:'${it.fam}'"><strong>${it.fam}</strong>${note?`<br><span class="opt-hint" style="margin:0;font-family:var(--font)">${note}</span>`:''}</span>`+
      `<button class="mode-btn switch${on?' is-on':''}" data-font="${it.k}" type="button"${dis?' disabled':''} aria-pressed="${on}" aria-label="${it.fam}${note?' — '+note:''}">${on?'❚❚ Ligado':'▶ Desligado'}</button></div>`; }).join('')).join('');
  el.querySelectorAll('button[data-font]').forEach(b=>b.addEventListener('click',()=>{ setGameFont(b.dataset.font,true); renderTypo(); }));
  const cur=FONT_BY_KEY[fontKey]; const pv=$('#typo-preview'); if(pv&&cur)pv.style.fontFamily=`'${cur.fam}'`;
}
let typoOpen=false;
function openTypo(){ const ov=$('#typo'); if(!ov)return; renderTypo(); ov.hidden=false; frontOverlay(ov); typoOpen=true;
  const f=ov.querySelector('button[data-font]:not([disabled])')||ov.querySelector('button'); if(f)f.focus(); }
function closeTypo(){ const ov=$('#typo'); if(!ov)return; ov.hidden=true; typoOpen=false; menuFocus(sharedDialogOpen()); }
{ const b=$('#typo-close'); if(b)b.addEventListener('click',closeTypo); }
setGameFont(fontKey,false);

/* F1: menu de áudio (mixer por categoria) — o botão "Som" abre este menu */
function reflectAudioMaster(){ const b=$('#audio-master'); if(b){ b.classList.toggle('is-on',soundOn); b.setAttribute('aria-pressed',String(soundOn)); b.textContent=soundOn?'🔊 Ligado':'🔇 Desligado'; } const v=$('#audio-master-vol'); if(v)v.value=Math.round(volume*100); const sb=$('#opt-sound'); if(sb)toggleBtn(sb,soundOn); }
// Categorias divididas: NAVEGAÇÃO SONORA (sonar/guarda/guia) e GERAL do jogo. TTS fica na seção Voz.
const NAV_CATS=['sonar','guard','guide'], GEN_CATS=['music','ambient','interact','earcons','other'];
function catRowHTML(k){ const c=AUDIO_CATS.find(x=>x.k===k), a=audioCat[k]; return `<div class="ctrl-row"><span>${c.lbl}</span><span style="display:flex;gap:.5rem;align-items:center;flex-shrink:0"><input class="vol" type="range" min="0" max="100" step="5" value="${Math.round(a.vol*100)}" data-avol="${k}" aria-label="Volume de ${c.lbl}"><button class="mode-btn switch${a.on?' is-on':''}" data-acat="${k}" type="button" aria-pressed="${a.on}" aria-label="${c.lbl}"></button></span></div>`; }
function wireCatControls(el){
  el.querySelectorAll('button[data-acat]').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.acat; audioCat[k].on=!audioCat[k].on; setCatGain(k); b.classList.toggle('is-on',audioCat[k].on); b.setAttribute('aria-pressed',String(audioCat[k].on)); }));
  el.querySelectorAll('input[data-avol]').forEach(s=>s.addEventListener('input',()=>{ const k=s.dataset.avol; audioCat[k].vol=(+s.value)/100; audioCat[k].on=true; setCatGain(k); const bb=el.querySelector('button[data-acat="'+k+'"]'); if(bb){bb.classList.add('is-on');bb.setAttribute('aria-pressed','true');} }));
}
function renderNavSound(){ const el=$('#navsound-list'); if(el){ el.innerHTML=NAV_CATS.map(catRowHTML).join(''); wireCatControls(el); }
  const m=$('#navsound-master'); if(m)m.value=Math.round(Math.max(...NAV_CATS.map(k=>audioCat[k].vol))*100); }
function renderAudio(){ reflectAudioMaster();
  const el=$('#audio-list'); if(el){ el.innerHTML=GEN_CATS.map(catRowHTML).join(''); wireCatControls(el); }
  renderNavSound();
  const tv=$('#tts-vol'); if(tv)tv.value=Math.round(audioCat.tts.vol*100);
}
function openAudio(){ const ov=$('#audio'); if(!ov)return; ensureAC(); renderAudio(); reflectModoCego(); reflectTTS(); populateTTSEngines(); populateTTSVoices(); enumerateSinks(); const cd=$('#cane-div'); if(cd)cd.value=String(caneBlockDiv); ov.hidden=false; frontOverlay(ov); audioOpen=true; const f=ov.querySelector('button'); if(f)f.focus(); }
function closeAudio(){ const ov=$('#audio'); if(!ov)return; ov.hidden=true; audioOpen=false; const b=$('#opt-sound'); if(b)b.focus(); }
// A12e auditiva: Modo cego (só áudio) + seleção de voz (Web Speech agora; neurais em breve)
function reflectModoCego(){ const b=$('#opt-modocego'); if(b){ toggleBtn(b,modoCego); b.textContent=modoCego?'❚❚ Ligado':'▶ Desligado'; } }
function reflectTTS(){ const b=$('#opt-tts'); if(b){ toggleBtn(b,audioCat.tts.on); b.textContent=audioCat.tts.on?'❚❚ Ligado':'▶ Desligado'; } const e=$('#tts-engine'); if(e)e.value=tts.getEngineSel(); }
function populateTTSEngines(){ const sel=$('#tts-engine'); if(!sel||sel.dataset.filled)return; sel.dataset.filled='1';
  [['webspeech','Voz do navegador (Web Speech)'],['piper','Piper (neural, offline) — baixa no 1º uso'],['kokoro','Kokoro-82M (neural) — baixa no 1º uso'],['kitten','Kitten (neural) — baixa no 1º uso'],['espeak','eSpeak NG (embutido)']]
    .forEach(([v,l])=>{ const o=document.createElement('option'); o.value=v; o.textContent=l; sel.appendChild(o); }); sel.value=tts.getEngineSel(); }
function populateTTSVoices(){ const sel=$('#tts-voice'); if(!sel)return; let voices=[]; try{ voices=(window.speechSynthesis&&window.speechSynthesis.getVoices())||[]; }catch(e){}
  const pt=voices.filter(v=>/^pt/i.test(v.lang)), list=pt.length?pt:voices; sel.innerHTML='';
  if(!list.length){ const o=document.createElement('option'); o.textContent='(sem vozes do sistema)'; sel.appendChild(o); tts.setVoiceObj(null); return; }
  list.forEach(v=>{ const o=document.createElement('option'); o.value=v.name; o.textContent=v.name+' ('+v.lang+')'; sel.appendChild(o); });
  const saved=(()=>{try{return localStorage.getItem('incl_tts_voice');}catch(e){return null;}})(); const pick=list.find(v=>v.name===saved)||list[0]; sel.value=pick.name; tts.setVoiceObj(pick); }
const mcBtn=$('#opt-modocego'); if(mcBtn)mcBtn.addEventListener('click',()=>{ setModoCego(!modoCego); reflectModoCego(); });
const caneDivSel=$('#cane-div'); if(caneDivSel){ caneDivSel.value=String(caneBlockDiv); caneDivSel.addEventListener('change',()=>{ caneBlockDiv=+caneDivSel.value||1; store.set('incl_cane_div',String(caneBlockDiv)); srSay('Bengala: '+(caneBlockDiv===2?'uma batida a cada meio bloco pisado.':'uma batida por bloco pisado.')); }); }
// Botões abreviados: hover/foco DESCOMPACTA o número em letras (o "12" vira as 12 letras contando p/ baixo), suave;
// recomprime ao sair. Genérico: varre a barra (.mode-btn) E o menu de pausa (.pm-btn) casando A12e/S11e.
const ABBR_MID={ 'A12e':'cessibilidad', 'S11e':'ensibilidad' }; // token → letras ocultas (Acessibilidade / Sensibilidade)
function attachAbbr(b){ if(!b||b.dataset.abbrDone)return; const txt=b.textContent; let tok=null;
  for(const t in ABBR_MID){ if(txt.includes(t)){ tok=t; break; } } if(!tok)return;
  const i=txt.indexOf(tok), pre=txt.slice(0,i+1), suf=txt.slice(i+tok.length-1), hid=ABBR_MID[tok], N=hid.length; // pre inclui a 1ª letra; suf começa na última
  b.dataset.abbrDone='1'; let k=0,tgt=0,timer=null;
  const render=()=>{ b.textContent=pre+hid.slice(0,k)+((N-k>0)?String(N-k):'')+suf; };
  const tick=()=>{ if(k===tgt){ clearInterval(timer); timer=null; return; } k+=k<tgt?1:-1; render(); };
  const go=(t)=>{ tgt=t; if(!timer)timer=setInterval(tick,16); };
  render(); b.addEventListener('mouseenter',()=>go(N)); b.addEventListener('mouseleave',()=>go(0)); b.addEventListener('focus',()=>go(N)); b.addEventListener('blur',()=>go(0)); }
document.querySelectorAll('.mode-btn, .pm-btn').forEach(attachAbbr);
const ttsBtn=$('#opt-tts'); if(ttsBtn)ttsBtn.addEventListener('click',()=>{ audioCat.tts.on=!audioCat.tts.on; setCatGain('tts'); reflectTTS(); srSay('Narração '+(audioCat.tts.on?'ligada.':'desligada.')); if(audioCat.tts.on)tts.narrate('Narração por voz ligada.'); });
const ttsEngSel=$('#tts-engine'); if(ttsEngSel)ttsEngSel.addEventListener('change',()=>{ tts.setEngineSel(ttsEngSel.value); try{localStorage.setItem('incl_tts_engine',ttsEngSel.value);}catch(e){} if(ttsEngSel.value!=='webspeech')tts.loadTTS(); tts.narrate('Motor de voz: '+ttsEngSel.options[ttsEngSel.selectedIndex].text+'.'); });
const ttsVoiceSel=$('#tts-voice'); if(ttsVoiceSel)ttsVoiceSel.addEventListener('change',()=>{ try{ const vs=window.speechSynthesis.getVoices(); tts.setVoiceObj(vs.find(v=>v.name===ttsVoiceSel.value)||null); localStorage.setItem('incl_tts_voice',ttsVoiceSel.value); }catch(e){} tts.narrate('Voz selecionada.'); });
const ttsTestBtn=$('#opt-tts-test'); if(ttsTestBtn)ttsTestBtn.addEventListener('click',()=>{ const txt='Olá! Esta é a voz da narração do Inclusionista. Um, dois, três, testando.';
  const _te=tts.getEngine(); if(tts.getEngineSel()!=='webspeech' && _te && _te.speak){ try{ _te.speak(txt); }catch(e){} } // motor neural já carregado
  else { try{ const ss=window.speechSynthesis; if(ss){ ss.cancel(); const u=new SpeechSynthesisUtterance(txt); u.lang='pt-BR'; const _vo=tts.getVoiceObj(); if(_vo)u.voice=_vo; u.rate=1; u.volume=1; ss.speak(u); } }catch(e){} if(tts.getEngineSel()!=='webspeech')tts.loadTTS(); } // fallback audível (volume 1) + dispara download do neural
  srSay('Testando a voz selecionada.'); });
try{ if(window.speechSynthesis) window.speechSynthesis.onvoiceschanged=populateTTSVoices; }catch(e){}
const navMasterEl=$('#navsound-master'); if(navMasterEl)navMasterEl.addEventListener('input',()=>{ const v=(+navMasterEl.value)/100; NAV_CATS.forEach(k=>{ audioCat[k].vol=v; audioCat[k].on=true; setCatGain(k); }); renderNavSound(); }); // volume geral da navegação sonora (separado do som do jogo)
const ttsVolEl=$('#tts-vol'); if(ttsVolEl)ttsVolEl.addEventListener('input',()=>{ audioCat.tts.vol=(+ttsVolEl.value)/100; audioCat.tts.on=true; setCatGain('tts'); reflectTTS(); }); // volume da narração vive na seção Voz
// Saída de áudio POR JOGADOR (setSinkId): detecta fones/caixas e atribui 1 por jogador
let _audioDevices=[];
async function detectAudioDevices(){ try{ await navigator.mediaDevices.getUserMedia({audio:true}).then(s=>s.getTracks().forEach(t=>t.stop())).catch(()=>{}); const devs=await navigator.mediaDevices.enumerateDevices(); _audioDevices=devs.filter(d=>d.kind==='audiooutput'); }catch(e){ _audioDevices=[]; } renderAudioSinks(); }
async function enumerateSinks(){ try{ if(navigator.mediaDevices&&navigator.mediaDevices.enumerateDevices){ const devs=await navigator.mediaDevices.enumerateDevices(); _audioDevices=devs.filter(d=>d.kind==='audiooutput'); } }catch(e){} renderAudioSinks(); } // sem pedir permissão: só lista as saídas na caixa de seleção
function renderAudioSinks(){ const el=$('#audio-sinks'); if(!el)return; el.innerHTML='';
  const supported=!!(navigator.mediaDevices&&navigator.mediaDevices.enumerateDevices)&&(typeof (window.AudioContext||window.webkitAudioContext)!=='undefined');
  if(!_audioDevices.length){ el.innerHTML='<p class="opt-hint">'+(supported?'Clique em Detectar (pede permissão de áudio para listar os aparelhos).':'Este navegador não suporta troca de saída (ex.: Safari/iOS).')+'</p>'; return; }
  for(let i=0;i<Math.max(1,numPlayers);i++){ const p=players[i]; const row=document.createElement('div'); row.className='ctrl-row';
    const lbl=document.createElement('label'); lbl.textContent='Jogador '+(i+1); lbl.setAttribute('for','sink-p'+i);
    const sel=document.createElement('select'); sel.className='vol'; sel.id='sink-p'+i;
    const o0=document.createElement('option'); o0.value=''; o0.textContent='Padrão (compartilhado)'; sel.appendChild(o0);
    _audioDevices.forEach((d,k)=>{ const o=document.createElement('option'); o.value=d.deviceId; o.textContent=d.label||('Saída '+(k+1)); sel.appendChild(o); });
    sel.value=(p&&p.audioSink)||'';
    sel.addEventListener('change',()=>{ if(!p)return; p.audioSink=sel.value||null; try{localStorage.setItem('incl_sink_p'+i,p.audioSink||'');}catch(e){} if(p._ac){ try{p._ac.close();}catch(e){} p._ac=null; p._acOut=null; } srSay('Jogador '+(i+1)+' — saída de áudio '+(p.audioSink?'trocada.':'padrão.')); });
    row.appendChild(lbl); row.appendChild(sel); el.appendChild(row); } }
const audioDetectBtn=$('#audio-detect'); if(audioDetectBtn)audioDetectBtn.addEventListener('click',detectAudioDevices);
// DESIGN DOS BOTÕES na tela por controle (Gamepad API: 0=baixo/pulo·sim, 1=direita/especial·não, 2=esquerda/interação, 3=cima/troca-poder)
// PAD_DESIGNS extraído p/ input/devices.js (Fase 2).
let padDesign=store.get('incl_paddesign','generic'); // padrão Windows = Genérico (números)
// Sim/Não nos menus: SÓ Sony e Nintendo invertem os botões 0↔1 (confirmar = ○/A à direita, cultural).
// Xbox/Genérico: sim = botão 0 (A verde / "0"), não = botão 1 (B vermelho / "1").
function simNaoGlyphs(){ const set=PAD_DESIGNS[padDesign]||PAD_DESIGNS.generic; const inv=(padDesign==='sony'||padDesign==='nintendo');
  return { sim:set[inv?'1':'0'], nao:set[inv?'0':'1'] }; }
function renderPauseLegend(){ const g=simNaoGlyphs();
  const chip=(s,word)=>`<span class="lg"><span class="lg-ico" style="background:${s[1]}">${s[0]}</span> ${word}</span>`;
  const html=chip(g.sim,'Sim')+chip(g.nao,'Não');
  document.querySelectorAll('.pause-legend').forEach(el=>{ el.innerHTML=html; }); } // todas as pausas por tela
function applyPadDesign(d){ if(d&&PAD_DESIGNS[d])padDesign=d; store.set('incl_paddesign',padDesign); const set=PAD_DESIGNS[padDesign]||PAD_DESIGNS.generic;
  document.querySelectorAll('#pad-diamond .pad-b').forEach(b=>{ const s=set[b.dataset.btn]; if(s){ b.textContent=s[0]; b.style.background=s[1]; } }); renderPauseLegend(); }
applyPadDesign(padDesign);
// START (pílula): função vem do touchMap (padrão pausar) — a fiação fica no touchSetup, junto do doTouch.
function padLayoutFromId(id){ id=(id||'').toLowerCase(); if(/dualshock|dualsense|playstation|054c/.test(id))return 'sony'; if(/switch|nintendo|joy-con|057e/.test(id))return 'nintendo'; if(/xbox|xinput|microsoft|045e/.test(id))return 'microsoft'; return 'generic'; }
addEventListener('gamepadconnected', (e)=>{ try{ applyPadDesign(padLayoutFromId(e.gamepad.id)); const sel=$('#pad-design'); if(sel)sel.value=padDesign; srSay('Controle conectado: layout '+padDesign+'.'); }catch(err){} }); // A2: layout pelo id do controle
const padDesignSel=$('#pad-design'); if(padDesignSel){ padDesignSel.value=padDesign; padDesignSel.addEventListener('change',()=>{ applyPadDesign(padDesignSel.value); srSay('Desenho dos botões: '+padDesignSel.value+'.'); }); } // A4: escolha manual (DirectInput/genérico)
// TAMANHO FÍSICO (mm) dos botões de toque — NÃO px. WCAG mede alvos de toque físicos, não botões
// virtuais sobre canvas. Conversão mm→px ancorada no iPhone 16 a tela cheia (aresta longa 141,1mm
// do display 1179×2556 @460ppi → ~6,04 px CSS/mm). No aparelho-alvo fica exato; noutros, proporcional.
// Defaults baseados na ciência (botões que se SEGURA + multitoque, não toque fino):
//  botão 12,5mm (piso 11mm > alvo de polegar Parhi 9,6mm; segurar cansa mais em botão pequeno),
//  folga 3mm (evita apertar 2 sem esticar o polegar), analógico 18mm (capuz físico ~18–20mm),
//  deslocamento 4,5mm. Faixa criança↔adulto estreita: crianças NÃO devem ir a alvos minúsculos.
const IPHONE16_LONG_MM=141.1, IPHONE16_LONG_PX=852, IPHONE16_PXMM=IPHONE16_LONG_PX/IPHONE16_LONG_MM; // ~6,04 px CSS/mm
// No CELULAR (alvo real), ancora na aresta longa da janela ÷ 141,1mm — funciona em retrato E paisagem (max()) e
// dá o físico exato por aparelho (no iPhone 16, 6,04 px/mm). No DESKTOP/notebook (ponteiro fino, isMobile=false)
// a janela larga NÃO é a aresta física de 141mm de um celular: usar o window-anchor inflava o pad (12,5mm→~170px
// num monitor 1920). Aí fixa no ratio do iPhone 16 → o pad aparece no tamanho FÍSICO do aparelho-alvo (~75px),
// estável (não cresce com a janela). Preview fiel ao que a criança vê no celular.
function padPxPerMm(){ return isMobile() ? Math.max(window.innerWidth,window.innerHeight)/IPHONE16_LONG_MM : IPHONE16_PXMM; }
const padLoad=(k,d)=>store.getNum(k,d);
let padBtnMm=padLoad('incl_padbtnmm',12.5), padGapMm=padLoad('incl_padgapmm',3);
let padStickMm=padLoad('incl_padstickmm',18), padTravelMm=padLoad('incl_padtravelmm',4.5);
let padDpadMm=padLoad('incl_paddpadmm',12); // comprimento do braço da cruz (D-pad físico real ~10–13mm)
let padDir=store.get('incl_paddir','stick'); // 'stick' | 'cross'
let _stickTravelPx=42, _stickDeadPx=12; // atualizados por applyPadPhysical; lidos pelo joystick
function padHandTag(v,lo,hi){ return v<=lo?'crianca':v>=hi?'adulto':'inter'; }
function applyDirStyle(){ const st=$('#touch-stick'), cr=$('#touch-cross'); if(st)st.hidden=(padDir==='cross'); if(cr)cr.hidden=(padDir!=='cross'); const sel=$('#pad-dir'); if(sel&&sel.value!==padDir)sel.value=padDir; }
function applyPadPhysical(){ const r=padPxPerMm();
  const btn=padBtnMm*r, gap=padGapMm*r, diam=btn+Math.SQRT2*(btn+gap); // losango: folga de aresta = gap
  const knob=padStickMm*r, travel=padTravelMm*r, base=knob+2*travel+16; // base do analógico = contato + curso
  const arm=padDpadMm*r, aw=arm*0.8, span=2*arm+aw; // cruz: braço (comprimento) + largura (0,8×) → vão total
  _stickTravelPx=travel; _stickDeadPx=Math.max(6,travel*0.4); // deslocamento útil + zona-morta (~40% do curso)
  const S=document.documentElement.style;
  S.setProperty('--pad-btn',btn.toFixed(1)+'px'); S.setProperty('--pad-diam',diam.toFixed(1)+'px');
  S.setProperty('--stick-knob',knob.toFixed(1)+'px'); S.setProperty('--stick-base',base.toFixed(1)+'px');
  S.setProperty('--dpad-arm-l',arm.toFixed(1)+'px'); S.setProperty('--dpad-arm-w',aw.toFixed(1)+'px'); S.setProperty('--dpad-span',span.toFixed(1)+'px');
  const fmt=(n)=>n.toFixed(1).replace('.',','), lbl={crianca:'mão de criança',adulto:'mão de adulto',inter:'intermediário'};
  const upd=(valId,tagId,mm,lo,hi,slId)=>{ const v=$(valId); if(v)v.textContent=fmt(mm)+' mm'; const t=$(tagId); if(t){ const w=padHandTag(mm,lo,hi); t.dataset.who=w; t.textContent=lbl[w]; } const s=$(slId); if(s&&parseFloat(s.value)!==mm)s.value=mm; };
  upd('#pad-size-val','#pad-size-tag',padBtnMm,12.5,13,'#pad-size');
  upd('#pad-gap-val','#pad-gap-tag',padGapMm,3,4.5,'#pad-gap');
  upd('#pad-stick-val','#pad-stick-tag',padStickMm,17,19,'#pad-stick');
  upd('#pad-travel-val','#pad-travel-tag',padTravelMm,4,5.5,'#pad-travel');
  upd('#pad-dpad-val','#pad-dpad-tag',padDpadMm,12,14,'#pad-dpad'); }
function setPadMm(o){ if(o.btn!=null)padBtnMm=o.btn; if(o.gap!=null)padGapMm=o.gap; if(o.stick!=null)padStickMm=o.stick; if(o.travel!=null)padTravelMm=o.travel; if(o.dpad!=null)padDpadMm=o.dpad;
  store.set('incl_padbtnmm',padBtnMm);store.set('incl_padgapmm',padGapMm);store.set('incl_padstickmm',padStickMm);store.set('incl_padtravelmm',padTravelMm);store.set('incl_paddpadmm',padDpadMm); applyPadPhysical(); }
applyPadPhysical(); applyDirStyle();
addEventListener('resize',applyPadPhysical); // recalcula os px ao girar/redimensionar; os mm são fixos
const padSizeEl=$('#pad-size'); if(padSizeEl)padSizeEl.addEventListener('input',()=>setPadMm({btn:parseFloat(padSizeEl.value)}));
const padGapEl=$('#pad-gap'); if(padGapEl)padGapEl.addEventListener('input',()=>setPadMm({gap:parseFloat(padGapEl.value)}));
const padStickEl=$('#pad-stick'); if(padStickEl)padStickEl.addEventListener('input',()=>setPadMm({stick:parseFloat(padStickEl.value)}));
const padTravelEl=$('#pad-travel'); if(padTravelEl)padTravelEl.addEventListener('input',()=>setPadMm({travel:parseFloat(padTravelEl.value)}));
const padDpadEl=$('#pad-dpad'); if(padDpadEl)padDpadEl.addEventListener('input',()=>setPadMm({dpad:parseFloat(padDpadEl.value)}));
const padDirSel=$('#pad-dir'); if(padDirSel){ padDirSel.value=padDir; padDirSel.addEventListener('change',()=>{ padDir=padDirSel.value; store.set('incl_paddir',padDir); applyDirStyle(); srSay('Direcional: '+(padDir==='cross'?'cruz (D-pad)':'analógico')+'.'); }); }
const padPresetChild=$('#pad-preset-child'); if(padPresetChild)padPresetChild.addEventListener('click',()=>{ setPadMm({btn:12,gap:2.5,stick:16.5,travel:4,dpad:11.5}); srSay('Controles no tamanho de mão de criança (6 a 12 anos).'); });
const padPresetAdult=$('#pad-preset-adult'); if(padPresetAdult)padPresetAdult.addEventListener('click',()=>{ setPadMm({btn:14,gap:4.5,stick:20,travel:5.5,dpad:14}); srSay('Controles no tamanho de mão de adulto.'); });
// REMAPEAR a FUNÇÃO de cada botão de toque (9 posições → ação). Lido ao vivo pelos handlers de toque.
// TOUCH_ACT_LABELS extraído p/ input/devices.js (Fase 2).
const TOUCH_ACTS=['left','right','up','down','jump','run','especial','swap','pause'];
const TOUCH_SLOTS=[ {k:'up',lbl:'Direcional ↑ (cima)'},{k:'down',lbl:'Direcional ↓ (baixo)'},{k:'left',lbl:'Direcional ← (esquerda)'},{k:'right',lbl:'Direcional → (direita)'},{k:'start',lbl:'START (enter)'},{k:'b0',lbl:'Botão 0 (baixo)'},{k:'b1',lbl:'Botão 1 (direita)'},{k:'b2',lbl:'Botão 2 (esquerda)'},{k:'b3',lbl:'Botão 3 (cima)'} ];
// TOUCH_DEFAULT extraído p/ input/devices.js (Fase 2).
let touchMap=(()=>{ const s=store.getJSON('incl_touchmap',null); return Object.assign({},TOUCH_DEFAULT, s&&typeof s==='object'?s:{}); })();
function renderTouchMap(){ const el=$('#touchmap-list'); if(!el)return;
  el.innerHTML=TOUCH_SLOTS.map(s=>`<div class="ctrl-row"><label for="tm-${s.k}">${s.lbl}</label><select id="tm-${s.k}" class="vol" data-slot="${s.k}">${TOUCH_ACTS.map(a=>`<option value="${a}"${touchMap[s.k]===a?' selected':''}>${TOUCH_ACT_LABELS[a]}</option>`).join('')}</select></div>`).join('');
  el.querySelectorAll('select[data-slot]').forEach(sel=>sel.addEventListener('change',()=>{ touchMap[sel.dataset.slot]=sel.value; store.setJSON('incl_touchmap',touchMap); srSay((sel.previousElementSibling?sel.previousElementSibling.textContent:'Botão')+': '+TOUCH_ACT_LABELS[sel.value]+'.'); }));
}
// JOGAR COM OS OLHOS: eyeMode/eyeSet/onGaze/startEyeControl/stopEyeControl/loadWebGazer → ui/webcam.js (Estágio 4, Tier 1).
const eyesBtn=$('#opt-eyes'); if(eyesBtn)eyesBtn.addEventListener('click',()=>{ setEyeMode(!eyeMode); toggleBtn(eyesBtn,eyeMode); eyesBtn.textContent=eyeMode?'❚❚ Ligado':'▶ Desligado';
  if(eyeMode){ loadWebGazer(startEyeControl); srSay('Jogar com os olhos: carregando a webcam (permita o acesso).'); } else { stopEyeControl(); srSay('Jogar com os olhos desligado.'); } });
const audioMasterBtn=$('#audio-master'); if(audioMasterBtn)audioMasterBtn.addEventListener('click',()=>{ setSoundOn(!soundOn); reflectAudioMaster(); srSay('Som '+(soundOn?'ligado.':'desligado.')); });
const audioMasterVol=$('#audio-master-vol'); if(audioMasterVol)audioMasterVol.addEventListener('input',()=>{ setVolume((+audioMasterVol.value)/100); if(volume>0&&!soundOn){ setSoundOn(true); reflectAudioMaster(); } });
const audioCloseBtn=$('#audio-close'); if(audioCloseBtn)audioCloseBtn.addEventListener('click',closeAudio);
reflectAudioMaster();

/* E10: remap de controles + persistência (B2) */
const ACT_LABEL={left:'Esquerda',right:'Direita',up:'Subir / escada',down:'Descer / escada',run:'Correr / interagir',jump:'Pular',swap:'Trocar poder',especial:'Especial'};
function keyName(code){ return String(code).replace('Arrow','↔').replace('Key','').replace('Space','Espaço').replace('ShiftLeft','Shift').replace('ShiftRight','Shift'); }
let selPlayer=0; // jogador selecionado no diálogo de Controles
function renderControls(){ const el=$('#ctrl-list'); if(!el)return;
  if(selPlayer>=numPlayers) selPlayer=0;
  const tabs=$('#ctrl-players'); // E3: sem abas de outros jogadores — você edita SÓ o seu controle
  if(tabs){ tabs.hidden=false; tabs.innerHTML=`<span class="opt-hint" style="width:100%;margin:0">Editando o <strong>seu</strong> controle — modo <strong>${numPlayers===1?'1 jogador':numPlayers+' jogadores'}</strong>.</span>`; }
  const map=kbFor(selPlayer);
  el.innerHTML=Object.keys(ACT_LABEL).map(a=>`<div class="ctrl-row"><span>${ACT_LABEL[a]}: ${(map[a]||[]).map(keyName).map(k=>`<kbd>${k}</kbd>`).join(' ')}</span><button class="mode-btn" data-act="${a}" type="button" aria-label="Alterar tecla de ${ACT_LABEL[a]} do Jogador ${selPlayer+1}">Alterar</button></div>`).join('');
  el.querySelectorAll('button[data-act]').forEach(b=>b.addEventListener('click',()=>{ captureAction=b.dataset.act; captureMapRef=kbFor(selPlayer); b.textContent='Pressione…'; srAlert('Pressione a nova tecla para '+ACT_LABEL[b.dataset.act]+' do Jogador '+(selPlayer+1)+', ou Esc para cancelar.'); }));
}
function openOptions(){ const ov=$('#options'); if(!ov)return; selPlayer=pauseActor; renderControls(); ov.hidden=false; frontOverlay(ov); optionsOpen=true; const f=ov.querySelector('button'); if(f)f.focus(); } // E3: edita o controle do jogador que abriu
function closeOptions(){ const ov=$('#options'); if(!ov)return; ov.hidden=true; optionsOpen=false; captureAction=null; const b=$('#opt-controls'); if(b)b.focus(); }
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
let selAnimPlayer=0;
function renderMotion(){ const el=$('#motion-list'); if(!el)return; if(selAnimPlayer>=numPlayers)selAnimPlayer=0;
  const tabs=$('#animation-players'); if(tabs){ tabs.hidden=true; // E3: sem abas — cada jogador edita só o seu
    tabs.innerHTML='';
    tabs.querySelectorAll('button[data-ap]').forEach(b=>b.addEventListener('click',()=>{ selAnimPlayer=+b.dataset.ap; renderMotion(); })); }
  const p=players[selAnimPlayer];
  // Switch = "animação LIGADA" (rm/prop true = congelado ⇒ switch DESLIGADO). Antes o switch acendia
  // no congelado e lia-se invertido em relação ao rótulo da linha (report do José 2026-07-02).
  const row=(lbl,frozen,attr,soon)=>{ const on=!frozen; return `<div class="ctrl-row"><span>${lbl}${soon?' <em style="opacity:.7">(em breve)</em>':''}</span><button class="mode-btn switch${on?' is-on':''}" ${attr} type="button" aria-pressed="${on}" aria-label="${lbl}: ${on?'animação ligada':'animação congelada'}">${on?'▶ Animado':'❄ Congelado'}</button></div>`; };
  const charRows=RM_CHAR.map(c=>row(c.lbl, p&&p[c.prop], 'data-rmc="'+c.prop+'"', false)).join('');
  const sceneRows=RM_KEYS.map(k=>row(RM_LABEL[k], rm[k], 'data-rm="'+k+'"', RM_SOON.has(k))).join('');
  const CRT_LBL={scan:'Scanlines',vig:'Vinheta',round:'Cantos arredondados'};
  // Scanlines/Vinheta = TOGGLE on/off; Cantos = 3 níveis (desligado=quadrado · pequeno=padrão · grande=24px)
  const crtTgl=k=>{ const on=!!CRT[k]; return `<div class="ctrl-row"><span>${CRT_LBL[k]}</span><button class="mode-btn switch${on?' is-on':''}" data-crt-tgl="${k}" type="button" aria-pressed="${on}" aria-label="${CRT_LBL[k]}: ${on?'ligado':'desligado'}">${on?'❚❚ Ligado':'▶ Desligado'}</button></div>`; };
  const crtRound=`<div class="ctrl-row"><span>${CRT_LBL.round}</span><select class="vol" data-crt="round" aria-label="${CRT_LBL.round}"><option value="0"${CRT.round===0?' selected':''}>Desligado (quadrado)</option><option value="1"${CRT.round===1?' selected':''}>Pequeno</option><option value="2"${CRT.round===2?' selected':''}>Grande</option></select></div>`;
  el.innerHTML=`<h3 class="panel-sub">Personagem${numPlayers>1?' · Jogador '+(selAnimPlayer+1):''} <span class="panel-sub__tag">por jogador</span></h3>`+charRows+`<h3 class="panel-sub">Cena <span class="panel-sub__tag">todos os jogadores</span></h3>`+sceneRows+
    `<h3 class="panel-sub">Estética CRT <span class="panel-sub__tag">todos os jogadores</span></h3>`+crtTgl('scan')+crtTgl('vig')+crtRound;
  el.querySelectorAll('button[data-crt-tgl]').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.crtTgl; CRT[k]=CRT[k]?0:1; applyCrt(); renderMotion(); srSay(CRT_LBL[k]+(CRT[k]?' ligada.':' desligada.')); }));
  el.querySelectorAll('select[data-crt]').forEach(s=>s.addEventListener('change',()=>{ CRT[s.dataset.crt]=+s.value; applyCrt(); srSay(CRT_LBL[s.dataset.crt]+': '+['desligado','pequeno','grande'][+s.value]+'.'); }));
  el.querySelectorAll('button[data-rmc]').forEach(b=>b.addEventListener('click',()=>{ const pr=b.dataset.rmc, pl=players[selAnimPlayer]; pl[pr]=!pl[pr]; try{localStorage.setItem('incl_'+pr+'_p'+selAnimPlayer,pl[pr]?'1':'0');}catch(e){} renderMotion(); }));
  el.querySelectorAll('button[data-rm]').forEach(b=>b.addEventListener('click',()=>{ const k=b.dataset.rm; rm[k]=!rm[k]; saveRM(); renderMotion(); updateMotionMaster(); srSay(RM_LABEL[k]+(rm[k]?' congelado.':' animado.')); }));
  updateMotionMaster();
}
function updateMotionMaster(){ reflectMotionBtn(); const m=$('#motion-master'); if(!m)return; const p=players[selAnimPlayer]; const allOn=RM_KEYS.every(k=>rm[k]) && RM_CHAR.every(c=>p&&p[c.prop]);
  m.textContent=allOn?'▶ Retomar todas as animações':'⏸ Parar todas as animações'; toggleBtn(m,allOn); }
function reflectAltMove(){ const p=players[selMovPlayer], on=!!(p&&p.toggleMove); const b=$('#opt-altmove'); if(b){ b.classList.toggle('is-on',on); b.setAttribute('aria-pressed',String(on)); b.textContent=on?'❚❚ Ligado':'▶ Desligado'; }
  reflectMovementBtn(); } // botão da barra acende se QUALQUER jogador usa Fácil/alternância
const altMoveBtn=$('#opt-altmove'); if(altMoveBtn)altMoveBtn.addEventListener('click',()=>{ setToggleMove(selMovPlayer, !players[selMovPlayer].toggleMove); reflectAltMove(); });
reflectFacil(); reflectAltMove();
// MENU Movimento (GAG: alternância) — separado do menu Animação (WCAG: movimento reduzido)
function openMovement(){ const ov=$('#movement'); if(!ov)return; renderMovPlayers(); reflectFacil(); reflectAltMove(); renderMapHub(); ov.hidden=false; frontOverlay(ov); movementOpen=true; const f=ov.querySelector('button'); if(f)f.focus(); }
function closeMovement(){ const ov=$('#movement'); if(!ov)return; ov.hidden=true; movementOpen=false; const b=$('#opt-movement'); if(b)b.focus(); }
// Submenu "Configurar botões de tela touch"
function openTouchCfg(){ const ov=$('#touchcfg'); if(!ov)return; renderTouchMap(); ov.hidden=false; frontOverlay(ov); const f=ov.querySelector('select,button'); if(f)f.focus(); }
function closeTouchCfg(){ const ov=$('#touchcfg'); if(!ov)return; ov.hidden=true; const b=$('#opt-touchcfg'); if(b)b.focus(); }
const touchCfgBtn=$('#opt-touchcfg'); if(touchCfgBtn)touchCfgBtn.addEventListener('click',openTouchCfg);
const touchCfgClose=$('#touchcfg-close'); if(touchCfgClose)touchCfgClose.addEventListener('click',closeTouchCfg);
// HUB de mapeamento (por jogador): teclado funciona (abre o remap); gamepad/olhos/setores/fala = em construção.
function mapSoon(nome){ srAlert(nome+': em construção — chega junto com os subsistemas de webcam e fala.'); }
function renderMapHub(){ const el=$('#map-hub'); if(!el)return; const np=numPlayers;
  const items=[
    {lbl:'⌨ Mapear teclado para modo 1 jogador', mode:1, act:openOptions},
    {lbl:'⌨ Mapear teclado para modo 2 jogadores', mode:2, act:openOptions},
    {lbl:'⌨ Mapear teclado para modo 3 jogadores', mode:3, act:openOptions},
    {lbl:'⌨ Mapear teclado para modo 4 jogadores', mode:4, act:openOptions},
    {lbl:'🎮 Mapear gamepad', act:openPadWiz}, // L1: wizard (DirectInput e afins) — mapa salvo por modelo de controle
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
function openAnimation(){ const ov=$('#animation'); if(!ov)return; renderMotion(); ov.hidden=false; frontOverlay(ov); animationOpen=true; const f=ov.querySelector('button'); if(f)f.focus(); }
function closeAnimation(){ const ov=$('#animation'); if(!ov)return; ov.hidden=true; animationOpen=false; const b=$('#opt-animation'); if(b)b.focus(); }
const movBtn=$('#opt-movement'); if(movBtn)movBtn.addEventListener('click',openMovement);
const movClose=$('#movement-close'); if(movClose)movClose.addEventListener('click',closeMovement);
const animBtn=$('#opt-animation'); if(animBtn)animBtn.addEventListener('click',openAnimation);
const animClose=$('#animation-close'); if(animClose)animClose.addEventListener('click',closeAnimation);
const motionMaster=$('#motion-master'); if(motionMaster)motionMaster.addEventListener('click',()=>{ const p=players[selAnimPlayer]; const allOn=RM_KEYS.every(k=>rm[k])&&RM_CHAR.every(c=>p&&p[c.prop]); const v=!allOn;
  RM_KEYS.forEach(k=>rm[k]=v); saveRM(); if(p)RM_CHAR.forEach(c=>{ p[c.prop]=v; try{localStorage.setItem('incl_'+c.prop+'_p'+selAnimPlayer,v?'1':'0');}catch(e){} }); // cena (global) + personagem (jogador selecionado)
  renderMotion(); srSay(v?'Todas as animações paradas.':'Todas as animações retomadas.'); });
function reflectMotionBtn(){ const b=$('#opt-animation'); if(b)b.classList.toggle('is-on',RM_KEYS.some(k=>rm[k])); } // realça o botão Animação quando há redução ativa
reflectMotionBtn(); // estado inicial (ex.: prefers-reduced-motion liga por padrão)
const ctrlReset=$('#ctrl-reset'); if(ctrlReset)ctrlReset.addEventListener('click',()=>{ KB=resetKB(); applyControls(); assignControls(); renderControls(); srSay('Controles restaurados ao padrão.'); });

/* ===================== FPS ===================== */
let fpsAccum=0,fpsFrames=0,fpsMin=Infinity,fpsWarm=0;
function fpsTick(){ const fps=app.ticker.FPS; fpsWarm++; fpsAccum+=fps; fpsFrames++;
  if(fpsWarm>60&&fps<fpsMin)fpsMin=fps;
  if(fpsFrames>=30){ $('#hud-fps').textContent=String(Math.round(fpsAccum/fpsFrames));
    $('#hud-fpsmin').textContent=fpsMin===Infinity?'–':String(Math.round(fpsMin)); fpsAccum=0;fpsFrames=0; }
}

/* ===================== loop ===================== */
startLoop(app.ticker, (dt)=>{ pollPads(); update(dt); draw();
  titleG.visible=(phase==='title'); if(titleG.visible)drawTitleScene(); // cena do título da v3 cobre o mundo
  attractCtl.titleIdleTick(titleG.visible); // attract após 60s parado no menu (José)
  setMinimapVisible(!titleG.visible&&numPlayers<=1); document.body.classList.toggle('at-title',titleG.visible); // HUD/minimapa não vazam no menu
  fpsTick();
  if(phase==='playing'){ updateWeather(); ambient.updateAmbient(); nav.updateGuide(); } }); // F4: clima + ambiente + guia auditivo (só durante o jogo)
window.__incl={app,get player(){return players[0];},players,get numPlayers(){return numPlayers;},setNumPlayers,activateScreens,fitsN,isMobile,pollPads,update,openPadWiz,padWizTick,padMapFor,get padWiz(){return padWiz;},get phase(){return phase;},get padPrev(){return padPrevAct;},get coins(){return coins;},get collected(){return players[0].collected;},get powerups(){return powerups;},get gateOpen(){return gateOpen;},get gate(){return gate;},get ended(){return ended;},restartGame,get hcMode(){return hcMode;},setHC(v){setPlayerViz(0,v?'hc-direto':'normal');},get vizMode(){return players[0].viz;},applyViz(v){setPlayerViz(0,v);},setPlayerViz,VIZ_MODES,get footCount(){return _footCount;},get sonarCount(){return nav.sonarCount;},get guideCount(){return nav.guideCount;},get narrateCount(){return tts.narrateCount;},sonar:()=>nav.sonar(players[0]),setHearingLoss,darkRegions,decoLayer,get minimap(){return getMinimap();},parallaxLayers,PARALLAX,setCenario,get cenario(){return CENARIO;},
  get mmSeen(){return minimapSeenCount();},get MODE(){return MODE;},get letterCase(){return letterCase;},get blindMode(){return blindMode;},brailleText,tileAt,WORLD_W,WORLD_H,TUNE,
  JUICE,addShake,addHitstop,burstSparkle,puffDust,draw,get particles(){return getParticles();},get hitstopT(){return getHitstopT();},get shakeT(){return getShakeT();},CRT,applyCrt,setLq,get lqT(){return lqT;},
  setOwnerColors,setCbSafe,setRoleColor,resetRoleColors,PCOLOR,HC_ROLE,get ownerColors(){return ownerColors;},get cbSafe(){return cbSafe;},
  setMode,setQuizLevel,get quizLevel(){return quizLevel;},openSilabas,quizMove,quizConfirm,quizErase,get quiz(){return players[0].quiz;},INCL_VERSION,fmtFrac,fracGraphic,speakChoice,get fracNot(){return fracNot;},
  setGameFont,openTypo,get fontKey(){return fontKey;},FONT_GROUPS,get mmSeen2(){return minimapSeenCount();},
  startAttract:()=>attractCtl.startAttract(),stopAttract:()=>attractCtl.stopAttract(),get attract(){return attractCtl.isAttract();}, // attract → game/attract.ts
  loadTTS:tts.loadTTS,ttsSpeak:tts.ttsSpeak,narrate:tts.narrate,get ttsEngine(){return tts.getEngine();},get ttsLoading(){return tts.loading;},get ttsFailed(){return tts.failed;},setTtsEngineSel(v){tts.setEngineSel(v);},
  updateWeather,get rainLevel(){return _rainLevel;},set weatherT(v){_weatherT=v;},get weatherT(){return _weatherT;},rm,
  spawnCreature,stepLife,get creatures(){return creatures;},spawnCar,get cars(){return cars;},SEM,STREET_Y,
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
  if(p!=='playing'&&typeof hideTouchControls==='function')hideTouchControls(); // menu ativo (título/pausa) = sem controle virtual
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
const OVERLAY_CLOSE={ audio:()=>closeAudio(), movement:()=>closeMovement(), options:()=>closeOptions(), animation:()=>closeAnimation(), visual:()=>closeVisual(), empathy:()=>closeEmpathy(), touchcfg:()=>closeTouchCfg(), help:()=>closeHelp(), typo:()=>closeTypo() };
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
      const scr=vpScreens[p.i]; if(scr&&!scr.querySelector('.vp-wait'))scr.insertAdjacentHTML('beforeend',
        '<div class="vphud-quit vp-wait">Jogador '+(p.i+1)+': aperte um botão do SEU teclado ou de um controle livre para entrar</div>');
      setPhase('playing'); srAlert('Jogador '+(p.i+1)+': aperte um botão para entrar.'); } },
  audio:()=>openAudio(),
  motora:()=>{ selMovPlayer=pauseActor; openMovement(); },
  anim:()=>{ selAnimPlayer=pauseActor; openAnimation(); },
  visual:()=>{ selVizPlayer=pauseActor; openVisual(); },
  empatia:()=>{ selVizPlayer=pauseActor; openEmpathy(); }, print:()=>printMode(), quit:()=>quitGame(), ajuda:()=>openHelp() };
// Roteamento de input por jogador: cada tecla é do jogador dono dela (kbFor). Genéricas → jogador 0.
function actionOf(code,pi){ const m=kbFor(pi); for(const a in m){ if(m[a]&&m[a].indexOf(code)>=0)return a; } return null; }
function whichPlayer(code){ for(let i=0;i<numPlayers;i++){ if(actionOf(code,i))return i; } return -1; }
function sharedDialogOpen(){ const ov=[...document.querySelectorAll('#game-region .overlay')].filter(o=>!o.hidden); if(!ov.length)return null; ov.sort((a,b)=>(+getComputedStyle(a).zIndex||0)-(+getComputedStyle(b).zIndex||0)); return ov[ov.length-1]; }
function menuItems(menu){ const card=menu.querySelector('.overlay__card, .pause-card')||menu; return [...card.querySelectorAll('button:not([disabled]), select:not([disabled]), input[type=range]:not([disabled])')].filter(el=>el.offsetParent!==null); }
function menuFocus(menu){ if(!menu)return; const it=menuItems(menu); if(it.length){ const cur=it.indexOf(document.activeElement); (cur>=0?it[cur]:it[0]).focus(); } }
function dialogBack(menu){ const c=OVERLAY_CLOSE[menu.id]; if(c)c(); else menu.hidden=true; menuFocus(sharedDialogOpen()); }
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
function menuNavKey(e){ if(phase!=='paused'||captureAction)return;
  const pw=$('#padwiz'); if(pw&&!pw.hidden){ if(e.code==='Escape'){ closePadWiz(false); e.preventDefault(); e.stopPropagation(); } return; } // wizard por cima: só Esc (cancela)
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
  if(numPlayers<=1){ restartGame(); setPhase('title'); showTitleMenu('tm-main'); srSay('Jogo abandonado. Escolha a próxima atividade.'); }
  else { const q=pauseActor||0; releaseKey(players[q]); players[q].quit=true;
    if(players.every(p=>p.quit)){ players.forEach(p=>{p.quit=false;}); restartGame(); setPhase('title'); showTitleMenu('tm-main'); // trocar de jogo = todo mundo sai
      srSay('Todos saíram. Escolham a próxima atividade.'); return; }
    setPhase('playing'); srSay('Jogador '+(q+1)+' abandonou o jogo.'); } }
function togglePause(){ if(phase==='playing')setPhase('paused'); else if(phase==='paused')setPhase('playing'); }
/* ===== Menu inicial (v3): principal → submenus de atividade → (tabuada/divisão) seletor de números ===== */
let _tabFor='mat5';
function showTitleMenu(which){ ['tm-main','tm-alf','tm-mat','tm-tab','tm-fr','tm-cen'].forEach(m=>{ const el=$('#'+m); if(el)el.hidden=(m!==which); });
  const lg=$('#title-legend'); if(lg)lg.hidden=(which!=='tm-main'); // RODAPÉ: legenda de controles no menu principal, DESCRIÇÃO nos submenus
  const tb=$('#title-overlay .title-block'); if(tb)tb.style.display=(which==='tm-main')?'':'none'; // título do jogo só no menu principal (o submenu usa o próprio tm-title; evita encavalar)
  const el=$('#'+which), b=el&&el.querySelector('button'); if(b)b.focus(); }
function titleButtons(){ const m=['tm-main','tm-alf','tm-mat','tm-tab','tm-fr','tm-cen'].map(id=>$('#'+id)).find(el=>el&&!el.hidden);
  return m?[...m.querySelectorAll('button')]:[]; }
function navTitle(k){ const bs=titleButtons(); if(!bs.length)return;
  let i=bs.indexOf(document.activeElement);
  if(k.up||k.down||k.left||k.right){ const d=(k.down||k.right)?1:-1; i=i<0?0:(i+d+bs.length)%bs.length; bs[i].focus(); srSay(bs[i].textContent); }
  else if(k.yes){ (i<0?bs[0]:bs[i]).click(); }
  else if(k.no){ const back=bs.find(b=>b.dataset.tmBack); if(back)back.click(); } }
function buildTitleMenus(){
  const mk=id=>{ const a=ACTIVITIES[id]; return `<button class="title-btn" data-act-id="${id}" type="button">${a.nome}${a.sub?`<span class="act-sub">${a.sub}</span>`:''}</button>`; }; // subtítulo de exemplo (letramento)
  const back=(to)=>`<button class="title-btn ghost" data-tm-back="${to}" type="button">Voltar</button>`;
  const desc=`<div class="tm-desc" aria-live="polite"></div>`; // rodapé com a descrição do minigame focado
  const h=t=>`<h3 class="tm-title">${t}</h3>`;                  // título do submenu (pedido do José)
  const alf=$('#tm-alf'); if(alf)alf.innerHTML=h('Alfabetização')+['alf1','alf2','alf3','alf4','alf5'].map(mk).join('')+back('tm-main')+desc;
  const mat=$('#tm-mat'); if(mat)mat.innerHTML=h('Matemática')+['mat1','mat2','mat3','mat4','mat5','mat6'].map(mk).join('')+
    `<button class="title-btn" data-tm-fr="1" type="button">Fração</button>`+back('tm-main')+desc;
  const fr=$('#tm-fr'); if(fr)fr.innerHTML=h('Soma e subtração de frações')+
    `<div class="frac-nots" role="group" aria-label="Notação">`+Object.keys(FNOT_LBL).map(k=>`<button class="title-btn tab-num${fracNot[k]?' tab-on':''}" data-fnot="${k}" type="button" aria-pressed="${!!fracNot[k]}" aria-label="${FNOT_LBL[k]}">${FNOT_SYM[k]}</button>`).join('')+`</div>`+
    ['fr2','fr3','fr42','fr5','fr632','fr2a6'].map(mk).join('')+back('tm-mat')+desc;
  const rows=r=>r.map(n=>`<button class="title-btn tab-num${tabSel.includes(n)?' tab-on':''}" data-tab-n="${n}" type="button" aria-pressed="${tabSel.includes(n)}">${n}</button>`).join('');
  const tab=$('#tm-tab'); if(tab)tab.innerHTML=h('Tabuada')+`<div class="game-subtitle">Escolha os números para treinar</div>`+
    `<div class="tab-row">${rows([0,1,2,3,4,5])}</div><div class="tab-row">${rows([6,7,8,9,10])}</div>`+
    `<button class="title-btn" id="tab-play" type="button">Jogar</button>`+back('tm-mat');
  const cen=$('#tm-cen'); if(cen)cen.innerHTML=h('Cenário')+Object.keys(CENARIOS).map(c=>
    `<button class="title-btn" data-cen="${c}" type="button">${CENARIOS[c].nome}</button>`).join('')+
    `<button class="title-btn ghost" data-cen-back="1" type="button">Voltar</button>`;
}
/* Rodapé do splash: controles conforme o DISPOSITIVO plugado — teclado=letras (J/K/U/I),
   DirectInput=números (0/1/2/3), XInput=letras COLORIDAS (A/B/X/Y). Pausa: Enter/START. */
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
    const custom=gp.mapping!=='standard'?padMapFor(gp.id):null;
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
(function titleSetup(){ const ov=$('#title-overlay'); if(!ov)return; buildTitleMenus();
  // Ícones de a11y da pausa TAMBÉM no topo do splash (mesmas ações, escopo do Jogador 1)
  const ti=$('#title-icons'); if(ti){ ti.innerHTML=PAUSE_ICONS.map(ic=>'<button class="pi-btn'+(ic.soon?' pi-soon':'')+'" type="button" data-pi="'+ic.k+'" aria-label="'+ic.n+(ic.soon?' (em construção)':'')+'">'+ic.e+'</button>').join('');
    ti.addEventListener('click',(e)=>{ const ib=e.target.closest('.pi-btn'); if(!ib)return; pauseActor=0; iconAct(ib.dataset.pi,0);
      reflectTitleIcons(); if(typeof reflectPauseIcons==='function')reflectPauseIcons(); srSay(ib.getAttribute('aria-label')||''); }); // reflete no SPLASH também
    reflectTitleIcons(); } // estado inicial dos ícones do splash
  // Seletor de jogadores por TECLADO: ←/→ no botão único = −1/+1 (o clique usa o lado; teclado é explícito)
  ov.addEventListener('keydown',(e)=>{ const b=e.target.closest('#np-btn'); if(!b)return;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){ e.preventDefault(); b.dataset.np=e.key==='ArrowLeft'?'-1':'1'; b.click(); } });
  // Rodapé (mesmo estilo do menu de pausa): descrição do minigame (data-act-id) OU da notação (data-fnot), no foco/hover
  const showDesc=(e)=>{ const b=e.target.closest('button[data-act-id],button[data-fnot]'); if(!b)return;
    const d = b.dataset.fnot ? (FNOT_DESC[b.dataset.fnot]||'') : ((ACTIVITIES[b.dataset.actId]||{}).d||'');
    const box=b.closest('.title-menu'); const el=box&&box.querySelector('.tm-desc'); if(el)el.textContent=d; };
  ov.addEventListener('focusin',showDesc); ov.addEventListener('mouseover',showDesc);
  ov.addEventListener('click',(e)=>{ const b=e.target.closest('button'); if(!b)return;
    if(b.classList.contains('title-btn')){ b.classList.remove('act-fx'); void b.offsetWidth; b.classList.add('act-fx'); } // efeito de ATIVAÇÃO
    const go=fn=>{ if(ov._busy)return; ov._busy=true; setTimeout(()=>{ ov._busy=false; fn(); },230); }; // a animação toca ANTES de trocar de tela
    if(b.id==='np-btn'){ // UM botão "◀ Nº de jogadores: X ▶": lado clicado (ou ←/→) decide +1 / −1
      let d=+(b.dataset.np||0); b.dataset.np=''; // ←/→ setam data-np no keydown; clique usa a posição
      if(!d){ const r=b.getBoundingClientRect(); d=(e.clientX-r.left)<r.width/2?-1:1; }
      let n=Math.max(1,Math.min(4,pendingPlayers+d));
      if(n>1&&!fitsN(n)){ srAlert('Não cabem '+n+' telas nesta janela — aumente a janela ou use tela cheia.'); return; }
      pendingPlayers=n; const nn=$('#np-n'); if(nn)nn.textContent=n;
      b.setAttribute('aria-label','Número de jogadores: '+n+'. Clique à esquerda para menos, à direita para mais.');
      srSay(n+(n>1?' jogadores.':' jogador.')); return; }
    if(b.dataset.tmFr){ go(()=>{ showTitleMenu('tm-fr'); srSay('Soma e subtração de frações: escolha a notação e o tipo.'); }); return; }
    if(b.dataset.fnot){ const k=b.dataset.fnot; // toggle de NOTAÇÃO (imediato; pelo menos 1 SEMPRE ligada)
      if(fracNot[k]&&Object.values(fracNot).filter(x=>x).length<=1){ srAlert('Deixe ao menos uma notação ligada.'); return; }
      fracNot[k]=fracNot[k]?0:1; try{localStorage.setItem('incl_fracnot',JSON.stringify(fracNot));}catch(e){}
      b.classList.toggle('tab-on',!!fracNot[k]); b.setAttribute('aria-pressed',String(!!fracNot[k])); // estado pelo realce, SEM ✔
      srSay(FNOT_LBL[k]+(fracNot[k]?' ligada.':' desligada.')); return; }
    if(b.dataset.cen){ const c=b.dataset.cen; go(()=>{ setCenario(c); reallyStart(); }); return; }
    if(b.dataset.cenBack){ go(()=>showTitleMenu(_cenBack)); return; }
    if(b.dataset.tm==='ludico'){ go(()=>startActivity('ludico')); return; }
    if(b.dataset.tm==='alf'){ go(()=>showTitleMenu('tm-alf')); return; }
    if(b.dataset.tm==='mat'){ go(()=>showTitleMenu('tm-mat')); return; }
    if(b.dataset.tmBack){ const to=b.dataset.tmBack; go(()=>showTitleMenu(to)); return; }
    if(b.id==='tab-play'){ if(!tabSel.length){ srAlert('Escolha ao menos um número para treinar.'); return; } go(()=>startActivity(_tabFor)); return; }
    if(b.dataset.tabN!=null){ const n=+b.dataset.tabN, i=tabSel.indexOf(n); // toggle: sem troca de tela → imediato
      if(i>=0)tabSel.splice(i,1); else tabSel.push(n);
      try{localStorage.setItem('incl_tabsel',JSON.stringify(tabSel));}catch(e){}
      b.classList.toggle('tab-on',i<0); b.setAttribute('aria-pressed',String(i<0));
      srSay('Número '+n+(i<0?' ligado.':' desligado.')); return; }
    if(b.dataset.actId){ const id=b.dataset.actId;
      if(ACTIVITIES[id].pick){ go(()=>{ _tabFor=id; buildTitleMenus(); const t=$('#tm-tab .tm-title'); if(t)t.textContent=ACTIVITIES[id].nome; // título Tabuada/Divisão
        showTitleMenu('tm-tab'); srSay(ACTIVITIES[id].nome+': escolha os números.'); }); }
      else go(()=>startActivity(id)); } });
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
function hideTouchControls(){ const tc=document.querySelector('#touch-controls'); if(tc && !tc.hidden) tc.hidden=true; document.body.classList.remove('touch-mode'); setMinimapCorner(false); }
// toque/clique → mostra os botões e move o MINIMAPA p/ o canto sup. direito. Em multi-tela, NÃO ativa.
function showTouchControls(){ if(numPlayers>1 || phase!=='playing' || players.some(p=>p.quiz)) return; // MENU ativo (splash/pausa/quiz) = sem controle virtual: dá pra tocar direto nos botões da tela
  const tc=document.querySelector('#touch-controls'); if(tc) tc.hidden=false; document.body.classList.add('touch-mode'); setMinimapCorner(true); }
(function touchSetup(){
  const tc=$('#touch-controls'); if(!tc)return;
  // alternância por modalidade: toque/clique MOSTRA; teclado/controle OCULTA (hideTouchControls).
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
    const down=(e)=>{ e.preventDefault(); doTouch(touchMap[slot],true); };
    const up=(e)=>{ e.preventDefault(); doTouch(touchMap[slot],false); };
    b.addEventListener('pointerdown',down); b.addEventListener('pointerup',up);
    b.addEventListener('pointerleave',up); b.addEventListener('pointercancel',up);
    b.addEventListener('contextmenu',(e)=>e.preventDefault());
  });
  // START (enter): faz a função mapeada (padrão pausar); se for ação momentânea, pressiona e solta.
  const startBtn=$('#touch-start'); if(startBtn)startBtn.addEventListener('click',()=>{ const a=touchMap.start; if(a==='pause'){ togglePause(); } else { doTouch(a,true); setTimeout(()=>doTouch(a,false),140); } });
  // joystick digital: base (círculo grande) + manopla (círculo menor) que desliza p/ a direção tocada → 8 direções
  const stick=$('#touch-stick'), knob=stick&&stick.querySelector('.touch-knob');
  if(stick&&knob){
    let pid=null; // deslocamento (R) e zona-morta (DEAD) vêm de _stickTravelPx/_stickDeadPx (mm, config em A12e motora)
    const dirState={left:false,right:false,up:false,down:false};
    const setDir=(d,on)=>{ if(dirState[d]===on)return; dirState[d]=on; doTouch(touchMap[d],on); }; // direção física → função mapeada
    const move=(px,py)=>{ const R=_stickTravelPx, DEAD=_stickDeadPx; const r=stick.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
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
    const cset=(d,on)=>{ if(cst[d]===on)return; cst[d]=on; doTouch(touchMap[d],on); if(arms[d])arms[d].classList.toggle('on',on); }; // direção física → função mapeada
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
