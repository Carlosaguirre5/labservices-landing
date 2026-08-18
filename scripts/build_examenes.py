#!/usr/bin/env python3
"""
Convierte el listado de precios (CSV exportado de Excel/Sheets) en:
  1. El JSON estático que consume el buscador interactivo de /precios.
  2. Una tabla HTML estática + datos estructurados (JSON-LD) inyectados
     directamente en precios/index.html, para que Google pueda indexar
     cada examen y su precio sin depender de JavaScript.

Uso:
  python3 scripts/build_examenes.py

Columnas esperadas en el CSV (data/examenes-fuente.csv):
  Código, Descripción, Precio ₡, Precio $ (ref), % IVA, publicar, nota

Solo se incluyen filas con publicar = SI. Las demás columnas (Precio $, %
IVA, nota) se ignoran.

Para actualizar precios: reemplazá data/examenes-fuente.csv con el archivo
nuevo (mismas columnas) y volvé a correr este script.
"""

import csv
import html
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE_CSV = ROOT / "data" / "examenes-fuente.csv"
OUTPUT_JSON = ROOT / "data" / "examenes.json"
PRECIOS_HTML = ROOT / "precios" / "index.html"
SITE_URL = "https://labservicecr.com/precios/"

# Precios por debajo de este umbral casi seguro son un error de captura
# (el examen más barato real del catálogo ronda los ₡5.000). Se excluyen
# con una advertencia en vez de fallar, para que el script siga corriendo
# sin intervención manual.
PRECIO_MINIMO_VALIDO = 1000


def normalizar(texto):
    """minúsculas, sin acentos, espacios colapsados — para buscar."""
    sin_acentos = unicodedata.normalize("NFKD", texto)
    sin_acentos = "".join(c for c in sin_acentos if not unicodedata.combining(c))
    return " ".join(sin_acentos.lower().split())


def limpiar_espacios(texto):
    """Colapsa espacios extra sin tocar mayúsculas/minúsculas originales."""
    return " ".join(texto.split())


def slug(codigo):
    """Código de examen -> id HTML válido (ej. 'CA19-9' -> 'ca19-9')."""
    base = normalizar(codigo).replace(" ", "-")
    base = re.sub(r"[^a-z0-9\-]", "-", base)
    base = re.sub(r"-+", "-", base).strip("-")
    return base or "examen"


def formatear_colones(n):
    """Mismo formato que formatColones() en JS: punto como separador de miles."""
    con_puntos = re.sub(r"(?<=\d)(?=(\d{3})+(?!\d))", ".", str(n))
    return "₡" + con_puntos


def codigos_con_pagina_propia():
    """Códigos con ficha en /examenes/ (data/examenes-contenido.json), si existe."""
    ruta = ROOT / "data" / "examenes-contenido.json"
    if not ruta.exists():
        return set()
    contenido = json.loads(ruta.read_text(encoding="utf-8"))
    return {item["codigo"] for item in contenido.get("examenes", [])}


def construir_filas_html(examenes):
    con_pagina = codigos_con_pagina_propia()
    filas = []
    for ex in examenes:
        fila_id = "examen-" + slug(ex["codigo"])
        nombre = html.escape(ex["descripcion"])
        precio = formatear_colones(ex["precio"])
        if ex["codigo"] in con_pagina:
            nombre += f' <a href="/examenes/{slug(ex["codigo"])}/" class="lista-completa-ficha">Ver ficha →</a>'
        filas.append(f'            <tr id="{fila_id}"><td>{nombre}</td><td>{precio}</td></tr>')
    return "\n".join(filas)


def construir_json_ld(examenes):
    data = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Lista de precios de exámenes de laboratorio — LabServices Naranjo",
        "itemListElement": [
            {
                "@type": "Product",
                "position": i + 1,
                "name": ex["descripcion"],
                "url": SITE_URL + "#examen-" + slug(ex["codigo"]),
                "offers": {
                    "@type": "Offer",
                    "price": ex["precio"],
                    "priceCurrency": "CRC",
                    "availability": "https://schema.org/InStock"
                }
            }
            for i, ex in enumerate(examenes)
        ]
    }
    texto = json.dumps(data, ensure_ascii=False, indent=2)
    # Mitigación estándar: un </script> literal dentro del JSON cerraría el tag.
    texto = texto.replace("</", "<\\/")
    return '    <script type="application/ld+json">\n' + texto + "\n    </script>"


def reemplazar_entre_marcadores(texto_html, nombre_marcador, contenido_nuevo):
    inicio = f"<!-- {nombre_marcador}:START -->"
    fin = f"<!-- {nombre_marcador}:END -->"
    patron = re.compile(re.escape(inicio) + r".*?" + re.escape(fin), re.DOTALL)
    reemplazo = inicio + "\n" + contenido_nuevo + "\n" + fin
    nuevo_texto, cantidad = patron.subn(lambda m: reemplazo, texto_html)
    if cantidad != 1:
        sys.exit(
            f"Se esperaba encontrar el marcador {nombre_marcador} una vez en "
            f"{PRECIOS_HTML.relative_to(ROOT)}, se encontró {cantidad} vez/veces."
        )
    return nuevo_texto


def actualizar_precios_html(examenes):
    if not PRECIOS_HTML.exists():
        sys.exit(f"No se encontró {PRECIOS_HTML}.")

    texto_html = PRECIOS_HTML.read_text(encoding="utf-8")
    texto_html = reemplazar_entre_marcadores(texto_html, "EXAMENES-COUNT", f" ({len(examenes)})")
    texto_html = reemplazar_entre_marcadores(texto_html, "EXAMENES-FILAS", construir_filas_html(examenes))
    texto_html = reemplazar_entre_marcadores(texto_html, "EXAMENES-JSONLD", construir_json_ld(examenes))
    PRECIOS_HTML.write_text(texto_html, encoding="utf-8")


def main():
    if not SOURCE_CSV.exists():
        sys.exit(f"No se encontró {SOURCE_CSV}. Copiá ahí el CSV con el listado.")

    examenes = []
    codigos_vistos = set()
    advertencias = []

    with SOURCE_CSV.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        columnas_requeridas = {"Código", "Descripción", "Precio ₡", "publicar"}
        faltantes = columnas_requeridas - set(reader.fieldnames or [])
        if faltantes:
            sys.exit(f"Faltan columnas en el CSV: {', '.join(sorted(faltantes))}")

        for fila_num, fila in enumerate(reader, start=2):  # 1 = encabezado
            if (fila.get("publicar") or "").strip().upper() != "SI":
                continue

            codigo = (fila.get("Código") or "").strip()
            descripcion_raw = (fila.get("Descripción") or "").strip()
            precio_raw = (fila.get("Precio ₡") or "").strip()

            if not codigo or not descripcion_raw or not precio_raw:
                advertencias.append(f"Fila {fila_num}: código/descripción/precio vacío — se omite")
                continue

            try:
                precio = round(float(precio_raw))
            except ValueError:
                advertencias.append(f"Fila {fila_num} ({codigo}): precio inválido '{precio_raw}' — se omite")
                continue

            if precio < PRECIO_MINIMO_VALIDO:
                advertencias.append(
                    f"Fila {fila_num} ({codigo}): precio sospechoso ₡{precio} — se omite, revisar el dato fuente"
                )
                continue

            if codigo in codigos_vistos:
                advertencias.append(f"Fila {fila_num}: código duplicado '{codigo}' — se omite")
                continue
            codigos_vistos.add(codigo)

            descripcion = limpiar_espacios(descripcion_raw)
            examenes.append({
                "codigo": codigo,
                "descripcion": descripcion,
                "descripcionNormalizada": normalizar(descripcion),
                "precio": precio
            })

    examenes.sort(key=lambda e: e["descripcion"])

    slugs_vistos = {}
    for ex in examenes:
        s = slug(ex["codigo"])
        if s in slugs_vistos:
            advertencias.append(
                f"ids HTML duplicados: '{ex['codigo']}' y '{slugs_vistos[s]}' generan el mismo slug '{s}' "
                "— la tabla estática tendrá dos <tr id> iguales, revisar los códigos"
            )
        slugs_vistos[s] = ex["codigo"]

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(examenes, f, ensure_ascii=False, indent=2)
        f.write("\n")

    actualizar_precios_html(examenes)

    print(f"OK: {len(examenes)} exámenes escritos en {OUTPUT_JSON.relative_to(ROOT)}")
    print(f"OK: tabla estática y JSON-LD actualizados en {PRECIOS_HTML.relative_to(ROOT)}")
    if advertencias:
        print(f"\n{len(advertencias)} advertencia(s):")
        for a in advertencias:
            print(f"  - {a}")


if __name__ == "__main__":
    main()
