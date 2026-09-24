// SPDX-License-Identifier: AGPL-3.0-or-later
// core/contract — OS SETE CAMPOS. A interface que o ADR-0030 escolheu como o eixo da engine.
//
// ⚠️ ESTE FICHEIRO NÃO TINHA IMPORT NENHUM, e o único que ganhou é `import type` — apagado na compilação, logo
// o módulo publicado continua sem dependência de execução. O que entra é o VOCABULÁRIO das catorze posições
// (ADR-0074), e ele tinha de entrar: um campo que fala de mapeamento e escrevesse as suas próprias chaves
// seria a segunda cópia da união que o `core/actions` existe para ser a primeira.
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

import type { Action } from './actions.js';

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

/**
 * COMO SE CONTA UM PASSO — e é isto que decide a métrica, que não é a mesma em todo tabuleiro.
 *
 * ⚠️ A grade tinha UMA métrica fixa (Chebyshev), com a razão escrita ao lado: *"numa grade, a diagonal custa um
 * passo, e é assim que quem joga conta"*. Verdade onde a diagonal é legal. **Falsa num quebra-cabeça
 * deslizante**, onde nada anda na diagonal: uma peça duas à direita e duas abaixo está a 2 por Chebyshev e a
 * QUATRO movimentos de distância. O sonar sub-relatava até 2× — e sub-relatar distância a quem não vê a tela
 * não é imprecisão, é mandar a criança para o lado errado com confiança.
 *
 * `grid` nunca foi UMA coisa. Quem declara a grade declara também como se anda nela.
 */
export type MoveRule =
  | 'orthogonal'  // L¹ (Manhattan) — quebra-cabeça deslizante, Sokoban, torre. A diagonal não existe.
  | 'diagonal'    // L∞ (Chebyshev) — rei do xadrez, top-down de 8 direções. A diagonal custa um passo.
  | 'free';       // L² (euclidiana) — espaço contínuo, onde não há passo discreto nenhum.

/**
 * EM QUE PALAVRAS SE DIZ UMA DIREÇÃO. Não é preferência de quem ouve: é propriedade do ESPAÇO do jogo.
 *
 *   `compass`  norte · sul · leste · oeste (+ zênite e nadir) — tabuleiro, top-down, mapa, 3D
 *   `clock`    «às 2 horas», «às 10 horas» — PLATAFORMA 2D, vista lateral
 *
 * ⚠️ Num jogo de plataforma, norte e sul não querem dizer nada: a criança não está a olhar um mapa, está a
 * olhar de lado. O relógio é o referencial que essa vista já usa, e dá 12 posições onde a rosa dá 8.
 *
 * ⚠️ E O RELÓGIO PRESSUPÕE LER RELÓGIO ANALÓGICO, num público que inclui alfabetização. Não é motivo para o
 * recusar — é motivo para o rótulo FALADO ser testado com criança (issue #7) antes de se declarar bom.
 */
export type Frame = 'compass' | 'clock';

export type Topology =
  /**
   * Grade discreta. A distância é em CÉLULAS, e a métrica sai de `move`.
   * `size` é `[colunas, linhas]` ou `[colunas, linhas, camadas]`.
   */
  | { readonly kind: 'grid'; readonly size: readonly number[]; readonly move: MoveRule; readonly frame: Frame }
  /**
   * Espaço contínuo. A distância é em UNIDADES do mundo; `unit` diz quanto vale um "passo" para quem narra.
   * `size` é `[largura, altura]` ou `[largura, altura, profundidade]`.
   */
  | { readonly kind: 'continuous'; readonly size: readonly number[]; readonly unit: number; readonly move: MoveRule; readonly frame: Frame }
  /** Sem espaço: uma lista ORDENADA de alvos. A distância é a diferença de índice, e não há direção. */
  | { readonly kind: 'hotspots'; readonly order: readonly string[] };

/**
 * Uma posição, na métrica da topologia declarada. Em `hotspots`, `x` é o índice e `y` é ignorado.
 *
 * ⚠️ ASSIMETRIA DELIBERADA COM `size`, e vale dizer por quê. A EXTENSÃO é um vetor porque a dimensão varia e
 * `size.length` é o único lugar onde ela mora — sem isso, "tem profundidade?" viraria `depth !== undefined`
 * espalhado por cada consumidor. O PONTO tem eixos com nome porque é lido em código a toda hora: `alvo.at.x`
 * diz o que é, `alvo.at[0]` obriga a lembrar. Dimensão é 2 ou 3 e a conformidade recusa o resto, o que fecha
 * a assimetria: não há `size` que `Spot` não consiga representar.
 */
export interface Spot { readonly x: number; readonly y: number; readonly z?: number }

/** A dimensão que a topologia declara. `hotspots` não tem espaço, logo não tem dimensão. */
export function dimension(t: Topology): number { return t.kind === 'hotspots' ? 0 : t.size.length; }

/** O eixo `i` de um ponto, para quem percorre dimensões em vez de as nomear. */
function axis(s: Spot, i: number): number { return i === 0 ? s.x : i === 1 ? s.y : (s.z ?? 0); }

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

/**
 * ⚠️ `zenith` E `nadir` ENTRARAM PORQUE `up`/`down` JÁ QUEREM DIZER DUAS COISAS. `ACTIONS` (core/actions) tem
 * `up` e `down` como AÇÕES DE CONTROLE — o que a criança carrega —, e o eixo vertical do ESPAÇO é outra coisa
 * inteiramente. Enquanto o mundo era plano a ambiguidade não custava nada; num espaço de três dimensões
 * custaria o pior tipo de defeito, o que se lê certo e faz outra coisa. Palavras próprias, antes de o 3D chegar.
 */
export type Heading = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' | 'zenith' | 'nadir' | 'none';

/**
 * PARA ONDE FICA UM PONTO VISTO DE OUTRO, já no referencial que a topologia declara.
 *
 * ⚠️ NÃO É O `heading` DO FOCO, e a diferença é o defeito que isto conserta. `Focus.heading` é para onde a
 * criança está VIRADA; isto é para onde está o ALVO. O sonar precisa do segundo e calculava-o à mão a partir
 * de `x` cru, com zona morta de ±4, dizendo `left`/`right`/`ahead` — três palavras onde o contrato tem oito, e
 * MISTURANDO REFERENCIAIS: *esquerda/direita* é relativo à tela, *à frente* é relativo ao corpo. Uma criança
 * cega que ouve as duas na mesma frase não tem como saber de qual origem cada uma fala.
 */
export type Bearing =
  | { readonly kind: 'compass'; readonly heading: Heading }
  | { readonly kind: 'clock'; readonly hour: number }  // 1..12, como no mostrador
  | { readonly kind: 'none' };                          // mesmo lugar, ou lista sem espaço

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
// `render/viz-setters.reachOfMode` dá às nove simulações de empatia o alcance `mundo`, e a raiz implementa
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
  /**
   * QUANTAS POSIÇÕES ESTE JOGO PRECISA DE SEGURAR AO MESMO TEMPO. Correr + andar + pular são TRÊS; um quiz é
   * UM. (ADR-0104 §A.)
   *
   * ⚠️ É UM EIXO DIFERENTE DE «QUANTAS AÇÕES», e é por não serem o mesmo que existia um ponto cego onde o
   * aviso nunca disparava. Medido: a plataforma declara NOVE ações e o controle de tela tem NOVE lugares,
   * então o `reach().ok` era verdadeiro e o cartão da #112 nunca aparecia — mas correr, andar e pular ao
   * mesmo tempo são três dedos, e num telemóvel de dois a criança simplesmente não consegue, sem nada em
   * lado nenhum a dizer porquê. Alcançar uma ação e segurá-la junto com outra são perguntas distintas.
   *
   * ⚠️ OBRIGATÓRIO, e a obrigatoriedade É a decisão, na frase do Dev: «os 300 jogos precisam declarar sim!
   * Não declarar é ter a acessibilidade programada no controle pro sorte». Um campo opcional é respondido
   * por SILÊNCIO, e aqui o silêncio decide pela criança — decide-o quem não pensou no assunto. Trezentos
   * jogos a responder deliberadamente é o custo; acessibilidade por sorte é a alternativa.
   *
   * FUNÇÃO e não valor, pela mesma razão que a `topology`: um jogo com fases troca de exigência entre elas —
   * uma fase a pé pede três, a mesma fase num veículo pode pedir uma. Um valor memorizado ficaria defasado
   * em silêncio, que é o defeito que o ADR-0084 nomeou.
   */
  holdsAtOnce(): number;
  /**
   * ESTE JOGO SEGURA ALGUMA TECLA? — e a resposta não é derivável de mais nada. (ADR-0115.)
   *
   * 🔴 A ALTERNÂNCIA EXISTE PARA UMA CRIANÇA CONCRETA: quem não consegue MANTER uma tecla premida carrega uma
   * vez para andar e outra para parar. Num jogo onde nada se segura — um quiz, um tabuleiro, um puzzle de
   * peças — não há nada a travar, e o controle passa a ser uma opção que **não faz nada**. A criança abre o
   * menu de acessibilidade, liga o ajuste de que depende, e não acontece nada: ela aprende que o ajuste está
   * partido. É o botão morto que o ADR-0106 §5 proíbe.
   *
   * ⚠️ E O `holdsAtOnce` ACIMA NÃO RESPONDE ISTO, o que foi o achado que obrigou a este campo: ele conta
   * POSIÇÕES SIMULTÂNEAS e recusa zero, porque zero faria a aritmética do alcance passar por vacuidade. O
   * `consumer-quiz` declara **1 sem segurar coisa nenhuma**. «Um de cada vez» e «um SEGURADO» são o mesmo
   * número, e toda decisão a jusante vinha a ler um número que responde a outra pergunta.
   *
   * ⚠️ OBRIGATÓRIO, e a obrigatoriedade É a decisão — a mesma do `holdsAtOnce`, pela mesma frase do Dev:
   * «não declarar é ter a acessibilidade programada no controle pro sorte». Um campo opcional faria um jogo
   * que ESQUECE a linha perder a alternância em silêncio, e quem paga é a criança com dificuldade motora.
   *
   * 📌 FUNÇÃO e não valor, pelo ADR-0084: um jogo muda de exigência entre fases. A pé segura-se uma direcção;
   * o mesmo jogo dentro de um veículo pode não segurar nada.
   */
  holdsKeys(): boolean;
  /**
   * ESTE JOGO PRECISA DE UM PONTEIRO — posição contínua? (ADR-0112.)
   *
   * Um jogo de desenho precisa; um quiz não. Declarar faz um aparelho sem ponteiro RECUSAR-SE antes de a
   * criança começar, em vez de ela descobrir a meio do primeiro traço.
   *
   * ⚠️ OPCIONAL, E A DIFERENÇA PARA O `holdsAtOnce` LOGO ACIMA É DELIBERADA — copiar a obrigatoriedade dele
   * seria aplicar uma regra cuja premissa não se sustenta aqui. O `holdsAtOnce` é obrigatório porque não tem
   * padrão seguro E porque falha INVISIVELMENTE a quem escreve o jogo: ele tem teclado completo, o jogo corre,
   * e quem descobre o defeito é a criança no telemóvel de dois dedos. Este tem padrão seguro (`false`) e falha
   * VISIVELMENTE — um jogo de desenho que se esqueça de o declarar é inoperável no próprio aparelho de quem o
   * escreve, porque ele também precisaria do ponteiro para o experimentar.
   *
   * Obrigar trezentos jogos a escrever `needsPointer: () => false` cobraria o preço do `holdsAtOnce` sem o
   * motivo dele.
   *
   * FUNÇÃO e não valor, pela mesma razão das outras: uma actividade pode desenhar numa fase e não noutra.
   */
  needsPointer?(): boolean;
  /**
   * O MAPEAMENTO DE TECLADO QUE ESTE JOGO QUER — por número de jogadores e por assento (ADR-0115).
   *
   * A precedência é a que o registo pede, e ela cabe entre duas linhas que já existiam no `input/keyboard`:
   * **fábrica da engine → padrão do JOGO → remapeamento da CRIANÇA.** Devolver `null` (ou não declarar) deixa
   * a fábrica da engine intacta, que é o comportamento de sempre.
   *
   * PARCIAL de propósito: um jogo que só queira trocar o `action1` troca o `action1`. A fusão já existe — é o
   * `Object.assign` que sobrepõe o dado guardado —, então esta é mais uma camada no mesmo sítio e não uma
   * segunda forma de fundir.
   *
   * ⚠️ OPCIONAL, e aqui, ao contrário do `seguraTeclas`, o silêncio tem um lado seguro: sem declaração o jogo
   * fica com a fábrica da engine, que é jogável e é o que ele já tem hoje. Não há lado errado na ausência.
   *
   * ⚠️ E LEVA O ASSENTO porque o teclado de dois jogadores não é o de um: as setas mudam de dono, e um padrão
   * que não soubesse o assento daria as mesmas teclas a duas crianças. `players` é 1, 2, 3 ou 4; `seat` é
   * o índice dentro desse arranjo.
   *
   * 📌 O irmão do CONTROLE é o campo logo abaixo, e chegou um commit depois: o obstáculo era que o assento
   * ainda não se conhecia no ponto em que a tabela de botões é lida, e a saída foi subi-lo no laço.
   */
  keyboardMapping?(players: number, seat: number): Partial<Record<Action, readonly string[] | null>> | null;
  /**
   * O MAPEAMENTO DE BOTÕES QUE ESTE JOGO QUER NO CONTROLE — mesma pergunta, outro aparelho (ADR-0115).
   *
   * Índices de botão da Gamepad API «standard», parciais: `{ action1: 3 }` troca só essa. `null` num botão diz
   * «esta posição não existe neste jogo», que é diferente de a deixar na fábrica.
   *
   * ⚠️ A PRECEDÊNCIA TEM UMA DIFERENÇA DE SÍTIO QUE VALE SABER: no teclado, o que a criança remapeou é uma
   * camada POR CIMA desta; no controle, o mapa que ela gravou no assistente é um RAMO inteiro — se ele existe,
   * este padrão não é consultado. Nos dois casos ela ganha, que é o que importa.
   *
   * 📌 E leva o assento pela mesma razão do teclado, ainda que por um caminho diferente: dois controles são
   * dois aparelhos, mas o JOGO pode querer arranjos distintos por assento (o guarda-redes e o atacante não
   * fazem o mesmo).
   */
  padMapping?(players: number, seat: number): Partial<Record<Action, number | null>> | null;
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
 * Os problemas de UM campo declarado. VAZIA quer dizer que aquele campo está bem-formado.
 *
 * 🎯 UMA VERIFICAÇÃO POR CAMPO, E UMA TABELA A CHAMÁ-LAS, e isto não é arrumação: enquanto as dez verificações
 * viviam numa função só, ela tinha 53 caminhos de decisão contra o tecto 10 de McCabe (ADR-0221) — e a régua não
 * estava a exagerar, porque ninguém conseguia ler «o que o contrato exige do campo X» sem percorrer os outros nove.
 * Acrescentar um campo ao contrato passa a ser acrescentar uma LINHA à tabela, que é a forma que esta casa já usa
 * para o glifo de uma tecla, a aresta de uma ação, a regra de um ícone e a situação de um quadro.
 */
type FieldCheck = (d: Partial<GameDeclaration>) => string[];

function topologyProblems(d: Partial<GameDeclaration>): string[] {
  // ⚠️ DUAS FALHAS DIFERENTES, E ELAS PRECISAM DE DUAS MENSAGENS. `topology` ausente é um campo que ninguém
  // escreveu; `topology` que não é função é o campo escrito à moda antiga — um VALOR, que passava no
  // TypeScript de quem não recompilou e morreria em produção com "topology is not a function". Dizer só
  // "ausente" mandaria o autor procurar um campo que está lá, à vista.
  // Each answer excludes the others, so each one returns: the order is the rule, and the space is asked for only once it
  // is known to be a function.
  if (d.topology === undefined || d.topology === null) return ['topology: missing'];
  if (typeof d.topology !== 'function') return ['topology: must be a FUNCTION (it was a value until ADR-0084)'];
  const t = d.topology();
  if (!t) return ['topology: the function returned nothing'];
  if (t.kind === 'grid' || t.kind === 'continuous') return [...sizeProblems(t), ...metricProblems(t), ...frameProblems(t)];
  if (t.kind === 'hotspots') return hotspotProblems(t);
  return ['topology: unknown kind'];
}

/**
 * 🎯 TRÊS PERGUNTAS DIFERENTES A UM ESPAÇO MEDIDO, e separá-las foi a catraca a apontar o corte certo em vez de
 * lhe ser pedida uma excepção: com as três juntas, a `topologyProblems` ficava em 22 contra o tecto 10 de McCabe.
 * São mesmo três — QUÃO GRANDE é o espaço, EM QUE UNIDADES a distância se conta, e EM QUE PALAVRAS a direção se
 * diz — e cada uma tem uma criança do outro lado.
 */
type MeasuredSpace = Extract<Topology, { kind: 'grid' | 'continuous' }>;

// ⚠️ A DIMENSÃO É `size.length`, e é por isso que ela é conferida ANTES de tudo: um `size` vazio ou de
// quatro entradas não é uma medida ruim, é um espaço que `Spot` não sabe representar — e o erro apareceria
// longe daqui, como um eixo simplesmente ignorado.
function sizeProblems(t: MeasuredSpace): string[] {
  if (!Array.isArray(t.size) || t.size.length < 2 || t.size.length > 3) {
    return ['topology.size: must be [w, h] or [w, h, d] - dimension is 2 or 3, and it is size.length'];
  }
  return !t.size.every((n) => n > 0) ? ['topology.size: every extent must be positive'] : [];
}

function metricProblems(t: MeasuredSpace): string[] {
  const p: string[] = [];
  // `move` é o que decide a métrica. Ausente, a distância seria adivinhada — e adivinhar Chebyshev num
  // quebra-cabeça deslizante sub-relata até 2×, que foi o achado §3 do ADR-0080.
  if (t.move !== 'orthogonal' && t.move !== 'diagonal' && t.move !== 'free') {
    p.push('topology.move: must be "orthogonal" (L1), "diagonal" (L8/Chebyshev) or "free" (L2) - it is the metric the sonar counts in');
  }
  // `unit` é o que dá MÉTRICA a um espaço contínuo: sem ela, "a dois passos" não tem como ser dito.
  if (t.kind === 'continuous' && !(t.unit > 0)) {
    p.push('topology.continuous: unit must be positive (it is the metric the narration counts in)');
  }
  return p;
}

// `frame` é em que PALAVRAS a direção é dita. Sem ele a engine escolheria pela criança, e num jogo de
// plataforma escolheria mal: norte e sul não querem dizer nada numa vista lateral.
function frameProblems(t: MeasuredSpace): string[] {
  return t.frame !== 'compass' && t.frame !== 'clock'
    ? ['topology.frame: must be "compass" (board, top-down, map, 3D) or "clock" (2D side view)']
    : [];
}

function hotspotProblems(t: Extract<Topology, { kind: 'hotspots' }>): string[] {
  if (!t.order?.length) return ['topology.hotspots: order is empty - there is nowhere to navigate'];
  return new Set(t.order).size !== t.order.length ? ['topology.hotspots: order has a repeated id'] : [];
}

function worldProblems(d: Partial<GameDeclaration>): string[] {
  // ⚠️ TRÊS FALHAS DISTINTAS, e a terceira é a que este campo existe para tornar impossível: um jogo cujo
  // mundo NÃO foi declarado. Antes deste campo, esquecer e escolher «não tenho espaço» produziam o mesmo
  // silêncio — e o silêncio era resolvido pela engine a adivinhar que o mundo é a canvas.
  if (d.world === undefined || d.world === null) {
    return ['world: missing - declare the element that IS the game, or {kind:"none"} if it has no space'];
  }
  if (typeof d.world !== 'function') return ['world: must be a FUNCTION'];
  const w = d.world();
  if (!w) return ['world: the function returned nothing'];
  if (w.kind === 'element') {
    return !w.selector || !w.selector.trim() ? ['world: kind "element" needs a non-empty selector'] : [];
  }
  return w.kind !== 'none' ? ['world: unknown kind'] : [];
}

function holdsAtOnceProblems(d: Partial<GameDeclaration>): string[] {
  // ⚠️ A MENSAGEM NOMEIA A SAÍDA, como as outras quatro fazem. Um jogo que não declara isto não recebe um
  // padrão — recebe uma frase que diz o que perguntar a si próprio, porque a resposta é do jogo e de mais
  // ninguém. (ADR-0104 §A.)
  if (typeof d.holdsAtOnce !== 'function') {
    // ⚠️ A MENSAGEM NÃO NOMEIA GÊNERO, e o gate de fronteira cobrou-o: a primeira escrita dizia «run+walk+jump
    // is 3, a quiz is 1» e o `engine-boundary` reprovou a palavra «quiz» em linha de CÓDIGO da engine. Ele
    // tinha razão, e a frase ficou melhor: descreve a FORMA da pergunta, que serve aos 300 jogos, em vez de
    // dois exemplos que servem a dois.
    return ['holdsAtOnce: missing - declare how many positions are held AT ONCE (three if three fingers must press together, one if commands arrive one at a time)'];
  }
  const n = d.holdsAtOnce();
  // Zero não é «não usa controle»: um jogo que não segura posição nenhuma não é jogável, e devolver zero
  // faria a aritmética do alcance passar por vacuidade — o mesmo defeito que o `reachable` recusa.
  return !Number.isInteger(n) || n < 1
    ? ['holdsAtOnce: must be an integer >= 1 - a game that holds nothing cannot be played']
    : [];
}

function latchingProblems(d: Partial<GameDeclaration>): string[] {
  // ⚠️ E ESTA É A OUTRA PERGUNTA, que o número acima parecia responder e não responde (ADR-0115). A mensagem
  // diz o que a ausência CUSTA, e não só o que falta: sem ela, um jogo que nada segura oferece um controle de
  // acessibilidade que não faz nada, e um que segura tudo pode não o oferecer a quem depende dele.
  if (typeof d.holdsKeys !== 'function') {
    return ['holdsKeys: missing - declare whether any key is HELD in this game (latching is offered only where something can be held, and a game that holds nothing must not show a control that does nothing)'];
  }
  // Um valor não-booleano seria truthy e ofereceria a alternância a toda a gente — o mesmo defeito
  // silencioso que o `needsPointer` recusa logo abaixo, e pela mesma razão.
  return typeof d.holdsKeys() !== 'boolean'
    ? ['holdsKeys: must return a boolean - a non-boolean is truthy and would offer latching in a game where nothing is held']
    : [];
}

function pointerProblems(d: Partial<GameDeclaration>): string[] {
  // ⚠️ OPCIONAL, MAS NÃO IMPUNE. Ausente é a resposta `false` e não é problema — ver a nota no campo. O que
  // se recusa é declará-lo MAL: um `needsPointer: true` (valor em vez de função) seria sempre verdadeiro por
  // ser um objecto, e um que devolvesse `'sim'` também. Nos dois casos o jogo julgaria ter declarado, o
  // alcance leria uma coisa diferente do que ele quis dizer, e ninguém saberia — que é o defeito silencioso
  // que esta função inteira existe para não deixar acontecer.
  if (d.needsPointer === undefined) return [];
  if (typeof d.needsPointer !== 'function') {
    // ⚠️ MENSAGENS SEM A PALAVRA `as`, e o motivo merece uma linha porque volta a morder: o detector de prosa
    // pt-BR do `engine-i18n` casa palavras funcionais isoladas, e `as` é artigo plural em português. Uma
    // mensagem INGLESA que diga «declare it as …» é contada como texto cru e faz o tecto do módulo subir.
    // O cabeçalho daquele gate já admite a aproximação («senão 'mode' casa 'de'»); reescrever a frase custa
    // nada e afrouxar o detector custaria a razão de ele existir.
    return ['needsPointer: must be a function - write `needsPointer: () => true`, because a game may draw in one phase and not in another'];
  }
  return typeof d.needsPointer() !== 'boolean'
    ? ['needsPointer: must return a boolean - a non-boolean would be truthy and refuse devices this game can actually use']
    : [];
}

/**
 * UM MAPEAMENTO DECLARADO PELO JOGO, seja ele do teclado ou do controle.
 *
 * 🔴 ERA A MESMA VERIFICAÇÃO ESCRITA DUAS VEZES, e as duas cópias não estavam igualmente guardadas: 📏 medido em
 * 2026-09-23, as duas decisões do teclado tinham caso e as duas do pad eram CEGAS — a assimetria da cobertura é
 * como uma duplicata se anuncia, porque uma cópia recebe atenção e a outra é presumida.
 *
 * ⚠️ Aqui um valor em vez de uma função não seria um erro barulhento, seria um mapeamento SILENCIOSAMENTE
 * ignorado — a fábrica da engine ficava, e a criança jogava com um controle que o autor do jogo julga ter
 * mudado. E devolver algo que não é objecto nem `null` atravessaria o `Object.assign` sem escrever nada, que é
 * a mesma ausência com outra roupa.
 */
function mappingProblems(field: string, declared: unknown, example: string, because: string): string[] {
  if (declared === undefined) return [];
  if (typeof declared !== 'function') {
    return [`${field}: must be a function - write \`${field}: ${example}\`, because ${because}`];
  }
  // The names of THIS annotation are mine and were born in English; the field's own (`players`, `seat`) became
  // English with phase 7 of the English plan (ADR-0230).
  const m = (declared as (players: number, seat: number) => unknown)(1, 0);
  return m !== null && (typeof m !== 'object' || Array.isArray(m))
    ? [`${field}: must return an object or null - anything else is merged into nothing, and this game keeps the engine factory while its author believes otherwise`]
    : [];
}

const keyboardMappingProblems: FieldCheck = (d) => mappingProblems(
  'keyboardMapping', d.keyboardMapping,
  '(jogadores, assento) => ({ action1: ["KeyQ"] })',
  'the keyboard of two players is not the keyboard of one',
);

const padMappingProblems: FieldCheck = (d) => mappingProblems(
  'padMapping', d.padMapping,
  '(jogadores, assento) => ({ action1: 3 })',
  'two seats may want different arrangements',
);

const tickProblems: FieldCheck = (d) => (d.tick !== 'player' && d.tick !== 'clock' ? ['tick: must be "player" or "clock"'] : []);

/** As cinco perguntas que a engine faz ao mundo. Ausente é UM problema, e a mensagem diz QUAL falta. */
const READERS = ['roleAt', 'nameAt', 'focusOf', 'objectiveOf', 'targetsOf'] as const;
const readerProblems: FieldCheck = (d) => READERS.filter((f) => typeof d[f] !== 'function').map((f) => `${f}: missing`);

/**
 * 📌 A ORDEM DESTA TABELA É A ORDEM DAS MENSAGENS, e ela importa a quem lê: um autor que escreve um preset recebe
 * os problemas na ordem em que os campos aparecem no contrato, em vez de na ordem em que este ficheiro cresceu.
 */
const FIELD_CHECKS: readonly FieldCheck[] = [
  topologyProblems,
  worldProblems,
  holdsAtOnceProblems,
  latchingProblems,
  pointerProblems,
  keyboardMappingProblems,
  padMappingProblems,
  tickProblems,
  readerProblems,
];

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
  if (!d) return ['declaration missing'];
  return FIELD_CHECKS.flatMap((check) => check(d));
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

/**
 * Distância entre dois pontos NA MÉTRICA declarada — a que o jogo declarou em `move`, e em quantas dimensões
 * ele declarou em `size`. É o que o sonar precisa e antes calculava em pixels.
 *
 * ⚠️ A GRADE ERA SEMPRE CHEBYSHEV, e isso custava até 2× de erro num quebra-cabeça deslizante. As três regras
 * não são gosto: são o que "um passo" significa em cada jogo, e o sonar fala em passos.
 */
export function distance(t: Topology, a: Spot, b: Spot): number {
  // Lista: a distância é quantos itens separam um do outro. Não há eixo, logo não há regra de movimento.
  if (t.kind === 'hotspots') return Math.abs(a.x - b.x);

  const d: number[] = [];
  for (let i = 0; i < t.size.length; i++) d.push(Math.abs(axis(a, i) - axis(b, i)));

  const rawDistance = t.move === 'orthogonal' ? d.reduce((s, v) => s + v, 0)  // L¹: cada eixo custa por si
    : t.move === 'diagonal' ? Math.max(...d)                            // L∞: a diagonal custa um passo
      : Math.hypot(...d);                                               // L²: a reta entre os dois
  // Contínuo: dividida pela unidade — o resultado é "quantos passos", não "quantos pixels".
  return t.kind === 'continuous' ? rawDistance / t.unit : rawDistance;
}

/**
 * PARA ONDE FICA `to` VISTO DE `from`, já nas palavras que a topologia declarou.
 *
 * ⚠️ DOIS EIXOS COM CONVENÇÕES DIFERENTES, e o silêncio sobre isto seria o defeito. `y` CRESCE PARA BAIXO —
 * é a coordenada da tela, herdada da canvas e de todo o código que já existe, não uma escolha desta função.
 * `z` CRESCE PARA CIMA, e essa é escolha: nada a força, e num espaço de três dimensões «zênite» só pode
 * querer dizer o lado para onde a criança olharia levantando a cabeça. Um jogo 3D tem de saber os dois.
 */
export function bearing(t: Topology, from: Spot, to: Spot): Bearing {
  if (t.kind === 'hotspots') return { kind: 'none' };

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = t.size.length > 2 ? (to.z ?? 0) - (from.z ?? 0) : 0;
  const plane = Math.hypot(dx, dy);

  // O eixo vertical do ESPAÇO ganha quando domina o plano — e ganha em palavras próprias, porque `up`/`down`
  // já são AÇÕES em `core/actions`. Ver o comentário de `Heading`.
  if (Math.abs(dz) > plane) return { kind: 'compass', heading: dz > 0 ? 'zenith' : 'nadir' };
  if (plane === 0) return { kind: 'none' }; // mesmo lugar: não há direção que dizer, e inventar uma seria mentir

  // `-dy` porque o norte é para CIMA e `y` cresce para baixo. Sem esta troca a rosa sai invertida, e o teste
  // que a apanharia é o único que precisa de existir aqui.
  const ang = Math.atan2(-dy, dx); // 0 = leste, cresce no sentido anti-horário

  if (t.frame === 'clock') {
    // 12 horas é para CIMA e os ponteiros andam no sentido horário — daí `90 - graus`, e não `graus`.
    const clockwiseDegrees = ((90 - (ang * 180) / Math.PI) % 360 + 360) % 360;
    const h = Math.round(clockwiseDegrees / 30) % 12;
    return { kind: 'clock', hour: h === 0 ? 12 : h };
  }
  const COMPASS_ROSE: readonly Heading[] = ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se'];
  return { kind: 'compass', heading: COMPASS_ROSE[(Math.round(ang / (Math.PI / 4)) % 8 + 8) % 8] };
}
