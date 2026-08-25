// SPDX-License-Identifier: GPL-3.0-or-later
// render/viz-modes.ts — os 16 modos visuais de acessibilidade (dados) + índices derivados. Módulo-folha, ZERO
// deps. Alto contraste (renderização direta 3 níveis), simulação/correção de daltonismo, baixa visão, cegueira.
// A aplicação dos modos (setPlayerViz/applyVpFilters/overlays) fica no game.js. Ver docs/PESQUISA-ALTO-CONTRASTE.md.
// SEM campo `filter` aqui, de proposito: quem diz "modo -> filtro CSS" e VIZ_FILTER, logo abaixo. Os seis
// modos de daltonismo traziam o `url(#cvd-*)` repetido dentro do proprio registro, mas ninguem lia `m.filter`
// — todo consumo passa por VIZ_FILTER, que alem dos seis cobre baixa visao e cegueira. Duas copias, uma so
// lida: se divergissem, a errada seria a silenciosa. E como o campo era opcional, o tipo tambem calaria.
/**
 * `sim` — este modo SIMULA uma deficiência em quem não a tem, em vez de CORRIGIR a tela para quem a tem.
 *
 * O `kind` não responde a isso e nunca respondeu: `sim-deuter` (simular daltonismo) e `fix-deuter` (corrigir
 * daltonismo) compartilham `kind:'filter'`, ainda que sirvam a duas pessoas opostas. Enquanto ninguém
 * precisava distinguir, a lacuna era inofensiva. Passou a não ser quando o menu de empatia ganhou um
 * "restaurar padrões" (ADR-0028): desligar as simulações é o objetivo do botão, e desligar as correções junto
 * seria tirar de uma criança daltônica a única correção que ela tem — a partir do menu que existe para quem
 * NÃO tem a deficiência. Um reset que faz isso é pior que a armadilha que ele deveria desfazer.
 *
 * Só os 9 modos marcados simulam. Os 3 `fix-*` corrigem, os 3 `hc-direto*` corrigem, e `normal` não faz nada.
 */
export type VizMode = { key: string; kind: string; nome: string; desc: string; lv?: string; sim?: true };
export const VIZ_MODES: VizMode[] = [
  {key:'normal', kind:'normal', nome:'Cores normais',        desc:'Arte original do jogo.'},
  {key:'hc-direto', kind:'hcnew', nome:'Alto contraste: Renderização Direta (3:1)', desc:'Fundo recua + contornos + cor por papel; plataforma×fundo ~3:1 (AA gráficos), tons agradáveis.'},
  {key:'hc-direto-45', kind:'hcnew', nome:'Alto contraste: Renderização Direta (4,5:1)', desc:'Mais contraste (AA texto): plataformas mais claras e fundo mais escuro.'},
  {key:'hc-direto-7', kind:'hcnew', nome:'Alto contraste: Renderização Direta (7:1)', desc:'Contraste máximo (AAA texto): quase preto e branco. Menos agradável, para quem precisa do máximo.'},
  {key:'sim-deuter', sim:true, kind:'filter', nome:'Simular Deuteranopia', desc:'Como vê quem não enxerga o verde (mais comum).'},
  {key:'sim-protan', sim:true, kind:'filter', nome:'Simular Protanopia',   desc:'Como vê quem não enxerga o vermelho.'},
  {key:'sim-tritan', sim:true, kind:'filter', nome:'Simular Tritanopia',   desc:'Como vê quem não enxerga o azul.'},
  {key:'fix-protan', kind:'filter', nome:'Correção protanopia', desc:'Daltonização: realça a distinção vermelho/verde para quem tem protanopia.'},
  {key:'fix-deuter', kind:'filter', nome:'Correção deuteranopia', desc:'Daltonização: realça a distinção vermelho/verde para quem tem deuteranopia.'},
  {key:'fix-tritan', kind:'filter', nome:'Correção tritanopia', desc:'Daltonização: realça a distinção azul/amarelo para quem tem tritanopia.'},
  {key:'lv-blur',     sim:true, kind:'lowvision', lv:'blur',     nome:'Baixa visão: desfoque',         desc:'Miopia severa / astigmatismo. (bolinha verde; toque 2× p/ sair)'},
  {key:'lv-haze',     sim:true, kind:'lowvision', lv:'haze',     nome:'Baixa visão: névoa',            desc:'Catarata — película esbranquiçada, baixo contraste.'},
  {key:'lv-tunnel',   sim:true, kind:'lowvision', lv:'tunnel',   nome:'Baixa visão: visão de túnel',   desc:'Glaucoma — só o centro é visível.'},
  {key:'lv-macular',  sim:true, kind:'lowvision', lv:'macular',  nome:'Baixa visão: mancha central',   desc:'Degeneração macular — borrão no centro.'},
  {key:'lv-diabetic', sim:true, kind:'lowvision', lv:'diabetic', nome:'Baixa visão: manchas dispersas',desc:'Retinopatia diabética — manchas espalhadas.'},
  {key:'blind', sim:true, kind:'blind', nome:'Simular cegueira total', desc:'Tela preta — jogue como uma pessoa cega (resposta tátil/sonora). (bolinha branca; toque 2× p/ sair)'},
];
export const VIZ_BY_KEY: Record<string, VizMode> = Object.fromEntries(VIZ_MODES.map((m): [string, VizMode] => [m.key, m]));
export const VIZ_FILTER: Record<string, string> = {'sim-deuter':'url(#cvd-deuter)','sim-protan':'url(#cvd-protan)','sim-tritan':'url(#cvd-tritan)',
  'fix-protan':'url(#cvd-fix-protan)','fix-deuter':'url(#cvd-fix-deuter)','fix-tritan':'url(#cvd-fix-tritan)',
  'lv-blur':'blur(2.4px)', 'lv-haze':'contrast(.58) brightness(1.14) blur(.6px)', 'lv-tunnel':'blur(.5px)', 'lv-macular':'', 'lv-diabetic':'blur(.8px)', 'blind':'brightness(0)'};
export const VIZ_CYCLE: string[] = VIZ_MODES.map((m) => m.key);

/**
 * Este modo simula uma deficiência? Chave desconhecida (ou vazia) → false, porque a pergunta que o chamador
 * está fazendo é "posso desligar isto sem tirar nada de ninguém?", e a resposta honesta diante do
 * desconhecido é não.
 */
export function simulatesDisability(key: string): boolean {
  return VIZ_BY_KEY[key]?.sim === true;
}
