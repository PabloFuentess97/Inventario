import { ApiError, conManejadorErrores, requireSesion } from "@/lib/api";
import { COLUMNAS_INFORME, obtenerFilasInforme, type FilaInforme } from "@/lib/informes";

/**
 * Exportación del informe de recuento.
 * Query:
 *   formato = xlsx | csv | pdf
 *   almacenId | estanteriaId  (ámbito; sin ambos exporta todo)
 *   soloFinalizados = 1  (por defecto se incluyen también los en progreso)
 */
export const GET = conManejadorErrores(async (peticion: Request) => {
  await requireSesion(["OFICINISTA", "ADMIN"]);

  const url = new URL(peticion.url);
  const formato = url.searchParams.get("formato") ?? "xlsx";
  const almacenId = url.searchParams.get("almacenId") ?? undefined;
  const estanteriaId = url.searchParams.get("estanteriaId") ?? undefined;
  const soloFinalizados = url.searchParams.get("soloFinalizados") === "1";

  const filas = await obtenerFilasInforme({ almacenId, estanteriaId, soloFinalizados });
  const fechaArchivo = new Date().toISOString().slice(0, 10);
  const nombreBase = `recuento-inventario-${fechaArchivo}`;

  switch (formato) {
    case "csv":
      return respuestaCsv(filas, nombreBase);
    case "xlsx":
      return respuestaXlsx(filas, nombreBase);
    case "pdf":
      return respuestaPdf(filas, nombreBase);
    default:
      throw new ApiError(400, "Formato no válido (usa xlsx, csv o pdf)");
  }
});

/** CSV con BOM UTF-8 y separador ';' (compatible con Excel en español y ERPs). */
function respuestaCsv(filas: FilaInforme[], nombre: string): Response {
  const escapar = (valor: string | number) => {
    const texto = String(valor);
    return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };

  const cabecera = COLUMNAS_INFORME.map((c) => c.titulo).join(";");
  const cuerpo = filas
    .map((f) =>
      COLUMNAS_INFORME.map((c) => {
        const v = f[c.clave];
        // Cantidad con coma decimal para Excel/ERP en español
        return c.clave === "cantidad" ? String(v).replace(".", ",") : escapar(v);
      }).join(";")
    )
    .join("\r\n");

  const contenido = "﻿" + cabecera + "\r\n" + cuerpo;
  return new Response(contenido, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}.csv"`,
    },
  });
}

async function respuestaXlsx(filas: FilaInforme[], nombre: string): Promise<Response> {
  const ExcelJS = (await import("exceljs")).default;
  const libro = new ExcelJS.Workbook();
  libro.creator = "Inventario Recuentos";
  const hoja = libro.addWorksheet("Recuento", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  hoja.columns = COLUMNAS_INFORME.map((c) => ({
    header: c.titulo,
    key: c.clave,
    width: c.ancho,
  }));
  hoja.getRow(1).font = { bold: true };
  hoja.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFEFEF" },
  };

  for (const fila of filas) hoja.addRow(fila);
  hoja.autoFilter = { from: "A1", to: `${String.fromCharCode(64 + COLUMNAS_INFORME.length)}1` };

  const buffer = await libro.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}.xlsx"`,
    },
  });
}

async function respuestaPdf(filas: FilaInforme[], nombre: string): Promise<Response> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.text("Informe de recuento de inventario", 14, 14);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generado el ${new Date().toLocaleString("es-ES")} · ${filas.length} líneas`, 14, 20);

  autoTable(doc, {
    startY: 25,
    head: [COLUMNAS_INFORME.map((c) => c.titulo)],
    body: filas.map((f) => COLUMNAS_INFORME.map((c) => String(f[c.clave]))),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [55, 65, 81] },
  });

  const buffer = doc.output("arraybuffer");
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}.pdf"`,
    },
  });
}
