#!/usr/bin/env python3
"""
Genera la og:image (1200x630) de /citas/ — miniatura para WhatsApp/redes al
compartir el link de agendar cita.

Sigue la misma línea visual que scripts/build_og_images.py (fondo con glow
verde, badge con ícono, encabezado Poppins, ilustración de la tarjeta de
resultado), pero con un CTA propio de "Agendar cita" en vez de "Cotizar por
WhatsApp".

Requiere Pillow y cairosvg (cairosvg necesita la librería nativa cairo):
    brew install cairo
    pip install cairosvg

Uso:
    python3 scripts/build_og_citas.py
"""

import io
import os
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
OUT_PATH = ROOT / "assets" / "og-citas.png"
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

CALENDAR_ICON_PATH = (
    '<rect x="3" y="4" width="18" height="18" rx="2"/>'
    '<line x1="16" y1="2" x2="16" y2="6"/>'
    '<line x1="8" y1="2" x2="8" y2="6"/>'
    '<line x1="3" y1="10" x2="21" y2="10"/>'
)

# Copiado del <div class="hero-visual"> de index.html (misma ilustración que
# usan las og:image de /examenes/).
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


def render():
    img = build_background()
    draw = ImageDraw.Draw(img, "RGBA")
    pad_x = 84
    left_max_x = 700
    max_w = left_max_x - pad_x

    badge_font = inter(19, 650)
    icon_px = 20
    label = "Agendar cita  ·  Naranjo, Alajuela"
    bh = 44

    heading_font, heading_lines = fit_text(
        draw, "AGENDÁ TU CITA EN MINUTOS", max_w, POPPINS_BOLD, start_size=50, min_size=32, max_lines=2
    )
    line_h = int(heading_font.size * 1.16)
    heading_h = line_h * len(heading_lines)

    subline_font = inter(min(heading_font.size, 30), 800)
    subline_h = int(subline_font.size * 1.16)

    resumen_font, resumen_lines = fit_text(
        draw, "Elegí sucursal, día y hora con disponibilidad real. Confirmación al instante por correo.",
        max_w, INTER_VAR, start_size=23, min_size=19, max_lines=2, weight=450
    )
    rline_h = int(resumen_font.size * 1.45)
    resumen_h = rline_h * len(resumen_lines)

    cta_h = 64
    gap_badge_heading = 34
    gap_heading_subline = 6
    gap_subline_resumen = 12
    gap_resumen_cta = 28

    total_h = (bh + gap_badge_heading + heading_h + gap_heading_subline + subline_h +
               gap_subline_resumen + resumen_h + gap_resumen_cta + cta_h)
    by = max(56, int((H - total_h) / 2))

    bx = pad_x
    tw = draw.textlength(label, font=badge_font)
    bw = tw + icon_px + 46
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=bh / 2, fill=C_WHITE, outline=C_GRAY_LIGHT, width=2)
    badge_icon_svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
        f'fill="none" stroke="#6f8f37" stroke-width="2" '
        f'stroke-linecap="round" stroke-linejoin="round">{CALENDAR_ICON_PATH}</svg>'
    )
    badge_icon = svg_to_img(badge_icon_svg, icon_px * 3).resize((icon_px, icon_px), Image.LANCZOS)
    img.paste(badge_icon, (int(bx + 16), int(by + (bh - icon_px) / 2)), badge_icon)
    draw.text((bx + 16 + icon_px + 10, by + bh / 2), label, font=badge_font, fill=C_INK, anchor="lm")

    hy = by + bh + gap_badge_heading
    for ln in heading_lines:
        draw.text((pad_x, hy), ln, font=heading_font, fill=C_INK)
        hy += line_h

    hy += gap_heading_subline
    draw.text((pad_x, hy), "Disponibilidad real, todos los días", font=subline_font, fill=C_GREEN_DARK)
    hy += subline_h + gap_subline_resumen

    ry = hy
    for ln in resumen_lines:
        draw.text((pad_x, ry), ln, font=resumen_font, fill=C_GRAY)
        ry += rline_h

    cta_y = ry + gap_resumen_cta
    cta_label = "Agendar cita ahora"
    cta_font = inter(21, 700)
    cta_w = int(draw.textlength(cta_label, font=cta_font)) + 28 + 28 + 12 + 28
    draw.rounded_rectangle([pad_x, cta_y, pad_x + cta_w, cta_y + cta_h], radius=cta_h / 2, fill=C_WHATSAPP)
    cta_icon_svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
        f'fill="none" stroke="#ffffff" stroke-width="2" '
        f'stroke-linecap="round" stroke-linejoin="round">{CALENDAR_ICON_PATH}</svg>'
    )
    cta_icon = svg_to_img(cta_icon_svg, 84).resize((28, 28), Image.LANCZOS)
    img.paste(cta_icon, (int(pad_x + 28), int(cta_y + (cta_h - 28) / 2)), cta_icon)
    draw.text((pad_x + 28 + 28 + 12, cta_y + cta_h / 2), cta_label, font=cta_font, fill=C_WHITE, anchor="lm")

    illus = svg_to_img(HERO_VISUAL_SVG, 760, 760).resize((380, 380), Image.LANCZOS)
    img.paste(illus, (W - 84 - 380 + 20, (H - 380) // 2 - 10), illus)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(OUT_PATH, "PNG", optimize=True)
    print(f"OK: og:image de /citas/ generada en {OUT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    if not (Path(POPPINS_BOLD).exists() and Path(INTER_VAR).exists()):
        sys.exit(f"Faltan las fuentes en {FONTS_DIR}.")
    render()
