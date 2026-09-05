#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Varre TODO o histórico atrás de segredo e dado pessoal, antes de o repositório ficar público.

    python tools/auditar-historico.py            # todos os refs locais
    python tools/auditar-historico.py --ref main # só um ref

O ADR-0066 §3 lista isto como condição para qualquer repositório virar público, e diz por que:
em 2026-09-04 conferiram-se NOMES DE ARQUIVO e caminhos absolutos, e o CONTEÚDO não.

⚠️ O QUE ESTA VARREDURA É E O QUE ELA NÃO É. Ela lê o PATCH de cada commit — o que entrou e o
que saiu — e casa expressões conhecidas. Isso pega o que tem forma reconhecível: chave de API,
chave privada, CPF, CNPJ, telefone, caminho absoluto. **Não pega segredo sem forma** (uma senha
que pareça uma palavra qualquer), nem dado pessoal em prosa ("o aluno João, da 3ª série"). Um
resultado limpo aqui NÃO é prova de que não há nada; é prova de que não há nada COM ESTAS FORMAS.
Dizer isso faz parte do resultado.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from collections import defaultdict

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

# Cada regra: (nome, regex, gravidade). ALTA = trata-se como vazamento até prova em contrário.
REGRAS: list[tuple[str, re.Pattern[str], str]] = [
    ("chave privada",        re.compile(r"BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY"), "ALTA"),
    ("token GitHub",         re.compile(r"\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b"), "ALTA"),
    ("token GitHub (novo)",  re.compile(r"\bgithub_pat_[A-Za-z0-9_]{22,}\b"), "ALTA"),
    ("token GitLab",         re.compile(r"\bglpat-[A-Za-z0-9_-]{20,}\b"), "ALTA"),
    ("chave AWS",            re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "ALTA"),
    ("chave Google",         re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"), "ALTA"),
    ("chave OpenAI/afins",   re.compile(r"\bsk-[A-Za-z0-9]{32,}\b"), "ALTA"),
    ("token Slack",          re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b"), "ALTA"),
    ("token Cloudflare",     re.compile(r"CLOUDFLARE_API_TOKEN\s*[:=]\s*[\"']?[A-Za-z0-9_-]{20,}"), "ALTA"),
    ("segredo atribuído",    re.compile(r"(?i)\b(?:password|senha|secret|api[_-]?key|access[_-]?token)"
                                        r"\s*[:=]\s*[\"'][^\"'\s]{8,}[\"']"), "ALTA"),
    ("CPF",                  re.compile(r"\b\d{3}\.\d{3}\.\d{3}-\d{2}\b"), "ALTA"),
    ("CNPJ",                 re.compile(r"\b\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}\b"), "MEDIA"),
    ("telefone BR",          re.compile(r"\(\d{2}\)\s?9?\d{4}[- ]?\d{4}\b"), "MEDIA"),
    ("caminho absoluto",     re.compile(r"[A-Za-z]:\\\\?(?:Users|Dropbox|Documents)\\\\?"), "BAIXA"),
    ("e-mail",               re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), "BAIXA"),
]

# E-mails que são do próprio projeto e não são achado. Tudo o mais é reportado.
EMAILS_CONHECIDOS = re.compile(
    r"(?:noreply@anthropic\.com|jrocha\.developer@gmail\.com|@users\.noreply\.(?:github|gitlab)\.com"
    r"|jrocha-dev|example\.com|localhost)")

# Linhas que quase sempre são ruído em lockfile e dicionário de fonemas.
RUIDO = re.compile(r"^[-+]\s*(?:\"integrity\"|\"resolved\"|sha512-|sha1-)")


def varrer(ref: str | None) -> dict[str, list[tuple[str, str, str]]]:
    cmd = ["git", "log", "-p", "--no-color", "--no-merges",
           "--format=%x00COMMIT%x00%H%x00%ad%x00%s", "--date=short"]
    cmd.append(ref if ref else "--all")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    achados: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    sha = data = assunto = "?"
    arquivo = "?"
    total_linhas = 0
    assert proc.stdout is not None
    for bruto in proc.stdout:
        linha = bruto.decode("utf-8", errors="replace").rstrip("\n")
        total_linhas += 1
        if linha.startswith("\x00COMMIT\x00"):
            partes = linha.split("\x00")
            if len(partes) >= 5:
                sha, data, assunto = partes[2][:9], partes[3], partes[4][:60]
            continue
        if linha.startswith("+++ b/"):
            arquivo = linha[6:]
            continue
        if not linha.startswith(("+", "-")) or RUIDO.match(linha):
            continue
        for nome, regex, gravidade in REGRAS:
            m = regex.search(linha)
            if not m:
                continue
            trecho = m.group(0)
            if nome == "e-mail" and EMAILS_CONHECIDOS.search(trecho):
                continue
            achados[nome].append((sha, arquivo, trecho[:80]))
    proc.wait()
    print("linhas de patch lidas: %d" % total_linhas, file=sys.stderr)
    return achados


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", default=None, help="um ref só (padrão: --all)")
    ap.add_argument("--por-regra", type=int, default=8, help="quantos exemplos mostrar por regra")
    args = ap.parse_args()

    achados = varrer(args.ref)
    ordem = {"ALTA": 0, "MEDIA": 1, "BAIXA": 2}
    gravidade_de = {nome: g for nome, _, g in REGRAS}

    print("\n" + "=" * 78)
    print("AUDITORIA DE HISTÓRICO —", args.ref or "todos os refs locais")
    print("=" * 78)
    if not achados:
        print("\nNenhuma ocorrência das formas procuradas.")
    for nome in sorted(achados, key=lambda n: (ordem[gravidade_de[n]], -len(achados[n]))):
        ocorrencias = achados[nome]
        commits = {c for c, _, _ in ocorrencias}
        print("\n[%s] %s — %d ocorrências em %d commits"
              % (gravidade_de[nome], nome, len(ocorrencias), len(commits)))
        vistos: set[str] = set()
        mostrados = 0
        for sha, arquivo, trecho in ocorrencias:
            chave = arquivo + "|" + trecho
            if chave in vistos:
                continue
            vistos.add(chave)
            print("    %s  %-46s %s" % (sha, arquivo[-46:], trecho))
            mostrados += 1
            if mostrados >= args.por_regra:
                restante = len(vistos) - mostrados
                if restante > 0:
                    print("    … e mais %d distintas" % restante)
                break

    print("\n" + "-" * 78)
    print("⚠️  LIMITE DESTA VARREDURA: ela casa FORMAS conhecidas. Não pega segredo sem forma")
    print("    (uma senha que pareça palavra comum) nem dado pessoal em prosa. Limpo aqui")
    print("    significa `nada com estas formas`, e não `nada`.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
