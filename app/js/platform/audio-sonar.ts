// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/audio-sonar — NAVEGAÇÃO SONORA, a metade de `audio-nav` que serve a QUALQUER gênero (item 19).
//
// ========================= O ACHADO 9, VIRADO CORTE =========================
// O segundo consumidor registrou, e não contornou:
//
//     "O SONAR NÃO PODE SER USADO POR QUEM NÃO É PLATAFORMA… O ctx de `platform/audio-nav` pede 19 coisas, e
//      seis delas são de plataforma pura — `tileAt`, `solidAt`, `BOX`, `TILE`, `getCoins`, `getCenario`. Um
//      quiz teria de inventar tiles falsos, uma caixa de colisão falsa e um cenário falso para pedir 'aponte
//      a alternativa mais próxima'. E o módulo é DOIS módulos com um nome só."
//
// Estes são os dois. Aqui fica o que navega por SOM: apontar o alvo mais perto, o beacon em laço, o pan pela
// posição relativa e a pergunta "esta criança precisa de pista sonora?". Em `audio-nav` ficam a BENGALA e o
// NADO CEGO, que leem tile, chão e caixa de colisão — plataforma, e sem disfarce.
//
// ========================= O QUE SUBSTITUIU AS SEIS COISAS DE PLATAFORMA =========================
// Nenhuma delas atravessou. O sonar perguntava ao jogo por um array de moedas e filtrava `taken`/`owner`;
// agora ele recebe o CONTRATO (ADR-0030):
//
//   · `getCoins()` + o filtro  →  `targetsOf(i)`, a metade "alvo" do campo 5. O jogo entrega os pontos que
//     ainda contam para aquele jogador, e nunca diz o que eles são.
//   · `TILE` (a régua de "perto")  →  `topology()` + `distance()`, a métrica declarada no campo 1. Numa
//     plataforma são pixels sobre `unit`; numa grade, passos de rei; num quiz, diferença de índice.
//   · `t('sr.nav.coin')` (o nome do alvo)  →  `nameAt(spot)`, campo 3. É o que faz o anúncio dizer "moeda",
//     "pergunta" ou "caixa" sem a engine conhecer nenhum dos três.
//
// ⚠️ E SOBRAVA UMA, QUE ERA A ÚLTIMA E A PIOR: o pan media a largura do estéreo em `LOGICAL_W * 0.55` — a
// largura da TELA. Escrevi aqui que ela era «da tela e não do gênero, e por isso entra por ctx». A frase
// estava certa sobre a origem e errada sobre a consequência: o `wx` que ela divide vem da TOPOLOGIA, e
// dividir uma medida de mundo pela largura de um ecrã só funciona quando as duas usam a mesma régua.
//
// Medido ao construir o `game-soccer` (#121): num campo de 90 METROS, um colega dez metros à direita dá
// `10 / 176 = 0,057` — mono, na prática. O sonar ficaria **certo e inaudível**, que é a mesma classe de
// defeito que o quiz registou como «certo e inútil». Para a plataforma era verdade por acaso (o mundo dela é
// medido em pixels) e para `grid`/`hotspots` era vácuo, e é por isso que nunca se viu.
//
// A largura do estéreo passa a vir da métrica declarada: `PAN_PACES * passo`, onde o passo é o `unit` do
// contínuo, uma célula na grade, e nada na lista — que não tem espaço.
//
// ========================= SEM I/O NO IMPORT =========================
// Nada aqui toca `window` fora de `playerCtx`, que é chamada e não importada. Roda no project `node`.
import { distance, bearing, type Bearing, type Spot, type Topology, type Speakable } from '../core/contract.js';
import { t } from '../core/i18n.js';

export type SinkAC = AudioContext & { setSinkId?: (id: string) => Promise<void> };

/**
 * Quantos PASSOS da métrica declarada saturam o estéreo. Além disto, "à direita" é só à direita.
 *
 * ⚠️ ONZE NÃO É NÚMERO NOVO — é o que a plataforma sempre teve, relido na régua certa. O denominador antigo
 * era `LOGICAL_W * 0.55 = 320 × 0,55 = 176` pixels, e a plataforma declara `unit: TILE` = 16: são **exatamente
 * 11 tiles**. Reescrever em passos preserva o que essa criança já ouve, letra por letra, e passa a dizer o
 * mesmo em qualquer gênero — 11 casas num tabuleiro, 11 metros num campo.
 *
 * E encaixa na régua que o resto do módulo já usa: `chaveDeDistancia` corta "muito perto" em 4 passos e
 * "perto" em 9. O estéreo satura logo depois de a coisa passar a ser "longe", que é onde a direção deixa de
 * precisar de mais precisão.
 */
export const PAN_PACES = 11;

/**
 * Quanto vale UM passo, em unidades do mundo. Zero = este espaço não tem lado.
 *
 * Contínuo: o `unit` declarado. Grade: uma célula, por definição. Lista: nada — `hotspots` é uma ordem, não
 * uma geometria, e inventar-lhe uma largura de estéreo seria apontar para um lado que não existe.
 */
export function passoDoMundo(topo: Topology): number {
  return topo.kind === 'continuous' ? topo.unit : topo.kind === 'grid' ? 1 : 0;
}

/**
 * O jogador visto pela navegação sonora. É a fatia MÍNIMA, e ela encolheu com o corte: `facing` ficou com a
 * bengala (é ela que bate "à frente") e `wnT` com o nado. Sobrou identidade, posição, visão e o dispositivo.
 */
export interface SonarPlayer extends PlayerAudioOut {
  readonly i: number;
  readonly x: number;
  readonly y: number;
  readonly viz: string;
  readonly audioSink?: string | null;
  guideT?: number;
}

/**
 * A SAÍDA DEDICADA de um jogador, e este módulo é o DONO dela: é aqui que os dois campos NASCEM
 * (`new AC()` + `createGain()`, logo abaixo). Pelo ADR-0039 o dono declara onde o campo nasce, e o
 * `core/entity` não os menciona — eles não são da entidade da engine, são rascunho que o áudio pendura
 * no jogador.
 *
 * `_acOut` admite `null` porque `ui/settings-audio` escreve `null` nos dois ao trocar de dispositivo.
 * Enquanto o `core/entity` dizia `unknown`, essa escrita passava sem que ninguém visse que o dono
 * declarava `GainNode` sem nulo — as duas descrições discordavam e o `unknown` era o que as escondia.
 */
export interface PlayerAudioOut {
  _ac?: SinkAC | null;
  _acOut?: GainNode | null;
}

export interface PlayerCtxOut { ac: AudioContext; out: GainNode; }
type VizDef = { kind?: string } | undefined;

export interface SonarCtx {
  /* --- o CONTRATO: o que era plataforma e virou pergunta (ADR-0030) --- */
  /** Campo 1: a métrica. Função, porque um jogo com fases troca de topologia entre elas. */
  topology: () => Topology;
  /** Campo 5, metade "alvo": onde estão os alvos ainda válidos deste jogador. Vazio = nada a apontar. */
  targetsOf: (playerIndex: number) => readonly Spot[];
  /** Campo 3: como se chama o que está ali. `null` = sem nome, e o anúncio cai no genérico. */
  nameAt: (at: Spot) => Speakable | null;

  /* --- áudio, idêntico ao que `audio-nav` já recebia --- */
  tonePan: (freq: number, dur: number, cat: string, pan?: number | null, vol?: number, type?: OscillatorType, pc?: PlayerCtxOut | null) => void;
  srSay: (text: string) => void;
  narrate: (text: string) => void;

  /* --- a11y e tela --- */
  VIZ_BY_KEY: Record<string, VizDef>;
  getModoCego: () => boolean;
  /** Largura LÓGICA da tela. É do console, não do gênero — por isso ctx, e não campo de contrato. */
  /**
   * @deprecated ⚠️ SEM LEITOR DESDE 2026-09-07 (#121). Era o denominador do pan, e era o defeito: media a
   * largura do estéreo em pixels de ecrã e dividia por ela uma distância de MUNDO. Agora a largura vem da
   * topologia (`PAN_PACES * passoDoMundo`).
   *
   * Ficou OPCIONAL em vez de removido — tornar um campo obrigatório em opcional é compatível para trás, e
   * quem já o injecta continua a compilar. Removê-lo de vez é candidato ao próximo major.
   */
  LOGICAL_W?: number;
  getPlayers: () => SonarPlayer[];
  getNumPlayers: () => number;
  getAudioCtx: () => AudioContext | null;
  getSoundOn: () => boolean;
  getAudioCat: () => Record<string, { on: boolean }> | null;
}

export interface AudioSonar {
  playerCtx: (pl: SonarPlayer) => PlayerCtxOut | null;
  panFor: (wx: number, pl: SonarPlayer) => number;
  needsAudioCues: (pl: SonarPlayer) => boolean;
  sonar: (pl: SonarPlayer) => void;
  updateGuide: () => void;
  readonly sonarCount: number;
  readonly guideCount: number;
}

export function createAudioSonar(ctx: SonarCtx): AudioSonar {
  let _sonarCount = 0, _guideCount = 0;

  /** AudioContext do jogador (para o `setSinkId` no dispositivo dele), ou null → contexto global. */
  function playerCtx(pl: SonarPlayer): PlayerCtxOut | null {
    if (!pl || !pl.audioSink) return null;
    try {
      if (!pl._ac) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        pl._ac = new AC(); pl._acOut = pl._ac.createGain(); pl._acOut.connect(pl._ac.destination);
        if (pl._ac.setSinkId) pl._ac.setSinkId(pl.audioSink).catch(() => {});
      }
      if (pl._ac.state === 'suspended') pl._ac.resume();
      return { ac: pl._ac, out: pl._acOut! };
    } catch (e) { return null; }
  }

  function panFor(wx: number, pl: SonarPlayer): number {
    const passo = passoDoMundo(ctx.topology());
    // `hotspots` não tem espaço, logo não tem lado. O `bearing` já responde `none` pelo mesmo motivo, e
    // centrar é a única resposta honesta — um pan calculado sobre índices de lista aponta para nada.
    if (!(passo > 0)) return 0;
    return Math.max(-1, Math.min(1, (wx - pl.x) / (PAN_PACES * passo)));
  }

  /** Visão comprometida? Guarda e guia só existem quando a resposta é sim (ou no modo cego). */
  function needsAudioCues(pl: SonarPlayer): boolean {
    if (ctx.getModoCego()) return true;
    const m = ctx.VIZ_BY_KEY[pl.viz];
    return !!(m && (m.kind === 'blind' || m.kind === 'lowvision'));
  }

  /**
   * O alvo mais perto deste jogador, na MÉTRICA DECLARADA — e `null` se não houver nenhum.
   *
   * Era um laço sobre `getCoins()` com `if (cn.taken || cn.owner !== pl.i) continue` e `Math.hypot`. As três
   * coisas que ele sabia sobre o jogo (que alvos são moedas, que moedas têm dono, que distância é euclidiana
   * em pixels) viraram uma pergunta ao contrato e uma chamada a `distance`.
   */
  /**
   * O RUMO EM PALAVRAS, na língua de quem joga e no referencial que o JOGO declarou.
   *
   * ⚠️ O QUE ISTO SUBSTITUI ERA UM DEFEITO DE ACESSIBILIDADE, não um detalhe de estilo. O sonar calculava o
   * lado à mão, de `x` cru, com zona morta de ±4:
   *
   *     alvo.at.x < pl.x - 4 ? 'left' : alvo.at.x > pl.x + 4 ? 'right' : 'ahead'
   *
   * Três palavras onde o contrato tem oito — e MISTURANDO REFERENCIAIS: *esquerda/direita* é relativo à TELA,
   * *à frente* é relativo ao CORPO, e quem ouve não tem como saber de que origem cada uma fala. Pior: tudo o
   * que estivesse acima ou abaixo da criança virava «à frente», que é justamente a informação que mais falta
   * a quem não vê a tela — apagada por uma zona morta.
   *
   * ⚠️ E O REFERENCIAL É DO JOGO. Num tabuleiro diz-se «a nordeste»; numa plataforma 2D vista de lado, norte
   * não quer dizer nada, e o que se diz é «às 2 horas».
   */
  function emPalavras(r: Bearing): string {
    if (r.kind === 'none') return t('sr.nav.here');
    // Uma chave com `{h}` e não doze — mas a forma do singular é sua, porque «às 1 horas» não é português
    // (nem «a las 1» é espanhol). Em inglês as duas coincidem, e coincidir não é motivo para não a ter.
    if (r.kind === 'clock') return r.hour === 1 ? t('sr.nav.clockOne') : t('sr.nav.clock', { h: r.hour });
    return t('sr.nav.dir.' + r.heading);
  }

  function alvoMaisProximo(pl: SonarPlayer): { at: Spot; d: number } | null {
    const topo = ctx.topology();
    const aqui: Spot = { x: pl.x, y: pl.y };
    let melhor: Spot | null = null, bd = Infinity;
    for (const alvo of ctx.targetsOf(pl.i)) {
      const d = distance(topo, aqui, alvo);
      if (d < bd) { bd = d; melhor = alvo; }
    }
    return melhor ? { at: melhor, d: bd } : null;
  }

  /**
   * "Perto" em PASSOS da métrica declarada, e não em pixels.
   *
   * Os limiares de 4 e 9 tiles do original viram 4 e 9 UNIDADES: numa plataforma com `unit = TILE` a conta é
   * a mesma de antes, letra por letra; numa grade são quatro e nove casas; num quiz, quatro e nove itens de
   * distância na lista. É a mesma frase para a criança em qualquer gênero, que é o ponto do contrato.
   */
  const chaveDeDistancia = (d: number): string =>
    d < 4 ? 'sr.nav.veryClose' : d < 9 ? 'sr.nav.close' : 'sr.nav.far';

  function sonar(pl: SonarPlayer): void {
    _sonarCount++;
    const pc = playerCtx(pl);
    const alvo = alvoMaisProximo(pl);
    // A chave era `sr.nav.noCoinNear` — "Nenhuma moeda por perto." Um sonar que não sabe mais o que é o alvo
    // não pode dizer o nome dele no caso em que NÃO HÁ alvo nenhum: virou "Nada por perto.", que é verdade em
    // qualquer gênero. Foi o gate de fixtures que cobrou, ao acusar a palavra dentro do teste novo.
    if (!alvo) { ctx.tonePan(300, 0.2, 'sonar', 0, 0.2, 'sine', pc); ctx.srSay(t('sr.nav.noTargetNear')); return; }

    const pan = panFor(alvo.at.x, pl), near = Math.max(0, 1 - alvo.d / 12);
    ctx.tonePan(380 + 740 * near, 0.16, 'sonar', pan, 0.26, 'sine', pc); // mais perto = mais agudo

    // O NOME vem do jogo (campo 3). Antes era `t('sr.nav.coin')` — a engine dizia "moeda" porque só conhecia
    // moedas. O fallback existe para o jogo que declara alvo sem nome: melhor "alvo" do que uma chave crua.
    const nome = ctx.nameAt(alvo.at);
    const corpo = t('sr.nav.sonarFound', {
      alvo: nome ? nome.text : t('sr.nav.target'),
      lado: emPalavras(bearing(ctx.topology(), { x: pl.x, y: pl.y }, alvo.at)),
      dist: t(chaveDeDistancia(alvo.d)),
    });
    const msg = (ctx.getNumPlayers() > 1 ? t('sr.player.prefix', { n: pl.i + 1 }) : '') + corpo;
    ctx.srSay(msg); ctx.narrate(msg);
  }

  /** Beacon automático por quadro: o sonar contínuo de quem não vê a tela. */
  function updateGuide(): void {
    const cat = ctx.getAudioCat();
    if (!ctx.getAudioCtx() || !ctx.getSoundOn() || !cat || !cat.guide || !cat.guide.on) return;
    for (const pl of ctx.getPlayers()) {
      if (!needsAudioCues(pl)) continue;
      pl.guideT = (pl.guideT || 0) + 1;
      if (pl.guideT < 48) continue;
      pl.guideT = 0; // pinga ~0,8s
      const alvo = alvoMaisProximo(pl);
      if (!alvo) continue;
      const pan = panFor(alvo.at.x, pl), near = Math.max(0, 1 - alvo.d / 14);
      ctx.tonePan(300 + 380 * near, 0.12, 'guide', pan, 0.11, 'triangle', playerCtx(pl));
      _guideCount++;
    }
  }

  return {
    playerCtx, panFor, needsAudioCues, sonar, updateGuide,
    get sonarCount() { return _sonarCount; },
    get guideCount() { return _guideCount; },
  };
}
