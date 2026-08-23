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
FUNC = re.compile(r"^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)", re.M)
VAR = re.compile(r"^(?:export\s+)?(?:const|let|var)\s+(.*)$", re.M)
# `let a=1, b=[], c=null;` declara TRÊS nomes. Pegar só o primeiro é um ponto cego caro: foi assim que
# vpHudDom/vpQuitDom/vpScreens ficaram fora do radar na extração do HUD. Varre os declaradores do
# statement, parando no `=` de cada um e ignorando o que estiver dentro de parênteses/colchetes.
NOME = re.compile(r"[A-Za-z_$][\w$]*")


def _padrao(resto: str) -> list[str]:
    """Nomes de um padrão de desestruturação: `{a, b: c, ...d}` / `[a, , b]`.
    Sem isto, `const { frontOverlay } = overlays;` some do radar e o nome parece removido —
    o que fez o conferidor gritar em falso a cada onda desta migração."""
    nomes, i, n = [], 0, len(resto)
    while i < n:
        ch = resto[i]
        if ch in ":":            # `{ a: b }` — quem é declarado é `b`, então descarta o que veio antes
            nomes.pop() if nomes else None
            i += 1; continue
        if ch in "=":            # valor padrão: pula até a próxima vírgula do mesmo nível
            prof = 0
            while i < n and not (resto[i] == "," and prof == 0):
                if resto[i] in "([{": prof += 1
                elif resto[i] in ")]}": prof -= 1
                i += 1
            continue
        m = NOME.match(resto, i)
        if m:
            nomes.append(m.group(0)); i = m.end(); continue
        i += 1
    return nomes


def _declaradores(resto: str) -> list[str]:
    corte = resto.lstrip()
    if corte[:1] in ("{", "["):   # declaração por desestruturação
        fim, prof = 0, 0
        for j, ch in enumerate(corte):
            if ch in "([{": prof += 1
            elif ch in ")]}":
                prof -= 1
                if prof == 0: fim = j; break
        return _padrao(corte[1:fim])
    nomes, profundidade, atual, esperando_nome = [], 0, "", True
    for ch in resto:
        if ch in "([{":
            profundidade += 1
        elif ch in ")]}":
            profundidade -= 1
        elif profundidade == 0:
            if ch == ",":
                esperando_nome = True
                continue
            if ch == "=":
                esperando_nome = False
                continue
            if ch == ";":
                break
        if esperando_nome and profundidade == 0:
            atual += ch
            continue
        if atual:
            m = NOME.match(atual.strip())
            if m:
                nomes.append(m.group(0))
            atual = ""
    if atual:
        m = NOME.match(atual.strip())
        if m:
            nomes.append(m.group(0))
    return nomes


def declaracoes(fonte: str) -> set[str]:
    nomes = {m.group(1) for m in FUNC.finditer(fonte)}
    for m in VAR.finditer(fonte):
        nomes.update(_declaradores(m.group(1)))
    return nomes


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
