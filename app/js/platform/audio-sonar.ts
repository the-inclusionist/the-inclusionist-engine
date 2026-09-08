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
import { distance, bearing, type Bearing, type Spot, type Topology, type Speakable, type Role } from '../core/contract.js';
import { t } from '../core/i18n.js';
// O GUIA (#84 item 2) é feito destes dois, e de mais nada: a ROTA diz quantos passos faltam contornando
// parede, e a INTENSIDADE traduz esse número em brilho e volume. Nenhum dos dois toca no Web Audio; a fiação
// — a única parte que toca — é o `updateGuide` lá em baixo, e é por isso que o desenho é conferível em `node`.
import { rotaAte } from '../core/route.js';
import { intensidadeDoGuia, CORTE_LONGE, PASSOS_ATE_O_FUNDO } from './guide-intensity.js';

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
  // ⚠️ `viz` SAIU daqui, e a ausência é a notícia: este módulo já não sabe o que é um modo visual. A pergunta
  // que ele fazia à string — «isto é cegueira ou baixa visão?» — passou a entrar respondida, por
  // `ctx.visaoComprometida`. Um jogador continua a poder tê-lo; o sonar é que deixou de o ler.
  readonly audioSink?: string | null;
}

/** O grafo contínuo do guia: oscilador → passa-baixo → ganho → panorâmica → categoria `guide`. */
export interface GuiaVivo {
  /** O contexto que o construiu — é dele que sai o `currentTime` de cada `setTargetAtTime`. */
  readonly ac: AudioContext;
  readonly osc: OscillatorNode;
  readonly filtro: BiquadFilterNode;
  readonly ganho: GainNode;
  /** `null` em motor sem `createStereoPanner` — o guia fica mono em vez de não existir. */
  readonly panner: StereoPannerNode | null;
  /** Quadros desde a última vez que a ROTA foi recalculada. A rota é cara; o som não pode esperar por ela. */
  desdeARota: number;
  /** O último `passos` medido. É daqui que a intensidade sai a cada quadro. */
  passos: number;
  /** A última panorâmica medida, pelo mesmo motivo: ela vem do alvo, que só se procura com a rota. */
  pan: number;
}

/**
 * ⚠️ O TIMBRE TEM DE TER HARMÓNICOS, e isto é requisito técnico, não gosto.
 *
 * O eixo do #84 item 2 é o BRILHO, e brilho é um passa-baixo a abrir e a fechar. **Um passa-baixo sobre uma
 * onda `sine` não faz absolutamente nada**: a senoide não tem nada acima da fundamental para o filtro cortar,
 * e o guia ficaria com um eixo morto e só o volume a trabalhar. A dente-de-serra é a mais rica das quatro
 * ondas do Web Audio — tem TODOS os harmónicos —, e é por isso que ela é a escolha.
 *
 * E ela resolve, de graça, a outra restrição do plano: o sonar e a bengala usam `sine`. Um timbre diferente
 * era exigência de não colidirem no mesmo canal; aqui o timbre diferente É o mecanismo.
 */
export const GUIA_TIPO: OscillatorType = 'sawtooth';

/**
 * A fundamental do guia, fixa.
 *
 * ⚠️ FIXA DE PROPÓSITO: a ALTURA já é a linguagem do sonar (`380 + 740 * near`, mais perto = mais agudo). Se o
 * guia também subisse de tom, os dois estariam a dizer a mesma coisa pelo mesmo meio, e quem ouve os dois ao
 * mesmo tempo não teria como separá-los. O guia diz distância por brilho; o sonar, por altura.
 */
export const GUIA_HZ = 220;

/**
 * Quantos quadros entre dois cálculos de rota.
 *
 * ⚠️ A ROTA É UMA BUSCA EM LARGURA, e o `__incl.update(dt)` conta QUADROS: correr uma BFS a cada quadro num
 * mapa de plataforma gasta o orçamento do quadro inteiro no aparelho-alvo (Positivo/Chromebook, pilar 1). Doze
 * quadros são ~0,2 s a 60 fps — mais depressa do que a criança anda um passo, e o som não espera por eles: a
 * intensidade é reescrita TODO quadro, com o `passos` que a última rota deixou.
 */
export const QUADROS_ENTRE_ROTAS = 12;

/**
 * O tecto de pontos da rota do guia. Bem abaixo dos 4096 do `core/route`, e o próprio módulo diz porquê:
 * «uma pista por quadro tolera muito menos do que um cálculo ao carregar a fase». Estourar devolve `null`, que
 * é «não sei» — e o guia cai na reta, que ainda soa.
 */
export const ORCAMENTO_DA_ROTA = 1024;

/**
 * O ganho de base do guia, antes de a intensidade e o volume mestre o multiplicarem.
 *
 * ⚠️ MAIS BAIXO DO QUE O BIPE QUE ELE SUBSTITUI (0,11), e não por engano: um som que **nunca para** é
 * percebido como mais alto do que um transiente do mesmo pico, e cansa por permanência em vez de por
 * intensidade — exactamente o que o modo TEA existe para não fazer.
 */
export const GUIA_VOL = 0.06;

/** Constante de tempo do `setTargetAtTime`. Curta o bastante para acompanhar o passo, longa o bastante para
 *  que a mudança seja um deslize e não um degrau — um degrau a cada rota seria um bipe outra vez. */
export const TAU_DO_GUIA = 0.08;

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
  /**
   * O GRAFO VIVO DO GUIA deste jogador, e mora AQUI, ao lado dos outros dois, pelo mesmo motivo que eles
   * (ADR-0039: o dono declara onde o campo nasce; ADR-0033: a entidade da engine declara o que a ENGINE
   * possui, e um oscilador não é dela). `null`/ausente = calado.
   *
   * ⚠️ ELE PRECISA DE SOBREVIVER AOS QUADROS, e é aí que ele difere de tudo o resto neste ficheiro. O sonar e
   * o bipe antigo criavam um oscilador, tocavam-no e deitavam-no fora; uma presença CONTÍNUA (#84 item 2) é um
   * oscilador que FICA, com o filtro e o ganho a mover-se por baixo dele. É por isso que ele tem de estar
   * pendurado no jogador: não há outro lugar onde algo por jogador dure de um quadro para o outro.
   *
   * ⚠️ E É POR ISSO QUE `desligarGuia` EXISTE. Um campo que dura é um campo que vaza: sem alguém a pará-lo,
   * desligar a categoria `guide` no mixer deixaria o som a tocar.
   */
  _guia?: GuiaVivo | null;
}

export interface PlayerCtxOut { ac: AudioContext; out: GainNode; }
// `VizDef` SAIU em 2026-09-08 (#104): era a fatia da tabela de modos de render que este módulo atravessava,
// e ele deixou de a conhecer — ver a nota em `visaoComprometida`.

export interface SonarCtx {
  /* --- o CONTRATO: o que era plataforma e virou pergunta (ADR-0030) --- */
  /** Campo 1: a métrica. Função, porque um jogo com fases troca de topologia entre elas. */
  topology: () => Topology;
  /** Campo 5, metade "alvo": onde estão os alvos ainda válidos deste jogador. Vazio = nada a apontar. */
  targetsOf: (playerIndex: number) => readonly Spot[];
  /** Campo 3: como se chama o que está ali. `null` = sem nome, e o anúncio cai no genérico. */
  nameAt: (at: Spot) => Speakable | null;
  /**
   * Campo 2: o que há neste ponto. É o que o `core/route` atravessa (ou não) para achar o caminho.
   *
   * ⚠️ OPCIONAL AQUI, e obrigatório na `GameDeclaration` — a diferença não é descuido. Tornar um campo do
   * `SonarCtx` obrigatório quebra todo o consumidor que já monta este ctx à mão, e o `create-game` (que é
   * quem o monta de verdade) sempre o tem, porque o `validateDeclaration` o exige. Ausente aqui, o guia não
   * fica calado: ele cai na distância em reta, que é o que ele já fazia antes desta mudança.
   */
  roleAt?: (at: Spot) => Role;

  /* --- áudio, idêntico ao que `audio-nav` já recebia --- */
  tonePan: (freq: number, dur: number, cat: string, pan?: number | null, vol?: number, type?: OscillatorType, pc?: PlayerCtxOut | null) => void;
  srSay: (text: string) => void;
  narrate: (text: string) => void;
  /**
   * O barramento de uma categoria do mixer. A MESMA forma que `audio-ambient`, `audio-earcons`, `audio-jingles`
   * e `tts` já recebem — o guia deixou de poder usar o `tonePan` porque `tonePan` toca e esquece, e uma
   * presença contínua é um grafo que FICA.
   *
   * Opcional pelo mesmo motivo que o `roleAt`: quem não o injectar cai no `audioOut` e, na falta dele, no
   * `destination`. O que se perde é o cursor da categoria `guide`, não o som.
   */
  catNode?: (cat: string) => AudioNode | null;
  /** O nó mestre, recuo do `catNode`. */
  audioOut?: () => AudioNode | null;
  /**
   * O volume mestre (0..1), que cada síntese multiplica por si — o `_masterGain` do `platform/audio` é o mudo
   * da pausa, não o cursor. Ausente = 1: o guia soa, e ignora o cursor. Por isso o `create-game` injecta-o.
   */
  getVolume?: () => number;

  /* --- a11y e tela --- */
  /**
   * Esta criança tem a visão comprometida — cegueira simulada ou baixa visão?
   *
   * ⚠️ SUBSTITUIU O `VIZ_BY_KEY` EM 2026-09-08 (#104), e a troca encolheu este módulo em vez de o migrar.
   * Ele recebia a TABELA de modos de render e atravessava-a com `pl.viz`; agora recebe a RESPOSTA. Quem a dá
   * é a raiz de composição, que conhece os dois eixos e pode importar de `render/` — o que este ficheiro,
   * estando em `platform/`, não pode sem inverter uma aresta de camada.
   *
   * O `pl` inteiro e não o índice: quem responde já tem o jogador em mão, e passar o índice obrigaria a raiz
   * a procurá-lo outra vez numa lista que ela acabou de percorrer.
   */
  visaoComprometida: (pl: SonarPlayer) => boolean;
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
  /**
   * ⚠️ MUDOU DE SIGNIFICADO com o #84 item 2, e o número passa a ser muito maior. Contava BIPES (um a cada 48
   * quadros); conta agora QUADROS EM QUE O GUIA SOA, porque não há mais nada discreto para contar — é essa a
   * mudança. Quem o lê para dizer «o guia está a funcionar» continua certo; quem o lesse para dizer «tocou
   * três vezes» estaria a perguntar por uma coisa que deixou de existir.
   */
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

  /**
   * Visão comprometida? Guarda e guia só existem quando a resposta é sim (ou no modo cego).
   *
   * ⚠️ A METADE VISUAL PASSOU A SER INJECTADA (#104), e o módulo ficou MENOR em vez de migrado. Ele
   * consultava `ctx.VIZ_BY_KEY[pl.viz]` — uma tabela de modos de RENDER, atravessada por uma chave de
   * render, dentro de `platform/`. A #104 obrigava a escolher: ou este ficheiro passava a importar
   * `render/viz-axes` (uma aresta ao contrário: medido, `render/` importa de `platform/` em cinco pontos e o
   * inverso em nenhum), ou deixava de saber o que é um modo visual.
   *
   * A segunda é a certa, e é o movimento que o `touch.ts` já nomeia como «o mesmo do achado 10
   * (`isNavigable`): injetar o BOOLEANO, não o estado». O que este módulo precisa de saber é «esta criança
   * precisa de pista sonora», e isso não é uma pergunta sobre tabelas de filtro — é uma pergunta que a raiz
   * de composição responde, porque é ela que conhece os dois eixos.
   *
   * O que FICA aqui é a regra que é mesmo deste módulo: **o modo cego liga as pistas para toda a gente**,
   * independentemente do que a visão diga.
   */
  function needsAudioCues(pl: SonarPlayer): boolean {
    return ctx.getModoCego() || ctx.visaoComprometida(pl);
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

  /**
   * QUANTOS PASSOS FALTAM, e a resposta preferida é a que contorna parede.
   *
   * ⚠️ AS DUAS RESPOSTAS JÁ ESTÃO NA MESMA UNIDADE, e é a única razão pela qual esta função é uma linha em vez
   * de uma conversão: `rotaAte().passos` conta passos por definição, e `distance()` também devolve passos em
   * TODA topologia — ela própria divide pela `unit` no ramo contínuo. Dividir aqui outra vez pelo passo do
   * mundo era o erro à espera de ser cometido, e num jogo com `unit = 16` ele poria o guia no brilho máximo
   * para sempre. É o mesmo defeito que a #121 tirou do `panFor`: misturar régua de mundo com régua de ecrã.
   *
   * A rota perde-se de duas maneiras — jogo que não injectou `roleAt`, e orçamento estourado — e as duas caem
   * no mesmo recuo: a RETA. ⚠️ Ela mente atrás de parede (diz «perto» de um alvo que exige dar a volta), e é
   * por isso que é recuo e não escolha. Mas é o que o guia já dizia antes desta mudança, e continuar a dizê-lo
   * é estritamente melhor do que calar — calar afirmaria que não há alvo.
   */
  function passosAteOAlvo(pl: SonarPlayer, alvo: { at: Spot; d: number }): number {
    const roleAt = ctx.roleAt;
    if (roleAt) {
      const rota = rotaAte(
        { topology: ctx.topology(), roleAt, orcamento: ORCAMENTO_DA_ROTA },
        { x: pl.x, y: pl.y }, [alvo.at],
      );
      if (rota) return rota.passos;
    }
    return alvo.d;
  }

  /** Acende o grafo contínuo deste jogador. `null` = não deu (sem contexto, ou motor sem Web Audio). */
  function ligarGuia(pl: SonarPlayer): GuiaVivo | null {
    const pc = playerCtx(pl);
    const ac = pc ? pc.ac : ctx.getAudioCtx();
    if (!ac) return null;
    try {
      const osc = ac.createOscillator(), filtro = ac.createBiquadFilter(), ganho = ac.createGain();
      osc.type = GUIA_TIPO;
      osc.frequency.value = GUIA_HZ;
      filtro.type = 'lowpass';
      filtro.frequency.value = CORTE_LONGE; // nasce no fundo da escala e sobe; nascer aberto seria um susto
      ganho.gain.value = 0;                 // e nasce calado, para não estalar ao ligar
      let saida: AudioNode = ganho;
      let panner: StereoPannerNode | null = null;
      if (ac.createStereoPanner) { panner = ac.createStereoPanner(); ganho.connect(panner); saida = panner; }
      osc.connect(filtro).connect(ganho);
      saida.connect(pc ? pc.out : (ctx.catNode?.('guide') || ctx.audioOut?.() || ac.destination));
      osc.start();
      // `desdeARota` nasce no tecto para que a PRIMEIRA volta já meça a rota, em vez de soar doze quadros
      // com um `passos` inventado.
      return { ac, osc, filtro, ganho, panner, desdeARota: QUADROS_ENTRE_ROTAS, passos: PASSOS_ATE_O_FUNDO, pan: 0 };
    } catch (e) { return null; }
  }

  /**
   * Apaga o grafo — e ele TEM de ser apagado, porque um oscilador que fica é a diferença entre esta forma e a
   * anterior. O bipe morria sozinho ao fim de 0,12 s; este toca até alguém o parar. Sem esta função, desligar
   * a categoria `guide` no mixer deixaria o som a tocar, e trocar de modo visual deixaria um segundo grafo a
   * somar-se ao primeiro.
   *
   * Desce em rampa (não corta) porque um corte seco num oscilador vivo é um clique — um transiente, que é
   * precisamente o que este item existe para tirar do ouvido da criança.
   */
  function desligarGuia(pl: SonarPlayer): void {
    const g = pl._guia;
    if (!g) return;
    pl._guia = null;
    try {
      const agora = g.ac.currentTime;
      g.ganho.gain.setTargetAtTime(0, agora, 0.05);
      g.osc.stop(agora + 0.3);
    } catch (e) { /* noop */ }
  }

  /**
   * A PRESENÇA CONTÍNUA, um quadro de cada vez (#84 item 2).
   *
   * ⚠️ O QUE SAIU DAQUI FOI UM BIPE: um `triangle` de 0,12 s a cada 48 quadros, para sempre, independente de a
   * criança se mexer ou de algo ter mudado. O veredicto do Dev: «um ping é a pior escolha possível, tenebroso
   * para quem tem TEA». O que entra não dispara nada — o som já está lá, e muda de brilho.
   *
   * ⚠️ E CALAR CONTINUA A SER UMA AFIRMAÇÃO, com um significado só: NÃO HÁ ALVO. É por isso que «sem alvo»
   * apaga o grafo e «longe» não: o piso do `guide-intensity` (`VOL_LONGE`) existe exactamente para que a
   * criança não confunda «está longe» com «não há nada para achar».
   */
  function updateGuide(): void {
    const cat = ctx.getAudioCat();
    const ligado = !!ctx.getAudioCtx() && ctx.getSoundOn() && !!cat && !!cat.guide && cat.guide.on;
    const vol = ctx.getVolume ? ctx.getVolume() : 1;
    for (const pl of ctx.getPlayers()) {
      if (!ligado || !needsAudioCues(pl)) { desligarGuia(pl); continue; }

      let g = pl._guia;
      if (!g) {
        // ⚠️ A PERGUNTA «HÁ ALVO?» VEM ANTES DE ACENDER, e o gate cobrou-a: com o grafo a nascer primeiro, um
        // jogador sem alvo criava um oscilador, media a rota, não achava nada e apagava-o — SESSENTA VEZES
        // POR SEGUNDO. O bipe não tinha este problema porque não tinha nada que durasse; foi a permanência
        // que o trouxe. `alvoMaisProximo` é um laço sobre `targetsOf`, não a BFS: perguntar por quadro custa
        // zero quando a lista está vazia, que é exactamente o caso em questão.
        if (!alvoMaisProximo(pl)) continue;
        g = pl._guia = ligarGuia(pl);
        if (!g) continue;
      }

      if (++g.desdeARota >= QUADROS_ENTRE_ROTAS) {
        g.desdeARota = 0;
        const alvo = alvoMaisProximo(pl);
        if (!alvo) { desligarGuia(pl); continue; }
        g.passos = passosAteOAlvo(pl, alvo);
        g.pan = panFor(alvo.at.x, pl);
      }

      // TODO quadro, e não só quando a rota é nova: é isto que faz a mudança ser um deslize.
      const i = intensidadeDoGuia(g.passos);
      try {
        const agora = g.ac.currentTime;
        g.filtro.frequency.setTargetAtTime(i.corte, agora, TAU_DO_GUIA);
        g.ganho.gain.setTargetAtTime(GUIA_VOL * i.volume * vol, agora, TAU_DO_GUIA);
        g.panner?.pan.setTargetAtTime(g.pan, agora, TAU_DO_GUIA);
      } catch (e) { /* noop */ }
      _guideCount++;
    }
  }

  return {
    playerCtx, panFor, needsAudioCues, sonar, updateGuide,
    get sonarCount() { return _sonarCount; },
    get guideCount() { return _guideCount; },
  };
}
