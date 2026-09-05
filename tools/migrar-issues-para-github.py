#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Migra as issues do GitLab para o GitHub PRESERVANDO OS NÚMEROS.

    python tools/migrar-issues-para-github.py            # ensaio: não escreve nada
    python tools/migrar-issues-para-github.py --go       # cria de verdade

POR QUE OS NÚMEROS SOBREVIVEM, e por que isso é frágil
------------------------------------------------------
No GitHub, issues e pull requests dividem UM contador, que começa em 1 num repositório
novo. As issues do GitLab aqui são `iid` 1..N sem buracos. Logo, criadas em ordem
crescente num repositório sem nenhuma issue e sem nenhuma PR, recebem exatamente os
mesmos números — e todo `#N` escrito em ADR, em mensagem de commit e no corpo de outra
issue continua apontando para a coisa certa.

⚠️ A FRAGILIDADE, e é a razão do gate de integridade abaixo: qualquer PR aberta antes do
fim consome um número e desloca tudo dali para a frente, sem aviso e sem volta. Por isso
este script CONFERE, antes de cada criação, que o próximo número do GitHub é exatamente o
`iid` que ele vai criar. Na primeira divergência ele PARA — melhor parar no meio do que
terminar com uma numeração que mente.

O QUE NÃO ATRAVESSA, dito antes para não ser descoberto depois
--------------------------------------------------------------
  · o AUTOR original (tudo passa a ser quem roda o script) — vai escrito no rodapé;
  · a DATA de criação (vira a data da migração) — vai escrita no rodapé;
  · o estado fechado é reaplicado no fim, não na criação;
  · milestones e o quadro não vêm;
  · as labels são recriadas por nome, sem cor nem descrição do original.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time

# O console do Windows abre em cp1252, e um titulo com "↔" derruba o print no meio da
# migracao — no pior momento possivel. Forca UTF-8 na saida antes de qualquer print.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

GITLAB = "jrocha-dev/inclusionist-engine"
GITHUB = "the-inclusionist/the-inclusionist-engine"
PAUSA = 1.5          # segundos entre escritas: o GitHub tem limite secundário para criação de conteúdo
PAGINA = 100


def roda(cmd: list[str]) -> str:
    """Executa e devolve stdout como texto UTF-8. Erro do processo aborta o script."""
    r = subprocess.run(cmd, capture_output=True)
    saida = r.stdout.decode("utf-8", errors="replace")
    if r.returncode != 0:
        erro = r.stderr.decode("utf-8", errors="replace")
        sys.exit("FALHOU: %s\n%s\n%s" % (" ".join(cmd), saida[:800], erro[:800]))
    return saida


def glab_json(caminho: str):
    return json.loads(roda(["glab", "api", caminho]) or "[]")


def gh_json(caminho: str):
    return json.loads(roda(["gh", "api", caminho]) or "[]")


def issues_do_gitlab() -> list[dict]:
    todas: list[dict] = []
    for pagina in range(1, 20):
        lote = glab_json("projects/%s/issues?state=all&per_page=%d&page=%d"
                         % (GITLAB.replace("/", "%2F"), PAGINA, pagina))
        if not lote:
            break
        todas += lote
    return sorted(todas, key=lambda i: i["iid"])


def comentarios(iid: int) -> list[dict]:
    """Só os humanos: `system: true` são as notas automáticas do GitLab e não valem a viagem."""
    notas = glab_json("projects/%s/issues/%d/notes?per_page=%d&sort=asc"
                      % (GITLAB.replace("/", "%2F"), iid, PAGINA))
    return [n for n in notas if not n.get("system")]


def proximo_numero_no_github() -> int:
    """O maior número já usado + 1 — contando PR, que divide o contador com issue."""
    existentes = gh_json("repos/%s/issues?state=all&per_page=1&sort=created&direction=desc" % GITHUB)
    return (existentes[0]["number"] + 1) if existentes else 1


def rodape(issue: dict) -> str:
    autor = (issue.get("author") or {}).get("name") or (issue.get("author") or {}).get("username") or "?"
    labels = ", ".join(issue.get("labels") or []) or "—"
    return (
        "\n\n---\n"
        "<sub>Migrada do GitLab em %s. Original: `%s#%d` · aberta por **%s** em %s · "
        "estado no GitLab: **%s** · labels: %s · %s</sub>"
        % (time.strftime("%Y-%m-%d"), GITLAB, issue["iid"], autor,
           (issue.get("created_at") or "")[:10], issue.get("state", "?"), labels,
           issue.get("web_url", ""))
    )


def preflight(issues: list[dict], ensaio: bool) -> None:
    iids = [i["iid"] for i in issues]
    faltando = [n for n in range(1, max(iids) + 1) if n not in set(iids)]
    print("GitLab: %d issues, iid %d..%d, buracos: %s"
          % (len(issues), min(iids), max(iids), faltando or "nenhum"))
    if faltando:
        sys.exit("ABORTADO: há buracos na numeração do GitLab; os números NÃO vão bater. "
                 "Decida antes se cria issues-tampão para os buracos.")

    repo = gh_json("repos/%s" % GITHUB)
    if not repo.get("has_issues"):
        sys.exit("ABORTADO: as issues estão desativadas em %s." % GITHUB)
    ja = gh_json("repos/%s/issues?state=all&per_page=1" % GITHUB)
    if ja:
        sys.exit("ABORTADO: %s já tem issue ou PR (#%d). Este script só funciona em repositório "
                 "de contador zerado." % (GITHUB, ja[0]["number"]))
    print("GitHub: %s está com o contador zerado. Vai criar #%d..#%d."
          % (GITHUB, min(iids), max(iids)))
    if ensaio:
        print("\n*** ENSAIO — nada será escrito. Rode com --go para valer. ***")


def garante_labels(issues: list[dict], ensaio: bool) -> None:
    nomes = sorted({l for i in issues for l in (i.get("labels") or [])})
    if not nomes:
        return
    existentes = {l["name"] for l in gh_json("repos/%s/labels?per_page=100" % GITHUB)}
    faltam = [n for n in nomes if n not in existentes]
    print("labels: %d no GitLab, %d a criar" % (len(nomes), len(faltam)))
    if ensaio:
        return
    for nome in faltam:
        roda(["gh", "api", "--method", "POST", "repos/%s/labels" % GITHUB,
              "-f", "name=%s" % nome, "-f", "color=ededed"])
        time.sleep(0.4)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--go", action="store_true", help="escreve de verdade (o padrão é ensaio)")
    ap.add_argument("--sem-comentarios", action="store_true", help="não traz os comentários")
    args = ap.parse_args()
    ensaio = not args.go

    issues = issues_do_gitlab()
    preflight(issues, ensaio)
    garante_labels(issues, ensaio)

    fechar: list[int] = []
    for issue in issues:
        iid = issue["iid"]

        # ---- o gate de integridade: o número que o GitHub vai dar TEM de ser o iid ----
        if not ensaio:
            proximo = proximo_numero_no_github()
            if proximo != iid:
                sys.exit("PARADO em iid %d: o próximo número do GitHub seria #%d. A numeração já "
                         "divergiu (alguém abriu uma PR ou uma issue). Nada mais será criado."
                         % (iid, proximo))

        titulo = issue.get("title") or "(sem título)"
        corpo = (issue.get("description") or "") + rodape(issue)
        print("#%-4d %-9s %s" % (iid, issue.get("state"), titulo[:70]))
        if ensaio:
            if issue.get("state") == "closed":
                fechar.append(iid)
            continue

        cmd = ["gh", "api", "--method", "POST", "repos/%s/issues" % GITHUB,
               "-f", "title=%s" % titulo, "-f", "body=%s" % corpo]
        for l in issue.get("labels") or []:
            cmd += ["-f", "labels[]=%s" % l]
        criada = json.loads(roda(cmd))
        assert criada["number"] == iid, "criou #%d para o iid %d" % (criada["number"], iid)
        time.sleep(PAUSA)

        if not args.sem_comentarios:
            for nota in comentarios(iid):
                autor = (nota.get("author") or {}).get("name") or "?"
                texto = ("<sub>**%s** em %s, no GitLab:</sub>\n\n%s"
                         % (autor, (nota.get("created_at") or "")[:10], nota.get("body") or ""))
                roda(["gh", "api", "--method", "POST",
                      "repos/%s/issues/%d/comments" % (GITHUB, iid), "-f", "body=%s" % texto])
                time.sleep(PAUSA)

        if issue.get("state") == "closed":
            fechar.append(iid)

    # ---- fechar só no FIM: fechar durante a criação não muda o contador, mas deixa o log ilegível
    print("\na fechar: %d" % len(fechar))
    if not ensaio:
        for numero in fechar:
            roda(["gh", "api", "--method", "PATCH", "repos/%s/issues/%d" % (GITHUB, numero),
                  "-f", "state=closed"])
            time.sleep(PAUSA)

    print("\nfim. %d issues, %d fechadas." % (len(issues), len(fechar)))
    print("Confira: gh issue list -R %s --state all --limit 5" % GITHUB)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
