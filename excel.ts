/**
 * Excel (.xlsx) export for Sistemi Genit reports.
 * Builds a styled worksheet that mirrors the on-screen report table:
 * title row, optional company + filters rows, header row, data rows and a
 * summary block — then writes it to a temp file and opens the share sheet so
 * it can be saved/opened from any phone (WhatsApp, Drive, Excel, etc.).
 */
import * as XLSXStyle from "xlsx-js-style";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import type { ReportResult } from "./reports";
import type { Company } from "./store";
import type { PrintableDoc } from "./print-templates";
import { buildWarehouseDocWorkbook } from "./warehouse-excel";

export { buildWarehouseDocWorkbook } from "./warehouse-excel";

export type ExcelMeta = {
  companyName?: string;
  filtersText?: string;
  currency?: string;
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^\p{L}\p{N}_-]+/gu, "_").replace(/_+/g, "_").slice(0, 60) || "raport";
}

/** Convert a report row value to a number when the column is numeric, else string. */
function cellValue(raw: any, format?: string): number | string {
  if (raw == null || raw === "") return "";
  if (format === "money" || format === "qty") {
    const n = Number(raw);
    return isFinite(n) ? n : String(raw);
  }
  if (format === "pct") {
    const n = Number(raw);
    return isFinite(n) ? n / 100 : String(raw);
  }
  return String(raw);
}

export async function exportReportToExcel(result: ReportResult, meta: ExcelMeta = {}): Promise<void> {
  const cols = result.columns;
  const NC = Math.max(1, cols.length);
  const lastCol = NC - 1;
  const B = { style: "thin", color: { rgb: "CBD5E1" } } as const;
  const allB = { top: B, bottom: B, left: B, right: B };
  const numFmt = (fmt?: string) =>
    fmt === "money" ? "#,##0.00" : fmt === "qty" ? "#,##0.###" : fmt === "pct" ? "0.0%" : undefined;
  const ws: any = {};
  const merges: any[] = [];
  let R = 0;
  const put = (c: number, v: string | number, s: any) => {
    ws[XLSXStyle.utils.encode_cell({ r: R, c })] = { v, t: typeof v === "number" ? "n" : "s", s };
  };
  const titleS = { font: { bold: true, sz: 16 }, alignment: { horizontal: "center" } };
  const metaS = { font: { sz: 10, color: { rgb: "475569" } }, alignment: { horizontal: "center" } };
  const thS = {
    font: { bold: true, sz: 11, color: { rgb: "0F172A" } },
    fill: { fgColor: { rgb: "E2E8F0" } },
    border: allB,
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };
  const totFill = { rgb: "16A34A" };
  const mergeFull = () => merges.push({ s: { r: R, c: 0 }, e: { r: R, c: lastCol } });

  // Title + meta rows (each merged across all columns)
  put(0, result.title, titleS); mergeFull(); R++;
  if (meta.companyName) { put(0, meta.companyName, metaS); mergeFull(); R++; }
  if (result.subtitle) { put(0, result.subtitle, metaS); mergeFull(); R++; }
  if (meta.filtersText) { put(0, `Filtra: ${meta.filtersText}`, metaS); mergeFull(); R++; }
  R++; // spacer

  // Header row (bold, grey fill)
  cols.forEach((c, ci) => put(ci, c.label, thS));
  R++;

  // Data rows — green styling for any total row (flagged with _total).
  result.rows.forEach((r) => {
    const isTotal = !!(r as any)._total;
    cols.forEach((c, ci) => {
      const v = cellValue((r as any)[c.key], c.format);
      const base: any = {
        font: isTotal ? { bold: true, color: { rgb: "FFFFFF" } } : { sz: 10 },
        border: allB,
        alignment: { horizontal: c.align || "left" },
      };
      if (isTotal) base.fill = { fgColor: totFill };
      const nf = numFmt(c.format);
      if (nf && typeof v === "number") base.numFmt = nf;
      put(ci, v, base);
    });
    R++;
  });

  // Summary block
  if (result.summary && result.summary.length) {
    R++;
    put(0, "Përmbledhje", { font: { bold: true, sz: 11 } }); R++;
    result.summary.forEach((s) => {
      put(0, s.label, { font: { sz: 10 } });
      put(1, s.value, { font: { bold: true, sz: 10 } });
      R++;
    });
  }

  ws["!ref"] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, R - 1), c: lastCol } });
  ws["!cols"] = cols.map((c) => {
    let w = String(c.label).length;
    result.rows.forEach((r) => {
      const v = (r as any)[c.key];
      if (v != null) w = Math.max(w, String(v).length);
    });
    return { wch: Math.min(Math.max(w + 2, 10), 40) };
  });
  ws["!merges"] = merges;

  const wb = XLSXStyle.utils.book_new();
  const sheetName = (result.title || "Raport").slice(0, 28);
  XLSXStyle.utils.book_append_sheet(wb, ws, sheetName);

  const wbout: string = XLSXStyle.write(wb, { type: "base64", bookType: "xlsx" });
  const fileName = `${sanitizeFileName(result.title)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const uri = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(uri, wbout, { encoding: FileSystem.EncodingType.Base64 });

  const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: result.title, UTI: "org.openxmlformats.spreadsheetml.sheet" });
  } else if (Platform.OS === "web") {
    // Web fallback: trigger a download
    const link = document.createElement("a");
    link.href = `data:${mime};base64,${wbout}`;
    link.download = fileName;
    link.click();
  }
}


/**
 * Export a warehouse document (Fletë Dalje / Fletë Hyrje) as a REAL styled
 * .xlsx file (borders, merged title, fills, widths, totals, signatures) and
 * share it. Uses the pure {@link buildWarehouseDocWorkbook} builder.
 */
export async function exportWarehouseDocToExcel(
  doc: PrintableDoc,
  company: Company,
): Promise<void> {
  const wb = buildWarehouseDocWorkbook(doc, company);

  const wbout: string = XLSXStyle.write(wb, { type: "base64", bookType: "xlsx" });
  const safeTitle = sanitizeFileName(`${doc.title}_${doc.number}`);
  const fileName = `${safeTitle}.xlsx`;
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, wbout, { encoding: FileSystem.EncodingType.Base64 });

  const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (Platform.OS !== "web" && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(uri, { mimeType: mime, dialogTitle: `${doc.title} ${doc.number}`, UTI: "org.openxmlformats.spreadsheetml.sheet" });
  } else if (Platform.OS === "web") {
    const link = document.createElement("a");
    link.href = `data:${mime};base64,${wbout}`;
    link.download = fileName;
    link.click();
  }
}
