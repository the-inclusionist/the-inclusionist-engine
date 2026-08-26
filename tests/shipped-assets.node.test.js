// SPDX-License-Identifier: AGPL-3.0-or-later
// O QUE EMBARCA — o gate do item 18, reformulado (project node: só lê o disco).
//
// A NOTA DA PIPELINE PEDIA "nenhum PNG fora de sprites/", e essa regra estava errada. O Dev decidiu em
// 2026-08-25 MANTER A ARTE RASTER dos fundos e pediu três camadas novas para a Floresta. Um gate que proibisse
// PNG fora de `sprites/` reprovaria a arte que ele acabou de pedir — e o jeito rápido de fazê-lo passar seria
// apagar os fundos. Um gate que empurra na direção errada é pior que gate nenhum: ele terceiriza uma decisão
// de produto para uma regra que ninguém releu.
//
// A REGRA CERTA é mais estreita e verdadeira: NÃO EMBARCA O QUE O JOGO NÃO CARREGA.
//
//   · Sprites de personagem e camadas de fundo EMBARCAM — são arte raster, por decisão.
//   · Arte de AUTORIA não embarca. Ela é fonte, não produto, e vive em `docs/art-ref`.
//   · Arte que virou DADOS não embarca duas vezes. Os dois tiles da Cidade viraram `render/city-tiles`; os
//     PNG deles saíram do pacote e continuam versionados como referência de fidelidade.
//
// O que este gate pega, e por que vale: `tileset.png` e `tileset.json` (21 KB) viajaram no pacote sem que
// UMA linha de código os pedisse. Peso morto não dá erro, não aparece em teste e não incomoda ninguém — só
// custa banda, e custa exatamente na máquina de escola pública que o pilar 1 nomeia.
import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PUBLICO = join(process.cwd(), 'app', 'public', 'assets');
const REF = join(process.cwd(), 'docs', 'art-ref');

/** Todos os arquivos sob um diretório, como caminhos relativos com barra. */
function arquivos(dir, base = dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const nome of readdirSync(dir)) {
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) arquivos(p, base, acc);
    else acc.push(p.slice(base.length + 1).replace(/\\/g, '/'));
  }
  return acc;
}

const EMBARCADOS = arquivos(PUBLICO);

describe('o que embarca — item 18, reformulado', () => {
  it('[Zero] o gate está olhando arquivos de verdade', () => {
    expect(EMBARCADOS.length).toBeGreaterThan(50);
  });

  it('[Right] NENHUM tile embarca — eles viraram dados em render/city-tiles', () => {
    // `tile_fill.png` e `tile_surface.png` são desenhados agora. Se voltarem para cá, ou alguém desfez o #16
    // ou alguém copiou arte de autoria para dentro do pacote sem querer.
    const tiles = EMBARCADOS.filter((f) => /(^|\/)tile[_-]/.test(f));
    expect(tiles, 'tile embarcado: ele é código desde o #16').toEqual([]);
  });

  it('[Right] NENHUM tileset embarca — nada no código pediu, nunca', () => {
    // Estes dois viajaram 21 KB sem um único leitor. É o caso que motivou o gate.
    const ts = EMBARCADOS.filter((f) => /(^|\/)tileset\./.test(f));
    expect(ts, 'tileset embarcado sem ninguém para lê-lo').toEqual([]);
  });

  it('[Interface] os fundos de cenário NÃO embarcam mais — e a troca foi decisão registrada', () => {
    // ESTE CASO EXISTIA PARA IMPEDIR EXATAMENTE ISTO: ele dizia "os fundos de cenário EMBARCAM — é decisão
    // do Dev, não descuido", e existia para o gate não ser apertado por engano por alguém que achasse
    // raster feio. Ele fez o trabalho dele: falhou no commit que removeu os arquivos, e obrigou a mudança a
    // ser deliberada.
    //
    // A decisão está no ADR-0042 (opção P1), e o motivo não é peso de pacote: é que o fundo da Cidade é a
    // maior superfície da tela e, enquanto era PNG, era a única que o alto contraste jamais repintava.
    //
    // A inversão da asserção é o ponto: agora o gate protege o outro lado. Se um fundo raster voltar sem
    // um registro que o autorize, é aqui que ele aparece.
    const fundos = EMBARCADOS.filter((f) => /cenarios\//.test(f));
    expect(fundos, 'fundo de cenário voltou a embarcar — ver ADR-0042 antes de mexer nesta linha').toEqual([]);
  });

  it('[Interface] os sprites de personagem EMBARCAM — são raster por enquanto', () => {
    // O plano de arte procedural (plano-arte-procedural.md, passo 6) prevê migrar personagens e tiles para o
    // sistema semântico. Tiles já foram; personagens não. Enquanto não forem, eles embarcam — e este caso
    // registra isso como estado conhecido, e não como esquecimento.
    expect(EMBARCADOS.filter((f) => f.startsWith('sprites/')).length).toBeGreaterThan(50);
  });

  it('[Right] a arte de AUTORIA está fora do pacote e dentro do repositório', () => {
    // As duas metades importam. Fora do pacote: não custa banda a ninguém. Dentro do repositório: o teste de
    // fidelidade do `city-tiles` compara contra ela, e uma referência que evapora leva a garantia junto.
    const ref = arquivos(REF);
    expect(ref).toContain('cenarios/cidade/tile_fill.png');
    expect(ref).toContain('cenarios/cidade/tile_surface.png');
    for (const f of ref) expect(EMBARCADOS).not.toContain(f);
  });
});
