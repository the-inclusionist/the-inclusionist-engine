# Changelog

## [7.0.1](https://github.com/the-inclusionist/the-inclusionist-engine/compare/v7.0.0...v7.0.1) (2026-09-07)

## [7.0.0](https://github.com/the-inclusionist/the-inclusionist-engine/compare/v6.36.1...v7.0.0) (2026-09-07)

### ⚠ BREAKING CHANGES

* **input:** the gamepad READS the declared table, and R1/R2 stop running
* **contract:** `GameDeclaration` gains `world(): WorldScope`. It is MANDATORY.
`game-chess` and `game-15puzzle` both need it; neither is in this repository.

⚠️ THE DEFECT IS THE WORST CLASS THIS PRODUCT CAN HAVE. `alcanceDoModo` gives the
nine empathy simulations the scope `mundo`, and the root implements `mundo` as the
PixiJS canvas. The reasoning is CORRECT and written down: the menu is the
instrument for leaving the simulation, and a blindness that blanked the pause menu
* **input:** the touch layer stops calling `pause` what everything else calls `start`
* **input:** the transports speak POSITIONS, and 126 points of game vocabulary leave the engine
* **input:** `action5`..`action8` are now `leftShoulder`, `leftTrigger`,
`rightShoulder`, `rightTrigger`. Nothing consumes them yet, so nothing breaks
today.

=== 1. THE NAMES, AND A RECORD FROM THIS MORNING IS SUPERSEDED ===

ADR-0085 named them `action5`..`action8` and argued that gamepad vocabulary in
the abstract set repeats the defect ADR-0074 was written to fix. The Dev read the
argument and answered with a different one: `action7` is unreadable at the point
where somebody writes code, and a project built by volunteers cannot afford a
vocabulary nobody can say out loud.

⚠️ THE OBJECTION IS NOT WITHDRAWN, and both records keep it in writing. On a
speech recogniser `leftTrigger` names nothing that exists. What ADR-0086 answers
is that the names are ANATOMICAL before they are gamepad - two fingers per hand,
one above the other - which survives a transport with no shoulders better than a
number does: a touch layout can stack two buttons under each thumb and the name
still says where the finger goes.

⚠️ AND THE EIGHT VERBS NOW CARRY TWO NAMING CRITERIA, deliberately. The diamond
stays NUMBERED because four positions in a cross have no name that crosses genres
- what a platformer calls jump, a quiz calls confirm - and a thumb reaches all
four, so there is no anatomy to borrow. The shoulders have one. Where a name
describes the HAND it beats a number; where none exists, a number beats a
borrowed metaphor.

=== 2. THE PRESET, AND THE MEASUREMENT THAT DECIDES IT ===

ADR-0074 §1 said "what today is jump is action1; run is action1-mod; swap is
action2; especial is action3". The Dev corrected three of the four:

  action1 -> run        keyboard U          pad X (b2)
  action2 -> jump       keyboard J/Space    pad A (b0)
  action3 -> especial   keyboard K          pad B (b1)
  action4 -> swap       keyboard I          pad Y (b3)

⚠️ MEASURED AGAINST `input/keyboard.ts:36-37` AND `input/gamepad.ts:111`, verb by
verb:

  · the corrected preset moves ZERO of four verbs off the key and the button a
    child uses today;
  · ADR-0074's preset would have moved THREE.

The record that looked conservative was the disruptive one. This correction is a
* **contract:** `GameDeclaration.topology` is now `topology(): Topology`
rather than a value. Both existing games need one line - see below.

Five of the six declaration fields were already functions. The sixth was a
value, inherited from the first declaration ever written, a platformer whose
world never resizes. The asymmetry had already been patched TWICE before anyone
named it: `platform/audio-sonar.ts` always asked for `topology: () => Topology`
in its port, and `boot/create-game.ts:205` bridged the gap with
`() => o.declaration.topology` - a function returning a constant. A patch that
appears twice is the contract asking to change.

The second game broke on it. `game-15puzzle` has three board sizes chosen while
the game runs, and wrote `get topology()` to fit. It type-checks. It is also a
COINCIDENCE OF TypeScript rather than a contract: nothing tells the next author
it is expected, nothing tests it, and `conformanceProblems` still read it once -
so a caching consumer went stale in silence.

⚠️ CONFORMANCE NOW REPORTS THREE FAILURES WHERE IT REPORTED ONE, and the split is
the point. `topology: missing` is a field nobody wrote. `topology: must be a
FUNCTION (it was a value until ADR-0084)` is the field written the old way -
which is what an author copying a pre-0084 example produces, and what otherwise
dies in the first frame with «o.declaration.topology is not a function»: a
frozen screen, indistinguishable to a child who cannot see from a game that
never started. Saying only "missing" would send that author hunting for a field
that is right in front of him.

⚠️ AND THE MESSAGES BECAME ENGLISH, WHICH WAS NOT A CHOICE. The `engine-i18n`
gate refused the first version of this change: it took `core/contract.ts` from 6
raw Portuguese strings to 8, and that ceiling only shrinks. Two of the three ways
out were wrong - writing the new messages in Portuguese (still fails), or raising
the ceiling, which is loosening the anchor the gate exists to hold. The third:
these sixteen strings are DEVELOPER DIAGNOSTICS that never reach a child, and the
CLAUDE.md artefact rule already asked for English. All sixteen converted, and
`core/contract.ts` left the debt list - which the gate then required too, in a
separate assertion. It is a good gate and it caught me twice in one change.

THE GATE: `tests/contract-topologia-e-funcao.node.test.js`, born failing under a
confirmed mutation - removing the `typeof !== 'function'` branch turns the
value-rejection test red. It asserts the three distinct messages, that a board
changing 3x3 -> 5x5 reports 5 on the second read with `distance` following it,
and that columns collapsing to zero start failing conformance AT THAT MOMENT.

⚠️ The bridge in `boot/create-game` is guarded by the TYPE CHECKER, not a test,
and deliberately: reverting it to `() => o.declaration.topology` produces
`TS2322: Type '() => () => Topology' is not assignable to type '() => Topology'`.
Measured. A test would say less, later.

WHAT THE TWO GAMES NEED, one line each, neither in this repository:
  · game-chess     `chess-declaration.ts:53`  `topology: {...}` -> `topology: () => ({...})`
  · game-15puzzle  `puzzle-declaration.ts:64` `get topology()` -> `topology()`

WHAT THIS DOES NOT DECIDE: the shape of `Topology` itself. The grid metric and
dimensions beyond two are a separate open question, and answering it here would
have hidden it.

Verified: 84 records sound, typecheck clean, 133 files / 2414 tests green,
build passes, precache 98 entries.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

### Features

* **a11y:** a alternância chega ao botão de CORRER, e grudar migra para o pulo em contexto ([d91e5a8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d91e5a8161e325ed7ca3f9d4f02b3e2b6133a973))
* **a11y:** a alternância de movimento passa a mostrar ☝️, não 🦾 ([7dc1f96](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7dc1f96c07b55f34c2d270584a6c7e9ce83e0749))
* **a11y:** a barra rápida vai para o HUD, e a pausa fecha o ANEL ([8a45034](https://github.com/the-inclusionist/the-inclusionist-engine/commit/8a45034554f79f845ddd1134e4fca75d4ff8e1ee)), closes [#82](https://github.com/the-inclusionist/the-inclusionist-engine/issues/82)
* **a11y:** a legenda da pausa deixa de ser invisível para quem mais precisa dela ([73f5962](https://github.com/the-inclusionist/the-inclusionist-engine/commit/73f596241129b96fabafa8ee8d254e580831c65b))
* **a11y:** a lista de pausa vai a 44 px, uma coluna, centrada e mais larga ([b8ea6a2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b8ea6a29b6363f57e01f0713627141557d944642))
* **a11y:** a narração passa a INTERROMPER, e não a enfileirar ([bf00001](https://github.com/the-inclusionist/the-inclusionist-engine/commit/bf00001445cf0ba86d25e0b4eda226f495cd2fe3))
* **a11y:** a navegação de menu vira ANEL — antes do primeiro está o último ([2836aa1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2836aa101da99ff3ccd9313c1621ef18c9f6665d))
* **a11y:** a pausa vira SETE itens e os ajustes descem para um submenu ([da59096](https://github.com/the-inclusionist/the-inclusionist-engine/commit/da5909665a3bb853b55e623b5bb9613381442d98))
* **a11y:** as cinco notações de fração viram AJUSTE com moldura e marca, não botão de menu ([ac22354](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ac22354893a40a118c2e5104c7bee8a49ffcf3b9)), closes [#tm-fr](https://github.com/the-inclusionist/the-inclusionist-engine/issues/tm-fr)
* **a11y:** o alto contraste passa a alcançar os menus — por classe, não por filtro ([875a43c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/875a43c80b5f9f3dfd8e152c3f172ba243b02b90)), closes [#83](https://github.com/the-inclusionist/the-inclusionist-engine/issues/83) [#82](https://github.com/the-inclusionist/the-inclusionist-engine/issues/82)
* **a11y:** o CRT decorativo cede à acessibilidade, e a saída é da criança — uma chave por efeito ([c0222a7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c0222a7b8eeabd4104aff233d78adb2156ee9243))
* **a11y:** o menu de abertura dobra de largura e os submenus viram listas verticais ([74af726](https://github.com/the-inclusionist/the-inclusionist-engine/commit/74af726eaa19d1bfab16986bf03c639a157af250))
* **a11y:** o modo `accessibility` — e a saída dele vem antes da entrada ([a73a81d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a73a81d6fc25c049c598e0d483f34f410ebc66c5)), closes [#6](https://github.com/the-inclusionist/the-inclusionist-engine/issues/6)
* **a11y:** todo item de menu anuncia a POSIÇÃO — "6 de 10", e dá para desligar ([51d5574](https://github.com/the-inclusionist/the-inclusionist-engine/commit/51d5574bece7c10b1049930b21fbbbbb985cdaa6))
* **boot:** createGame ATTACHES the menu navigation it was already building ([73dd3f2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/73dd3f2b5e203e228a23cbed1221326e2bbfafac))
* **boot:** the declared world must exist in the document, or the host is told ([1f50190](https://github.com/the-inclusionist/the-inclusionist-engine/commit/1f50190815e3ac187589976d6de4df0bdb4019d5))
* **boot:** the vision filter reaches the DECLARED world, and the menu rule generalises ([72f78e3](https://github.com/the-inclusionist/the-inclusionist-engine/commit/72f78e39c2dd16d46bbf9f056ec261928521682a)), closes [#82](https://github.com/the-inclusionist/the-inclusionist-engine/issues/82)
* **contract:** the game declares which element is its world ([bc14f95](https://github.com/the-inclusionist/the-inclusionist-engine/commit/bc14f9572bdc71802035472207dec09969cb3da8)), closes [#82](https://github.com/the-inclusionist/the-inclusionist-engine/issues/82)
* **contract:** the grid was never ONE thing - the game declares how a step is counted ([be704d1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/be704d1ae6b3e0c1b923dd39d41176956ce82812))
* **contract:** topology is a function, because a board can change size ([75e208d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/75e208d3981ee74a762076220f4c97540b5df26f))
* **core:** the game's WORDS become a preset, and the boundary becomes a gate ([93c6fb4](https://github.com/the-inclusionist/the-inclusionist-engine/commit/93c6fb4c1c0b8f52286e60064173cb48408ee20f)), closes [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
* **css:** a faixa de OVERLAY do `Z` chega ao CSS, com gate — e a adoção fica NOMEADA ([5ebbb76](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5ebbb76cce454786826d37da3aa0af45a71b6cba))
* **debug:** a sonda do personagem vai para dentro do painel `?debug=true` ([35544ba](https://github.com/the-inclusionist/the-inclusionist-engine/commit/35544bac2612bc62ea7a94e1b3f95f623f8f2988))
* **engine:** quadro que lança PARA o laço e anuncia — e ponto deixa de ser sinônimo de acerto acadêmico ([33c373a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/33c373a69950dc23b20f9d77866f9e865df9c774))
* **game:** a arte procedural do lixo e das lixeiras, e a placa vira BARREIRA em vez de penalidade ([0923712](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0923712d246ed211086f78eea45d6682ebdaf98e))
* **game:** a geografia da reciclagem — onde o lixo, as lixeiras e a placa nascem ([1fd663a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/1fd663ac5e9eeb0b01d25eb88cbce09623709e9d))
* **game:** a máquina de estados de pegar/carregar/arremessar — a metade que não depende do objeto ([4e256f7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/4e256f787cc7fc60b64ff7eaa4e24ed4e1ad9122))
* **game:** a placa barra a CRIANÇA, o lixo trava na mão, e a carga passa a ter tipo ([50b32d8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/50b32d8e75c65aed1749d5e429baa1acefdf2f38))
* **game:** a reciclagem ligada ao mundo — sprites, a guarda de entrada, e o ponto que sai uma vez ([c65e45d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c65e45d18d3c80214812449d0fa059d6e64b194b))
* **game:** o botão de interação volta a ser o único gatilho da carga, e o objeto vai para a barriga ([b34c87e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b34c87e23924528535c7bc3f31eeabe1b4fb3001))
* **game:** o estado do lixo no mundo — pegar, carregar, arremessar e descartar ([c2a658d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/c2a658d35c2b789a6efc815e043f44e94ed3723a))
* **game:** pegar vira botão, a direção separa arremessar de soltar, e um item por volta ([9461308](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9461308c153b84017a6defb94ba8e7f7dffd566f))
* **game:** reciclagem — quatro materiais, quatro lixeiras, e um ponto que não move nada ([35f7077](https://github.com/the-inclusionist/the-inclusionist-engine/commit/35f7077700750002877d7a4544c863a6cc56347d))
* **i18n:** a consumer can register its own dictionary ([3f27fc8](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3f27fc8102e769356d99af0c7b2b377a557808d5))
* **input:** fourteen abstract actions, and the gamepad's names stay in the gamepad ([ba48b08](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ba48b08cca85a44e79171b8c4ec6ca93a49ab906)), closes [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103) [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103)
* **input:** the default bindings for keyboard and Xbox, and a gate that catches a duplicate ([5107c9b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5107c9b847eef91a1ee7d6139f64813a3a3006ec))
* **input:** the saved-scheme vocabulary migration, quarantined in its own module ([f0324dd](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f0324dd70178195e09c3ecb9494f2bdf0c4e8d94))
* **input:** the touch slot menu asks the game, and the last label table dies ([0a64051](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0a64051abba49dba3faa4f4eafaabd64eccafc07)), closes [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103) [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
* **input:** the transport list stops living in a test and becomes the engine's ([fa65440](https://github.com/the-inclusionist/the-inclusionist-engine/commit/fa6544090c2e21c9df3231212bcaf8edd319f1ad))
* **input:** the transport registry, and the sentence a child gets BEFORE starting ([e86bb82](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e86bb82fa454e90e5512a78b383817b085b6c3e4))
* **input:** the wizard asks the game what a button is called, instead of knowing ([7c9c085](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7c9c085a7d5c282bc623a10beb517d5d502e9f11))
* **loop:** a stopped loop now SAYS it stopped - ADR-0054's other half ([7079368](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7079368803efad1043dd3730a0a70b30bf377db6)), closes [#109](https://github.com/the-inclusionist/the-inclusionist-engine/issues/109)
* **main:** the platformer root shows the reach notice too - and it has exactly nine actions ([789f3e5](https://github.com/the-inclusionist/the-inclusionist-engine/commit/789f3e510a42ac2e4c47e314f9a24d7b85dd42b1))
* **render:** name the questions the 31 readers of `p.viz` actually ask ([153e090](https://github.com/the-inclusionist/the-inclusionist-engine/commit/153e09072c75afc0cd2c477528c39289f7cb5b6d)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)
* **render:** the two axes COMPOSE, and the keys are checked against the real tables ([63ff8aa](https://github.com/the-inclusionist/the-inclusionist-engine/commit/63ff8aa8409546ee0ab158aad7243d87f2ae551e))
* **render:** two composable axes, and the migration that comes before any reading ([bb796e2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/bb796e21e5ca36e7a3c142e93a03fef78d7aa877)), closes [#104](https://github.com/the-inclusionist/the-inclusionist-engine/issues/104)
* **sonar:** the narration says the BEARING, in the words the game's space uses ([b88a354](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b88a354fbe146b32df3e4a4e4fc72dd524ec8040))
* **storage:** the game id leaves the engine, and two games stop colliding ([eae8a2c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/eae8a2c6fbde46374ac8a77e4a7e0a7399ee4e51)), closes [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
* **ui:** a focus trap, because `aria-modal="true"` was a promise the keyboard denied ([dfaec02](https://github.com/the-inclusionist/the-inclusionist-engine/commit/dfaec02598a0e948e6857c375cec8d55dac7827f)), closes [#109](https://github.com/the-inclusionist/the-inclusionist-engine/issues/109)
* **ui:** the remap screen asks the game which actions it has, and what they are called ([76fb052](https://github.com/the-inclusionist/the-inclusionist-engine/commit/76fb05262feb3f39603bb912082c94cc8a3aec6d)), closes [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103)
* **ui:** the screen that says, BEFORE starting, that your control cannot reach this game ([848e4c6](https://github.com/the-inclusionist/the-inclusionist-engine/commit/848e4c69a19bfbed96453b688c38837a41495d5e))
* **ui:** the title legend asks the game for the SHORT word, and a second label is born ([cb54556](https://github.com/the-inclusionist/the-inclusionist-engine/commit/cb54556e09848e051663a9c9b928c55c8741d319)), closes [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103)

### Bug Fixes

* **a11y:** a alternância do correr ganha padrão declarado e a marca do ADR-0029 ([29ced47](https://github.com/the-inclusionist/the-inclusionist-engine/commit/29ced478de1cd354fd7c680c168e5b75a381507e))
* **a11y:** a alternância do correr tirava a SONDAGEM da bengala de quem não vê ([ec223be](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ec223bec32ec2a81cacbd2df627245e5c788b191))
* **a11y:** a barra do HUD mostra SÓ os botões, e o HUD desce para baixo dela ([3be21f7](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3be21f7807011326061aaabce850edd3ce780d86))
* **a11y:** a correção de daltonismo passa a alcançar os MENUS — e a empatia não ([45bf345](https://github.com/the-inclusionist/the-inclusionist-engine/commit/45bf345d9cfe06789bb54c4ad03e85d5bee4e63c)), closes [#82](https://github.com/the-inclusionist/the-inclusionist-engine/issues/82) [#cvd-fix-deuter](https://github.com/the-inclusionist/the-inclusionist-engine/issues/cvd-fix-deuter) [#cvd-fix-deuter](https://github.com/the-inclusionist/the-inclusionist-engine/issues/cvd-fix-deuter) [#cvd-deuter](https://github.com/the-inclusionist/the-inclusionist-engine/issues/cvd-deuter)
* **a11y:** a instrução FALADA passa a nomear o botão que de fato funciona ([d8c4954](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d8c4954321db32cd192c12d54aa514607cb28095)), closes [#6](https://github.com/the-inclusionist/the-inclusionist-engine/issues/6)
* **a11y:** a lista de pausa deixa de ser MUDA ao ser navegada ([ce5f891](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ce5f89187cdf04d877e339248bc069d57c75171a))
* **a11y:** a mensagem do `throw` do TTS sai do crivo de português ([e0cacbe](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e0cacbe0524f9693cd60a7b8c255056d92c83d22))
* **a11y:** a vinheta do CRT cede para os modos de acessibilidade ([6a7100e](https://github.com/the-inclusionist/the-inclusionist-engine/commit/6a7100e8b8625f6cb635d591d2650b7100361165)), closes [#82](https://github.com/the-inclusionist/the-inclusionist-engine/issues/82)
* **a11y:** as notações de fração e as fileiras da tabuada param de se deitar ([1496b2b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/1496b2bbb9eee9ac3af1ae92b9d8b8cef7c1ea05))
* **a11y:** criança em teclas de alternância volta a correr, e a explicação da fonte para de aparecer duas vezes ([40dfc0d](https://github.com/the-inclusionist/the-inclusionist-engine/commit/40dfc0d21fb7597c0d50d2a916e385db1a9e9734)), closes [#11](https://github.com/the-inclusionist/the-inclusionist-engine/issues/11) [#88](https://github.com/the-inclusionist/the-inclusionist-engine/issues/88)
* **a11y:** o `aria-pressed` da pausa passa a cair no botão que existe ([cece449](https://github.com/the-inclusionist/the-inclusionist-engine/commit/cece449cd5da9e61255a46f40062119363cf52ac)), closes [#8](https://github.com/the-inclusionist/the-inclusionist-engine/issues/8) [#82](https://github.com/the-inclusionist/the-inclusionist-engine/issues/82)
* **a11y:** o bipe do guia auditivo nasce DESLIGADO — provisório, e com data marcada ([0fd35f1](https://github.com/the-inclusionist/the-inclusionist-engine/commit/0fd35f1d54ced43914797ff0354769334b8778ff))
* **a11y:** o jogo e o leitor de tela passam a dizer o MESMO nome do item ([b6f6d2a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b6f6d2ad40ce7ab87f31f5adc465337d099a3ff4))
* **a11y:** o menu já nasce em 7:1 — não depois de a pessoa achar o ajuste ([a88db4a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a88db4a3210c66967158271f0e824b0fbecc34bd)), closes [#83](https://github.com/the-inclusionist/the-inclusionist-engine/issues/83)
* **a11y:** o NOME do diálogo de pausa era português cru num jogo em inglês ([65c527b](https://github.com/the-inclusionist/the-inclusionist-engine/commit/65c527b4f3c2a6d2656ed4f8a5eb57e71a23f752))
* **a11y:** os dez ícones da tela de título voltam a funcionar — um comentário os comeu ([94c8111](https://github.com/the-inclusionist/the-inclusionist-engine/commit/94c811164b785a45658727a3c29eb409ed5dd6da)), closes [#80](https://github.com/the-inclusionist/the-inclusionist-engine/issues/80)
* **adr-gate:** a record that does not parse no longer takes the whole gate down ([551d3b2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/551d3b297851b81a9c573145361c7136ae670a7b))
* **ci:** `default:` was killing both scanners, and they had never run once ([d5f54ce](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d5f54ce32eb046ab7870c1db16ad2b10ecb9d2d1))
* **game:** "um por volta" era UMA UNIDADE DE CADA — quatro itens, um de cada material ([9fe7b87](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9fe7b8789958aa205b16b46ad14f94381b505308))
* **game:** a barreira vira SEGMENTO, e o alcance do pegar cobre o tile do lado ([68c3476](https://github.com/the-inclusionist/the-inclusionist-engine/commit/68c3476204865e68e9a634222cb0e2768e9c92d3))
* **game:** a placa vira DADO DE FASE — coluna 26, linha 46, onde o Dev a pôs ([1ae6a53](https://github.com/the-inclusionist/the-inclusionist-engine/commit/1ae6a53f0b05501738ed24f3e2733c594e17c7e5))
* **game:** a reciclagem ligada ao MAPA de verdade — quatro defeitos que só o navegador mostrou ([30a1d8c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/30a1d8c37cd0525b4781133bc162182fa12159a9))
* **game:** o lixo passa a nascer onde as MOEDAS nascem, roda de material a cada volta, e o grude sai do pulo ([25d0743](https://github.com/the-inclusionist/the-inclusionist-engine/commit/25d0743b46f14c03ece436b10bcd2fe4a35bf93b))
* **hud:** a game's declared name stops going into an HTML attribute ([79baa27](https://github.com/the-inclusionist/the-inclusionist-engine/commit/79baa27eee676a3923715197b1c2f87208b9cc48)), closes [#106](https://github.com/the-inclusionist/the-inclusionist-engine/issues/106)
* **i18n:** `cvd.off` is a FALLBACK, not the fourth choice - split the two ([ff9141a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ff9141afe9cbda08d7abecd5d00db7cfd9dc6770))
* **i18n:** a game's strings are checked at the door, because "i18n" stopped meaning "reviewed" ([a9670fa](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a9670fa30f24ae63c11552e26b6bf44073719dea)), closes [#106](https://github.com/the-inclusionist/the-inclusionist-engine/issues/106)
* **i18n:** matemática volta a traduzir — a exceção da alfabetização tinha comido a regra ([a937f7c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a937f7c05073ad078f7ee48c838a5d1c5a3b1b79))
* **i18n:** the corrections' off entry says "trichromatic vision", not "normal" ([e747406](https://github.com/the-inclusionist/the-inclusionist-engine/commit/e7474060934ce8b58a60cb8fad7cb32068ddb332))
* **i18n:** the fourth colour-vision choice names a VISION, not a switch ([3dd0988](https://github.com/the-inclusionist/the-inclusionist-engine/commit/3dd0988411360ae4cdc0f4c7a0dfe282e3c59049))
* **input,ui:** the game's WORD leaves the markup in the two remaining sinks that took it ([1653574](https://github.com/the-inclusionist/the-inclusionist-engine/commit/16535748b5386c89a11f8a3aa7539df8139ae3c8))
* **input:** the gamepad READS the declared table, and R1/R2 stop running ([b6b514a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/b6b514a239fd3e924bd03e23300ea9160b04e01b))
* **input:** the gamepad wizard's saved map is the THIRD format, found by sweeping instead of waiting ([5c63cdb](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5c63cdbe6018232545a822382aa77e4415cd94e5))
* **input:** the mapping wizard can reach all fourteen positions, not nine ([14e1f41](https://github.com/the-inclusionist/the-inclusionist-engine/commit/14e1f41955328dc872cb9de745ef49b0766150a7))
* **input:** the touch map is a SECOND saved format, and it nearly went unmigrated ([79dbd47](https://github.com/the-inclusionist/the-inclusionist-engine/commit/79dbd47f1a32c8950cefa37687d2ba786ad903f7)), closes [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103)
* **pkg:** sync the lockfile - the previous commit would have failed CI at `npm ci` ([5e2f058](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5e2f05824da4c1a71182509200480c50348b012c))
* **pkg:** the published engine could not be built against by anyone - and nothing here could see it ([a2306f0](https://github.com/the-inclusionist/the-inclusionist-engine/commit/a2306f0df25499fff07c3444071f0b1bc1c31539))
* **pwa:** a segunda página deixa de depender da ORDEM das rotas para existir ([f463f4c](https://github.com/the-inclusionist/the-inclusionist-engine/commit/f463f4c0297553ae7cc43571f75eb3a734f32448))
* **quiz:** activity content stops being markup - the sink [#106](https://github.com/the-inclusionist/the-inclusionist-engine/issues/106) was actually about ([d2bdf99](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d2bdf9979db4650ca4e1797d50c691448830f2fd))
* **quiz:** the three lights return DATA, not markup — and the label now translates ([9dd4205](https://github.com/the-inclusionist/the-inclusionist-engine/commit/9dd4205a3accfb2c531b6e460d1f283c2b2b200a))
* **render:** a roda do carro vira redonda, e o teto deixa de ser um bloco ([5bbef1f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/5bbef1f5bf026b8930c77fbb8ae818bfb51e6e7f))
* **render:** o alto contraste contornava o ATLAS INTEIRO — o "kage bunshin" ([688ee9a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/688ee9a4460bbf5ca3229cf4b0438a888950ebc5))
* **rng:** a factory, 32-bit arithmetic, and decoration stops moving the game's draw ([479f07f](https://github.com/the-inclusionist/the-inclusionist-engine/commit/479f07fb1fd2e1e748de0dd02aab74f725de38af)), closes [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
* **tools:** the migration asked an eventually-consistent list, and stopped itself ([cc1ebfe](https://github.com/the-inclusionist/the-inclusionist-engine/commit/cc1ebfe3dfc7c46a86cbad9910abb20be6a21f2d)), closes [#2](https://github.com/the-inclusionist/the-inclusionist-engine/issues/2) [#1](https://github.com/the-inclusionist/the-inclusionist-engine/issues/1) [#1](https://github.com/the-inclusionist/the-inclusionist-engine/issues/1) [#3](https://github.com/the-inclusionist/the-inclusionist-engine/issues/3) [#101](https://github.com/the-inclusionist/the-inclusionist-engine/issues/101)
* **tts:** the neural voice arrives by a port - 165.6 MB of consumer install becomes 23.1 MB ([2999bbd](https://github.com/the-inclusionist/the-inclusionist-engine/commit/2999bbd7770041c2c3f39c0f9a15841e3b3fc953))
* **ui:** the crash notice becomes a real element - the pseudo-element could never have shown ([ca0384a](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ca0384a31ab8d1cbd02e5750fe6c428d0d8bc2db)), closes [#7f1d1d](https://github.com/the-inclusionist/the-inclusionist-engine/issues/7f1d1d)
* **ui:** the scenario id is escaped, and the remaining census is classified - ceiling 11 -> 1 ([7229f07](https://github.com/the-inclusionist/the-inclusionist-engine/commit/7229f078b3ff17e276383669e7bb69563de8204a)), closes [#106](https://github.com/the-inclusionist/the-inclusionist-engine/issues/106) [#106](https://github.com/the-inclusionist/the-inclusionist-engine/issues/106)

### Code Refactoring

* **input:** shoulders and triggers get names, and the platformer preset is corrected ([ab78095](https://github.com/the-inclusionist/the-inclusionist-engine/commit/ab7809573634e1f4d34942bced203892d2f84863)), closes [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103)
* **input:** the touch layer stops calling `pause` what everything else calls `start` ([d22a8e2](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d22a8e2321f3b7fc4c9e22da4b6dfa24a6417ffb)), closes [#103](https://github.com/the-inclusionist/the-inclusionist-engine/issues/103)
* **input:** the transports speak POSITIONS, and 126 points of game vocabulary leave the engine ([d10a641](https://github.com/the-inclusionist/the-inclusionist-engine/commit/d10a641c01ecd686554f74b73d11269231099812)), closes [#111](https://github.com/the-inclusionist/the-inclusionist-engine/issues/111)
