// SPDX-License-Identifier: AGPL-3.0-or-later
// O QUE DESCE TEM DE TER QUEM O LEIA — senão são 241 MB de peso morto no aparelho de uma escola.
//
// ========================= 🔴 O DEFEITO QUE ESTE FICHEIRO EXISTE PARA APANHAR FOI COMETIDO HOJE, POR MIM =========================
// Em 2026-09-09 construí o `platform/pesados` para descer as quatro vozes no primeiro carregamento (ADR-0110,
// pedido do Dev). O gate que escrevi afirma que o buscador RELATA com honestidade — que uma entrada sem fonte
// devolve `sem-fonte` com a razão. **Nada afirmava que os bytes que descem podem ser LIDOS por alguém.**
//
// 📏 MEDIDO DEPOIS, e por dois métodos porque um comentário não é uma medição:
//
//   · a engine busca em `huggingface.co/rhasspy/piper-voices/resolve/main` (`platform/voice-plan`);
//   · o `@mintplex-labs/piper-tts-web@1.0.4` INSTALADO — lido do bundle, não do README — busca em
//     `huggingface.co/diffusionstudio/piper-voices/resolve/main`;
//   · os dois servem o MESMO ficheiro (63 201 294 bytes, CORS aberto nos dois) por caminhos idênticos;
//   · a biblioteca guarda com `navigator.storage`, e o buscador guarda em **Cache Storage**;
//   · e o `vite.config` não tem `runtimeCaching` NENHUM, logo nenhum service worker liga as duas pontas.
//
// 🎯 SÃO DOIS DESENCONTROS E BASTAVA UM: URL diferente e armazenamento diferente. A criança descarrega 241 MB
// no primeiro dia, e no dia em que a voz é pedida a biblioteca **descarrega tudo outra vez**. É a forma exacta
// do defeito que o ADR-0119 mediu — um subsistema que PARECE tratado — cometida pelo commit que existia para
// o corrigir.
//
// ⚠️ E É A MESMA FALHA DE MÉTODO DO ADR-0121, UM NÍVEL ACIMA: verifiquei a coerência interna do mecanismo e
// não que a saída dele chega a um consumidor. `vozEmUso` era órfão no ESTADO; isto é órfão nos BYTES.
//
// 📌 POR QUE É INVENTÁRIO E NÃO PROIBIÇÃO: exigir que os dois concordem HOJE nasceria vermelho e ficaria
// vermelho — a reconciliação é a cláusula 2 do ADR-0124 (a engine passa a ser dona do runtime), que não está
// construída. Um gate permanentemente vermelho é um gate que alguém desliga. Então declara-se, com a razão, e
// a lista ENCOLHE quando cada desencontro for resolvido.
//
// MUTAÇÕES CONFERIDAS (no fim do ficheiro).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOST_DOS_MODELOS } from '../app/js/platform/voice-plan.js';

const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const LIB = join(RAIZ, 'node_modules', '@mintplex-labs', 'piper-tts-web');

/** Todo host `huggingface.co/<dono>/<repo>` que o bundle INSTALADO nomeia. Lido do código, não do README. */
function hostsDaBiblioteca() {
  const achados = new Set();
  const ver = (dir) => {
    for (const nome of readdirSync(dir)) {
      const p = join(dir, nome);
      if (statSync(p).isDirectory()) { ver(p); continue; }
      if (!/\.(js|mjs|cjs)$/.test(nome)) continue;
      for (const m of readFileSync(p, 'utf8').matchAll(/huggingface\.co\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g)) {
        achados.add(`https://${m[0]}`);
      }
    }
  };
  ver(LIB);
  return [...achados];
}

/**
 * OS DESENCONTROS DECLARADOS, com a razão e o que os resolve. ⚠️ Um TECTO QUE SÓ DESCE: entrada nova exige
 * escrever aqui porquê, e entrada resolvida tem de SAIR — senão o inventário reporta uma dívida já paga, que
 * é o defeito que o `nada-vem-de-fora` já registou nas próprias mutações.
 */
const DESENCONTROS = {
  // ✅ O DESENCONTRO DE `host` SAIU DAQUI EM 2026-09-09, e sair é o ponto: o `HOST_DOS_MODELOS` passou a
  // apontar para `diffusionstudio`, que é onde o único leitor destes bytes lê. Uma entrada que fica depois de
  // paga faz o inventário reportar um defeito consertado — o erro que o `nada-de-cdn-a-mao` cometeu com a
  // frase «sai desta lista quando o buscador existir». O caso do host abaixo agora exige a AUSÊNCIA dela.
  'armazenamento': 'O buscador guarda em Cache Storage (`incl-pesados-v1`) e a biblioteca guarda com '
    + '`navigator.storage`. ⚠️ Com a URL alinhada isto DEIXOU de custar uma segunda descarga — o pedido da '
    + 'biblioteca passa pelo service worker e é servido da nossa cache — e passou a custar DISCO: os mesmos '
    + '241 MB ficam guardados duas vezes no aparelho, uma em cada armazenamento. Num tablet de escola isso é '
    + 'o dobro do que a criança pode gastar. 📌 Resolve-se com a cláusula 2 do ADR-0124 (a engine dona do '
    + 'runtime lê da própria cache) — a rota de runtime é o remendo, não a saída.',
};

describe('o que desce tem quem o leia', () => {
  it('🎯 [Vácuo] a biblioteca instalada É lida, e nomeia um host de modelos', () => {
    // Sem isto, uma instalação em falta faria os casos abaixo medir o nada com ar de acordo — que é
    // exactamente como este defeito passou despercebido da primeira vez.
    const hosts = hostsDaBiblioteca();
    expect(hosts.length, 'o bundle do fornecedor não nomeia host nenhum — o detector morreu').toBeGreaterThan(0);
    expect(hosts.some((h) => h.includes('piper-voices')), 'nenhum host de vozes no bundle').toBe(true);
  });

  it('🔴 [Zero] o host de onde a ENGINE busca e o host que o FORNECEDOR lê estão reconciliados, ou declarados', () => {
    const doFornecedor = hostsDaBiblioteca().filter((h) => h.includes('piper-voices'));
    const nosso = HOST_DOS_MODELOS.replace(/\/resolve\/main\/?$/, '').replace(/\/$/, '');
    const acordam = doFornecedor.some((h) => h.replace(/\/$/, '') === nosso);

    if (!acordam) {
      expect(
        DESENCONTROS.host,
        `a engine busca em «${nosso}» e o fornecedor lê de «${doFornecedor.join(' · ')}» — os 241 MB que descem `
        + 'no primeiro dia não são lidos por ninguém, e a biblioteca descarrega tudo outra vez. Reconcilie, ou '
        + 'declare o desencontro com a razão e o que o resolve.',
      ).toBeTruthy();
      expect(DESENCONTROS.host.length, 'a razão é curta demais para servir a quem a lê').toBeGreaterThan(80);
    } else {
      expect(DESENCONTROS.host, 'os hosts concordam e a entrada ficou na lista — dívida já paga').toBeUndefined();
    }
  });

  it('🔴 [Zero] o armazenamento do buscador e o do fornecedor estão reconciliados, ou declarados', () => {
    const usaCacheStorage = /caches\s*\.\s*open\s*\(/.test(
      readdirSync(LIB, { recursive: true })
        .filter((n) => typeof n === 'string' && /\.(js|mjs|cjs)$/.test(n))
        .map((n) => readFileSync(join(LIB, n), 'utf8'))
        .join('\n'),
    );
    if (!usaCacheStorage) {
      expect(DESENCONTROS.armazenamento, 'o fornecedor não usa Cache Storage e nada o declara').toBeTruthy();
      expect(DESENCONTROS.armazenamento.length).toBeGreaterThan(80);
    } else {
      expect(DESENCONTROS.armazenamento, 'os dois usam Cache Storage e a entrada ficou — dívida já paga')
        .toBeUndefined();
    }
  });

  it('📌 [Boundary] a lista de desencontros é um TECTO que só desce: eram DOIS, é UM', () => {
    // 🎯 O número é a cláusula, e desceu por trabalho e não por edição: o desencontro de `host` foi PAGO em
    // 2026-09-09 (o `HOST_DOS_MODELOS` passou a apontar para onde o leitor lê). Um terceiro — outro
    // fornecedor, outro formato, outra cache — é a decisão da #129 a ser tomada de lado por quem estava a
    // ligar um cabo, e tem de custar uma linha escrita.
    expect(Object.keys(DESENCONTROS).sort(), 'o inventário mudou de tamanho — escreva porquê')
      .toEqual(['armazenamento']);
  });
});

// ================================ MUTAÇÕES CONFERIDAS ================================
// 1. 🎯 apagar a entrada `host` do inventário → reprovam DOIS ([Zero] do host e o tecto). É a mutação que
//    prova que este ficheiro mede o desencontro e não a existência de um objecto.
// 2. `HOST_DOS_MODELOS` mudado para `diffusionstudio` → o [Zero] do host reprova pelo ramo CONTRÁRIO: os
//    hosts passam a concordar e a entrada torna-se dívida paga que ficou na lista. ⚠️ É o par que impede o
//    inventário de reportar para sempre um defeito consertado — o erro que o `nada-de-cdn-a-mao` cometeu com
//    a frase «sai desta lista quando o buscador existir».
// 3. o detector de hosts a devolver vazio → o [Vácuo] reprova, e é o caso que impede tudo o resto de ficar
//    verde por não haver nada que medir. Foi assim que o defeito passou da primeira vez.
