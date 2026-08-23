#!/usr/bin/env python3
"""Confere o que um corte de extração levou junto.

    python scripts/check-extraction.py [ref]        # ref padrão: HEAD

Compara as declarações de topo de `app/js/game.js` entre `ref` e a cópia de
trabalho, e acusa toda declaração que SUMIU mas continua sendo referenciada —
que é a forma como uma remoção acidental passa por build e testes.

Por que existe: removendo um bloco por marcadores de início e fim, é fácil o
intervalo abarcar vizinhos que não eram do módulo. Aconteceu três vezes nesta
migração: a chave de fechamento de `stepTileFx`, o par
`simNaoGlyphs`/`renderPauseLegend`, e `padKind`/`updateTitleLegend` com os dois
ouvintes de gamepad. Nas três, `npm run build` ou o navegador acusaram — mas só
depois, e uma delas chegou a ser publicada. Uma lista de nomes escrita à mão não
serve: ela só encontra o que já se suspeita ter perdido.

Não substitui build/testes/navegador; responde a uma pergunta que nenhum deles
faz. Um nome que sumiu E não é mais referenciado é resultado legítimo de
extração — por isso só o par (sumiu, ainda usado) vira erro.
"""
from __future__ import annotations

import re
import subprocess
import sys

ALVO = "app/js/game.js"

# Declarações de TOPO (coluna 0). Aninhadas não interessam: extração move blocos inteiros.
DECL = re.compile(r"^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)", re.M)


def declaracoes(fonte: str) -> set[str]:
    return {m.group(1) or m.group(2) for m in DECL.finditer(fonte)}


def referencias(fonte: str) -> set[str]:
    """Identificadores citados fora de comentário de linha. Grosseiro de propósito:
    falso positivo aqui custa uma conferida; falso negativo custa um bug publicado."""
    limpo = "\n".join(l.split("//")[0] for l in fonte.splitlines())
    limpo = re.sub(r"/\*.*?\*/", " ", limpo, flags=re.S)
    return set(re.findall(r"[A-Za-z_$][\w$]*", limpo))


def main() -> int:
    ref = sys.argv[1] if len(sys.argv) > 1 else "HEAD"
    antes = subprocess.run(["git", "show", f"{ref}:{ALVO}"], capture_output=True, text=True, encoding="utf-8")
    if antes.returncode:
        sys.exit(f"não consegui ler {ref}:{ALVO} — {antes.stderr.strip()}")
    try:
        depois = open(ALVO, encoding="utf-8").read()
    except OSError as e:
        sys.exit(f"não consegui ler {ALVO} — {e}")

    sumiram = declaracoes(antes.stdout) - declaracoes(depois)
    ainda_usados = sorted(n for n in sumiram if n in referencias(depois))

    print(f"{len(sumiram)} declaracoes sairam de {ALVO} desde {ref}")
    if not ainda_usados:
        print("nenhuma delas continua referenciada — o corte foi limpo")
        return 0

    print(f"\n{len(ainda_usados)} SUMIRAM MAS AINDA SAO USADAS:")
    linhas = depois.splitlines()
    for nome in ainda_usados:
        print(f"  {nome}")
        for i, l in enumerate(linhas, 1):
            if re.search(r"\b" + re.escape(nome) + r"\b", l.split("//")[0]):
                print(f"      L{i}: {l.strip()[:96]}")
                break
    print("\nSe o nome virou import, tudo bem — confira o bloco de imports.")
    print("Se nao virou, o corte levou junto o que nao era dele.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
