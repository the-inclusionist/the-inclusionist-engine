// SPDX-License-Identifier: AGPL-3.0-or-later
// input/camera-gestures — what a hand, a face and the eyes do in front of the camera, read as COMMANDS (ADR-0197; issue #189).
//
// The Dev's first mappings, decided on 2026-09-14. This module is pure: it takes what the vision runtime gives per frame — a hand's
// 21 landmarks (MediaPipe Hands, x and y from 0 to 1, y growing downwards), a canned gesture's name (MediaPipe Gesture Recognizer),
// a face's blendshape scores and its transformation matrix (MediaPipe Face Landmarker) — with the frame's time, and returns a
// command or nothing. The runtime, the camera and the wiring to positions are elsewhere; the thresholds are a first reading, to be
// measured with a camera on real hands and faces (ADR-0197, more information).
//
// The camera reads ONE group at a time, chosen (ADR-0197 errata): moving hand gestures, face and eyes, eyes only, or static hand
// gestures — what belongs to another group is not read, so a moving hand's shape never fires a static command. Three rules hold for
// every reader: a signal must be steady for a moment before it commands (a passing shape is not a gesture); after a command the reader
// waits (ADR-0197 §5); and a held signal never commands twice — it fires again only after resting (the Dev: «nunca repetir, a não ser
// após voltar ao repouso»). Distances are measured against the palm's size, never in pixels, so a child farther from the camera
// commands with the same gesture.

/** What a camera gesture asks for. Each maps to a POSITION the game names (ADR-0197 §6), never to a key. */
export type CameraCommand = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'menu';

export interface Landmark { readonly x: number; readonly y: number; readonly z?: number }

/** After a command, the same reader stays silent this long (ADR-0197 §5). */
export const ESPERA_MS = 500;
/** A static shape or an expression must hold this long before it commands. */
export const FIRMEZA_MS = 300;
/** A reader rests when it reads nothing for this long; only then can the same command fire again (ADR-0197 errata). */
export const REPOUSO_MS = 300;

/** The four groups, in the order the Dev named them. Exactly one is read at a time. */
export const GRUPOS_DA_CAMERA = Object.freeze(['dinamicos', 'rostoEOlhos', 'olhos', 'estaticos'] as const);
export type GrupoDaCamera = (typeof GRUPOS_DA_CAMERA)[number];

export interface LeitorDeCamera<Q> {
  /** Reads one frame at `ms` and returns the command it completes, or null. */
  readonly quadro: (ms: number, q: Q) => CameraCommand | null;
}

/**
 * A HELD SIGNAL, READ ONCE: `ler` takes what a frame shows (a command, or null for nothing) and returns the command when it has held
 * `FIRMEZA_MS`, outside the wait, and is not the last command still unrested. An event reader (a blink, a motion) marks its own
 * command with `comandou`; `suspender` forgets a signal half-held without counting rest (closed eyes are not eyes at rest).
 */
function sinalSegurado() {
  let firme: { c: CameraCommand; desde: number } | null = null;
  let ultimo: CameraCommand | null = null;
  let repousoDesde: number | null = null;
  let esperaAte = -Infinity;
  return {
    ler(ms: number, c: CameraCommand | null): CameraCommand | null {
      if (c === null) {
        firme = null;
        repousoDesde ??= ms;
        if (ms - repousoDesde >= REPOUSO_MS) ultimo = null;
        return null;
      }
      repousoDesde = null;
      if (ms < esperaAte || c === ultimo) { firme = null; return null; }
      if (!firme || firme.c !== c) { firme = { c, desde: ms }; return null; }
      if (ms - firme.desde < FIRMEZA_MS) return null;
      return this.comandou(ms, c);
    },
    comandou(ms: number, c: CameraCommand): CameraCommand {
      firme = null; ultimo = c; repousoDesde = null; esperaAte = ms + ESPERA_MS;
      return c;
    },
    suspender(): void { firme = null; },
    livre: (ms: number): boolean => ms >= esperaAte,
    segurando: (): CameraCommand | null => firme?.c ?? null,
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// Static hand gestures (MediaPipe Gesture Recognizer names)
// ---------------------------------------------------------------------------------------------------------------------------

/** ADR-0197 §1: the canned gestures the Dev mapped. A gesture not here commands nothing. */
export const GESTOS_ESTATICOS: Readonly<Record<string, CameraCommand>> = Object.freeze({
  Closed_Fist: 'confirm',
  Open_Palm: 'menu',
  Pointing_Up: 'up',
  Thumb_Down: 'down',
  Thumb_Up: 'up',
  Victory: 'back',
  ILoveYou: 'menu',
});

// ---------------------------------------------------------------------------------------------------------------------------
// The hand's shape from its landmarks
// ---------------------------------------------------------------------------------------------------------------------------

const PULSO = 0;
const DEDOS = [[6, 8], [10, 12], [14, 16], [18, 20]] as const; // [middle joint, tip] of index, middle, ring, little
const distancia = (a: Landmark, b: Landmark): number => Math.hypot(a.x - b.x, a.y - b.y);

/** The palm's size: wrist to the middle finger's base knuckle. Every movement threshold is a fraction of it. */
function tamanhoDaPalma(mao: readonly Landmark[]): number {
  return distancia(mao[PULSO]!, mao[9]!);
}

/** Which of index, middle, ring and little are extended: the tip farther from the wrist than the middle joint. */
function dedosEstendidos(mao: readonly Landmark[]): readonly boolean[] {
  return DEDOS.map(([junta, ponta]) => distancia(mao[ponta]!, mao[PULSO]!) > distancia(mao[junta]!, mao[PULSO]!) * 1.1);
}

/** Open: all four fingers extended. Closed: none. Anything else is neither. */
export function formaDaMao(mao: readonly Landmark[]): 'aberta' | 'fechada' | 'outra' {
  const e = dedosEstendidos(mao);
  if (e.every(Boolean)) return 'aberta';
  if (!e.some(Boolean)) return 'fechada';
  return 'outra';
}

/** Three fingers (ADR-0197 §2): index, middle and ring up, above their middle joints; little and thumb folded. */
export function tresDedos(mao: readonly Landmark[]): boolean {
  const acima = (junta: number, ponta: number): boolean => mao[ponta]!.y < mao[junta]!.y;
  const polegarDobrado = distancia(mao[4]!, mao[5]!) < tamanhoDaPalma(mao) * 0.6;
  return acima(6, 8) && acima(10, 12) && acima(14, 16) && !acima(18, 20) && polegarDobrado;
}

// ---------------------------------------------------------------------------------------------------------------------------
// The hand readers: static gestures (§1) and moving gestures with three fingers (§2), each its own group
// ---------------------------------------------------------------------------------------------------------------------------

/** The index tip must travel this many palm sizes, within `JANELA_MS`, to move «up» or «down». */
const INDICADOR_PALMAS = 0.6;
/** The wrist must fall this many palm sizes within `JANELA_MS` for a quick downward hand. */
const PULSO_PALMAS = 1;
const JANELA_MS = 250;

export interface QuadroDaMao {
  /** The 21 landmarks, or null when no hand is seen. */
  readonly landmarks: readonly Landmark[] | null;
  /** The canned gesture's name, when the recogniser gives one. */
  readonly gesto?: string | null;
}

/** ADR-0197 §1: a canned gesture held commands once; the hand must rest — no mapped gesture — before the same one commands again. */
export function criarLeitorDosGestosEstaticos(): LeitorDeCamera<QuadroDaMao> {
  const sinal = sinalSegurado();
  return {
    quadro(ms, q) {
      const gesto = q.landmarks && q.gesto ? GESTOS_ESTATICOS[q.gesto] ?? null : null;
      return sinal.ler(ms, gesto);
    },
  };
}

/**
 * ADR-0197 §2: the index moving up or down, an open or closed hand falling quickly, and three fingers held. After a motion commands,
 * the next one waits for the hand to be still (or gone) for `REPOUSO_MS`: a hand coming back up is not a new gesture.
 */
export function criarLeitorDosGestosDinamicos(): LeitorDeCamera<QuadroDaMao> {
  const tres = sinalSegurado();
  let esperaAte = -Infinity;
  let movimentoArmado = true;
  let paradaDesde: number | null = null;
  const historico: { ms: number; indiceY: number; pulsoY: number; forma: string }[] = [];

  const mover = (ms: number, c: CameraCommand): CameraCommand => {
    esperaAte = ms + ESPERA_MS; movimentoArmado = false; paradaDesde = null; historico.length = 0;
    tres.suspender();
    return c;
  };
  const repousar = (ms: number): void => {
    paradaDesde ??= ms;
    if (ms - paradaDesde >= REPOUSO_MS) movimentoArmado = true;
  };

  return {
    quadro(ms, q) {
      if (!q.landmarks || q.landmarks.length < 21) { historico.length = 0; repousar(ms); return tres.ler(ms, null); }
      const mao = q.landmarks;
      const palma = tamanhoDaPalma(mao);
      if (palma <= 0) return null;
      historico.push({ ms, indiceY: mao[8]!.y, pulsoY: mao[PULSO]!.y, forma: formaDaMao(mao) });
      while (historico.length && ms - historico[0]!.ms > JANELA_MS) historico.shift();

      const primeiro = historico[0]!;
      const quedaDoPulso = (mao[PULSO]!.y - primeiro.pulsoY) / palma;
      const subidaDoIndice = (primeiro.indiceY - mao[8]!.y) / palma;
      const parada = Math.abs(quedaDoPulso) < PULSO_PALMAS / 2 && Math.abs(subidaDoIndice) < INDICADOR_PALMAS / 2;
      if (parada) repousar(ms); else paradaDesde = null;

      if (movimentoArmado && ms >= esperaAte && primeiro.ms < ms) {
        const forma = formaDaMao(mao);
        if (quedaDoPulso >= PULSO_PALMAS && forma !== 'outra' && primeiro.forma === forma) return mover(ms, forma === 'aberta' ? 'confirm' : 'back');
        if (dedosEstendidos(mao)[0] && Math.abs(quedaDoPulso) < PULSO_PALMAS / 2) {
          if (subidaDoIndice >= INDICADOR_PALMAS) return mover(ms, 'up');
          if (subidaDoIndice <= -INDICADOR_PALMAS) return mover(ms, 'down');
        }
      }
      return ms < esperaAte ? null : tres.ler(ms, tresDedos(mao) ? 'menu' : null);
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// The face: head pose and expressions
// ---------------------------------------------------------------------------------------------------------------------------

/**
 * The head's turn (yaw) and tilt (pitch) in degrees, from the face's 4×4 transformation matrix in column-major order (as MediaPipe
 * gives it). Positive yaw: the head turned to the image's right; positive pitch: the head tilted up. ⚠️ The camera image is usually
 * mirrored for the child: which side is «left» is settled when measured with the camera.
 */
export function poseDaCabeca(m: ArrayLike<number>): { yaw: number; pitch: number } {
  const graus = 180 / Math.PI;
  // rotation part R: column-major, R[row][col] = m[col * 4 + row]
  const r02 = m[8]!, r12 = m[9]!, r22 = m[10]!;
  const yaw = Math.atan2(r02, r22) * graus;
  const pitch = Math.atan2(r12, Math.hypot(r02, r22)) * graus;
  return { yaw, pitch };
}

/** Degrees past the neutral pose a turn or a tilt must reach. */
const GIRO_GRAUS = 20;
const INCLINACAO_GRAUS = 15;
/** Blendshape score an expression must reach. */
const EXPRESSAO_MINIMA = 0.5;

/** A face's blendshape scores by expression name (`jawOpen`, `eyeBlinkLeft`…), from 0 to 1 — scores of the face, not per game action. */
export type PontuacoesDoRosto = Readonly<{ [expressao: string]: number }>;

export interface QuadroDoRosto {
  readonly blendshapes: PontuacoesDoRosto | null;
  /** The facial transformation matrix, column-major 4×4. */
  readonly matriz?: ArrayLike<number> | null;
}

/**
 * The child's face at rest, calibrated in front of the game: the head's pose and, when measured, each expression's resting score.
 * Faces rest differently — a lid that droops, brows that sit high, eyes lowered to a screen below the camera — so an expression is
 * read as its RISE from rest, never as an absolute score (the palm-size rule of the hand, applied to the face).
 */
export interface NeutroDoRosto {
  readonly yaw: number;
  readonly pitch: number;
  readonly pontuacoes?: PontuacoesDoRosto;
}

const SEM_NEUTRO: NeutroDoRosto = Object.freeze({ yaw: 0, pitch: 0 });

/** How far each named score rose from its resting value, as a fraction of the room above rest; the mean of the names. */
const subida = (b: PontuacoesDoRosto, neutro: NeutroDoRosto, ...nomes: string[]): number =>
  nomes.reduce((s, n) => {
    const repouso = neutro.pontuacoes?.[n] ?? 0;
    return s + (repouso >= 1 ? 0 : Math.max(0, ((b[n] ?? 0) - repouso) / (1 - repouso)));
  }, 0) / nomes.length;

/** The head turned or tilted past the command thresholds, measured from rest. */
function cabecaForaDoRepouso(matriz: ArrayLike<number>, neutro: NeutroDoRosto): 'right' | 'left' | 'up' | 'down' | null {
  const p = poseDaCabeca(matriz);
  const giro = p.yaw - neutro.yaw, inclina = p.pitch - neutro.pitch;
  if (giro >= GIRO_GRAUS) return 'right';
  if (giro <= -GIRO_GRAUS) return 'left';
  if (inclina >= INCLINACAO_GRAUS) return 'up';
  if (inclina <= -INCLINACAO_GRAUS) return 'down';
  return null;
}

/**
 * ADR-0199 (supersedes ADR-0197 §3 in part): turn → left/right, tilt up → up, open the mouth → down, pucker → confirm, smile → menu,
 * brows up → back. A tilt down commands nothing: the Dev said «down» with the mouth, eyes on the screen.
 */
export function criarLeitorDoRosto(neutro: NeutroDoRosto = SEM_NEUTRO): LeitorDeCamera<QuadroDoRosto> {
  const sinal = sinalSegurado();
  return {
    quadro(ms, q) {
      if (!q.blendshapes) return sinal.ler(ms, null);
      const b = q.blendshapes;
      const cabeca = q.matriz ? cabecaForaDoRepouso(q.matriz, neutro) : null;
      let c: CameraCommand | null = cabeca === 'down' ? null : cabeca;
      if (!c) {
        if (subida(b, neutro, 'jawOpen') >= EXPRESSAO_MINIMA) c = 'down';
        else if (subida(b, neutro, 'mouthPucker') >= EXPRESSAO_MINIMA) c = 'confirm';
        else if (subida(b, neutro, 'mouthSmileLeft', 'mouthSmileRight') >= EXPRESSAO_MINIMA) c = 'menu';
        else if (Math.max(subida(b, neutro, 'browInnerUp'), subida(b, neutro, 'browOuterUpLeft', 'browOuterUpRight')) >= EXPRESSAO_MINIMA) c = 'back';
      }
      return sinal.ler(ms, c);
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// The eyes: a look and a blink pattern
// ---------------------------------------------------------------------------------------------------------------------------

/** A blink shorter than this is quick; one at least `PISCADA_LENTA_MS` long is slow; in between it is neither. */
const PISCADA_RAPIDA_MS = 300;
const PISCADA_LENTA_MS = 600;
/** Two quick blinks must fall within this time, start to start. */
const DUPLA_MS = 700;
/** Blendshape score of a closed eye, and of a look up or down. */
const OLHO_FECHADO = 0.5;
const OLHAR_MINIMO = 0.5;

type Olhar = 'cima' | 'baixo' | null;

/**
 * ADR-0202 (supersedes ADR-0199 in part): look up and blink twice → up, look down and blink twice → down; look up and blink slowly →
 * confirm, look down → back, look ahead → menu. One quick blink commands nothing — it is how people blink — and neither do two looking
 * ahead, nor a plain look. The look is the one the eyes held before the lids closed (closing lids read as a look down). The eyes command
 * only while the head rests: a head turned or tilted moves the eyes the other way — the head reader owns that moment.
 */
export function criarLeitorDosOlhos(neutro: NeutroDoRosto = SEM_NEUTRO): LeitorDeCamera<QuadroDoRosto> {
  let esperaAte = -Infinity;
  let fechouEm: number | null = null;
  let olharAntes: Olhar = null;
  let olharAoFechar: Olhar = null;
  const rapidas: { ms: number; olhar: Olhar }[] = [];

  const piscou = (ms: number, c: CameraCommand): CameraCommand => {
    rapidas.length = 0;
    esperaAte = ms + ESPERA_MS;
    return c;
  };

  return {
    quadro(ms, q) {
      if (!q.blendshapes) { fechouEm = null; return null; }
      if (q.matriz && cabecaForaDoRepouso(q.matriz, neutro)) { fechouEm = null; rapidas.length = 0; olharAntes = null; return null; }
      const b = q.blendshapes;
      const fechado = subida(b, neutro, 'eyeBlinkLeft', 'eyeBlinkRight') >= OLHO_FECHADO;

      if (fechado) {
        if (fechouEm === null) { fechouEm = ms; olharAoFechar = olharAntes; }
        return null;
      }
      olharAntes = subida(b, neutro, 'eyeLookUpLeft', 'eyeLookUpRight') >= OLHAR_MINIMO ? 'cima'
        : subida(b, neutro, 'eyeLookDownLeft', 'eyeLookDownRight') >= OLHAR_MINIMO ? 'baixo' : null;
      if (fechouEm !== null) {
        const duracao = ms - fechouEm;
        const inicio = fechouEm;
        fechouEm = null;
        if (ms >= esperaAte) {
          if (duracao >= PISCADA_LENTA_MS) return piscou(ms, olharAoFechar === 'cima' ? 'confirm' : olharAoFechar === 'baixo' ? 'back' : 'menu');
          if (duracao < PISCADA_RAPIDA_MS) rapidas.push({ ms: inicio, olhar: olharAoFechar });
        }
      }
      while (rapidas.length && ms - rapidas[0]!.ms > DUPLA_MS) rapidas.shift();
      if (rapidas.length >= 2) {
        const [a, b] = [rapidas[0]!.olhar, rapidas[1]!.olhar];
        rapidas.length = 0;
        if (a === b && a === 'cima') return piscou(ms, 'up');
        if (a === b && a === 'baixo') return piscou(ms, 'down');
      }
      return null;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------------
// The camera: one group at a time
// ---------------------------------------------------------------------------------------------------------------------------

/** What the vision runtime gives for one frame: the hand's reading and the face's, either absent. */
export interface QuadroDaCamera {
  readonly landmarks?: readonly Landmark[] | null;
  readonly gesto?: string | null;
  readonly blendshapes?: PontuacoesDoRosto | null;
  readonly matriz?: ArrayLike<number> | null;
}

/** ADR-0197 errata: reads only the chosen group — moving hand, face and eyes, eyes only, or static hand — and nothing of the others. */
export function criarLeitorDaCamera(grupo: GrupoDaCamera, neutro: NeutroDoRosto = SEM_NEUTRO): LeitorDeCamera<QuadroDaCamera> {
  const daMao = (q: QuadroDaCamera): QuadroDaMao => ({ landmarks: q.landmarks ?? null, gesto: q.gesto ?? null });
  const doRosto = (q: QuadroDaCamera): QuadroDoRosto => ({ blendshapes: q.blendshapes ?? null, matriz: q.matriz ?? null });
  if (grupo === 'estaticos' || grupo === 'dinamicos') {
    const mao = grupo === 'estaticos' ? criarLeitorDosGestosEstaticos() : criarLeitorDosGestosDinamicos();
    return { quadro: (ms, q) => mao.quadro(ms, daMao(q)) };
  }
  const olhos = criarLeitorDosOlhos(neutro);
  if (grupo === 'olhos') return { quadro: (ms, q) => olhos.quadro(ms, doRosto(q)) };
  const rosto = criarLeitorDoRosto(neutro);
  return {
    quadro(ms, q) {
      const r = doRosto(q);
      const doRostoCmd = rosto.quadro(ms, r);
      const dosOlhosCmd = olhos.quadro(ms, r); // both read every frame, so a blink's timing is never skipped
      return doRostoCmd ?? dosOlhosCmd;
    },
  };
}
