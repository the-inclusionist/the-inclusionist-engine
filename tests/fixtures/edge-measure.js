// SPDX-License-Identifier: AGPL-3.0-or-later
// HOW NEAR THE GAME'S EDGE EVERY TEXT AND BUTTON STANDS (interface log 2026-09-26) — the measure the edge-margin gates share.
//
// What is walked inside a region: every visible TEXT (its line boxes, as a Range gives them, cut by any ancestor that clips its
// overflow), every visible BUTTON, and the HUD's chips (its learning bars and session clock) wherever they are mounted — all
// but the quick bar (`#title-icons`, which ADR-0180 put at the edge, and its icon name line). The margin is the region's own
// `--margem-borda`, which `ui/layout.applyScale` writes: 4 logical px, 8 CSS px at 640×360.

export function shown(el) {
  for (let e = el; e && e !== el.ownerDocument.documentElement; e = e.parentElement) {
    const s = getComputedStyle(e);
    if (e.hidden || s.display === 'none' || s.visibility === 'hidden') return false;
  }
  return el.getClientRects().length > 0;
}
/** A rectangle cut by every ancestor inside the region that clips its overflow — at the ancestor's PADDING box. */
function clipped(region, el, rect) {
  let x = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  for (let a = el; a && a !== region; a = a.parentElement) {
    if (getComputedStyle(a).overflow === 'visible') continue;
    const c = a.getBoundingClientRect();
    const left = c.left + a.clientLeft;
    const top = c.top + a.clientTop;
    x = { left: Math.max(x.left, left), top: Math.max(x.top, top), right: Math.min(x.right, left + a.clientWidth), bottom: Math.min(x.bottom, top + a.clientHeight) };
  }
  return x.right - x.left > 0.5 && x.bottom - x.top > 0.5 ? x : null;
}
/** Everything the margin is for on the screen now: [what, rect] — texts by line, buttons and HUD chips by box. */
function measured(region) {
  const out = [];
  const bar = region.ownerDocument.getElementById('title-icons');
  const walker = region.ownerDocument.createTreeWalker(region, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!n.textContent.trim() || bar?.contains(el) || el.closest('.sr-only') || !shown(el)) continue;
    const range = region.ownerDocument.createRange();
    range.selectNodeContents(n);
    // a gliding footer's words stand in its `.footer-scroll-text` block (ADR-0245): named by the footer they belong to
    const owner = el.classList.contains('footer-scroll-text') ? el.parentElement : el;
    for (const line of range.getClientRects()) {
      const x = line.width > 0 ? clipped(region, el, line) : null;
      if (x) out.push([`«${n.textContent.trim().slice(0, 32)}» (${owner.tagName.toLowerCase()}.${owner.className})`, x]);
    }
  }
  // the HUD's chips wherever a caller mounts them — in the row, or on the region itself
  for (const el of region.querySelectorAll('button, .hud-barra, .session-clock')) {
    if (bar?.contains(el) || !shown(el)) continue;
    const x = clipped(region, el, el.getBoundingClientRect());
    if (x) out.push([`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}.${el.className} «${el.textContent.trim().slice(0, 24)}»`, x]);
  }
  return out;
}
/** The margin the region declares, and what stands closer than it to any of the four edges. */
export function tooClose(region, screen) {
  const r = region.getBoundingClientRect();
  const m = parseFloat(region.style.getPropertyValue('--margem-borda'));
  const items = measured(region);
  const found = items.flatMap(([what, x]) => {
    const d = { left: x.left - r.left, top: x.top - r.top, right: r.right - x.right, bottom: r.bottom - x.bottom };
    return Object.entries(d).filter(([, v]) => v < m - 0.05).map(([side, v]) => `(${screen}) ${what} is ${v.toFixed(1)} px from the ${side} edge`);
  });
  return { found, items, m };
}
/** The stage at `w`×`h`, and the root's scale written again for it. */
export async function atSize(doc, w, h) {
  doc.querySelector('.stage-wrap').style.cssText = `width:${w}px;height:${h}px;display:flex;flex:none`;
  doc.defaultView.dispatchEvent(new Event('resize'));
  await new Promise((r) => setTimeout(r, 120));
}
