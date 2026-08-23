// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de render/set-cenario — a ORQUESTRAÇÃO da troca de mundo visual (project node). ZOMBIES + Right-BICEP.
//
// `setCenario` não desenha nada: ela decide QUEM é avisado e EM QUE ORDEM. É por isso que quase todos os casos
// daqui são sobre SEQUÊNCIA e sobre TEMPO, e não sobre valor:
//
//  · `setCenarioValue` (grava + persiste) vem ANTES do trabalho de textura. Não é preferência: é o que ARMA a
//    guarda de corrida — quem compara `getCenario() !== tema` está comparando com o valor que esta chamada
//    acabou de gravar. Inverter as duas linhas desarma a guarda sem quebrar nada visível.
//  · A GUARDA DE CORRIDA em si: os tiles chegam quando chegarem, e no splash (ou na demonstração automática,
//    que troca de cenário sozinha) a pessoa pode já estar em outro tema. Um tileset atrasado do Campo não pode
//    repintar o chão da Floresta. É um defeito que aparece uma vez a cada cem trocas e some quando alguém vai
//    olhar — de mão, não se reproduz com confiança.
//  · Os dois `reapplyVizAll` NÃO são duplicação: um é síncrono (o tema mudou) e o outro é do `.then` (a textura
//    do mundo mudou). E no BOOT — `vizReady` ainda falso — o caminho é o terceiro: pintar `worldSprite` direto.
//    Esse é exatamente o instante em que o `setCenario` da restauração do tema salvo roda.
//  · `carregarTilesDoTema` NUNCA rejeita: tema sem arte é caminho normal (a Cidade não tem tileset próprio), e
//    uma rejeição derrubaria a troca de cenário inteira dentro do `try/catch` mudo do boot.
import { describe, it, expect } from 'vitest';
import { createSetCenario, carregarTilesDoTema } from '../app/js/render/set-cenario.js';

/* ===================== dublês ===================== */

/** `Image` de mentira: registra-se numa lista e expõe onload/onerror para o teste disparar à mão. */
function fabricaDeImagem(lista) {
  return class FakeImg {
    constructor() { this.onload = null; this.onerror = null; this._src = ''; lista.push(this); }
    set src(v) { this._src = v; } get src() { return this._src; }
  };
}

function ambiente(over = {}) {
  const log = [], imgs = [];
  const estado = { cenario: 'cidade', vizReady: over.vizReady ?? false, vidaReady: over.vidaReady ?? false, world: null };
  const worldSprite = over.semWorldSprite ? null : { texture: 'TEX-VELHA' };
  const ctx = {
    setCenarioValue: (t) => { log.push(['setCenarioValue', t]); estado.cenario = t; },
    getCenario: () => estado.cenario,
    aplicarTemaParallax: (theme, T) => log.push(['parallax', theme, T.nome]),
    Imagem: fabricaDeImagem(imgs),
    worldCanvas: (tiles) => { log.push(['worldCanvas', tiles === null ? null : 'tiles']); return 'CANVAS'; },
    tex: (cv) => 'TEX(' + cv + ')',
    clearWorldTexCache: () => log.push(['clearWorldTexCache']),
    setWorldTextures: (cv, t) => { log.push(['setWorldTextures', cv, t]); estado.world = [cv, t]; },
    isVizReady: () => estado.vizReady,
    reapplyVizAll: () => log.push(['reapplyVizAll']),
    getWorldSprite: () => worldSprite,
    isVidaReady: () => estado.vidaReady,
    applyCenarioVida: () => log.push(['applyCenarioVida']),
  };
  return { ctx, log, imgs, estado, worldSprite, api: createSetCenario(ctx) };
}

/** Dispara o onload das duas imagens de tile e devolve o controle depois das microtarefas. */
const carregou = async (imgs, base = 0) => { imgs[base].onload(); imgs[base + 1].onload(); await Promise.resolve(); await Promise.resolve(); };
const falhou = async (imgs, base = 0) => { imgs[base].onerror(); await Promise.resolve(); await Promise.resolve(); };

/* ===================== carregarTilesDoTema ===================== */

describe('carregarTilesDoTema', () => {
  it('pede tile_fill e tile_surface do tema', () => {
    const imgs = [];
    void carregarTilesDoTema(fabricaDeImagem(imgs), 'campo');
    expect(imgs.map((i) => i.src)).toEqual(['assets/cenarios/campo/tile_fill.png', 'assets/cenarios/campo/tile_surface.png']);
  });

  it('resolve com os DOIS só quando as duas chegam (uma só não basta)', async () => {
    const imgs = [];
    let pronto = null;
    void carregarTilesDoTema(fabricaDeImagem(imgs), 'campo').then((v) => { pronto = v; });
    imgs[0].onload(); await Promise.resolve(); await Promise.resolve();
    expect(pronto).toBe(null); // metade não serve: o worldCanvas precisa do par
    imgs[1].onload(); await Promise.resolve(); await Promise.resolve();
    expect(pronto).toEqual({ fill: imgs[0], surface: imgs[1] });
  });

  it('uma falha → resolve com null, NA HORA (não espera a outra)', async () => {
    const imgs = [];
    let pronto = 'sem resposta';
    void carregarTilesDoTema(fabricaDeImagem(imgs), 'espaco').then((v) => { pronto = v; });
    imgs[1].onerror(); await Promise.resolve(); await Promise.resolve();
    expect(pronto).toBe(null);
  });

  it('a que sobrou, ao chegar DEPOIS da falha, não desfaz o null (flag `fail`)', async () => {
    const imgs = [];
    let pronto = 'sem resposta';
    void carregarTilesDoTema(fabricaDeImagem(imgs), 'espaco').then((v) => { pronto = v; });
    imgs[0].onerror(); imgs[1].onload(); await Promise.resolve(); await Promise.resolve();
    expect(pronto).toBe(null);
  });

  it('NUNCA rejeita — nem quando as duas falham', async () => {
    const imgs = [];
    const p = carregarTilesDoTema(fabricaDeImagem(imgs), 'floresta');
    imgs[0].onerror(); imgs[1].onerror();
    await expect(p).resolves.toBe(null);
  });
});

/* ===================== setCenario: validação e ordem ===================== */

describe('setCenario — validação', () => {
  it('tema conhecido passa inteiro', () => {
    const { api, log } = ambiente();
    api.setCenario('floresta');
    expect(log[0]).toEqual(['setCenarioValue', 'floresta']);
    expect(log[1]).toEqual(['parallax', 'floresta', 'Floresta']);
  });

  it('tema DESCONHECIDO cai para a Cidade — e é a Cidade que é persistida e pintada', () => {
    const { api, log, imgs } = ambiente();
    api.setCenario('praia');
    expect(log[0]).toEqual(['setCenarioValue', 'cidade']);
    expect(log[1]).toEqual(['parallax', 'cidade', 'Cidade']);
    expect(imgs[0].src).toBe('assets/cenarios/cidade/tile_fill.png'); // e não .../praia/...
  });

  it('a chave antiga "noite" NÃO é tema (a migração é do game.js) e cai para a Cidade', () => {
    const { api, log } = ambiente();
    api.setCenario('noite');
    expect(log[0]).toEqual(['setCenarioValue', 'cidade']);
  });
});

describe('setCenario — a ordem dos passos', () => {
  it('persiste ANTES de mexer em textura (é o que arma a guarda de corrida)', () => {
    const { api, log } = ambiente();
    api.setCenario('campo');
    const iValor = log.findIndex((l) => l[0] === 'setCenarioValue');
    const iParallax = log.findIndex((l) => l[0] === 'parallax');
    expect(iValor).toBe(0);
    expect(iParallax).toBeGreaterThan(iValor);
  });

  it('avisa a vida ambiente e o recolor SEM esperar os tiles (eles são síncronos)', () => {
    const { api, log } = ambiente({ vidaReady: true, vizReady: true });
    api.setCenario('campo');
    expect(log.map((l) => l[0])).toEqual(['setCenarioValue', 'parallax', 'applyCenarioVida', 'reapplyVizAll']);
  });

  it('BOOT: vida e recolor ainda não prontos → nenhum dos dois é chamado (e nada estoura)', () => {
    const { api, log } = ambiente({ vidaReady: false, vizReady: false });
    expect(() => api.setCenario('campo')).not.toThrow();
    expect(log.map((l) => l[0])).toEqual(['setCenarioValue', 'parallax']);
  });

  it('vida pronta e recolor não: só a vida é avisada', () => {
    const { api, log } = ambiente({ vidaReady: true, vizReady: false });
    api.setCenario('campo');
    expect(log.map((l) => l[0])).toContain('applyCenarioVida');
    expect(log.map((l) => l[0])).not.toContain('reapplyVizAll');
  });
});

/* ===================== setCenario: a textura do mundo (assíncrona) ===================== */

describe('setCenario — os tiles do tema', () => {
  it('com tiles: refaz a canvas do mundo, grava a dupla canvas/textura e invalida o cache', async () => {
    const { api, log, imgs, estado } = ambiente();
    api.setCenario('campo');
    await carregou(imgs);
    expect(log).toContainEqual(['worldCanvas', 'tiles']);
    expect(estado.world).toEqual(['CANVAS', 'TEX(CANVAS)']);
    expect(log.map((l) => l[0])).toContain('clearWorldTexCache');
  });

  it('sem tiles (PNG ausente): worldCanvas recebe null e o mundo cai no desenho da v3', async () => {
    const { api, log, imgs } = ambiente();
    api.setCenario('campo');
    await falhou(imgs);
    expect(log).toContainEqual(['worldCanvas', null]);
  });

  it('grava a textura ANTES de invalidar o cache (o cache tem de ver o valor novo)', async () => {
    const { api, log, imgs } = ambiente();
    api.setCenario('campo');
    await carregou(imgs);
    expect(log.findIndex((l) => l[0] === 'setWorldTextures')).toBeLessThan(log.findIndex((l) => l[0] === 'clearWorldTexCache'));
  });

  it('BOOT (vizReady falso): pinta o worldSprite DIRETO e não chama o recolor', async () => {
    const { api, log, imgs, worldSprite } = ambiente({ vizReady: false });
    api.setCenario('campo');
    await carregou(imgs);
    expect(worldSprite.texture).toBe('TEX(CANVAS)');
    expect(log.map((l) => l[0])).not.toContain('reapplyVizAll');
  });

  it('pós-boot (vizReady): reaplica o recolor e NÃO carimba o sprite por fora', async () => {
    const { api, log, imgs, worldSprite } = ambiente({ vizReady: true });
    api.setCenario('campo');
    await carregou(imgs);
    expect(log.filter((l) => l[0] === 'reapplyVizAll')).toHaveLength(2); // o síncrono + o dos tiles
    expect(worldSprite.texture).toBe('TEX-VELHA'); // quem pinta é o recolor
  });

  it('BOOT extremo: worldSprite ainda não existe → nada estoura', async () => {
    const { api, imgs } = ambiente({ vizReady: false, semWorldSprite: true });
    api.setCenario('campo');
    await expect(carregou(imgs)).resolves.toBeUndefined();
  });

  it('GUARDA DE CORRIDA: tiles atrasados do tema ANTERIOR não repintam o mundo', async () => {
    const { api, log, imgs, estado } = ambiente({ vizReady: true });
    api.setCenario('campo');          // pediu os tiles do Campo (imgs 0 e 1)
    api.setCenario('floresta');       // a pessoa trocou: cenario = 'floresta' (imgs 2 e 3)
    const marca = log.length;
    await carregou(imgs, 0);          // e SÓ AGORA os do Campo chegam
    expect(log.slice(marca)).toEqual([]); // descartados por inteiro
    expect(estado.world).toBe(null);
    await carregou(imgs, 2);          // os da Floresta chegam
    expect(estado.world).toEqual(['CANVAS', 'TEX(CANVAS)']);
  });

  it('a guarda vale para o caminho de FALHA também', async () => {
    const { api, log, imgs } = ambiente({ vizReady: true });
    api.setCenario('campo');
    api.setCenario('floresta');
    const marca = log.length;
    await falhou(imgs, 0);
    expect(log.slice(marca)).toEqual([]);
  });

  it('mesmo tema duas vezes: a segunda chegada não é descartada (o tema não mudou)', async () => {
    const { api, imgs, estado } = ambiente({ vizReady: false });
    api.setCenario('campo');
    api.setCenario('campo');
    await carregou(imgs, 2);
    expect(estado.world).toEqual(['CANVAS', 'TEX(CANVAS)']);
  });
});
