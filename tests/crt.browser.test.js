// SPDX-License-Identifier: AGPL-3.0-or-later
// Testes de render/crt — estética CRT (project BROWSER: usa #game-region, classList, style, localStorage).
// CRT é config MUTÁVEL (o menu ajusta as props) → fixamos CRT.scan/vig/round no teste e checamos as classes CSS.
// Ver docs/plano-modularizacao-mapa.md (Estágio 4, Tier 1, render/crt).
import { describe, it, expect } from 'vitest';
import { CRT, crtScanVars, applyCrt, initCrt } from '../app/js/render/crt.js';

const region = () => { document.body.innerHTML = '<div id="game-region" style="height:360px"></div>'; return document.querySelector('#game-region'); };

describe('render/crt — applyCrt (classes CSS no #game-region)', () => {
  it('[Right] CRT.scan → classe crt-scan-1 + variável --scan-per definida', () => {
    const g = region();
    CRT.scan = 1; CRT.vig = 0; CRT.round = 1;
    applyCrt();
    expect(g.classList.contains('crt-scan-1')).toBe(true);
    expect(g.style.getPropertyValue('--scan-per')).not.toBe('');
  });
  it('[Interface] vinheta e cantos: vig=1→crt-vig-1; round=2→crt-round-2; round=1 não gera classe', () => {
    const g = region();
    CRT.scan = 0; CRT.vig = 1; CRT.round = 2;
    applyCrt();
    expect(g.classList.contains('crt-vig-1')).toBe(true);
    expect(g.classList.contains('crt-round-2')).toBe(true);
    expect(g.classList.contains('crt-scan-1')).toBe(false); // scan=0 → sem scanline
  });
  it('[Inverse] tudo desligado (scan/vig 0, round 1) → nenhuma classe crt-*', () => {
    const g = region();
    CRT.scan = 0; CRT.vig = 0; CRT.round = 1;
    applyCrt();
    expect([...g.classList].some((c) => c.startsWith('crt-'))).toBe(false);
  });
});

describe('render/crt — crtScanVars (scanline ancorada em px reais)', () => {
  it('[Interface] define --scan-per e --scan-line quando há scanline', () => {
    const g = region();
    CRT.scan = 1;
    crtScanVars();
    expect(g.style.getPropertyValue('--scan-per')).toMatch(/px$/);
    expect(g.style.getPropertyValue('--scan-line')).toMatch(/px$/);
  });
});

// ---------------------------------------------------------------------------------------------------------
// A VINHETA CEDE PARA A ACESSIBILIDADE — ADR-0020: "modos de a11y suprimem o CRT decorativo (precedência
// a11y > estética)". A regra estava DECIDIDA desde 2026-07-06 e nunca tinha sido implementada; a emenda de
// 2026-08-26 mediu e confirmou: com a vinheta ligada, `crt-vig-1` sobrevivia em `hc-direto`, `fix-deuter`,
// `lv-blur` e `blind`.
//
// Uma vinheta escurece as BORDAS. Em alto contraste — o modo que existe para AUMENTAR contraste — ela
// trabalha contra o próprio motivo de a criança tê-lo ligado.
//
// MUTAÇÕES CONFERIDAS:
//   · tirando o `&& !_a11yVisualAtiva()` de `render/crt.applyCrt`, o caso [Right] falha em
//     "expected true to be false" — a vinheta sobrevive ao modo de acessibilidade.
//   · trocando o `!` por nada (suprimir quando NÃO há a11y), o caso [Inverse] falha — a vinheta some de
//     quem não pediu acessibilidade nenhuma.
describe('render/crt — a decoração cede para a acessibilidade (ADR-0020)', () => {
  const comA11y = (ativa) => initCrt({ numJogadores: () => 1, a11yVisualAtiva: () => ativa });

  it('[Right] com modo de a11y ativo, a vinheta NÃO é aplicada', () => {
    const g = region();
    comA11y(true);
    CRT.scan = 0; CRT.vig = 1; CRT.round = 1;
    applyCrt();
    expect(g.classList.contains('crt-vig-1')).toBe(false);
  });

  it('[Inverse] sem modo de a11y, a mesma vinheta é aplicada — a supressão é do modo, não do valor', () => {
    const g = region();
    comA11y(false);
    CRT.scan = 0; CRT.vig = 1; CRT.round = 1;
    applyCrt();
    expect(g.classList.contains('crt-vig-1')).toBe(true);
  });

  it('[Interface] suprimir NÃO é desligar: a preferência da criança fica gravada e volta sozinha', () => {
    // A distinção importa para quem administra a máquina da escola: se a supressão apagasse `CRT.vig`, sair
    // do modo de acessibilidade devolveria a criança a uma estética que ela não escolheu de volta.
    const g = region();
    comA11y(true);
    CRT.scan = 0; CRT.vig = 1; CRT.round = 1;
    applyCrt();
    expect(CRT.vig, 'a supressão não pode apagar a preferência').toBe(1);
    comA11y(false);
    applyCrt();
    expect(g.classList.contains('crt-vig-1')).toBe(true);
  });

  it('[Right] a SCANLINE TAMBÉM cede — a reversão que este caso existia para receber', () => {
    // ⚠️ ESTE CASO AFIRMAVA O CONTRÁRIO ATÉ 2026-08-27, e a troca é o ponto.
    //
    // O ADR-0020 nomeava `CRT_VIGNETTE` e "flashes decorativos"; a scanline não estava na lista, e é a única
    // das três que vem LIGADA de fábrica. Levei a pergunta ao Dev em vez de deduzir, e a resposta foi
    // "Scanline não deverá ceder a acessibilidade **por enquanto**". O "por enquanto" ficou escrito aqui de
    // propósito — este caso era o lugar onde a reversão apareceria.
    //
    // Ela apareceu: "ceda o scanline e o CRT à acessibilidade, mas deixe uma opção de não ceder para cada um
    // no menu conforto visual" (ADR-0047). O caso não foi apagado; foi virado, e o histórico fica.
    const g = region();
    comA11y(true);
    CRT.scan = 1; CRT.vig = 0; CRT.round = 1; CRT.manterScan = 0;
    applyCrt();
    expect(g.classList.contains('crt-scan-1')).toBe(false);
  });

  it('[Right] a SAÍDA da criança devolve cada efeito, um por vez', () => {
    // Duas chaves e não uma: a scanline risca, a vinheta escurece as bordas. Quem tolera uma pode não
    // tolerar a outra, e uma chave só forçaria aceitar as duas para ficar com uma.
    const g = region();
    comA11y(true);
    CRT.scan = 1; CRT.vig = 1; CRT.round = 1; CRT.manterScan = 1; CRT.manterVig = 0;
    applyCrt();
    expect(g.classList.contains('crt-scan-1'), 'a saída da scanline foi pedida').toBe(true);
    expect(g.classList.contains('crt-vig-1'), 'a da vinheta não').toBe(false);
    CRT.manterScan = 0; CRT.manterVig = 1;
    applyCrt();
    expect(g.classList.contains('crt-scan-1')).toBe(false);
    expect(g.classList.contains('crt-vig-1')).toBe(true);
  });

  it('[Zero] a saída NÃO LIGA um efeito desligado', () => {
    // A armadilha do nome: "não ceder" fala da supressão, não do efeito. Quem desligou a scanline não pode
    // vê-la voltar ao entrar em alto contraste — seria o oposto do que a opção promete.
    const g = region();
    comA11y(true);
    CRT.scan = 0; CRT.vig = 0; CRT.round = 1; CRT.manterScan = 1; CRT.manterVig = 1;
    applyCrt();
    expect(g.classList.contains('crt-scan-1')).toBe(false);
    expect(g.classList.contains('crt-vig-1')).toBe(false);
  });
});
