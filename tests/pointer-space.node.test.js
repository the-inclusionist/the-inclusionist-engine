// SPDX-License-Identifier: AGPL-3.0-or-later
// O ÚNICO LUGAR QUE CONVERTE UM PONTO DE TELA (issue #105, primeiro item da `definition of done`).
//
// ⚠️ A MEDIÇÃO QUE ORIGINOU ISTO. A issue manda LER antes de escrever, e o que a leitura encontrou não foi
// «quase tudo» nem «quase nada»:
//
//   · a CAPTURA já existe inteira em `touch-bindings.wirePointerPad` — `pointerdown`/`move`/`up`/`cancel`,
//     `setPointerCapture` com recuo, `lostpointercapture` como rede, `contextmenu` suprimido, um ponteiro de
//     cada vez. Nada a reescrever.
//   · o PONTO é recebido e DEITADO FORA, em quatro sítios e com duas convenções: três funções de direcional
//     reduziam-no a `dx,dy` do centro, e `ui/webcam.onGaze` a uma fração e três limiares.
//
// Enquanto a conta vivia dentro de cada uma delas, um consumidor NOVO — um ponteiro, um olhar que quisesse
// desenhar — não tinha como obter o ponto sem passar por uma função que já o tinha transformado em direções.
import { describe, it, expect } from 'vitest';
import { fromCentre, asFraction } from '../app/js/input/pointer-space.js';
import { crossDirsAt, stickDirsAt, stickKnobOffset } from '../app/js/input/touch-bindings.js';

const R = { left: 100, top: 200, width: 80, height: 40 }; // centro em (140, 220)

describe('doCentro — o ponto relativo ao CENTRO, que é o que um direcional lê', () => {
  it('[Right] o centro do elemento é a origem', () => {
    expect(fromCentre(140, 220, R)).toEqual({ dx: 0, dy: 0 });
  });

  it('[Right] os sinais seguem a tela: x cresce para a direita, y para BAIXO', () => {
    expect(fromCentre(180, 200, R)).toEqual({ dx: 40, dy: -20 });
    expect(fromCentre(100, 240, R)).toEqual({ dx: -40, dy: 20 });
  });

  it('[Boundary] fora do elemento continua a valer — é o que a captura de ponteiro existe para permitir', () => {
    // Um dedo (ou um rato) que sai do elemento com o gesto ainda a decorrer produz pontos de fora. Saturar
    // aqui apagaria a diferença entre «na borda» e «muito para lá dela», que é o que um arrasto precisa.
    expect(fromCentre(1000, 220, R).dx).toBe(860);
  });
});

describe('emFracao — o ponto como fração do elemento, que é o que o olhar lê', () => {
  it('[Right] canto superior esquerdo é 0,0; inferior direito é 1,1; centro é 0,5', () => {
    expect(asFraction(100, 200, R)).toEqual({ fx: 0, fy: 0 });
    expect(asFraction(180, 240, R)).toEqual({ fx: 1, fy: 1 });
    expect(asFraction(140, 220, R)).toEqual({ fx: 0.5, fy: 0.5 });
  });

  it('[Zero] ⚠️ elemento de largura ZERO devolve zero, e não Infinity', () => {
    // Um elemento ainda não medido (display:none, primeiro quadro) dá `width: 0`. Um `Infinity` ou `NaN` a
    // sair daqui viajaria para dentro da física antes de alguém o ver — e `NaN < 0.4` é `false`, de modo que
    // o defeito apareceria como «o olhar parou de funcionar», sem erro nenhum.
    expect(asFraction(50, 50, { left: 0, top: 0, width: 0, height: 0 })).toEqual({ fx: 0, fy: 0 });
  });

  it('[Boundary] e também não satura — quem quiser saturar, satura; quem saturasse aqui não voltaria atrás', () => {
    // ⚠️ OS DOIS EIXOS, e a primeira versão só afirmava `fx`. Uma mutação que saturasse `fy` passava verde —
    // e a propriedade é da FUNÇÃO, não de um eixo dela. É a mesma armadilha de sempre: a asserção tem de
    // estar do lado onde a mudança se veria.
    expect(asFraction(20, 200, R)).toEqual({ fx: -1, fy: 0 });
    expect(asFraction(260, 320, R)).toEqual({ fx: 2, fy: 3 });
  });
});

describe('e os três consumidores de toque continuam a responder o mesmo', () => {
  // ⚠️ Estes casos são a REDE da extração: as três funções tinham a conta escrita por dentro, e o que uma
  // extração pode partir em silêncio é justamente um sinal trocado. Valores calculados à mão a partir de `R`.
  it('[Right] a cruz decide pelos mesmos limiares de antes', () => {
    expect(crossDirsAt(140, 220, R)).toEqual({ left: false, right: false, up: false, down: false }); // centro
    expect(crossDirsAt(179, 220, R).right).toBe(true);
    expect(crossDirsAt(101, 220, R).left).toBe(true);
    expect(crossDirsAt(140, 201, R).up).toBe(true);   // y menor = para CIMA
    expect(crossDirsAt(140, 239, R).down).toBe(true);
  });

  it('[Right] o analógico usa a zona morta em px que lhe passam', () => {
    expect(stickDirsAt(150, 220, R, 5).right).toBe(true);
    expect(stickDirsAt(143, 220, R, 5).right).toBe(false); // dx=3, isInside da zona morta de 5
  });

  it('[Right] a manopla recorta pelo RAIO e mantém o ângulo', () => {
    // Recorte radial e não por eixo: a 3-4-5, com curso 5, tem de sair exatamente no ponto pedido.
    expect(stickKnobOffset(143, 224, R, 5)).toEqual({ x: 3, y: 4 });
    // e ao dobro da distância, o mesmo ângulo com o comprimento cortado no curso
    expect(stickKnobOffset(146, 228, R, 5)).toEqual({ x: 3, y: 4 });
  });
});
