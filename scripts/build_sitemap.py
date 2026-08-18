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
CONTENIDO_JSON = ROOT / "data" / "examenes-contenido.json"
SITEMAP = ROOT / "sitemap.xml"
SITE_URL = "https://labservicecr.com"


def normalizar(texto):
    sin_acentos = unicodedata.normalize("NFKD", texto)
    sin_acentos = "".join(c for c in sin_acentos if not unicodedata.combining(c))
    return " ".join(sin_acentos.lower().split())


def slug(codigo):
    base = normalizar(codigo).replace(" ", "-")
    base = re.sub(r"[^a-z0-9\-]", "-", base)
    base = re.sub(r"-+", "-", base).strip("-")
    return base or "examen"


def main():
    if not CONTENIDO_JSON.exists():
        sys.exit(f"No se encontró {CONTENIDO_JSON}.")

    contenido = json.loads(CONTENIDO_JSON.read_text(encoding="utf-8"))
    codigos = [item["codigo"] for item in contenido["examenes"]]

    urls = [
        (f"{SITE_URL}/", "monthly", "1.0"),
        (f"{SITE_URL}/precios/", "weekly", "0.9"),
    ]
    for codigo in codigos:
        urls.append((f"{SITE_URL}/examenes/{slug(codigo)}/", "monthly", "0.7"))

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
