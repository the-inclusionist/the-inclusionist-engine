// SPDX-License-Identifier: AGPL-3.0-or-later
// Tests of input/touch — PURE logic (node project, no `document`). ZOMBIES + Right-BICEP.
// Covers: mm→px (padPxPerMm/computePadPhysicalPx — high/low dpr simulated through a small/large screen, extremes), the
// child/adult hand classification (padHandTag), layout detection by controller id (padLayoutFromId), and the merge of the
// persisted touch map (normalizeTouchMap). The real render/DOM (initTouch: querySelector/addEventListener/persistence) is
// outside — except for the last case, which mounts `initTouch` on a host with NO window, which is why only here it can be
// measured.
import { describe, it, expect } from 'vitest';
import { createTranslator } from '../app/js/core/i18n.js';
const translate = createTranslator().t;
import {
  padPxPerMm, padHandTag, computePadPhysicalPx, padLayoutFromId, normalizeTouchMap,
  IPHONE16_LONG_MM, IPHONE16_LONG_PX, IPHONE16_PXMM, TOUCH_SLOTS, TOUCH_ACTS,
} from '../app/js/input/touch.js';
import { TOUCH_DEFAULT } from '../app/js/input/devices.js';
import { presetFalso as platformerPreset } from './fixtures/fake-cartridge.js'; // ADR-0096: the REAL preset belongs to the game; here the behaviour is proved GIVEN a nine-position preset
import pt from '../app/js/i18n/pt.js';

describe('padPxPerMm', () => {
  it('[Right] desktop (mobile=false): sempre o ratio fixo do iPhone 16, ignora a janela', () => {
    expect(padPxPerMm(false, 1920, 1080)).toBeCloseTo(IPHONE16_PXMM, 6);
    expect(padPxPerMm(false, 200, 100)).toBeCloseTo(IPHONE16_PXMM, 6); // a tiny window changes nothing
  });
  it('[Right] celular (mobile=true): ancora na aresta LONGA da janela ÷ 141,1mm', () => {
    expect(padPxPerMm(true, 390, 844)).toBeCloseTo(844 / IPHONE16_LONG_MM, 6); // portrait: 844 is the long one
    expect(padPxPerMm(true, 844, 390)).toBeCloseTo(844 / IPHONE16_LONG_MM, 6); // paisagem: mesmo valor (max)
  });
  it('📌 [Right] it is an ESTIMATE, not a measurement: a 10-inch tablet window is read as an iPhone 16 display (plan phase 5b)', () => {
    // 1280×800 CSS on a tablet whose glass is ~216 mm long: the function answers 1280 / 141.1 ≈ 9.07 px/mm, not 1280 / 216 ≈ 5.93.
    // The documented example is this case; a consumer reading «real millimetres» from it sizes a target ~53% larger than meant.
    expect(padPxPerMm(true, 1280, 800)).toBeCloseTo(9.07, 2);
    expect(padPxPerMm(true, 1280, 800)).not.toBeCloseTo(1280 / 216, 1);
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
    const merged = normalizeTouchMap({ b0: 'action1' });
    expect(merged.b0).toBe('action1');
    expect(merged.up).toBe(TOUCH_DEFAULT.up); // untouched
  });
  it('[Inverse] não é a MESMA referência de TOUCH_DEFAULT (não muta o módulo-folha)', () => {
    const merged = normalizeTouchMap({ b0: 'action1' });
    expect(merged).not.toBe(TOUCH_DEFAULT);
    expect(TOUCH_DEFAULT.b0).toBe('action2'); // devices.ts intocado
  });
  it('[Error] entrada não-objeto (string/number/array/undefined) cai no padrão puro', () => {
    expect(normalizeTouchMap(undefined)).toEqual(TOUCH_DEFAULT);
    expect(normalizeTouchMap('garbage')).toEqual(TOUCH_DEFAULT);
    expect(normalizeTouchMap(42)).toEqual(TOUCH_DEFAULT);
  });
  it('[Boundary] array conta como "object" em JS: passa como está (comportamento ORIGINAL preservado, não corrigido)', () => {
    // Object.assign({}, DEFAULT, []) changes nothing wrongly (an array with no own enumerable props) — but it documents that
    // the `typeof stored === "object"` guard lets arrays through with no extra check.
    expect(normalizeTouchMap([])).toEqual(TOUCH_DEFAULT);
  });
  it('[Bug latente, NÃO corrigido] chaves/valores fora de TOUCH_SLOTS/TOUCH_ACTS passam direto — sem validação', () => {
    const merged = normalizeTouchMap({ b0: 'nao-existe', chaveEstranha: 'x' });
    expect(merged.b0).toBe('nao-existe'); // not a valid action (outside TOUCH_ACTS) and it gets in anyway
    expect(merged.chaveEstranha).toBe('x'); // a slot that does not even exist in TOUCH_SLOTS, it gets in anyway
  });
});

describe('TOUCH_SLOTS / TOUCH_ACTS (dados de apresentação do painel)', () => {
  it('[Right] 13 posições de toque, cada uma com chave e chave-i18n de rótulo', () => {
    // the nine slots plus the four shoulders of ADR-0160 (L2, L1, R2, R1) make thirteen
    expect(TOUCH_SLOTS.length).toBe(13);
    for (const s of TOUCH_SLOTS) { expect(typeof s.k).toBe('string'); expect(typeof s.lbl).toBe('string'); }
  });
  // A check of `TOUCH_ACTS.length` alone could not fail on an empty label table. This walks the preset and the slots: an
  // action with no word leaves a blank <option> in the panel.
  it('⚠️ o PRESET do jogo nomeia tudo o que o transporte de toque consegue carregar', () => {
    // The words belong to the game (there is no engine table of action labels), so the invariant is asked of a preset:
    // if the preset stopped naming a position touch carries, that slot's menu would lose the option. For another game
    // that could be a legitimate decision; for this nine-position preset it is a regression, and that is what is asserted.
    const preset = platformerPreset();
    // ⚠️ The SHOULDERS are positions touch carries since ADR-0160 and the preset does not use: they only appear if the game
    // names them (ADR-0162), so not naming them is legitimate and not a regression.
    const OMBROS = new Set(['leftShoulder', 'leftTrigger', 'rightShoulder', 'rightTrigger']);
    for (const a of TOUCH_ACTS.filter((x) => !OMBROS.has(x))) {
      expect(preset[a], `a plataforma não nomeia "${a}", que o toque carrega`).toBeTruthy();
      expect(preset[a].label, `rótulo vazio para "${a}"`).toBeTruthy();
    }
  });
  it('[Invariant] toda ação em TOUCH_DEFAULT é uma das TOUCH_ACTS válidas', () => {
    for (const v of Object.values(TOUCH_DEFAULT)) expect(TOUCH_ACTS).toContain(v);
  });
});

describe('initTouch where there is no window at all', () => {
  it('⚠️ [Error] a host with no window and no `ctx.win` boots the pad and listens to nothing — it never throws', async () => {
    // 📏 This is the one place this file mounts `initTouch`, and on purpose: Node has no global `addEventListener`, which is
    // exactly the host the guard exists for («wired to `createGame`, it brought down every boot in a fake document»). Falling
    // back to `globalThis` unguarded would call a method that is not there.
    const { initTouch } = await import('../app/js/input/touch.js');
    const guardado = new Map();
    const ctx = {
      t: translate, // the root's translator, played by the test (ADR-0232 D3)
      $: () => null, srSay: () => {}, gameActions: () => [], padAllowed: () => true,
      store: {
        get: (k, fb = null) => (guardado.has(k) ? guardado.get(k) : fb), set: (k, v) => { guardado.set(k, String(v)); return true; },
        getNum: (_k, fb = 0) => fb, getJSON: (_k, fb = null) => fb, setJSON: () => {},
      },
      root: { style: { setProperty: () => {} } }, isMobile: () => false, viewport: () => ({ w: 1280, h: 720 }), frontOverlay: () => {},
    };
    expect(typeof globalThis.addEventListener, 'this host has a global window after all: the case measures nothing').toBe('undefined');
    expect(() => initTouch(ctx)).not.toThrow();
  });
});
