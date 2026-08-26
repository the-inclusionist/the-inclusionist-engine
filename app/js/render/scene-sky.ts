// SPDX-License-Identifier: AGPL-3.0-or-later
// render/scene-sky — céu de tela: deriva de nuvens (math pura + bug #21) + trilha viva da v3 (nuvens/pássaros do mundo,
// estrelas/névoa, grama/minhocas/vagalumes/borboletas). Extraído do game.js (#43). As 6 CAMADAS (skyLayer/starsG/
// skyDecoG/fogG/grassG/themeFxG) continuam sendo CRIADAS no game.js — a ordem-z delas está soldada na montagem do
// render-graph (parallax/worldSprite/lifeLayer/carLayer) — e são INJETADAS aqui; movemos só a LÓGICA. Fórmulas copiadas
// verbatim da v3.1.100. Injeção por closure. Ver docs/5-Refactoring/plano-modularizacao-mapa.md (#43).

import type { Desenho, Camada } from './port.js';
/**
 * Posição horizontal de uma nuvem à deriva, com wrap SUB-PIXEL e pelo CORPO INTEIRO. Corrige #21:
 * (a) NÃO arredonda → deriva suave mesmo a <1px/frame; (b) só reentra quando a nuvem inteira saiu.
 * @param phase distância de deriva acumulada (float; cresce → direita, decresce → esquerda)
 * @param enterAt x de (re)entrada — passe `-larguraDaNuvem` p/ reentrar TOTALMENTE fora da tela
 * @param span período do wrap — passe `larguraDaTela + larguraDaNuvem` p/ só reentrar depois de sair inteira
 */
export function cloudWrapX(phase: number, enterAt: number, span: number): number {
  return ((phase % span) + span) % span + enterAt;
}

/* ===================== a manta de nuvens ===================== */
//
// ERAM TRÊS NUVENS EM ALTURAS FIXAS, à deriva e nada mais. O Dev pediu, para a Floresta, cúmulos brancos
// ABUNDANTES que se JUNTAM, chove, e depois se SEPARAM mostrando o pôr do sol nas frestas — ou seja, pediu um
// movimento com causa, não uma decoração a mais.
//
// A conta disso está aqui e é PURA: dado o relógio, a largura da tela, quantas nuvens e o quanto elas estão
// aglomeradas, existe UMA disposição determinada. Separá-la do desenho é o que a torna aferível — dá para
// afirmar que a 1 elas se sobrepõem e a 0 sobra céu entre elas, que é exatamente a diferença que o pedido
// descreve, e que de outro modo só se confere olhando.
//
// FECHAR É COBRIR O CÉU INTEIRO, E NÃO ENGROSSAR UMA FAIXA NO TOPO. A primeira versão alinhava tudo numa faixa
// alta: o céu ficava com uma barra branca em cima e o pôr do sol inteiro — sol incluído — continuava à vista
// embaixo dela, o que não é tempo fechado, é uma tarja. O Dev viu e disse o que faltava: as nuvens têm de se
// aglomerar NO CÉU INTEIRO, escondendo o Sol.
//
// Daí as TRÊS FILEIRAS. Cada nuvem tem uma fileira fixa (`i % 3`), e fechar é ir da altura de repouso para a
// altura da sua fileira — 0, 27 e 54 px, que com a altura de cada cúmulo cobrem do topo até a linha do
// horizonte. As fileiras ficam DEFASADAS em x (as de índices vizinhos distam um terço do passo), e é essa
// defasagem que impede as três de terem buraco no mesmo lugar.
//
// E O CÉU ABERTO NÃO PODE TER 27 NUVENS, senão nunca há tempo bom. Só a fileira 0 está SEMPRE lá; as outras
// duas SURGEM conforme o céu fecha (`surge`), e é isso que dá a leitura de "estão chegando mais nuvens" em vez
// de "as nuvens desceram". Elas somem de novo na abertura, e o pôr do sol reaparece por trás.
//
// O QUE NUNCA MUDA COM `junta` é o x. Puxar todas para um mesmo x faria um bolo num canto do céu e céu limpo
// no resto — e aí choveria ao lado da criança, não sobre ela.

/** Uma nuvem de tela neste quadro. `esc` multiplica o desenho base; `alpha`, a opacidade. */
export interface NuvemDeTela { x: number; y: number; esc: number; alpha: number }

/** Largura e altura do cúmulo base, antes de `esc`. Quem mede cobertura precisa das duas. */
export const NUVEM_W = 26, NUVEM_H = 13;

/** Quantas fileiras a manta fechada tem. É o que a faz cobrir do topo ao horizonte em vez de só o topo. */
const FILEIRAS = 3;

/**
 * Onde estão as `n` nuvens de tela neste instante.
 *
 * Os fatores 37, 13, 7 e 5 são PRIMOS COM 3 de propósito: a fileira é `i % 3`, e qualquer variação tirada de
 * `i` com um fator múltiplo de 3 sairia CONSTANTE dentro de uma fileira — a fileira 0, que é a que se vê no
 * tempo bom, teria todas as nuvens do mesmo tamanho, à mesma velocidade e na mesma altura. Já aconteceu.
 *
 * @param t relógio de efeitos (0 congela a deriva — movimento reduzido)
 * @param vw largura do viewport
 * @param n quantas nuvens no total (a fileira 0, ~n/3, é a que aparece no tempo bom)
 * @param junta 0 = poucas e altas (o pôr do sol aparece) · 1 = as três fileiras cobrindo o céu inteiro
 */
export function nuvensDeTela(t: number, vw: number, n: number, junta: number): NuvemDeTela[] {
  const j = Math.max(0, Math.min(1, junta)), nuvens: NuvemDeTela[] = [];
  for (let i = 0; i < n; i++) {
    const sp = 0.05 + ((i * 7) % 4) * 0.021;          // velocidades diferentes: elas se alcançam e se abrem
    const esc = (1.15 + ((i * 37) % 5) * 0.18) * (1 + 0.6 * j); // crescem ao fechar até uma encostar na outra
    const larg = NUVEM_W * esc;
    const x = cloudWrapX(t * sp + (i * (vw + larg)) / Math.max(1, n), -larg, vw + larg);
    const aberto = 4 + ((i * 37) % 26);               // altura de repouso: a faixa alta do céu
    const fechado = (i % FILEIRAS) * 27 + ((i * 13) % 7); // altura de manta: a fileira desta nuvem
    // A fileira 0 é permanente; as outras entram entre 0,15 e 0,65 de aglomeração — antes da chuva, portanto.
    const surge = i % FILEIRAS === 0 ? 1 : Math.max(0, Math.min(1, (j - 0.15) / 0.5));
    nuvens.push({ x, y: (1 - j) * aberto + j * fechado, esc, alpha: (0.72 + 0.28 * j) * surge });
  }
  return nuvens;
}

/**
 * Um cúmulo em retângulos: laje de base e três lóbulos de alturas diferentes. Retângulos e não arcos porque é
 * o que o `Gfx` do PIXI oferece aqui e porque é o que combina com o resto — a nuvem é pixel art, não um
 * desenho vetorial reduzido. `[x, y, w, h]` no espaço da nuvem base (NUVEM_W×NUVEM_H), multiplicado por `esc`.
 */
const CUMULO: readonly (readonly [number, number, number, number])[] = [
  [0, 8, 26, 4], [2, 5, 9, 3], [3, 3, 6, 2], [4, 2, 4, 1],
  [9, 4, 9, 4], [11, 2, 6, 2], [12, 1, 4, 1],
  [17, 5, 7, 3], [18, 3, 4, 2],
];
/** A sombra sob a base — uma linha só. Na Floresta ela é alaranjada: a luz baixa bate por baixo. */
const CUMULO_SOMBRA: readonly [number, number, number, number] = [1, 12, 24, 1];

type Gfx = Desenho;
interface Sprite { x: number; y: number; alpha: number; texture: unknown; scale: { x: number }; _v?: number; destroy(): void; }
type Layer = Camada;
interface SpriteCtor { new (tex: unknown): Sprite; }
interface Bird { s: Sprite; dir: number; f: number; t: number; }
interface Flora { base: string; top: string; bDk: string; bLt: string; petals: string[]; center: string; }
interface Theme { v3?: boolean; decor?: string[]; cloud?: [string, string]; nuvens?: number }
interface Pl { x: number; y: number; quit?: boolean; }

export interface SceneSkyCtx {
  skyLayer: Layer; starsG: Gfx; skyDecoG: Gfx; fogG: Gfx; grassG: Gfx; themeFxG: Gfx; themeFxBackG: Gfx; // camadas (criadas no game.js)
  /** A MANTA de nuvens, e ela tem camada PRÓPRIA por causa da ordem-z: fica na frente do céu (por isso
   *  esconde o sol) e ATRÁS das duas bandas de morro (por isso as árvores do fundo passam à frente dela).
   *  `skyDecoG`, onde moram os pássaros e as nuvens dos outros temas, está à frente dos morros e não serve. */
  nuvemG: Gfx;
  CLOUD_TEX: unknown[]; BIRD_TEX: unknown[]; SpriteCtor: SpriteCtor; // texturas + PIXI.Sprite
  hexN: (s: string) => number; rnd: () => number; randInt: (a: number, b: number) => number;
  WORLD_PX_W: number; WORLD_PX_H: number; WORLD_W: number; WORLD_H: number; TILE: number; LOGICAL_W: number; LOGICAL_H: number; BOX: { h: number };
  CENARIOS: Record<string, Theme>; THEME_FLORA: Record<string, Flora | undefined>; DIRECT_CFG: Record<string, unknown>;
  solidAt: (x: number, y: number) => boolean; tileAt: (x: number, y: number) => number;
  getCenario: () => string; getVizMode: () => string; getPlayers: () => Pl[]; getFxClock: () => number; getRm: () => { decor?: boolean; parallax?: boolean };
  /** 0..1 — o quanto as nuvens estão fechadas neste quadro (render/weather.getAglomeracao). Um só relógio
   *  para a chuva e para as nuvens: dois desandariam um do outro depois de alguns minutos. */
  getAglomeracao: () => number;
  getGrassDensity: () => number; // 0..1: fração das superfícies com flora (grama/flores). 1 = todas; 0.6 = 60%. Base p/ estações.
  getDecorSeed: () => number;    // semente por FASE: quais superfícies são escolhidas na densidade (randômico no load).
}

export interface SceneSky { stepSky: (dt: number) => void; stepV3Decor: () => void; getClouds: () => Sprite[]; getBirds: () => Bird[]; }

export function createSceneSky(ctx: SceneSkyCtx): SceneSky {
  const clouds: Sprite[] = []; let birds: Bird[] = []; let _birdT = 500;

  // seedClouds v3: 7 nuvens à deriva no céu do MUNDO (skyLayer)
  for (let i = 0; i < 7; i++) {
    const s = new ctx.SpriteCtor(ctx.CLOUD_TEX[i % 2]); s.alpha = 0.5 + ((i * 37) % 30) / 100;
    s.x = (i * 173) % ctx.WORLD_PX_W; s.y = 8 + ((i * 61) % Math.floor(ctx.WORLD_PX_H * 0.30)); s._v = 0.02 + ((i * 13) % 10) / 300;
    ctx.skyLayer.addChild(s); clouds.push(s);
  }

  function stepSky(dt: number): void {
    if (ctx.getRm().decor) { if (birds.length) { birds.forEach((b) => { ctx.skyLayer.removeChild(b.s); b.s.destroy(); }); birds = []; } return; }
    for (const c of clouds) { c.x += (c._v || 0) * dt; if (c.x > ctx.WORLD_PX_W + 50) c.x = -50; }
    if (birds.length < 3 && ++_birdT >= 520) { _birdT = ctx.randInt(0, 300); const dir = ctx.rnd() < 0.5 ? 1 : -1;
      const s = new ctx.SpriteCtor(ctx.BIRD_TEX[0]); s.scale.x = dir; s.x = dir > 0 ? -10 : ctx.WORLD_PX_W + 10; s.y = 12 + ctx.rnd() * ctx.WORLD_PX_H * 0.25; ctx.skyLayer.addChild(s);
      birds.push({ s, dir, f: 0, t: 0 }); }
    for (let i = birds.length - 1; i >= 0; i--) { const b = birds[i]; b.s.x += b.dir * 0.7 * dt; b.t += dt; if (b.t >= 8) { b.t = 0; b.f = 1 - b.f; b.s.texture = ctx.BIRD_TEX[b.f]; }
      if (b.s.x < -16 || b.s.x > ctx.WORLD_PX_W + 16) { ctx.skyLayer.removeChild(b.s); b.s.destroy(); birds.splice(i, 1); } }
  }

  function drawV3Cloud(g: Gfx, x: number, y: number, col: [string, string]): void { // drawCloud v3: laje + 3 puffs + sombra
    g.beginFill(ctx.hexN(col[0])).drawRect(x, y + 6, 24, 6).drawRect(x + 2, y + 4, 8, 4).drawRect(x + 3, y + 2, 6, 2)
      .drawRect(x + 8, y + 2, 12, 6).drawRect(x + 10, y, 8, 2).drawRect(x + 16, y + 4, 8, 4).endFill();
    g.beginFill(ctx.hexN(col[1])).drawRect(x + 1, y + 11, 22, 1).endFill();
  }

  function drawCumulo(g: Gfx, nv: NuvemDeTela, col: [string, string]): void { // cúmulo escalável (ver CUMULO)
    const e = nv.esc, R = (r: readonly [number, number, number, number]): void => {
      g.drawRect(Math.round(nv.x + r[0] * e), Math.round(nv.y + r[1] * e), Math.round(r[2] * e), Math.round(r[3] * e));
    };
    g.beginFill(ctx.hexN(col[0]), nv.alpha); for (const r of CUMULO) R(r); g.endFill();
    g.beginFill(ctx.hexN(col[1]), nv.alpha); R(CUMULO_SOMBRA); g.endFill();
  }

  function drawV3Grass(g: Gfx, tx: number, ty: number, fl: Flora, t: number): void { // drawSurfaceGrass v3 (tufos ao vento + flor)
    const TILE = ctx.TILE, x = tx * TILE, y = ty * TILE, wind = ctx.getRm().decor ? 0 : Math.sin(t * 0.045 + tx * 0.6);
    g.beginFill(ctx.hexN(fl.base)).drawRect(x, y, TILE, 2).endFill();
    g.beginFill(ctx.hexN(fl.top)).drawRect(x, y, TILE, 1).endFill();
    const seed = (tx * 1103515245 + 12345) >>> 0;
    for (let i = 0; i < 6; i++) { const bx = (seed >> (i * 4)) & 15, bh = 2 + ((seed >> (i * 4 + 4)) & 1);
      g.beginFill(ctx.hexN((i & 1) ? fl.bDk : fl.bLt));
      for (let h = 0; h < bh; h++) { const dx = Math.round(wind * (h / Math.max(1, bh - 1)) * 1.5); g.drawRect(x + bx + dx, y - 1 - h, 1, 1); }
      g.endFill(); }
    if ((seed >> 9) % 7 === 0) { const fx = x + 4 + (seed % 7), sh = 4, cy = y - sh - 2;
      g.beginFill(ctx.hexN(fl.bDk)); let topDx = 0;
      for (let h = 0; h < sh; h++) { topDx = Math.round(wind * (h / sh) * 2.4); g.drawRect(fx + topDx, y - 1 - h, 1, 1); } g.endFill();
      const bxC = fx + topDx;
      g.beginFill(ctx.hexN(fl.petals[(seed >>> 17) % fl.petals.length])).drawRect(bxC - 1, cy + 1, 3, 1).drawRect(bxC, cy, 1, 3).endFill(); // >>> (v3 usava >> e o canvas engolia o índice; PIXI lança)
      g.beginFill(ctx.hexN(fl.center)).drawRect(bxC, cy + 1, 1, 1).endFill(); }
  }

  function stepV3Decor(): void {
    const T = ctx.CENARIOS[ctx.getCenario()] || {};
    ctx.starsG.clear(); ctx.skyDecoG.clear(); ctx.nuvemG.clear(); ctx.fogG.clear(); ctx.grassG.clear(); ctx.themeFxG.clear(); ctx.themeFxBackG.clear();
    // A pergunta é "este tema tem decoração viva?", e ela se responde OLHANDO A DECORAÇÃO. Antes era
    // `!T.v3`, que respondia "este tema não é a Cidade" — o mesmo resultado por acidente, enquanto a Cidade
    // era o único tema sem céu vivo. Um tema de fundo raster COM borboletas quebrava aquilo; este não.
    if (!T.decor?.length || ctx.DIRECT_CFG[ctx.getVizMode()]) return; // alto contraste dispensa decor
    const t = ctx.getFxClock(), d = T.decor || [], vw = ctx.LOGICAL_W, vh = ctx.LOGICAL_H, reduzido = !!ctx.getRm().decor;
    // TELA: estrelas (sparkles v3) — cintilam a ~0,3Hz
    if (!reduzido && d.includes('sparkles')) { const top = Math.max(1, Math.floor(vh * 0.7));
      for (let i = 0; i < 22; i++) { const a = 0.3 + 0.35 * Math.sin(t * 0.03 + i * 1.3); if (a <= 0.05) continue;
        ctx.starsG.beginFill(0xffffff, a).drawRect((i * 73) % vw, (i * 49) % top, 1, 1).endFill(); } }
    // TELA: nuvens. Dois caminhos, e a diferença é DADO, não gosto:
    //  · tema com `nuvens: N` (hoje só a Floresta) — manta viva de N cúmulos que fecha e abre com a chuva;
    //  · os outros três — as 3 lajes da v3, derivas 0.08/0.05/0.11, VERBATIM. Não passaram por aqui de graça:
    //    o Dev pediu o céu novo para a Floresta, e mudar a aparência dos outros três de carona seria alargar
    //    o pedido por conta própria. Quando ele quiser, é trocar um número na tabela de cenários.
    if (d.includes('nuvens') && T.cloud && T.nuvens) {
      const col = T.cloud, junta = reduzido ? 0 : ctx.getAglomeracao();
      // `nuvemG` e não `skyDecoG`: a manta fica ATRÁS das bandas de morro (ver a nota no ctx).
      for (const nv of nuvensDeTela(reduzido ? 0 : t, vw, T.nuvens, junta)) drawCumulo(ctx.nuvemG, nv, col);
    } else if (d.includes('nuvens') && T.cloud) { const col = T.cloud, defs = [{ y: 6, sp: 0.08, off: 0 }, { y: 20, sp: 0.05, off: 130 }, { y: 12, sp: 0.11, off: 250 }];
      for (const c0 of defs) { const x = cloudWrapX((reduzido ? 0 : t) * c0.sp + c0.off, -44, vw + 64); drawV3Cloud(ctx.skyDecoG, x, c0.y, col); } }
    if (!reduzido && d.includes('passaros')) { ctx.skyDecoG.beginFill(0x282837, 0.7);
      for (let i = 0; i < 3; i++) { const bx = ((t * (0.25 + i * 0.07) + i * 90) % (vw + 20)) - 10, by = 14 + i * 9 + Math.sin(t * 0.04 + i) * 2, f = Math.sin(t * 0.2 + i) > 0 ? 1 : 2;
        const X = Math.round(bx), Y = Math.round(by); ctx.skyDecoG.drawRect(X - 2, Y + f, 2, 1).drawRect(X + 1, Y + f, 2, 1).drawRect(X, Y, 1, 1); }
      ctx.skyDecoG.endFill(); }
    // TELA: névoa do amanhecer (3 camadas onduladas) — v3 exato, na FRENTE
    if (d.includes('nevoa')) { const base = Math.floor(vh * 0.72);
      const Ls = [{ y: base, drift: 0.30, amp: 3, op: 0.06, freq: 0.080 }, { y: base + 6, drift: 0.55, amp: 4, op: 0.08, freq: 0.060 }, { y: base + 13, drift: 0.85, amp: 5, op: 0.10, freq: 0.050 }];
      for (const L of Ls) { ctx.fogG.beginFill(0xdee2ec, L.op);
        for (let x = 0; x < vw; x += 2) { const top = L.y + Math.round(L.amp * Math.sin((x + (reduzido ? 0 : t) * L.drift) * L.freq)); ctx.fogG.drawRect(x, top, 2, vh - top); }
        ctx.fogG.endFill(); } }
    // MUNDO (culled por jogador, dedupe): grama em TODA superfície + minhocas/vagalumes/borboletas
    const fl = ctx.THEME_FLORA[ctx.getCenario()], seen = new Set<string>();
    for (const pl of ctx.getPlayers()) { if (pl.quit) continue;
      const camX = Math.max(0, Math.min(pl.x - vw / 2, ctx.WORLD_PX_W - vw)), camY = Math.max(0, Math.min((pl.y - ctx.BOX.h / 2) - vh / 2, ctx.WORLD_PX_H - vh));
      // Margem de recorte = 3 tiles em TODAS as direções: cobre a flutuação da fauna (borboleta sobe ~34px ≈ 2 tiles,
      // deriva ~19px) E reduz pop-in do decor na beirada ao mover a câmera → mais fluido (José). (#69)
      const tx0 = Math.max(0, Math.floor(camX / ctx.TILE) - 3), tx1 = Math.min(ctx.WORLD_W - 1, Math.floor((camX + vw) / ctx.TILE) + 3);
      const ty0 = Math.max(0, Math.floor(camY / ctx.TILE) - 3), ty1 = Math.min(ctx.WORLD_H - 1, Math.floor((camY + vh) / ctx.TILE) + 3);
      for (let tx = tx0; tx <= tx1; tx++) {
        for (let ty = ty0; ty <= ty1; ty++) {
          const st = ctx.tileAt(tx, ty); // flora/fauna SÓ em PEDRA(2)/parede(6) — nunca em trampolim(5), lava(9) ou escada(4). #69
          if (!((st === 2 || st === 6) && !ctx.solidAt(tx, ty - 1) && ctx.tileAt(tx, ty - 1) !== 3 && ctx.tileAt(tx, ty - 1) !== 9)) continue;
          const k = tx + ',' + ty; if (seen.has('g' + k)) continue; seen.add('g' + k);
          // densidade: só uma FRAÇÃO das superfícies recebe flora (getGrassDensity), escolhidas por hash+semente da fase.
          if (fl && ((tx * 668265263 ^ ty * 2246822519 ^ ctx.getDecorSeed()) >>> 0) % 1000 < ctx.getGrassDensity() * 1000) drawV3Grass(ctx.grassG, tx, ty, fl, t);
          // #69: fauna distribuída POR SUPERFÍCIE (hash de tx,ty), não "1 por coluna no topo" — aparece em todas as
          // alturas, inclusive perto do player em corredores baixos / junto à lava (antes ancorava só na superfície + alta).
          if (d.includes('minhocas') && ((tx * 668265263 ^ ty * 374761393) >>> 0) % 6 === 0 && !seen.has('w' + k)) { seen.add('w' + k); // ~1/6 das superfícies
            ctx.themeFxG.beginFill(0xc47b8a); const bx = tx * ctx.TILE + 5, by = ty * ctx.TILE + 4;
            for (let s2 = 0; s2 < 5; s2++) ctx.themeFxG.drawRect(bx + s2, by + Math.round(reduzido ? 0 : Math.sin(t * 0.15 + tx * 0.7 + s2 * 0.8)), 1, 1);
            ctx.themeFxG.endFill(); }
          const bh = (tx * 374761393 ^ ty * 668265263) >>> 0; // hash por superfície (cor + lado + gate)
          if (!reduzido && d.includes('borboletas') && bh % 7 === 0 && !seen.has('b' + k)) { seen.add('b' + k); // ~1/7 das superfícies
            const cols = [0xff8c42, 0xffd166, 0xef476f, 0xfca5d4, 0xf4a261, 0xe9c46a];
            const groundY = ty * ctx.TILE, wx = tx * ctx.TILE + 8 + 14 * Math.sin(t * 0.015 + tx + ty) + 5 * Math.cos(t * 0.04 + tx);
            const rise = 8 + 26 * (0.5 + 0.5 * Math.sin(t * 0.012 + tx * 1.3 + ty)), wy = groundY - rise + 4 * Math.sin(t * 0.05 + tx);
            const flap = Math.abs(Math.sin(t * 0.4 + tx * 0.7 + ty)), w = 1 + Math.round(flap * 2), X = Math.round(wx), Y = Math.round(wy);
            const bfg = (bh & 1) ? ctx.themeFxG : ctx.themeFxBackG; // metade ATRÁS / metade À FRENTE do player — #69
            bfg.beginFill(cols[bh % cols.length]).drawRect(X - w, Y, w, 2).drawRect(X + 2, Y, w, 2).endFill();
            bfg.beginFill(0x3a2a1a).drawRect(X, Y, 2, 2).endFill(); }
          // (sem break: grama em TODAS as superfícies expostas da coluna, não só a mais alta — senão some perto do player. #69)
        } }
      if (!reduzido && d.includes('vagalumes')) { const cell = 64; // drawFireflies v3: grade hash fixa no mundo, só no ar
        const cx0 = Math.floor(camX / cell) - 1, cx1 = Math.floor((camX + vw) / cell) + 1, cy0 = Math.floor(camY / cell) - 1, cy1 = Math.floor((camY + vh) / cell) + 1;
        for (let cyi = cy0; cyi <= cy1; cyi++) for (let cxi = cx0; cxi <= cx1; cxi++) {
          const h = ((cxi * 73856093) ^ (cyi * 19349663)) >>> 0; if (h % 3 !== 0) continue;
          const k = 'f' + cxi + ',' + cyi; if (seen.has(k)) continue; seen.add(k);
          const ph = ((h >> 4) % 628) / 100;
          const wx = cxi * cell + 8 + (h % (cell - 16)) + 8 * Math.sin(t * 0.013 + ph), wy = cyi * cell + 8 + ((h >> 9) % (cell - 16)) + 6 * Math.cos(t * 0.017 + ph * 1.3);
          const a = 0.45 + 0.45 * Math.sin(t * 0.05 + ph); if (a <= 0.06) continue;
          if (ctx.solidAt(Math.floor(wx / ctx.TILE), Math.floor(wy / ctx.TILE))) continue;
          ctx.themeFxBackG.beginFill(0xfff096, a * 0.35).drawRect(wx - 1, wy - 1, 3, 3).endFill(); // vaga-lumes ao FUNDO (atrás do player) — #69
          ctx.themeFxBackG.beginFill(0xffffbe, a).drawRect(wx, wy, 1, 1).endFill(); } }
    }
  }

  return { stepSky, stepV3Decor, getClouds: () => clouds, getBirds: () => birds };
}
