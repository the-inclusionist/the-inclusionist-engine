// SPDX-License-Identifier: AGPL-3.0-or-later
// game/recycling-scene — A RECICLAGEM LIGADA AO MUNDO: onde os sprites nascem, quem segue quem, e quando o
// ponto de comportamento sai.
//
// É a quarta e última peça, e a única que toca o grafo de cena. As três de baixo continuam sem saber que
// existe tela:
//   · `game/recycling`       — QUAL lixeira é a certa (a regra)
//   · `game/recycling-spawn` — ONDE tudo nasce (a geografia)
//   · `game/recycling-world` — O QUE ACONTECE ao encostar, carregar e depositar (o estado)
//   · este                   — quem desenha o quê, e por onde o ponto sai do jogo
//
// ⚠️ FÁBRICA, E NÃO `initX(ctx)` COM `let` DE MÓDULO (ADR-0038). Tudo aqui é estado de RODADA — os itens
// morrem com a volta, e a volta recomeça a cada dez moedas (ADR-0049 §7). Um `let` de módulo seria
// compartilhado por qualquer segundo jogo carregado na MESMA página, que é a D13 do `demos`; a instância é
// da raiz de composição, que a possui e a joga fora.
//
// ⚠️ E O PONTO NÃO É CONTADO AQUI. `aoPontuar` é um aviso para fora: quem conta é o dono do contador, porque
// o ponto de comportamento e o ponto de resposta acadêmica são o MESMO ponto (ADR-0049 §1) e não podem ser
// somados em dois lugares. Se este módulo somasse, a lata na lixeira teria um contador e a pergunta teria
// outro — e a criança veria dois números para a mesma coisa.
//
// SEM PIXI AQUI: contêiner e fábrica de sprite entram injetados, como em `game/coin-spawning`. É o que deixa
// o módulo inteiro exercitável no project `node`, com sprites de mentira.

import type { CamadaEsvaziavel, CriarSprite, Visivel } from '../render/port.js';
import type { Material, Lixeira } from './recycling.js';
import { LIXEIRAS } from './recycling.js';
import {
  candidatosDeLixo, posicaoDaPlaca, posicoesDasLixeiras, type MundoDeLixo,
} from './recycling-spawn.js';
import {
  montarItens, cargaDe, pegarPerto, passarPelaPlaca, depositar, lixeiraSob, entrouNaLixeira,
  type ItemDeLixo, type PostoDeLixeira,
} from './recycling-world.js';

/** A fatia de sprite que esta cena escreve. Mínima de propósito — ver ADR-0039. */
export interface SpriteDeLixo extends Visivel {
  x: number; y: number;
  destroy(): void;
}

/** O jogador, do ponto de vista da reciclagem: onde ele está e quem ele é. */
export interface JogadorNaReciclagem { i: number; x: number; y: number }

export interface RecyclingSceneCtx {
  /** A camada onde lixo, lixeiras e placa entram. */
  camada: CamadaEsvaziavel;
  /** Fábrica de sprite (= `new PIXI.Sprite(tex)` na raiz). */
  criarSprite: CriarSprite<SpriteDeLixo>;
  /** As texturas assadas por `render/recycling-tex.createRecyclingTextures()`. */
  texturaDoLixo: (m: Material) => unknown;
  texturaDaLixeira: (c: Lixeira) => unknown;
  texturaDaPlaca: unknown;
  /** A consulta de tiles do mapa atual. */
  mundo: MundoDeLixo;
  /** Quantos itens de lixo nascem por volta. */
  quantosItens: number;
  /** Escolhe QUAIS lugares candidatos recebem item — é por onde a raiz injeta o embaralhamento. */
  escolherLugares: (total: number, n: number) => number[];
  /** Tamanho da lixeira desenhada (de `render/recycling-tex`), para posicionar e para testar a colisão. */
  lixeiraW: number; lixeiraH: number;
  /** A que distância a criança pega o item do chão. */
  alcance: number;
  /** UM PONTO DE COMPORTAMENTO saiu. Quem conta é de fora — ver o cabeçalho. */
  aoPontuar: (jogador: number, material: Material) => void;
  /**
   * O que anunciar, para legenda e leitor de tela: a CHAVE i18n e os identificadores que entram nela.
   *
   * ⚠️ IDENTIFICADOR E NÃO TEXTO. `material` e `cor` saem daqui como `'metal'` e `'amarela'`, e quem traduz é
   * a raiz de composição (`t('lixo.obj.metal')`). É a regra da casa — a moldura mora na chave, o conteúdo
   * atravessa por `{param}` — e é o que impede este módulo de ganhar uma língua: o piso do projeto são três
   * idiomas, e um nome em pt-BR cravado aqui quebraria o pilar 3 sem nenhum teste ficar vermelho.
   */
  anunciar: (chave: string, jogador: number, sobre: { material: Material; cor?: Lixeira }) => void;
}

export interface RecyclingApi {
  /** (Re)monta a volta: itens novos no chão, lixeiras e placa no lugar. Chamada no boot e a cada reinício. */
  montar(): void;
  /** Um quadro: pegar, carregar, cruzar a placa, depositar. */
  atualizar(jogadores: readonly JogadorNaReciclagem[]): void;
  /** Os itens, para quem precisar ler (testes, depuração, futuro sonar). */
  itens(): readonly ItemDeLixo[];
  /** Onde a placa ficou, ou `null` num cenário sem água. */
  placaX(): number | null;
}

/** Quanto o item carregado flutua ACIMA do jogador. Acima e não junto: colado no corpo ele some atrás do
 *  sprite do personagem, e a criança perde de vista o que está carregando — que é a informação de que ela
 *  precisa para escolher a lixeira. */
const ALTURA_NA_MAO = 14;

export function createRecycling(ctx: RecyclingSceneCtx): RecyclingApi {
  let itens: ItemDeLixo[] = [];
  let spritesDeLixo: SpriteDeLixo[] = [];
  let lixeiras: PostoDeLixeira[] = [];
  let placa: number | null = null;
  /** A lixeira em que cada jogador estava no quadro passado. Sem isto o descarte dispara em rajada. */
  let ultimaLixeira: number[] = [];

  function limpar(): void {
    for (const d of ctx.camada.removeChildren()) d.destroy();
    spritesDeLixo = [];
  }

  function montar(): void {
    limpar();

    // As lixeiras e a placa primeiro: são cenário, e entram embaixo do lixo no grafo de cena.
    lixeiras = posicoesDasLixeiras(ctx.mundo, ctx.lixeiraW, ctx.lixeiraH)
      .map((p, i) => ({ x: p.x, y: p.y, cor: LIXEIRAS[i]! }));
    for (const l of lixeiras) {
      const s = ctx.criarSprite(ctx.texturaDaLixeira(l.cor));
      s.x = l.x; s.y = l.y; s.visible = true;
      ctx.camada.addChild(s);
    }

    const p = posicaoDaPlaca(ctx.mundo);
    placa = p === null ? null : p.x;
    if (p !== null) {
      const s = ctx.criarSprite(ctx.texturaDaPlaca);
      s.x = p.x; s.y = p.y - ctx.lixeiraH; s.visible = true;   // o poste apoia NO chão, então sobe uma altura
      ctx.camada.addChild(s);
    }

    itens = montarItens(candidatosDeLixo(ctx.mundo), ctx.quantosItens, ctx.escolherLugares);
    spritesDeLixo = itens.map((it) => {
      const s = ctx.criarSprite(ctx.texturaDoLixo(it.material));
      s.x = it.x; s.y = it.y; s.visible = true;
      ctx.camada.addChild(s);
      return s;
    });
    ultimaLixeira = [];
  }

  function atualizar(jogadores: readonly JogadorNaReciclagem[]): void {
    for (const j of jogadores) {
      const carga = cargaDe(itens, j.i);

      if (!carga) {
        // Mãos livres: pega o que estiver ao alcance. `pegarPerto` já recusa item de outro e já descartado.
        const pego = pegarPerto(itens, j.i, j.x, j.y, ctx.alcance);
        if (pego) ctx.anunciar('sr.lixo.pegou', j.i, { material: pego.material });
      } else {
        // Carregando: a placa é a única coisa que tira o item da mão sem ser a lixeira.
        const naPlaca = passarPelaPlaca(itens, j.i, j.x, j.y, placa);
        if (naPlaca.fala) ctx.anunciar(naPlaca.fala, j.i, { material: carga.material });
      }

      // O descarte dispara na ENTRADA da lixeira. Sem esta guarda, quem parasse em cima da lixeira errada
      // ouviria a recusa a cada quadro — e para quem usa leitor de tela isso tranca o jogo.
      const sob = lixeiraSob(j.x, j.y, lixeiras, ctx.lixeiraW, ctx.lixeiraH);
      if (entrouNaLixeira(ultimaLixeira[j.i] ?? -1, sob) && cargaDe(itens, j.i)) {
        const material = cargaDe(itens, j.i)!.material;
        const cor = lixeiras[sob]!.cor;
        const acao = depositar(itens, j.i, cor);
        if (acao.fala) ctx.anunciar(acao.fala, j.i, { material, cor });
        if (acao.pontos > 0) ctx.aoPontuar(j.i, material);
      }
      ultimaLixeira[j.i] = sob;
    }

    // Os sprites seguem o estado, e não o contrário: o item na mão flutua sobre o dono, o descartado some.
    itens.forEach((it, k) => {
      const s = spritesDeLixo[k];
      if (!s) return;
      if (it.descartado) { s.visible = false; return; }
      const dono = it.dono === null ? null : jogadores.find((j) => j.i === it.dono);
      s.visible = true;
      s.x = dono ? dono.x : it.x;
      s.y = dono ? dono.y - ALTURA_NA_MAO : it.y;
    });
  }

  return { montar, atualizar, itens: () => itens, placaX: () => placa };
}
