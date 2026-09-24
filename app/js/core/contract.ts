// SPDX-License-Identifier: AGPL-3.0-or-later
// core/contract — THE SEVEN FIELDS. The interface ADR-0030 chose as the engine's axis.
//
// ⚠️ Its one import is `import type` — erased at compile time, so the published module keeps no run-time dependency.
// What comes in is the VOCABULARY of the fourteen positions (ADR-0074), and it had to: a field about mapping that wrote
// its own keys would be a second copy of the union `core/actions` exists to be the first of.
//
// ========================= WHAT THIS IS, AND WHAT IT IS NOT =========================
// Not a framework nor a base class. It is the ONLY thing the accessibility stack knows about a game. ADR-0027 measured
// that the three functions that looked MOST generic were the three most tied to the platformer — the role table was a
// tile table, the cane probe used facing and a hitbox, the sonar defined a target as "a coin this player has not taken".
// None was wrong; all were GUESSING the game instead of asking.
//
// These seven fields are the questions. A game that answers them gets sonar, high contrast, scanning, screen reader and
// Libras without writing a line of them — which is the product, not "one more 2D engine" (ADR-0027).
//
// ========================= PURE, ON PURPOSE =========================
// Only TYPES and pure functions. No dependencies, no I/O at import: a LEAF module, importable from both sides of the
// boundary and from the `node` project. A contract that needed PIXI would already have chosen the genre.
//
// ========================= HOW IT IS USED: SLICES, NOT THE FAT OBJECT =========================
// The rule of `core/entity` holds here too: a consumer declares the MINIMAL slice it needs, with `Pick`, instead of
// receiving the whole declaration. High contrast wants `Pick<GameDeclaration, 'roleAt'>` and nothing else; the HUD wants
// `'objective'`. A fat interface would destroy the project's testability — every fixture would invent fields the module
// does not use.
//
// ========================= EVIDENCE =========================
// Each field was born from a REAL consumer that used to guess, and ADR-0030 records that "the contract is enough" only
// becomes a result when TWO presets exist.

/* ===================== 3 · SPEAKABLE NAME ===================== */
//
// It comes first because the other fields use it. And it is the most underestimated: without a name there is no screen
// reader AND NO LIBRAS, because `vlibrasSay` translates TEXT — the same datum serves both outputs, which is why ADR-0027
// says it is "required TWICE".
//
// GENDER AND PLURAL are not grammatical fussiness: in Portuguese the frame AGREES with the content. "the gate is locked"
// takes a different adjective ending for a masculine and a feminine noun, and without the gender one of the two comes
// out wrong. Whoever builds the sentence needs to know, and only the game knows.

import type { Action } from './actions.js';

/** The name's grammatical gender. `n` = neuter/unknown (Portuguese uses the masculine as the default then). */
export type Gender = 'm' | 'f' | 'n';

/** A name that can be SPOKEN (screen reader) and SIGNED (Libras, which translates the same text). */
export interface Speakable {
  /** The name, in the interface's language. Curriculum content is NOT translated — see pillar 3 of ADR-0010. */
  readonly text: string;
  readonly gender: Gender;
  readonly plural: boolean;
}

/* ===================== 1 · TOPOLOGY OF THE NAVIGABLE SPACE ===================== */
//
// WITH A METRIC, and the metric is the point: without it there is no "nearer", and without "nearer" there is no sonar.
//
// The three shapes cover ADR-0027's catalogue: GRID (Sokoban, board, Braille cell), CONTINUOUS (platformer, top-down,
// racing) and ORDERED LIST (quiz, menu, multiple choice) — where there is no space at all, only order.

/**
 * HOW A STEP IS COUNTED — and that is what decides the metric, which is not the same on every board.
 *
 * ⚠️ The grid had ONE fixed metric (Chebyshev), on the reasoning that on a grid a diagonal costs one step. True where the
 * diagonal is legal. **False in a sliding puzzle**, where nothing moves diagonally: a piece two right and two down is 2
 * away by Chebyshev and FOUR moves away. The sonar under-reported up to 2× — and under-reporting distance to someone who
 * cannot see the screen is not imprecision, it is sending the child the wrong way with confidence.
 *
 * `grid` was never ONE thing. Whoever declares a grid declares how one walks on it.
 */
export type MoveRule =
  | 'orthogonal'  // L¹ (Manhattan) — sliding puzzle, Sokoban, rook. There is no diagonal.
  | 'diagonal'    // L∞ (Chebyshev) — chess king, 8-way top-down. A diagonal costs one step.
  | 'free';       // L² (Euclidean) — continuous space, with no discrete step at all.

/**
 * IN WHAT WORDS A DIRECTION IS SAID. Not the listener's preference: a property of the game's SPACE.
 *
 *   `compass`  north · south · east · west (+ zenith and nadir) — board, top-down, map, 3D
 *   `clock`    "at 2 o'clock", "at 10 o'clock" — a 2D PLATFORMER, side view
 *
 * ⚠️ In a platformer north and south mean nothing: the child is not looking at a map, they are looking from the side.
 * The clock is the frame that view already uses, and gives 12 positions where the rose gives 8.
 *
 * ⚠️ AND THE CLOCK ASSUMES READING AN ANALOGUE CLOCK, for an audience that includes early literacy. Not a reason to
 * refuse it — a reason for the SPOKEN label to be tested with children (issue #7) before it is declared good.
 */
export type Frame = 'compass' | 'clock';

export type Topology =
  /**
   * A discrete grid. Distance is in CELLS, and the metric comes from `move`.
   * `size` is `[columns, rows]` or `[columns, rows, layers]`.
   */
  | { readonly kind: 'grid'; readonly size: readonly number[]; readonly move: MoveRule; readonly frame: Frame }
  /**
   * Continuous space. Distance is in world UNITS; `unit` says what a "step" is worth to the narrator.
   * `size` is `[width, height]` or `[width, height, depth]`.
   */
  | { readonly kind: 'continuous'; readonly size: readonly number[]; readonly unit: number; readonly move: MoveRule; readonly frame: Frame }
  /** No space: an ORDERED list of targets. Distance is the difference of index, and there is no direction. */
  | { readonly kind: 'hotspots'; readonly order: readonly string[] };

/**
 * A position, in the declared topology's metric. In `hotspots`, `x` is the index and `y` is ignored.
 *
 * ⚠️ A DELIBERATE ASYMMETRY WITH `size`. The EXTENT is a vector because the dimension varies and `size.length` is the
 * one place it lives — otherwise "does it have depth?" would become `depth !== undefined` in every consumer. The POINT
 * has named axes because code reads it all the time: `target.at.x` says what it is, `target.at[0]` makes you remember.
 * The dimension is 2 or 3 and conformance refuses the rest, which closes the asymmetry: there is no `size` `Spot`
 * cannot represent.
 */
export interface Spot { readonly x: number; readonly y: number; readonly z?: number }

/** The dimension the topology declares. `hotspots` has no space, so no dimension. */
export function dimension(t: Topology): number { return t.kind === 'hotspots' ? 0 : t.size.length; }

/** Axis `i` of a point, for whoever walks dimensions instead of naming them. */
function axis(s: Spot, i: number): number { return i === 0 ? s.x : i === 1 ? s.y : (s.z ?? 0); }

/* ===================== 2 · SEMANTIC ROLE ===================== */
//
// PER CELL OR ENTITY, and DECOUPLED FROM COLOUR AND SPRITE — that separation is what makes colour-blocking exist. A table
// of tile numbers is true of ONE map, and ADR-0027 calls it "the codebase's no. 1 coupling".
//
// `structure` is not "no role": it is the role of being scenery. The difference matters — high contrast NEEDS to know a
// wall is a wall to leave it grey, instead of knowing nothing about it.

export type Role =
  | 'hazard'     // hurts on contact
  | 'climb'      // height changes by interacting with it
  | 'water'      // crossed by swimming
  | 'goal'       // what the round asks for
  | 'gate'       // bars until a condition
  | 'key'        // satisfies a `gate`
  | 'structure'  // scenery: floor, wall, what holds things up
  | 'free';      // crossable, with no meaning of its own

/* ===================== 4 · FOCUS ===================== */
//
// WHO has the focus and WHERE it points. A cane taps "ahead", and "ahead" on a grid is eight directions, in a quiz it is
// the next item of the list.
//
// `heading` is eight directions plus `none` because that covers grid and continuous space without inventing an angle: a
// top-down game walks diagonally, a platformer only 'e'/'w', and a quiz points nowhere.

/**
 * ⚠️ `zenith` AND `nadir` EXIST BECAUSE `up`/`down` ALREADY MEAN TWO THINGS. `ACTIONS` (core/actions) has `up` and
 * `down` as CONTROL ACTIONS — what the child presses — and the vertical axis of SPACE is something else entirely. On a
 * flat world the ambiguity cost nothing; in three dimensions it would cost the worst kind of defect, one that reads right
 * and does something else. Words of their own, before 3D arrives.
 */
export type Heading = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw' | 'zenith' | 'nadir' | 'none';

/**
 * WHERE A POINT LIES AS SEEN FROM ANOTHER, already in the frame the topology declares.
 *
 * ⚠️ NOT THE FOCUS'S `heading`, and the difference is the defect this fixes. `Focus.heading` is where the child is
 * FACING; this is where the TARGET is. The sonar needs the second and used to compute it by hand from a raw `x`, saying
 * `left`/`right`/`ahead` — three words where the contract has eight, and MIXING FRAMES: left/right is relative to the
 * screen, ahead is relative to the body. A blind child hearing both in one sentence cannot know which origin each one
 * speaks from.
 */
export type Bearing =
  | { readonly kind: 'compass'; readonly heading: Heading }
  | { readonly kind: 'clock'; readonly hour: number }  // 1..12, as on the dial
  | { readonly kind: 'none' };                          // the same place, or a list with no space

export interface Focus {
  /** Who has the focus. A game id — the engine does not interpret it, only carries it. */
  readonly id: string;
  readonly at: Spot;
  readonly heading: Heading;
}

/* ===================== 5 · OBJECTIVE AND TARGET ===================== */
//
// A HUD that takes a coin target is the example ADR-0027 itself uses to ask whether the boundary is right: a game with
// no coins has nothing to pass there.
//
// `have`/`need` instead of a finished sentence: that lets the FRAME translate ("{have} of {need}") while the NAME
// crosses — the rule pillar 3 applies to curriculum.
//
// ========================= THE FIELD HAS TWO HALVES =========================
// ADR-0027 calls this field "objective AND TARGET". The objective alone — how many of how many — cannot answer the
// SONAR's question, "which target is nearest and on which side": a counter locates nothing.
//
// `targetsOf` is the other half. It is a FUNCTION returning positions, not a sweep of the map, and that is the point:
// `roleAt` says what is at a spot, but in a CONTINUOUS space the spots cannot be enumerated, and on a large map
// enumerating would cost a frame. Whoever knows where the targets are is the game — it always kept that list — and it
// HANDS it over instead of the engine digging through an array of coins with owners and collected flags.

export interface Objective {
  /** What is being gathered/solved: "coins", "words", "sums". */
  readonly name: Speakable;
  readonly have: number;
  readonly need: number;
}

/* ===================== 6 · WHOSE TURN IT IS ===================== */
//
// ADR-0027 names it as the bit that separates Sokoban from Snake and decides whether SCANNING and WCAG 2.2.1 (Timing
// Adjustable) apply: on the player's turn time does not press and a scan can wait; on the clock's, it has to keep up.
// Its readers today are the ones time pressure concerns: the game speed is offered only where time runs by itself.

export type TickOwner = 'player' | 'clock';

/* ===================== 7 · EVENT VERSUS STATE ===================== */
//
// ⚠️ NO READER YET, with one half already built: `core/a11y-sr` has `srSay` (polite) and `srAlert` (assertive), and the
// distinction still missing is the third — the STATE, which is not announced but CONSULTED.
//
// A state is true until it changes and answers "what is this?" at any moment (`aria-label`). An event happened and must
// be said ONCE (`aria-live`). Confusing them gives the two classic defects: a state announced every frame becomes
// chatter, and an event that can only be consulted is never noticed.

export type Announcement =
  | { readonly kind: 'state'; readonly name: Speakable }
  | { readonly kind: 'event'; readonly name: Speakable; readonly urgent: boolean };

/* ===================== 8 · THE WORLD ===================== */
//
// WHICH ELEMENT IS THIS GAME'S WORLD. The defect it fixes is the most serious the accessibility stack ever had.
//
// ========================= THE DEFECT, MEASURED =========================
// The empathy simulations reach the WORLD and spare the menus, for a reason that is right and written down: the menu is
// how one LEAVES the simulation, and a blindness that erased the pause menu would lock the child inside it (issue #82).
//
// ⚠️ IN A GAME WHOSE VISIBLE CONTENT IS DOM, THAT INVERTS. `blind` (`brightness(0)`) blacks out a canvas nobody is
// looking at and leaves the numbers perfectly readable: the simulation comes out backwards, and an adult is told they
// felt something they did not. For a product whose reason to exist is making no false claim about accessibility, it is
// the worst class of defect there is.
//
// ⚠️ AND THE OBVIOUS FIX IS WRONG, measured before choosing: filtering the whole game region fixes one game and BREAKS
// another whose menu layer sits INSIDE that region, because a CSS filter is inherited — the pause would black out too.
// The same line, opposite results, because the contract does not guarantee the DOM's shape. So it is a DECLARATION.

/**
 * What the child sees as being the game.
 *
 * ⚠️ `none` IS NOT A DEFAULT, IT IS A WRITTEN CHOICE. It exists for an activity without space — free painting,
 * authoring, a form — where there is no world to simulate over and no target for a sonar. The Dev named the case:
 * «atividades como paint não são exatamente jogos, mas podem ser feitas com a engine e sonar não vai funcionar muito
 * bem».
 *
 * ⚠️ AND WHAT IT CANNOT BE IS WHAT HAPPENS WHEN SOMEONE FORGETS. A pure-DOM game is not a game where empathy makes no
 * sense: blindfold chess is the empirical proof that it does. `none` is for whoever DECLARES they have no space, and the
 * field's absence is refused — otherwise both would produce the same silence.
 */
export type WorldScope =
  /** The selector of the element that is the world. The engine applies what belongs to the world there, and only there. */
  | { readonly kind: 'element'; readonly selector: string }
  /** No space. Empathy and sonar are NOT offered — and the selection screen says so before the child starts. */
  | { readonly kind: 'none' };

/* ===================== THE DECLARATION ===================== */

/**
 * What a game hands the engine. `tick` is data; EVERYTHING ELSE is a function, because the answer changes with the
 * position, the player and the instant.
 *
 * ⚠️ DO NOT IMPORT THIS WHOLE into a consuming module. Use `Pick<GameDeclaration, 'roleAt'>` and the like — the rule of
 * `core/entity`, which keeps test fixtures small.
 */
export interface GameDeclaration {
  /**
   * The shape of the space NOW.
   *
   * ⚠️ It was a value, and the asymmetry had been patched in two places before anyone named it: the sonar's port always
   * asked for a function, and the root bridged it with a function returning a constant. A sliding puzzle whose board
   * size changes needed a getter to fit the type — and a getter that satisfies an interface is a TypeScript
   * COINCIDENCE, not a contract: nothing told the next author it was expected, and conformance read it once, so whoever
   * memorised the topology went stale in silence. A patch that shows up twice is the contract asking to change.
   * ADR-0084.
   */
  topology(): Topology;
  /**
   * WHICH ELEMENT IS THE WORLD. See block 8 above for the defect this field fixes.
   *
   * ⚠️ REQUIRED, and requiring it is the decision. The original proposal was an optional field with a default; the Dev
   * refused, and the reason is BLINDFOLD CHESS: it exists, so a pure-DOM game is not one where empathy makes no sense —
   * it is one where it asks more of whoever programs it. A default would let forgetting pass as a choice.
   */
  world(): WorldScope;
  /**
   * HOW MANY POSITIONS THIS GAME NEEDS HELD AT THE SAME TIME. Run + walk + jump is THREE; a quiz is ONE. (ADR-0104 §A.)
   *
   * ⚠️ A DIFFERENT AXIS FROM "HOW MANY ACTIONS", and because they are not the same there was a blind spot where the
   * warning never fired: a game declaring nine actions on a pad with nine places reached them all, so the reach notice
   * never appeared — but running, walking and jumping at once is three fingers, and on a two-finger phone the child
   * simply cannot, with nothing anywhere saying why. Reaching an action and holding it with another are two questions.
   *
   * ⚠️ REQUIRED, and requiring it IS the decision, in the Dev's words: «os 300 jogos precisam declarar sim! Não declarar
   * é ter a acessibilidade programada no controle pro sorte». An optional field is answered by SILENCE, and here the
   * silence decides for the child — decided by whoever did not think about it.
   *
   * A FUNCTION and not a value, like `topology`: a game with stages changes its demand between them — on foot it asks
   * for three, in a vehicle perhaps one. A memorised value would go stale in silence, the defect ADR-0084 named.
   */
  holdsAtOnce(): number;
  /**
   * DOES THIS GAME HOLD ANY KEY? — and the answer cannot be derived from anything else. (ADR-0115.)
   *
   * 🔴 THE TOGGLE EXISTS FOR A CONCRETE CHILD: whoever cannot KEEP a key pressed taps once to walk and again to stop. In
   * a game where nothing is held — a quiz, a board, a tile puzzle — there is nothing to latch, and the setting becomes
   * an option that **does nothing**. The child opens the accessibility menu, turns on the setting they depend on, and
   * nothing happens: they learn the setting is broken. It is the dead button ADR-0106 §5 forbids.
   *
   * ⚠️ AND `holdsAtOnce` ABOVE DOES NOT ANSWER THIS, which is the finding that forced this field: it counts SIMULTANEOUS
   * positions and refuses zero, because zero would pass the reach arithmetic vacuously. The demo quiz declares **1
   * while holding nothing at all**. "One at a time" and "one HELD" are the same number, and every decision downstream
   * was reading a number that answers another question.
   *
   * ⚠️ REQUIRED, and requiring it IS the decision — the same as `holdsAtOnce`, by the same words of the Dev. An optional
   * field would let a game that FORGETS the line lose the toggle in silence, and the child with a motor difficulty pays.
   *
   * 📌 A FUNCTION and not a value, by ADR-0084: a game changes its demand between stages. On foot one holds a direction;
   * the same game in a vehicle may hold nothing.
   */
  holdsKeys(): boolean;
  /**
   * DOES THIS GAME NEED A POINTER — a continuous position? (ADR-0112.)
   *
   * A drawing game does; a quiz does not. Declaring it makes a device without a pointer REFUSE before the child starts,
   * instead of them finding out halfway through the first stroke.
   *
   * ⚠️ OPTIONAL, AND THE DIFFERENCE FROM `holdsAtOnce` JUST ABOVE IS DELIBERATE — copying its requirement would apply a
   * rule whose premise does not hold here. `holdsAtOnce` is required because it has no safe default AND fails INVISIBLY to
   * whoever writes the game: they have a full keyboard, the game runs, and the child on a two-finger phone is who finds
   * the defect. This one has a safe default (`false`) and fails VISIBLY — a drawing game that forgets to declare it is
   * unusable on its own author's device, because they would need the pointer to try it.
   *
   * A FUNCTION and not a value, like the others: an activity may draw in one stage and not in another.
   */
  needsPointer?(): boolean;
  /**
   * THE KEYBOARD MAPPING THIS GAME WANTS — by number of players and by seat (ADR-0115).
   *
   * The precedence is the one the record asks for: **the engine's factory → the GAME's default → the CHILD's remap.**
   * Returning `null` (or not declaring it) leaves the engine's factory untouched, which is the behaviour it always had.
   *
   * PARTIAL on purpose: a game that only wants to change `action1` changes `action1`. The merge already exists — the
   * `Object.assign` that lays the stored data on top — so this is one more layer in the same place, not a second way to
   * merge.
   *
   * ⚠️ OPTIONAL, and here, unlike `holdsKeys`, silence has a safe side: with no declaration the game keeps the engine's
   * factory, which is playable and is what it has today.
   *
   * ⚠️ AND IT TAKES THE SEAT because a two-player keyboard is not a one-player one: the arrows change owner, and a
   * default that did not know the seat would give two children the same keys. `players` is 1, 2, 3 or 4; `seat` is the
   * index within that arrangement.
   */
  keyboardMapping?(players: number, seat: number): Partial<Record<Action, readonly string[] | null>> | null;
  /**
   * THE BUTTON MAPPING THIS GAME WANTS ON A PAD — the same question, another device (ADR-0115).
   *
   * Button indices of the "standard" Gamepad API, partial: `{ action1: 3 }` changes just that one. `null` on a button
   * says "this position does not exist in this game", which differs from leaving it at the factory.
   *
   * ⚠️ THE PRECEDENCE SITS IN A DIFFERENT PLACE, worth knowing: on the keyboard, the child's remap is a layer ON TOP of
   * this; on a pad, the map they recorded in the wizard is a whole BRANCH — if it exists, this default is not consulted.
   * Either way the child wins, which is what matters.
   *
   * 📌 It takes the seat for the keyboard's reason, by another path: two pads are two devices, but the GAME may want
   * different arrangements per seat (a goalkeeper and a striker do not do the same thing).
   */
  padMapping?(players: number, seat: number): Partial<Record<Action, number | null>> | null;
  readonly tick: TickOwner;
  /** The role of what is at `at`. Field 2, and what replaces a table of tile numbers. */
  roleAt(at: Spot): Role;
  /** What the thing at `at` is called. Without it there is no screen reader and no Libras. */
  nameAt(at: Spot): Speakable | null;
  /** Who has the focus now, and where it points. `null` = nobody (menu closed, round not started). */
  focusOf(playerIndex: number): Focus | null;
  /** What the round asks of this player. */
  objectiveOf(playerIndex: number): Objective;
  /**
   * WHERE this player's still-valid targets are — the second half of field 5.
   *
   * Instead of the engine sweeping an array of coins and filtering by owner and taken, the game returns the spots that
   * still count for THIS player. A quiz returns the open question's index; a platformer, the coins not taken; a
   * Sokoban, the boxes out of place. The engine only compares distances, which is why the sonar serves any genre.
   *
   * Empty is a legitimate answer and means "there is nowhere to point" — not an error.
   */
  targetsOf(playerIndex: number): readonly Spot[];
}

/* ===================== CONFORMANCE ===================== */

/**
 * The problems of ONE declared field. EMPTY means that field is well formed.
 *
 * 🎯 ONE CHECK PER FIELD, AND A TABLE CALLING THEM, and it is not tidying: while the ten checks lived in one function it
 * had 53 decision paths against McCabe's ceiling of 10 (ADR-0221) — and the ruler was not exaggerating, because nobody
 * could read "what the contract asks of field X" without walking the other nine. Adding a field to the contract is
 * adding a ROW to the table, the shape this house already uses for a key's glyph, an action's edge, an icon's rule and a
 * frame's situation.
 */
type FieldCheck = (d: Partial<GameDeclaration>) => string[];

function topologyProblems(d: Partial<GameDeclaration>): string[] {
  // ⚠️ TWO DIFFERENT FAILURES, AND THEY NEED TWO MESSAGES. A missing `topology` is a field nobody wrote; a `topology`
  // that is not a function is the field written the old way — a VALUE, which passed the TypeScript of whoever had not
  // recompiled and would die in production with "topology is not a function". Saying only "missing" would send the
  // author looking for a field that is right there.
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
 * 🎯 THREE DIFFERENT QUESTIONS TO A MEASURED SPACE, and separating them was the ratchet pointing at the right cut
 * instead of being asked for an exception: together, `topologyProblems` sat at 22 against McCabe's 10. They really are
 * three — HOW BIG the space is, IN WHAT UNITS distance is counted, and IN WHAT WORDS direction is said — and each has a
 * child on the other side.
 */
type MeasuredSpace = Extract<Topology, { kind: 'grid' | 'continuous' }>;

// ⚠️ THE DIMENSION IS `size.length`, which is why it is checked BEFORE anything: an empty or four-entry `size` is not a
// bad measurement, it is a space `Spot` cannot represent — and the error would show far from here, as an axis simply
// ignored.
function sizeProblems(t: MeasuredSpace): string[] {
  if (!Array.isArray(t.size) || t.size.length < 2 || t.size.length > 3) {
    return ['topology.size: must be [w, h] or [w, h, d] - dimension is 2 or 3, and it is size.length'];
  }
  return !t.size.every((n) => n > 0) ? ['topology.size: every extent must be positive'] : [];
}

function metricProblems(t: MeasuredSpace): string[] {
  const p: string[] = [];
  // `move` decides the metric. Absent, distance would be guessed — and guessing Chebyshev in a sliding puzzle
  // under-reports up to 2×, finding §3 of ADR-0080.
  if (t.move !== 'orthogonal' && t.move !== 'diagonal' && t.move !== 'free') {
    p.push('topology.move: must be "orthogonal" (L1), "diagonal" (L8/Chebyshev) or "free" (L2) - it is the metric the sonar counts in');
  }
  // `unit` is what gives a continuous space a METRIC: without it, "two steps away" cannot be said.
  if (t.kind === 'continuous' && !(t.unit > 0)) {
    p.push('topology.continuous: unit must be positive (it is the metric the narration counts in)');
  }
  return p;
}

// `frame` is in what WORDS a direction is said. Without it the engine would choose for the child, and in a platformer it
// would choose badly: north and south mean nothing in a side view.
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
  // ⚠️ THREE DISTINCT FAILURES, and the third is the one this field exists to make impossible: a game whose world was
  // NOT declared. Before this field, forgetting and choosing "I have no space" produced the same silence — and the
  // silence was resolved by the engine guessing that the world is the canvas.
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
  // ⚠️ THE MESSAGE NAMES THE WAY OUT, like the others do. A game that does not declare this gets no default — it gets a
  // sentence saying what to ask itself, because the answer is the game's and nobody else's. (ADR-0104 §A.)
  if (typeof d.holdsAtOnce !== 'function') {
    // ⚠️ THE MESSAGE NAMES NO GENRE, and the boundary gate insisted: a first wording used a quiz as the example and the
    // gate refused the word in a line of engine CODE. It was right, and the sentence got better: it describes the SHAPE
    // of the question, which serves every game, instead of two examples that serve two.
    return ['holdsAtOnce: missing - declare how many positions are held AT ONCE (three if three fingers must press together, one if commands arrive one at a time)'];
  }
  const n = d.holdsAtOnce();
  // Zero is not "uses no controls": a game that holds no position cannot be played, and returning zero would pass the
  // reach arithmetic vacuously — the same defect `reachable` refuses.
  return !Number.isInteger(n) || n < 1
    ? ['holdsAtOnce: must be an integer >= 1 - a game that holds nothing cannot be played']
    : [];
}

function latchingProblems(d: Partial<GameDeclaration>): string[] {
  // ⚠️ AND THIS IS THE OTHER QUESTION, which the number above seemed to answer and does not (ADR-0115). The message says
  // what the absence COSTS, not only what is missing: without it a game that holds nothing offers an accessibility
  // control that does nothing, and one that holds everything may not offer it to whoever depends on it.
  if (typeof d.holdsKeys !== 'function') {
    return ['holdsKeys: missing - declare whether any key is HELD in this game (latching is offered only where something can be held, and a game that holds nothing must not show a control that does nothing)'];
  }
  // A non-boolean would be truthy and offer the toggle to everyone — the same silent defect `needsPointer` refuses just
  // below, for the same reason.
  return typeof d.holdsKeys() !== 'boolean'
    ? ['holdsKeys: must return a boolean - a non-boolean is truthy and would offer latching in a game where nothing is held']
    : [];
}

function pointerProblems(d: Partial<GameDeclaration>): string[] {
  // ⚠️ OPTIONAL, BUT NOT UNCHECKED. Absent is the answer `false` and no problem — see the note on the field. What is
  // refused is declaring it WRONG: `needsPointer: true` (a value instead of a function) would always be truthy for
  // being an object, and one returning a string too. Either way the game would believe it had declared, the reach would
  // read something other than what it meant, and nobody would know — the silent defect this whole function exists to
  // prevent.
  if (d.needsPointer === undefined) return [];
  if (typeof d.needsPointer !== 'function') {
    // ⚠️ MESSAGES WITHOUT THE WORD `as`, worth a line because it bites again: the raw-prose detector of `engine-i18n`
    // matches isolated function words, and `as` is a plural article in Portuguese. An ENGLISH message saying
    // "declare it as …" is counted as raw text and raises the module's ceiling. Rewording costs nothing; loosening the
    // detector would cost the reason it exists.
    return ['needsPointer: must be a function - write `needsPointer: () => true`, because a game may draw in one phase and not in another'];
  }
  return typeof d.needsPointer() !== 'boolean'
    ? ['needsPointer: must return a boolean - a non-boolean would be truthy and refuse devices this game can actually use']
    : [];
}

/**
 * A MAPPING DECLARED BY THE GAME, for the keyboard or the pad.
 *
 * 🔴 IT WAS THE SAME CHECK WRITTEN TWICE, and the two copies were not equally guarded: the keyboard's two decisions had
 * cases and the pad's two were BLIND — asymmetric coverage is how a duplicate announces itself, because one copy gets
 * attention and the other is assumed.
 *
 * ⚠️ Here a value instead of a function would not be a loud error, it would be a mapping SILENTLY ignored — the engine's
 * factory would stay, and the child would play with controls the game's author believes they changed. And returning
 * something that is neither an object nor `null` would pass through `Object.assign` writing nothing, the same absence in
 * other clothes.
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

/** The five questions the engine asks the world. Each absent one is ONE problem, and the message says WHICH is missing. */
const READERS = ['roleAt', 'nameAt', 'focusOf', 'objectiveOf', 'targetsOf'] as const;
const readerProblems: FieldCheck = (d) => READERS.filter((f) => typeof d[f] !== 'function').map((f) => `${f}: missing`);

/**
 * 📌 THIS TABLE'S ORDER IS THE ORDER OF THE MESSAGES, and it matters to the reader: an author writing a preset gets the
 * problems in the order the fields appear in the contract, not in the order this file grew.
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
 * Is a declaration well formed? Returns the list of problems — EMPTY means conformant.
 *
 * It exists because a preset is a promise, and a promise without a check is a comment. ADR-0030 says a genre package
 * "either satisfies the seven fields or does not"; this is the "does not".
 *
 * It checks SHAPE, not truth: that the topology has a positive measure, that the functions exist. It cannot check
 * whether `roleAt` returns the RIGHT role — that is the preset's own test, not this module's.
 */
export function conformanceProblems(d: Partial<GameDeclaration> | null | undefined): string[] {
  if (!d) return ['declaration missing'];
  return FIELD_CHECKS.flatMap((check) => check(d));
}

/** Is a speakable name well formed? Empty text is the silent defect: the screen reader simply goes quiet. */
export function speakableProblems(s: Speakable | null | undefined): string[] {
  if (!s) return ['name missing'];
  const p: string[] = [];
  if (!s.text.trim()) p.push('text: empty - the screen reader would fall silent');
  if (s.gender !== 'm' && s.gender !== 'f' && s.gender !== 'n') p.push('gender: must be m, f or n');
  if (typeof s.plural !== 'boolean') p.push('plural: must be a boolean');
  return p;
}

/**
 * The distance between two spots IN THE DECLARED METRIC — the one the game declared in `move`, over as many dimensions
 * as it declared in `size`. It is what the sonar needs and used to compute in pixels.
 *
 * ⚠️ THE GRID WAS ALWAYS CHEBYSHEV, which cost up to 2× error in a sliding puzzle. The three rules are not taste: they
 * are what "one step" means in each game, and the sonar speaks in steps.
 */
export function distance(t: Topology, a: Spot, b: Spot): number {
  // A list: the distance is how many items lie between. There is no axis, so there is no movement rule.
  if (t.kind === 'hotspots') return Math.abs(a.x - b.x);

  const d: number[] = [];
  for (let i = 0; i < t.size.length; i++) d.push(Math.abs(axis(a, i) - axis(b, i)));

  const rawDistance = t.move === 'orthogonal' ? d.reduce((s, v) => s + v, 0)  // L¹: each axis costs on its own
    : t.move === 'diagonal' ? Math.max(...d)                            // L∞: a diagonal costs one step
      : Math.hypot(...d);                                               // L²: the straight line between them
  // Continuous: divided by the unit — the result is "how many steps", not "how many pixels".
  return t.kind === 'continuous' ? rawDistance / t.unit : rawDistance;
}

/**
 * WHERE `to` LIES AS SEEN FROM `from`, already in the words the topology declared.
 *
 * ⚠️ TWO AXES WITH DIFFERENT CONVENTIONS, and silence about it would be the defect. `y` GROWS DOWNWARD — the screen's
 * coordinate, inherited from the canvas and all existing code, not a choice of this function. `z` GROWS UPWARD, and
 * that is a choice: nothing forces it, and in three dimensions "zenith" can only mean the side the child would look at
 * by raising their head. A 3D game has to know both.
 */
export function bearing(t: Topology, from: Spot, to: Spot): Bearing {
  if (t.kind === 'hotspots') return { kind: 'none' };

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = t.size.length > 2 ? (to.z ?? 0) - (from.z ?? 0) : 0;
  const plane = Math.hypot(dx, dy);

  // SPACE's vertical axis wins when it dominates the plane — and wins in words of its own, because `up`/`down` are
  // already ACTIONS in `core/actions`. See the comment on `Heading`.
  if (Math.abs(dz) > plane) return { kind: 'compass', heading: dz > 0 ? 'zenith' : 'nadir' };
  if (plane === 0) return { kind: 'none' }; // the same place: there is no direction to say, and inventing one would lie

  // `-dy` because north is UP and `y` grows downward. Without this swap the rose comes out inverted, and the test that
  // would catch it is the only one that needs to exist here.
  const ang = Math.atan2(-dy, dx); // 0 = east, growing anticlockwise

  if (t.frame === 'clock') {
    // 12 o'clock is UP and the hands move clockwise — hence `90 - degrees`, not `degrees`.
    const clockwiseDegrees = ((90 - (ang * 180) / Math.PI) % 360 + 360) % 360;
    const h = Math.round(clockwiseDegrees / 30) % 12;
    return { kind: 'clock', hour: h === 0 ? 12 : h };
  }
  const COMPASS_ROSE: readonly Heading[] = ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se'];
  return { kind: 'compass', heading: COMPASS_ROSE[(Math.round(ang / (Math.PI / 4)) % 8 + 8) % 8] };
}
