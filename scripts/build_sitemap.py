#!/usr/bin/env python3
"""
Regenera sitemap.xml: home + /precios/ + una entrada por cada página de
examen en data/examenes-contenido.json.

Uso (después de build_examenes.py y build_paginas_examenes.py):
  python3 scripts/build_sitemap.py
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXAMENES_JSON = ROOT / "data" / "examenes.json"
CONTENIDO_JSON = ROOT / "data" / "examenes-contenido.json"
SITEMAP = ROOT / "sitemap.xml"
SITE_URL = "https://labservicecr.com"
SLUG_MAXLEN = 60


def normalizar(texto):
    sin_acentos = unicodedata.normalize("NFKD", texto)
    sin_acentos = "".join(c for c in sin_acentos if not unicodedata.combining(c))
    return " ".join(sin_acentos.lower().split())


def slug(texto):
    """Mismo criterio que build_examenes.py / build_paginas_examenes.py."""
    texto = texto.replace("<", " menos de ").replace(">", " mas de ")
    base = normalizar(texto).replace(" ", "-")
    base = re.sub(r"[^a-z0-9\-]", "-", base)
    base = re.sub(r"-+", "-", base).strip("-")
    if len(base) > SLUG_MAXLEN:
        cortado = base[:SLUG_MAXLEN]
        if "-" in cortado:
            cortado = cortado.rsplit("-", 1)[0]
        base = cortado or base[:SLUG_MAXLEN]
    return base or "examen"


def main():
    if not CONTENIDO_JSON.exists():
        sys.exit(f"No se encontró {CONTENIDO_JSON}.")
    if not EXAMENES_JSON.exists():
        sys.exit(f"No se encontró {EXAMENES_JSON}.")

    contenido = json.loads(CONTENIDO_JSON.read_text(encoding="utf-8"))
    examenes = json.loads(EXAMENES_JSON.read_text(encoding="utf-8"))
    examenes_por_codigo = {e["codigo"]: e for e in examenes}
    codigos = [item["codigo"] for item in contenido["examenes"]]

    urls = [
        (f"{SITE_URL}/", "monthly", "1.0"),
        (f"{SITE_URL}/precios/", "weekly", "0.9"),
        (f"{SITE_URL}/examenes/", "weekly", "0.8"),
    ]
    for codigo in codigos:
        ex = examenes_por_codigo.get(codigo)
        if not ex:
            continue
        urls.append((f"{SITE_URL}/examenes/{slug(ex['descripcion'])}/", "monthly", "0.7"))

    lineas = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, freq, prio in urls:
        lineas.append("  <url>")
        lineas.append(f"    <loc>{loc}</loc>")
        lineas.append(f"    <changefreq>{freq}</changefreq>")
        lineas.append(f"    <priority>{prio}</priority>")
        lineas.append("  </url>")
    lineas.append("</urlset>")
    lineas.append("")

    SITEMAP.write_text("\n".join(lineas), encoding="utf-8")
    print(f"OK: sitemap.xml con {len(urls)} URLs ({len(codigos)} páginas de examen).")


if __name__ == "__main__":
    main()
