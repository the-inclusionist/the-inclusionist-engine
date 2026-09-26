# Whose record is each one — the reading behind ADR-0242

> Rewritten 2026-09-26, for ADR-0242. The Dev had decided on 2026-09-23 «(i) a engine fica com eles», and the first
> triage (kept below, as history) followed a rule that kept the engine's records in `the-inclusionist-docs`. This is
> the reading that replaces that rule.

## The question, and why it is reading and not counting

**Whose repository breaks or must change if this decision changes?** Every one of the 235 records in
`the-inclusionist-docs` on 2026-09-26 was read against it — the title, what the chosen option decides, and the modules
or repositories it names — and the counts that follow are the result, never the method. A record that cites a game is
usually not that game's; a record that cites the engine is not always the engine's (ADR-0060 names engine input modes
and is about a game's physics).

| class | what it covers | records | where they live |
|---|---|---|---|
| engine | the engine, the contract it publishes, the UI it draws, delivery, accessibility, its tooling, the address of its own records | 182 (+ ADR-0242) | the engine, `docs/2-Architecture/adr/` |
| project-wide | pillars, privacy and compliance, organisation and repositories, licences and art, the catalogue, governance | 44 | `the-inclusionist-docs` |
| another system | a repository with no records tree of its own yet: the labs (ADR-0023), the pixel-data pipeline (ADR-0134–0138) | 6 | `the-inclusionist-docs`, until that system has a tree |
| game-platformer | read as that game's, not moved here: a move into `game-platformer` is made in that repository | 3 | `the-inclusionist-docs`, waiting |

📌 **Nine supersession pairs cross the two repositories**: ADR-0010←0051, ADR-0018←0107 and ←0133, ADR-0119←0133,
ADR-0024←0036, ADR-0025←0036, ADR-0036←0071, ADR-0068←0123, ADR-0117←0118. The validator reads the other half from
the tree `--repo` declares, and counts it when it cannot.

## Every record, one line each

| record | title | class | lives in | why |
|---|---|---|---|---|
| ADR-0001 | Lock canvas scale to integer REAL (physical) pixels, not CSS pixels | engine | engine | the canvas scale createGame applies |
| ADR-0002 | DOM educational-activities UI — light-DOM Web Components + Atomic Design; no Shadow DOM | engine | engine | how the engine's DOM UI is built |
| ADR-0003 | Adopt a Tier-2 lean subset of the SDD documentation schema (adopt / defer-but-home / re… | engine | engine | the SDD documentation tree, which is the engine's `docs/` |
| ADR-0004 | Educational-software documentation subset — learning artifacts + e-learning interop sta… | engine | engine | the `docs/educational/` layer in the engine, and xAPI as the engine's telemetry format |
| ADR-0005 | Access & discovery — no login, teacher-generated activity code, icon-based non-text nav… | project-wide | docs | access without login and the teacher's code: the site, Bússola Escolar and every game |
| ADR-0006 | Ethical engagement, wellbeing & play-based pedagogy — no dark patterns, cooperative, se… | project-wide | docs | no dark patterns: binds every game and the platform |
| ADR-0007 | AI-generated content is gated by human curation — the human is accountable | project-wide | docs | who answers for AI content: governance of all content |
| ADR-0008 | Multiplayer scaling — 4 per screen, a whole classroom over a LAN server, internet MP on… | project-wide | docs | multiplayer topology across the machine, the LAN server and the internet |
| ADR-0009 | Game-development documentation subset — which of the 24 game-dev artifacts we use | project-wide | docs | which game-design artefacts each GAME repository keeps |
| ADR-0010 | The 10 non-negotiable pillars (the project constitution) | project-wide | docs | the pillars: the project's constitution |
| ADR-0011 | Visual accessibility decisions (high-contrast, colour-blind, low-vision, TEA) | engine | engine | the engine's visual accessibility modes |
| ADR-0012 | Typography decisions (font roster, spacing) | engine | engine | the engine's font roster and spacing |
| ADR-0013 | Motor & input accessibility decisions (touch, gamepad, keyboard, easy mode, wheelchair) | engine | engine | the engine's motor and input accessibility |
| ADR-0014 | Auditory accessibility decisions (mixer, blind mode, TTS) | engine | engine | the engine's mixer, blind mode and TTS |
| ADR-0015 | Pedagogy & game-mode decisions (quiz levels, per-player, items, reduce-motion, physics) | engine | engine | the quiz, per-player items and reduce-motion the engine implements (bundle) |
| ADR-0017 | Compliance & data-governance decisions (local-law-wins, RN-01..04, identity-via-gov) | project-wide | docs | compliance: the local law wins, across every system |
| ADR-0018 | Art & visual-design decisions (art=data, flat colours, juice, CRT, CB-safe) | engine | engine | art as data, juice and CRT the engine renders (bundle); its licensing half moved to ADR-0133 |
| ADR-0019 | Adopt TypeScript + Vite — supersedes the "no build" preference | engine | engine | the engine's toolchain |
| ADR-0020 | Canonical Z-order registry (two scopes, PIXI + DOM) + post-process is a filter chain | engine | engine | the overlay z-order of the engine's DOM; the world half went with `core/layers` (ADR-0228) |
| ADR-0021 | Bundle the neural TTS lib via npm; keep the voice model on its upstream host (R2 rejected) | engine | engine | the engine's neural TTS delivery (superseded) |
| ADR-0022 | Adopt sherpa-onnx-wasm as the neural TTS runtime (supersedes the lib choice in ADR-0021) | engine | engine | the engine's TTS runtime (superseded) |
| ADR-0023 | Research labs (TTS lab et al.) are first-class TS/Vite/DI/tested apps, not throwaway sp… | another system | docs | the research labs, a repository of their own (ADR-0025) |
| ADR-0024 | Multi-repo + versioned shared packages — TTS-Lab as its own repo/domain; commons publis… | project-wide | docs | the multi-repository layout of the organisation |
| ADR-0025 | One inclusionist-lab hub repo (labs as subpages); the-inclusionist holds only the game… | project-wide | docs | the labs hub repository: organisation |
| ADR-0026 | All project hosting moves to GitLab — code, backlog, CI and the npm registry (supersede… | project-wide | docs | hosting of the whole project (superseded) |
| ADR-0027 | Inclusionist Pixel — the fantasy-console engine, its scope filter, and the boundary it… | engine | engine | the engine's scope, the fantasy console |
| ADR-0028 | Every settings menu persists and can be reset — and letter case becomes an AAC menu | engine | engine | the engine's settings menus persist and reset |
| ADR-0029 | Anything that departs from its default is marked — and the mark is not only a colour | engine | engine | the engine's changed-mark |
| ADR-0030 | The engine is cut along a DECLARED CONTRACT, with genre packages as ready-made presets… | engine | engine | the engine cut along a declared contract |
| ADR-0031 | What changes under the child's hands redraws itself — and never loses her place | engine | engine | the engine's panels redraw and keep focus |
| ADR-0032 | The curriculum is a layer of its own — it belongs to the platform, not to this game | engine | engine | the curriculum layer at `app/js/educational/` |
| ADR-0033 | The engine's entity declares what the ENGINE owns — and input arrives as intent, never… | engine | engine | what the engine's entity declares |
| ADR-0034 | Progression survives the restored machine — a password the child copies by hand, whose… | project-wide | docs | superseded by ADR-0037, and a superseded record lives where its successor is |
| ADR-0035 | The engine stays OURS — Phaser is read for its designs, never forked and never imported… | engine | engine | the engine is ours; Phaser is read |
| ADR-0036 | THIS repository becomes the ENGINE — the game leaves for the demos repository as one ca… | engine | engine | this repository becomes the engine |
| ADR-0037 | There is NO save — and the Inclusionist stores no child's data at all; the only passwor… | project-wide | docs | no save and no child data anywhere in the project |
| ADR-0038 | State is cut by LIFETIME — page, game, run — and the criterion is already written in th… | engine | engine | the engine's state by lifetime |
| ADR-0039 | A minimal field description must be a TRUE SUPERTYPE of the real one — or the entity mu… | engine | engine | the engine entity's typing rule |
| ADR-0040 | MODE is DERIVED from activity, not stored — two variables answering one question is a d… | engine | engine | MODE derives from the curriculum layer the engine ships |
| ADR-0043 | A KNOWN debt gets a budget that only goes down — never a disabled gate, never a red pip… | engine | engine | the engine's debt budget in CI |
| ADR-0044 | ONE menu per screen, the exit first, and narration that can be interrupted — the quick… | engine | engine | one menu per screen, in the engine's menus |
| ADR-0045 | The RUN button becomes a LATCH, and every other job it carried moves to the JUMP in con… | game-platformer | docs (waits for game-platformer) | the run latch and the carry jobs: `game/run-toggle`, `game/carry` live in game-platformer (superseded by ADR-0060) |
| ADR-0046 | A SIMULATION is not an accessibility feature — so the partition is by ROLE (experience… | engine | engine | simulation versus correction in the engine's filters |
| ADR-0047 | The decorative CRT YIELDS to accessibility with NO exception — and "yield" means switch… | engine | engine | the engine's CRT yields to accessibility |
| ADR-0048 | The journey is FOUR screens, the ADULT logs in and never the child, and difficulty foll… | project-wide | docs | the journey across the site, Bússola Escolar and the games |
| ADR-0049 | Every reward is DETERMINISTIC, points are a work record that buys nothing, and the only… | engine | engine | the engine's segment bar and deterministic rewards |
| ADR-0050 | TWO control surfaces — the child's menus adjust how she plays, the adult's panel decide… | engine | engine | the child's menus the engine draws, against the adult's panel |
| ADR-0051 | Libras has TWO activation levels — an interpreter on demand, and Libras as FIRST langua… | engine | engine | Libras levels, VLibras in the engine |
| ADR-0052 | A professional AUTHORS activities inside the games, scoped to the student they attend —… | project-wide | docs | professionals author activities: Bússola Escolar and the platform |
| ADR-0053 | The annual compliance report is a CI GATE that fails when the year's report is missing… | engine | engine | the annual-report gate in the engine's CI |
| ADR-0054 | A frame that throws STOPS the loop and SAYS SO — because a frozen canvas is silent, and… | engine | engine | the engine's loop stops and says so |
| ADR-0055 | Six repositories, TWO mechanisms — package for libraries, API for boundaries, and zero… | project-wide | docs | the organisation's repositories (superseded) |
| ADR-0056 | No child datum leaves the device in a form anyone can recognise — E2E for the individua… | project-wide | docs | child data outside the device (superseded) |
| ADR-0057 | A record changes by SUPERSESSION, and an ERRATUM is the only edit in place — the test i… | project-wide | docs | how every record in every repository changes |
| ADR-0058 | FIVE systems, NINE repositories — the boundary follows the Secretaria that answers for… | project-wide | docs | five systems, nine repositories |
| ADR-0059 | ONE record owns the HUD's layout, and a number sits with what it is ABOUT — identity, s… | engine | engine | the HUD layout the engine owns |
| ADR-0060 | The INTERACTION button keeps every job it had, in every input mode — and only RUNNING b… | game-platformer | docs (waits for game-platformer) | the interaction button's jobs — cling, pick up, throw — are game-platformer's physics and carry |
| ADR-0063 | The Município CAN read the data, so the defence moves from CRYPTOGRAPHY to ACCOUNTABILI… | project-wide | docs | data access by the Município: Bússola Escolar |
| ADR-0064 | The code licence is AGPL-3.0-or-later, because under GPL a hosted classroom server woul… | project-wide | docs | the code licence of every program |
| ADR-0065 | THREE neural voices, owned by the ENGINE, arriving on FIRST USE — because precaching th… | engine | engine | the engine owns the neural voices |
| ADR-0066 | Hosting moves to a GitHub ORGANISATION that claims nothing — private until the Municípi… | project-wide | docs | the GitHub organisation |
| ADR-0067 | A repository is created when its address is declared — and it is born carrying a README… | project-wide | docs | how any repository is created |
| ADR-0068 | One repository per GAME — and the catalogue stops holding games in order to start choos… | project-wide | docs | one repository per game; the catalogue chooses |
| ADR-0069 | The interim public address is a subdomain of the Dev's own domain — and the thing it co… | project-wide | docs | the project's public address |
| ADR-0070 | The labour is VOLUNTEER, so discovery stops being marketing and becomes the production… | project-wide | docs | volunteer labour |
| ADR-0071 | The package scope names the CONTAINER, not the owner — `@the-inclusionist`, and the own… | project-wide | docs | the package scope of the organisation |
| ADR-0072 | The registry is PUBLIC npmjs, because a volunteer without a token cannot install from G… | project-wide | docs | the registry every package publishes to |
| ADR-0073 | The 2048's repository is named by declaration — `the-inclusionist/pixi-2048` — and ADR-… | project-wide | docs | a repository's address (superseded) |
| ADR-0074 | The engine owns NINE ABSTRACT actions, and NINE transports bind to them — the game name… | engine | engine | the engine's abstract actions |
| ADR-0075 | Contrast and colour correction are TWO AXES — a child may need both at once, and today… | engine | engine | the engine's contrast and colour axes (superseded) |
| ADR-0076 | TWO composable axes — theme and colour correction — and SIMULATION is not one of them | engine | engine | the engine's theme and colour-correction axes |
| ADR-0077 | The fourth verb is `action4`, and LATCHING is a control option — not a name in the voca… | engine | engine | the engine's action vocabulary |
| ADR-0078 | The contribution instrument is the DCO — because before the ato there is nobody a CLA c… | project-wide | docs | the contribution instrument of every repository |
| ADR-0079 | A transport declares SLOTS, and the player assigns actions to them — one control method… | engine | engine | transports and slots in the engine's input |
| ADR-0080 | The engine holds nothing per-game — and a second game found the same assumption in five… | engine | engine | the engine holds nothing per game |
| ADR-0081 | The 2048's address is `the-inclusionist/game-2048`, and the repository name stops diver… | project-wide | docs | a repository's address |
| ADR-0082 | A game repository is named `game-<slug>`, mirroring its package, and ADR-0068 §1's patt… | project-wide | docs | the naming rule for game repositories |
| ADR-0083 | A game is born in its OWN repository and consumes the engine as a PACKAGE — the in-repo… | engine | engine | a game consumes the engine as a package: the engine's boundary |
| ADR-0084 | A game's `topology` is a FUNCTION, because a board can change size while the game runs | engine | engine | contract: `topology()` |
| ADR-0085 | FOURTEEN actions, because nine was a ceiling and the Dev reached it — and the four new… | engine | engine | the engine's fourteen actions |
| ADR-0086 | The four new verbs are named for the HAND — shoulders and triggers — and the platformer… | engine | engine | the engine's verbs and preset |
| ADR-0087 | The game DECLARES which element is its world, and `none` is a written choice rather tha… | engine | engine | contract: `world()` |
| ADR-0088 | The game owns its storage id, because the declaration arrives after the keys have alrea… | engine | engine | the engine's storage keys take the game's id |
| ADR-0089 | The game declares HOW A STEP IS COUNTED and IN WHAT WORDS a direction is said | engine | engine | contract: the step and the direction words |
| ADR-0090 | Three wires the engine built and never connected — and a disconnected wire is worse tha… | engine | engine | wires in the engine's createGame |
| ADR-0091 | The reach notice INFORMS and does not refuse — because the engine cannot know whether a… | engine | engine | the engine's reach notice |
| ADR-0092 | The READABLE layers are six, and the biggest of them is the menus — measured, not designed | engine | engine | the engine's readable layers |
| ADR-0093 | What the SHIPPED code names, the package has to declare — and the gate looks in both di… | engine | engine | the engine package's declared dependencies |
| ADR-0094 | The neural voice arrives through a PORT the game opens — the engine names no supplier | engine | engine | the engine's voice port |
| ADR-0095 | The touch target is a function of VIEWPORT HEIGHT — three steps, with the two standards… | engine | engine | the engine's touch target ruler |
| ADR-0096 | The two-player keyboard is the SAME geometry twice — and the arrows change owner | engine | engine | the engine's two-player keyboard |
| ADR-0097 | The football game's address is `the-inclusionist/game-soccer`, and it is the first game… | project-wide | docs | a repository's address |
| ADR-0098 | What ADR-0006 forbids is the compulsion loop, not the contest inside one match | project-wide | docs | the reading of ADR-0006 for every game |
| ADR-0099 | A chord is a derived slot, and every chord owes a latched equivalent | engine | engine | the engine's chord slots (proposed) |
| ADR-0100 | Holding is a magnitude, and every hold owes a route that needs no holding and no timing | engine | engine | the engine's charge (proposed) |
| ADR-0101 | A slot may have a RANGE, and the deadzone stops being one number for everybody | engine | engine | the engine's ranged slots (proposed) |
| ADR-0102 | The skip-link outranks even the phase transition, because an exit behind a curtain is n… | engine | engine | the engine's skip-link slot |
| ADR-0103 | The bar does not persist — not in the engine, not in the cartridge, not in the school s… | engine | engine | the engine's segment bar does not persist |
| ADR-0104 | A game declares how many positions it needs HELD AT ONCE, the touch floor is two, and l… | engine | engine | contract: positions held at once |
| ADR-0105 | The auditory guide says distance with BRIGHTNESS, plus a small volume component — becau… | engine | engine | the engine's auditory guide |
| ADR-0106 | The engine OFFERS the pause menu and the accessibility icons, because five of six games… | engine | engine | the engine offers the pause menu |
| ADR-0107 | The Liberated Pixel Cup enters as THIRD-PARTY art under CC BY-SA 3.0, in its own quaran… | project-wide | docs | art licensing (superseded by ADR-0133) |
| ADR-0108 | EIGHT Playwrite faces ship and the rest arrive on demand — and the Ronde option stops b… | engine | engine | the fonts the engine ships |
| ADR-0109 | Latching follows the DEVICE IN USE, the camera forces it on for everyone, and the edge… | engine | engine | the engine's latching |
| ADR-0110 | The engine GUARANTEES four neural voices and fetches them itself — because in an educat… | engine | engine | the engine guarantees the voices |
| ADR-0111 | The virtual controller is the cartridge's ONLY input, and every command carries the SOU… | engine | engine | contract: the virtual controller |
| ADR-0112 | The pointer is a DECLARED CAPABILITY beside the fourteen, not an axis on them — and on… | engine | engine | contract: the pointer capability |
| ADR-0113 | Latching is a CAPS-LOCK saved with each controller's mapping — the icon stays, and only… | engine | engine | the engine's latching per mapping |
| ADR-0114 | A heavy runtime ships WITH the PWA and only the models come from the network — and the… | engine | engine | delivery of the engine's heavy runtime |
| ADR-0115 | The GAME declares the default mapping for each device — and latching is part of it, so… | engine | engine | contract: the game's default mapping |
| ADR-0116 | A PWA is offline AFTER THE FIRST DAY — installing is itself a network act, so a first f… | engine | engine | delivery: offline after the first day |
| ADR-0117 | The PWA is the SITE, not a game — and the platform loads the fonts, the voices and the… | engine | engine | delivery: the platform loads the engine's heavy things once |
| ADR-0118 | The platform is the repository that ALREADY holds the catalogue — not the empty one tha… | project-wide | docs | which repository is the platform: the catalogue |
| ADR-0119 | The engine provides the ART too — and all four heavy things travel the PLATFORM's way,… | engine | engine | the engine provides the art and the heavy things |
| ADR-0120 | The pause menu stops being declinable — the reason the decline existed was built away | engine | engine | the engine's pause decline |
| ADR-0121 | The pause decline comes back — the retirement was measured on ONE consumer out of five | engine | engine | the engine's pause decline |
| ADR-0122 | The games adopt the engine's pause — the decline is retired for good, and the keyboard… | engine | engine | the engine's pause decline |
| ADR-0123 | The records move to a repository of their own — and a confirmation carries the reposito… | engine | engine | where the records and the engine's validator live; paired with ADR-0242 |
| ADR-0124 | The heavy runtimes are the engine's, and MediaPipe replaces WebGazer | engine | engine | the engine's heavy runtimes |
| ADR-0125 | The organisation goes public, and privacy stops being paid for | project-wide | docs | the organisation goes public |
| ADR-0126 | An issue is a problem solvable by code — decisions, phases and fieldwork are not issues | project-wide | docs | what an issue is, in every repository |
| ADR-0127 | The neural TTS runtime is piper, and the sherpa swap is retired because its motive was… | engine | engine | the engine's TTS runtime (superseded) |
| ADR-0128 | A record has two tempos — the decision before, the confirmation after | project-wide | docs | the two tempos of every record |
| ADR-0129 | The menu layer has one row builder and one dispatch hook | engine | engine | the engine's menu layer |
| ADR-0130 | Menus are stacked cards, and the back item returns the cursor to what opened it | engine | engine | the engine's stacked menus |
| ADR-0131 | A control lives in the menu of the NEED it serves, not the channel it uses | engine | engine | the engine's menus (superseded) |
| ADR-0132 | WebGazer returns beside MediaPipe, and sherpa is closed for good | engine | engine | the engine's vision runtimes |
| ADR-0133 | Art enters by three doors — the author's grant, a licence that passes four questions, a… | project-wide | docs | art licensing: which art enters the project |
| ADR-0134 | The pixel-data pipeline gets a repository of its own, and the engine becomes a reader o… | another system | docs | the pixel-data pipeline is its own repository; the engine reads nothing of it today |
| ADR-0135 | One file carries the pixels AND the colours, and a region is a word rather than an id | another system | docs | the pixel-data file format |
| ADR-0136 | Simplification is the one parameter, and it merges positions AFTER grouping rather than… | another system | docs | the pixel-data tool's simplification |
| ADR-0137 | The tool opens on the art it will DELIVER, so simplification is the default rather than… | another system | docs | the pixel-data tool's default |
| ADR-0138 | The default simplification is 2⁸, bought against the measurement and with its price stated | another system | docs | the pixel-data tool's default level |
| ADR-0139 | A cartridge supplies HALF of CreateGameOptions and never calls createGame | engine | engine | contract: CreateGameOptions |
| ADR-0140 | A game is a standalone PWA AND a cartridge, from one source, and the standalone build i… | engine | engine | contract and delivery: a game is a PWA and a cartridge |
| ADR-0141 | A cartridge owns its random stream, because the shared one is module state | engine | engine | contract: the cartridge's random stream |
| ADR-0142 | The engine MOUNTS and UNMOUNTS a cartridge, so one composition root can serve many | engine | engine | the engine mounts a cartridge |
| ADR-0143 | The engine DRAWS the virtual control, and the game declares its SHAPE | engine | engine | the engine draws the virtual control |
| ADR-0144 | The engine OPENS the pause, by the `start` action — a card nothing opens is a card nobo… | engine | engine | the engine opens the pause |
| ADR-0145 | The accommodation catalogue is GENERAL, and a GENRE declares its subset and its own add… | engine | engine | the engine's accommodation catalogue |
| ADR-0146 | The pause options split into «opções gerais» and «opções do jogo» | engine | engine | the engine's pause options |
| ADR-0147 | The pause root is NINE items, and the engine actions the ones that are hers | engine | engine | the engine's pause root |
| ADR-0148 | The accessibility bar is HUD — it owns its space, and it mounts the icons that work | engine | engine | the engine's accessibility bar |
| ADR-0149 | The eleventh quick-bar button cycles five typography presets — and the BDA spacing stop… | engine | engine | the engine's typography presets |
| ADR-0150 | The cursive hand follows the country — and where there is none, the fallback is the col… | engine | engine | the engine's cursive faces |
| ADR-0151 | The pause root is SIX items and fits 640×360 — and the settings keep only what the chil… | engine | engine | the engine's pause root |
| ADR-0152 | The 300-game catalogue is not the MVP — it stays a sample for study, not a list to build | project-wide | docs | the catalogue is not the MVP |
| ADR-0153 | Genre is optional — the cartridge answers its accommodations, and it has to | engine | engine | contract: accommodations |
| ADR-0154 | The ronde falls back to Cookie — three faces the child may install, and one the engine… | engine | engine | the engine's ronde fallback |
| ADR-0155 | START is the quick pause — the bar over the frozen game, and PAUSED — and SELECT opens… | engine | engine | the engine's START and SELECT |
| ADR-0156 | The engine's genre list is Wikipedia's — without casino, avoiding horror, and without t… | engine | engine | the engine's genre list |
| ADR-0157 | The virtual pad always has the directional and four action buttons — and pressing them… | engine | engine | the engine's virtual pad |
| ADR-0158 | Every menu item carries a number, «Voltar» is item 1 — and a quiz reads its options wit… | engine | engine | the engine's menu numbering |
| ADR-0159 | The UI rules for blind and low-vision players — what every menu and screen the engine d… | engine | engine | the engine's UI rules for blind players |
| ADR-0160 | Where the virtual pad's buttons sit — actions 1 and 4 on top, 2 and 3 below; L2 over L1… | engine | engine | the engine's virtual pad layout |
| ADR-0161 | The pause card always shows all its items — an item with no action is disabled with its… | engine | engine | the engine's pause card |
| ADR-0162 | A virtual pad button appears only when the game names it — directions, actions and shou… | engine | engine | the engine's virtual pad |
| ADR-0163 | The engine forces the resolution on every cartridge — 640×360 or larger integer multipl… | engine | engine | the engine forces the resolution |
| ADR-0164 | The footer is at most two lines, at the very bottom of the screen, over a darkened band | engine | engine | the engine's footer |
| ADR-0165 | A button has a name and the cartridge gives it a function — the face shows the name, ne… | engine | engine | the engine's button names |
| ADR-0166 | The on-screen pad is for play in the games that ask for it, and it leaves every menu | engine | engine | the engine's on-screen pad |
| ADR-0167 | A menu item shows no number — its position is spoken after its name, by one function, i… | engine | engine | the engine's menu positions spoken |
| ADR-0168 | The engine mounts the HUD, and the game declares its numbers by band | engine | engine | the engine mounts the HUD |
| ADR-0169 | What the engine refuses, reports or tolerates — and `problems` has one language and one… | engine | engine | the engine's `problems` channel |
| ADR-0170 | The public contract includes what a cartridge reads from CSS, the DOM and the dictionar… | engine | engine | contract: the public surface |
| ADR-0171 | A code comment says the current why — the history of a decision lives in its commit and… | project-wide | docs | how code in every repository is commented |
| ADR-0172 | A one-way door gets a record; a two-way door gets a dated entry in the interface log | project-wide | docs | which decisions get a record, in every repository |
| ADR-0173 | Modules depend downward through named layers, with no cycles — and the direction is gated | engine | engine | the engine's layer rule |
| ADR-0175 | The mission sits under the points, and the power under the clock | engine | engine | the engine's HUD |
| ADR-0176 | The typographic catalogue is the engine's source for fonts, and the engine only reads it | engine | engine | the engine's typographic catalogue |
| ADR-0177 | The heavy files are packaged with the delivery and served from its own origin | engine | engine | delivery of the engine's heavy files |
| ADR-0178 | The composition root loads the stored settings explicitly, and a write before the load… | engine | engine | the engine's composition root |
| ADR-0179 | On a fractional display scale, the 16 px floor wins over the whole pixel | engine | engine | the engine's scale |
| ADR-0180 | The game speed is an hourglass on the quick bar, applied by the engine's loop | engine | engine | the engine's game speed |
| ADR-0181 | «One button at a time» and «no strength to hold» are empathy simulations; toggle keys i… | engine | engine | the engine's empathy simulations |
| ADR-0182 | The cartridge declares its game options as rows, and the engine draws them | engine | engine | contract: game options drawn by the engine |
| ADR-0183 | The child sets the pace of speech and of captions | engine | engine | the engine's speech and caption rate |
| ADR-0184 | The voice runtime leaves the download catalogue; the game's bundle is what runs | engine | engine | the engine's voice runtime delivery |
| ADR-0185 | The child picks the voice, among the voices that speak the language | engine | engine | the engine's voice choice |
| ADR-0186 | Kokoro returns, and Kokoro and Piper are both default | engine | engine | the engine's voices |
| ADR-0187 | A disability simulation runs in the game, never in a menu | engine | engine | the engine's simulations |
| ADR-0188 | Owner colours and contrast outlines are game-keyed subjects | engine | engine | the engine's game-keyed subjects |
| ADR-0189 | Microphone control listens with Vosk, restricted to the game's words | engine | engine | the engine's microphone control |
| ADR-0190 | Two recognisers — Vosk for commands, Moonshine for reading | engine | engine | the engine's recognisers |
| ADR-0191 | The typographic catalogue lives in research/ | engine | engine | where the engine reads its type catalogue |
| ADR-0192 | The page is cross-origin isolated, so the voice runtime runs on threads | engine | engine | the engine page's isolation headers |
| ADR-0193 | Vosk runs without eval — an isolated page tests it, and a kept Vosk is rebuilt | engine | engine | the engine's Vosk runtime |
| ADR-0194 | In a menu, saying an item's name activates it | engine | engine | the engine's voice menus |
| ADR-0195 | «How to play» is the cartridge's, and the engine shows it as slides | engine | engine | contract: how-to-play slides |
| ADR-0196 | The voice's normal speed is the slowest, and the rate climbs by 50 to about 500 | engine | engine | the engine's speech rate |
| ADR-0197 | The webcam controls a game by hand gestures, face and eyes — the first mappings | engine | engine | the engine's camera control |
| ADR-0198 | Kokoro's voices are options in any browser, marked by quality, and come through the gam… | engine | engine | the engine's voices |
| ADR-0199 | Webcam face and eyes — the second mappings, after the first camera run | engine | engine | the engine's camera control (superseded) |
| ADR-0200 | Web Speech first — neural voices and recognisers are the fallback | engine | engine | the engine's speech order |
| ADR-0201 | Reading recognisers — Moonshine where it speaks the language, Whisper for Portuguese | engine | engine | the engine's reading recognisers |
| ADR-0202 | Webcam eyes — a look and a blink pattern, every eye command | engine | engine | the engine's eye control (superseded) |
| ADR-0203 | Model files the project builds are hosted on its Cloudflare, then on Hugging Face | engine | engine | hosting of the engine's heavy files: delivery |
| ADR-0204 | Five modalities map the whole controller — every candidate tested first | engine | engine | the engine's camera modalities |
| ADR-0205 | Face controls — twenty-one grouped candidates, eleven avoided | engine | engine | the engine's face controls |
| ADR-0206 | Hand controls — fifteen candidates, six left out | engine | engine | the engine's hand controls |
| ADR-0207 | Piper leaves the engine — Kokoro is the only neural voice, and the project says why in… | engine | engine | the engine's voices |
| ADR-0208 | Eye control — dwell on sectors of the player's own gaze, read by MediaPipe and calibrat… | engine | engine | the engine's eye control (superseded) |
| ADR-0209 | The tie-break is «what breaks if we reverse it next week?» — a lab verdict is never a r… | project-wide | docs | the tie-break for a record, in every repository |
| ADR-0210 | The default camera map — face and hands on the whole controller; eyes disabled | engine | engine | the engine's camera map |
| ADR-0211 | Hand gestures, face, eyes and speech latch every button by default — the player may tur… | engine | engine | the engine's latching for camera modes |
| ADR-0212 | The camera-control toggles cycle through feedback levels — eyes, hand gestures, faces | engine | engine | the engine's camera toggles |
| ADR-0213 | Eye control — a relative reading of four zones and a cycle of twelve commands and START | engine | engine | the engine's eye control |
| ADR-0214 | WebGazer leaves — eye control is MediaPipe's relative reading | engine | engine | the engine's vision runtime |
| ADR-0215 | One camera icon on the quick bar cycles off, hands, face and eyes | engine | engine | the engine's camera icon |
| ADR-0216 | The engine offers speaking and listening as objects, as it offers the controller | engine | engine | contract: speaking and listening objects |
| ADR-0217 | A cool-down between inputs, chosen by the child | engine | engine | the engine's input cool-down |
| ADR-0218 | One accessibility icon cycles standard control, sticky keys and one button only | engine | engine | the engine's accessibility icon |
| ADR-0219 | The public surface speaks English, in one breaking release | engine | engine | the engine's public surface in English |
| ADR-0220 | A root has an end of life, and it is not `unmount()` | engine | engine | the engine's root lifetime |
| ADR-0221 | Code health is a ratchet, never a score | engine | engine | the engine's code-health ratchet |
| ADR-0222 | Where the three controls of ADR-0131 actually live, and why the question is closed | engine | engine | the engine's menus |
| ADR-0223 | Every transport presses the virtual controller — the engine has ONE door to the cartridge | engine | engine | the engine's transports |
| ADR-0224 | The engine mounts every transport, and a cartridge declares only what nothing in the en… | engine | engine | the engine mounts every transport |
| ADR-0225 | A language change reaches everything the engine draws, speaks and hears — at once | engine | engine | the engine follows a language change |
| ADR-0226 | Every repository keeps the records about itself — and the engine's come home | engine | engine | where the engine's records live; paired with ADR-0229 and ADR-0242 |
| ADR-0227 | The audio panel receives the browser, and never reaches for it | engine | engine | the engine's audio panel |
| ADR-0228 | The tile-world stack belongs to the platformer, and it moves there before the engine de… | engine | engine | what leaves the engine |
| ADR-0229 | The records stay in their own repository, and only a game's own records move to that game | engine | engine | where the engine's records live; superseded in part by ADR-0242 |
| ADR-0230 | Published members speak English, renamed by type and not by name | engine | engine | the engine's published members |
| ADR-0231 | The pad assistant cannot be declined — `Declinios.noPadAssistant` leaves the contract | engine | engine | contract: a decline leaves |
| ADR-0232 | State and the browser arrive by injection from the composition root | engine | engine | the engine's injection rule |
| ADR-0233 | No pictogram set until one is licensed — only ARASAAC and PCS are candidates | engine | engine | the engine's pictogram roster |
| ADR-0234 | There is no Libras mode, there is a deaf mode — sounds get captions, and the sonar call… | engine | engine | the engine's deaf mode |
| ADR-0235 | No room code and no internet multiplayer for now — everything runs offline and single-m… | project-wide | docs | no room code and no internet multiplayer: the whole project |
| ADR-0236 | The session clock is a Time Timer — a continuous pie, 50 minutes by default | engine | engine | the engine's session clock |
| ADR-0237 | A sub-engine for top-down and platformer games — born as a separable folder in the plat… | game-platformer | docs (waits for game-platformer) | a folder inside game-platformer and a gate there; the engine carries nothing of it |
| ADR-0238 | The points sit beside the clock, in five digits with leading zeros | engine | engine | the engine's HUD |
| ADR-0239 | The HUD is one row at the bottom — learning bars, clock, score and power, and the game'… | engine | engine | the engine's HUD |
| ADR-0240 | The session clock has no settings on the child's side — one hour, red at the end, alway… | engine | engine | the engine's session clock |
| ADR-0241 | The scanlines stay under the colour-vision modes | engine | engine | the engine's CRT |

## The first triage (2026-09-23), kept as history

> Written 2026-09-23, for ADR-0226 («every repository keeps the records about itself»).
>
> 📌 **Dev, 2026-09-23:** «a triagem escrita primeiro, o movimento só para o que for de um jogo, e o validador
> com `--repo` a correr dos dois lados antes e depois». This is the first of those, and nothing has moved yet.

### The method, and why it is reading and not counting

🔴 **The F12 triage failed twice by counting words**, and the lesson it bought applies here unchanged. The first
pass matched substrings, so `cidade` matched inside «acessibilidade» and `senha` inside «desenha», and the
ACCESSIBILITY modules came back flagged as a platformer's furniture. The second pass used word boundaries and
flagged them anyway, because their comments explain themselves with «a lava» and «uma moeda». What settled it was
asking what each module PUBLISHES — and for a record, the equivalent is **reading what it decides**.

So the counts below are a map of where to look, never a verdict. Every record proposed for a move was read.

### What the 228 records are, measured

| by what the `confirmed-by` names | how many |
|---|---|
| engine paths only | 70 |
| more than one repository | 0 |
| no `confirmed-by` at all | 158 |

| by what the PROSE names | how many |
|---|---|
| only the engine | 63 |
| the engine **and** at least one game | 26 |
| only a game | 17 |
| neither | 122 |

⚠️ **The 17 that name only a game are mostly not a game's**, which is exactly why the prose count cannot decide.
Reading them: ADR-0084 («topology is a function because a board can change») names `game-chess` as the EVIDENCE for
a contract decision; ADR-0097 names five games because it is about a hosting ADDRESS; ADR-0120 and ADR-0121 name
four because they are about the engine's pause menu and who consumes it. A record cites a game to make a point far
more often than to belong to one.

### The rule

A record belongs to a repository when **the thing it decides lives there**. Three families stay in `docs`
regardless of which repositories they name:

- **contract** — what a cartridge declares and what the engine guarantees (ADR-0111, ADR-0216, ADR-0224…). It
  belongs to neither side, and a folder cannot say «contract».
- **process, hosting, licences, delivery, curriculum** — what belongs to no single repository (ADR-0057,
  ADR-0058, ADR-0064, ADR-0126, ADR-0128…).
- **the engine's own** — the 70 with engine-only confirmations, and the decisions about what the engine draws,
  speaks, hears and refuses.

### The SIX that move to `game-platformer`

Each line is the sentence in the record that settles it.

> 🔴 **Correction, same day: this section said SEVEN, and ADR-0034 does not move.** It decides the password split
> `core/password` / `game/progress`, and that module did leave with the tile world (ADR-0228) — but ADR-0034 is
> `superseded` by **ADR-0037**, which stays. Moving it splits a supersession pair across two repositories: the
> old half would sit in a game's tree pointing at a successor that game does not have. **A superseded record
> belongs where its successor is.** 📏 Found by copying the files and running the validator on the game's tree,
> not by reading — which is the argument for the order ADR-0229 fixes.

| record | what it decides | the evidence |
|---|---|---|
| **ADR-0016** City scenario & themes | the city level and its themes | «Level-design detail in `../../game-design/plan-city-scenery.md`» |
| **ADR-0041** The letter grid splits | `core/letter-grid` mechanics vs. screen | same — `core/letter-grid` is the platformer's since ADR-0228 |
| **ADR-0042** The City parallax is generated art | `render/city-tiles`, `cenarios/cidade/c2..c4.png` | «both City tiles are data in `render/city-tiles.ts`» |
| **ADR-0061** The no-littering sign bars the CHILD | the recycling activity's rule and its level data | «put a PROIBIDO JOGAR LIXO sign in the platformer level» |
| **ADR-0062** The tenth coin closes a LAP | the round's lifecycle | «The platformer has ten coins as its round objective… `win()` in `game/session`» |
| **ADR-0174** The platformer's title menu leaves the engine | that menu and its 161 dictionary keys | the title says it |

📌 **Three of the six are ADR-0228's wake**: they decide about modules that were the engine's when the record was
written and are the platformer's now. That is the fifth cause the dead-pointer book learned during F12 — a pointer
that did not die and was not renamed, but changed REPOSITORY — and it applies to records exactly as it applied to
test files.

### TWO records are already broken, and F12 broke them

📏 The validator, run before anything moved, says **228 records · 226 sound · 2 with problems** — and both are
`confirmed-by` paths that left with the tile world:

- **ADR-0037** (there is no save) → `engine:tests/password.node.test.js`
- **ADR-0102** (the skip-link outranks the transition) → `engine:app/js/core/layers.ts`,
  `engine:tests/z-order-css.node.test.js`, `engine:tests/layers.node.test.js`

⚠️ **Neither of the two is a game's record**: ADR-0037 is about the project storing no child data, and ADR-0102 is
about an exit being reachable. What has to change is not their address but their CONFIRMATION, which must name the
repository where the proof now lives. That is the repair, and it is separate from the move.

🔴 And it is the exact failure ADR-0123 exists to make visible: the engine's whole suite is green while four
`confirmed-by` point at nothing. Only the validator with `--repo` sees it.

### What happens next, in order

1. The six move, with their `confirmed-by` paths rewritten from `engine:` to `game-platformer:`.
2. ADR-0037 and ADR-0102 get their confirmations repaired in place — an erratum, not a supersession: the decision
   did not change, the address of its proof did (ADR-0057's test).
3. The validator runs again with `--repo` on both sides. The number to beat is **228 · 226 · 2**.
