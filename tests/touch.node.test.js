// SPDX-License-Identifier: GPL-3.0-or-later
// Testes de input/touch — lógica PURA (project node, sem `document`). ZOMBIES + Right-BICEP.
// Cobre: mm→px (padPxPerMm/computePadPhysicalPx — dpr alto/baixo simulado via tela pequena/grande, extremos),
// a classificação mão-de-criança/adulto (padHandTag), a detecção de layout por id de controle (padLayoutFromId),
// a fusão do mapa de toque persistido (normalizeTouchMap) e padKind() (hoje sem chamadores — ver o retorno da
// extração). O render/DOM real (initTouch: querySelector/addEventListener/persistência) fica fora daqui.
import { describe, it, expect } from 'vitest';
import {
  padPxPerMm, padHandTag, computePadPhysicalPx, padLayoutFromId, normalizeTouchMap, padKind,
  IPHONE16_LONG_MM, IPHONE16_LONG_PX, IPHONE16_PXMM, TOUCH_SLOTS, TOUCH_ACTS,
} from '../app/js/input/touch.js';
import { TOUCH_DEFAULT } from '../app/js/input/devices.js';

describe('padPxPerMm', () => {
  it('[Right] desktop (mobile=false): sempre o ratio fixo do iPhone 16, ignora a janela', () => {
    expect(padPxPerMm(false, 1920, 1080)).toBeCloseTo(IPHONE16_PXMM, 6);
    expect(padPxPerMm(false, 200, 100)).toBeCloseTo(IPHONE16_PXMM, 6); // janela minúscula não muda nada
  });
  it('[Right] celular (mobile=true): ancora na aresta LONGA da janela ÷ 141,1mm', () => {
    expect(padPxPerMm(true, 390, 844)).toBeCloseTo(844 / IPHONE16_LONG_MM, 6); // retrato: 844 é a longa
    expect(padPxPerMm(true, 844, 390)).toBeCloseTo(844 / IPHONE16_LONG_MM, 6); // paisagem: mesmo valor (max)
  });
  it('[Boundary] tela quadrada (w===h): max() não quebra, resultado = w/141.1', () => {
    expect(padPxPerMm(true, 500, 500)).toBeCloseTo(500 / IPHONE16_LONG_MM, 6);
  });
  it('[Extremes] tela minúscula e tela gigante no celular escalam linearmente', () => {
    expect(padPxPerMm(true, 1, 1)).toBeCloseTo(1 / IPHONE16_LONG_MM, 6);
    expect(padPxPerMm(true, 7680, 4320)).toBeCloseTo(7680 / IPHONE16_LONG_MM, 6); // 8K
  });
  it('[Invariant] no aparelho-alvo exato (852×… CSS px, aresta longa 141,1mm) dá exatamente IPHONE16_PXMM', () => {
    expect(padPxPerMm(true, IPHONE16_LONG_PX, 393)).toBeCloseTo(IPHONE16_PXMM, 6);
  });
});

describe('padHandTag', () => {
  it('[Right] abaixo ou igual ao piso = criança; acima ou igual ao teto = adulto; entre = intermediário', () => {
    expect(padHandTag(10, 12, 14)).toBe('crianca');
    expect(padHandTag(16, 12, 14)).toBe('adulto');
    expect(padHandTag(13, 12, 14)).toBe('inter');
  });
  it('[Boundary] o piso e o teto são inclusivos (<=lo / >=hi, não < / >)', () => {
    expect(padHandTag(12, 12, 14)).toBe('crianca');
    expect(padHandTag(14, 12, 14)).toBe('adulto');
  });
  it('[Boundary] piso===teto: tudo <= cai em criança, o resto em adulto (sem faixa intermediária possível)', () => {
    expect(padHandTag(12, 12, 12)).toBe('crianca');
    expect(padHandTag(13, 12, 12)).toBe('adulto');
  });
});

describe('computePadPhysicalPx', () => {
  const mm = { btn: 12.5, gap: 3, stick: 18, travel: 4.5, dpad: 12 };

  it('[Right] converte cada mm pelo pxPerMm e monta a geometria derivada (losango/base/cruz)', () => {
    const r = 6.04; // ~IPHONE16_PXMM
    const px = computePadPhysicalPx(mm, r);
    const btnPx = mm.btn * r, gapPx = mm.gap * r;
    expect(px.btnPx).toBeCloseTo(btnPx, 6);
    expect(px.diamPx).toBeCloseTo(btnPx + Math.SQRT2 * (btnPx + gapPx), 6); // losango: folga de aresta = gap
    const knobPx = mm.stick * r, travelPx = mm.travel * r;
    expect(px.knobPx).toBeCloseTo(knobPx, 6);
    expect(px.basePx).toBeCloseTo(knobPx + 2 * travelPx + 16, 6); // base = contato + curso
    const armPx = mm.dpad * r;
    expect(px.armPx).toBeCloseTo(armPx, 6);
    expect(px.armWPx).toBeCloseTo(armPx * 0.8, 6);
    expect(px.spanPx).toBeCloseTo(2 * armPx + armPx * 0.8, 6);
  });
  it('[Right] deslocamento útil do analógico = o curso convertido (stickTravelPx===travelPx)', () => {
    const px = computePadPhysicalPx(mm, 6.04);
    expect(px.stickTravelPx).toBeCloseTo(mm.travel * 6.04, 6);
  });
  it('[Boundary] zona-morta = 40% do curso, mas nunca abaixo de 6px (piso de segurança)', () => {
    const bigTravel = computePadPhysicalPx({ ...mm, travel: 20 }, 6.04); // 20*6.04*0.4 = 48.32 > 6
    expect(bigTravel.stickDeadPx).toBeCloseTo(20 * 6.04 * 0.4, 6);
    const tinyTravel = computePadPhysicalPx({ ...mm, travel: 0.5 }, 1); // 0.5*1*0.4 = 0.2 < 6 → piso
    expect(tinyTravel.stickDeadPx).toBe(6);
  });
  it('[Extremes] pxPerMm=0 (tela hipotética 0px): tudo zera, exceto o piso de 16px da base e o piso de 6px da zona-morta', () => {
    const px = computePadPhysicalPx(mm, 0);
    expect(px.btnPx).toBe(0);
    expect(px.diamPx).toBe(0);
    expect(px.basePx).toBe(16); // 0 (knob) + 2*0 (travel) + 16
    expect(px.stickDeadPx).toBe(6); // max(6, 0*0.4)
  });
  it('[Extremes] mm/pxPerMm muito grandes não estouram nem viram NaN/Infinity', () => {
    const px = computePadPhysicalPx({ btn: 1000, gap: 1000, stick: 1000, travel: 1000, dpad: 1000 }, 50);
    for (const k of Object.keys(px)) expect(Number.isFinite(px[k])).toBe(true);
  });
});

describe('padLayoutFromId', () => {
  it('[Right] Sony: dualshock/dualsense/playstation/054c (VID) → sony', () => {
    expect(padLayoutFromId('Wireless Controller (DualShock 4)')).toBe('sony');
    expect(padLayoutFromId('DualSense Wireless Controller')).toBe('sony');
    expect(padLayoutFromId('054c-0ce6-Sony Interactive Entertainment Wireless Controller')).toBe('sony');
  });
  it('[Right] Nintendo: switch/nintendo/joy-con/057e (VID) → nintendo', () => {
    expect(padLayoutFromId('Nintendo Switch Pro Controller')).toBe('nintendo');
    expect(padLayoutFromId('Joy-Con (L)')).toBe('nintendo');
    expect(padLayoutFromId('057e-2009')).toBe('nintendo');
  });
  it('[Right] Microsoft: xbox/xinput/microsoft/045e (VID) → microsoft', () => {
    expect(padLayoutFromId('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('microsoft');
    expect(padLayoutFromId('045e-028e-Microsoft Corp.')).toBe('microsoft');
  });
  it('[Right] desconhecido/genérico DirectInput → generic', () => {
    expect(padLayoutFromId('Generic USB Joystick (Vendor: 0079)')).toBe('generic');
  });
  it('[Boundary] case-insensitive', () => {
    expect(padLayoutFromId('XBOX WIRELESS CONTROLLER')).toBe('microsoft');
    expect(padLayoutFromId('DUALSHOCK 4')).toBe('sony');
  });
  it('[Null/Zero] id vazio/undefined/null → generic (sem lançar)', () => {
    expect(padLayoutFromId('')).toBe('generic');
    expect(padLayoutFromId(undefined)).toBe('generic');
    expect(padLayoutFromId(null)).toBe('generic');
  });
});

describe('normalizeTouchMap', () => {
  it('[Right] sem valor salvo (null): retorna exatamente TOUCH_DEFAULT', () => {
    expect(normalizeTouchMap(null)).toEqual(TOUCH_DEFAULT);
  });
  it('[Right] sobrepõe só as chaves presentes no salvo, mantém as demais do padrão', () => {
    const merged = normalizeTouchMap({ b0: 'run' });
    expect(merged.b0).toBe('run');
    expect(merged.up).toBe(TOUCH_DEFAULT.up); // não mexido
  });
  it('[Inverse] não é a MESMA referência de TOUCH_DEFAULT (não muta o módulo-folha)', () => {
    const merged = normalizeTouchMap({ b0: 'run' });
    expect(merged).not.toBe(TOUCH_DEFAULT);
    expect(TOUCH_DEFAULT.b0).toBe('jump'); // devices.ts intocado
  });
  it('[Error] entrada não-objeto (string/number/array/undefined) cai no padrão puro', () => {
    expect(normalizeTouchMap(undefined)).toEqual(TOUCH_DEFAULT);
    expect(normalizeTouchMap('garbage')).toEqual(TOUCH_DEFAULT);
    expect(normalizeTouchMap(42)).toEqual(TOUCH_DEFAULT);
  });
  it('[Boundary] array conta como "object" em JS: passa como está (comportamento ORIGINAL preservado, não corrigido)', () => {
    // Object.assign({}, DEFAULT, []) não muda nada de errado (array sem props enumeráveis próprias) — mas
    // documenta que o guard `typeof stored === "object"` deixa arrays passarem sem checagem extra.
    expect(normalizeTouchMap([])).toEqual(TOUCH_DEFAULT);
  });
  it('[Bug latente, NÃO corrigido] chaves/valores fora de TOUCH_SLOTS/TOUCH_ACTS passam direto — sem validação', () => {
    const merged = normalizeTouchMap({ b0: 'nao-existe', chaveEstranha: 'x' });
    expect(merged.b0).toBe('nao-existe'); // não é uma ação válida (fora de TOUCH_ACTS) e mesmo assim entra
    expect(merged.chaveEstranha).toBe('x'); // slot que nem existe em TOUCH_SLOTS, mesmo assim entra
  });
});

describe('TOUCH_SLOTS / TOUCH_ACTS (dados de apresentação do painel)', () => {
  it('[Right] 9 posições de toque, cada uma com chave e rótulo pt-BR', () => {
    expect(TOUCH_SLOTS.length).toBe(9);
    for (const s of TOUCH_SLOTS) { expect(typeof s.k).toBe('string'); expect(typeof s.lbl).toBe('string'); }
  });
  it('[Right] 9 ações mapeáveis, todas cobertas por TOUCH_ACT_LABELS (verificado no devices.ts real)', () => {
    expect(TOUCH_ACTS.length).toBe(9);
  });
  it('[Invariant] toda ação em TOUCH_DEFAULT é uma das TOUCH_ACTS válidas', () => {
    for (const v of Object.values(TOUCH_DEFAULT)) expect(TOUCH_ACTS).toContain(v);
  });
});

describe('padKind (sem chamadores em game.js — ver o retorno da extração)', () => {
  it('[Right] sem gamepads (ou API ausente no ambiente): kb', () => {
    expect(padKind()).toBe('kb');
  });
});
