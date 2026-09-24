// SPDX-License-Identifier: AGPL-3.0-or-later
// input/transport-in-use — A ALTERNÂNCIA SEGUE O APARELHO EM USO (ADR-0109), na metade pura.
//
// ========================= O QUE ESTE MÓDULO É =========================
// O autómato das quatro regras do ADR-0109 §1, sem DOM, sem armazenamento e sem eventos. Recebe ARESTAS com
// origem e devolve estado; quem pergunta «há alternância agora?» pergunta ao estado.
//
//   1. Por padrão, controle e teclado, ambos SEM alternância.
//   2. Clique de mouse ou toque na tela → controles de tela COM alternância.
//   3. Apertar tecla devolve o teclado SEM alternância; usar o controle faz o mesmo.
//   4. Câmera e microfone precisam ser habilitados; habilitados, ligam a alternância em TODOS os outros
//      controles, SEM possibilidade de desligar. São prioridade.
//
// ⚠️ POR QUE ISTO É UM AUTÓMATO E NÃO UM VALOR GUARDADO — e é o que o ADR-0109 supersede do ADR-0104 §C. A
// alternância era uma ESCOLHA guardada por transporte, e a issue #114 mediu que a fiação dela não era
// escrevível: a origem da aresta é apagada à porta (`input/state.keys` é `Set<string>` de CÓDIGOS, e o toque
// e a webcam escrevem lá dentro). O Dev decidiu o COMPORTAMENTO, e o comportamento escolhe o mecanismo.
//
// ⚠️ E A REGRA 3 É A RAZÃO DE PRECISAR DE DUAS COISAS, não de uma. «Apertar uma tecla devolve o teclado sem
// alternância» são DOIS factos: um EVENTO cuja origem tem de ser conhecida, e um MODO que persiste até à
// troca seguinte. Uma aresta não guarda estado; um modo guardado não detecta a própria troca. Nenhuma metade
// exprime a regra; juntas exprimem. Este ficheiro é a segunda metade — o MODO.
//
// 📌 A imagem do Dev, mantida porque diz a coisa: é um CAPS-LOCK NUM TECLADO COM MEMÓRIA. Modo e não estado
// momentâneo; lembrado por aparelho; trocar de aparelho não apaga o que o outro lembra.

/** Os aparelhos por onde uma criança joga. Fechado: um transporte novo tem de decidir a sua regra aqui. */
export type TransportName = 'teclado' | 'gamepad' | 'toque' | 'olhos' | 'rosto' | 'gestos' | 'fala';

/**
 * A UNIÃO COMO VALOR, porque há um sítio onde ela tem de ser verificada em runtime.
 *
 * ⚠️ EXISTE POR CAUSA DE UMA FRONTEIRA, e é a única razão que a justifica: o `input/synthetic-source` lê o
 * transporte de um EXPANDO pendurado num `KeyboardEvent` — um objecto que este código não construiu e que
 * qualquer script da página pode construir. Um valor que atravessa essa fronteira não é um `TransportName` por
 * o TypeScript o dizer; é uma `string` até alguém a conferir. Sem lista, `'olho'` entrava no mapa de origens
 * como transporte fantasma, e nada o diria.
 *
 * 📌 Não é o defeito da lista-ao-lado-da-união que este repositório já desfez três vezes (o `RM_KEYS`, os
 * rótulos de movimento reduzido, as chaves de armazenamento), porque a guarda abaixo é do COMPILADOR: as duas
 * não podem divergir. Uma cópia que não pode divergir é uma projecção, não uma segunda fonte.
 */
export const TRANSPORT_NAMES = ['teclado', 'gamepad', 'toque', 'olhos', 'rosto', 'gestos', 'fala'] as const;

// `[X] extends [never]` e não `X extends never`: o condicional distribui sobre `never` e daria `never` em vez
// de responder à pergunta. Mesma forma do `_COBRE_A_UNIAO` do `ui/motion-scene`.
type _MissingTransport = Exclude<TransportName, (typeof TRANSPORT_NAMES)[number]>;
type _ExtraTransport = Exclude<(typeof TRANSPORT_NAMES)[number], TransportName>;
const _COVERS_THE_TRANSPORTS: [_MissingTransport] extends [never]
  ? ([_ExtraTransport] extends [never] ? true : false)
  : false = true;
void _COVERS_THE_TRANSPORTS;

/**
 * Isto que veio de fora é mesmo um transporte?
 *
 * ⚠️ A pergunta não é de segurança — os scripts desta página são todos da casa, e quem quisesse mentir usaria
 * um valor VÁLIDO. É de correcção: impede que um carimbo errado ou ausente vire uma entrada silenciosa no
 * `keySource`, que é a estrutura de que a alternância inteira depende.
 */
export function isTransportName(v: unknown): v is TransportName {
  return typeof v === 'string' && (TRANSPORT_NAMES as readonly string[]).includes(v);
}

/**
 * OS QUATRO QUE EXIGEM HABILITAÇÃO EXPLÍCITA e, uma vez habilitados, mandam em todos (regra 4).
 *
 * ⚠️ É a mesma lista do `ONE_COMMAND_AT_A_TIME` do `input/latch-scope`, e a coincidência não é acaso: são
 * os transportes de quem NÃO CONSEGUE SEGURAR NADA. O que o ADR-0109 acrescenta é que eles não ligam a
 * alternância só para si — ligam-na para o resto, porque quem usa a webcam pode também tocar na tela, e uma
 * alternância que se desliga ao mudar de aparelho é uma armadilha para exactamente essa pessoa.
 */
export const NEED_ENABLING: ReadonlySet<TransportName> = new Set(['olhos', 'rosto', 'gestos', 'fala']);

/** O transporte que liga a alternância por si só, sem prioridade nenhuma envolvida (regra 2). */
export const LATCH_OF_THEIR_OWN: ReadonlySet<TransportName> = new Set(['toque']);

export interface InputState {
  /** Qual aparelho está a ser usado AGORA por este jogador. */
  readonly inUse: TransportName;
  /**
   * A câmera/microfone foi habilitada? ⚠️ Uma vez `true`, NUNCA volta a `false` por uma aresta — só uma
   * decisão explícita a desliga, e o ADR-0109 §4 diz que a criança não tem essa decisão. Ver `desabilitar`.
   */
  readonly assistedOn: boolean;
}

/**
 * O ESTADO INICIAL: teclado, sem alternância.
 *
 * ⚠️ A regra 1 diz «controle E teclado, ambos sem alternância», e é por isso que o padrão pode nomear um só
 * sem mentir: entre os dois a resposta à única pergunta que este módulo faz — há alternância? — é a MESMA.
 * O `emUso` só passa a distingui-los quando alguém quiser MOSTRAR o aparelho corrente, que é outra questão
 * e o ADR-0109 deixa-a explicitamente por decidir.
 */
export const PADRAO: InputState = Object.freeze({ inUse: 'teclado', assistedOn: false });

/**
 * HÁ ALTERNÂNCIA AGORA? — ⚠️ **NÃO PERGUNTE ISTO A ESTA FUNÇÃO.** Ver o parágrafo abaixo.
 *
 * ⚠️ A prioridade da assistida vem PRIMEIRO, e a ordem é a regra 4 inteira: enquanto ela estiver ligada,
 * nenhum outro aparelho a desliga — nem o teclado, que noutro caso a desligaria. Inverter estas duas linhas
 * é o defeito que trancaria uma criança fora do próprio jogo, e é silencioso.
 *
 * @deprecated 🔴 **ESTA FUNÇÃO IMPLEMENTA O MODELO QUE O ADR-0113 SUPERSEDEU**, e fica exportada por ser
 * superfície publicada (`./input/*.js`) e por o registo ter valor histórico — não por ser a resposta.
 *
 * O ADR-0109 decidia a alternância **só pelo aparelho**: assistida ligada → sim; toque → sim; todo o resto
 * → não. O ADR-0113 retirou essa cláusula, com a razão do Dev: a alternância é um **caps-lock guardado com
 * o mapeamento do controle**, e o valor que a criança gravou vale.
 *
 * 🔴 A DIVERGÊNCIA TEM UMA CRIANÇA CONCRETA, e é a que motivou o registo: quem tem dificuldade motora, joga
 * no TECLADO e gravou a alternância ligada. Esta função devolve `false` para ela — `teclado` não está em
 * `LATCH_OF_THEIR_OWN` — e é exactamente o controle que lhe seria retirado. O `latch-scope.latchOf`
 * devolve `true`, porque lê o que ela gravou.
 *
 * ⚠️ E A CLÁUSULA DO TOQUE TAMBÉM CAIU: sob o ADR-0113 o toque é um transporte como os outros — o valor dele
 * é escolha e fica guardado. Só olhos, rosto, gestos e fala podem recusar-se a DESLIGAR, e essa metade vive
 * em `latch-scope.latchAlwaysOn`, com um conjunto diferente deste e a responder a outra pergunta.
 *
 * **A resposta certa é `latch-scope.latchOf(estado.emUso, leitura)`.** O papel que sobra a este
 * módulo é o que o nome dele diz: QUAL transporte está em uso — que é o que alimenta aquele primeiro
 * argumento. `tests/latching-per-transport.node.test.js` afirma que esta função continua sem consumidor.
 */
export function latchNow(inputState: InputState): boolean {
  if (inputState.assistedOn) return true;
  return LATCH_OF_THEIR_OWN.has(inputState.inUse);
}

/**
 * UMA ARESTA CHEGOU, com a sua origem. Devolve o estado NOVO.
 *
 * ⚠️ Uma aresta de um transporte assistido NÃO o habilita. Habilitar é um acto explícito (regra 4: «precisam
 * ser habilitados»), e deixar uma aresta fazê-lo significaria que um falso positivo da webcam — uma sombra,
 * um segundo rosto a passar — trancava a alternância de toda a gente sem ninguém ter pedido.
 */
export function afterEdge(inputState: InputState, origin: TransportName): InputState {
  if (inputState.inUse === origin) return inputState; // sem mudança: devolve o MESMO objecto, não uma cópia
  return { inUse: origin, assistedOn: inputState.assistedOn };
}

/** A criança (ou quem a acompanha) habilitou câmera/microfone. Daqui em diante a alternância é lei. */
export function enableAssisted(inputState: InputState): InputState {
  return inputState.assistedOn ? inputState : { inUse: inputState.inUse, assistedOn: true };
}

/**
 * DESABILITAR a assistida. Existe, e o ADR-0109 diz de quem é: NÃO é da criança durante a partida.
 *
 * ⚠️ Fica exportada porque desligar a câmera tem de ser possível em algum lugar — trocar de utilizador,
 * fechar o jogo, um adulto a reconfigurar. O que o §4 proíbe é oferecê-la como um botão ao lado do jogo.
 * Uma função que existe e não é oferecida é diferente de uma função que não existe: a primeira diz onde a
 * decisão mora.
 */
export function disableAssisted(inputState: InputState): InputState {
  return inputState.assistedOn ? { inUse: inputState.inUse, assistedOn: false } : inputState;
}
