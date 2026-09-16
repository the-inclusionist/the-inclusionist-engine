// SPDX-License-Identifier: AGPL-3.0-or-later
// platform/vision — THE FACE LANDMARKER AND THE CAMERA, FROM THE GAME'S OWN ORIGIN (ADR-0213, ADR-0177; issue #196).
//
// · MediaPipe `tasks-vision` and the face model are the files the install already fetched and checked by sha256 (`platform/pesados`).
//   They are asked for at `pesados/<host><path>` beside the page, so no third-party host is contacted, and a file that is not in the
//   checked cache is never loaded: the reader says which ones are missing instead, so the child hears why the eyes do not work.
// · The bundle is imported by an ABSOLUTE address: a relative one resolves against this module, not against the page.
// · GPU first; a GPU that fails to create the landmarker, or fails on a frame, gives way to the CPU once. The frame that failed reads
//   nothing while the CPU landmarker is being built.
// · `tasks-vision` tries to send usage logs to `odml.pa.googleapis.com`; the page's CSP refuses it (measured in the lab) and that is
//   kept on purpose — nothing about the child's camera leaves the device.
// · The camera is video only, 640×480: the lab's readings were measured at that size, and a larger capture changed them.

import { PESADOS, CACHE_PESADOS, caminhoNaEntrega } from './pesados.js';

/** The files the face reader needs, by catalogue id. */
export const FACE_VISION_FILES = ['visao:runtime', 'visao:runtime:cola', 'visao:runtime:wasm', 'visao:modelo:rosto'] as const;

/** The part of one detection the eye control reads. */
export interface FaceDetection {
  readonly faceBlendshapes?: ReadonlyArray<{ readonly categories: ReadonlyArray<{ readonly categoryName: string; readonly score: number }> }>;
  readonly facialTransformationMatrixes?: ReadonlyArray<{ readonly data: ArrayLike<number> }>;
  readonly faceLandmarks?: ReadonlyArray<ReadonlyArray<{ readonly x: number; readonly y: number; readonly z: number }>>;
}

interface Landmarker { detectForVideo(frame: unknown, ms: number): FaceDetection; close(): void }
/** The shape of the `tasks-vision` bundle this module uses. */
export interface TasksVision {
  readonly FilesetResolver: { forVisionTasks(wasmBase: string): Promise<unknown> };
  readonly FaceLandmarker: { createFromOptions(fileset: unknown, options: object): Promise<Landmarker> };
}

export interface VisionDeps {
  /** The page's address, to make the delivery paths absolute. */
  readonly base: string;
  /** Whether a catalogue file (by its upstream address) is in the checked cache. */
  readonly hasFile?: (upstreamUrl: string) => Promise<boolean>;
  readonly importBundle?: (absoluteUrl: string) => Promise<TasksVision>;
}

export type Delegate = 'GPU' | 'CPU';

export interface FaceTracker {
  /** One frame; null while it has nothing to say (no face, or the CPU landmarker still being built after a GPU failure). */
  detect(frame: unknown, ms: number): FaceDetection | null;
  delegate(): Delegate;
  close(): void;
}

export type FaceTrackerLoad =
  | { readonly ok: true; readonly tracker: FaceTracker }
  | { readonly ok: false; readonly missing: readonly string[] };

const urlOf = (id: string): string => PESADOS.find((x) => x.id === id)!.url!; // the four entries are in the catalogue, with addresses

const defaultHasFile = async (url: string): Promise<boolean> =>
  typeof caches !== 'undefined' && !!(await (await caches.open(CACHE_PESADOS)).match(url));

const OPTIONS = (modelAssetPath: string, delegate: Delegate): object => ({
  baseOptions: { modelAssetPath, delegate }, runningMode: 'VIDEO', numFaces: 1,
  outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
});

export async function loadFaceTracker(deps: VisionDeps): Promise<FaceTrackerLoad> {
  const hasFile = deps.hasFile ?? defaultHasFile;
  const importBundle = deps.importBundle ?? ((u: string) => import(/* @vite-ignore */ u) as Promise<TasksVision>);
  const missing: string[] = [];
  for (const id of FACE_VISION_FILES) if (!(await hasFile(urlOf(id)))) missing.push(id);
  if (missing.length) return { ok: false, missing };

  const at = (id: string): string => new URL(caminhoNaEntrega(urlOf(id)), deps.base).href;
  const vision = await importBundle(at('visao:runtime'));
  const glue = at('visao:runtime:cola');
  const fileset = await vision.FilesetResolver.forVisionTasks(glue.slice(0, glue.lastIndexOf('/')));
  const create = (d: Delegate): Promise<Landmarker> => vision.FaceLandmarker.createFromOptions(fileset, OPTIONS(at('visao:modelo:rosto'), d));

  let delegate: Delegate = 'GPU', closed = false, failure: unknown = null;
  let current: Landmarker | null;
  try { current = await create('GPU'); } catch { delegate = 'CPU'; current = await create('CPU'); }

  const toCpu = (): void => {
    current?.close(); current = null; delegate = 'CPU';
    create('CPU').then((l) => { if (closed) l.close(); else current = l; }, (e: unknown) => { failure = e; });
  };
  return {
    ok: true,
    tracker: {
      detect(frame, ms) {
        if (failure) throw failure; // the CPU could not be built either: the frame loop says so on screen
        if (!current) return null;
        try { return current.detectForVideo(frame, ms); } catch (e) {
          if (delegate === 'CPU') throw e;
          toCpu();
          return null;
        }
      },
      delegate: () => delegate,
      close() { closed = true; current?.close(); current = null; },
    },
  };
}

/** The camera, video only, at the size the readings were measured. */
export function openCamera(media: { getUserMedia(c: MediaStreamConstraints): Promise<MediaStream> }): Promise<MediaStream> {
  return media.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
}

/** Let the camera go: every track stops, so the device's light goes off. */
export function closeCamera(stream: { getTracks(): ReadonlyArray<{ stop(): void }> } | null | undefined): void {
  for (const t of stream?.getTracks() ?? []) t.stop();
}
