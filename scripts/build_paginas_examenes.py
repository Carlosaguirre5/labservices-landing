#!/usr/bin/env python3
"""
Genera una página estática por examen (/examenes/<slug>/index.html) para el
piloto de exámenes más buscados, a partir de:
  - data/examenes.json (precio, nombre, slug) — generado por build_examenes.py
  - data/examenes-contenido.json (descripción, categoría/ícono, relacionados)
  - scripts/plantilla-examen.html (plantilla con marcadores {{...}})

Uso:
  python3 scripts/build_examenes.py          # primero, regenera data/examenes.json
  python3 scripts/build_paginas_examenes.py  # luego, genera las páginas

Para agregar un examen nuevo al piloto: sumá una entrada en
data/examenes-contenido.json con su código (debe existir en
data/examenes-fuente.csv con publicar=SI) y volvé a correr este script.
Para actualizar el sitemap con las páginas nuevas, corré también
scripts/build_sitemap.py.
"""

import html
import json
import re
import sys
import unicodedata
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXAMENES_JSON = ROOT / "data" / "examenes.json"
CONTENIDO_JSON = ROOT / "data" / "examenes-contenido.json"
PLANTILLA = ROOT / "scripts" / "plantilla-examen.html"
SALIDA_DIR = ROOT / "examenes"
SITE_URL = "https://labservicecr.com"

ICONOS = {
    "sangre": '''        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2s6 7.2 6 12a6 6 0 0 1-12 0c0-4.8 6-12 6-12z"/></svg>''',
    "orina": '''        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6"/><path d="M10 2v6.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 8.5V2"/><path d="M7 15h10"/></svg>''',
    "heces": '''        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6l1 4H8l1-4z"/><path d="M8 7h8l1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L8 7z"/></svg>''',
    "hisopado": '''        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="20" x2="14" y2="10"/><circle cx="17" cy="7" r="3"/></svg>''',
    "otro": '''        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/></svg>'''
}


def normalizar(texto):
    sin_acentos = unicodedata.normalize("NFKD", texto)
    sin_acentos = "".join(c for c in sin_acentos if not unicodedata.combining(c))
    return " ".join(sin_acentos.lower().split())


def slug(codigo):
    base = normalizar(codigo).replace(" ", "-")
    base = re.sub(r"[^a-z0-9\-]", "-", base)
    base = re.sub(r"-+", "-", base).strip("-")
    return base or "examen"


def formatear_colones(n):
    con_puntos = re.sub(r"(?<=\d)(?=(\d{3})+(?!\d))", ".", str(n))
    return "₡" + con_puntos


def construir_json_ld(ex, contenido, url):
    data = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": ex["descripcion"],
        "description": contenido["descripcion"],
        "url": url,
        "offers": {
            "@type": "Offer",
            "price": ex["precio"],
            "priceCurrency": "CRC",
            "availability": "https://schema.org/InStock",
            "url": url
        }
    }
    texto = json.dumps(data, ensure_ascii=False, indent=2)
    return texto.replace("</", "<\\/")


def construir_relacionados_html(relacionados_codigos, examenes_por_codigo):
    tarjetas = []
    for cod in relacionados_codigos:
        ex = examenes_por_codigo.get(cod)
        if not ex:
            continue
        tarjetas.append(
            '        <a class="examen-relacionado-card" href="/examenes/{slug}/">'
            '<span class="examen-relacionado-nombre">{nombre}</span>'
            '<span class="examen-relacionado-precio">{precio}</span></a>'.format(
                slug=slug(ex["codigo"]),
                nombre=html.escape(ex["descripcion"]),
                precio=formatear_colones(ex["precio"])
            )
        )
    if not tarjetas:
        return ""
    return (
        '      <div class="examen-relacionados">\n'
        '        <h2>Exámenes relacionados</h2>\n'
        '        <div class="examen-relacionados-grid">\n'
        + "\n".join(tarjetas) + "\n"
        '        </div>\n'
        '      </div>\n'
    )


def main():
    if not EXAMENES_JSON.exists():
        sys.exit(f"No se encontró {EXAMENES_JSON}. Corré primero build_examenes.py.")
    if not CONTENIDO_JSON.exists():
        sys.exit(f"No se encontró {CONTENIDO_JSON}.")
    if not PLANTILLA.exists():
        sys.exit(f"No se encontró {PLANTILLA}.")

    examenes = json.loads(EXAMENES_JSON.read_text(encoding="utf-8"))
    examenes_por_codigo = {e["codigo"]: e for e in examenes}
    contenido_data = json.loads(CONTENIDO_JSON.read_text(encoding="utf-8"))
    plantilla = PLANTILLA.read_text(encoding="utf-8")

    generadas = []
    advertencias = []

    for contenido in contenido_data["examenes"]:
        codigo = contenido["codigo"]
        ex = examenes_por_codigo.get(codigo)
        if not ex:
            advertencias.append(
                f"Código '{codigo}' en examenes-contenido.json no existe (o no está publicado) "
                "en data/examenes.json — se omite esa página"
            )
            continue

        icono = ICONOS.get(contenido["categoria"])
        if icono is None:
            advertencias.append(f"Categoría desconocida '{contenido['categoria']}' para '{codigo}' — se usa ícono genérico")
            icono = ICONOS["otro"]

        s = slug(codigo)
        url = f"{SITE_URL}/examenes/{s}/"
        nombre = ex["descripcion"]
        precio_fmt = formatear_colones(ex["precio"])

        pagina = plantilla
        pagina = pagina.replace("{{TITULO}}", html.escape(f"{nombre} — Precio y detalle | LabServices Naranjo"))
        pagina = pagina.replace(
            "{{META_DESCRIPCION}}",
            html.escape(f"{nombre}: {precio_fmt}. {contenido['resumen']} Laboratorio clínico en Naranjo, Alajuela. Cotizá por WhatsApp.")
        )
        pagina = pagina.replace("{{CANONICAL_URL}}", url)
        pagina = pagina.replace("{{NOMBRE}}", html.escape(nombre))
        pagina = pagina.replace("{{RESUMEN}}", html.escape(contenido["resumen"]))
        pagina = pagina.replace("{{PRECIO}}", precio_fmt)
        pagina = pagina.replace("{{DESCRIPCION_LARGA}}", html.escape(contenido["descripcion"]))
        pagina = pagina.replace("{{ICONO_SVG}}", icono)
        pagina = pagina.replace(
            "{{WA_MSG}}",
            html.escape(f"🔬 Hola, quisiera cotizar el examen {nombre} ({precio_fmt})")
        )
        pagina = pagina.replace("{{CODIGO_URL}}", urllib.parse.quote(codigo))
        pagina = pagina.replace("{{RELACIONADOS_HTML}}", construir_relacionados_html(contenido["relacionados"], examenes_por_codigo))
        pagina = pagina.replace("{{JSONLD}}", construir_json_ld(ex, contenido, url))

        destino = SALIDA_DIR / s
        destino.mkdir(parents=True, exist_ok=True)
        (destino / "index.html").write_text(pagina, encoding="utf-8")
        generadas.append((s, nombre, url))

    print(f"OK: {len(generadas)} páginas generadas en {SALIDA_DIR.relative_to(ROOT)}/")
    if advertencias:
        print(f"\n{len(advertencias)} advertencia(s):")
        for a in advertencias:
            print(f"  - {a}")

    return generadas


if __name__ == "__main__":
    main()
