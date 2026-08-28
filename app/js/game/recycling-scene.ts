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
import type { Ponto } from './recycling-spawn.js';
import type { Material, Lixeira } from './recycling.js';
import { LIXEIRAS } from './recycling.js';
import {
  candidatosDeLixo, faixaDaPlaca, posicaoDaPlaca, posicoesDasLixeiras,
  type MundoDeLixo, type PlacaDeclarada,
} from './recycling-spawn.js';
import type { BarreiraDaPlaca } from './recycling.js';
import {
  montarItens, cargaDe, pegarPerto, depositar, lixeiraSob, entrouNaLixeira,
  type ItemDeLixo, type PostoDeLixeira,
} from './recycling-world.js';
import type { AcaoDeCarga } from './carry.js';

/** A fatia de sprite que esta cena escreve. Mínima de propósito — ver ADR-0039. */
export interface SpriteDeLixo extends Visivel {
  x: number; y: number;
  destroy(): void;
}

/**
 * O jogador, do ponto de vista da reciclagem: onde ele está, quem ele é, o que ele MANDOU fazer e para onde.
 *
 * ⚠️ A AÇÃO VEM DE FORA, e isso é decisão e não repasse de responsabilidade. Quem decide qual botão faz o quê
 * é `game/carry.acaoDeCarga`, que já existia com o contrato do Dev inteiro (ADR-0045) e valia para qualquer
 * objeto carregável — não só lixo. Duplicar o roteamento aqui faria a lata obedecer a um botão e a próxima
 * coisa carregável a outro.
 */
export interface JogadorNaReciclagem {
  i: number; x: number; y: number;
  /** Para que lado ele olha: -1 esquerda, +1 direita. O objeto carregado fica levemente à FRENTE. */
  olhandoPara: -1 | 1;
  /** O que este quadro pediu: `game/carry.AcaoDeCarga`. */
  acao: AcaoDeCarga;
  /** Para onde arremessar: -1 esquerda, +1 direita. */
  direcao: -1 | 0 | 1;
}

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
  /**
   * OS LUGARES EM QUE O JOGO JÁ SABE QUE NASCE COISA, na linha do pé — "feito moedas, mas na altura do chão".
   *
   * ⚠️ ENTRA POR PARÂMETRO, e isso é a decisão. A primeira versão varria o mapa aqui e reescrevia, pior, a
   * pergunta que `game/coins.findCoinCandidates` já responde: ela exige o par ar-iluminado/água, e não
   * "não sólido", justamente para não pôr coisa na escada nem na REGIÃO SECRETA. A minha punha — e o Dev viu
   * a caixa nascer lá dentro. Reusar a resposta em vez de reescrever a pergunta é o conserto.
   */
  candidatos: () => readonly Ponto[];
  /** ONDE A PLACA DESTA FASE FICA, em tiles — design de fase, não dedução. `null` = fase sem placa, e aí o
   *  lixo dela não é barrado em lugar nenhum. Ver `game/recycling-spawn.posicaoDaPlaca`. */
  placaEm: PlacaDeclarada | null;
  /** Quantos itens de lixo nascem por volta. */
  quantosItens: number;
  /** Escolhe QUAIS lugares candidatos recebem item — é por onde a raiz injeta o embaralhamento. */
  escolherLugares: (total: number, n: number) => number[];
  /** Tamanho da lixeira desenhada (de `render/recycling-tex`), para posicionar e para testar a colisão. */
  lixeiraW: number; lixeiraH: number;
  /** A altura DESENHADA de cada objeto de lixo. O estado guarda a linha do PÉ (como o jogador), e é aqui que
   *  ela vira posição de sprite — sem isto a latinha de 9px boiava sete pixels no ar, porque o tile tem 16. */
  alturaDoLixo: (m: Material) => number;
  /** A largura DESENHADA de cada objeto. Serve para centralizar o objeto carregado no corpo de quem carrega:
   *  o `x` do jogador é o CENTRO dele e o do sprite é a BORDA ESQUERDA. */
  larguraDoLixo: (m: Material) => number;
  /** A altura do jogador, do pé ao alto da cabeça (o `BOX.h` do jogo). Decide onde fica a barriga. */
  alturaDoJogador: number;
  /** Altura da placa desenhada. Separada da lixeira porque são desenhos diferentes — desenhar a placa com a
   *  altura da lixeira a enterra ou a faz flutuar, e o defeito só aparece na tela de alguém. */
  placaH: number;
  /**
   * A que distância a criança pega o item do chão.
   *
   * ⚠️ UM TILE NÃO BASTA, e foi assim que nasceu. Medido no navegador: parada exatamente a 16px do item — que
   * é ela em PÉ NO TILE DO LADO, a distância mais natural do mundo — o botão não fazia nada, e sem nenhum
   * aviso. Do lado de quem joga isso é "o botão não funciona", que foi como o Dev relatou. O `x` do jogador é
   * o centro dele e o `x` do item é a borda do tile, então "encostado" já são uns 16 a 23 pixels.
   */
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
  /**
   * Há item ao alcance deste jogador?
   *
   * ⚠️ EXISTE PARA NÃO HAVER DOIS ALCANCES. A raiz de composição precisa desta resposta para montar o
   * contexto de `game/carry`, e a versão anterior a recalculava lá com a sua própria conta. Os dois números
   * eram o MESMO tile e mesmo assim divergiam em silêncio no dia em que um mudasse: `acaoDeCarga` diria
   * "pegar" e `pegarPerto` não acharia nada — botão que não faz nada, sem erro em lugar nenhum.
   */
  temItemPerto(jogador: number, x: number, y: number): boolean;
  /** Onde a placa ficou, ou `null` numa fase que não declarou nenhuma. */
  placaX(): number | null;
  /** O VÃO em que a barreira da placa vale — do piso dela até o sólido acima. `null` sem placa. */
  barreira(): BarreiraDaPlaca | null;
  /** Onde as quatro lixeiras ficaram. Para o protocolo de conferência no navegador e para quem for narrar. */
  lixeiras(): readonly PostoDeLixeira[];
}

/* ===================== ONDE O OBJETO CARREGADO APARECE =====================
 *
 * "O objeto que está sendo carregado deve aparecer abaixo da cabeça e levemente à frente, tampando a barriga
 * sem tampar os braços."
 *
 * ⚠️ SEGUNDA VERSÃO. A primeira o punha FLUTUANDO ACIMA da cabeça, e o raciocínio estava certo pela metade:
 * eu queria que a criança não perdesse de vista o que carrega. Só que um objeto boiando sobre a cabeça não é
 * alguém carregando alguma coisa — é um ícone de estado. Na barriga, o desenho DIZ o que está acontecendo, e
 * continua visível, que era o que eu queria desde o começo.
 *
 * As três medidas, sobre um jogador de 30px de altura cujo `y` é o PÉ:
 *   · o topo do objeto encosta logo ABAIXO da cabeça — 22px acima do pé, e a cabeça ocupa uns 8;
 *   · ele fica CENTRADO no tronco, o que deixa os braços de fora nos dois lados (o corpo tem 10 de largura e
 *     os objetos, de 6 a 10);
 *   · e desloca 2px para o lado em que a pessoa OLHA, que é o "levemente à frente". */

/** Quanto o topo do objeto carregado fica abaixo do alto da cabeça, em fração da altura do jogador. */
const ABAIXO_DA_CABECA = 8 / 30;
/** O quanto o objeto avança para o lado em que a pessoa olha. */
const A_FRENTE = 2;

export function createRecycling(ctx: RecyclingSceneCtx): RecyclingApi {
  let itens: ItemDeLixo[] = [];
  let spritesDeLixo: SpriteDeLixo[] = [];
  let lixeiras: PostoDeLixeira[] = [];
  let placa: number | null = null;
  let vao: BarreiraDaPlaca | null = null;
  /** A lixeira em que cada jogador estava no quadro passado. Sem isto o descarte dispara em rajada. */
  let ultimaLixeira: number[] = [];
  /** Quantos itens já nasceram nesta partida — é ele que faz o rodízio de material atravessar as voltas. */
  let voltas = 0;

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

    const p = posicaoDaPlaca(ctx.mundo, ctx.placaEm);
    placa = p === null ? null : p.x;
    vao = faixaDaPlaca(ctx.mundo, p);
    if (p !== null) {
      const s = ctx.criarSprite(ctx.texturaDaPlaca);
      s.x = p.x; s.y = p.y - ctx.placaH; s.visible = true;   // o poste apoia NO chão, então ela sobe a PRÓPRIA altura
      ctx.camada.addChild(s);
    }

    // O rodízio dos materiais atravessa as VOLTAS: com um item por volta, começar sempre do primeiro faria a
    // criança ver caixa de papelão a partida inteira e nunca uma lata.
    itens = montarItens(candidatosDeLixo(ctx.mundo, ctx.candidatos(), ctx.lixeiraW, p),
      ctx.quantosItens, ctx.escolherLugares, voltas);
    voltas += ctx.quantosItens;
    spritesDeLixo = itens.map((it) => {
      const s = ctx.criarSprite(ctx.texturaDoLixo(it.material));
      s.x = it.x; s.y = it.y - ctx.alturaDoLixo(it.material); s.visible = true;
      ctx.camada.addChild(s);
      return s;
    });
    ultimaLixeira = [];
  }

  function atualizar(jogadores: readonly JogadorNaReciclagem[]): void {
    for (const j of jogadores) {
      const carga = cargaDe(itens, j.i);

      // ⚠️ PEGAR É DE BOTÃO, NÃO DE PROXIMIDADE. Encostar e pegar parece gentil, mas com lixo a mão fica
      // TRAVADA até a lixeira (`game/carry.PODE`) — e uma trava em que se cai sem querer, só por passar por
      // cima de uma latinha, é armadilha. Quem decide pegar é a criança.
      //
      // ⚠️ E NÃO HÁ 'soltar' NEM 'arremessar' AQUI, o que é a decisão e não um esquecimento: soltar e lançar
      // o lixo SÃO a desobediência à placa. `acaoDeCarga` nunca devolve nenhuma das duas com lixo na mão, e
      // este módulo não tem um segundo caminho para elas. A única saída do lixo é a lixeira.
      if (!carga && j.acao === 'pegar') {
        const pego = pegarPerto(itens, j.i, j.x, j.y, ctx.alcance);
        if (pego) ctx.anunciar('sr.lixo.pegou', j.i, { material: pego.material });
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
      const alto = ctx.alturaDoLixo(it.material);
      s.visible = true;
      if (dono) {
        // Na BARRIGA: centrado no tronco, o topo logo abaixo da cabeça, e 2px para o lado em que ele olha.
        s.x = dono.x - ctx.larguraDoLixo(it.material) / 2 + dono.olhandoPara * A_FRENTE;
        s.y = dono.y - ctx.alturaDoJogador * (1 - ABAIXO_DA_CABECA);
      } else {
        // No CHÃO: apoiado na linha do pé, subindo a altura do próprio objeto.
        s.x = it.x;
        s.y = it.y - alto;
      }
    });
  }

  const temItemPerto = (jogador: number, x: number, y: number): boolean =>
    !cargaDe(itens, jogador) && itens.some((it) => it.dono === null && !it.descartado
      && Math.hypot(it.x - x, it.y - y) <= ctx.alcance);

  return { montar, atualizar, itens: () => itens, temItemPerto,
    placaX: () => placa, barreira: () => vao, lixeiras: () => lixeiras };
}
