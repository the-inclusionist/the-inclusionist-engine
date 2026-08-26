// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/draw — a câmera e a montagem do quadro (project node). ZOMBIES + Right-BICEP.
// O módulo é PIXI por natureza, mas entra por interface ESTRUTURAL: aqui as camadas de Graphics, a câmera e
// o renderer são DUBLÊS que gravam chamadas, e os colaboradores que importam PIXI (elevador, minimapa) entram
// por closure. Sobra o que de fato é decisão deste módulo: o clamp/tremor/arredondamento da câmera, a
// transformada dos sprites, a escolha ENTRE os dois caminhos de câmera (tela única × multi-tela) e a
// visibilidade por dono no multi-tela. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (C1).
import { describe, it, expect, beforeEach } from 'vitest';
import { initDraw } from '../app/js/render/draw.js';
import { LOGICAL_W, LOGICAL_H } from '../app/js/core/constants.js';
import { BOX, makePlayer } from '../app/js/game/player.js';
import { players, setNumPlayersValue } from '../app/js/core/state.js';
import { setCoins } from '../app/js/game/state.js'; // item 19: `coins`/`quizLevel` mudaram para `game/state`
import { addShake, stepFx, JUICE } from '../app/js/render/fx.js';

const WPW = 2000, WPH = 1000; // mundo grande o bastante p/ o clamp não disparar no meio

/** Graphics dublê: grava todas as chamadas na ordem, para dizer "desenhou" × "só limpou". */
function gfx() {
  const calls = [];
  const rec = (name) => (...a) => { calls.push([name, ...a]); return h; };
  const h = {
    calls,
    clear: rec('clear'), lineStyle: rec('lineStyle'), beginFill: rec('beginFill'), endFill: rec('endFill'),
    drawRect: rec('drawRect'), moveTo: rec('moveTo'), lineTo: rec('lineTo'), drawCircle: rec('drawCircle'),
    ops: () => calls.filter((c) => c[0] !== 'clear').length,
  };
  return h;
}
/** Sprite dublê do personagem. */
const spr = () => ({ x: 0, y: 0, alpha: 1, visible: true, texture: null, scale: { sx: 1, sy: 1, set(a, b) { this.sx = a; this.sy = b; } } });

/** ctx completo, tudo dublê; `over` sobrepõe peça a peça. */
function makeCtx(over = {}) {
  const log = { parallax: [], render: [], overlay: [], shared: [], minimap: [], hud: 0, elev: 0 };
  const ctx = {
    camera: { x: 0, y: 0 },
    // `renderer` virou a CAPACIDADE `renderizarEm` (Fase D): o módulo pede o verbo, não o objeto do PixiJS.
    renderizarEm: (_obj, alvo) => log.render.push(alvo),
    // A caixa do jogador ENTRA pelo ctx (como já entrava em scene-city/scene-sky/audio-nav). Os valores são
    // os reais de `game/player` — os casos da câmera abaixo conferem `y - BOX.h/2`, então inventar aqui faria
    // o teste medir o fixture em vez do módulo.
    BOX: { w: 10, h: 30 },
    caneLayer: gfx(), chairLayer: gfx(), easyHitbox: gfx(),
    getVpTex: () => ['RT0', 'RT1', 'RT2', 'RT3'],
    isWheelchair: () => false,
    getFxClock: () => 0,
    getPowerups: () => [],
    // OS ITENS DECLARADOS (item 19). O fixture responde o mínimo: nenhum item, e as duas perguntas de posse
    // com a resposta que não esconde nem esmaece nada. Os casos que se importam com item declaram o seu.
    getItemSprites: () => [],
    itemVisibleTo: () => true,
    itemOwnedBy: () => true,
    powerupVisibleTo: () => true,
    rm: {},
    WORLD_PX_W: () => WPW, WORLD_PX_H: () => WPH,
    caneOn: () => false,
    updateParallax: (x, y) => log.parallax.push([x, y]),
    drawElevators: () => { log.elev++; },
    markSeen: (x, y) => log.minimap.push(['seen', x, y]),
    redrawMinimapIfDirty: () => log.minimap.push(['redraw']),
    drawMinimapPlayer: (x, y) => log.minimap.push(['player', x, y]),
    applySharedTextures: (v) => log.shared.push(v),
    renderVpOverlay: (i, v) => log.overlay.push([i, v]),
    playerVizTex: (base) => base,
    updateGameHud: () => { log.hud++; },
    playerTextures: () => TEX,
    held: () => false,
    ...over,
  };
  return { ctx, log, api: initDraw(ctx) };
}
const TEX = {
  idle: ['i0', 'i1', 'i2', 'i3'], walk: ['w0'], run: ['r0'], jumpUp: 'JU', jumpDown: 'JD',
  climb: ['c0'], fly: 'FLY', clingWall: ['pw0'], clingCeil: ['pt0'], swim: ['s0'], swimIdle: ['si0'],
  flavors: [{ seq: [0], hold: 10, tex: ['f0'] }],
};

/** Popula `players` (mutado in place — core/state nunca o reatribui) e ajusta numPlayers. */
function setPlayers(n, over = () => ({})) {
  players.length = 0;
  for (let i = 0; i < n; i++) {
    players.push(Object.assign(makePlayer(i), { airTime: 0, onGround: true, sprite: spr(), viz: 'normal' }, over(i)));
  }
  setNumPlayersValue(n);
  return players;
}

beforeEach(() => {
  stepFx(1e6);           // drena o tremor de tela residual de outro teste (o estado de fx é singleton)
  setCoins([]);          // sem moedas: os sprites de moeda são assunto de game/coin-spawning
  players.length = 0;
  setNumPlayersValue(1);
});

/* ===================== placeCam: enquadrar, clampar, tremer, arredondar ===================== */

describe('render/draw — placeCam', () => {
  const pl = (x, y) => ({ x, y });

  it('[Right] centra o jogador: camX = x - W/2 e camY = (y - BOX.h/2) - H/2', () => {
    const { api, ctx, log } = makeCtx();
    const r = api.placeCam(pl(500, 400));
    expect(r).toEqual({ camX: 500 - LOGICAL_W / 2, camY: (400 - BOX.h / 2) - LOGICAL_H / 2 });
    expect(ctx.camera.x).toBe(-r.camX);   // a câmera é o NEGATIVO da posição do mundo
    expect(ctx.camera.y).toBe(-r.camY);
    expect(log.parallax).toEqual([[r.camX, r.camY]]); // o parallax recebe os MESMOS valores
  });
  it('[Interface] a caixa vem do CTX: outra altura, outro enquadramento', () => {
    // Verifiquei com uma mutação — cravar `30` no lugar de `ctx.BOX.h` — e os 29 casos deste arquivo passaram,
    // porque o fixture usa justamente a altura real. Um teste que não distingue "injetado" de "cravado com o
    // número certo" não mede injeção nenhuma; é o mesmo buraco que o SHAPE_TEX tinha. Aqui a caixa é OUTRA,
    // e o enquadramento tem de andar com ela: `pl.y` é o pé, e meia caixa acima é o meio do corpo.
    const { api } = makeCtx({ BOX: { w: 10, h: 60 } });
    expect(api.placeCam(pl(500, 400)).camY).toBe((400 - 30) - LOGICAL_H / 2);
  });

  it('[Boundary] clampa na borda ESQUERDA/SUPERIOR (nunca mostra fora do mundo)', () => {
    const { api } = makeCtx();
    expect(api.placeCam(pl(0, 0))).toEqual({ camX: 0, camY: 0 });
  });
  it('[Boundary] clampa na borda DIREITA/INFERIOR', () => {
    const { api } = makeCtx();
    expect(api.placeCam(pl(1e6, 1e6))).toEqual({ camX: WPW - LOGICAL_W, camY: WPH - LOGICAL_H });
  });
  it('arredonda a CÂMERA para pixel inteiro, mas devolve o valor FRACIONÁRIO (o minimapa usa o cru)', () => {
    const { api, ctx } = makeCtx();
    const r = api.placeCam(pl(500.6, 400.6));
    expect(r.camX).toBeCloseTo(340.6, 6);
    expect(ctx.camera.x).toBe(-341);
    expect(Number.isInteger(ctx.camera.y)).toBe(true);
  });
  it('sem tremor, dois quadros iguais dão a MESMA câmera (nada de RNG à toa)', () => {
    const { api } = makeCtx();
    expect(api.placeCam(pl(500, 400))).toEqual(api.placeCam(pl(500, 400)));
  });
  it('o tremor DESLOCA a câmera e continua CLAMPADO na borda (nunca revela o vazio)', () => {
    const { api } = makeCtx();
    const xs = [];
    for (let n = 0; n < 30; n++) { addShake(50, 30); xs.push(api.placeCam(pl(0, 0)).camX); }
    expect(Math.min(...xs)).toBe(0);          // re-clamp: nada negativo
    expect(Math.max(...xs)).toBeGreaterThan(0); // e o tremor de fato saiu do zero
  });
  it('o tremor também é clampado na borda OPOSTA', () => {
    const { api } = makeCtx();
    const xs = [];
    for (let n = 0; n < 30; n++) { addShake(50, 30); xs.push(api.placeCam(pl(1e6, 1e6)).camX); }
    expect(Math.max(...xs)).toBe(WPW - LOGICAL_W);
    expect(Math.min(...xs)).toBeLessThan(WPW - LOGICAL_W);
  });
});

/* ===================== drawFrame: a transformada dos sprites ===================== */

describe('render/draw — sprites do jogador', () => {
  it('[Right] posiciona no pé +1px e espelha pelo facing', () => {
    setPlayers(1, () => ({ x: 100, y: 200, facing: -1 }));
    const { api } = makeCtx();
    api.drawFrame();
    const s = players[0].sprite;
    expect([s.x, s.y]).toEqual([100, 201]);
    expect(s.scale.sx).toBe(-1);
    expect(s.scale.sy).toBe(1);
  });
  it('squash&stretch: achata em X e estica em Y enquanto sqT>0', () => {
    setPlayers(1, () => ({ sq: 0.5, sqT: 8, facing: 1 }));
    const { api } = makeCtx();
    api.drawFrame();
    const s = players[0].sprite;
    expect(s.scale.sy).toBeGreaterThan(1);
    expect(s.scale.sx).toBeLessThan(1);
  });
  it('Movimento Reduzido do personagem (rmWalk) CANCELA o squash', () => {
    setPlayers(1, () => ({ sq: 0.5, sqT: 8, rmWalk: true }));
    const { api } = makeCtx();
    api.drawFrame();
    expect(players[0].sprite.scale.sy).toBe(1);
  });
  it('JUICE.squash desligado também cancela', () => {
    const antes = JUICE.squash; JUICE.squash = false;
    try {
      setPlayers(1, () => ({ sq: 0.5, sqT: 8 }));
      const { api } = makeCtx();
      api.drawFrame();
      expect(players[0].sprite.scale.sy).toBe(1);
    } finally { JUICE.squash = antes; }
  });
  it('piscada de dano: alterna alpha a cada 4 quadros de hurtTimer, e volta a 1 quando zera', () => {
    setPlayers(1, () => ({ hurtTimer: 4 }));  // floor(4/4)%2 = 1 → 0.4
    const { api } = makeCtx();
    api.drawFrame();
    expect(players[0].sprite.alpha).toBe(0.4);
    players[0].hurtTimer = 8;                 // floor(8/4)%2 = 0 → 1
    api.drawFrame();
    expect(players[0].sprite.alpha).toBe(1);
    players[0].hurtTimer = 0;
    api.drawFrame();
    expect(players[0].sprite.alpha).toBe(1);
  });
  it('[Zero] jogador sem sprite não quebra o quadro', () => {
    setPlayers(1, () => ({ sprite: null }));
    const { api, log } = makeCtx();
    expect(() => api.drawFrame()).not.toThrow();
    expect(log.hud).toBe(1);
  });
});

/* ===================== drawFrame: bengala, cadeira e hitbox do Fácil ===================== */

describe('render/draw — camadas de a11y', () => {
  it('a bengala só é desenhada para quem tem visão comprometida E está andando', () => {
    setPlayers(1, () => ({ walking: true }));
    const semCego = makeCtx({ caneOn: () => false });
    semCego.api.drawFrame();
    expect(semCego.ctx.caneLayer.ops()).toBe(0);         // limpa e não desenha

    const comCego = makeCtx({ caneOn: () => true });
    comCego.api.drawFrame();
    expect(comCego.ctx.caneLayer.ops()).toBeGreaterThan(0);
  });
  it('parado (walking=false, running=false) não desenha bengala nenhuma', () => {
    setPlayers(1, () => ({ walking: false, running: false }));
    const { api, ctx } = makeCtx({ caneOn: () => true });
    api.drawFrame();
    expect(ctx.caneLayer.ops()).toBe(0);
    expect(ctx.caneLayer.calls[0][0]).toBe('clear');     // mas a camada é sempre limpa
  });
  it('running usa a bengala de CORRIDA (traçado diferente da bengala simples)', () => {
    setPlayers(1, () => ({ walking: true, running: true }));
    const corrida = makeCtx({ caneOn: () => true }); corrida.api.drawFrame();
    setPlayers(1, () => ({ walking: true, running: false }));
    const simples = makeCtx({ caneOn: () => true }); simples.api.drawFrame();
    expect(corrida.ctx.caneLayer.ops()).not.toBe(simples.ctx.caneLayer.ops());
  });
  it('a cadeira de rodas só é desenhada com o modo ligado, e nunca na água nem voando', () => {
    setPlayers(1, () => ({}));
    const off = makeCtx({ isWheelchair: () => false }); off.api.drawFrame();
    expect(off.ctx.chairLayer.ops()).toBe(0);

    const on = makeCtx({ isWheelchair: () => true }); on.api.drawFrame();
    expect(on.ctx.chairLayer.ops()).toBeGreaterThan(0);

    setPlayers(1, () => ({ inWater: true }));
    const agua = makeCtx({ isWheelchair: () => true }); agua.api.drawFrame();
    expect(agua.ctx.chairLayer.ops()).toBe(0);

    setPlayers(1, () => ({ flying: true }));
    const voo = makeCtx({ isWheelchair: () => true }); voo.api.drawFrame();
    expect(voo.ctx.chairLayer.ops()).toBe(0);
  });
  it('a hitbox do Fácil sai UMA vez por jogador em Fácil — e nenhuma para os demais', () => {
    setPlayers(3, (i) => ({ easy: i !== 1 }));
    setNumPlayersValue(1); // caminho de tela única; o laço da hitbox varre TODOS os jogadores
    const { api, ctx } = makeCtx();
    api.drawFrame();
    expect(ctx.easyHitbox.calls.filter((c) => c[0] === 'drawRect').length).toBe(2);
  });
  it('sem ninguém em Fácil, a hitbox é só limpa', () => {
    setPlayers(1, () => ({ easy: false }));
    const { api, ctx } = makeCtx();
    api.drawFrame();
    expect(ctx.easyHitbox.ops()).toBe(0);
  });
});

/* ===================== drawFrame: os DOIS caminhos de câmera ===================== */

describe('render/draw — tela única × multi-tela', () => {
  it('[One] 1 jogador: enquadra o P1, alimenta o minimapa e NÃO usa render-texture', () => {
    setPlayers(1, () => ({ x: 600, y: 500 }));
    const { api, log } = makeCtx();
    api.drawFrame();
    const camX = 600 - LOGICAL_W / 2, camY = (500 - BOX.h / 2) - LOGICAL_H / 2;
    expect(log.minimap).toEqual([['seen', camX, camY], ['redraw'], ['player', 600, 500 - BOX.h / 2]]);
    expect(log.render).toEqual([]);
    expect(log.shared).toEqual([]);
  });
  it('[Many] 3 jogadores: uma passada de render por viewport, na render-texture do índice', () => {
    setPlayers(3);
    const { api, log } = makeCtx();
    api.drawFrame();
    expect(log.render).toEqual(['RT0', 'RT1', 'RT2']);
    expect(log.parallax.length).toBe(3);   // placeCam roda uma vez por tela
    expect(log.minimap).toEqual([]);       // minimapa é exclusivo da tela única
  });
  it('multi-tela com TODOS no mesmo modo: troca as texturas UMA vez só (a otimização do caso comum)', () => {
    setPlayers(2, () => ({ viz: 'normal' }));
    const { api, log } = makeCtx();
    api.drawFrame();
    expect(log.shared).toEqual(['normal']);
  });
  it('multi-tela com modos DIFERENTES: troca por viewport, na ordem dos jogadores', () => {
    setPlayers(2, (i) => ({ viz: i === 0 ? 'normal' : 'protanopia' }));
    const { api, log } = makeCtx();
    api.drawFrame();
    expect(log.shared).toEqual(['normal', 'protanopia']);
  });
  it('o overlay de baixa visão só roda se ALGUÉM está em baixa visão — e aí em TODOS os viewports', () => {
    setPlayers(2, () => ({ viz: 'normal' }));
    const semLv = makeCtx(); semLv.api.drawFrame();
    expect(semLv.log.overlay).toEqual([]);

    setPlayers(2, (i) => ({ viz: i === 0 ? 'lv-tunnel' : 'normal' }));
    const comLv = makeCtx(); comLv.api.drawFrame();
    expect(comLv.log.overlay).toEqual([[0, 'lv-tunnel'], [1, 'normal']]);
  });
  it('power-ups: a visibilidade é reavaliada POR JOGADOR antes de cada passada', () => {
    setPlayers(2);
    const vistos = [];
    const pu = { sprite: { visible: true } };
    const { api } = makeCtx({
      getPowerups: () => [pu],
      // A REGRA é do jogo agora (item 19): era `puTaken(pu, i)` importado de `game/powerups`, com o
      // "chave é global, o resto é por jogador" dentro do desenho. O fixture declara a regra que o caso
      // precisa — pego pelo P1, não pelo P2 — e o que se mede é que o DESENHO pergunta uma vez por jogador.
      powerupVisibleTo: (_pu, i) => i !== 0,
      renderizarEm: () => vistos.push(pu.sprite.visible),
    });
    api.drawFrame();
    expect(vistos).toEqual([false, true]); // some para quem pegou, aparece para quem não pegou
  });
  it('[Right] a VISIBILIDADE de cada item é perguntada por (item, jogador) — e o sprite obedece', () => {
    // A regra "item coletado some" era `s.visible = !cn.taken`, lida de `core/state.coins` dentro do desenho.
    // Saiu para o ctx no item 19. Sem este caso, `itemVisibleTo` poderia nunca ser chamada e nada acusaria:
    // o fixture padrão responde `true`, que é o mesmo que o desenho faria por conta própria.
    setPlayers(2);
    const sprites = [{ visible: true, alpha: 1 }, { visible: true, alpha: 1 }];
    const perguntas = [];
    const { api } = makeCtx({
      getItemSprites: () => sprites,
      itemVisibleTo: (j, i) => { perguntas.push([j, i]); return j === 0; }, // só o item 0 aparece
    });
    api.drawFrame();
    expect(sprites.map((s) => s.visible)).toEqual([true, false]);
    // dois itens × dois jogadores: a pergunta é feita para cada par, e não uma vez por quadro
    expect(perguntas).toEqual([[0, 0], [1, 0], [0, 1], [1, 1]]);
  });

  it('[Right] item de OUTRO dono sai esmaecido — e quem diz quem é o dono é o jogo', () => {
    // Era `cn.owner === i` dentro do desenho. O 0.4 fica (é juice da engine); a ideia de POSSE saiu.
    // Um cooperativo responde `true` sempre, e ninguém esmaece nada.
    setPlayers(2);
    // Compara o MESMO item nas duas respostas, e não dois itens entre si: o cintilar tem uma FASE POR ITEM
    // (`sin(clock*0.12 + j*1.7)`), então dois sprites diferentes nunca partem do mesmo alpha. Minha primeira
    // versão deste caso comparava item 0 com item 1 e reprovou por causa da fase — o teste estava errado, o
    // código não. Fica registrado porque é o tipo de erro que se "conserta" afrouxando a tolerância.
    const comDono = [{ visible: true, alpha: 1 }];
    makeCtx({ getItemSprites: () => comDono, itemOwnedBy: () => true }).api.drawFrame();
    const semDono = [{ visible: true, alpha: 1 }];
    makeCtx({ getItemSprites: () => semDono, itemOwnedBy: () => false }).api.drawFrame();
    expect(semDono[0].alpha).toBeCloseTo(0.4 * comDono[0].alpha, 5);
  });

  it('o HUD e os elevadores saem UMA vez por quadro, nos dois caminhos', () => {
    setPlayers(1);
    const um = makeCtx(); um.api.drawFrame();
    expect([um.log.hud, um.log.elev]).toEqual([1, 1]);
    setPlayers(4);
    const quatro = makeCtx(); quatro.api.drawFrame();
    expect([quatro.log.hud, quatro.log.elev]).toEqual([1, 1]);
  });
});

/* ===================== animatePlayer: a costura com render/player-anim ===================== */

describe('render/draw — animatePlayer', () => {
  it('escolhe o quadro (player-anim), grava em _tx e aplica no sprite PASSANDO pelo recolor do modo', () => {
    setPlayers(1, () => ({ viz: 'hc-cego', walkAnim: 0 }));
    const pl = players[0];
    const { api } = makeCtx({ playerVizTex: (base, viz) => `${viz}:${base}` });
    const tx = api.animatePlayer(pl, 1, 1); // com direção → quadro de andar
    expect(tx).toBe('w0');
    expect(pl._tx).toBe('w0');              // _tx guarda o quadro EM COR (base do recolor por viewport)
    expect(pl.sprite.texture).toBe('hc-cego:w0');
  });
  it('sem sprite (jogador que ainda não materializou) só decide, sem quebrar', () => {
    setPlayers(1, () => ({ sprite: null }));
    const { api } = makeCtx();
    expect(api.animatePlayer(players[0], 1, 0)).toBe('i0');
  });
  it('repassa o estado de cadeira de rodas do game.js para a decisão do quadro', () => {
    setPlayers(1, () => ({ walkAnim: 999 }));
    const { api } = makeCtx({ isWheelchair: () => true });
    expect(api.animatePlayer(players[0], 1, 1)).toBe('i0'); // sentado: sem ciclo de passos
  });
});
