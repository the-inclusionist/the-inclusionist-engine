// SPDX-License-Identifier: AGPL-3.0-or-later
// input/devices.ts — rótulos/mapeamentos de gamepad e toque (dados). Módulo-folha, ZERO deps.
// PAD_DESIGNS: como rotular os 4 botões de ação por modelo de controle (o navegador detecta genérico no
// Windows). TOUCH_DEFAULT: mapa padrão dos 13 slots de toque (os 4 de ombro desde o ADR-0160).
// A leitura de pads (pollPads) e o layout de toque ficam no game.js. (Fase 2, subsistema input)
//
// POR QUE CHAVES E NÃO TEXTO: a tabela é uma `const` de módulo, avaliada UMA vez no import. Se guardasse
// `t('…')` já resolvido, o idioma congelaria no boot — `dict` em core/i18n é um `let` que `setLocale`
// reatribui, e quem leu antes da troca nunca mais vê a troca. Guardando a chave, quem resolve é o ponto de
// Este módulo continua ZERO deps de propósito: chave é dado, `t` é comportamento e mora no consumidor.
export const PAD_DESIGNS: Record<string, Record<string, string[]>> = { // por botão: [rótulo, cor]
  generic:{'0':['0','#3a4a6a'],'1':['1','#3a4a6a'],'2':['2','#3a4a6a'],'3':['3','#3a4a6a']},
  microsoft:{'0':['A','#2fae4e'],'1':['B','#d23b3b'],'2':['X','#2f6fd2'],'3':['Y','#d9a400']},
  sony:{'0':['✕','#4f8fd0'],'1':['○','#d23b3b'],'2':['□','#d76fae'],'3':['△','#2fae7e']},
  nintendo:{'0':['B','#d9a400'],'1':['A','#d23b3b'],'2':['Y','#2fae4e'],'3':['X','#2f6fd2']},
};
/**
 * Glifos de controle que NÃO SE LEEM — chave i18n do nome falado de cada um (ADR-0044, item 4).
 *
 * Um leitor de tela lê `✕` como "sinal de multiplicação", ou não lê nada, e `△` costuma sair mudo. É por isso
 * que a legenda da pausa carregava `aria-hidden="true"`: escondiam-se o ruído E a informação juntos. Aqui está
 * a metade que faltava para poder tirar o atributo — o glifo continua na tela para quem o reconhece, e a
 * PALAVRA existe para quem o escuta.
 *
 * Só os quatro do PlayStation entram. `A`, `B`, `X`, `Y` e `0`–`3` já se leem, e traduzi-los para "letra A"
 * seria acrescentar ruído em nome de acessibilidade — o defeito que este item conserta pelo avesso.
 */
export const PAD_GLYPH_SPOKEN: Record<string, string> = {
  '✕': 'pad.glyph.cross', '○': 'pad.glyph.circle', '□': 'pad.glyph.square', '△': 'pad.glyph.triangle',
};
export const TOUCH_DEFAULT: Record<string, string> = { up:'up',down:'down',left:'left',right:'right',start:'start',b0:'action2',b1:'action3',b2:'action1',b3:'action4',
  // Os OMBROS (ADR-0160): L1/L2 no canto superior esquerdo, R1/R2 no direito. Só aparecem se o jogo os nomeia (ADR-0162).
  bl1:'leftShoulder',bl2:'leftTrigger',br1:'rightShoulder',br2:'rightTrigger' };
