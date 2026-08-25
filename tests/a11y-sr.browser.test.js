// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de core/a11y-sr — anúncios p/ leitor de tela (project BROWSER: usa document + requestAnimationFrame).
// Contrato: limpa a região → escreve no próximo frame (força reanúncio) e espelha no VLibras INJETADO.
// Ver docs/plano-modularizacao-mapa.md (Estágio 4, Tier 1, core/a11y-sr).
import { describe, it, expect } from 'vitest';
import * as A from '../app/js/core/a11y-sr.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

describe('core/a11y-sr — srSay (status "polite")', () => {
  it('[Interface] limpa a região, escreve no próximo frame e chama o vlibrasSay injetado', async () => {
    document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert"></p>';
    let spoken = null;
    A.setVlibrasSay((t) => { spoken = t; });
    A.srSay('olá mundo');
    expect(spoken).toBe('olá mundo');                                  // Libras: chamado já (síncrono)
    expect(document.querySelector('#sr-status').textContent).toBe(''); // limpa primeiro (reanúncio de texto repetido)
    await nextFrame();
    expect(document.querySelector('#sr-status').textContent).toBe('olá mundo');
  });
});

describe('core/a11y-sr — srAlert (alerta "assertive")', () => {
  it('[Interface] escreve em #sr-alert e NÃO toca no #sr-status', async () => {
    document.body.innerHTML = '<p id="sr-status"></p><p id="sr-alert"></p>';
    A.setVlibrasSay(() => {});
    A.srAlert('erro!');
    await nextFrame();
    expect(document.querySelector('#sr-alert').textContent).toBe('erro!');
    expect(document.querySelector('#sr-status').textContent).toBe('');
  });
});

describe('core/a11y-sr — robustez', () => {
  it('[Zero] sem a região no DOM não quebra (só não anuncia visualmente); ainda fala em Libras', () => {
    document.body.innerHTML = ''; // sem #sr-status
    let spoken = null;
    A.setVlibrasSay((t) => { spoken = t; });
    expect(() => A.srSay('x')).not.toThrow();
    expect(spoken).toBe('x');
  });
});
