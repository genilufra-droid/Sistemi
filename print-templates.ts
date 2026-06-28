/**
 * Print templates for Sistemi Genit — pure, dependency-free HTML builders.
 *
 * Supports four paper sizes:
 *   - "58"  : small thermal printer (fiscal receipt)
 *   - "80"  : standard thermal printer
 *   - "110" : large thermal printer (wide receipt)
 *   - "A4"  : full A4 tax-invoice layout (210mm x 297mm)
 *
 * Every function here is pure (no React Native / native imports), so the layout
 * logic and money/VAT math can be unit-tested in plain Node.
 */
import type { Company, Invoice, Purchase, Transfer, Product, InvoiceItem, InboundDoc, OutboundDoc } from "./store";

export type PaperSize = "58" | "80" | "110" | "A4";
export type PrintDocType = "sale" | "purchase" | "transfer";

export const PAPER_SIZES: { value: PaperSize; label: string; hint: string }[] = [
  { value: "58", label: "58mm", hint: "Termik i vogël" },
  { value: "80", label: "80mm", hint: "Termik standard" },
  { value: "110", label: "110mm", hint: "Termik i madh" },
  { value: "A4", label: "A4", hint: "Letër e plotë" },
];

/** A single line shown on a printed document. */
export type PrintLine = {
  name: string;
  code?: string;
  barcode?: string;
  qty: number;
  unit: string;
  rate: number;
  total: number;
  /** Warehouse-doc extras (Fletë Dalje / Hyrje). */
  coef?: number;
  /** Sasia Copë = qty × coef (base units / pieces). */
  baseQty?: number;
  /** Çmimi Kosto Copë — cost per piece (optional valuation column). */
  costPiece?: number;
  /** True when this is a FREE / gift (DHURATË) line: price 0, value 0. */
  isGift?: boolean;
};

/** Normalized, render-ready document used by all templates. */
export type PrintableDoc = {
  docType: PrintDocType;
  /** Big title, e.g. "FATURË TATIMORE". */
  title: string;
  /** Document number/code as a display string. */
  number: string;
  date: string;
  time: string;
  /** "Klienti" | "Furnitori" | "" */
  partyLabel: string;
  partyName: string;
  partyNipt?: string;
  partyAddress?: string;
  mode?: string;
  paymentType?: string;
  operator?: string;
  businessUnit?: string;
  lines: PrintLine[];
  subtotal: number;
  total: number;
  paid: number;
  due: number;
  change?: number;
  /** VAT rate as a percentage (0 = no VAT / "Shitje pa TVSH"). */
  vatRate: number;
  note?: string;
  /** Fiscalization codes (Albania). */
  nslf?: string;
  nivf?: string;
  /** Transfer-only fields. */
  fromWarehouse?: string;
  toWarehouse?: string;

  /**
   * When true, render the WAREHOUSE document layout (Fletë Dalje / Fletë Hyrje)
   * — a bordered goods table with signatures and NO QR / fiscal blocks.
   */
  warehouse?: boolean;
  /** "outbound" (Fletë Dalje) | "inbound" (Fletë Hyrje). */
  warehouseKind?: "inbound" | "outbound";
  /** Adresa ku shkon malli (destination). */
  destinationAddress?: string;
  /** Emri, mbiemri pers. Autorizuar. */
  authorizedPerson?: string;
  /** Lloji e targa e Mjetit transp. */
  vehicle?: string;
  /** Magazina. */
  warehouseName?: string;
  /** Marrësi. */
  receiver?: string;
  /** Serial number if available. */
  serialNo?: string;
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format a number with thousands separators and up to 2 decimals (en style: 1,234.56). */
export function fmtMoney(v: number | undefined | null): string {
  const n = Number(v || 0);
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format a quantity with up to 3 decimals (e.g. 10.000 / 1.5). */
export function fmtQty(v: number | undefined | null): string {
  const n = Number(v || 0);
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

/**
 * Convert a stored date ("YYYY-MM-DD") + time ("HH:mm" or "HH:mm:ss") into the
 * Albanian display format "dd/mm/yyyy HH:mm:ss".
 */
export function formatAlbDateTime(date: string | undefined, time?: string): string {
  const d = (date || "").trim();
  let datePart = d;
  // ISO YYYY-MM-DD -> dd/mm/yyyy
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (iso) {
    datePart = `${iso[3]}/${iso[2]}/${iso[1]}`;
  } else {
    // dd.mm.yyyy -> dd/mm/yyyy
    datePart = d.replace(/\./g, "/");
  }
  let timePart = (time || "").trim();
  if (timePart && /^\d{2}:\d{2}$/.test(timePart)) timePart = `${timePart}:00`;
  return timePart ? `${datePart} ${timePart}` : datePart;
}

/** Albanian payment-type label for the fiscal "Mënyra e pagesës" line. */
export function paymentLabel(doc: PrintableDoc): string {
  if (doc.paymentType && doc.paymentType.trim()) return doc.paymentType;
  if (doc.mode === "Me arke") return "Para në dorë";
  return "Me detyrim";
}

/**
 * VAT breakdown. With vatRate=0 the document is "Shitje pa TVSH" and net == total.
 * For vatRate>0 the total is treated as VAT-inclusive (gross), so:
 *   net = gross / (1 + rate/100), vat = gross - net.
 */
export function vatBreakdown(total: number, vatRate: number): { net: number; vat: number; gross: number } {
  const gross = Number(total || 0);
  if (!vatRate) return { net: gross, vat: 0, gross };
  const net = gross / (1 + vatRate / 100);
  return { net, vat: gross - net, gross };
}

// ---------------------------------------------------------------------------
// Converters: store records -> PrintableDoc
// ---------------------------------------------------------------------------

function lineFromItem(it: InvoiceItem, products: Product[]): PrintLine {
  const p = products.find((pr) => pr.name === it.productName);
  return {
    name: it.productName,
    code: p?.code,
    barcode: p?.barcode,
    qty: Number(it.qty || 0),
    unit: it.unit,
    rate: Number(it.rate || 0),
    total: Number(it.total || 0),
  };
}

export function invoiceToPrintable(inv: Invoice, company: Company, products: Product[] = []): PrintableDoc {
  return {
    docType: "sale",
    title: "FATURË TATIMORE",
    number: `${inv.no}`,
    date: inv.date,
    time: inv.time,
    partyLabel: "Klienti",
    partyName: inv.customer,
    mode: inv.mode,
    paymentType: inv.paymentType,
    operator: inv.salesmanName || inv.salesman,
    businessUnit: inv.store,
    lines: (inv.items || []).map((it) => lineFromItem(it, products)),
    subtotal: Number(inv.subtotal || 0),
    total: Number(inv.total || 0),
    paid: Number(inv.paid || 0),
    due: Number(inv.due || 0),
    change: Number(inv.change || 0),
    vatRate: 0,
    note: inv.note,
    nslf: (inv as any).nslf,
    nivf: (inv as any).nivf,
  };
}

export function purchaseToPrintable(p: Purchase, company: Company, products: Product[] = []): PrintableDoc {
  return {
    docType: "purchase",
    title: "FATURË BLERJE",
    number: `${p.no}`,
    date: p.date,
    time: p.time,
    partyLabel: "Furnitori",
    partyName: p.supplier,
    mode: p.mode,
    paymentType: p.paymentType,
    operator: (p as any).salesmanName || (p as any).salesman,
    businessUnit: p.store,
    lines: (p.items || []).map((it) => lineFromItem(it, products)),
    subtotal: Number(p.subtotal || 0),
    total: Number(p.total || 0),
    paid: Number(p.paid || 0),
    due: Number(p.due || 0),
    vatRate: 0,
    note: p.note,
    nslf: (p as any).nslf,
    nivf: (p as any).nivf,
  };
}

export function transferToPrintable(t: Transfer, _company: Company): PrintableDoc {
  return {
    docType: "transfer",
    title: "FLETË TRANSFERTE",
    number: t.transferNo,
    date: t.date,
    time: "",
    partyLabel: "",
    partyName: `${t.fromWarehouse} → ${t.toWarehouse}`,
    fromWarehouse: t.fromWarehouse,
    toWarehouse: t.toWarehouse,
    lines: [
      {
        name: t.product,
        qty: Number(t.qty || 0),
        unit: t.unit,
        rate: 0,
        total: 0,
      },
    ],
    subtotal: 0,
    total: 0,
    paid: 0,
    due: 0,
    vatRate: 0,
    note: t.note,
  };
}

/**
 * Convert a warehouse Fletë Dalje / Fletë Hyrje document to a printable doc
 * using the dedicated WAREHOUSE layout (bordered goods table + signatures,
 * NO QR / fiscal blocks). `kind` decides the title and party label.
 *
 * Each line carries the SELECTED unit, qty, coef, Sasia Copë (baseQty), the
 * price PER SELECTED UNIT (Çmimi) and Vlefta = qty × price — never mixing the
 * selected-unit quantity with the piece cost.
 */
export function warehouseDocToPrintable(
  doc: InboundDoc | OutboundDoc,
  kind: "inbound" | "outbound",
  _company?: Company,
): PrintableDoc {
  const isOut = kind === "outbound";
  const party = isOut ? doc.customerName : doc.supplierName;
  const lines: PrintLine[] = (doc.lines || []).map((l) => {
    const qty = Number(l.qty || 0);
    const coef = Number(l.coef || 1);
    const isGift = !!(l as any).isGift;
    // Çmimi = price per selected unit (prefer explicit price, fall back to cost).
    // Gift (DHURATË) lines always show price 0 / value 0.
    const price = isGift ? 0 : Number((l as any).price ?? l.cost ?? 0);
    const baseQty = Number(l.baseQty || qty * coef);
    // Vlefta = qty × price (selected unit). Fall back to stored value. Gift = 0.
    const value = isGift ? 0 : (l.value != null ? Number(l.value) : price * qty);
    return {
      // Gift lines are clearly labelled with the " - DHURATË" suffix.
      name: isGift ? `${l.productName} - DHURATË` : l.productName,
      qty,
      unit: l.unit,
      coef,
      baseQty,
      rate: price,
      total: value,
      costPiece: Number((l as any).costPiece || 0) || undefined,
      isGift: isGift || undefined,
    };
  });
  const total = lines.reduce((s, l) => s + Number(l.total || 0), 0);
  return {
    docType: "transfer",
    title: isOut ? "FLETË DALJE" : "FLETË HYRJE",
    number: doc.no,
    date: doc.date,
    time: "",
    partyLabel: isOut ? "Marrësi" : "Furnitori",
    partyName: party || "",
    partyAddress: doc.destinationAddress,
    businessUnit: doc.warehouse,
    lines,
    subtotal: total,
    total,
    paid: 0,
    due: 0,
    vatRate: 0,
    note: doc.note,
    warehouse: true,
    warehouseKind: kind,
    destinationAddress: doc.destinationAddress,
    warehouseName: doc.warehouse,
    receiver: isOut ? party || "" : "",
    serialNo: isOut ? doc.sourceInvoiceNo != null ? String(doc.sourceInvoiceNo) : undefined
                     : doc.supplierInvoiceNo || (doc.sourcePurchaseNo != null ? String(doc.sourcePurchaseNo) : undefined),
  };
}

// ---------------------------------------------------------------------------
// QR payload (Albanian fiscalization style: NSLF + NIVF)
// ---------------------------------------------------------------------------

/** Text encoded inside the QR code. Empty string when no fiscal codes exist. */
export function qrPayload(doc: PrintableDoc): string {
  const parts: string[] = [];
  if (doc.nivf) parts.push(`NIVF:${doc.nivf}`);
  if (doc.nslf) parts.push(`NSLF:${doc.nslf}`);
  if (!parts.length) {
    // Fallback so the preview still shows a scannable code identifying the doc.
    parts.push(`${doc.title} ${doc.number} ${doc.total ? fmtMoney(doc.total) : ""}`.trim());
  }
  return parts.join("|");
}

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

export function esc(s: string | number | undefined | null): string {
  if (s === undefined || s === null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// A4 template — full tax invoice (mirrors the easyPOS A4 layout)
// ---------------------------------------------------------------------------

function buildA4Html(doc: PrintableDoc, company: Company, qrSvg: string): string {
  const currency = company.currency || "ALL";
  const isTransfer = doc.docType === "transfer";
  const logo = company.logoUri
    ? `<img src="${esc(company.logoUri)}" style="width:64px;height:64px;object-fit:contain" />`
    : "";

  const itemRows = doc.lines
    .map((l) => {
      const idParts = [l.code, l.barcode].filter(Boolean).join(" / ");
      const nameCell = idParts ? `${esc(l.name)} / ${esc(idParts)}` : esc(l.name);
      const vb = vatBreakdown(l.total, doc.vatRate);
      return `<tr>
        <td>${nameCell}</td>
        <td class="r">${fmtMoney(l.rate)}</td>
        <td class="c">${fmtQty(l.qty)} / ${esc(l.unit)}</td>
        <td class="r">${fmtMoney(vb.net)}</td>
        <td class="r">${fmtMoney(vb.vat)}</td>
        <td class="r">${fmtMoney(l.total)}</td>
      </tr>`;
    })
    .join("");

  const totalVb = vatBreakdown(doc.total, doc.vatRate);
  const vatLabel = doc.vatRate ? `Shitje me TVSH ${doc.vatRate}%` : "Shitje pa TVSH";

  const detailsBlock = `
    <div class="section-title">DETAJE</div>
    <hr/>
    <table class="kv">
      <tr><td>Data: ${esc(formatAlbDateTime(doc.date, doc.time))}</td><td>${doc.operator ? "Operatori: " + esc(doc.operator) : ""}</td></tr>
      <tr><td>Numri i Faturës: ${esc(doc.number)}</td><td>${doc.businessUnit ? "Njësia e biznesit: " + esc(doc.businessUnit) : ""}</td></tr>
      <tr><td>${doc.date ? "Data efektive e TVSH-së: " + esc(formatAlbDateTime(doc.date, "")) : ""}</td><td>Valuta e Faturës: ${esc(currency)}</td></tr>
      <tr><td></td><td>Kursi: 1.00</td></tr>
    </table>`;

  const sellerBlock = `
    <hr/>
    <div class="party"><b>Shitësi:</b><br/>
      ${esc(company.name || "")}<br/>
      ${company.nipt ? esc(company.nipt) + "<br/>" : ""}
      ${company.address ? esc(company.address) + "<br/>" : ""}
      ${company.city ? esc(company.city) + ", ALB" : ""}
    </div>`;

  const partyBlock = !isTransfer && doc.partyName
    ? `<hr/><div class="party"><b>${esc(doc.partyLabel)}:</b><br/>
        ${esc(doc.partyName)}<br/>
        ${doc.partyNipt ? esc(doc.partyNipt) + "<br/>" : ""}
        ${doc.partyAddress ? esc(doc.partyAddress) : ""}
      </div>`
    : "";

  const transferBlock = isTransfer
    ? `<hr/><div class="party">
        <b>Nga magazina:</b> ${esc(doc.fromWarehouse || "")}<br/>
        <b>Te magazina:</b> ${esc(doc.toWarehouse || "")}
      </div>`
    : "";

  const itemsTable = `
    <div class="section-title">Artikujt</div>
    <table class="items">
      <thead><tr>
        <th>Emri / Kodi artikullit / Barkodi</th>
        <th class="r">Çmimi Për Njësi${doc.vatRate ? " (Me TVSH)" : ""}</th>
        <th class="c">Sasia / Njësia</th>
        <th class="r">Vlera pa TVSH</th>
        <th class="r">TVSH</th>
        <th class="r">Vlera me TVSH</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr class="totals-row">
        <td colspan="3" class="r"><b>TOTALI NË ${esc(currency)}</b></td>
        <td class="r"><b>${fmtMoney(totalVb.net)}</b></td>
        <td class="r"><b>${fmtMoney(totalVb.vat)}</b></td>
        <td class="r"><b>${fmtMoney(doc.total)}</b></td>
      </tr></tfoot>
    </table>`;

  const vatSection = !isTransfer
    ? `<div class="section-title">TVSH</div>
       <table class="items">
        <thead><tr><th>Nr i artikujve</th><th>%</th><th class="r">Vlera pa TVSH</th><th class="r">TVSH</th></tr></thead>
        <tbody><tr>
          <td>${doc.lines.length}</td>
          <td>${esc(vatLabel)}</td>
          <td class="r">${fmtMoney(totalVb.net)} ${esc(currency)}</td>
          <td class="r">${fmtMoney(totalVb.vat)} ${esc(currency)}</td>
        </tr></tbody>
       </table>`
    : "";

  const paymentSection = !isTransfer
    ? `<div class="section-title">Pagesa</div>
       <table class="items">
        <thead><tr><th>Tipi i Pagesës</th><th>Mënyra e Pagesës</th><th class="r">Shuma e Paguar</th></tr></thead>
        <tbody><tr>
          <td>${esc(doc.mode || "")}</td>
          <td>${esc(paymentLabel(doc))}</td>
          <td class="r">${fmtMoney(doc.paid || doc.total)} ${esc(currency)}</td>
        </tr></tbody>
       </table>
       <table class="grandtotal"><tr>
         <td class="r"><b>TOTALI</b></td>
         <td class="r grand"><b>${fmtMoney(doc.total)} ${esc(currency)}</b></td>
       </tr></table>`
    : "";

  const signatures = !isTransfer
    ? `<table class="sign"><tr>
         <td>______________________<br/>SHITËSI (Emër, Mbiemër, Firmë)</td>
         <td>______________________<br/>BLERËSI (Emër, Mbiemër, Firmë)</td>
         <td>______________________<br/>TRANSPORTUESI (Emër, Mbiemër, Firmë)</td>
       </tr></table>`
    : `<table class="sign"><tr>
         <td>______________________<br/>DORËZUESI (Emër, Mbiemër, Firmë)</td>
         <td>______________________<br/>MARRËSI (Emër, Mbiemër, Firmë)</td>
       </tr></table>`;

  const fiscalBlock = doc.nivf || doc.nslf || qrSvg
    ? `<div class="fiscal">
         <div class="qr">${qrSvg}</div>
         <div class="codes">
           ${doc.nivf ? `NIVF: ${esc(doc.nivf)}<br/>` : ""}
           ${doc.nslf ? `NSLF: ${esc(doc.nslf)}` : ""}
         </div>
       </div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; font-size: 11px; color:#111; margin:0; }
.head { display:flex; align-items:center; gap:14px; }
.head h1 { font-size:20px; font-weight:600; margin:0; flex:1; text-align:center; }
.section-title { font-size:15px; font-weight:700; margin:14px 0 2px; }
hr { border:0; border-top:1px solid #ccc; margin:4px 0; }
table { border-collapse:collapse; width:100%; }
.kv td { padding:1px 0; vertical-align:top; color:#333; width:50%; }
.party { color:#222; line-height:1.4; margin:4px 0; }
.items { margin-top:4px; }
.items th { text-align:left; border-bottom:2px solid #222; padding:5px 4px; font-weight:600; font-size:10px; }
.items td { padding:6px 4px; border-bottom:1px solid #eee; }
.items .r, th.r { text-align:right; }
.items .c, th.c { text-align:center; }
.totals-row td { border-top:2px solid #222; border-bottom:none; }
.grandtotal { margin-top:6px; }
.grandtotal td { padding:6px 4px; font-size:16px; }
.grandtotal .grand { font-size:18px; }
.sign { margin-top:28px; }
.sign td { text-align:center; font-size:9px; color:#555; padding:0 8px; vertical-align:top; }
.fiscal { margin-top:18px; text-align:right; }
.fiscal .qr { display:inline-block; width:180px; height:180px; }
.fiscal .codes { font-size:9px; color:#444; margin-top:4px; }
.footer { margin-top:14px; font-size:9px; color:#888; }
</style></head><body>
<div class="head">${logo}<h1>${esc(doc.title === "FATURË TATIMORE" ? "Faturë Tatimore" : doc.title)}</h1><div style="width:64px"></div></div>
${detailsBlock}
${sellerBlock}
${partyBlock}
${transferBlock}
${itemsTable}
${vatSection}
${paymentSection}
${doc.note ? `<div style="margin-top:8px">${esc(doc.note)}</div>` : ""}
${signatures}
${fiscalBlock}
<div class="footer">Gjeneruar nga ${esc(company.name || "Sistemi Genit")}</div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Thermal template — 58 / 80 / 110 mm receipts
// ---------------------------------------------------------------------------

function buildThermalHtml(doc: PrintableDoc, company: Company, paper: PaperSize, qrSvg: string): string {
  const currency = company.currency || "LEK";
  const isTransfer = doc.docType === "transfer";
  const widthMm = paper === "58" ? 58 : paper === "80" ? 80 : 110;
  // Font scales up slightly with paper width.
  const baseFs = paper === "58" ? 10 : paper === "80" ? 12 : 13;
  const titleFs = paper === "58" ? 15 : paper === "80" ? 19 : 21;

  const itemRows = doc.lines
    .map((l) => {
      const right = isTransfer ? "" : fmtMoney(l.total);
      const qtyLine = isTransfer
        ? `${fmtQty(l.qty)} ${esc(l.unit)}`
        : `${fmtQty(l.qty)} ${esc(l.unit)} × ${fmtMoney(l.rate)}`;
      return `<div class="item">
        <div class="iname">${esc(l.name)}</div>
        <div class="iline"><span>${qtyLine}</span><span class="r">${right}</span></div>
      </div>`;
    })
    .join("");

  const kv = (k: string, v: string) => `<div class="kv"><span>${esc(k)}</span><span class="r">${esc(v)}</span></div>`;

  const totalVb = vatBreakdown(doc.total, doc.vatRate);

  const totalsBlock = !isTransfer
    ? `<div class="hr"></div>
       <div class="total"><span>TOTAL ${esc(currency)}</span><span class="r">${fmtMoney(doc.total)}</span></div>
       ${kv(paymentLabel(doc), fmtMoney(doc.paid || doc.total))}
       ${doc.due > 0 ? kv("Detyrim", fmtMoney(doc.due)) : ""}
       ${doc.change ? kv("Kusuri", fmtMoney(doc.change)) : ""}
       <div class="hr"></div>
       ${doc.vatRate
          ? kv(`Pa TVSH ${doc.vatRate}%`, fmtMoney(totalVb.net)) + kv(`TVSH ${doc.vatRate}%`, fmtMoney(totalVb.vat))
          : `<div class="kv"><span>Shitje pa TVSH</span><span class="r">${fmtMoney(doc.total)}</span></div>`}`
    : `<div class="hr"></div>
       <div class="kv"><span>Nga</span><span class="r">${esc(doc.fromWarehouse || "")}</span></div>
       <div class="kv"><span>Te</span><span class="r">${esc(doc.toWarehouse || "")}</span></div>`;

  const fiscalBlock = (doc.nslf || doc.nivf || qrSvg)
    ? `<div class="hr"></div>
       ${doc.nslf ? `<div class="code"><div class="clabel">NSLF</div>${esc(doc.nslf)}</div>` : ""}
       ${doc.nivf ? `<div class="code"><div class="clabel">NIVF</div>${esc(doc.nivf)}</div>` : ""}
       ${qrSvg ? `<div class="qr">${qrSvg}</div>` : ""}`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
@page { size: ${widthMm}mm auto; margin: 3mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; font-size:${baseFs}px; color:#000; margin:0; width:${widthMm - 6}mm; }
.center { text-align:center; }
h1 { font-size:${titleFs}px; font-weight:800; margin:0; text-align:center; }
.sub { text-align:center; font-weight:700; margin:2px 0; }
.addr { text-align:center; margin:2px 0 6px; }
.hr { border-top:1px solid #000; margin:6px 0; }
.kv { display:flex; justify-content:space-between; font-weight:700; margin:2px 0; }
.kv .r, .iline .r { text-align:right; }
.item { margin:5px 0; }
.iname { font-weight:600; }
.iline { display:flex; justify-content:space-between; }
.total { display:flex; justify-content:space-between; font-size:${titleFs - 2}px; font-weight:800; margin:4px 0; }
.code { text-align:center; word-break:break-all; margin:4px 0; font-size:${baseFs - 1}px; }
.clabel { font-weight:800; }
.qr { text-align:center; margin:8px auto 0; width:${paper === "58" ? 120 : paper === "80" ? 150 : 180}px; }
</style></head><body>
<h1>${esc(doc.title === "FATURË TATIMORE" ? "FATURË TATIMORE" : doc.title)}</h1>
<div class="sub">${esc(company.name || "")}</div>
${company.address ? `<div class="addr">${esc(company.address)}${company.city ? "<br/>" + esc(company.city) : ""}</div>` : ""}
<div class="hr"></div>
${company.nipt ? kv("NIPT:", company.nipt) : ""}
${kv("Data/Ora:", formatAlbDateTime(doc.date, doc.time))}
${kv(isTransfer ? "Transferta Nr:" : "Fatura Nr:", doc.number)}
${doc.operator ? kv("Operatori:", doc.operator) : ""}
${doc.businessUnit ? kv("Njësia:", doc.businessUnit) : ""}
${!isTransfer && doc.partyName ? kv(doc.partyLabel + ":", doc.partyName) : ""}
${!isTransfer ? kv("Mënyra e pagesës:", paymentLabel(doc)) : ""}
<div class="hr"></div>
${itemRows}
${totalsBlock}
${doc.note ? `<div class="hr"></div><div class="center">${esc(doc.note)}</div>` : ""}
${fiscalBlock}
</body></html>`;
}

// ---------------------------------------------------------------------------
// Warehouse document template — FLETË DALJE / FLETË HYRJE
// A bordered goods table matching the warehouse-document screenshot. No QR,
// no fiscal blocks, no VAT columns. Columns:
//   Nr | Emërtimi i mallit | Njësia | Sasia | Koef | Sasia Copë | Çmimi | Vlefta
// ---------------------------------------------------------------------------

/** The 8 fixed columns of the warehouse goods table (also used by the XLSX export). */
export const WAREHOUSE_DOC_COLUMNS = [
  "Nr",
  "Emërtimi i mallit",
  "Njësia",
  "Sasia",
  "Koef",
  "Sasia Copë",
  "Çmimi",
  "Vlefta",
] as const;

function buildWarehouseDocHtml(doc: PrintableDoc, company: Company, paper: PaperSize): string {
  const wide = paper === "A4" || paper === "110";
  const pageCss = paper === "A4" ? "@page { size: A4; margin: 12mm; }" : `@page { size: ${paper === "58" ? 58 : paper === "80" ? 80 : 110}mm auto; margin: 4mm; }`;
  const baseFs = paper === "A4" ? 11 : paper === "58" ? 8 : paper === "80" ? 9 : 10;

  const rows = doc.lines
    .map((l, i) => {
      return `<tr>
        <td class="c">${i + 1}</td>
        <td>${esc(l.name)}</td>
        <td class="c">${esc(l.unit)}</td>
        <td class="r">${fmtQty(l.qty)}</td>
        <td class="c">${fmtQty(l.coef ?? 1)}</td>
        <td class="r">${fmtQty(l.baseQty ?? l.qty * (l.coef ?? 1))}</td>
        <td class="r">${fmtMoney(l.rate)}</td>
        <td class="r">${fmtMoney(l.total)}</td>
      </tr>`;
    })
    .join("");

  // Header field grid (label : value). Empty values still render the label box.
  const hf = (label: string, value?: string) =>
    `<div class="hf"><span class="hl">${esc(label)}</span><span class="hv">${esc(value || "")}</span></div>`;

  const headerGrid = `
    <div class="hgrid">
      ${hf("Nr. / Dokumenti", doc.number)}
      ${hf("Dt. / Data", formatAlbDateTime(doc.date, doc.time))}
      ${hf("Magazina", doc.warehouseName || doc.businessUnit)}
      ${hf("Adresa ku shkon malli", doc.destinationAddress || doc.partyAddress)}
      ${hf(doc.warehouseKind === "inbound" ? "Furnitori" : "Marrësi", doc.receiver || doc.partyName)}
      ${hf("Emri, mbiemri pers. Autorizuar", doc.authorizedPerson)}
      ${hf("Lloji e targa e Mjetit transp.", doc.vehicle)}
      ${hf("Seria / Nr. references", doc.serialNo)}
    </div>`;

  // Fletë Hyrje adds "Dorëzuesi"; Fletë Dalje does not.
  const sigRoles = doc.warehouseKind === "inbound"
    ? ["Magazinieri", "Dorëzuesi", "Marrësi në dorëzim", "Transportuesi", "Llogaritari"]
    : ["Magazinieri", "Marrësi në dorëzim", "Transportuesi", "Llogaritari"];
  const signatures = `
    <div class="signs">
      ${sigRoles
        .map(
          (s) =>
            `<div class="sg"><div class="srole">${esc(s)}</div><div class="sline"></div><div class="ssub">Emri, mbiemri / Nënshkrimi</div></div>`,
        )
        .join("")}
    </div>`;

  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
${pageCss}
* { box-sizing: border-box; }
body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; font-size:${baseFs}px; color:#000; margin:0; }
.title { text-align:center; font-size:${wide ? 22 : 15}px; font-weight:800; letter-spacing:1px; margin:0 0 2px; }
.company { text-align:center; font-size:${baseFs + 2}px; font-weight:700; }
.company .addr { font-weight:400; font-size:${baseFs}px; color:#222; }
.hgrid { display:grid; grid-template-columns:${wide ? "1fr 1fr" : "1fr"}; gap:0; border:1px solid #000; margin-top:8px; }
.hf { display:flex; border-bottom:1px solid #000; }
.hgrid .hf:nth-child(odd) { ${wide ? "border-right:1px solid #000;" : ""} }
.hf:last-child, .hf:nth-last-child(2):nth-child(odd) { }
.hl { flex:0 0 ${wide ? "46%" : "52%"}; padding:3px 5px; font-weight:700; background:#f0f0f0; border-right:1px solid #000; }
.hv { flex:1; padding:3px 5px; }
table.goods { border-collapse:collapse; width:100%; margin-top:8px; }
table.goods th, table.goods td { border:1px solid #000; padding:${wide ? "5px 6px" : "3px 4px"}; }
table.goods th { background:#e8e8e8; font-weight:700; font-size:${baseFs}px; text-align:center; }
table.goods td.c { text-align:center; }
table.goods td.r { text-align:right; }
.totrow td { font-weight:800; background:#f0f0f0; }
.signs { display:flex; justify-content:space-between; gap:8px; margin-top:40px; }
.sg { flex:1; text-align:center; font-size:${baseFs}px; }
.sg .srole { font-weight:700; margin-bottom:22px; }
.sline { border-top:1px solid #000; margin:0 4px 3px; height:1px; }
.sg .ssub { font-size:${Math.max(7, baseFs - 2)}px; color:#444; }
.note { margin-top:8px; font-size:${baseFs}px; }
</style></head><body>
<div class="title">${esc(doc.title)}</div>
<div class="company">${esc(company.name || "")}${company.address ? `<div class="addr">${esc(company.address)}${company.city ? ", " + esc(company.city) : ""}</div>` : ""}</div>
${headerGrid}
<table class="goods">
  <thead><tr>
    <th style="width:5%">Nr</th>
    <th style="width:32%">Emërtimi i mallit</th>
    <th style="width:9%">Njësia</th>
    <th style="width:9%">Sasia</th>
    <th style="width:8%">Koef</th>
    <th style="width:11%">Sasia Copë</th>
    <th style="width:12%">Çmimi</th>
    <th style="width:14%">Vlefta</th>
  </tr></thead>
  <tbody>
    ${rows}
    <tr class="totrow">
      <td colspan="5" class="r">TOTALI</td>
      <td class="r">${fmtQty(doc.lines.reduce((s, l) => s + Number(l.baseQty ?? l.qty * (l.coef ?? 1)), 0))}</td>
      <td></td>
      <td class="r">${fmtMoney(doc.total)}</td>
    </tr>
  </tbody>
</table>
${doc.note ? `<div class="note"><b>Shënim:</b> ${esc(doc.note)}</div>` : ""}
${signatures}
</body></html>`;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Build the full printable HTML for a document at the given paper size.
 * `qrSvg` is an inline <svg> string (may be empty if QR generation failed).
 * Warehouse documents (Fletë Dalje / Hyrje) always use the bordered warehouse
 * layout regardless of paper size — never the fiscal/QR invoice layout.
 */
export function buildDocHtml(
  doc: PrintableDoc,
  company: Company,
  paper: PaperSize,
  qrSvg = "",
): string {
  if (doc.warehouse) return buildWarehouseDocHtml(doc, company, paper);
  if (paper === "A4") return buildA4Html(doc, company, qrSvg);
  return buildThermalHtml(doc, company, paper, qrSvg);
}
