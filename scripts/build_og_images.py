#!/usr/bin/env python3
"""
Genera una imagen og:image personalizada por examen (1200x630 px) para que
las miniaturas de WhatsApp/redes al compartir /examenes/<slug>/ muestren el
nombre del examen y su precio, en vez de la imagen genérica del sitio.

Sigue la misma línea visual del hero de la portada (index.html): badge con
el ícono de categoría, encabezado + precio en verde, resumen, botón de
WhatsApp decorativo y la ilustración de la tarjeta de resultado con tubo de
ensayo (copiada del SVG inline de esa sección — si el hero de la portada
cambia de diseño, esta ilustración no se actualiza sola).

Requiere Pillow y cairosvg (para rasterizar los mismos íconos SVG que usan
las fichas de examen). cairosvg necesita la librería nativa cairo:
    brew install cairo
    pip install cairosvg

Uso (después de build_examenes.py, antes de build_paginas_examenes.py):
    python3 scripts/build_og_images.py
"""

import io
import json
import os
import re
import sys
from pathlib import Path

os.environ.setdefault("DYLD_LIBRARY_PATH", "/opt/homebrew/lib")
os.environ.setdefault("DYLD_FALLBACK_LIBRARY_PATH", "/opt/homebrew/lib")

try:
    import cairosvg
except OSError as e:
    sys.exit(
        "No se pudo cargar la librería nativa cairo (requerida por cairosvg).\n"
        "Instalala con: brew install cairo\n"
        f"Detalle: {e}"
    )
except ImportError:
    sys.exit("Falta el paquete cairosvg. Instalalo con: pip install cairosvg")

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
EXAMENES_JSON = ROOT / "data" / "examenes.json"
CONTENIDO_JSON = ROOT / "data" / "examenes-contenido.json"
OUT_DIR = ROOT / "assets" / "og" / "examenes"
FONTS_DIR = Path(__file__).resolve().parent / "og-fonts"

W, H = 1200, 630

C_WHITE = (255, 255, 255)
C_INK = (23, 24, 26)
C_GRAY = (68, 68, 68)
C_GRAY_LIGHT = (233, 233, 232)
C_GREEN_DARK = (111, 143, 55)
C_GREEN_LIGHT = (238, 244, 228)
C_WHATSAPP = (37, 211, 102)

POPPINS_BOLD = str(FONTS_DIR / "Poppins-Bold.ttf")
INTER_VAR = str(FONTS_DIR / "Inter-Variable.ttf")

ICONOS_SVG = {
    "sangre": '<path d="M12 2s6 7.2 6 12a6 6 0 0 1-12 0c0-4.8 6-12 6-12z"/>',
    "orina": '<path d="M9 2h6"/><path d="M10 2v6.5L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 8.5V2"/><path d="M7 15h10"/>',
    "heces": '<path d="M9 3h6l1 4H8l1-4z"/><path d="M8 7h8l1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L8 7z"/>',
    "hisopado": '<line x1="4" y1="20" x2="14" y2="10"/><circle cx="17" cy="7" r="3"/>',
    "otro": '<rect x="4" y="3" width="16" height="18" rx="2"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="12" y2="16"/>',
}

CATEGORIA_LABEL = {
    "sangre": "Muestra de sangre",
    "orina": "Muestra de orina",
    "heces": "Muestra de heces",
    "hisopado": "Muestra por hisopado",
    "otro": "Examen especializado",
}

# Copiado del <div class="hero-visual"> de index.html.
HERO_VISUAL_SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 380" width="380" height="380">
  <defs>
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#0a0a0a" flood-opacity="0.16"/>
    </filter>
  </defs>
  <g filter="url(#cardShadow)">
    <rect x="70" y="70" width="230" height="260" rx="22" fill="#ffffff"/>
  </g>
  <rect x="70" y="70" width="230" height="260" rx="22" fill="none" stroke="#e9e9e8" stroke-width="1.5"/>
  <circle cx="102" cy="102" r="10" fill="#8dae4a"/>
  <rect x="122" y="96" width="90" height="8" rx="4" fill="#17181a"/>
  <rect x="122" y="110" width="60" height="6" rx="3" fill="#929292"/>
  <line x1="88" y1="132" x2="282" y2="132" stroke="#e9e9e8" stroke-width="1.5"/>
  <g>
    <circle cx="102" cy="156" r="12" fill="#eef4e4"/>
    <path d="M97 156l4 4 8-8" stroke="#6f8f37" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="126" y="150" width="130" height="7" rx="3.5" fill="#d9dad7"/>
    <rect x="126" y="161" width="80" height="6" rx="3" fill="#eceeea"/>
  </g>
  <g>
    <circle cx="102" cy="196" r="12" fill="#eef4e4"/>
    <path d="M97 196l4 4 8-8" stroke="#6f8f37" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="126" y="190" width="110" height="7" rx="3.5" fill="#d9dad7"/>
    <rect x="126" y="201" width="70" height="6" rx="3" fill="#eceeea"/>
  </g>
  <g>
    <circle cx="102" cy="236" r="12" fill="#eef4e4"/>
    <path d="M97 236l4 4 8-8" stroke="#6f8f37" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="126" y="230" width="140" height="7" rx="3.5" fill="#d9dad7"/>
    <rect x="126" y="241" width="60" height="6" rx="3" fill="#eceeea"/>
  </g>
  <rect x="88" y="272" width="184" height="34" rx="17" fill="#f4f4f3"/>
  <text x="180" y="294" text-anchor="middle" font-family="Poppins, sans-serif" font-size="13" font-weight="600" fill="#17181a">Resultado listo</text>
  <g transform="translate(268,36) rotate(18)">
    <rect x="0" y="0" width="26" height="70" rx="13" fill="#ffffff" stroke="#929292" stroke-width="2.5"/>
    <path d="M2 34a11 11 0 0 0 22 0v22a11 11 0 0 1-22 0z" fill="#8dae4a"/>
    <line x1="0" y1="14" x2="26" y2="14" stroke="#929292" stroke-width="2.5"/>
  </g>
  <g transform="translate(28,240)">
    <path d="M16 0C16 0 30 20 30 32a14 14 0 1 1-28 0C2 20 16 0 16 0z" fill="#17181a"/>
    <path d="M16 8C16 8 26 22 26 32a10 10 0 1 1-20 0C6 22 16 8 16 8z" fill="#8dae4a" opacity="0.85"/>
  </g>
</svg>'''

WA_ICON_PATH = (
    "M16.04 3C9.37 3 3.98 8.39 3.98 15.06c0 2.23.6 4.35 1.73 6.22L3 29l7.9-2.61a12.02 12.02 0 0 0 "
    "5.14 1.15h.01c6.67 0 12.06-5.39 12.06-12.06C28.11 8.81 22.71 3 16.04 3zm0 21.9h-.01c-1.68 0-3.33-.45-"
    "4.77-1.3l-.34-.2-4.69 1.55 1.57-4.57-.22-.36a9.87 9.87 0 0 1-1.51-5.26C6.07 9.6 10.6 5.08 16.05 5.08c"
    "2.62 0 5.08 1.02 6.94 2.88a9.77 9.77 0 0 1 2.87 6.94c0 5.45-4.53 9.99-9.82 9.99zm5.66-7.44c-.31-.16-"
    "1.83-.9-2.11-1.01-.28-.1-.49-.16-.69.16-.2.31-.79 1.01-.97 1.22-.18.2-.36.23-.67.08-.31-.16-1.3-.48-"
    "2.48-1.53-.92-.82-1.53-1.83-1.71-2.14-.18-.31-.02-.48.14-.63.14-.14.31-.36.47-.55.16-.18.2-.31.31-"
    ".51.1-.2.05-.39-.03-.55-.08-.16-.69-1.67-.95-2.28-.25-.6-.5-.52-.69-.53-.18-.01-.39-.01-.59-.01-.2 "
    "0-.55.08-.83.39-.28.31-1.09 1.07-1.09 2.6 0 1.54 1.12 3.02 1.27 3.23.16.2 2.2 3.36 5.33 4.71.75.32 "
    "1.33.51 1.79.66.75.24 1.43.2 1.97.12.6-.09 1.83-.75 2.09-1.47.26-.72.26-1.34.18-1.47-.08-.13-.28-.2-"
    ".59-.35z"
)


def normalizar(texto):
    import unicodedata
    sin_acentos = unicodedata.normalize("NFKD", texto)
    sin_acentos = "".join(c for c in sin_acentos if not unicodedata.combining(c))
    return " ".join(sin_acentos.lower().split())


SLUG_MAXLEN = 60


def slug(texto):
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


def formatear_colones(n):
    con_puntos = re.sub(r"(?<=\d)(?=(\d{3})+(?!\d))", ".", str(n))
    return "₡" + con_puntos


def inter(size, weight=500):
    f = ImageFont.truetype(INTER_VAR, size)
    try:
        f.set_variation_by_axes([14, weight])
    except Exception:
        pass
    return f


def svg_to_img(svg, px_w, px_h=None):
    png_bytes = cairosvg.svg2png(bytestring=svg.encode("utf-8"), output_width=px_w, output_height=px_h)
    return Image.open(io.BytesIO(png_bytes)).convert("RGBA")


def render_icon_png(categoria, px, color_hex):
    inner = ICONOS_SVG.get(categoria, ICONOS_SVG["otro"])
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
        f'fill="none" stroke="{color_hex}" stroke-width="2" '
        f'stroke-linecap="round" stroke-linejoin="round">{inner}</svg>'
    )
    return svg_to_img(svg, px)


def wrap_to_fit(draw, text, font, max_width):
    words = text.split()
    lines, current = [], ""
    for w in words:
        trial = (current + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_width:
            current = trial
        else:
            if current:
                lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def fit_text(draw, text, max_width, font_path, start_size, min_size, max_lines, weight=None, step=2):
    size = start_size
    while size >= min_size:
        if weight is not None:
            font = ImageFont.truetype(font_path, size)
            font.set_variation_by_axes([14, weight])
        else:
            font = ImageFont.truetype(font_path, size)
        lines = wrap_to_fit(draw, text, font, max_width)
        if len(lines) <= max_lines:
            return font, lines
        size -= step
    if weight is not None:
        font = ImageFont.truetype(font_path, min_size)
        font.set_variation_by_axes([14, weight])
    else:
        font = ImageFont.truetype(font_path, min_size)
    lines = wrap_to_fit(draw, text, font, max_width)[:max_lines]
    if lines:
        last = lines[-1]
        while draw.textlength(last + "…", font=font) > max_width and len(last) > 3:
            last = last[:-1]
        lines[-1] = last.rstrip() + "…"
    return font, lines


def build_background():
    img = Image.new("RGB", (W, H), C_WHITE)
    glow1 = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(glow1)
    cx, cy = W * 0.92, H * 0.0
    max_r = 620
    for r in range(max_r, 0, -4):
        alpha = int(255 * (1 - r / max_r) ** 1.7)
        gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=alpha)
    img = Image.composite(Image.new("RGB", (W, H), C_GREEN_LIGHT), img, glow1)

    glow2 = Image.new("L", (W, H), 0)
    gd2 = ImageDraw.Draw(glow2)
    cx2, cy2 = W * 0.0, H * 1.0
    max_r2 = 520
    for r in range(max_r2, 0, -4):
        alpha = int(180 * (1 - r / max_r2) ** 1.8)
        gd2.ellipse([cx2 - r, cy2 - r, cx2 + r, cy2 + r], fill=alpha)
    img = Image.composite(Image.new("RGB", (W, H), (242, 244, 238)), img, glow2)
    return img


_ICON_CACHE = {}
_ILLUS_CACHE = None


def render_og_image(nombre, precio, categoria, resumen, out_path):
    global _ILLUS_CACHE
    img = build_background()
    draw = ImageDraw.Draw(img, "RGBA")
    pad_x = 84
    left_max_x = 700
    max_w = left_max_x - pad_x

    badge_font = inter(19, 650)
    icon_px = 20
    label = CATEGORIA_LABEL.get(categoria, CATEGORIA_LABEL["otro"]) + "  ·  Naranjo, Alajuela"
    bh = 44

    heading_font, heading_lines = fit_text(
        draw, nombre.upper(), max_w, POPPINS_BOLD, start_size=50, min_size=30, max_lines=2
    )
    line_h = int(heading_font.size * 1.16)
    heading_h = line_h * len(heading_lines)

    price_font = inter(min(heading_font.size, 46), 800)
    price_h = int(price_font.size * 1.16)

    resumen_font, resumen_lines = fit_text(
        draw, resumen, max_w, INTER_VAR, start_size=23, min_size=19, max_lines=2, weight=450
    )
    rline_h = int(resumen_font.size * 1.45)
    resumen_h = rline_h * len(resumen_lines)

    cta_h = 64
    gap_badge_heading = 34
    gap_price_resumen = 4
    gap_resumen_cta = 28

    total_h = bh + gap_badge_heading + heading_h + price_h + gap_price_resumen + resumen_h + gap_resumen_cta + cta_h
    by = max(56, int((H - total_h) / 2))

    bx = pad_x
    tw = draw.textlength(label, font=badge_font)
    bw = tw + icon_px + 46
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=bh / 2, fill=C_WHITE, outline=C_GRAY_LIGHT, width=2)
    if categoria not in _ICON_CACHE:
        ic = render_icon_png(categoria, icon_px * 3, "#6f8f37")
        _ICON_CACHE[categoria] = ic.resize((icon_px, icon_px), Image.LANCZOS)
    icon = _ICON_CACHE[categoria]
    img.paste(icon, (int(bx + 16), int(by + (bh - icon_px) / 2)), icon)
    draw.text((bx + 16 + icon_px + 10, by + bh / 2), label, font=badge_font, fill=C_INK, anchor="lm")

    hy = by + bh + gap_badge_heading
    for ln in heading_lines:
        draw.text((pad_x, hy), ln, font=heading_font, fill=C_INK)
        hy += line_h

    price_text = "Desde " + formatear_colones(precio)
    draw.text((pad_x, hy), price_text, font=price_font, fill=C_GREEN_DARK)
    hy += price_h + gap_price_resumen

    ry = hy
    for ln in resumen_lines:
        draw.text((pad_x, ry), ln, font=resumen_font, fill=C_GRAY)
        ry += rline_h

    cta_y = ry + gap_resumen_cta
    cta_w = 330
    draw.rounded_rectangle([pad_x, cta_y, pad_x + cta_w, cta_y + cta_h], radius=cta_h / 2, fill=C_WHATSAPP)
    wa_svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="#ffffff"><path d="{WA_ICON_PATH}"/></svg>'
    wa_icon = svg_to_img(wa_svg, 84).resize((28, 28), Image.LANCZOS)
    img.paste(wa_icon, (int(pad_x + 28), int(cta_y + (cta_h - 28) / 2)), wa_icon)
    cta_font = inter(21, 700)
    draw.text((pad_x + 28 + 28 + 12, cta_y + cta_h / 2), "Cotizar por WhatsApp", font=cta_font, fill=C_WHITE, anchor="lm")

    if _ILLUS_CACHE is None:
        _ILLUS_CACHE = svg_to_img(HERO_VISUAL_SVG, 760, 760).resize((380, 380), Image.LANCZOS)
    img.paste(_ILLUS_CACHE, (W - 84 - 380 + 20, (H - 380) // 2 - 10), _ILLUS_CACHE)

    img.convert("RGB").save(out_path, "PNG", optimize=True)


def main():
    if not EXAMENES_JSON.exists():
        sys.exit(f"No se encontró {EXAMENES_JSON}. Corré primero build_examenes.py.")
    if not CONTENIDO_JSON.exists():
        sys.exit(f"No se encontró {CONTENIDO_JSON}.")
    if not (Path(POPPINS_BOLD).exists() and Path(INTER_VAR).exists()):
        sys.exit(f"Faltan las fuentes en {FONTS_DIR}.")

    examenes = json.loads(EXAMENES_JSON.read_text(encoding="utf-8"))
    examenes_por_codigo = {e["codigo"]: e for e in examenes}
    contenido_data = json.loads(CONTENIDO_JSON.read_text(encoding="utf-8"))

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    generadas = 0
    advertencias = []
    slugs_actuales = set()

    for contenido in contenido_data["examenes"]:
        codigo = contenido["codigo"]
        ex = examenes_por_codigo.get(codigo)
        if not ex:
            continue  # ya se avisa en build_paginas_examenes.py

        categoria = contenido["categoria"]
        if categoria not in ICONOS_SVG:
            advertencias.append(f"Categoría desconocida '{categoria}' para '{codigo}' — se usa ícono genérico")
            categoria = "otro"

        s = slug(ex["descripcion"])
        slugs_actuales.add(s)
        out_path = OUT_DIR / f"{s}.png"
        render_og_image(ex["descripcion"], ex["precio"], categoria, contenido["resumen"], out_path)
        generadas += 1

    # limpia imágenes de códigos que ya no están vigentes
    eliminadas = 0
    if OUT_DIR.exists():
        for f in OUT_DIR.glob("*.png"):
            if f.stem not in slugs_actuales:
                f.unlink()
                eliminadas += 1

    print(f"OK: {generadas} imágenes og:image generadas en {OUT_DIR.relative_to(ROOT)}/")
    if eliminadas:
        print(f"OK: {eliminadas} imagen(es) obsoleta(s) eliminada(s)")
    if advertencias:
        print(f"\n{len(advertencias)} advertencia(s):")
        for a in advertencias:
            print(f"  - {a}")


if __name__ == "__main__":
    main()
