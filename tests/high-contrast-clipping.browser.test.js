// SPDX-License-Identifier: AGPL-3.0-or-later
// O "KAGE BUNSHIN": o alto contraste contornava o ATLAS INTEIRO — item 22 quebrou uma suposição do item de HC.
//
// ========================= O DEFEITO, E COMO ELE FOI ACHADO =========================
// O Dev relatou várias cópias do personagem, em poses diferentes, numa grade regular. Eu descartei cinco
// causas medindo (sprite órfão, retângulos do atlas, acúmulo de textura de render, a barra de acessibilidade,
// fundo repetido no DOM) e não reproduzia nenhuma — porque em todas elas eu media uma tela SADIA. Foi ele
// quem fechou o cerco: "modo alto contraste liga o kage bushin".
//
// A causa está em `directSpriteTexture`, o contorno escuro que faz o personagem saltar no alto contraste:
//
//     const s = srcTex.baseTexture.resource.source;   // ← a IMAGEM INTEIRA
//     const o = outlineCanvas(s, th);                 // ← contorna tudo o que houver nela
//
// Ela lê a BASE e ignora o `frame` — o recorte. E havia um comentário logo ali dizendo por que isso era
// seguro: "directSpriteTexture só é chamada p/ texturas de player (sempre canvas-sourced, nunca PNG)".
//
// A afirmação era VERDADEIRA e virou FALSA. O item 22 empacotou os sprites num ATLAS de 256×207, e desde
// então só os quadros que passam pelo tapa-costuras (idle, andar, correr) viram tela própria de 26×35. Pulo,
// escada, parede, teto, nado e voo continuam sendo um RECORTE dentro do atlas — e contornar a base deles
// desenha o atlas inteiro: todos os quadros do personagem, em grade, de uma vez.
//
// O tapa-costuras é ASSÍNCRONO, e é por isso que o idle também aparecia: com o alto contraste ligado cedo, o
// cache `_playerDirect` memoriza a versão baseada no atlas e a guarda para sempre.
//
// ⚠️ ISTO JÁ ESTAVA PREVISTO POR ESCRITO, no `aplicarInpaint` de render/sprites, sobre o mesmo perigo:
// "Desenhar o atlas inteiro aqui não estouraria — produziria um sprite com o personagem inteiro dentro, o que
// é exatamente o tipo de defeito que passa por build e por teste e só aparece na tela." O aviso estava certo
// e no arquivo vizinho; faltava o gate.
//
// MUTAÇÕES CONFERIDAS (no fim do arquivo).
import { describe, it, expect } from 'vitest';
import { initHighContrast, directSpriteTexture } from '../app/js/render/high-contrast.js';

/** Uma "folha" com 4 quadros de 10×10 lado a lado — o atlas em miniatura. */
function folhaDeQuadros() {
  const cv = document.createElement('canvas');
  cv.width = 40; cv.height = 10;
  const c = cv.getContext('2d');
  for (let i = 0; i < 4; i++) { c.fillStyle = ['#f00', '#0f0', '#00f', '#ff0'][i]; c.fillRect(i * 10, 0, 10, 10); }
  return cv;
}

/** A superfície mínima de `PIXI.Texture` que `directSpriteTexture` toca, com um RECORTE dentro da folha. */
function texturaComRecorte(fonte, recorte) {
  return {
    orig: { width: recorte.width, height: recorte.height },
    frame: recorte,
    baseTexture: { valid: true, resource: { source: fonte }, once: () => {} },
  };
}

/** O `initHighContrast` pede um punhado de leituras do jogo; aqui só o contorno importa. */
function ligarHC(espessura) {
  initHighContrast({
    outlineFg: () => espessura,
    outlineBg: () => 0,
    getWorldCanvasNormal: () => document.createElement('canvas'),
    getWorldTexNormal: () => null,
    roleOf: () => 'chao',
  });
}

describe('alto contraste · o contorno respeita o RECORTE do quadro', () => {
  it('[Right] um quadro DENTRO de uma folha vira um sprite do tamanho do QUADRO', () => {
    // O caso do defeito, escrito pelo avesso: recorte de 10×10 dentro de uma folha de 40×10. Sem respeitar o
    // recorte, o resultado tem 40 de largura — os quatro quadros de uma vez, que é o kage bunshin.
    ligarHC(1);
    const t = directSpriteTexture(texturaComRecorte(folhaDeQuadros(), { x: 20, y: 0, width: 10, height: 10 }), 'hc-direto');
    const cv = t.baseTexture.resource.source;
    expect(cv.width, 'o contorno pegou a folha inteira — é o "kage bunshin"').toBeLessThan(20);
    expect(cv.height).toBeLessThan(20);
  });

  it('[Right] e é o quadro CERTO: o recorte pedido, não o primeiro da folha', () => {
    // Respeitar o TAMANHO e pegar o quadro errado seria trocar um defeito visível por um invisível: o
    // personagem saltaria no alto contraste exibindo a pose de outra animação — e ninguém ligaria uma coisa
    // à outra.
    //
    // A primeira versão deste caso usava espessura 0, que é um atalho e nem chega a recortar: ele passava com
    // a mutação "recorta sempre em 0,0" aplicada. Ler o PIXEL é o que o faz morder.
    ligarHC(1);
    const t = directSpriteTexture(texturaComRecorte(folhaDeQuadros(), { x: 20, y: 0, width: 10, height: 10 }), 'hc-direto');
    const cv = t.baseTexture.resource.source;
    const c = cv.getContext('2d');
    const meio = c.getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data;
    // O terceiro quadro da folha é AZUL (#00f). O primeiro é vermelho — é o que a mutação traria.
    expect([meio[0], meio[1], meio[2]], 'o recorte pegou o quadro errado da folha').toEqual([0, 0, 255]);
  });

  it('[Boundary] textura SEM recorte (a folha inteira é o quadro) continua funcionando', () => {
    // É o caso dos quadros que passam pelo tapa-costuras: cada um vira uma tela própria, e ali o recorte É a
    // base inteira. O conserto não pode quebrar o caminho que já estava certo.
    ligarHC(1);
    const fonte = folhaDeQuadros();
    const t = directSpriteTexture(texturaComRecorte(fonte, { x: 0, y: 0, width: 40, height: 10 }), 'hc-direto');
    const cv = t.baseTexture.resource.source;
    expect(cv.width).toBeGreaterThanOrEqual(40);
  });

  it('[Zero] espessura 0 devolve a origem — sem canvas novo, sem cópia', () => {
    ligarHC(0);
    const orig = texturaComRecorte(folhaDeQuadros(), { x: 0, y: 0, width: 10, height: 10 });
    expect(directSpriteTexture(orig, 'hc-direto')).toBe(orig);
  });
});

// ========================= MUTAÇÕES CONFERIDAS =========================
//   · devolvendo `outlineCanvas(s, th)` sobre a base (o código de antes) → "[Right] um quadro DENTRO de uma
//     folha" reprova com largura 42, que é a folha inteira contornada.
//   · recortando sempre em 0,0 → "[Right] e é o quadro CERTO" reprova.
