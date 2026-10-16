"""Reporte PDF de un lote analizado. Solo presenta lo que ya calculó la base de datos."""
from collections import Counter
from datetime import date, datetime
from io import BytesIO
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

AVISO = "Preclasificación visual, no certificación de exportación."

NOMBRE_DESTINO = {
    "exportacion": "Exportación",
    "mercado_nacional": "Mercado nacional",
    "procesamiento": "Procesamiento",
    "separar": "Separar",
    "revision_manual": "Revisión manual",
}
# Colores de CLAUDE.md: exportación verde, mercado nacional amarillo, procesamiento naranja, separar rojo, revisión gris.
COLOR_DESTINO = {
    "exportacion": colors.HexColor("#2e9e4f"),
    "mercado_nacional": colors.HexColor("#e6b422"),
    "procesamiento": colors.HexColor("#e8821e"),
    "separar": colors.HexColor("#d63b3b"),
    "revision_manual": colors.HexColor("#8a8f98"),
}
NOMBRE_GRADO = {"A": "Grado A", "B": "Grado B", "C": "Grado C", "rechazo": "Rechazo"}
NOMBRE_FRUTA = {"mango": "Mango", "jitomate": "Jitomate", "fresa": "Fresa"}

GRIS = colors.HexColor("#5b6470")
LINEA = colors.HexColor("#d5d9df")


def _fecha(valor: str | date | None) -> str:
    if not valor:
        return "-"
    if isinstance(valor, date) and not isinstance(valor, datetime):
        return valor.strftime("%d/%m/%Y")
    texto = str(valor)
    if len(texto) == 10:
        return datetime.fromisoformat(texto).strftime("%d/%m/%Y")
    return datetime.fromisoformat(texto).astimezone().strftime("%d/%m/%Y %H:%M")


def _pct(valor: float | None) -> str:
    return "-" if valor is None else f"{float(valor):.1f}%"


def generar_reporte(
    lote: dict[str, Any],
    analisis: dict[str, Any],
    frutos: list[dict[str, Any]],
    sugerencias: list[dict[str, Any]],
    zona_nombre: str | None,
) -> bytes:
    estilos = getSampleStyleSheet()
    normal = ParagraphStyle("normal", parent=estilos["Normal"], fontSize=10, leading=13)
    pequeno = ParagraphStyle("pequeno", parent=normal, fontSize=8.5, leading=11, textColor=GRIS)
    titulo = ParagraphStyle("titulo", parent=estilos["Title"], fontSize=20, leading=24, alignment=0, spaceAfter=2)
    seccion = ParagraphStyle("seccion", parent=estilos["Heading2"], fontSize=13, spaceBefore=14, spaceAfter=6)
    grande = ParagraphStyle("grande", parent=normal, fontSize=26, leading=30, fontName="Helvetica-Bold")

    def p(texto: object, estilo: ParagraphStyle = normal) -> Paragraph:
        return Paragraph(escape(str(texto)), estilo)

    historia: list[Any] = [
        p("Reporte de calidad del lote", titulo),
        p(lote["nombre"], ParagraphStyle("sub", parent=normal, fontSize=12, textColor=GRIS)),
        Spacer(1, 6),
        _caja_aviso(normal),
        Spacer(1, 10),
    ]

    datos = [
        ("Fruta", NOMBRE_FRUTA.get(lote["fruta_principal"], lote["fruta_principal"] or "-")),
        ("Parcela", lote["parcela"] or "-"),
        ("Zona", zona_nombre or "-"),
        ("Fecha de cosecha", _fecha(lote["fecha_cosecha"])),
        ("Destino que buscaba", NOMBRE_DESTINO.get(lote["destino_buscado"], "-")),
        ("Analizado el", _fecha(analisis["created_at"])),
        ("Modelo", analisis["modelo_version"] or "-"),
        ("ID del lote", lote["id"]),
    ]
    historia.append(_tabla_clave_valor(datos, p))

    historia.append(p("Resultado del lote", seccion))
    grado = analisis["grado"]
    destino_lote = analisis["destino_lote"]
    resumen = Table(
        [[
            p(NOMBRE_GRADO[grado] if grado else "Sin grado", grande),
            [
                p(f"Destino del lote: {NOMBRE_DESTINO.get(destino_lote, '-')}"),
                p(f"Frutos sanos: {_pct(analisis['pct_sanos'])} ({analisis['frutos_sanos']} de {analisis['total_frutos']} clasificados)"),
                p(f"Frutos para separar: {_pct(analisis['pct_separar'])} ({analisis['frutos_separar']})"),
                p(f"Revisión manual: {analisis['frutos_revision']} (no cuentan en los porcentajes)"),
            ],
        ]],
        colWidths=[5 * cm, 12.5 * cm],
        style=TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("BOX", (0, 0), (-1, -1), 0.6, LINEA),
                          ("LEFTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 8),
                          ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]),
    )
    historia.append(resumen)
    if analisis["total_frutos"] == 0:
        historia += [Spacer(1, 6), p("No se encontraron frutos clasificados, por eso el lote no tiene grado.", pequeno)]
    elif analisis["muestra_pequena"]:
        historia += [Spacer(1, 6), p("Muestra pequeña: el lote tiene pocos frutos, así que el grado es menos confiable.", pequeno)]

    historia.append(p("Frutos por clase y destino", seccion))
    historia.append(_tabla_clases(frutos, p))

    if sugerencias:
        historia.append(p("Sugerencias", seccion))
        for s in sugerencias:
            historia += [p(f"- {s['texto']}"), Spacer(1, 3)]
        historia.append(p("Confirma con un técnico agrícola antes de aplicar cualquier tratamiento.", pequeno))

    salida = BytesIO()
    documento = SimpleDocTemplate(
        salida, pagesize=letter, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2.2 * cm,
        title=f"Reporte del lote {lote['nombre']}", author="FruitScan",
        # Sin comprimir: el PDF es pequeño y así sus textos se pueden revisar en las pruebas.
        pageCompression=0,
    )
    documento.build(historia, onFirstPage=_pie, onLaterPages=_pie)
    return salida.getvalue()


def _caja_aviso(estilo: ParagraphStyle) -> Table:
    aviso = Paragraph(f"<b>{escape(AVISO)}</b>", estilo)
    return Table(
        [[aviso]], colWidths=[17.5 * cm],
        style=TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fff6dc")),
                          ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#e6b422")),
                          ("LEFTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6),
                          ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]),
    )


def _tabla_clave_valor(datos: list[tuple[str, str]], p: Any) -> Table:
    tabla = Table([[p(k, ParagraphStyle("k", fontSize=9, textColor=GRIS)), p(v)] for k, v in datos], colWidths=[5 * cm, 12.5 * cm])
    tabla.setStyle(TableStyle([("LINEBELOW", (0, 0), (-1, -1), 0.4, LINEA), ("VALIGN", (0, 0), (-1, -1), "TOP"),
                               ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    return tabla


def _tabla_clases(frutos: list[dict[str, Any]], p: Any) -> Table:
    # Cuenta lo que asignó la base de datos a cada fruto; no se vuelve a decidir nada.
    conteo: Counter[tuple[str, str, str]] = Counter()
    for f in frutos:
        clase = f["clase"]["nombre"] if f.get("clase") else "Sin clasificar"
        conteo[(f["fruta_id"], clase, f["destino"])] += 1
    filas = sorted(conteo.items(), key=lambda kv: (kv[0][0], -kv[1], kv[0][1]))
    total = sum(conteo.values())

    encabezado = [p(t, ParagraphStyle("h", fontName="Helvetica-Bold", fontSize=9)) for t in ("Fruta", "Clase", "Destino", "Frutos", "%")]
    cuerpo = [
        [p(NOMBRE_FRUTA.get(fruta, fruta)), p(clase), p(NOMBRE_DESTINO[destino]), p(n), p(f"{100 * n / total:.1f}%")]
        for (fruta, clase, destino), n in filas
    ]
    sin_frutos = not cuerpo
    if sin_frutos:
        cuerpo = [[p("Sin frutos detectados"), "", "", "", ""]]
    else:
        cuerpo.append([p("Total"), "", "", p(total), p("100%")])

    estilo = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eef0f3")),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINEA),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
    ]
    if sin_frutos:
        estilo.append(("SPAN", (0, 1), (-1, 1)))
    # Un cuadro del color del destino, para no depender solo del texto.
    for i, ((_, _, destino), _) in enumerate(filas, start=1):
        estilo.append(("LINEBEFORE", (2, i), (2, i), 4, COLOR_DESTINO[destino]))
        estilo.append(("LEFTPADDING", (2, i), (2, i), 8))
    return Table([encabezado, *cuerpo], colWidths=[3 * cm, 5.5 * cm, 4.5 * cm, 2.2 * cm, 2.3 * cm], style=TableStyle(estilo), repeatRows=1)


def _pie(lienzo: Any, documento: Any) -> None:
    lienzo.saveState()
    lienzo.setFont("Helvetica", 8)
    lienzo.setFillColor(GRIS)
    lienzo.drawString(2 * cm, 1.2 * cm, f"FruitScan - {AVISO}")
    lienzo.drawRightString(letter[0] - 2 * cm, 1.2 * cm, f"Página {documento.page}")
    lienzo.restoreState()
