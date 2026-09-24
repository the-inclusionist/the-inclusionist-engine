<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
Historical plan (2026-07-07, completed 2026-08-02): kept as a record; the lab's code lives in `inclusionist-lab`, and the engine's narration in `app/js/platform/tts.ts` (ADR-0200, ADR-0216).

# Plan — modularising the TTS-Lab into a product (TS · Vite · DI · versioned packages)

> ✅ **COMPLETED (2026-08-02).** Rounds 0–6 are done: `inclusionist-commons` has the 4
> `@jrocha-io/*` packages (tts/audio/logging/model-fetch, 52 tests) with the 4 adapters (Web Speech, eSpeak-NG, sherpa,
> Kokoro-WebGPU); `inclusionist-lab` has the 3 sections wired by DI and the monolith was retired. **Pending items for the Dev only:**
> publish the packages on the public npmjs (ADR-0072; the original plan said GitLab Package Registry), put the ~18MB of sherpa assets into
> `public/sherpa-wasm/` (recipe in `inclusionist-lab/docs/sherpa-wasm-build.md`), and the Cloudflare deploy.
> The verification of **real neural audio** (sherpa/Kokoro) runs on the Dev's machine (assets + model downloads).

> Decisions this plan executes: **ADR-0023** (labs = first-class apps) + **ADR-0024** (versioned packages;
> no CDN; scoped COOP/COEP) + **ADR-0025** (the lab lives in the **hub repo `inclusionist-lab`**, multi-page, the TTS is the
> `/tts/` subpage; `inclusionist-engine` keeps only the engine (it was only the game until ADR-0036 swapped the two repositories) — it replaces 0024's own-repo/submodule tts-lab).
>
> **Where the code lives now:** `inclusionist-lab/src/tts/` (no longer `tts-lab`). The rounds below that mention "tts-lab"
> apply to that subpage. Rounds 0–3 **completed and verified** (Section 1 = eSpeak + Web Speech by DI).
> Method: **small rounds, each with a test and a proof**; the current monolith (`docs/research/sherpa-lab.html`)
> **keeps working until the last round**. Nothing is done until the Dev's test passes at each stage.

## Who runs what

- **AI (me):** design, file scaffolding (TS code, `package.json`, `tsconfig`, `vite.config`, `_headers`,
  tests), editing, and pre-validation in the preview when applicable. **I have no Node/registry/CF in the sandbox.**
- **The Dev:** creates the repositories, does `git submodule`, `npm install`/`build`/`vitest`, **publishes** the packages
  (`@jrocha-io/*`), configures the **`labs.` domain** on Cloudflare, and does push/deploy. Gotchas: Avast →
  `NODE_OPTIONS=--use-system-ca` + `UV_NATIVE_TLS=1`; Cloudflare **never** through wrangler's OAuth (use
  `CLOUDFLARE_API_TOKEN`/the dashboard).

## Target architecture

**Ports & adapters + constructor dependency injection** (no DI framework; the *composition root* is each app's `main.ts`,
which instantiates the concrete adapters and injects them into the controllers/engines).

```
@jrocha-io/tts          Port TtsEngine + types (SynthRequest, Voice, SynthMetrics) + adapters:
                        WebSpeechEngine · MeSpeakEngine (eSpeak-NG WASM) · SherpaEngine (wraps
                        sherpa-onnx-wasm: fetch→FS.writeFile→OfflineTts, + multi-thread) · KokoroWebGpuEngine
                        (onnxruntime-web/kokoro-js) + a registry/factory. → consumed by the LAB and (later) by the game's tts.ts.
@jrocha-io/audio        Port AudioPlayer + WebAudioPlayer (the persistent AudioContext + capped normalisation).
@jrocha-io/logging      Port Logger + DomLogger/ConsoleLogger.
@jrocha-io/model-fetch  DAO ModelFetcher (fetch HF/R2 + Cache API + progress).
tts-lab (own repo)      UI (thin view-controllers over a shared TaskTable component) → talks to the
                        engines ONLY through the port. main.ts = composition root. Deploy → labs.<domain>.
```

The golden rule of the design: **the UI and the controllers depend on the PORT, never on a concrete engine** — that is what makes the
section testable with a `FakeTtsEngine` and what lets the winning engine **graduate** to the game's `tts.ts` as a
dependency (semver), not by a rewrite. [Today: the engine does not depend on `@jrocha-io/tts`; its narration lives in `app/js/platform/tts.ts` and `app/js/platform/kokoro.ts` (ADR-0216).]

## Test strategy (Vitest)

- **node** (pure logic, no DOM/WASM): voice catalogues (MODELS/KOKORO/optgroups), **RTF** computation, **gain**
  (peak→gain with a cap), parsing the repo in the cache (`csukuangfj/([^/]+)`), URL→engine/threads mapping, the samples
  table. **ZOMBIES** + **Right-BICEP** patterns.
- **browser** (Playwright): `WebAudioPlayer` generates a buffer; `DomLogger` appends; `TaskTable` renders rows; the section's wiring
  with a `FakeTtsEngine` (the port's contract). **Real neural synthesis does NOT go into CI** (heavy/non-deterministic).

## Stages (each: deliverable → proof → who runs it)

| # | Deliverable | Proof | Runs |
|---|---|---|---|
| **0** | Stand-up of the repos: `inclusionist-commons` (package workspace) + `tts-lab` (Vite+TS scaffold, an empty app that mounts `main.ts`); GitLab's npm registry with the `@jrocha-io` scope configured (it was GitHub Packages at the time — ADR-0026); `tts-lab` as a submodule in `labs/tts-lab/` | `npm run build` of `tts-lab` emits a page; `npm publish --dry-run` of a stub package OK | the Dev (git/registry/CF) with my files |
| **1** | `@jrocha-io/tts` **pure domain**: types + catalogues (MODELS/KOKORO/KVOICES) + RTF/gain/parse, **typed** + **node** tests | `vitest run` (node) green | AI writes · the Dev runs |
| **2** | `@jrocha-io/audio`, `@jrocha-io/logging`, `@jrocha-io/model-fetch` (ports + impls) + **browser** tests | `vitest run` (browser) green | AI · the Dev |
| **3** | Port `TtsEngine` + **WebSpeechEngine** + **MeSpeakEngine** (eSpeak without a CDN — npm/vendored); the lab's **Section 1** wired by DI | the Dev: section 1 speaks pt/en/es on the 2 engines | AI · the Dev |
| **4** | **SherpaEngine** (wraps the wasm + FS loader + multi-thread toggle) → **Section 2**; the `sherpa-wasm`/`espeak-ng-data` assets move to the lab's repo; COOP/COEP via `_headers` **only** on `labs.` | the Dev: Piper medium/high + Kokoro fp32 speak; list of downloaded ones; multi-thread turns on | AI · the Dev |
| **5** | **KokoroWebGpuEngine** (kokoro-js **npm**, no CDN) → **Section 3**, fp32/fp16/q8 + device webgpu/wasm | the Dev: measures RTF; **solves the buzz** by comparing fp32/webgpu × fp16 × fp32/wasm | AI · the Dev |
| **6** | Retire `docs/research/sherpa-lab.html` (leave a pointer/redirect to `labs.`); `docs/research/*.md` (studies) **stay**; publish `^1` versions of the packages; update ARCHITECTURE | the Dev: `labs.` live; game deploy unchanged (no COOP/COEP, no lab code) | AI · the Dev |

## Gotchas / risks (research-first)

- **eSpeak-NG WASM without a CDN:** there is no guaranteed clean *official* npm package; if `mespeak`/`espeak-ng` does not bundle
  well in Vite, **vendor** the WASM+data inside `@jrocha-io/tts`. (To be defined in Round 3, with a table of options.)
- **The WebGPU buzz** (inherited): do not *fix* it blindly — Section 3 provides the fp32/fp16/q8 × webgpu/wasm axes to
  **prove** the cause (hypothesis: WebGPU-fp32 numerics on the Dev's AMD). Record the result in the study.
- **COOP/COEP:** required for sherpa's multi-thread (SharedArrayBuffer). It stays **only** on `labs.`; the game does not get it.
- **Submodule:** updating the lab = bumping the submodule's SHA in the superproject (the Dev runs it).
- **Version/publish:** Changesets (preferred for multi-package) or release-it per package; a bump at each change to commons.

## Final expected output (confirmation)

`@jrocha-io/tts`(+audio/logging/model-fetch) published and installable; `tts-lab` builds against them and deploys to
`labs.<domain>`; the 3 sections behave like the retired monolith; and `@jrocha-io/tts` later becomes a dependency of the
game's `tts.ts`. Each stage becomes an **issue** on *The Inclusionist Roadmap* (labels: `research`/`engine` + type).
