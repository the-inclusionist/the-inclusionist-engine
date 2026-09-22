// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/switchable-control — WHAT A WAY OF PLAYING WITH THE BODY IS, as one line the compiler can check (ADR-0221 step 7f).
//
// 🔴 WHY IT EXISTS. The eyes, the face, the hands and the voice are four ways into the same virtual controller, and they had
// the same shape without ever saying so: four modules, four interfaces, one method each. 📏 Measured on 2026-09-22 while the
// Dev weighed the three family interfaces: they already exported `XControlDeps` · `XControl` · `createX`, and `XControl` was
// `apply(on: boolean): Promise<void>` in all four. The abstraction was not missing — it was unnamed, which is worse, because
// only the co-change of the four files said it existed.
//
// 🎯 WHAT DECLARING IT BUYS, and it is not tidiness: `ui/camera-control.followCameraMode` takes a record of these and turns
// the others off before turning one on. Today the compiler checks that record structurally; with the family named, a member
// that drifts — an `apply` that stops returning a promise, one that takes no argument — fails where it is WRITTEN instead of
// where it is combined. The Dev's own words for the choice: «custa pouco, é nativo do TypeScript, e transforma a abstração em
// falta em algo que o compilador vê».
//
// ⚠️ THE VOICE IS IN THE FAMILY AND NOT IN THE CAMERA CYCLE. It answers to the 👄, not to the 📷, and it has one method more
// (`refreshGrammar`). That is why this interface is not called «camera» anything: the family is «what the bar can switch on
// and off», and the camera cycle is one USER of it.

/**
 * Something the accessibility bar turns on and off, and that lets go of everything it holds when turned off.
 *
 * ⚠️ `apply(false)` MUST release the device — the camera, the microphone — and not merely stop reading it. One camera mode at
 * a time holds by construction only because the one going off is told first (ADR-0197, ADR-0215), and a control that keeps
 * the camera open after being switched off breaks the next mode instead of itself.
 */
export interface SwitchableControl {
  apply(on: boolean): Promise<void>;
}
