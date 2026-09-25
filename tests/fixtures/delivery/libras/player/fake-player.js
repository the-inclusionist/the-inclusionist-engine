// SPDX-License-Identifier: AGPL-3.0-or-later
// A FAKE VLibras player (tests/vlibras-player.browser.test.js). It speaks the delivery page's protocol — `{ type: 'unity', object,
// method, params }` in from the parent, `{ type: 'unity_event', event, data }` out to it, same-origin both ways — and lets the
// test drive every event instead of Unity:
//   · `received` holds every message from the parent, in order;
//   · `emit(event, data)` posts one event to the parent;
//   · on load it answers `on_load_player` by itself, unless the parent set `fakeVlibras.load` to 'never' or 'error'.
const origin = location.origin;
window.received = [];
window.emit = (event, data) => { window.parent.postMessage({ type: 'unity_event', event, data }, origin); };
window.addEventListener('message', (e) => {
  if (e.source !== window.parent || e.origin !== origin) return;
  const m = e.data;
  if (!m || m.type !== 'unity') return;
  window.received.push({ object: m.object, method: m.method, params: m.params });
});
const mode = window.parent.fakeVlibras?.load ?? 'ok';
if (mode === 'ok') window.emit('on_load_player');
else if (mode === 'error') window.emit('on_error', 'this device has no WebGL');
