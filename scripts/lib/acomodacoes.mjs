// SPDX-License-Identifier: AGPL-3.0-or-later
//
// O CATÁLOGO DE ACOMODAÇÕES — cada uma com a sua chave —, as declarações por categoria e a medição do alcance.
// Partilhado por `acomodacoes-por-genero.mjs` (a tabela de alcance) e `acomodacoes-gag.mjs` (a prioridade
// pela Game Accessibility Guidelines). O raciocínio das chaves está no cabeçalho do primeiro.
import { MAPA, EIXOS_DA_TAXONOMIA, SECOES } from './taxonomia.mjs';

/* ===================== OS EIXOS DA DECLARAÇÃO =====================
 * `fonte` diz de onde vem o eixo: um campo do contrato que já existe, ou nenhum (⚠️ ainda por declarar).
 */
export const EIXOS_DA_DECLARACAO = Object.freeze({
  tick: { fonte: 'GameDeclaration.tick', valores: new Set(['player', 'clock']) },
  segura: { fonte: 'GameDeclaration.seguraTeclas() + o preset', valores: new Set(['nada', 'direcao', 'botao']) },
  entrada: { fonte: 'GameDeclaration.needsPointer()', valores: new Set(['acoes', 'ponteiro', 'texto']) },
  mundo: { fonte: 'GameDeclaration.world().kind', valores: new Set(['element', 'none']) },
  topologia: { fonte: 'GameDeclaration.topology().kind', valores: new Set(['grid', 'continuous', 'hotspots']) },
  avatar: { fonte: null, valores: new Set(['nenhum', 'fixo', 'veiculo', 'anda']) },
  texto: { fonte: null, valores: new Set(['rotulos', 'narrativo', 'materia']) },
  pecas: { fonte: null, valores: new Set(['nenhuma', 'baralho', 'tabuleiro']) },
  precisao: { fonte: null, valores: new Set(['folgada', 'precisa']) },
  // Entrou pela GAG («avoid repeated inputs», Intermediate/Motor): martelar um botão ou um QTE. O catálogo tem
  // literalmente um «Button-mash fighter» e um «Atletismo por ritmo — mash de teclas».
  repeticao: { fonte: null, valores: new Set(['nao', 'sim']) },
});

/* ===================== UM EIXO DERIVADO — a regra que a engine JÁ aplica =====================
 * 🔴 O sonar precisa de DUAS respostas do contrato: um mundo (`world: none` ⇒ «empatia e sonar NÃO são
 * oferecidos», bloco 8) e uma direcção (`bearing` devolve `{ kind: 'none' }` em `hotspots`,
 * `core/contract.ts:610`). Chavear o modo cego só pela topologia deu-o ao Desenho, que declara `none`.
 *
 * 📌 Continua a ser UMA chave: o eixo é derivado dos dois campos pela mesma regra que a engine usa, e não uma
 * segunda célula onde escrever outra resposta. Como cada categoria declara CONJUNTOS, o derivado é a união
 * das combinações — uma sobre-estimativa, dita: «Experimentais» junta um passeio (espacial) e uma tela (sem mundo).
 */
export const EIXOS_DERIVADOS = Object.freeze({
  espaco: {
    fonte: 'world().kind × topology().kind',
    valores: new Set(['espacial', 'lista', 'sem-mundo']),
    de: (e) => [...new Set(e.mundo.flatMap((m) => e.topologia.map((tp) => (m === 'none' ? 'sem-mundo' : tp === 'hotspots' ? 'lista' : 'espacial'))))],
  },
});
/*
 * 📌 LEITURA DOS VALORES que pedem uma frase:
 *   segura  `botao`    = além da direcção, um BOTÃO segurado (correr, carregar força, bloquear)
 *   entrada `ponteiro` = posição CONTÍNUA (desenhar, arrastar, mirar com rato) — clicar num de N pontos é `acoes`
 *   avatar  `fixo`     = há personagem mas não se desloca (raquete, tamagotchi); `anda` = desloca-se A PÉ;
 *                     `veiculo` = desloca-se num carro/nave — não respira e não leva bengala
 *   texto   `materia`  = a palavra É o exercício (forca, digitação, quiz); `narrativo` = há diálogo a ler
 *   precisao`precisa`  = acertar depende de uma janela de tempo curta
 */

/* ===================== AS 35 CATEGORIAS × OS EIXOS DA DECLARAÇÃO =====================
 * O conjunto de valores que os jogos da categoria COBREM — lido nos títulos do catálogo, não no nome da
 * categoria. «Puzzle Lógico» segura tecla porque tem Tetris; e não segura, porque tem Sudoku.
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

/* ===================== AS ACOMODAÇÕES, CADA UMA COM A SUA CHAVE =====================
 * `tem` = existe na engine hoje. `chave` = `'universal'`, ou `{ eixo, valores }` — UM eixo.
 *
 * ⚠️ `universal` NÃO É «NÃO PENSEI»: quer dizer que há texto, som, tela, menu ou teclas em qualquer jogo, e é
 * esse o argumento de cada linha que o usa.
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
  // 📌 Todo jogo tem pelo menos confirmar e pausa, e o menu é navegado por teclas — até o de desenho.
  remapearTeclas: { tem: true, o: 'remapear teclas', chave: U },
  // 📌 A régua de alvo da fase 5b é da INTERFACE (menus, pad, barra), e há interface em todo jogo.
  tamanhoDoAlvo: { tem: false, o: 'alvos maiores para tocar/clicar', chave: U },

  // — pelo que o contrato JÁ declara —
  velocidadeDoJogo: { tem: false, o: 'abrandar o jogo inteiro (GAG: «adjust the game speed»)', chave: { eixo: 'tick', valores: ['clock'] } },
  alternanciaDeMarcha: { tem: true, o: 'andar sem segurar a direcção', chave: { eixo: 'segura', valores: ['direcao', 'botao'] } },
  alternanciaDoCorrer: { tem: true, o: 'correr sem segurar o botão', chave: { eixo: 'segura', valores: ['botao'] } },
  controleVirtual: { tem: true, o: 'pad na tela (tamanho, geometria, slots)', chave: { eixo: 'entrada', valores: ['acoes'] } },
  umBotaoSo: { tem: false, o: 'colapsar as acções numa só', chave: { eixo: 'entrada', valores: ['acoes'] } },
  // ⚠️ ERA «assistenciaDeTraco» (estabilizar o traço ao desenhar). A chave certa é o PONTEIRO contínuo, e com ela
  // a mesma mão trémula que desenha também mira e arrasta — a acomodação é a do tremor, não a do desenho.
  estabilizarPonteiro: { tem: false, o: 'suavizar o tremor do ponteiro (traço, mira, arrasto)', chave: { eixo: 'entrada', valores: ['ponteiro'] } },
  // O contrato: `world: none` ⇒ «empatia e sonar NÃO são oferecidos» (`core/contract.ts`, bloco 8).
  simulacaoVisual: { tem: true, o: 'empatia: simular cegueira / baixa visão / daltonismo', chave: { eixo: 'mundo', valores: ['element'] } },
  // 🔴 E o sonar precisa de MUNDO e de DIRECÇÃO — ver `EIXOS_DERIVADOS`. Numa lista de pontos, ou sem mundo,
  // a criança cega joga pela narração e pelo índice falado, que são universais.
  modoCego: { tem: true, o: 'jogar sem ver, por pistas de áudio', chave: { eixo: 'espaco', valores: ['espacial'] } },
  navegacaoSonora: { tem: true, o: 'volume de bengala/sonar/guia', chave: { eixo: 'espaco', valores: ['espacial'] } },

  // — pela taxonomia —
  saidaDeAudio: { tem: true, o: 'saída de áudio própria por jogador', chave: { eixo: 'jogadores', valores: ['local'] } },
  balancoDaCamara: { tem: false, o: 'balanço/FOV da câmara — enjoo', chave: { eixo: 'perspectiva', valores: ['primeira-pessoa', 'atras'] } },
  // A física do Modo Fácil da engine (gravidade, moedas no chão) e a cadeira (sem pulo) são de PLATAFORMA.
  modoFacil: { tem: true, o: 'gravidade menor, moedas no chão, sem perigos', chave: { eixo: 'generos', valores: ['1.1'] } },
  cadeiraDeRodas: { tem: true, o: 'sem pulo; rampas e elevadores', chave: { eixo: 'generos', valores: ['1.1'] } },
  generosidadeDeteccao: { tem: false, o: 'quão depressa um guarda te vê', chave: { eixo: 'generos', valores: ['1.5'] } },
  intensidade: { tem: false, o: 'sustos, tensão', chave: { eixo: 'generos', valores: ['10.6', '2.1'] } },
  dicaOuRealce: { tem: false, o: 'dica / realce do que procurar', chave: { eixo: 'generos', valores: ['3', '3.2', '3.3', '4', '4.2', '4.2.1', '4.3', '4.6', '7', '10.1', '10.11'] } },

  // — por eixos que o contrato AINDA não pergunta —
  reducaoPersonagem: { tem: true, o: 'parar andar/respirar/gracinhas do personagem', chave: { eixo: 'avatar', valores: ['fixo', 'anda'] } },
  bengalaEspacamento: { tem: true, o: 'de quanto em quanto chão a bengala bate', chave: { eixo: 'avatar', valores: ['anda'] } },
  velocidadeDoTexto: { tem: false, o: 'ler ao próprio ritmo (GAG: «text prompts at their own pace»)', chave: { eixo: 'texto', valores: ['narrativo', 'materia'] } },
  dificuldadeLexical: { tem: false, o: 'tamanho e frequência das palavras', chave: { eixo: 'texto', valores: ['narrativo', 'materia'] } },
  pecas: { tem: false, o: 'conjuntos de peças / baralhos alternativos', chave: { eixo: 'pecas', valores: ['baralho', 'tabuleiro'] } },
  naipesDistinguiveis: { tem: false, o: 'naipes distinguíveis sem depender de cor', chave: { eixo: 'pecas', valores: ['baralho'] } },
  janelaDeAcerto: { tem: false, o: 'quanto tempo conta como «no tempo certo»', chave: { eixo: 'precisao', valores: ['precisa'] } },

  // ============ AS QUE A GAG TROUXE (`acomodacoes-gag.mjs`) — o estudo não as tinha ============
  // 📌 `tem` foi conferido no código, e cada `true` diz onde; um `false` que a engine já tivesse mentiria sobre a prioridade.
  entradaRepetida: { tem: false, o: 'trocar martelar/QTE por segurar ou por um toque', chave: { eixo: 'repeticao', valores: ['sim'] } },
  intervaloEntreEntradas: { tem: false, o: 'ignorar a segunda entrada dentro de N ms (tremor)', chave: { eixo: 'entrada', valores: ['acoes'] } },
  macros: { tem: false, o: 'uma entrada dispara uma sequência', chave: { eixo: 'entrada', valores: ['acoes'] } },
  sensibilidadeDoControle: { tem: false, o: 'quanto o ponteiro anda por movimento', chave: { eixo: 'entrada', valores: ['ponteiro'] } },
  corDoPonteiro: { tem: false, o: 'cor e forma do cursor / mira', chave: { eixo: 'entrada', valores: ['ponteiro'] } },
  assistencia: { tem: false, o: 'mira e direcção assistidas', chave: { eixo: 'precisao', valores: ['precisa'] } },
  realceDePalavras: { tem: false, o: 'realçar as palavras importantes do texto', chave: { eixo: 'texto', valores: ['narrativo', 'materia'] } },
  audiodescricao: { tem: false, o: 'descrever em voz o que acontece na cena', chave: { eixo: 'mundo', valores: ['element'] } },
  // `ui/help-panel.ts` (fase 1d): cada botão e o que significa, com a tecla REMAPEADA.
  ajudaDosControles: { tem: true, o: 'lembrar os controles durante o jogo', chave: U },
  // ⚠️ `objectiveOf` é obrigatório no contrato e tem ZERO leitores em `app/js` — o mesmo padrão do `tick`.
  lembreteDoObjetivo: { tem: false, o: 'lembrar o objectivo actual durante o jogo', chave: U },
  repetirInstrucao: { tem: false, o: 'ouvir de novo a última instrução', chave: U },
  // `core/state` `captionsOn` — «legendas dos sons (a11y surdez)».
  legendasDeSom: { tem: true, o: 'legendas para os sons que importam', chave: U },
  // `core/a11y-sr`: `srSay` (polite) e `srAlert` (assertive).
  leitorDeTela: { tem: true, o: 'anúncios para leitor de tela', chave: U },
  monoEstereo: { tem: false, o: 'somar os canais para quem ouve de um lado só', chave: U },
  tamanhoDaInterface: { tem: false, o: 'aumentar a interface inteira, não só a letra', chave: U },
  rearranjarInterface: { tem: false, o: 'mover os elementos da interface', chave: U },
  // 📌 A engine não pode fazer um jogo mais fácil — pode GUARDAR, persistir e anunciar a escolha, e o jogo lê-a.
  // É a forma do `rebuildCoins` que a fase 5a propõe para a velocidade. O Modo Fácil é a instância de plataforma.
  dificuldade: { tem: false, o: 'escolher e mudar a dificuldade durante o jogo', chave: U },
  pularTrecho: { tem: false, o: 'saltar o que não é a mecânica central', chave: U },
  perfis: { tem: false, o: 'guardar conjuntos de ajustes por criança', chave: U },
};

/* ===================== os eixos, juntos ===================== */
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
 * Confere as sete guardas e mede o alcance de cada acomodação. Devolve `{ problemas }` quando alguma guarda
 * reprova — quem chama decide como sair —, ou `{ linhas, TOTAL, problemas: [] }`, ordenadas por alcance.
 */
export function medir(categorias) {
  /* ===================== as sete guardas ===================== */
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
    if (!a.chave) { problemas.push(`${k}: SEM chave`); continue; }
    if (a.chave === U) continue;
    if (Object.keys(a.chave).sort().join() !== 'eixo,valores') { problemas.push(`${k}: a chave tem de ser { eixo, valores } — UM eixo`); continue; }
    if (!(a.chave.eixo in VALIDOS)) { problemas.push(`${k}: eixo «${a.chave.eixo}» não existe`); continue; }
    for (const v of a.chave.valores) if (!VALIDOS[a.chave.eixo].has(v)) problemas.push(`${k}: «${v}» não é um valor de «${a.chave.eixo}» — casaria zero, calado`);
  }
  if (problemas.length) return { problemas };

  /* ===================== contar ===================== */
  const jogosDe = Object.fromEntries(categorias.map((c) => [c.nome, c.jogos]));
  const TOTAL = categorias.reduce((a, c) => a + c.jogos, 0);
  const casa = (chave, nome) => chave === U || eixosDe(nome)[chave.eixo].some((v) => chave.valores.includes(v));
  const linhas = Object.entries(ACOM).map(([k, meta]) => {
    const gens = nomes.filter((n) => casa(meta.chave, n));
    return { k, ...meta, nGen: gens.length, nJogos: gens.reduce((a, n) => a + jogosDe[n], 0), gens };
  }).sort((a, b) => b.nJogos - a.nJogos || b.nGen - a.nGen);

  for (const l of linhas) if (!l.nGen) problemas.push(`${l.k}: a chave não alcança categoria nenhuma — acomodação sem assunto em lado nenhum`);
  if (problemas.length) return { problemas };

  return { linhas, TOTAL, problemas: [] };
}
