// SPDX-License-Identifier: AGPL-3.0-or-later
// game/player.ts — entidade JOGADOR (fábrica de estado) + geometria de colisão do jogador. Extraído do game.js
// (Estágio 4). As queries (isBouncyGroundBelow/touchingWall/clingSides/firstClingSide) e o contorno de quina da
// ventosa-aranha (spiderReattach/wrapConvex) leem o mundo via core/collision (solidAt/tileAt) → puras, testáveis
// com um mundo FALSO (initCollision no teste). BOX = caixa de colisão (px); SPAWN_* = nascedouro. jumpVel = a
// velocidade inicial do pulo (fórmula pura). showPower (DOM/HUD) segue no game.js. Consumido pela física.
import { TILE, TUNE, EASY } from '../core/constants.js';
import { solidAt, tileAt } from '../core/collision.js';
import type { ClingSide } from '../core/entity.js';
import type { GamePlayer } from './entity.js'; // ADR-0033: a fábrica devolve o jogador DO JOGO

export const SPAWN_X = 2 * TILE, SPAWN_Y = 24 * TILE;
export const BOX = { w: 10, h: 30 };

// Velocidade inicial (vy) do pulo, em função da altura desejada em TILES (sqrt: energia ∝ altura). Modo fácil
// dá um empurrão extra no pulo (EASY.jump = 8/7). Negativa porque y cresce p/ baixo. (game.js: física do pulo)
export function jumpVel(pl: { easy?: boolean }, tiles: number): number { return -TUNE.jumpVel * Math.sqrt(tiles / 5) * (pl.easy ? EASY.jump : 1); }

type Side = ClingSide;                       // lados da ventosa: direita/esquerda/teto/chão (core/entity)
type Sides = Record<Side, boolean>;
// corpo mínimo lido pelas queries/contorno (o objeto real de makePlayer tem ~40 campos; game.js os usa por completo)
type PlayerBody = { x: number; y: number; vx: number; vy: number; clingN: Side | null };

// E11: jogadores como array (física por jogador). Fábrica do estado inicial de um jogador i.
// O tipo de retorno é a ÚNICA aferição do core/entity: se a fábrica e a interface discordarem em um campo,
// em um nome ou em um tipo, isto não compila. Era `unknown` na prática até aqui — o literal inferia `quiz: null`
// e `ctrl: null` como o TIPO `null`, não como `X | null`, e por isso `core/state.players` teve de ser `unknown[]`.
export function makePlayer(i: number): GamePlayer { return {i,x:SPAWN_X+i*22,y:SPAWN_Y,vx:0,vy:0,onGround:false,onLadder:false,inWater:false,
  facing:1,anim:0,walkAnim:0,jumpBuffer:0,waterStroke:0,hurtTimer:0,quiz:null,jumpEdge:false,collected:0,ctrl:null,sprite:null,
  activePower:'off',owned:[],hasKey:false,jumpChain:0,groundIdle:0,clinging:false,clingN:null,runEdge:false,swapEdge:false,specialEdge:false,airTime:99,flying:false,idleNow:false,idleTime:0,flavor:-1,flavorT:0,climbFrame:0,
  walkDir:0,leftEdge:false,rightEdge:false, viz:'normal', _tx:null, easy:false, toggleMove:false, toggleRun:false, runLatch:false, pad:-1,
  rmWalk:false, rmBreath:false, rmFlavor:false, stepT:0, guardT:0, _swapDown:false, _swapT:0, _swapSonar:false}; } // stepT/guardT = cadência de áudio; _swap* = detecção segurar-swap p/ sonar

// Há PEDRA(2) logo abaixo dos pés? (chão que dá pique — bounce). Varre a largura da caixa na linha y+1.
/**
 * ⚠️ COMPARA O TILE, e NÃO uma pergunta semântica — de propósito. A pedra(2) quica (`bounce: 0.28`) e a
 * parede(6) não (`bounce: 0`), então "tem bounce" pareceria a pergunta certa; mas o TRAMPOLIM(5) também tem
 * (`1.1`), e incluí-lo mudaria o comportamento: o encadeamento de pulos em corrida passaria a valer em cima
 * de trampolim, que já arremessa sozinho. A pergunta verdadeira aqui é "o chão é PEDRA", e pedra é um tile,
 * não um papel. É o caso-limite que mostra que nem toda comparação de número é dívida.
 */
export function isBouncyGroundBelow(pl: PlayerBody): boolean { const ty=Math.floor((pl.y+1)/TILE),x0=Math.floor((pl.x-BOX.w/2)/TILE),x1=Math.floor((pl.x+BOX.w/2-0.01)/TILE); for(let tx=x0;tx<=x1;tx++) if(tileAt(tx,ty)===2)return true; return false; }
// Há parede sólida encostando à esquerda OU à direita (na altura do corpo)?
export function touchingWall(pl: PlayerBody): boolean { const y0=Math.floor((pl.y-BOX.h)/TILE),y1=Math.floor((pl.y-1)/TILE),lx=Math.floor((pl.x-BOX.w/2-1)/TILE),rx=Math.floor((pl.x+BOX.w/2+1)/TILE); for(let ty=y0;ty<=y1;ty++) if(solidAt(lx,ty)||solidAt(rx,ty))return true; return false; }
// E18c: ventosa "aranha" — sólidos adjacentes à caixa em cada lado (R=direita, L=esquerda, U=teto/acima, D=chão/abaixo)
export function clingSides(pl: PlayerBody): Sides { const l=pl.x-BOX.w/2,r=pl.x+BOX.w/2,t=pl.y-BOX.h,b=pl.y;
  const x0=Math.floor(l/TILE),x1=Math.floor((r-0.01)/TILE),y0=Math.floor(t/TILE),y1=Math.floor((b-0.01)/TILE);
  const lx=Math.floor((l-1)/TILE),rx=Math.floor((r+1)/TILE),uy=Math.floor((t-1)/TILE),dy=Math.floor((b+1)/TILE);
  let R=false,L=false,U=false,D=false;
  for(let ty=y0;ty<=y1;ty++){ if(solidAt(rx,ty))R=true; if(solidAt(lx,ty))L=true; }
  for(let tx=x0;tx<=x1;tx++){ if(solidAt(tx,uy))U=true; if(solidAt(tx,dy))D=true; }
  return {R,L,U,D}; }
export function firstClingSide(pl: PlayerBody): Side | null { const s=clingSides(pl); return s.R?'R':s.L?'L':s.U?'U':s.D?'D':null; }
// Reancora após o movimento: trata quina CÔNCAVA (bate numa face perpendicular à frente → gruda nela)
// e CONVEXA (a face atual sumiu → contorna para uma face perpendicular disponível); senão, cola na quina.
export function spiderReattach(pl: PlayerBody, preX: number, preY: number): void { const s=clingSides(pl),N=pl.clingN,onWall=(N==='R'||N==='L');
  const up=pl.vy<0,dn=pl.vy>0,lf=pl.vx<0,rt=pl.vx>0;
  if(onWall){ if(up&&s.U){pl.clingN='U';pl.vy=0;return;} if(dn&&s.D){pl.clingN='D';pl.vy=0;return;} }   // CÔNCAVA (parede→teto/chão)
  else      { if(rt&&s.R){pl.clingN='R';pl.vx=0;return;} if(lf&&s.L){pl.clingN='L';pl.vx=0;return;} }   // CÔNCAVA (teto→parede)
  if(N&&s[N]) return;                            // ainda na mesma face
  const perp: Side | null = onWall ? (s.U?'U':s.D?'D':null) : (s.R?'R':s.L?'L':null); // CONVEXA: face perpendicular já adjacente
  if(perp){ pl.clingN=perp; pl.vx=0; pl.vy=0; return; }
  wrapConvex(pl,N,{up,dn,lf,rt},preX,preY);      // CONVEXA "de ponta": reposiciona contornando a quina (dar a volta)
}
// Contorna a quina convexa (ponta): a face atual acabou e não há face perpendicular adjacente.
// Acha a borda da face e reposiciona a caixa do outro lado da quina, na face perpendicular externa.
export function wrapConvex(pl: PlayerBody, N: Side | null, mv: { up: boolean; dn: boolean; lf: boolean; rt: boolean }, preX: number, preY: number): void { const T=TILE,hw=BOX.w/2,bh=BOX.h;
  const tryland=(nN: Side, nx: number, ny: number): boolean=>{ const ox=pl.x,oy=pl.y,oN=pl.clingN; pl.x=nx;pl.y=ny;pl.clingN=nN;
    if(clingSides(pl)[nN]){ pl.vx=0;pl.vy=0; return true; } pl.x=ox;pl.y=oy;pl.clingN=oN; return false; };
  if(N==='U'||N==='D'){                          // estava no teto/chão andando na horizontal → desce/sobe pela face externa
    const d = mv.rt?1:mv.lf?-1:0; if(d){
      const srow = N==='U' ? Math.floor((preY-bh-1)/T) : Math.floor((preY+1)/T);
      let edge=Math.floor(preX/T),guard=0;       // acha a ÚLTIMA coluna sólida da face (a borda), mesmo já tendo passado dela
      if(solidAt(edge,srow)){ while(solidAt(edge+d,srow)&&guard++<64) edge+=d; }
      else { while(!solidAt(edge,srow)&&guard++<64) edge-=d; }
      if(solidAt(edge,srow)){
        const nN: Side = d>0?'L':'R';            // bloco fica do lado de onde viemos
        const nx = d>0 ? (edge+1)*T+hw+0.6 : edge*T-hw-0.6;
        const ny = N==='U' ? srow*T+bh : (srow+1)*T; // encosta a caixa ao lado da face (na altura do bloco)
        if(tryland(nN,nx,ny)) return;
      }
    }
  } else {                                       // estava na parede subindo/descendo → contorna para o topo/fundo
    const d = mv.up?-1:mv.dn?1:0; if(d){
      const scol = N==='R' ? Math.floor((pl.x+hw+1)/T) : Math.floor((pl.x-hw-1)/T);
      let edge=Math.floor((preY-1)/T),guard=0;   // acha a ÚLTIMA linha sólida da parede (a borda)
      if(solidAt(scol,edge)){ while(solidAt(scol,edge+d)&&guard++<64) edge+=d; }
      else { while(!solidAt(scol,edge)&&guard++<64) edge-=d; }
      if(solidAt(scol,edge)){
        const nN: Side = d<0?'D':'U';            // sobe→pousa no topo (D); desce→pendura no fundo (U)
        const nx = scol*T+T/2;
        const ny = d<0 ? edge*T-0.6 : (edge+1)*T+bh+0.6;
        if(tryland(nN,nx,ny)) return;
      }
    }
  }
  pl.x=preX; pl.y=preY; pl.vx=0; pl.vy=0;        // sem como contornar → fica colado na quina
}
