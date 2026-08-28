// SPDX-License-Identifier: AGPL-3.0-or-later
// A ARTE DA RECICLAGEM — quatro objetos, quatro lixeiras e a placa, todos procedurais.
//
// O QUE ESTE ARQUIVO PEGA: isto é ARTE. Retângulo 1px fora do lugar, duas cores trocadas, um pintor que esquece
// o `fillStyle` — nenhum tipo reclama, nenhum teste de comportamento fica vermelho, e o defeito só aparece na
// tela de alguém. Mesma técnica de `city-tex.node.test.js`: `document` falsificado, contexto 2D que REGISTRA as
// chamadas, e `pixi.js` mockado para dar para ir da textura de volta ao bitmap.
//
// ⚠️ E O CASO QUE MAIS IMPORTA NÃO É DE PIXEL: é o que amarra a cor da lixeira à decisão de acerto. `game/recycling`
// diz que metal vai na AMARELA; `render/recycling-tex` pinta a amarela. Se as duas listas divergirem, o jogo
// aceita a lata numa lixeira e desenha outra — e a criança aprende a cor errada, que ela leva para a rua.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('pixi.js', () => ({
  SCALE_MODES: { NEAREST: 'NEAREST' },
  Texture: { from: (cv) => ({ cv, baseTexture: { scaleMode: null } }) },
}));

const {
  LIXO_ART, COR_DA_LIXEIRA, LIXEIRA_W, LIXEIRA_H, PLACA_W, PLACA_H,
  paintLatinha, paintGarrafaPet, paintPoteDeVidro, paintCaixaDePapelao, paintLixeira, paintPlaca,
  createRecyclingTextures,
} = await import('../app/js/render/recycling-tex.js');
// O teste importa OS DOIS LADOS — é ele o lugar onde arte e regra se encontram, justamente para que o produto
// não precise que se encontrem. Ver o cabeçalho de `render/recycling-tex`.
const { MATERIAIS, LIXEIRAS, LIXEIRA_DE } = await import('../app/js/game/recycling.js');

/* ===================== fakes ===================== */
let criados = [];
let docAntes;

function fakeCanvas() {
  const ops = [];
  return {
    width: 0, height: 0, ops,
    getContext(kind) {
      if (kind !== '2d') return null;
      let style = null;
      return {
        set fillStyle(v) { style = v; ops.push(['fillStyle', v]); },
        get fillStyle() { return style; },
        fillRect(x, y, w, h) { ops.push(['fillRect', x, y, w, h, style]); },
        clearRect() {}, drawImage() {}, getImageData: () => ({ data: [] }),
        set imageSmoothingEnabled(_v) {},
      };
    },
  };
}

beforeEach(() => {
  criados = [];
  docAntes = globalThis.document;
  globalThis.document = { createElement: (t) => { if (t !== 'canvas') throw new Error(t); const cv = fakeCanvas(); criados.push(cv); return cv; } };
});
afterEach(() => { globalThis.document = docAntes; });

/** Só os retângulos, com a cor vigente — é o desenho, sem o ruído das trocas de `fillStyle`. */
const retangulos = (cv) => cv.ops.filter((o) => o[0] === 'fillRect').map((o) => o.slice(1));
/** Pinta um pintor num canvas de mentira e devolve os retângulos. */
function desenhar(paint) {
  const cv = fakeCanvas();
  const c = cv.getContext('2d');
  paint((x, y, w, h, col) => { c.fillStyle = col; c.fillRect(x, y, w, h); });
  return retangulos(cv);
}

describe('render/recycling-tex · a arte existe, tem tamanho e não esquece a cor', () => {
  it('[Interface] há um objeto para cada material, e só para eles', () => {
    expect([...Object.keys(LIXO_ART)].sort()).toEqual([...MATERIAIS].sort());
  });

  it('[Interface] há uma lixeira para cada cor, e só para elas', () => {
    expect([...Object.keys(COR_DA_LIXEIRA)].sort()).toEqual([...LIXEIRAS].sort());
  });

  it('[Right] AS CORES BATEM COM A DECISÃO DE ACERTO — o caso que mais importa', () => {
    // Se `game/recycling` diz que metal vai na amarela, tem de existir uma lixeira amarela pintada. Divergir
    // aqui faz o jogo aceitar a lata numa lixeira e desenhar outra.
    for (const m of MATERIAIS) {
      const cor = LIXEIRA_DE[m];
      expect(COR_DA_LIXEIRA[cor], `sem arte para a lixeira de ${m} (${cor})`).toBeTruthy();
    }
  });

  it('[Right] cada objeto cabe na faixa útil de um mundo 320×180', () => {
    // Grande demais vira obstáculo visual ao lado de uma moeda; pequeno demais some para quem tem baixa visão.
    for (const [m, a] of Object.entries(LIXO_ART)) {
      expect(a.w, `${m} largura`).toBeGreaterThanOrEqual(6);
      expect(a.w, `${m} largura`).toBeLessThanOrEqual(11);
      expect(a.h, `${m} altura`).toBeGreaterThanOrEqual(8);
      expect(a.h, `${m} altura`).toBeLessThanOrEqual(12);
    }
  });

  it('[Right] todo pintor carimba pelo menos um retângulo, e SEMPRE com cor', () => {
    // O `fillStyle: null` é o defeito clássico deste tipo de arte: o retângulo sai preto e ninguém entende.
    const pintores = [paintLatinha, paintGarrafaPet, paintPoteDeVidro, paintCaixaDePapelao, paintPlaca,
      ...LIXEIRAS.map((c) => paintLixeira(c))];
    for (const p of pintores) {
      const rs = desenhar(p);
      expect(rs.length).toBeGreaterThan(0);
      for (const r of rs) expect(r[4], 'retângulo sem cor').toBeTruthy();
    }
  });

  it('[Boundary] nenhum retângulo escapa do canvas do próprio objeto', () => {
    for (const [m, a] of Object.entries(LIXO_ART)) {
      for (const [x, y, w, h] of desenhar(a.paint)) {
        expect(x, `${m} x`).toBeGreaterThanOrEqual(0);
        expect(y, `${m} y`).toBeGreaterThanOrEqual(0);
        expect(x + w, `${m} extrapola a largura`).toBeLessThanOrEqual(a.w);
        expect(y + h, `${m} extrapola a altura`).toBeLessThanOrEqual(a.h);
      }
    }
  });

  it('[Boundary] a lixeira e a placa também ficam dentro do próprio canvas', () => {
    for (const c of LIXEIRAS) {
      for (const [x, y, w, h] of desenhar(paintLixeira(c))) {
        expect(x + w, `lixeira ${c} extrapola`).toBeLessThanOrEqual(LIXEIRA_W);
        expect(y + h, `lixeira ${c} extrapola`).toBeLessThanOrEqual(LIXEIRA_H);
      }
    }
    for (const [x, y, w, h] of desenhar(paintPlaca)) {
      expect(x + w).toBeLessThanOrEqual(PLACA_W);
      expect(y + h).toBeLessThanOrEqual(PLACA_H);
    }
  });

  it('[Right] as quatro lixeiras diferem pela COR DO CORPO, não pelo desenho', () => {
    // É o que faz as quatro serem reconhecíveis como a mesma coisa em quatro cores, que é como elas são na rua.
    const formas = LIXEIRAS.map((c) => JSON.stringify(desenhar(paintLixeira(c)).map((r) => r.slice(0, 4))));
    expect(new Set(formas).size, 'as formas têm de ser idênticas').toBe(1);
    const corpos = LIXEIRAS.map((c) => COR_DA_LIXEIRA[c].corpo);
    expect(new Set(corpos).size, 'e as cores, todas diferentes').toBe(4);
  });

  it('[Zero] o símbolo da lixeira é CLARO, nunca uma quinta cor', () => {
    // Em alto contraste e nos filtros de daltonismo, o que distingue as quatro é a cor do corpo. Um símbolo
    // colorido competiria com ela.
    for (const c of LIXEIRAS) {
      const { corpo, escuro } = COR_DA_LIXEIRA[c];
      const cores = new Set(desenhar(paintLixeira(c)).map((r) => r[4]));
      expect([...cores].filter((x) => x !== corpo && x !== escuro), `lixeira ${c}`).toEqual(['#f2f5f7']);
    }
  });

  it('[Right] A PLACA É GRANDE e carrega o pictograma, não só um risco', () => {
    // A primeira versão tinha 11×16 e resolvia o disco com quatro retângulos: na tela virava um quadradinho
    // vermelho com um risco branco, que a criança lê como "algum objeto" e não como "aqui não".
    expect(PLACA_W, 'larga o bastante para caber uma pessoa desenhada').toBeGreaterThanOrEqual(18);
    expect(PLACA_H, 'e alta o bastante para prancha mais poste').toBeGreaterThanOrEqual(26);
    const rs = desenhar(paintPlaca);
    const pretos = rs.filter((r) => r[4] === '#1a1d24');
    expect(pretos.length, 'moldura + pessoa + lixo caindo').toBeGreaterThanOrEqual(10);
    const disco = rs.filter((r) => r[4] === '#d42a1e');
    expect(new Set(disco.map((r) => r[2])).size, 'o disco é redondo: larguras que variam por linha')
      .toBeGreaterThan(3);
  });

  it('[Right] A BARRA DA PROIBIÇÃO VEM POR ÚLTIMO, por cima do pictograma', () => {
    // A ordem é o sentido do desenho: pessoa jogando lixo + barra = "não jogue lixo". Barra primeiro, a
    // pessoa a cobre e a placa passa a dizer o contrário do que deve.
    const rs = desenhar(paintPlaca);
    const ultimaPessoa = rs.map((r) => r[4]).lastIndexOf('#1a1d24');
    const ultimoVermelho = rs.map((r) => r[4]).lastIndexOf('#d42a1e');
    expect(ultimoVermelho).toBeGreaterThan(ultimaPessoa);
  });

  it('[Interface] `createRecyclingTextures` assa tudo e nada no import', () => {
    const t = createRecyclingTextures();
    expect([...Object.keys(t.lixo)].sort()).toEqual([...MATERIAIS].sort());
    expect([...Object.keys(t.lixeira)].sort()).toEqual([...LIXEIRAS].sort());
    expect(t.placa).toBeTruthy();
    expect(criados.length, 'nove canvases: 4 objetos + 4 lixeiras + a placa').toBe(9);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · tirando a lixeira `amarela` de `COR_DA_LIXEIRA` → "[Right] AS CORES BATEM" reprova, e o efeito real é o
//     jogo aceitar a lata numa lixeira que ninguém desenhou.
//   · pintando o símbolo de uma lixeira com a cor de outra → "[Zero] o símbolo é CLARO" reprova, e o efeito
//     real é o símbolo competir com a cor que identifica a lixeira em alto contraste.
//   · alargando a caixa de papelão para 14px → "[Right] cada objeto cabe na faixa útil" reprova.
//   · deslocando um retângulo da placa para fora do canvas → "[Boundary] a lixeira e a placa também ficam
//     dentro" reprova, e o efeito real é arte cortada na tela.
//   · pintando a barra da proibição ANTES do pictograma → "[Right] A BARRA DA PROIBIÇÃO VEM POR ÚLTIMO"
//     reprova, e o efeito real é a placa dizer o contrário do que deve: uma pessoa jogando lixo, sem o não.
//   · encolhendo a placa de volta para 11×16 → "[Right] A PLACA É GRANDE" reprova.
