// SPDX-License-Identifier: AGPL-3.0-or-later
// input/latch-sync.ts — A ALTERNÂNCIA DO TRANSPORTE EM USO, POSTA NO JOGADOR (ADR-0113, issue #127).
//
// ========================= A PEÇA QUE FALTAVA, E O QUE ELA FECHA =========================
// O ADR-0113 decidiu que a alternância é um CAPS-LOCK guardado com o mapeamento de cada controle: trocar de
// controle é receber o estado daquele controle, sem escrever nada. Três módulos foram construídos para isso e
// nenhum deles responde a pergunta inteira:
//
//   · `input/latch-scope`      — a REGRA (assistido sempre ligado · valor do transporte · legado · fábrica);
//   · `input/latch-store`      — o ARMAZENAMENTO (os três estados, e a chave com o transporte no nome);
//   · `input/transport-in-use` — o AUTÓMATO (que aparelho produziu as arestas deste jogador).
//
// 📏 E MEDIDO EM 2026-09-09: `storedLatch` tinha ZERO chamadores em produção. A regra estava escrita,
// aferida, e ninguém a lia — quem decidia a alternância continuava a ser `p.toggleMove`, escrito só pelo
// ícone. Este módulo é a junção: pergunta ao autómato QUEM está a jogar, ao armazenamento O QUE está guardado
// para esse aparelho, e escreve a resposta onde a física a lê.
//
// ⚠️ ESCREVER NO JOGADOR E NÃO SUBSTITUIR O CAMPO É DECISÃO, e a razão é o catálogo. `p.toggleMove` é lido no
// laço de física de um CARTUCHO (`game/physics.ts`, `game/run-toggle.ts`), que vive noutro repositório e não
// se edita daqui. Fazer da alternância uma pergunta que a física passasse a chamar seria mudar o laço mais
// quente de um jogo alheio para poupar um campo; pô-la NO campo que ele já lê mantém os leitores certos e
// torna o campo uma CACHE DERIVADA — recalculada na aresta, nunca adivinhada.
//
// 🔴 E A LINHA QUE MAIS IMPORTA AQUI É O `walkDir = 0`. Desligar a alternância sem parar quem anda por
// travamento deixa a personagem a andar sozinha com a criança a largar tudo — sem erro, sem aviso, e no
// aparelho de quem tem menos alternativas. O `ui/settings-mobility` já tinha esta regra para o ícone; ter uma
// segunda cópia dela aqui seria a terceira tabela do `DomQuery` outra vez, então a regra passou a morar numa
// função só (`applyLatch`) e o painel chama-a.
import type { PlayerView } from '../core/entity.js';
import { storedLatch, type LatchStore } from './latch-store.js';

/**
 * O MÍNIMO DO JOGADOR que a alternância toca — dois campos, e nenhum deles é do contrato do jogo.
 *
 * 📌 `PlayerView` e não `PlayerBase`: este módulo não tem nada que fazer com sprites, física ou câmara, e um
 * tipo largo aqui faria um gate precisar de um jogador inteiro de mentira para afirmar duas linhas.
 *
 * ⚠️ E ELE MUDOU DE CASA EM VEZ DE NASCER SEGUNDO. Esta linha existia, palavra por palavra, no
 * `ui/settings-mobility` — e escrevê-la aqui outra vez seria a segunda cópia de um tipo, que é o defeito que
 * este repositório já pagou dezasseis vezes com o `DomQuery`. O painel passou a publicá-la por ALIAS, para o
 * retrato de nomes não a ler como removida.
 */
export type LatchPlayer = PlayerView<'toggleMove' | 'walkDir'>;

/**
 * A base com que a alternância de MARCHA vive no armazenamento da criança.
 *
 * ⚠️ A IRMÃ (`togglerun`, a alternância de CORRER) NÃO ENTRA AQUI HOJE, e a ausência é declarada em vez de
 * esquecida: `p.toggleRun` tem um leitor de RODADA no cartucho (`game/run-toggle`), com uma trava própria que
 * diz se está a correr AGORA — o `walkDir = 0` daqui não é o gesto certo para ela, e inventar-lhe um sem o
 * leitor à frente seria decidir por um jogo que não abri. O `input/latch-store` já aceita a base como
 * argumento, então quando ela entrar entra sem uma segunda forma da mesma pergunta.
 */
export const BASE_DA_MARCHA = 'togglemove';

/**
 * PÕE A ALTERNÂNCIA DE MARCHA NO JOGADOR, com a regra que a acompanha. Devolve se MUDOU alguma coisa.
 *
 * ⚠️ O `walkDir = 0` só corre quando a alternância CAI. Zerá-lo em toda chamada tiraria a direcção a quem
 * está a andar, uma vez por aresta — que é o defeito ao contrário, e mais frequente.
 *
 * 📌 Devolver «mudou» não é conveniência: quem chama na aresta corre isto muitas vezes por segundo, e anunciar
 * ou reflectir a cada chamada encheria o leitor de tela com a mesma frase.
 */
export function applyLatch(p: LatchPlayer, on: boolean): boolean {
  if (p.toggleMove === on) return false;
  p.toggleMove = on;
  if (!on) p.walkDir = 0;
  return true;
}

/**
 * A ALTERNÂNCIA DESTE JOGADOR, RESOLVIDA PARA O TRANSPORTE EM USO E ESCRITA NELE. Devolve se mudou.
 *
 * É a cláusula 1 do ADR-0113 em código, e a propriedade que ela promete é NEGATIVA: chamar isto ao trocar de
 * aparelho troca a resposta **sem escrever no armazenamento**. Um `sincronizar` que gravasse o valor resolvido
 * apagaria, na primeira aresta, a escolha que a criança fez no outro controle.
 *
 * ⚠️ E NOS QUATRO ASSISTIDOS ELE RESPONDE `true` SEM CONSULTAR NADA — a regra vive no `latch-scope` e a razão
 * está lá: em olhos, rosto, gestos e fala a alternância é o que faz a entrada funcionar, e herdar um `false`
 * que a criança escolheu no teclado deixá-la-ia com um controle de olhar que não responde.
 */
export function syncLatch(
  p: LatchPlayer,
  store: LatchStore,
  player: number,
  transport: string,
  byDefault: boolean,
): boolean {
  return applyLatch(p, storedLatch(store, BASE_DA_MARCHA, player, transport, byDefault));
}
