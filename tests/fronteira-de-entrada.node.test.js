// SPDX-License-Identifier: AGPL-3.0-or-later
// A FRONTEIRA DE ENTRADA, como inventário — o crivo que o ADR-0111 deve.
//
// ========================= A REGRA, E POR QUE ELA NÃO PODE SER UMA PROIBIÇÃO HOJE =========================
// O ADR-0111 decide que o CONTROLE VIRTUAL é tudo o que um cartucho recebe: ele não importa `input/`, não
// chama `held()`, não vê códigos de tecla nem índices de comando. E o registo já antecipa o formato deste
// gate: «an INVENTORY while the platformer is unmigrated: a list that SHRINKS reports the true state, where a
// flat prohibition would be red for months and get switched off».
//
// 📌 O QUE ESTE FICHEIRO CONGELA É O QUE A ENGINE PUBLICA, e não o que os jogos importam — porque o primeiro é
// facto desta árvore e o segundo é estado de outro repositório. O `package.json` exporta `./input/*.js`, um
// CURINGA: todo módulo em `app/js/input/` fica alcançável por um cartucho no instante em que é criado. A
// fronteira do ADR-0111 fecha-se encolhendo esta lista, e cada entrada tem de dizer por que ainda está aqui.
//
// 📏 MEDIDO EM 2026-09-08, e o número vale mais do que a regra: dos três cartuchos clonados nesta máquina,
// `game-platformer` alcança DEZ destes módulos, `game-soccer` alcança TRÊS — e o `pixi-15-puzzle` alcança
// ZERO, porque consome só pelo `createGame`. ⚠️ **Um dos seis já vive do lado certo da fronteira**, o que faz
// do ADR-0111 uma coisa demonstrada em vez de pretendida.
// ⚠️ E TRÊS REPOSITÓRIOS NÃO ESTAVAM CLONADOS AQUI, então onze é um PISO e não o total. Dito para ninguém ler
// a medição como se fosse o censo — é a mesma cautela que o `gh search code` já custou a este projeto.
//
// MUTACOES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_INPUT = fileURLToPath(new URL('../app/js/input/', import.meta.url));

/**
 * OS MÓDULOS DE `input/` QUE UM CARTUCHO ALCANÇA HOJE, e por que cada um ainda está alcançável.
 *
 * ⚠️ A LISTA TEM DE ENCOLHER. Cada entrada que sair é um pedaço da fronteira do ADR-0111 a fechar-se; uma
 * entrada NOVA sem razão escrita à mão é a fronteira a abrir-se sem ninguém decidir.
 */
const PUBLICADOS = {
  // --- alcançados de facto por pelo menos um cartucho (a dívida da migração) ---
  'state': 'o `held`/`keys` que a física do cartucho lê a cada quadro — é o coração do que o controle virtual tem de passar a entregar',
  'keydown': 'o cartucho instala o ouvinte de teclado por sua conta; o controle virtual passa a instalá-lo',
  'touch-bindings': 'idem para o ponteiro e os direcionais de toque',
  'touch': 'os controles de tela, montados pelo cartucho',
  'gamepad': 'o polling e o assistente de mapeamento, chamados do laço do cartucho',
  'keyboard': 'os esquemas por jogador, que o cartucho carrega e guarda',
  'keyboard-runtime': 'o estado compilado dos esquemas, lido pelo mesmo laço',
  'devices': 'a lista de slots do toque, que o cartucho usa para desenhar o pad',
  'latch': 'o travamento de direcção, lido pela física do cartucho',
  'transports': 'o alcance, que o cartucho mostra na sua própria tela de selecção',
  'default-bindings': 'os mapeamentos de fábrica por modelo de controle',

  // --- publicados pelo curinga mas NÃO alcançados por nenhum cartucho clonado (2026-09-08) ---
  'edges': 'vocabulário de arestas e navegação; publicado pelo curinga, sem consumidor externo medido',
  'latch-scope': 'a regra de escopo da alternância (ADR-0104 §C); sem consumidor externo medido',
  'transporte-em-uso': 'o autómato do ADR-0109; sem consumidor externo medido — e ele NÃO deve ganhar um, porque quem responde à alternância é a engine',
  'origem-sintetica': 'o carimbo de origem (ADR-0109); sem consumidor externo medido, e é fiação interna',
  'latch-store': 'o adaptador entre a regra da alternância e o armazenamento (ADR-0113). Publicado pelo curinga, sem consumidor externo medido — e ele NÃO deve ganhar um: quem responde pela alternância é a engine, e um cartucho que a lesse do disco por sua conta refaria o defeito que o ADR-0113 fecha',
  'pad-defaults': 'o mapa de botões que o JOGO declara, por arranjo e por assento (ADR-0115). Publicado pelo curinga, sem consumidor externo medido — e ele NÃO deve ganhar um: quem regista é o `boot/create-game`, a partir da declaração, e um cartucho que registasse por sua conta estaria a responder uma pergunta que o contrato já lhe faz. ⚠️ Fica alcançável porque o `input/gamepad` o lê, e o gamepad é montado pelo cartucho — a fronteira do ADR-0111 fecha-se sobre ele no dia em que a entrada inteira passar pelo controle virtual',
  'latch-edge': '🎯 A PORTA, e a única desta família que um cartucho deve mesmo tocar (ADR-0113, issue #127): devolve o `arestaDoJogador` que também resolve a alternância, para passar a `initKeydown` e a `initTouchBindings` no lugar do cru. Está declarada aqui e não «fechada» porque a raiz de composição do jogo é quem monta a entrada — a mesma razão pela qual o `initPauseIcons` é chamado por cada jogo. ⚠️ E é ela que torna a cadeia real: enquanto ninguém a passar, o autómato do ADR-0109 responde `teclado` a toda a gente e a cláusula 3 nunca dispara',
  'latch-sync': 'a alternância do transporte em uso posta no jogador (ADR-0113 cláusula 1, issue #127). Publicado pelo curinga, sem consumidor externo medido — e a fronteira NÃO se fecha sobre ele hoje por um facto do catálogo: quem lê `p.toggleMove` é o laço de física de um CARTUCHO (`game/physics.ts`, `game/run-toggle.ts`), noutro repositório, e a sincronização tem de acontecer onde as arestas chegam. Sai desta lista quando a aresta do teclado alimentar o autómato dentro da engine',
  'pad-wizard': 'the gamepad mapping wizard apart from any game (issue #182): mounted by `boot/create-game` in the motor panel and used by `initGamepad`, so a map saved by either is the one both read. Published by the wildcard, with no external consumer measured',
  'motor-simulation': 'the two motor empathy simulations as key decisions (ADR-0181); wired by `boot/create-game` before any cartridge hears a key. Published by the wildcard, with no external consumer — and it should not gain one: a simulation is the engine\'s, applied once for every game',
  'camera-gestures': 'what a hand, a face and the eyes do in front of the camera, read as commands (ADR-0197, issue #189); pure, '
    + 'and to be wired by the engine to positions. Published by the wildcard, with no external consumer — and it should not gain one: '
    + 'a transport is the engine\'s, the game only names positions',
  'face-signals': 'the head pose and the eye blendshapes read from one Face Landmarker detection (ADR-0213, issue #194); pure, and '
    + 'to be read by the eye control inside the engine. Published by the wildcard, with no external consumer — and it should not gain one: '
    + 'the eye control is a transport, and a transport is the engine\'s',
  'gaze-relative': 'where the gaze went, measured from its own rest (ADR-0213, issue #194); pure, and to be read by the eye control '
    + 'inside the engine. Published by the wildcard, with no external consumer — and it should not gain one: a transport is the engine\'s',
  'pointer-space': 'a conversão de um ponto de tela (#105); pura, e pode legitimamente servir um cartucho que desenhe',
  'pointer': 'a amostra do ponteiro (ADR-0112); é o que o controle virtual vai entregar, então sai desta lista quando ele existir',
  'vocabulary-migration': 'a tradução dos nomes antigos de acção; existe para uma migração e sai com ela',
};

const modulosDeInput = () => readdirSync(RAIZ_INPUT)
  .filter((n) => n.endsWith('.ts') && !n.endsWith('.d.ts'))
  .map((n) => n.replace(/\.ts$/, ''));

describe('ADR-0111 · a fronteira de entrada, e ela só se fecha encolhendo', () => {
  it('⚠️ [Interface] nenhum módulo de `input/` ficou alcançável sem ser declarado', () => {
    const novos = modulosDeInput().filter((m) => !(m in PUBLICADOS));
    expect(
      novos,
      'módulo novo em `input/`, e o `exports` do pacote é um CURINGA (`./input/*.js`) — logo ele já está '
      + 'alcançável por trezentos cartuchos. Declare-o aqui dizendo por que a fronteira do ADR-0111 ainda não '
      + 'se fecha sobre ele, ou construa-o atrás do controle virtual em vez de ao lado dele.',
    ).toEqual([]);
  });

  it('[Interface] a lista não tem órfãos — quem já não existe sai dela', () => {
    const existem = new Set(modulosDeInput());
    expect(Object.keys(PUBLICADOS).filter((m) => !existem.has(m)), 'entrada de um módulo que já não existe').toEqual([]);
  });

  it('⚠️ [Interface] e o crivo está VIVO: ele lê a pasta de entrada a sério', () => {
    // Um caminho errado deixaria os dois casos acima verdes por não terem nada que examinar — e este ficheiro
    // inteiro é sobre uma lista, então uma lista vazia é o pior verde possível.
    const mods = modulosDeInput();
    expect(mods.length, 'a varredura não achou módulo nenhum em `input/`').toBeGreaterThan(10);
    expect(mods, 'o par de `input/state` é a âncora: se ele sumiu, a varredura mudou de pasta').toContain('state');
  });

  it('📌 [Right] o curinga do pacote continua a ser o que torna isto necessário', () => {
    // Se um dia o `exports` deixar de publicar `./input/*.js`, a fronteira fecha-se de vez e este ficheiro
    // deixa de ter assunto. Enquanto o curinga estiver lá, cada módulo novo nasce público.
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(Object.keys(pkg.exports ?? {}), 'o curinga saiu — se foi de propósito, este ficheiro pode morrer')
      .toContain('./input/*.js');
  });
});

// ========================= MUTACOES CONFERIDAS =========================
// Quatro, todas mortas. ⚠️ E a primeira NAO E EDICAO DE CODIGO: ela CRIA um `app/js/input/intensidade.ts` e
// apaga-o a seguir. E o defeito real que este ficheiro existe para apanhar — um modulo novo em `input/` nasce
// PUBLICO por causa do curinga `./input/*.js`, sem ninguem ter decidido abrir a fronteira. O nome escolhido
// nao e inocente: `intensidade` e como a opcao 2 do ADR-0112 chegaria.
//
//   1. modulo novo sem entrada na lista -> reprova o [Interface] dos declarados.
//   2. um ORFAO na lista (entrada de modulo que nao existe) -> reprova o caso dos orfaos. Sem ele a lista
//      podia crescer com nomes mortos e parecer que a divida encolhia.
//   3. a varredura apontada para `render/` -> reprovam TRES. Um inventario que le a pasta errada esta verde
//      pela pior razao possivel.
//   4. o curinga a sair do `exports` -> reprova o caso dele. ⚠️ Esse caso e o unico do ficheiro que pode um dia
//      reprovar por BOA noticia: se o curinga sair de proposito, a fronteira fechou-se e este ficheiro morre.
//      Fica escrito na mensagem para ninguem o apagar sem perceber que ganhou.
