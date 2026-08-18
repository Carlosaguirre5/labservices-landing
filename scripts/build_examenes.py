#!/usr/bin/env python3
"""
Convierte el listado de precios (CSV exportado de Excel/Sheets) en el JSON
estático que consume el cotizador de /precios.

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
import json
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE_CSV = ROOT / "data" / "examenes-fuente.csv"
OUTPUT_JSON = ROOT / "data" / "examenes.json"

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

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(examenes, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"OK: {len(examenes)} exámenes escritos en {OUTPUT_JSON.relative_to(ROOT)}")
    if advertencias:
        print(f"\n{len(advertencias)} advertencia(s):")
        for a in advertencias:
            print(f"  - {a}")


if __name__ == "__main__":
    main()
