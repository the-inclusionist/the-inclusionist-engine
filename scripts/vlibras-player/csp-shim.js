// SPDX-License-Identifier: AGPL-3.0-or-later
// THE TWO CHANGES THE PLAYER NEEDS TO RUN UNDER THE DELIVERY'S POLICY (ADR-0234, route A), on the page's side.
//
// 📏 Measured (route A report, 2026-09-25): served as published, the player does not run under `script-src 'self'
// 'wasm-unsafe-eval'`, for two reasons, both in plain JavaScript and neither in the closed wasm:
//   1. `UnityLoader.loadCode` injects the framework as a `blob:` script, which `script-src` refuses — loading stalls at 0.9 and
//      `on_load_player` never arrives. HERE its framework call loads a same-origin FILE instead: the patched framework the
//      delivery wrote beside the original (`playerweb.framework.noeval.js`), which assigns itself to `UnityLoader.__vlFramework`.
//   2. The player's calls to the page arrive through an `eval` inside that framework. The delivery replaced it with
//      `window.__vlExternalCall(str)`, and HERE that name is given a parser (`external-call.js`) that hands JSON arguments to the
//      page's own handlers — and runs nothing.
// Every other `loadCode` goes to the loader's own, untouched.

import { parseExternalCall } from './external-call.js';

/** The file the delivery writes beside the published framework, and the name it assigns itself to in `UnityLoader`. */
export const PATCHED_FRAMEWORK = 'playerweb.framework.noeval.js';
export const FRAMEWORK_GLOBAL = '__vlFramework';

/**
 * Installs both changes. `loader` is the page's `UnityLoader`; `handlers` holds one function per player call, by name.
 * `onFailure` hears a framework file that did not load, so the page can tell its parent instead of stalling in silence.
 */
export function installCspShim({ win, doc, loader, handlers, onFailure }) {
  const original = loader.loadCode;
  loader.loadCode = function loadCode(code, done, info) {
    const module = info && info.Module;
    if (!module || info.url !== module.wasmFrameworkUrl) return original.apply(this, arguments);
    const published = new URL(module.resolveBuildUrl(info.url), doc.baseURI);
    const script = doc.createElement('script');
    script.src = new URL(PATCHED_FRAMEWORK, published).href;
    script.onload = () => { done(FRAMEWORK_GLOBAL); };
    script.onerror = () => { onFailure(`the patched framework did not load: ${script.src}`); };
    doc.body.appendChild(script);
    return undefined;
  };
  win.__vlExternalCall = (text) => {
    const { name, args } = parseExternalCall(text);
    if (!Object.hasOwn(handlers, name)) throw new Error(`vlibras: the page has no handler for ${name}`);
    handlers[name](...args);
  };
}
