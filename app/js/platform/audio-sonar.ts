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
// Sobrou UMA constante de mundo: `LOGICAL_W`, usada só pelo pan. Ela é da TELA e não do gênero — todo jogo
// deste console tem 320 px de largura lógica —, e por isso entra por ctx em vez de virar campo de contrato.
//
// ========================= SEM I/O NO IMPORT =========================
// Nada aqui toca `window` fora de `playerCtx`, que é chamada e não importada. Roda no project `node`.
import { distance, type Spot, type Topology, type Speakable } from '../core/contract.js';
import { t } from '../core/i18n.js';

export type SinkAC = AudioContext & { setSinkId?: (id: string) => Promise<void> };

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
  LOGICAL_W: number;
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
    return Math.max(-1, Math.min(1, (wx - pl.x) / (ctx.LOGICAL_W * 0.55)));
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
    const lado = alvo.at.x < pl.x - 4 ? 'sr.nav.left' : alvo.at.x > pl.x + 4 ? 'sr.nav.right' : 'sr.nav.ahead';
    const corpo = t('sr.nav.sonarFound', {
      alvo: nome ? nome.text : t('sr.nav.target'),
      lado: t(lado),
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
