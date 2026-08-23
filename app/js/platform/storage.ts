// SPDX-License-Identifier: GPL-3.0-or-later
// platform/storage.ts — Camada única de persistência (localStorage) — módulo-folha. À prova de exceção:
// localStorage LANÇA em file:// e no modo privado de alguns navegadores, e isso derrubava o boot inteiro (por
// isso todo acesso é try/catch). Centralizar aqui: um lugar para trocar a estratégia (namespacing, IndexedDB…)
// sem caçar ~60 pontos. Migração gradual — nem todo game.js usa isto ainda.

export function get(key: string, fallback: string | null = null): string | null {
  try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
}
export function set(key: string, value: string | number | boolean): boolean {
  try { localStorage.setItem(key, String(value)); return true; } catch { return false; }
}
export function remove(key: string): void { try { localStorage.removeItem(key); } catch { /* noop */ } }

export function getBool(key: string, fallback = false): boolean { const v = get(key, null); return v == null ? fallback : v === '1'; }
export function setBool(key: string, on: boolean): void { set(key, on ? '1' : '0'); }

export function getNum(key: string, fallback = 0): number {
  const v = get(key, null); const n = v == null ? NaN : parseFloat(v);
  return isFinite(n) ? n : fallback;
}

export function getJSON<T = unknown>(key: string, fallback: T | null = null): T | null {
  try { const s = get(key, null); return s == null ? fallback : (JSON.parse(s) as T); } catch { return fallback; }
}
export function setJSON(key: string, obj: unknown): void { try { set(key, JSON.stringify(obj)); } catch { /* noop */ } }

// Registro das chaves conhecidas (documentação em UM lugar; a fonte de verdade ainda é o uso). Vai sendo
// completado à medida que os lotes migram. Chaves com {i}/{cen}/{id} são parametrizadas por jogador/cenário/controle.
export const KEYS = {
  // empatia motora/auditiva
  onebtn: 'incl_onebtn', wheelchair: 'incl_wheelchair', modocego: 'incl_modocego', caneDiv: 'incl_cane_div',
  hearingloss: 'incl_hearingloss',
  // atividade / quiz / cenário
  activity: 'incl_activity', quizlevel: 'incl_quizlevel', cenario: 'incl_cenario', tabsel: 'incl_tabsel',
  fracnot: 'incl_fracnot',
  // visual / contraste / cor
  viz: 'incl_viz', lq: 'incl_lq', cbsafe: 'incl_cbsafe', ownercolors: 'incl_ownercolors',
  outfg: 'incl_outfg', outbg: 'incl_outbg', hcrole: 'incl_hcrole', juice: 'incl_juice', crt: 'incl_crt2',
  crtLegacy: 'incl_crt', // formato antigo (booleano); crt.ts migra p/ incl_crt2 na 1ª leitura (fresh)
  // áudio / voz / i18n
  ttsEngine: 'incl_tts_engine', ttsVoice: 'incl_tts_voice', lang: 'incl_lang', // audiocat_{k}
  // tipografia / controles / toque
  fontKey: 'incl_font_k', padDesign: 'incl_paddesign', padDir: 'incl_paddir', touchmap: 'incl_touchmap',
  padBtnMm: 'incl_padbtnmm', padGapMm: 'incl_padgapmm', padStickMm: 'incl_padstickmm',
  padTravelMm: 'incl_padtravelmm', padDpadMm: 'incl_paddpadmm',
  // por jogador (sufixo _p{i}): viz_p, sink_p, easy_p, togglemove_p, rmWalk_p, rmBreath_p, rmFlavor_p
  // demo/attract: uma gravação por cenário (fn em vez de string — chave parametrizada)
  attract: (cen: string): string => 'incl_attract_' + cen,
};
