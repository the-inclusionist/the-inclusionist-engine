#!/usr/bin/env python3
"""Checks what an extraction cut took along with it.

    python scripts/check-extraction.py [ref]        # default ref: HEAD

Compares the top-level declarations of `app/js/main.js` between `ref` and the
working copy, and flags every declaration that DISAPPEARED but is still
referenced — which is how an accidental removal gets through build and tests.

⚠️ Its target no longer exists: `main.js` became `main.ts` and then left with the
cartridge (issue #111), so as written the script only reports that it cannot
read it. It stays as the method, for the next file carved up by extraction.

Why it exists: removing a block by start and end markers, it is easy for the
range to take in neighbours that were not the module's. It happened three times
in that migration: the closing brace of `stepTileFx`, the pair
`simNaoGlyphs`/`renderPauseLegend`, and `padKind`/`updateTitleLegend` with the two
gamepad listeners. All three times `npm run build` or the browser caught it — but
only later, and one of them got as far as being published. A hand-written list of
names does not do: it only finds what is already suspected lost.

It does not replace build/tests/browser; it answers a question none of them asks.
A name that disappeared AND is no longer referenced is a legitimate result of an
extraction — which is why only the pair (disappeared, still used) is an error.
"""
from __future__ import annotations

import re
import subprocess
import sys

ALVO = "app/js/main.js"

# TOP-LEVEL declarations (column 0). Nested ones do not matter: an extraction moves whole blocks.
FUNC = re.compile(r"^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)", re.M)
VAR = re.compile(r"^(?:export\s+)?(?:const|let|var)\s+(.*)$", re.M)
# `let a=1, b=[], c=null;` declares THREE names. Taking only the first is an expensive blind spot: that is how
# vpHudDom/vpQuitDom/vpScreens stayed off the radar in the HUD extraction. It sweeps the statement's declarators,
# stopping at each one's `=` and ignoring whatever is inside parentheses/brackets.
NOME = re.compile(r"[A-Za-z_$][\w$]*")


def _padrao(resto: str) -> list[str]:
    """Names of a destructuring pattern: `{a, b: c, ...d}` / `[a, , b]`.
    Without this, `const { frontOverlay } = overlays;` drops off the radar and the name looks removed —
    which made the checker cry wolf on every wave of that migration."""
    nomes, i, n = [], 0, len(resto)
    while i < n:
        ch = resto[i]
        if ch in ":":            # `{ a: b }` — what is declared is `b`, so drop what came before
            nomes.pop() if nomes else None
            i += 1; continue
        if ch in "=":            # a default value: skip to the next comma at the same level
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
    if corte[:1] in ("{", "["):   # a destructuring declaration
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
    """Identifiers cited outside a line comment. Coarse on purpose:
    a false positive here costs one check; a false negative costs a published bug."""
    limpo = "\n".join(l.split("//")[0] for l in fonte.splitlines())
    limpo = re.sub(r"/\*.*?\*/", " ", limpo, flags=re.S)
    return set(re.findall(r"[A-Za-z_$][\w$]*", limpo))


def main() -> int:
    ref = sys.argv[1] if len(sys.argv) > 1 else "HEAD"
    antes = subprocess.run(["git", "show", f"{ref}:{ALVO}"], capture_output=True, text=True, encoding="utf-8")
    if antes.returncode:
        sys.exit(f"could not read {ref}:{ALVO} — {antes.stderr.strip()}")
    try:
        depois = open(ALVO, encoding="utf-8").read()
    except OSError as e:
        sys.exit(f"could not read {ALVO} — {e}")

    sumiram = declaracoes(antes.stdout) - declaracoes(depois)
    ainda_usados = sorted(n for n in sumiram if n in referencias(depois))

    print(f"{len(sumiram)} declarations left {ALVO} since {ref}")
    if not ainda_usados:
        print("none of them is still referenced — the cut was clean")
        return 0

    print(f"\n{len(ainda_usados)} DISAPPEARED BUT ARE STILL USED:")
    linhas = depois.splitlines()
    for nome in ainda_usados:
        print(f"  {nome}")
        for i, l in enumerate(linhas, 1):
            if re.search(r"\b" + re.escape(nome) + r"\b", l.split("//")[0]):
                print(f"      L{i}: {l.strip()[:96]}")
                break
    print("\nIf the name became an import, fine — check the imports block.")
    print("If it did not, the cut took along what was not its own.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
