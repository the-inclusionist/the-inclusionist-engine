// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of core/a11y-sr — screen-reader announcements (BROWSER project: a real document + requestAnimationFrame).
// Contract: clears the region → writes on the next frame (forces a re-announcement), in the document the announcer was
// BUILT with (ADR-0232 D4), and mirrors to a Libras sink only when one is connected.
// See docs/5-Refactoring/plan-modularization-map.md (Stage 4, Tier 1, core/a11y-sr).
//
// MUTATIONS CHECKED — at the end of the file.
import { describe, it, expect } from 'vitest';
import * as A from '../app/js/core/a11y-sr.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
const announcer = (doc = document) => A.createAnnouncer({ doc, raf: (cb) => requestAnimationFrame(cb) });

describe('core/a11y-sr — say (status "polite")', () => {
  it('[Interface] limpa a região e escreve no próximo frame', async () => {
    document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert"></p>';
    document.querySelector('#sr-status').textContent = 'antes';
    announcer().say('olá mundo');
    expect(document.querySelector('#sr-status').textContent).toBe(''); // cleared first (re-announcing repeated text)
    await nextFrame();
    expect(document.querySelector('#sr-status').textContent).toBe('olá mundo');
  });
});

describe('core/a11y-sr — alert (alerta "assertive")', () => {
  it('[Interface] escreve em #sr-alert e NÃO toca no #sr-status', async () => {
    document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert"></p>';
    announcer().alert('erro!');
    await nextFrame();
    expect(document.querySelector('#sr-alert').textContent).toBe('erro!');
    expect(document.querySelector('#sr-status').textContent).toBe('');
  });
});

describe('core/a11y-sr — the announcer writes the document it was BUILT with (ADR-0232 D4)', () => {
  it('🔴 [Right] a root building in another document announces THERE, and the page\'s regions stay silent', async () => {
    // A root whose host is an iframe or an editor beside the game: the old module functions searched the GLOBAL document.
    document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert"></p>';
    const other = document.implementation.createHTMLDocument('another host');
    other.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert"></p>';
    const a = announcer(other);
    a.say('no host');
    a.alert('também no host');
    await nextFrame();
    expect(other.querySelector('#sr-status').textContent).toBe('no host');
    expect(other.querySelector('#sr-alert').textContent).toBe('também no host');
    expect(document.querySelector('#sr-status').textContent, 'the page\'s region heard another root').toBe('');
    expect(document.querySelector('#sr-alert').textContent).toBe('');
  });

  it('🎯 [Right] the write waits for the frame the HOST lends — not the global one', () => {
    document.body.innerHTML = '<p id="sr-status"></p>';
    const frames = [];
    A.createAnnouncer({ doc: document, raf: (cb) => { frames.push(cb); } }).say('quando o hospedeiro quiser');
    expect(document.querySelector('#sr-status').textContent).toBe('');
    expect(frames.length, 'the announcer did not ask the host for its frame').toBe(1);
    frames[0]();
    expect(document.querySelector('#sr-status').textContent).toBe('quando o hospedeiro quiser');
  });
});

describe('core/a11y-sr — a host with NO frames (`raf: undefined`) is the announcer\'s to answer (ADR-0221)', () => {
  it('🔴 [Zero] it writes at once, and does not throw — no root grows a branch for the absence', () => {
    document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert"></p>';
    const a = A.createAnnouncer({ doc: document, raf: undefined });
    expect(() => { a.say('sem quadros'); a.alert('também'); }).not.toThrow();
    expect(document.querySelector('#sr-status').textContent, 'a frameless host announced nothing').toBe('sem quadros');
    expect(document.querySelector('#sr-alert').textContent).toBe('também');
  });
});

describe('core/a11y-sr — the Libras mirror is a sink of each announcer (DD1)', () => {
  it('🔴 [Right] a connected sink hears every say and alert at once (synchronous), until it is released', () => {
    document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert"></p>';
    const a = announcer();
    const signed = [];
    const release = a.mirrorTo((t) => signed.push(t));
    a.say('olá');
    a.alert('cuidado');
    expect(signed).toEqual(['olá', 'cuidado']);
    release();
    a.say('depois');
    expect(signed, 'a released sink still heard').toEqual(['olá', 'cuidado']);
  });

  it('🎯 [Boundary] two announcers share no mirror — the defect of the module-level registration', () => {
    document.body.innerHTML = '<p id="sr-status"></p>';
    const first = announcer();
    const second = announcer();
    const signed = [];
    first.mirrorTo((t) => signed.push(t));
    second.say('de outra raiz');
    expect(signed, 'one root\'s announcement was signed by another root\'s interpreter').toEqual([]);
  });

  it('[Boundary] a second sink replaces the first, and releasing the replaced one changes nothing', () => {
    document.body.innerHTML = '<p id="sr-status"></p>';
    const a = announcer();
    const one = [], two = [];
    const releaseOne = a.mirrorTo((t) => one.push(t));
    a.mirrorTo((t) => two.push(t));
    releaseOne();
    a.say('x');
    expect([one, two]).toEqual([[], ['x']]);
  });
});

describe('core/a11y-sr — robustez', () => {
  it('[Zero] sem a região no DOM não quebra (só não anuncia visualmente); ainda fala em Libras', () => {
    document.body.innerHTML = ''; // sem #sr-status
    const a = announcer();
    let spoken = null;
    a.mirrorTo((t) => { spoken = t; });
    expect(() => a.say('x')).not.toThrow();
    expect(spoken).toBe('x');
  });
});

// ========================= MUTATIONS CHECKED =========================
//   · querying the global `document` instead of the injected one → the «another document» case is red.
//   · writing at once instead of through `raf` → the «frame the HOST lends» case and the [Interface] cases are red.
//   · the mirror as ONE module-level binding again → the «two announcers share no mirror» case is red.
//   · the release clearing the mirror unconditionally → the «second sink replaces» case is red.
//   · the no-frames fallback throwing → the «NO frames» case is red, and so is `boot-create-game.node` (its window has none);
//     the fallback writing NEVER → the «NO frames» case is red.
