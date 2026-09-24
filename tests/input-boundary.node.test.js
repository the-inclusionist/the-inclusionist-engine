// SPDX-License-Identifier: AGPL-3.0-or-later
// THE INPUT BOUNDARY, as an inventory — the check ADR-0111 owes.
//
// ========================= THE RULE, AND WHY IT CANNOT BE A PROHIBITION =========================
// ADR-0111 decides the VIRTUAL CONTROLLER is all a cartridge receives: it does not import `input/`, does not call
// `held()`, sees no key codes nor command indices. And the record already anticipates this gate's form: «an INVENTORY
// while the platformer is unmigrated: a list that SHRINKS reports the true state, where a flat prohibition would be red
// for months and get switched off».
//
// 📌 WHAT THIS FILE FREEZES IS WHAT THE ENGINE PUBLISHES, not what games import — the first is a fact of this tree, the
// second another repository's state. `package.json` exports `./input/*.js`, a WILDCARD: every module in `app/js/input/`
// is reachable by a cartridge the instant it is created. ADR-0111's boundary closes by shrinking this list, and each
// entry must say why it is still here. (The split below between "reached" and "not reached" records what was measured
// in the sibling repositories on 2026-09-08; it is not re-measured here.)
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ_INPUT = fileURLToPath(new URL('../app/js/input/', import.meta.url));

/**
 * THE `input/` MODULES A CARTRIDGE CAN REACH, and why each one is still reachable.
 *
 * ⚠️ THE LIST MUST SHRINK. Each entry that leaves is a piece of ADR-0111's boundary closing; a NEW entry without a
 * hand-written reason is the boundary opening without anyone deciding.
 */
const PUBLICADOS = {
  // --- actually reached by at least one cartridge (the migration's debt) ---
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

  // --- published by the wildcard but NOT reached by any cloned cartridge (2026-09-08) ---
  'edges': 'vocabulário de arestas e navegação; publicado pelo curinga, sem consumidor externo medido',
  'latch-scope': 'a regra de escopo da alternância (ADR-0104 §C); sem consumidor externo medido',
  'transport-in-use': 'o autómato do ADR-0109; sem consumidor externo medido — e ele NÃO deve ganhar um, porque quem responde à alternância é a engine',
  'synthetic-source': 'o carimbo de origem (ADR-0109); sem consumidor externo medido, e é fiação interna',
  'latch-store': 'o adaptador entre a regra da alternância e o armazenamento (ADR-0113). Publicado pelo curinga, sem consumidor externo medido — e ele NÃO deve ganhar um: quem responde pela alternância é a engine, e um cartucho que a lesse do disco por sua conta refaria o defeito que o ADR-0113 fecha',
  'pad-defaults': 'o mapa de botões que o JOGO declara, por arranjo e por assento (ADR-0115). Publicado pelo curinga, sem consumidor externo medido — e ele NÃO deve ganhar um: quem regista é o `boot/create-game`, a partir da declaração, e um cartucho que registasse por sua conta estaria a responder uma pergunta que o contrato já lhe faz. ⚠️ Fica alcançável porque o `input/gamepad` o lê, e o gamepad é montado pelo cartucho — a fronteira do ADR-0111 fecha-se sobre ele no dia em que a entrada inteira passar pelo controle virtual',
  'latch-edge': '🎯 A PORTA, e a única desta família que um cartucho deve mesmo tocar (ADR-0113, issue #127): devolve o `arestaDoJogador` que também resolve a alternância, para passar a `initKeydown` e a `initTouchBindings` no lugar do cru. Está declarada aqui e não «fechada» porque a raiz de composição do jogo é quem monta a entrada — a mesma razão pela qual o `initPauseIcons` é chamado por cada jogo. ⚠️ E é ela que torna a cadeia real: enquanto ninguém a passar, o autómato do ADR-0109 responde `teclado` a toda a gente e a cláusula 3 nunca dispara',
  'latch-sync': 'a alternância do transporte em uso posta no jogador (ADR-0113 cláusula 1, issue #127). Publicado pelo curinga, sem consumidor externo medido — e a fronteira NÃO se fecha sobre ele hoje por um facto do catálogo: quem lê `p.toggleMove` é o laço de física de um CARTUCHO (`game/physics.ts`, `game/run-toggle.ts`), noutro repositório, e a sincronização tem de acontecer onde as arestas chegam. Sai desta lista quando a aresta do teclado alimentar o autómato dentro da engine',
  'pad-reading': 'what a gamepad is doing RIGHT NOW — buttons and axes in, positions out, no host and no state (2026-09-23). It is the pure half of `input/gamepad`, and it stays reachable by the wildcard for the same reason that module was: a cartridge that draws its own pad glyphs asks it what is pressed. The boundary of ADR-0111 does not close on it because it speaks POSITIONS and never actions of a game — `padActions` answers `left`/`action2`/`start`, and what those mean is the cartridge\'s word',
  'pad-wizard': 'the gamepad mapping wizard apart from any game (issue #182): mounted by `boot/create-game` in the motor panel and used by `initGamepad`, so a map saved by either is the one both read. Published by the wildcard, with no external consumer measured',
  'empathy-filter': 'the two motor empathy simulations as key decisions (ADR-0181); wired by `boot/create-game` before any cartridge hears a key. Published by the wildcard, with no external consumer — and it should not gain one: a simulation is the engine\'s, applied once for every game',
  'input-cooldown': 'the wait after an accepted key, for a hand whose press arrives twice (ADR-0217, GAG Advanced/Motor); pure, '
    + 'and wired by `boot/create-game` in the same capture pass as the simulations above. Published by the wildcard, with no '
    + 'external consumer — and it should not gain one for the same reason as its neighbour: an accommodation of the INPUT is the '
    + 'engine\'s, applied once for every game, and a cartridge that filtered keys itself would be deciding for a child twice',
  'face-signals': 'the head pose and the eye blendshapes read from one Face Landmarker detection (ADR-0213, issue #194); pure, and '
    + 'to be read by the eye control inside the engine. Published by the wildcard, with no external consumer — and it should not gain one: '
    + 'the eye control is a transport, and a transport is the engine\'s',
  'gaze-relative': 'where the gaze went, measured from its own rest (ADR-0213, issue #194); pure, and to be read by the eye control '
    + 'inside the engine. Published by the wildcard, with no external consumer — and it should not gain one: a transport is the engine\'s',
  'voice-map': 'the words a child SAYS and the position each one presses (ADR-0204 erratum; issues #184, #190): the Dev\'s '
    + 'vocabulary in three languages, the closed grammar built from it, and the rule that turns a growing partial into a press. '
    + 'Pure, and to be wired by the engine behind the virtual controller like the gaze cycle. Published by the wildcard, with no '
    + 'external consumer — and it should not gain one: speaking is a way INTO the controller, and a cartridge that recognised '
    + 'speech itself would be offering a child words the engine never said it has',
  'switch-scan': 'the scan of «one button only» (ADR-0218, issue #201): it offers the game\'s declared positions one at a time '
    + 'and a single press takes the one showing. Pure, and to be wired by the engine behind the virtual controller, like the gaze '
    + 'cycle below it. Published by the wildcard, with no external consumer — and it should not gain one: a way INTO the '
    + 'controller is the engine\'s, and a cartridge that scanned by itself would be offering a child positions the engine did not '
    + 'say it has',
  'gaze-cycle': 'twelve actions and START from four gaze zones (ADR-0213, issue #194); pure, and to be wired by the engine to stamped '
    + 'keys. Published by the wildcard, with no external consumer — and it should not gain one: a transport is the engine\'s',
  'virtual-controller': 'the engine carrying the virtual button to the game (ADR-0111 erratum, issue #197); wired by `boot/create-game`, '
    + 'which gives the cartridge `onCommand`. Published by the wildcard, with no external consumer — and it should not gain one: a '
    + 'cartridge receives commands, it does not press them',
  'face-map': 'the face as a controller, the Dev\'s map (ADR-0210 erratum, issue #191); pure, and to be wired by the engine to stamped '
    + 'keys. Published by the wildcard, with no external consumer — and it should not gain one: a transport is the engine\'s',
  'hand-map': 'the hands as a controller, the Dev\'s map (ADR-0210, issue #191); pure, and to be wired by the engine to stamped keys. '
    + 'Published by the wildcard, with no external consumer — and it should not gain one: a transport is the engine\'s',
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
    // A wrong path would leave the two cases above green for having nothing to examine — and this whole file is about a
    // list, so an empty list is the worst possible green.
    const mods = modulosDeInput();
    expect(mods.length, 'a varredura não achou módulo nenhum em `input/`').toBeGreaterThan(10);
    expect(mods, 'o par de `input/state` é a âncora: se ele sumiu, a varredura mudou de pasta').toContain('state');
  });

  it('📌 [Right] o curinga do pacote continua a ser o que torna isto necessário', () => {
    // If `exports` ever stops publishing `./input/*.js`, the boundary closes for good and this file has no subject left.
    // While the wildcard is there, every new module is born public.
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    expect(Object.keys(pkg.exports ?? {}), 'o curinga saiu — se foi de propósito, este ficheiro pode morrer')
      .toContain('./input/*.js');
  });
});

// ========================= MUTATIONS CHECKED =========================
// Four, all killed. ⚠️ And the first is NOT A CODE EDIT: it CREATES an `app/js/input/intensidade.ts` and deletes it
// afterwards. It is the real defect this file exists to catch — a new module in `input/` is born PUBLIC because of the
// `./input/*.js` wildcard, without anyone deciding to open the boundary. The chosen name is not innocent: `intensidade`
// is how option 2 of ADR-0112 would arrive.
//
//   1. a new module with no entry in the list -> the declared-modules [Interface] fails.
//   2. an ORPHAN in the list (an entry for a module that does not exist) -> the orphans case fails. Without it the list
//      could grow with dead names and look as if the debt were shrinking.
//   3. the scan pointed at `render/` -> THREE fail. An inventory reading the wrong folder is green for the worst
//      possible reason.
//   4. the wildcard leaving `exports` -> its case fails. ⚠️ That case is the only one in the file that may one day fail
//      on GOOD news: if the wildcard leaves on purpose, the boundary has closed and this file dies. It is written in the
//      message so nobody deletes it without realising they won.
