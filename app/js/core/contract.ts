// SPDX-License-Identifier: AGPL-3.0-or-later
// core/contract — OS SETE CAMPOS. A interface que o ADR-0030 escolheu como o eixo da engine.
//
// ========================= O QUE ISTO É, E O QUE NÃO É =========================
// Não é um framework nem uma classe-base. É a ÚNICA coisa que a pilha de acessibilidade sabe sobre um jogo.
// O ADR-0027 mediu que as três funções que MAIS pareciam genéricas eram as três mais amarradas à plataforma —
// `roleOf` era uma tabela de tiles, `caneProbe` usava `facing` e `BOX.w`, o sonar definia alvo como "moeda não
// coletada deste jogador". Nenhuma delas estava errada; todas estavam ADIVINHANDO o jogo em vez de perguntar.
//
// Estes sete campos são as perguntas. Um jogo que as responda ganha sonar, alto contraste, varredura, leitor de
// tela e Libras sem escrever uma linha deles — que é o produto, e não "mais uma engine 2D" (ADR-0027).
//
// ========================= PURO, E DE PROPÓSITO =========================
// Só TIPOS e funções puras. Zero dependências, zero I/O no import: é módulo-FOLHA, importável dos dois lados da
// fronteira e do project `node`. Um contrato que precisasse de PIXI já teria escolhido o gênero.
//
// ========================= COMO SE USA: FATIAS, NÃO O OBJETO GORDO =========================
// Vale aqui a mesma regra de `core/entity`: quem consome declara a FATIA MÍNIMA de que precisa, com `Pick`, em
// vez de receber a declaração inteira. O alto contraste quer `Pick<GameDeclaration, 'roleAt'>` e nada mais; o
// HUD quer `'objective'`. Trocar 23 visões estreitas por uma interface gorda destruiria a testabilidade que o
// projeto tem hoje — todo fixture passaria a inventar campos que o módulo não usa.
//
// ========================= O QUE TEM EVIDÊNCIA E O QUE AINDA NÃO TEM =========================
// Cinco campos nasceram de um consumidor REAL que hoje adivinha (marcados abaixo com "hoje quem adivinha").
// DOIS não têm consumidor no código ainda — `tick` e `Announcement` — e estão aqui porque o ADR-0027 os nomeia
// como o que decide varredura e WCAG 2.2.1. Estão marcados. Enquanto nenhum módulo os ler, são hipótese, e o
// ADR-0030 registra que "o contrato basta" só vira resultado quando DOIS presets existirem.

/* ===================== 3 · NOME FALÁVEL ===================== */
//
// Vem primeiro porque os outros campos o usam. E é o campo que mais se subestima: sem nome não há leitor de
// tela E NÃO HÁ LIBRAS, porque `vlibrasSay` traduz TEXTO — o mesmo dado serve às duas saídas, e é por isso que
// o ADR-0027 diz que ele é "exigido DUAS vezes".
//
// GÊNERO E PLURAL não são zelo gramatical: em pt-BR a moldura CONCORDA com o conteúdo. "O portão está
// trancado" e "a porta está trancada" são a mesma frase de engine com o mesmo parâmetro, e sem o gênero uma
// das duas sai errada. Quem monta a frase precisa saber, e só o jogo sabe.

/** Gênero gramatical do nome. `n` = neutro/indefinido (o pt-BR usa o masculino como default nesse caso). */
export type Gender = 'm' | 'f' | 'n';

/** Um nome que pode ser FALADO (leitor de tela) e SINALIZADO (Libras, que traduz o mesmo texto). */
export interface Speakable {
  /** O nome, na língua da interface. Conteúdo de currículo NÃO se traduz — ver o pilar 3 do ADR-0010. */
  readonly text: string;
  readonly gender: Gender;
  readonly plural: boolean;
}

/* ===================== 1 · TOPOLOGIA DO ESPAÇO NAVEGÁVEL ===================== */
//
// COM MÉTRICA, e a métrica é o ponto: sem ela não existe "mais perto", e sem "mais perto" não existe sonar.
// Hoje quem adivinha: `platform/audio-nav`, que pede `tileAt`, `solidAt`, `BOX` e `TILE` para calcular
// distância — seis coisas de plataforma para responder "qual alvo está mais perto e de que lado".
//
// As três formas cobrem o catálogo do ADR-0027: GRADE (Sokoban, tabuleiro, cela Braille), CONTÍNUO (plataforma,
// top-down, corrida) e LISTA ORDENADA (quiz, menu, escolha múltipla) — onde não há espaço nenhum, só ordem.

export type Topology =
  /** Grade discreta. A distância é em CÉLULAS, e vizinhança é adjacência. */
  | { readonly kind: 'grid'; readonly cols: number; readonly rows: number }
  /** Espaço contínuo. A distância é em UNIDADES do mundo; `unit` diz quanto vale um "passo" para quem narra. */
  | { readonly kind: 'continuous'; readonly width: number; readonly height: number; readonly unit: number }
  /** Sem espaço: uma lista ORDENADA de alvos. A distância é a diferença de índice. */
  | { readonly kind: 'hotspots'; readonly order: readonly string[] };

/** Uma posição, na métrica da topologia declarada. Em `hotspots`, `x` é o índice e `y` é ignorado. */
export interface Spot { readonly x: number; readonly y: number }

/* ===================== 2 · PAPEL SEMÂNTICO ===================== */
//
// POR CÉLULA OU ENTIDADE, e DESACOPLADO DE COR E SPRITE — é essa separação que faz o color-blocking existir.
// Hoje quem adivinha: `game/tile-roles.roleOf`, quatro linhas mapeando números de tile, das quais TODO o alto
// contraste depende. Elas não estão erradas; são verdade DESTE mapa, e o ADR-0027 chama isso de "o acoplamento
// nº 1 da base".
//
// `structure` não é "sem papel": é o papel de ser cenário. A diferença importa — o alto contraste PRECISA saber
// que uma parede é parede para deixá-la no cinza, em vez de não saber nada sobre ela.

export type Role =
  | 'hazard'     // machuca ao encostar
  | 'climb'      // muda-se de altura interagindo com isto
  | 'water'      // atravessa-se nadando
  | 'goal'       // o que a rodada pede
  | 'gate'       // barra até uma condição
  | 'key'        // satisfaz um `gate`
  | 'structure'  // cenário: chão, parede, o que sustenta
  | 'free';      // atravessável e sem significado próprio

/* ===================== 4 · FOCO ===================== */
//
// QUEM tem o foco e PARA ONDE aponta. Hoje quem adivinha: `caneProbe` lê `pl.facing` e `BOX.w / 2`; a bengala
// bate à frente, e "à frente" num jogo de grade são oito direções, num quiz é o item seguinte da lista.
//
// `heading` é oito direções mais `none` porque é o que cobre grade e contínuo sem inventar ângulo: um top-down
// anda em diagonal, uma plataforma só em 'e'/'w', e um quiz não aponta para lugar nenhum.

export type Heading = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' | 'none';

export interface Focus {
  /** Quem está com o foco. Um id do jogo — a engine não o interpreta, só o carrega. */
  readonly id: string;
  readonly at: Spot;
  readonly heading: Heading;
}

/* ===================== 5 · OBJETIVO E ALVO ===================== */
//
// Hoje quem adivinha: `ui/hud`, com `vphudHtml(coinTarget)` — o exemplo que o próprio ADR-0027 usa para
// perguntar se a fronteira está certa. Um jogo sem moedas não tem o que passar ali.
//
// `have`/`need` em vez de uma frase pronta: é o que deixa a MOLDURA traduzir ("{have} de {need}") enquanto o
// NOME atravessa — a mesma regra que o pilar 3 aplica a currículo.
//
// ========================= O CAMPO TEM DUAS METADES, E A PRIMEIRA VERSÃO SÓ TINHA UMA =========================
// O ADR-0027 chama este campo de "objetivo E ALVO". Escrevi só o objetivo — quanto de quanto —, e a segunda
// metade só cobrou quando o SONAR tentou usar o contrato: ele pergunta "qual alvo está mais perto e de que
// lado", e `Objective` não sabe ONDE nada está. Um contador não localiza nada.
//
// `targetsOf` é a metade que faltava. Ela é uma FUNÇÃO e devolve posições, não uma varredura do mapa, e isso
// é o ponto: `roleAt` diz o que há num ponto, mas num espaço CONTÍNUO não há como enumerar os pontos, e num
// mapa grande enumerar seria caro por quadro. Quem sabe onde estão os alvos é o jogo — sempre foi ele que
// mantinha essa lista — e o que muda é que ele passa a ENTREGÁ-LA em vez de a engine ir buscá-la num array
// de moedas com dono e flag de coletada.

export interface Objective {
  /** O que se está juntando/resolvendo: "moedas", "palavras", "contas". */
  readonly name: Speakable;
  readonly have: number;
  readonly need: number;
}

/* ===================== 6 · DE QUEM É O TURNO ===================== */
//
// ⚠️ SEM CONSUMIDOR NO CÓDIGO AINDA. Está aqui porque o ADR-0027 o nomeia como o bit que separa Sokoban de
// Snake e que decide se VARREDURA e a WCAG 2.2.1 (Timing Adjustable) se aplicam: com o turno do jogador, o
// tempo não pressiona e a varredura pode esperar; com o turno do relógio, ela precisa acompanhar.
// Enquanto nada ler isto, é hipótese — e o ADR-0030 diz que só dois presets tornam o contrato um resultado.

export type TickOwner = 'player' | 'clock';

/* ===================== 7 · EVENTO CONTRA ESTADO ===================== */
//
// ⚠️ SEM CONSUMIDOR DIRETO AINDA, mas com uma metade já implementada: `core/a11y-sr` tem `srSay` (educado) e
// `srAlert` (assertivo), e a distinção que falta é a terceira — o ESTADO, que não se anuncia e se CONSULTA.
//
// Um estado é verdade até mudar e responde "o que é isto?" a qualquer momento (`aria-label`). Um evento
// aconteceu e precisa ser dito UMA vez (`aria-live`). Confundi-los produz os dois defeitos clássicos: um
// estado anunciado a cada quadro vira tagarelice, e um evento só consultável nunca é notado.

export type Announcement =
  | { readonly kind: 'state'; readonly name: Speakable }
  | { readonly kind: 'event'; readonly name: Speakable; readonly urgent: boolean };

/* ===================== 8 · O MUNDO ===================== */
//
// QUAL ELEMENTO É O MUNDO DESTE JOGO. Campo novo em 2026-09-06, e o defeito que ele conserta é o mais grave
// que a pilha de acessibilidade já teve.
//
// ========================= O DEFEITO, MEDIDO =========================
// `render/viz-setters.alcanceDoModo` dá às nove simulações de empatia o alcance `mundo`, e a raiz implementa
// `mundo` como a canvas do PixiJS, limpando o filtro no `#dom-layer`. O RACIOCÍNIO ESTÁ CERTO e está escrito:
// o menu é o instrumento de SAIR da simulação, e uma cegueira que apagasse o menu de pausa trancaria a
// criança dentro dela (issue #82).
//
// ⚠️ NUM JOGO CUJO CONTEÚDO VISÍVEL É DOM, ISSO SE INVERTE. `blind` (`brightness(0)`) apaga uma canvas que
// ninguém está a olhar e deixa os números perfeitamente legíveis: a simulação sai ao contrário, e um adulto é
// informado de que sentiu algo que não sentiu. Num produto cuja razão de existir é não fazer afirmação falsa
// sobre acessibilidade, é a pior classe de defeito possível.
//
// ⚠️ E A SOLUÇÃO ÓBVIA ESTÁ ERRADA, o que foi medido antes de escolher: «a engine passa a filtrar
// `#game-region`» conserta o `game-15puzzle` e QUEBRA o jogo próprio da engine, porque no `app/index.html` o
// `#dom-layer` está DENTRO do `#game-region` e o filtro CSS herda — a pausa apagaria junto. A mesma linha,
// resultados opostos, porque a forma do DOM não é garantida pelo contrato. Por isso é DECLARAÇÃO.

/**
 * O que a criança vê como sendo o jogo.
 *
 * ⚠️ `none` NÃO É UM PADRÃO, É UMA ESCOLHA ESCRITA. Existe para atividade sem espaço — uma tela de pintura
 * livre, autoria, um formulário —, onde não há «mundo» para simular nem alvo para sonar. O Dev nomeou o caso:
 * *"atividades como paint não são exatamente jogos, mas podem ser feitas com a engine e sonar não vai
 * funcionar muito bem"*.
 *
 * ⚠️ E O QUE ELE NÃO PODE SER É O QUE ACONTECE QUANDO ALGUÉM ESQUECE. Um jogo de DOM puro não é «um jogo onde
 * empatia não faz sentido»: o xadrez às cegas é a prova empírica de que faz. `none` é para quem DECLARA que
 * não tem espaço, e a ausência do campo é reprovada — hoje as duas coisas produzem o mesmo silêncio.
 */
export type WorldScope =
  /** O seletor do elemento que é o mundo. A engine aplica ali o que é do mundo, e só ali. */
  | { readonly kind: 'element'; readonly selector: string }
  /** Sem espaço. Empatia e sonar NÃO são oferecidos — e a tela de seleção diz isso antes de a criança começar. */
  | { readonly kind: 'none' };

/* ===================== A DECLARAÇÃO ===================== */

/**
 * O que um jogo entrega à engine. `tick` é dado; TODO O RESTO é função, porque a resposta muda com a posição,
 * o jogador e o instante.
 *
 * ⚠️ NÃO IMPORTE ISTO INTEIRO num módulo consumidor. Use `Pick<GameDeclaration, 'roleAt'>` e afins — a regra é
 * a de `core/entity`, e é o que mantém os fixtures de teste pequenos.
 */
export interface GameDeclaration {
  /**
   * A forma do espaço AGORA.
   *
   * ⚠️ ERA UM VALOR ATÉ 2026-09-06, e a assimetria já tinha sido remendada em dois lugares antes de alguém a
   * nomear: a porta do sonar sempre pediu `topology: () => Topology` (`platform/audio-sonar.ts`), e
   * `boot/create-game` fazia a ponte com `() => o.declaration.topology` — uma função que devolve uma
   * constante. O `game-15puzzle` (3×3/4×4/5×5) precisou de um getter para caber no tipo, e um getter que
   * satisfaz uma interface é COINCIDÊNCIA DO TypeScript, não contrato: nada avisava o próximo autor de que
   * era o esperado, e `conformanceProblems` lia uma vez só — quem memorizasse a topologia ficava defasado
   * em silêncio. Remendo que aparece duas vezes é o contrato a pedir para mudar. ADR-0084.
   */
  topology(): Topology;
  /**
   * QUAL ELEMENTO É O MUNDO. Ver o bloco 8 acima para o defeito que este campo conserta.
   *
   * ⚠️ OBRIGATÓRIO, e a obrigatoriedade é a decisão. A proposta original era um campo opcional com padrão;
   * o Dev recusou, e a razão é o BLINDFOLD CHESS: xadrez às cegas existe, logo um jogo de DOM puro não é um
   * jogo onde empatia não faz sentido — é um jogo onde ela exige mais de quem o programa. Um padrão deixaria
   * o esquecimento passar como se fosse escolha.
   */
  world(): WorldScope;
  readonly tick: TickOwner;
  /** O papel do que está em `at`. É o campo 2, e é o que substitui `roleOf`. */
  roleAt(at: Spot): Role;
  /** Como se chama o que está em `at`. Sem isto não há leitor de tela nem Libras. */
  nameAt(at: Spot): Speakable | null;
  /** Quem tem o foco agora, e para onde aponta. `null` = ninguém (menu fechado, rodada não começou). */
  focusOf(playerIndex: number): Focus | null;
  /** O que a rodada pede deste jogador. */
  objectiveOf(playerIndex: number): Objective;
  /**
   * ONDE estão os alvos ainda válidos deste jogador — a segunda metade do campo 5.
   *
   * É o que substitui o `getCoins()` do sonar: em vez de a engine varrer um array de moedas e filtrar por
   * `taken`/`owner`, o jogo devolve os pontos que ainda contam para ESTE jogador. Um quiz devolve o índice da
   * pergunta em aberto; uma plataforma devolve as moedas não coletadas; um Sokoban devolve as caixas fora do
   * lugar. A engine só compara distâncias, e é por isso que o sonar passa a servir a qualquer gênero.
   *
   * Vazio é resposta legítima e significa "não há para onde apontar" — não é erro.
   */
  targetsOf(playerIndex: number): readonly Spot[];
}

/* ===================== CONFORMIDADE ===================== */

/**
 * Uma declaração é bem-formada? Devolve a lista de problemas — VAZIA quer dizer conforme.
 *
 * Existe porque um preset é uma promessa, e promessa sem verificação é comentário. O ADR-0030 diz que um
 * pacote de gênero "ou satisfaz os sete campos ou não satisfaz"; isto é o "ou não".
 *
 * Confere FORMA, não verdade: que a topologia tenha medida positiva, que as funções existam, que o objetivo
 * não peça um alvo impossível. Não tem como conferir se `roleAt` devolve o papel CERTO — isso é o teste do
 * preset, não deste módulo.
 */
export function conformanceProblems(d: Partial<GameDeclaration> | null | undefined): string[] {
  const p: string[] = [];
  if (!d) return ['declaration missing'];

  // ⚠️ DUAS FALHAS DIFERENTES, E ELAS PRECISAM DE DUAS MENSAGENS. `topology` ausente é um campo que ninguém
  // escreveu; `topology` que não é função é o campo escrito à moda antiga — um VALOR, que passava no
  // TypeScript de quem não recompilou e morreria em produção com "topology is not a function". Dizer só
  // "ausente" mandaria o autor procurar um campo que está lá, à vista.
  const t = typeof d.topology === 'function' ? d.topology() : undefined;
  if (d.topology === undefined || d.topology === null) p.push('topology: missing');
  else if (typeof d.topology !== 'function') p.push('topology: must be a FUNCTION (it was a value until ADR-0084)');
  else if (!t) p.push('topology: the function returned nothing');
  else if (t.kind === 'grid') {
    if (!(t.cols > 0) || !(t.rows > 0)) p.push('topology.grid: cols and rows must be positive');
  } else if (t.kind === 'continuous') {
    if (!(t.width > 0) || !(t.height > 0)) p.push('topology.continuous: width and height must be positive');
    // `unit` é o que dá MÉTRICA a um espaço contínuo: sem ela, "a dois passos" não tem como ser dito.
    if (!(t.unit > 0)) p.push('topology.continuous: unit must be positive (it is the metric the narration counts in)');
  } else if (t.kind === 'hotspots') {
    if (!t.order?.length) p.push('topology.hotspots: order is empty - there is nowhere to navigate');
    else if (new Set(t.order).size !== t.order.length) p.push('topology.hotspots: order has a repeated id');
  } else p.push('topology: unknown kind');

  // ⚠️ TRÊS FALHAS DISTINTAS, e a terceira é a que este campo existe para tornar impossível: um jogo cujo
  // mundo NÃO foi declarado. Antes deste campo, esquecer e escolher «não tenho espaço» produziam o mesmo
  // silêncio — e o silêncio era resolvido pela engine a adivinhar que o mundo é a canvas.
  if (d.world === undefined || d.world === null) {
    p.push('world: missing - declare the element that IS the game, or {kind:"none"} if it has no space');
  } else if (typeof d.world !== 'function') {
    p.push('world: must be a FUNCTION');
  } else {
    const w = d.world();
    if (!w) p.push('world: the function returned nothing');
    else if (w.kind === 'element') {
      if (!w.selector || !w.selector.trim()) p.push('world: kind "element" needs a non-empty selector');
    } else if (w.kind !== 'none') p.push('world: unknown kind');
  }

  if (d.tick !== 'player' && d.tick !== 'clock') p.push('tick: must be "player" or "clock"');

  for (const f of ['roleAt', 'nameAt', 'focusOf', 'objectiveOf', 'targetsOf'] as const) {
    if (typeof d[f] !== 'function') p.push(`${f}: missing`);
  }
  return p;
}

/** Um nome falável bem-formado? Texto vazio é o defeito silencioso: o leitor de tela simplesmente cala. */
export function speakableProblems(s: Speakable | null | undefined): string[] {
  if (!s) return ['name missing'];
  const p: string[] = [];
  if (!s.text.trim()) p.push('text: empty - the screen reader would fall silent');
  if (s.gender !== 'm' && s.gender !== 'f' && s.gender !== 'n') p.push('gender: must be m, f or n');
  if (typeof s.plural !== 'boolean') p.push('plural: must be a boolean');
  return p;
}

/** Distância entre dois pontos NA MÉTRICA declarada. É o que o sonar precisa e hoje calcula em pixels. */
export function distance(t: Topology, a: Spot, b: Spot): number {
  // Grade: passos de rei (Chebyshev) — numa grade, a diagonal custa um passo, e é assim que quem joga conta.
  if (t.kind === 'grid') return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  // Lista: a distância é quantos itens separam um do outro.
  if (t.kind === 'hotspots') return Math.abs(a.x - b.x);
  // Contínuo: euclidiana, dividida pela unidade — o resultado é "quantos passos", não "quantos pixels".
  return Math.hypot(a.x - b.x, a.y - b.y) / t.unit;
}
