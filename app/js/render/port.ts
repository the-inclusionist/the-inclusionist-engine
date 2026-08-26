// SPDX-License-Identifier: AGPL-3.0-or-later
// render/port — A PORTA DO RENDERIZADOR (Fase D do plano, ADR-0035).
//
// ========================= O QUE ESTE ARQUIVO RESOLVE =========================
// O ADR-0035 apostou a reversibilidade da escolha do renderizador num adaptador: os módulos não importam
// PixiJS, recebem por injeção o que vão desenhar. A aposta foi cumprida pela metade — os módulos de fato não
// importam PixiJS, mas cada um descreveu a forma do que recebe POR CONTA PRÓPRIA, e as descrições
// divergiram.
//
// `Gfx` estava escrito CINCO vezes, em `render/scene-city`, `render/scene-sky`, `render/title-scene`,
// `render/weather` e `game/traffic`, com quatro definições diferentes: umas com `clear(): void`, outras com
// `clear(): Gfx`; uma com `visible`, outra com `lineStyle`/`moveTo`/`lineTo`. `Layer` e `SpriteCtor`, duas
// vezes cada. `RendererLike`, `ContainerLike` e `GraphicsLike`, duas cada.
//
// É o mesmo defeito do `DomQuery` (dezesseis cópias) e do `KeyScheme` (seis), agora no renderizador: uma
// verdade escrita em muitos lugares diverge, e a divergência aparece na raiz de composição — que é o único
// ponto onde o PixiJS de verdade encontra todas elas ao mesmo tempo.
//
// ========================= O QUE A PORTA NÃO É =========================
// NÃO é a implementação de `Scene`/`Handle` que a D14 do `demos` especifica. O plano é explícito: "não fazer
// agora a implementação completa de `Scene`; só a porta, e só onde os módulos já estão". Isto aqui descreve
// o que o renderizador ATUAL oferece, numa declaração só, de um jeito que o PixiJS satisfaz sem adaptador.
// A `Scene` nasce depois, e nasce podendo reusar estes nomes.
//
// ========================= POR QUE OS RETORNOS ENCADEIAM =========================
// `beginFill(…): this` e não `: void`. O PixiJS encadeia (`g.beginFill(c).drawRect(…).endFill()`), e três
// dos cinco módulos já dependiam disso. `this` em vez do nome do tipo é o que permite uma interface derivada
// continuar encadeando sem redeclarar cada método — foi o que fez as cinco cópias divergirem.

/** O MÍNIMO de uma camada de desenho vetorial: limpar, preencher, retangular. */
export interface Desenho {
  clear(): this;
  beginFill(color: number, alpha?: number): this;
  drawRect(x: number, y: number, w: number, h: number): this;
  endFill(): this;
}

/** Desenho que também traça linha — chuva, cabos, tracinhos de lava. */
export interface DesenhoComLinha extends Desenho {
  lineStyle(width: number, color?: number, alpha?: number): this;
  moveTo(x: number, y: number): this;
  lineTo(x: number, y: number): this;
}

/** O que se pode esconder. Separado de `Desenho` porque nem toda camada é escondida por quem a desenha. */
export interface Visivel {
  visible: boolean;
}

/** Um contêiner do grafo de cena, do ponto de vista de quem só adiciona e remove filhos. */
export interface Camada {
  addChild(c: unknown): unknown;
  removeChild(c: unknown): unknown;
}

/** O que tem textura trocável — o recolor do alto contraste escreve aqui. */
export interface ComTextura {
  texture: unknown;
}

/**
 * DESENHAR UM OBJETO DENTRO DE UMA TEXTURA — a captura de tela de cada jogador no multi-tela.
 *
 * É uma FUNÇÃO e não um objeto `{ render(...) }`, e a diferença é o que faz a porta funcionar. Dois módulos
 * declaravam `interface RendererLike { render(displayObject: unknown, options: { renderTexture: unknown }) }`
 * — idênticos, e ambos recusados pelo PixiJS real: o `render` dele pede `IRenderableObject`, e `unknown` não
 * é atribuível a isso. Por contravariância, quem DECLARA o parâmetro mais largo é quem não cabe.
 *
 * Pedir a CAPACIDADE resolve: o módulo diz o que quer que aconteça, e a raiz de composição — que é o único
 * lugar onde o PixiJS já é conhecido — entrega a função. É o adaptador que o ADR-0035 prometeu, e a promessa
 * só vira fato quando o pedido tem a forma de um verbo, não a de um objeto emprestado.
 */
export type RenderizarEm = (objeto: unknown, alvo: unknown, limpar?: boolean) => void;

/**
 * CRIAR UM SPRITE a partir de uma textura, e um AZULEJO a partir dela.
 *
 * Fábricas, não construtores — e pelo mesmo motivo do `RenderizarEm` acima. Três módulos pediam
 * `interface SpriteCtor { new (tex: unknown): Sprite }`, e o `PIXI.Sprite` real não cabe: o construtor dele
 * aceita `Texture | undefined`, e um parâmetro declarado `unknown` é MAIS LARGO — por contravariância, quem
 * promete aceitar qualquer coisa é quem não pode receber um construtor que só aceita textura.
 *
 * Uma função apaga o problema: quem chama passa a textura que já tem, e quem compõe fecha a diferença uma
 * vez. `T` é o que o módulo espera de volta — cada um sabe qual fatia do sprite ele vai tocar.
 */
export type CriarSprite<T> = (textura: unknown) => T;

/** Idem para o azulejo do parallax, que também recebe largura e altura. */
export type CriarAzulejo<T> = (textura: unknown, largura: number, altura: number) => T;

/** E o desenho vetorial vazio (`new PIXI.Graphics()`), pela mesma razão. */
export type CriarDesenho<T> = () => T;
