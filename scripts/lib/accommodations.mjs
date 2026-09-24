// SPDX-License-Identifier: AGPL-3.0-or-later
//
// THE ACCOMMODATIONS CATALOGUE — each with its key —, the declarations per category and the measurement of reach.
// Shared by `accommodations-by-genre.mjs` (the reach table) and `accommodations-gag.mjs` (the priority by the Game
// Accessibility Guidelines). The reasoning behind the keys is in the header of the first.
import { MAPA, EIXOS_DA_TAXONOMIA, SECOES } from './taxonomy.mjs';

/* ===================== THE DECLARATION'S AXES =====================
 * `fonte` says where the axis comes from: a contract field that already exists, or none (⚠️ still to be declared).
 */
export const EIXOS_DA_DECLARACAO = Object.freeze({
  tick: { fonte: 'GameDeclaration.tick', valores: new Set(['player', 'clock']) },
  segura: { fonte: 'GameDeclaration.holdsKeys() + o preset', valores: new Set(['nada', 'direcao', 'botao']) },
  entrada: { fonte: 'GameDeclaration.needsPointer()', valores: new Set(['acoes', 'ponteiro', 'texto']) },
  mundo: { fonte: 'GameDeclaration.world().kind', valores: new Set(['element', 'none']) },
  topologia: { fonte: 'GameDeclaration.topology().kind', valores: new Set(['grid', 'continuous', 'hotspots']) },
  avatar: { fonte: null, valores: new Set(['nenhum', 'fixo', 'veiculo', 'anda']) },
  texto: { fonte: null, valores: new Set(['rotulos', 'narrativo', 'materia']) },
  pecas: { fonte: null, valores: new Set(['nenhuma', 'baralho', 'tabuleiro']) },
  precisao: { fonte: null, valores: new Set(['folgada', 'precisa']) },
  // Came in through the GAG («avoid repeated inputs», Intermediate/Motor): mashing a button or a QTE. The catalogue
  // literally has a «Button-mash fighter» and an «Atletismo por ritmo — mash de teclas».
  repeticao: { fonte: null, valores: new Set(['nao', 'sim']) },
});

/* ===================== A DERIVED AXIS — the rule the engine ALREADY applies =====================
 * 🔴 The sonar needs TWO answers from the contract: a world (`world: none` ⇒ empathy and sonar are NOT offered, block 8
 * of `core/contract.ts`) and a direction (`bearing` returns `{ kind: 'none' }` for `hotspots`). Keying blind mode by the
 * topology alone gave it to Drawing, which declares `none`.
 *
 * 📌 It is still ONE key: the axis is derived from the two fields by the same rule the engine uses, not a second cell to
 * write another answer in. Since each category declares SETS, the derived value is the union of the combinations — an
 * overestimate, said: «Experimentais» joins a walk (spatial) and a canvas (no world).
 */
export const EIXOS_DERIVADOS = Object.freeze({
  espaco: {
    fonte: 'world().kind × topology().kind',
    valores: new Set(['espacial', 'lista', 'sem-mundo']),
    de: (e) => [...new Set(e.mundo.flatMap((m) => e.topologia.map((tp) => (m === 'none' ? 'sem-mundo' : tp === 'hotspots' ? 'lista' : 'espacial'))))],
  },
});
/*
 * 📌 READING THE VALUES that need a sentence:
 *   segura  `botao`    = besides the direction, a HELD button (running, charging power, blocking)
 *   entrada `ponteiro` = CONTINUOUS position (drawing, dragging, aiming with a mouse) — clicking one of N points is `acoes`
 *   avatar  `fixo`     = there is a character but it does not move (a paddle, a tamagotchi); `anda` = moves ON FOOT;
 *                     `veiculo` = moves in a car/ship — it does not breathe and carries no cane
 *   texto   `materia`  = the word IS the exercise (hangman, typing, quiz); `narrativo` = there is dialogue to read
 *   precisao`precisa`  = hitting depends on a short time window
 */

/* ===================== THE 35 CATEGORIES × THE DECLARATION'S AXES =====================
 * The set of values the category's games COVER — read in the catalogue's titles, not in the category's name.
 * «Puzzle Lógico» holds a key because it has Tetris; and does not, because it has Sudoku.
 */
export const DECL = {
  'Arcade Clássico': { tick: ['clock'], segura: ['nada', 'direcao'], entrada: ['acoes'], mundo: ['element'], topologia: ['grid', 'continuous'], avatar: ['fixo', 'anda'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['precisa'], repeticao: ['nao'] },
  'Shooters / Tiros': { tick: ['clock'], segura: ['direcao', 'botao'], entrada: ['acoes', 'ponteiro'], mundo: ['element'], topologia: ['continuous'], avatar: ['fixo', 'veiculo', 'anda'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['precisa'], repeticao: ['nao'] },
  'Endless Runner': { tick: ['clock'], segura: ['nada', 'botao'], entrada: ['acoes'], mundo: ['element'], topologia: ['continuous'], avatar: ['veiculo', 'anda'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['precisa'], repeticao: ['nao'] },
  'Puzzle Lógico': { tick: ['player', 'clock'], segura: ['nada', 'direcao'], entrada: ['acoes'], mundo: ['element'], topologia: ['grid'], avatar: ['nenhum', 'anda'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['folgada'], repeticao: ['nao'] },
  'Puzzle de Palavras': { tick: ['player'], segura: ['nada'], entrada: ['acoes', 'texto'], mundo: ['element'], topologia: ['grid', 'hotspots'], avatar: ['nenhum'], texto: ['materia'], pecas: ['nenhuma'], precisao: ['folgada'], repeticao: ['nao'] },
  'Puzzle Físico': { tick: ['player', 'clock'], segura: ['nada', 'botao'], entrada: ['acoes', 'ponteiro'], mundo: ['element'], topologia: ['continuous'], avatar: ['nenhum'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['folgada', 'precisa'], repeticao: ['nao'] },
  'Memória': { tick: ['player', 'clock'], segura: ['nada'], entrada: ['acoes'], mundo: ['element'], topologia: ['grid', 'hotspots'], avatar: ['nenhum'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['folgada'], repeticao: ['nao'] },
  'Platformer': { tick: ['clock'], segura: ['direcao', 'botao'], entrada: ['acoes'], mundo: ['element'], topologia: ['continuous'], avatar: ['anda'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['precisa'], repeticao: ['nao'] },
  'Corrida / Racing': { tick: ['clock'], segura: ['direcao', 'botao'], entrada: ['acoes'], mundo: ['element'], topologia: ['continuous'], avatar: ['veiculo'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['precisa'], repeticao: ['nao'] },
  'Esportes': { tick: ['player', 'clock'], segura: ['nada', 'direcao', 'botao'], entrada: ['acoes', 'ponteiro'], mundo: ['element'], topologia: ['continuous'], avatar: ['fixo', 'anda'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['precisa'], repeticao: ['nao', 'sim'] },
  'Cartas': { tick: ['player', 'clock'], segura: ['nada'], entrada: ['acoes'], mundo: ['element'], topologia: ['hotspots'], avatar: ['nenhum'], texto: ['rotulos'], pecas: ['baralho'], precisao: ['folgada', 'precisa'], repeticao: ['nao'] },
  'Tabuleiro': { tick: ['player'], segura: ['nada'], entrada: ['acoes'], mundo: ['element'], topologia: ['grid'], avatar: ['nenhum'], texto: ['rotulos'], pecas: ['tabuleiro'], precisao: ['folgada'], repeticao: ['nao'] },
  'Cassino / Sorte': { tick: ['player'], segura: ['nada'], entrada: ['acoes'], mundo: ['element'], topologia: ['hotspots'], avatar: ['nenhum'], texto: ['rotulos'], pecas: ['nenhuma', 'baralho'], precisao: ['folgada'], repeticao: ['nao'] },
  'Simulação / Idle': { tick: ['clock'], segura: ['nada'], entrada: ['acoes'], mundo: ['element'], topologia: ['hotspots', 'grid'], avatar: ['nenhum', 'fixo'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['folgada'], repeticao: ['nao'] },
  'RPG / Aventura': { tick: ['player', 'clock'], segura: ['nada', 'direcao'], entrada: ['acoes'], mundo: ['element'], topologia: ['grid', 'continuous', 'hotspots'], avatar: ['anda'], texto: ['narrativo'], pecas: ['nenhuma', 'baralho'], precisao: ['folgada', 'precisa'], repeticao: ['nao'] },
  'Estratégia': { tick: ['player', 'clock'], segura: ['nada'], entrada: ['acoes'], mundo: ['element'], topologia: ['grid', 'continuous'], avatar: ['nenhum'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['folgada'], repeticao: ['nao'] },
  'Ritmo / Música': { tick: ['clock'], segura: ['nada', 'botao'], entrada: ['acoes'], mundo: ['element'], topologia: ['hotspots'], avatar: ['nenhum', 'fixo'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['precisa'], repeticao: ['nao'] },
  'Digitação': { tick: ['player', 'clock'], segura: ['nada'], entrada: ['texto'], mundo: ['element'], topologia: ['hotspots'], avatar: ['nenhum'], texto: ['materia'], pecas: ['nenhuma'], precisao: ['folgada', 'precisa'], repeticao: ['nao'] },
  'Desenho / Criativo': { tick: ['player'], segura: ['nada', 'direcao'], entrada: ['ponteiro'], mundo: ['none'], topologia: ['continuous', 'grid'], avatar: ['nenhum'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['folgada'], repeticao: ['nao'] },
  'Educativo / Quiz': { tick: ['player', 'clock'], segura: ['nada'], entrada: ['acoes'], mundo: ['element'], topologia: ['hotspots'], avatar: ['nenhum'], texto: ['materia'], pecas: ['nenhuma'], precisao: ['folgada'], repeticao: ['nao'] },
  'Reação / Reflexo': { tick: ['clock'], segura: ['nada', 'botao'], entrada: ['acoes', 'ponteiro'], mundo: ['element'], topologia: ['hotspots', 'continuous'], avatar: ['nenhum'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['precisa'], repeticao: ['nao', 'sim'] },
  'Party / Microgames': { tick: ['clock'], segura: ['nada', 'direcao'], entrada: ['acoes'], mundo: ['element'], topologia: ['hotspots', 'continuous'], avatar: ['nenhum', 'anda'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['precisa'], repeticao: ['nao', 'sim'] },
  'Stealth / Furtivo': { tick: ['player', 'clock'], segura: ['direcao'], entrada: ['acoes'], mundo: ['element'], topologia: ['grid', 'continuous'], avatar: ['anda'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['folgada'], repeticao: ['nao'] },
  'Luta / Fighting': { tick: ['clock'], segura: ['direcao', 'botao'], entrada: ['acoes'], mundo: ['element'], topologia: ['continuous'], avatar: ['anda'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['precisa'], repeticao: ['nao', 'sim'] },
  'Terror / Atmosfera': { tick: ['clock'], segura: ['direcao', 'botao'], entrada: ['acoes'], mundo: ['element'], topologia: ['continuous', 'grid'], avatar: ['anda'], texto: ['rotulos', 'narrativo'], pecas: ['nenhuma'], precisao: ['folgada'], repeticao: ['nao'] },
  'Sandbox / Sim Físico': { tick: ['clock'], segura: ['nada'], entrada: ['ponteiro'], mundo: ['element'], topologia: ['grid', 'continuous'], avatar: ['nenhum'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['folgada'], repeticao: ['nao'] },
  'Pseudo-3D / Raycasting': { tick: ['clock'], segura: ['direcao', 'botao'], entrada: ['acoes'], mundo: ['element'], topologia: ['continuous'], avatar: ['veiculo', 'anda'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['precisa'], repeticao: ['nao'] },
  'Isométrico': { tick: ['player', 'clock'], segura: ['nada', 'direcao'], entrada: ['acoes'], mundo: ['element'], topologia: ['grid'], avatar: ['nenhum', 'anda'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['folgada', 'precisa'], repeticao: ['nao'] },
  'Multiplayer Local': { tick: ['clock'], segura: ['direcao', 'botao'], entrada: ['acoes'], mundo: ['element'], topologia: ['continuous', 'grid'], avatar: ['veiculo', 'anda'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['precisa'], repeticao: ['nao'] },
  'Experimentais / Arte': { tick: ['player', 'clock'], segura: ['nada', 'direcao'], entrada: ['acoes', 'ponteiro'], mundo: ['element', 'none'], topologia: ['continuous', 'hotspots'], avatar: ['nenhum', 'anda'], texto: ['rotulos', 'narrativo'], pecas: ['nenhuma'], precisao: ['folgada'], repeticao: ['nao'] },
  'Cozinha Produção': { tick: ['clock'], segura: ['nada', 'botao'], entrada: ['acoes', 'ponteiro'], mundo: ['element'], topologia: ['hotspots', 'continuous'], avatar: ['nenhum'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['precisa'], repeticao: ['nao'] },
  'Point-and-Click / Hidden': { tick: ['player'], segura: ['nada'], entrada: ['acoes'], mundo: ['element'], topologia: ['hotspots'], avatar: ['nenhum'], texto: ['rotulos', 'narrativo'], pecas: ['nenhuma'], precisao: ['folgada'], repeticao: ['nao'] },
  'Narrativo Detetive': { tick: ['player'], segura: ['nada'], entrada: ['acoes', 'texto'], mundo: ['element'], topologia: ['hotspots'], avatar: ['nenhum'], texto: ['narrativo'], pecas: ['nenhuma'], precisao: ['folgada'], repeticao: ['nao'] },
  'Labirinto Exploração': { tick: ['player', 'clock'], segura: ['direcao'], entrada: ['acoes'], mundo: ['element'], topologia: ['grid'], avatar: ['anda'], texto: ['rotulos'], pecas: ['nenhuma'], precisao: ['folgada'], repeticao: ['nao'] },
  'Híbridos / Mashups': { tick: ['player', 'clock'], segura: ['nada', 'direcao'], entrada: ['acoes'], mundo: ['element'], topologia: ['grid', 'continuous', 'hotspots'], avatar: ['nenhum', 'anda'], texto: ['rotulos', 'materia'], pecas: ['nenhuma', 'baralho'], precisao: ['folgada', 'precisa'], repeticao: ['nao'] },
};

/* ===================== THE ACCOMMODATIONS, EACH WITH ITS KEY =====================
 * `tem` = exists in the engine today. `chave` = `'universal'`, or `{ eixo, valores }` — ONE axis.
 *
 * ⚠️ `universal` DOES NOT MEAN NOT THOUGHT THROUGH: it means there is text, sound, a screen, a menu or keys in any game,
 * and that is the argument of every row that uses it.
 */
export const U = 'universal';
export const ACOM = {
  tipografia: { tem: true, o: 'a fonte do jogo inteiro', chave: U },
  caixaDaLetra: { tem: true, o: 'maiúsculas vs maiúsculas+minúsculas', chave: U },
  narracao: { tem: true, o: 'TTS lê o que está escrito', chave: U },
  indiceFalado: { tem: true, o: '«3 de 7» ao andar num menu', chave: U },
  libras: { tem: true, o: 'janela de Libras', chave: U },
  som: { tem: true, o: 'mestre + volume por categoria', chave: U },
  simulacaoAuditiva: { tem: true, o: 'empatia: simular perda auditiva', chave: U },
  altoContraste: { tem: true, o: 'alto contraste', chave: U },
  correcaoDaltonismo: { tem: true, o: 'correção de daltonismo', chave: U },
  reducaoCena: { tem: true, o: 'parar parallax, decoração, itens, partículas', chave: U },
  // 📌 Every game has at least confirm and pause, and the menu is navigated by keys — even a drawing game's.
  remapearTeclas: { tem: true, o: 'remapear teclas', chave: U },
  // 📌 Phase 5b's target ruler is the INTERFACE's (menus, pad, bar), and there is an interface in every game.
  tamanhoDoAlvo: { tem: false, o: 'alvos maiores para tocar/clicar', chave: U },

  // — by what the contract ALREADY declares —
  // `core/state` `setGameSpeedValue`, the quick bar's hourglass (ADR-0180).
  velocidadeDoJogo: { tem: true, o: 'abrandar o jogo inteiro (GAG: «adjust the game speed»)', chave: { eixo: 'tick', valores: ['clock'] } },
  alternanciaDeMarcha: { tem: true, o: 'andar sem segurar a direcção', chave: { eixo: 'segura', valores: ['direcao', 'botao'] } },
  alternanciaDoCorrer: { tem: true, o: 'correr sem segurar o botão', chave: { eixo: 'segura', valores: ['botao'] } },
  controleVirtual: { tem: true, o: 'pad na tela (tamanho, geometria, slots)', chave: { eixo: 'entrada', valores: ['acoes'] } },
  // `core/state` `setSwitchScanValue`: the machine offers each position and one press takes it (ADR-0218).
  umBotaoSo: { tem: true, o: 'colapsar as acções numa só', chave: { eixo: 'entrada', valores: ['acoes'] } },
  // ⚠️ IT WAS «assistenciaDeTraco» (steadying the stroke while drawing). The right key is the continuous POINTER, and with
  // it the same shaky hand that draws also aims and drags — the accommodation is the tremor's, not the drawing's.
  estabilizarPonteiro: { tem: false, o: 'suavizar o tremor do ponteiro (traço, mira, arrasto)', chave: { eixo: 'entrada', valores: ['ponteiro'] } },
  // The contract: `world: none` ⇒ empathy and sonar are NOT offered (`core/contract.ts`, block 8).
  simulacaoVisual: { tem: true, o: 'empatia: simular cegueira / baixa visão / daltonismo', chave: { eixo: 'mundo', valores: ['element'] } },
  // 🔴 And the sonar needs a WORLD and a DIRECTION — see `EIXOS_DERIVADOS`. In a list of points, or with no world, the
  // blind child plays by narration and the spoken index, which are universal.
  blindMode: { tem: true, o: 'jogar sem ver, por pistas de áudio', chave: { eixo: 'espaco', valores: ['espacial'] } },
  navegacaoSonora: { tem: true, o: 'volume de bengala/sonar/guia', chave: { eixo: 'espaco', valores: ['espacial'] } },

  // — by the taxonomy —
  saidaDeAudio: { tem: true, o: 'saída de áudio própria por jogador', chave: { eixo: 'jogadores', valores: ['local'] } },
  balancoDaCamara: { tem: false, o: 'balanço/FOV da câmara — enjoo', chave: { eixo: 'perspectiva', valores: ['primeira-pessoa', 'atras'] } },
  // The physics of the engine's Easy Mode (gravity, coins on the ground) and the wheelchair (no jump) are PLATFORMER ones.
  modoFacil: { tem: true, o: 'gravidade menor, moedas no chão, sem perigos', chave: { eixo: 'generos', valores: ['1.1'] } },
  cadeiraDeRodas: { tem: true, o: 'sem pulo; rampas e elevadores', chave: { eixo: 'generos', valores: ['1.1'] } },
  generosidadeDeteccao: { tem: false, o: 'quão depressa um guarda te vê', chave: { eixo: 'generos', valores: ['1.5'] } },
  intensidade: { tem: false, o: 'sustos, tensão', chave: { eixo: 'generos', valores: ['10.6', '2.1'] } },
  dicaOuRealce: { tem: false, o: 'dica / realce do que procurar', chave: { eixo: 'generos', valores: ['3', '3.2', '3.3', '4', '4.2', '4.2.1', '4.3', '4.6', '7', '10.1', '10.11'] } },

  // — by axes the contract does NOT ask yet —
  reducaoPersonagem: { tem: true, o: 'parar andar/respirar/gracinhas do personagem', chave: { eixo: 'avatar', valores: ['fixo', 'anda'] } },
  bengalaEspacamento: { tem: true, o: 'de quanto em quanto chão a bengala bate', chave: { eixo: 'avatar', valores: ['anda'] } },
  velocidadeDoTexto: { tem: false, o: 'ler ao próprio ritmo (GAG: «text prompts at their own pace»)', chave: { eixo: 'texto', valores: ['narrativo', 'materia'] } },
  dificuldadeLexical: { tem: false, o: 'tamanho e frequência das palavras', chave: { eixo: 'texto', valores: ['narrativo', 'materia'] } },
  pecas: { tem: false, o: 'conjuntos de peças / baralhos alternativos', chave: { eixo: 'pecas', valores: ['baralho', 'tabuleiro'] } },
  naipesDistinguiveis: { tem: false, o: 'naipes distinguíveis sem depender de cor', chave: { eixo: 'pecas', valores: ['baralho'] } },
  janelaDeAcerto: { tem: false, o: 'quanto tempo conta como «no tempo certo»', chave: { eixo: 'precisao', valores: ['precisa'] } },

  // ============ THE ONES THE GAG BROUGHT (`accommodations-gag.mjs`) — the study did not have them ============
  // 📌 `tem` was checked in the code when written, and each `true` says where; a `false` the engine already had would lie
  // about the priority. `intervaloEntreEntradas` is `core/state` `setInputCooldownValue` (ADR-0217).
  entradaRepetida: { tem: false, o: 'trocar martelar/QTE por segurar ou por um toque', chave: { eixo: 'repeticao', valores: ['sim'] } },
  intervaloEntreEntradas: { tem: true, o: 'ignorar a segunda entrada dentro de N ms (tremor)', chave: { eixo: 'entrada', valores: ['acoes'] } },
  macros: { tem: false, o: 'uma entrada dispara uma sequência', chave: { eixo: 'entrada', valores: ['acoes'] } },
  sensibilidadeDoControle: { tem: false, o: 'quanto o ponteiro anda por movimento', chave: { eixo: 'entrada', valores: ['ponteiro'] } },
  corDoPonteiro: { tem: false, o: 'cor e forma do cursor / mira', chave: { eixo: 'entrada', valores: ['ponteiro'] } },
  assistencia: { tem: false, o: 'mira e direcção assistidas', chave: { eixo: 'precisao', valores: ['precisa'] } },
  realceDePalavras: { tem: false, o: 'realçar as palavras importantes do texto', chave: { eixo: 'texto', valores: ['narrativo', 'materia'] } },
  audiodescricao: { tem: false, o: 'descrever em voz o que acontece na cena', chave: { eixo: 'mundo', valores: ['element'] } },
  // `ui/help-panel.ts` (phase 1d): each button and what it means, with the REMAPPED key.
  ajudaDosControles: { tem: true, o: 'lembrar os controles durante o jogo', chave: U },
  // ⚠️ `objectiveOf` is required by the contract and has ZERO readers in `app/js`.
  lembreteDoObjetivo: { tem: false, o: 'lembrar o objectivo actual durante o jogo', chave: U },
  repetirInstrucao: { tem: false, o: 'ouvir de novo a última instrução', chave: U },
  // `core/state` `captionsOn` — the sound captions (deaf accessibility).
  legendasDeSom: { tem: true, o: 'legendas para os sons que importam', chave: U },
  // `core/a11y-sr`: `srSay` (polite) e `srAlert` (assertive).
  leitorDeTela: { tem: true, o: 'anúncios para leitor de tela', chave: U },
  monoEstereo: { tem: false, o: 'somar os canais para quem ouve de um lado só', chave: U },
  tamanhoDaInterface: { tem: false, o: 'aumentar a interface inteira, não só a letra', chave: U },
  rearranjarInterface: { tem: false, o: 'mover os elementos da interface', chave: U },
  // 📌 The engine cannot make a game easier — it can STORE, persist and announce the choice, and the game reads it. It is
  // the shape of `rebuildCoins` that phase 5a proposes for speed. Easy Mode is the platformer's instance.
  dificuldade: { tem: false, o: 'escolher e mudar a dificuldade durante o jogo', chave: U },
  pularTrecho: { tem: false, o: 'saltar o que não é a mecânica central', chave: U },
  perfis: { tem: false, o: 'guardar conjuntos de ajustes por criança', chave: U },

  // ============ DECIDED BY THE DEV, WITHOUT MEASURING THE CATALOGUE (ADR-0188) ============
  // ⚠️ `semMedida`: the key is the cartridge's ANSWER, not an axis declared category by category — putting it in each of
  // the 35 would be guessing from the catalogue, which is a study sample and not a list to build. `medir` skips them.
  corDoDono: { tem: true, o: 'cada item na cor de quem o pode pegar', chave: { eixo: 'resposta', valores: ['sim'] }, semMedida: 'ADR-0188' },
  contornos: { tem: true, o: 'contorno de 1º e 2º plano no alto contraste', chave: { eixo: 'resposta', valores: ['sim'] }, semMedida: 'ADR-0188' },
};

/* ===================== the axes, together ===================== */
export const VALIDOS = {
  generos: new Set(Object.keys(SECOES)),
  ...EIXOS_DA_TAXONOMIA,
  ...Object.fromEntries(Object.entries({ ...EIXOS_DA_DECLARACAO, ...EIXOS_DERIVADOS }).map(([k, v]) => [k, v.valores])),
};
export const eixosDe = (nome) => {
  const e = { ...MAPA[nome], ...DECL[nome] };
  for (const [k, d] of Object.entries(EIXOS_DERIVADOS)) e[k] = d.de(e);
  return e;
};

/**
 * Checks the seven guards and measures each accommodation's reach. Returns `{ problemas }` when some guard fails — the
 * caller decides how to exit —, or `{ linhas, TOTAL, problemas: [] }`, sorted by reach.
 */
export function medir(categorias) {
  /* ===================== the seven guards ===================== */
  const nomes = categorias.map((c) => c.nome);
  const problemas = [];
  for (const n of nomes) if (!(n in DECL)) problemas.push(`categoria SEM declaração: ${n}`);
  for (const n of Object.keys(DECL)) if (!nomes.includes(n)) problemas.push(`declaração SEM categoria: ${n}`);
  for (const [n, d] of Object.entries(DECL)) {
    for (const [eixo, validos] of Object.entries(EIXOS_DA_DECLARACAO)) {
      const v = d[eixo];
      if (!Array.isArray(v) || !v.length) problemas.push(`${n}: eixo «${eixo}» vazio`);
      else for (const x of v) if (!validos.valores.has(x)) problemas.push(`${n}: «${x}» não é um valor de «${eixo}»`);
    }
  }
  for (const [k, a] of Object.entries(ACOM)) {
    if (a.semMedida) continue; // decided without measuring the catalogue — see the entries
    if (!a.chave) { problemas.push(`${k}: SEM chave`); continue; }
    if (a.chave === U) continue;
    if (Object.keys(a.chave).sort().join() !== 'eixo,valores') { problemas.push(`${k}: a chave tem de ser { eixo, valores } — UM eixo`); continue; }
    if (!(a.chave.eixo in VALIDOS)) { problemas.push(`${k}: eixo «${a.chave.eixo}» não existe`); continue; }
    for (const v of a.chave.valores) if (!VALIDOS[a.chave.eixo].has(v)) problemas.push(`${k}: «${v}» não é um valor de «${a.chave.eixo}» — casaria zero, calado`);
  }
  if (problemas.length) return { problemas };

  /* ===================== count ===================== */
  const jogosDe = Object.fromEntries(categorias.map((c) => [c.nome, c.jogos]));
  const TOTAL = categorias.reduce((a, c) => a + c.jogos, 0);
  const casa = (chave, nome) => chave === U || eixosDe(nome)[chave.eixo].some((v) => chave.valores.includes(v));
  const linhas = Object.entries(ACOM).filter(([, meta]) => !meta.semMedida).map(([k, meta]) => {
    const gens = nomes.filter((n) => casa(meta.chave, n));
    return { k, ...meta, nGen: gens.length, nJogos: gens.reduce((a, n) => a + jogosDe[n], 0), gens };
  }).sort((a, b) => b.nJogos - a.nJogos || b.nGen - a.nGen);

  for (const l of linhas) if (!l.nGen) problemas.push(`${l.k}: a chave não alcança categoria nenhuma — acomodação sem assunto em lado nenhum`);
  if (problemas.length) return { problemas };

  return { linhas, TOTAL, problemas: [] };
}
