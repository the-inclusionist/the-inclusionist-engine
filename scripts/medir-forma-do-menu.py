# -*- coding: utf-8 -*-
"""SEGUNDO LEVANTAMENTO (ADR-0092): o que os sinks da camada de MENUS tem em comum.

O registro fixou QUANTAS camadas e QUAIS. A FORMA do padrao de nos tem de sair de
uma medida, e nao de um desenho — o mesmo metodo que corrigiu o numero de camadas
de quatro para seis.

O que se conta: as CLASSES de CSS e os ATRIBUTOS que os construtores de markup da
camada de menus emitem. O que se repete em muitos modulos e a forma; o que aparece
num so e daquele painel.
"""
import io, os, re, sys
from collections import Counter, defaultdict

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

RAIZ = "app/js"

# A camada de MENUS E DIALOGOS, pela medida do ADR-0092.
MENUS = [
    "ui/activities-menu.ts", "ui/pause-icons.ts", "ui/map-hub.ts", "ui/menu-nav.ts",
    "ui/settings-panel.ts", "ui/settings-audio.ts", "ui/settings-caa.ts", "ui/settings-controls.ts",
    "ui/settings-motion.ts", "ui/settings-motor.ts", "ui/settings-typo.ts", "ui/settings-visual.ts",
    "ui/settings-empathy.ts", "ui/shell.ts", "ui/title.ts", "input/touch.ts",
    "render/viz-setters.ts",
]

CLASSE = re.compile(r'class="([^"$`]+)"')
ATRIB = re.compile(r'\b(aria-[a-z]+|data-[a-z-]+|role|tabindex|type|for|id)="')


def linhas_de_codigo(txt):
    dentro = False
    for ln in txt.split("\n"):
        s = ln.strip()
        if dentro:
            if "*/" in s:
                dentro = False
            continue
        if s.startswith("/*"):
            if "*/" not in s:
                dentro = True
            continue
        if s.startswith("//") or s.startswith("*") or not s:
            continue
        yield s


if __name__ == "__main__":
    classes = Counter()
    onde_classe = defaultdict(set)
    atribs = Counter()
    onde_atrib = defaultdict(set)

    for mod in MENUS:
        caminho = os.path.join(RAIZ, *mod.split("/"))
        if not os.path.exists(caminho):
            print("  (ausente) " + mod)
            continue
        for ln in linhas_de_codigo(io.open(caminho, encoding="utf-8").read()):
            for m in CLASSE.finditer(ln):
                for c in m.group(1).split():
                    if "{" in c or "}" in c:
                        continue
                    classes[c] += 1
                    onde_classe[c].add(mod)
            for m in ATRIB.finditer(ln):
                atribs[m.group(1)] += 1
                onde_atrib[m.group(1)].add(mod)

    print("=" * 78)
    print("CLASSES que aparecem em VARIOS modulos de menu — a FORMA")
    print("=" * 78)
    for c, n in classes.most_common():
        mods = onde_classe[c]
        if len(mods) >= 3:
            print("  %-22s %3d usos em %2d modulos" % (c, n, len(mods)))

    print("\n" + "=" * 78)
    print("CLASSES de UM modulo so — sao daquele painel, nao da forma")
    print("=" * 78)
    so_um = [(c, n) for c, n in classes.most_common() if len(onde_classe[c]) == 1]
    print("  %d classes, %d usos" % (len(so_um), sum(n for _, n in so_um)))
    for c, n in so_um[:10]:
        print("     %-22s %3d  (%s)" % (c, n, list(onde_classe[c])[0]))

    print("\n" + "=" * 78)
    print("ATRIBUTOS de semantica — o que a forma tem de saber emitir")
    print("=" * 78)
    for a, n in atribs.most_common():
        print("  %-16s %3d usos em %2d modulos" % (a, n, len(onde_atrib[a])))
