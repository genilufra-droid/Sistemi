/**
 * Warehouse document (Fletë Dalje / Fletë Hyrje) — real styled .xlsx builder.
 *
 * Pure module: imports only `xlsx-js-style` and types. NO native modules
 * (react-native / expo), so it is fully unit-testable and reusable. The layout
 * mirrors the printed warehouse document exactly:
 *   title • company • header field block • goods table • TOTAL • signatures.
 */
import * as XLSXStyle from "xlsx-js-style";
import type { Company } from "./store";
import type { PrintableDoc } from "./print-templates";

const WH_BORDER_THIN = { style: "thin", color: { rgb: "000000" } } as const;
const WH_ALL_BORDERS = {
  top: WH_BORDER_THIN,
  bottom: WH_BORDER_THIN,
  left: WH_BORDER_THIN,
  right: WH_BORDER_THIN,
};

/** Build a styled cell object for xlsx-js-style. */
function wcell(v: string | number, style: any): any {
  const t = typeof v === "number" ? "n" : "s";
  return { v, t, s: style };
}

/** The 8 warehouse-document columns, in order. */
export const WAREHOUSE_XLSX_COLUMNS = [
  "Nr",
  "Emërtimi i mallit",
  "Njësia",
  "Sasia",
  "Koef",
  "Sasia Copë",
  "Çmimi",
  "Vlefta",
] as const;

/**
 * Pure builder — constructs the styled xlsx-js-style workbook for a warehouse
 * document. Returns the workbook object (caller writes/serializes it).
 */
export function buildWarehouseDocWorkbook(doc: PrintableDoc, company: Company): any {
  const NCOLS = 8; // Nr, Emërtimi, Njësia, Sasia, Koef, Sasia Copë, Çmimi, Vlefta
  const lastCol = NCOLS - 1;
  const ws: any = {};
  const merges: any[] = [];
  const rowHeights: { hpt: number }[] = [];
  let R = 0;

  const setRow = (cells: any[], height?: number) => {
    cells.forEach((cell, c) => {
      if (cell == null) return;
      ws[XLSXStyle.utils.encode_cell({ r: R, c })] = cell;
    });
    rowHeights[R] = { hpt: height ?? 16 };
    R++;
  };

  const titleStyle = {
    font: { bold: true, sz: 18 },
    alignment: { horizontal: "center", vertical: "center" },
  };
  const companyStyle = { font: { bold: true, sz: 12 }, alignment: { horizontal: "center" } };
  const addrStyle = { font: { sz: 10 }, alignment: { horizontal: "center" } };
  const labelStyle = {
    font: { bold: true, sz: 10 },
    fill: { fgColor: { rgb: "F0F0F0" } },
    border: WH_ALL_BORDERS,
    alignment: { vertical: "center", wrapText: true },
  };
  const valueStyle = { font: { sz: 10 }, border: WH_ALL_BORDERS, alignment: { vertical: "center", wrapText: true } };
  const thStyle = {
    font: { bold: true, sz: 10 },
    fill: { fgColor: { rgb: "E8E8E8" } },
    border: WH_ALL_BORDERS,
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  };
  const tdL = { font: { sz: 10 }, border: WH_ALL_BORDERS, alignment: { horizontal: "left" } };
  const tdC = { font: { sz: 10 }, border: WH_ALL_BORDERS, alignment: { horizontal: "center" } };
  const tdR = { font: { sz: 10 }, border: WH_ALL_BORDERS, alignment: { horizontal: "right" } };
  const tdRMoney = { ...tdR, numFmt: "#,##0.00" };
  const totStyle = {
    font: { bold: true, sz: 11 },
    fill: { fgColor: { rgb: "F0F0F0" } },
    border: WH_ALL_BORDERS,
    alignment: { horizontal: "right" },
  };
  const totMoneyStyle = { ...totStyle, numFmt: "#,##0.00" };
  const signStyle = { font: { sz: 10 }, alignment: { horizontal: "center", vertical: "top" }, border: { top: WH_BORDER_THIN } };

  // Title (merged across all columns)
  setRow([wcell(doc.title, titleStyle)], 26);
  merges.push({ s: { r: R - 1, c: 0 }, e: { r: R - 1, c: lastCol } });

  // Company name (merged)
  setRow([wcell(company.name || "", companyStyle)], 18);
  merges.push({ s: { r: R - 1, c: 0 }, e: { r: R - 1, c: lastCol } });
  if (company.address) {
    setRow([wcell(`${company.address}${company.city ? ", " + company.city : ""}`, addrStyle)], 14);
    merges.push({ s: { r: R - 1, c: 0 }, e: { r: R - 1, c: lastCol } });
  }
  setRow([], 6); // spacer

  // Header field block — each field: label (cols 0-2) + value (cols 3-7).
  const headerFields: [string, string][] = [
    ["Nr. / Dokumenti", doc.number || ""],
    ["Dt. / Data", `${doc.date || ""}${doc.time ? " " + doc.time : ""}`],
    ["Magazina", doc.warehouseName || doc.businessUnit || ""],
    ["Adresa ku shkon malli", doc.destinationAddress || doc.partyAddress || ""],
    [doc.warehouseKind === "inbound" ? "Furnitori" : "Marrësi", doc.receiver || doc.partyName || ""],
    ["Emri, mbiemri pers. Autorizuar", doc.authorizedPerson || ""],
    ["Lloji e targa e Mjetit transp.", doc.vehicle || ""],
    ["Seria / Nr. references", doc.serialNo || ""],
  ];
  headerFields.forEach(([label, value]) => {
    const cells: any[] = [wcell(label, labelStyle), null, null, wcell(value, valueStyle)];
    setRow(cells, 18);
    merges.push({ s: { r: R - 1, c: 0 }, e: { r: R - 1, c: 2 } });
    merges.push({ s: { r: R - 1, c: 3 }, e: { r: R - 1, c: lastCol } });
  });
  setRow([], 6); // spacer

  // Goods table header
  setRow(
    (WAREHOUSE_XLSX_COLUMNS as readonly string[]).map((h) => wcell(h, thStyle)),
    24,
  );

  // Goods rows
  doc.lines.forEach((l, i) => {
    setRow(
      [
        wcell(i + 1, tdC),
        wcell(l.name, tdL),
        wcell(l.unit, tdC),
        wcell(Number(l.qty || 0), { ...tdR, numFmt: "#,##0.###" }),
        wcell(Number(l.coef ?? 1), tdC),
        wcell(Number(l.baseQty ?? l.qty * (l.coef ?? 1)), { ...tdR, numFmt: "#,##0.###" }),
        wcell(Number(l.rate || 0), tdRMoney),
        wcell(Number(l.total || 0), tdRMoney),
      ],
      18,
    );
  });

  // TOTAL row — "TOTALI" merged across first 5 cols, physical pieces total in
  // "Sasia Copë" (col 5), financial total in "Vlefta" (col 7).
  const totalBase = doc.lines.reduce(
    (s, l) => s + Number(l.baseQty ?? l.qty * (l.coef ?? 1)),
    0,
  );
  setRow(
    [
      wcell("TOTALI", totStyle), null, null, null, null,
      wcell(totalBase, { ...totStyle, numFmt: "#,##0.###" }),
      wcell("", totStyle),
      wcell(Number(doc.total || 0), totMoneyStyle),
    ],
    20,
  );
  merges.push({ s: { r: R - 1, c: 0 }, e: { r: R - 1, c: 4 } });

  setRow([], 24); // spacer before signatures
  setRow([], 24);

  // Signature row — Fletë Hyrje adds "Dorëzuesi" (5 roles); Fletë Dalje has 4.
  const sigRoles =
    doc.warehouseKind === "inbound"
      ? ["Magazinieri", "Dorëzuesi", "Marrësi në dorëzim", "Transportuesi", "Llogaritari"]
      : ["Magazinieri", "Marrësi në dorëzim", "Transportuesi", "Llogaritari"];
  // Distribute the 8 columns across the roles as evenly as possible.
  const spans: number[] = [];
  let remaining = NCOLS;
  for (let i = 0; i < sigRoles.length; i++) {
    const span = Math.round(remaining / (sigRoles.length - i));
    spans.push(Math.max(1, span));
    remaining -= spans[i];
  }
  const sigCells: any[] = new Array(NCOLS).fill(null);
  let cstart = 0;
  sigRoles.forEach((role, i) => {
    sigCells[cstart] = wcell(role, signStyle);
    if (spans[i] > 1) merges.push({ s: { r: R, c: cstart }, e: { r: R, c: cstart + spans[i] - 1 } });
    cstart += spans[i];
  });
  setRow(sigCells, 22);

  // Worksheet dimensions, column widths, row heights, merges.
  ws["!ref"] = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: R - 1, c: lastCol } });
  ws["!cols"] = [
    { wch: 5 },   // Nr
    { wch: 34 },  // Emërtimi
    { wch: 10 },  // Njësia
    { wch: 10 },  // Sasia
    { wch: 8 },   // Koef
    { wch: 12 },  // Sasia Copë
    { wch: 12 },  // Çmimi
    { wch: 14 },  // Vlefta
  ];
  ws["!rows"] = rowHeights;
  ws["!merges"] = merges;

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, (doc.title || "Fletë").slice(0, 28));
  return wb;
}
