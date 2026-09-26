// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PART OF three.js THE FREE LIBRAS PLAYER USES, TYPED HERE (ADR-0234 errata, route B, phase B2).
//
// three.js 0.186.1 ships no types of its own, and `@types/three` was not authorised as a dependency: this declares only the
// classes and members `ui/libras-avatar-stage` touches, as three.js documents them — nothing else of three.js is reachable from
// the engine's code. A member used here and missing below fails `tsc`, which is the point: the list grows by use, never by
// guess. It is an ambient file, so it is not emitted into the package, and a consumer's own three.js types are never replaced.

declare module 'three' {
  export const LoopOnce: number;

  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
  }

  export class Box3 {
    readonly min: Vector3;
    readonly max: Vector3;
    setFromObject(object: Object3D, precise?: boolean): this;
    expandByObject(object: Object3D, precise?: boolean): this;
    isEmpty(): boolean;
    getCenter(target: Vector3): Vector3;
    getSize(target: Vector3): Vector3;
  }

  export class Object3D {
    name: string;
    readonly uuid: string;
    readonly children: Object3D[];
    readonly position: Vector3;
    add(...objects: Object3D[]): this;
    traverse(callback: (object: Object3D) => void): void;
    lookAt(x: number, y: number, z: number): void;
    updateMatrixWorld(force?: boolean): void;
  }

  export interface Texture {
    readonly isTexture: true;
    image: unknown;
    dispose(): void;
  }

  export interface Material {
    readonly isMaterial: true;
    dispose(): void;
  }

  export interface BufferGeometry {
    dispose(): void;
  }

  /** A mesh, seen through `Object3D.traverse`: `isMesh` tells it apart. */
  export interface Mesh extends Object3D {
    readonly isMesh: true;
    readonly geometry: BufferGeometry;
    readonly material: Material | Material[];
    morphTargetDictionary?: Record<string, number>;
  }

  export class Scene extends Object3D {}

  export class PerspectiveCamera extends Object3D {
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
    aspect: number;
    updateProjectionMatrix(): void;
  }

  export class HemisphereLight extends Object3D {
    constructor(skyColor?: number, groundColor?: number, intensity?: number);
  }

  export class DirectionalLight extends Object3D {
    constructor(color?: number, intensity?: number);
  }

  export interface WebGLRendererParameters {
    canvas?: HTMLCanvasElement;
    antialias?: boolean;
    alpha?: boolean;
    powerPreference?: 'default' | 'high-performance' | 'low-power';
  }

  export class WebGLRenderer {
    constructor(parameters?: WebGLRendererParameters);
    readonly info: {
      readonly memory: { readonly geometries: number; readonly textures: number };
      readonly render: { readonly calls: number; readonly triangles: number };
    };
    setPixelRatio(value: number): void;
    setSize(width: number, height: number, updateStyle?: boolean): void;
    setClearColor(color: number, alpha?: number): void;
    render(scene: Object3D, camera: PerspectiveCamera): void;
    dispose(): void;
    forceContextLoss(): void;
  }

  export class AnimationClip {
    static parse(json: unknown): AnimationClip;
    name: string;
    readonly duration: number;
    clone(): AnimationClip;
  }

  export class AnimationAction {
    enabled: boolean;
    time: number;
    clampWhenFinished: boolean;
    reset(): this;
    setLoop(mode: number, repetitions: number): this;
    play(): this;
    stop(): this;
    crossFadeFrom(fadeOutAction: AnimationAction, duration: number, warp?: boolean): this;
    getClip(): AnimationClip;
    getEffectiveWeight(): number;
  }

  export class AnimationMixer {
    constructor(root: Object3D);
    clipAction(clip: AnimationClip): AnimationAction;
    update(deltaTime: number): this;
    stopAllAction(): this;
    uncacheRoot(root: Object3D): void;
  }
}

declare module 'three/addons/loaders/GLTFLoader.js' {
  import type { Object3D, Texture } from 'three';

  /** What a texture loader the parser calls with a decoded image must look like (three.js `ImageBitmapLoader`). */
  export interface DecodedImageLoader {
    readonly isImageBitmapLoader: true;
    load(url: string, onLoad: (image: ImageBitmap) => void, onProgress?: unknown, onError?: (error: unknown) => void): void;
  }

  export interface GLTFParser {
    readonly json: {
      readonly textures?: readonly { readonly source?: number; readonly sampler?: number }[];
      readonly images?: readonly { readonly bufferView?: number; readonly mimeType?: string; readonly uri?: string }[];
    };
    getDependency(type: 'bufferView', index: number): Promise<ArrayBuffer>;
    loadTextureImage(textureIndex: number, sourceIndex: number, loader: DecodedImageLoader): Promise<Texture | null>;
  }

  export interface GLTFLoaderPlugin {
    readonly name: string;
    loadTexture?(textureIndex: number): Promise<Texture | null> | null;
  }

  export interface GLTF {
    readonly scene: Object3D;
  }

  export class GLTFLoader {
    register(callback: (parser: GLTFParser) => GLTFLoaderPlugin): this;
    parseAsync(data: ArrayBuffer | string, path: string): Promise<GLTF>;
  }
}
