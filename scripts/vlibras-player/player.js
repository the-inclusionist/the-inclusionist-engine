// SPDX-License-Identifier: AGPL-3.0-or-later
// THE PLAYER PAGE'S GLUE (ADR-0234, route A): the engine's own, written for this delivery — not the published `index.js`, which
// reads a version placeholder, alerts, and swallows every log whose stack mentions `/unity/`.
//
// THE PROTOCOL is the VLibras player's documented one, over `postMessage` with the page that opened this frame
// (`ui/vlibras-player` in the engine):
//   · parent → here: `{ type: 'unity', object, method, params }`, handed to Unity's `SendMessage` (`PlayerManager.setBaseUrl`,
//     `PlayerManager.playNow`, `PlayerManager.stopAll`, …);
//   · here → parent: `{ type: 'unity_event', event, data }` — `on_load_player`, `counter_gloss` ([done, total]),
//     `on_playing_state_change`, `get_avatar`, `finish_welcome`, `update_progress`, and `on_error` when this device cannot run it.
// 📌 BOTH WAYS ARE SAME-ORIGIN ONLY: a message from anything but the parent at this origin is ignored, and events are posted to
// this origin, never to `*`.
//
// 🔴 THE SIGNS' CACHE IS FORGOTTEN WHEN THE DELIVERED SET CHANGES. 📏 Unity keeps every sign bundle in IndexedDB `/idbfs`, keyed
// by the sign's NAME with a zero hash, and never asks again — not after a reload, not under another base URL. So a sign whose
// bytes changed under the same name would be played from the old copy forever. The delivery writes the revision of the sign
// set it carries into this page (`<meta name="libras-sign-set">`), and before Unity opens its database this page deletes the
// whole database whenever that revision is not the one it last started with.

import { installCspShim } from './csp-shim.js';

const origin = location.origin;
const post = (event, data) => { window.parent.postMessage({ type: 'unity_event', event, data }, origin); };

/** The five calls the player makes on the page (`external-call.js`), each forwarded as the event the protocol names. */
const handlers = {
  onPlayingStateChange: (...data) => { post('on_playing_state_change', data); },
  CounterGloss: (...data) => { post('counter_gloss', data); },
  onLoadPlayer: () => { post('on_load_player'); },
  GetAvatar: (avatar) => { post('get_avatar', avatar); },
  FinishWelcome: (data) => { post('finish_welcome', data); },
};

const { UnityLoader } = window;
installCspShim({ win: window, doc: document, loader: UnityLoader, handlers, onFailure: (why) => { post('on_error', why); } });

let player = null;
window.addEventListener('message', (e) => {
  if (e.source !== window.parent || e.origin !== origin) return;
  const m = e.data;
  if (!player || !m || m.type !== 'unity' || typeof m.object !== 'string' || typeof m.method !== 'string') return;
  player.SendMessage(m.object, m.method, m.params);
});

/** The key this page keeps the sign set it last started with under — `incl_*`, the engine's own prefix. */
const SIGN_SET_KEY = 'incl_libras_sign_set';

/** Deletes Unity's bundle cache when the delivered sign set is not the one this device last played from. */
async function forgetStaleSigns() {
  const current = document.querySelector('meta[name="libras-sign-set"]')?.content ?? '';
  let last = null;
  try { last = localStorage.getItem(SIGN_SET_KEY); } catch { /* no storage: nothing was kept either */ }
  if (last === current) return;
  await new Promise((done) => {
    try {
      const request = indexedDB.deleteDatabase('/idbfs');
      request.onsuccess = request.onerror = request.onblocked = () => { done(); };
    } catch { done(); }
  });
  try { localStorage.setItem(SIGN_SET_KEY, current); } catch { /* the next start deletes again, which costs a re-fetch only */ }
}

await forgetStaleSigns();
player = UnityLoader.instantiate('player', 'playerweb.json', {
  onProgress: (_, progress) => { post('update_progress', progress); },
  compatibilityCheck: (_, accept, deny) => {
    if (UnityLoader.SystemInfo.hasWebGL) { accept(); return; }
    post('on_error', 'this device has no WebGL');
    deny();
  },
});
