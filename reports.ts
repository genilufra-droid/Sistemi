/**
 * Sistemi Genit — Report engine.
 *
 * Mirrors V32_REPORT_TYPES in the original SistemiVerfin.html. Each report
 * takes the DB and a filter set and returns a deterministic shape:
 *   { title, subtitle?, columns, rows, summary?, groups? }
 *
 * The Reports screen renders these to the UI and to an HTML document for
 * PDF print/share via expo-print.
 */
import type { DB, Invoice, Purchase } from "./store";
import { num, fmt, partyDue, supplierDue, unitCoef, stockInStore, totalStock, todayStr } from "./store";

export type ReportType =
  | "salesSummary"
  | "salesAnalytic"
  | "salesSummaryInvoice"
  | "salesByProduct"
  | "salesByClient"
  | "salesByUnit"
  | "salesDaily"
  | "salesInvoiceBatch"
  | "faturaTeresot"
  | "shitjeSot"
  | "kerkeseFurnizimi"
  | "managerProfitItem"
  | "managerProfitInvoice"
  | "purchaseAnalytic"
  | "purchaseBySupplier"
  | "purchaseByProduct"
  | "purchaseDaily"
  | "purchaseInvoiceBatch"
  | "itemCard"
  | "stockByCompany"
  | "stockByWarehouse"
  | "transferReport"
  | "stockMovement"
  | "inboundDocsReport"
  | "outboundDocsReport"
  | "inventoryDocsReport"
  | "stockSummary"
  | "supplyNeed"
  | "purchaseSuggestion"
  | "managerTopProducts"
  | "managerTopClients"
  | "managerMarginByClient"
  | "managerDailyProfit"
  | "managerSalesVsPurchases"
  | "managerInventoryValue"
  | "managerSlowMovingStock"
  | "managerWarehouseTurnover"
  | "supplierBalances"
  | "clientBalances"
  | "supplierLedger"
  | "clientLedger"
  | "unpaidInvoices"
  | "clientSalesHistoryAnalytic"
  | "clientBillingPayments"
  | "supplierBillingPayments"
  | "warehouseStockAsOf"
  | "itemAnalysis"
  | "expenseSummary"
  | "expenseByCategory"
  | "expenseByMonth"
  | "locationReport"
  | "salesmanSummary"
  | "salesmanActivity";

export type ReportFilter = {
  client?: string;
  supplier?: string;
  product?: string;
  store?: string;
  unit?: string;
  from?: string;
  to?: string;
  /** Multi-select variants. When non-empty, they take precedence over the single value above. */
  clients?: string[];
  suppliers?: string[];
  products?: string[];
  stores?: string[];
  units?: string[];
  /** Transaction type: all | cash (Me arke) | credit (Me detyrim). */
  txnType?: "all" | "cash" | "credit";
  /** Payment status: all | paid | partial | unpaid. */
  payStatus?: "all" | "paid" | "partial" | "unpaid";
  /** Salesman filter (single substring + multi exact). */
  salesman?: string;
  salesmen?: string[];
  /** Product category filter (single substring + multi exact). */
  category?: string;
  categories?: string[];
};

/** Payment status of a transaction from its total/paid. */
function payStatusOf(total: number, paid: number): "paid" | "partial" | "unpaid" {
  if (paid >= total - 0.001) return "paid";
  if (paid <= 0.001) return "unpaid";
  return "partial";
}
function passTxnType(mode: string, f: ReportFilter): boolean {
  if (!f.txnType || f.txnType === "all") return true;
  const isCash = mode === "Me arke";
  return f.txnType === "cash" ? isCash : !isCash;
}
function passPayStatus(total: number, paid: number, f: ReportFilter): boolean {
  if (!f.payStatus || f.payStatus === "all") return true;
  return payStatusOf(total, paid) === f.payStatus;
}

/** True if `value` matches the multi-select list (case-insensitive exact) or, when the list is empty, the single substring filter. */
function normKey(s: string | undefined): string {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function inMulti(value: string | undefined, list: string[] | undefined, single?: string): boolean {
  const v = normKey(value);
  if (list && list.length) return list.some((x) => normKey(x) === v);
  if (single && single.trim()) return v.includes(normKey(single));
  return true;
}
/** True if the document's salesman matches the salesman filter (multi exact or single substring). */
function passSalesman(doc: { salesman?: string; salesmanName?: string }, f: ReportFilter): boolean {
  if ((!f.salesmen || !f.salesmen.length) && (!f.salesman || !f.salesman.trim())) return true;
  const name = doc.salesmanName || doc.salesman || "";
  return inMulti(name, f.salesmen, f.salesman);
}

export type Column = { key: string; label: string; align?: "left" | "right" | "center"; format?: "money" | "qty" | "pct" | "text" };
export type Row = Record<string, string | number>;
export type ReportResult = {
  type: ReportType;
  title: string;
  subtitle?: string;
  columns: Column[];
  rows: Row[];
  summary?: { label: string; value: string }[];
  emptyMessage?: string;
};

export const REPORT_CATALOG: { value: ReportType; label: string; group: string }[] = [
  { value: "salesSummary", label: "Regjistri Përmbledhës i Shitjeve", group: "Shitje" },
  { value: "salesAnalytic", label: "Regjistri Analitik i Shitjeve", group: "Shitje" },
  { value: "salesSummaryInvoice", label: "Faturë përmbledhëse shitje", group: "Shitje" },
  { value: "salesByProduct", label: "Shitje sipas artikullit", group: "Shitje" },
  { value: "salesByClient", label: "Shitje sipas klientit", group: "Shitje" },
  { value: "salesByUnit", label: "Shitje sipas njësisë", group: "Shitje" },
  { value: "salesDaily", label: "Shitje ditore", group: "Shitje" },
  { value: "salesInvoiceBatch", label: "Fatura shitje të renditura", group: "Shitje" },
  { value: "faturaTeresot", label: "Fatura Totale Sot", group: "Shitje" },
  { value: "shitjeSot", label: "Shitje Sot", group: "Shitje" },
  { value: "kerkeseFurnizimi", label: "Kërkesë Furnizimi", group: "Stoku" },
  { value: "purchaseAnalytic", label: "Regjistri Analitik i Blerjeve", group: "Blerje" },
  { value: "purchaseBySupplier", label: "Blerje sipas furnitorit", group: "Blerje" },
  { value: "purchaseByProduct", label: "Blerje sipas artikullit", group: "Blerje" },
  { value: "purchaseDaily", label: "Blerje ditore", group: "Blerje" },
  { value: "purchaseInvoiceBatch", label: "Fatura blerje të renditura", group: "Blerje" },
  { value: "itemCard", label: "Kartela e Artikullit", group: "Stoku" },
  { value: "stockByCompany", label: "Gjendja sipas kompanisë", group: "Stoku" },
  { value: "stockByWarehouse", label: "Gjendja sipas magazinave", group: "Stoku" },
  { value: "transferReport", label: "Transferimet mes magazinave", group: "Stoku" },
  { value: "stockMovement", label: "Lëvizjet e magazinës", group: "Stoku" },
  { value: "inboundDocsReport", label: "Raporti Fletë Hyrje", group: "Stoku" },
  { value: "outboundDocsReport", label: "Raporti Fletë Dalje", group: "Stoku" },
  { value: "inventoryDocsReport", label: "Raporti Inventar Fizik", group: "Stoku" },
  { value: "stockSummary", label: "Gjendja aktuale e stokut", group: "Stoku" },
  { value: "supplyNeed", label: "Kërkesë furnizimi (stok minimal)", group: "Stoku" },
  { value: "purchaseSuggestion", label: "Kërkesë furnizimi (sipas shitjes)", group: "Stoku" },
  { value: "warehouseStockAsOf", label: "Gjendje magazine datë", group: "Stoku" },
  { value: "itemAnalysis", label: "Analizë artikulli", group: "Stoku" },
  { value: "managerProfitItem", label: "Fitimi për artikull", group: "Manaxher" },
  { value: "managerProfitInvoice", label: "Fitimi për faturë", group: "Manaxher" },
  { value: "managerTopProducts", label: "Top artikujt sipas shitjes", group: "Manaxher" },
  { value: "managerTopClients", label: "Top klientët sipas shitjes", group: "Manaxher" },
  { value: "managerMarginByClient", label: "Marzhi sipas klientit", group: "Manaxher" },
  { value: "managerDailyProfit", label: "Fitimi ditor", group: "Manaxher" },
  { value: "managerSalesVsPurchases", label: "Krahasim shitje vs blerje", group: "Manaxher" },
  { value: "managerInventoryValue", label: "Vlera e inventarit", group: "Manaxher" },
  { value: "managerSlowMovingStock", label: "Artikuj pa lëvizje", group: "Manaxher" },
  { value: "managerWarehouseTurnover", label: "Qarkullimi sipas magazinës", group: "Manaxher" },
  { value: "supplierBalances", label: "Detyrime sipas furnitorëve", group: "Detyrime" },
  { value: "clientBalances", label: "Detyrime sipas klientëve", group: "Detyrime" },
  { value: "supplierLedger", label: "Kartela furnitorit", group: "Detyrime" },
  { value: "clientLedger", label: "Kartela klientit", group: "Detyrime" },
  { value: "unpaidInvoices", label: "Fatura pa paguara", group: "Detyrime" },
  { value: "clientSalesHistoryAnalytic", label: "Historik shitjesh klientit analitik", group: "Detyrime" },
  { value: "clientBillingPayments", label: "Faturime pagesa klientit", group: "Detyrime" },
  { value: "supplierBillingPayments", label: "Faturime pagesa furnitorit", group: "Detyrime" },
  { value: "expenseSummary", label: "Përmbledhje shpenzimesh", group: "Shpenzime" },
  { value: "expenseByCategory", label: "Shpenzime sipas kategorisë", group: "Shpenzime" },
  { value: "expenseByMonth", label: "Shpenzime sipas muajit", group: "Shpenzime" },
  { value: "locationReport", label: "Raporti i vendndodhjes (GPS)", group: "Shitës / GPS" },
  { value: "salesmanSummary", label: "Përmbledhje sipas shitësit", group: "Shitës / GPS" },
  { value: "salesmanActivity", label: "Aktiviteti / Itinerari i shitësit", group: "Shitës / GPS" },
];

/** Return any report `value` that appears more than once in the catalog. */
export function reportCatalogDuplicates(): ReportType[] {
  const seen = new Set<ReportType>();
  const dups = new Set<ReportType>();
  for (const r of REPORT_CATALOG) {
    if (seen.has(r.value)) dups.add(r.value);
    seen.add(r.value);
  }
  return Array.from(dups);
}

/** Stable lookup of a catalog entry by its report `value` (never by index). */
export function findReport(value: string | undefined): { value: ReportType; label: string; group: string } | undefined {
  return REPORT_CATALOG.find((r) => r.value === value);
}

// Fail-fast in development if two reports ever share the same value, which would
// make navigation/exports open the wrong report.
const _reportDuplicates = reportCatalogDuplicates();
if (_reportDuplicates.length > 0) {
  // eslint-disable-next-line no-console
  console.error("CRITICAL: Duplicate report values found:", _reportDuplicates);
}

// ---------- helpers ----------
function dateOK(date: string, from?: string, to?: string) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}
function matches(haystack: string | undefined, needle?: string) {
  if (!needle) return true;
  return String(haystack || "").toLowerCase().includes(needle.toLowerCase());
}
function filteredInvoices(db: DB, f: ReportFilter): Invoice[] {
  return db.invoices
    .filter((i) => dateOK(i.date, f.from, f.to))
    .filter((i) => inMulti(i.customer, f.clients, f.client))
    .filter((i) => inMulti(i.store, f.stores, f.store))
    .filter((i) => passTxnType(i.mode, f))
    .filter((i) => passPayStatus(i.total, i.paid, f))
    .filter((i) => passSalesman(i, f));
}
function filteredPurchases(db: DB, f: ReportFilter): Purchase[] {
  return db.purchases
    .filter((p) => dateOK(p.date, f.from, f.to))
    .filter((p) => inMulti(p.supplier, f.suppliers, f.supplier))
    .filter((p) => inMulti(p.store, f.stores, f.store))
    .filter((p) => passTxnType(p.mode, f))
    .filter((p) => passPayStatus(p.total, p.paid, f))
    .filter((p) => passSalesman(p, f));
}
/** True if a line item passes the product + unit + category filters (multi or single). */
function itemOK(it: { productName: string; unit: string }, f: ReportFilter, db?: DB): boolean {
  const prodOK = f.products && f.products.length
    ? f.products.some((x) => normKey(x) === normKey(it.productName))
    : (!f.product || !f.product.trim() || normKey(it.productName).includes(normKey(f.product)));
  const unitOK = f.units && f.units.length
    ? f.units.some((x) => normKey(x) === normKey(it.unit))
    : (!f.unit || !f.unit.trim() || normKey(it.unit) === normKey(f.unit));
  const catOK = passCategory(it.productName, f, db);
  return prodOK && unitOK && catOK;
}
/** True if the product's category matches the category filter (needs db to resolve category by name). */
function passCategory(productName: string, f: ReportFilter, db?: DB): boolean {
  if ((!f.categories || !f.categories.length) && (!f.category || !f.category.trim())) return true;
  if (!db) return true;
  const prod = db.products.find((p) => normKey(p.name) === normKey(productName));
  return inMulti(prod?.category, f.categories, f.category);
}
function periodLabel(f: ReportFilter): string {
  const a = f.from || "fillimi";
  const b = f.to || "sot";
  return `Periudha: ${a} → ${b}`;
}

type AnalyticLine = {
  date: string;
  no: number;
  party: string;
  store: string;
  product: string;
  unit: string;
  qty: number;
  free: number;
  rate: number;
  buyRate: number;
  value: number;
  cost: number;
  profit: number;
};

function salesLines(db: DB, f: ReportFilter): AnalyticLine[] {
  const out: AnalyticLine[] = [];
  filteredInvoices(db, f).forEach((inv) => {
    inv.items.forEach((it) => {
      if (!itemOK(it, f, db)) return;
      out.push({
        date: inv.date,
        no: inv.no,
        party: inv.customer,
        store: inv.store || "",
        product: it.productName,
        unit: it.unit,
        qty: num(it.qty),
        free: num(it.freeQty),
        rate: num(it.rate),
        buyRate: num(it.buyRate),
        value: num(it.total),
        cost: num(it.cost),
        profit: num(it.total) - num(it.cost),
      });
    });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.no - b.no);
}

function purchaseLines(db: DB, f: ReportFilter): AnalyticLine[] {
  const out: AnalyticLine[] = [];
  filteredPurchases(db, f).forEach((p) => {
    p.items.forEach((it) => {
      if (!itemOK(it, f, db)) return;
      out.push({
        date: p.date,
        no: p.no,
        party: p.supplier,
        store: p.store || "",
        product: it.productName,
        unit: it.unit,
        qty: num(it.qty),
        free: num(it.freeQty),
        rate: num(it.rate),
        buyRate: num(it.buyRate),
        value: num(it.total),
        cost: num(it.cost),
        profit: 0,
      });
    });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.no - b.no);
}

// ---------- builder ----------
export function buildReport(type: ReportType, db: DB, f: ReportFilter): ReportResult {
  const sub = periodLabel(f);
  switch (type) {
    case "salesSummary": {
      const invs = filteredInvoices(db, f);
      const total = invs.reduce((s, i) => s + num(i.total), 0);
      const paid = invs.reduce((s, i) => s + num(i.paid), 0);
      const due = invs.reduce((s, i) => s + num(i.due), 0);
      const profit = invs.reduce((s, i) => s + num(i.profit), 0);
      return {
        type,
        title: "Regjistri Përmbledhës i Shitjeve",
        subtitle: sub,
        columns: [
          { key: "no", label: "Nr." },
          { key: "date", label: "Data" },
          { key: "customer", label: "Klienti" },
          { key: "total", label: "Totali", align: "right", format: "money" },
          { key: "paid", label: "Paguar", align: "right", format: "money" },
          { key: "due", label: "Detyrim", align: "right", format: "money" },
          { key: "profit", label: "Fitim", align: "right", format: "money" },
        ],
        rows: invs.map((i) => ({
          no: i.no,
          date: i.date,
          customer: i.customer,
          total: i.total,
          paid: i.paid,
          due: i.due,
          profit: i.profit,
        })),
        summary: [
          { label: "Fatura", value: String(invs.length) },
          { label: "Vlerë shitje", value: fmt(total) },
          { label: "Paguar", value: fmt(paid) },
          { label: "Detyrim", value: fmt(due) },
          { label: "Fitim", value: fmt(profit) },
        ],
      };
    }
    case "salesAnalytic": {
      const lines = salesLines(db, f);
      return {
        type,
        title: "Regjistri Analitik i Shitjeve",
        subtitle: sub,
        columns: [
          { key: "date", label: "Data" },
          { key: "no", label: "Nr." },
          { key: "party", label: "Klienti" },
          { key: "product", label: "Artikulli" },
          { key: "unit", label: "Njësia" },
          { key: "qty", label: "Sasia", align: "right", format: "qty" },
          { key: "rate", label: "Çmimi", align: "right", format: "money" },
          { key: "value", label: "Vlera", align: "right", format: "money" },
          { key: "profit", label: "Fitim", align: "right", format: "money" },
        ],
        rows: lines as any,
        summary: [
          { label: "Rreshta", value: String(lines.length) },
          { label: "Vlerë", value: fmt(lines.reduce((s, l) => s + l.value, 0)) },
          { label: "Fitim", value: fmt(lines.reduce((s, l) => s + l.profit, 0)) },
        ],
      };
    }
    case "salesSummaryInvoice": {
      const invs = filteredInvoices(db, f);
      const map = new Map<string, { date: string; party: string; total: number; profit: number }>();
      invs.forEach((i) => {
        const k = `${i.date}|${i.customer}`;
        const cur = map.get(k) || { date: i.date, party: i.customer, total: 0, profit: 0 };
        cur.total += num(i.total);
        cur.profit += num(i.profit);
        map.set(k, cur);
      });
      const rows = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
      return {
        type,
        title: "Faturë përmbledhëse shitje",
        subtitle: sub,
        columns: [
          { key: "date", label: "Data" },
          { key: "party", label: "Klienti" },
          { key: "total", label: "Totali", align: "right", format: "money" },
          { key: "profit", label: "Fitim", align: "right", format: "money" },
        ],
        rows: rows as any,
        summary: [
          { label: "Vlerë", value: fmt(rows.reduce((s, r) => s + r.total, 0)) },
          { label: "Fitim", value: fmt(rows.reduce((s, r) => s + r.profit, 0)) },
        ],
      };
    }
    case "salesByProduct": {
      const lines = salesLines(db, f);
      const map = new Map<string, { product: string; unit: string; qty: number; value: number; cost: number; profit: number }>();
      lines.forEach((l) => {
        const k = `${l.product}|${l.unit}`;
        const cur = map.get(k) || { product: l.product, unit: l.unit, qty: 0, value: 0, cost: 0, profit: 0 };
        cur.qty += l.qty;
        cur.value += l.value;
        cur.cost += l.cost;
        cur.profit += l.profit;
        map.set(k, cur);
      });
      const rows = [...map.values()].sort((a, b) => b.value - a.value);
      return {
        type,
        title: "Shitje sipas artikullit",
        subtitle: sub,
        columns: [
          { key: "product", label: "Artikulli" },
          { key: "unit", label: "Njësia" },
          { key: "qty", label: "Sasia", align: "right", format: "qty" },
          { key: "value", label: "Vlerë", align: "right", format: "money" },
          { key: "cost", label: "Kosto", align: "right", format: "money" },
          { key: "profit", label: "Fitim", align: "right", format: "money" },
        ],
        rows: rows as any,
        summary: [
          { label: "Vlerë", value: fmt(rows.reduce((s, r) => s + r.value, 0)) },
          { label: "Fitim", value: fmt(rows.reduce((s, r) => s + r.profit, 0)) },
        ],
      };
    }
    case "salesByClient": {
      const invs = filteredInvoices(db, f);
      const map = new Map<string, { party: string; count: number; total: number; profit: number; due: number }>();
      invs.forEach((i) => {
        const cur = map.get(i.customer) || { party: i.customer, count: 0, total: 0, profit: 0, due: 0 };
        cur.count += 1;
        cur.total += num(i.total);
        cur.profit += num(i.profit);
        cur.due += num(i.due);
        map.set(i.customer, cur);
      });
      const rows = [...map.values()].sort((a, b) => b.total - a.total);
      return {
        type,
        title: "Shitje sipas klientit",
        subtitle: sub,
        columns: [
          { key: "party", label: "Klienti" },
          { key: "count", label: "Fatura", align: "right", format: "qty" },
          { key: "total", label: "Totali", align: "right", format: "money" },
          { key: "profit", label: "Fitim", align: "right", format: "money" },
          { key: "due", label: "Detyrim", align: "right", format: "money" },
        ],
        rows: rows as any,
        summary: [{ label: "Total", value: fmt(rows.reduce((s, r) => s + r.total, 0)) }],
      };
    }
    case "salesByUnit": {
      const lines = salesLines(db, f);
      const map = new Map<string, { unit: string; qty: number; value: number }>();
      lines.forEach((l) => {
        const cur = map.get(l.unit) || { unit: l.unit, qty: 0, value: 0 };
        cur.qty += l.qty;
        cur.value += l.value;
        map.set(l.unit, cur);
      });
      return {
        type,
        title: "Shitje sipas njësisë",
        subtitle: sub,
        columns: [
          { key: "unit", label: "Njësia" },
          { key: "qty", label: "Sasia", align: "right", format: "qty" },
          { key: "value", label: "Vlerë", align: "right", format: "money" },
        ],
        rows: [...map.values()] as any,
      };
    }
    case "salesDaily": {
      const invs = filteredInvoices(db, f);
      const map = new Map<string, { date: string; count: number; total: number; profit: number }>();
      invs.forEach((i) => {
        const cur = map.get(i.date) || { date: i.date, count: 0, total: 0, profit: 0 };
        cur.count += 1;
        cur.total += num(i.total);
        cur.profit += num(i.profit);
        map.set(i.date, cur);
      });
      const rows = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
      return {
        type,
        title: "Shitje ditore",
        subtitle: sub,
        columns: [
          { key: "date", label: "Data" },
          { key: "count", label: "Fatura", align: "right", format: "qty" },
          { key: "total", label: "Totali", align: "right", format: "money" },
          { key: "profit", label: "Fitim", align: "right", format: "money" },
        ],
        rows: rows as any,
      };
    }
    case "salesInvoiceBatch": {
      const invs = filteredInvoices(db, f).sort((a, b) => a.no - b.no);
      return {
        type,
        title: "Fatura shitje të renditura",
        subtitle: sub,
        columns: [
          { key: "no", label: "Nr." },
          { key: "date", label: "Data" },
          { key: "customer", label: "Klienti" },
          { key: "items", label: "Rreshta", align: "right", format: "qty" },
          { key: "total", label: "Totali", align: "right", format: "money" },
        ],
        rows: invs.map((i) => ({
          no: i.no,
          date: i.date,
          customer: i.customer,
          items: i.items.length,
          total: i.total,
        })),
      };
    }
    case "faturaTeresot": {
      // "Fatura Totale Sot" — explode today's sale invoices into one row per line item.
      // If a date range is given, it is respected; otherwise it defaults to TODAY only.
      const day = todayStr();
      const ff: ReportFilter = (f.from || f.to) ? f : { ...f, from: day, to: day };
      const invs = filteredInvoices(db, ff);
      type Line = { no: number; product: string; unit: string; qtySold: number; qtyFree: number; rate: number; value: number; piece: number };
      const lines: Line[] = [];
      invs.forEach((inv) => {
        inv.items.forEach((it) => {
          if (!itemOK(it, ff, db)) return;
          const prod = db.products.find((p) => normKey(p.name) === normKey(it.productName));
          const coef = prod ? unitCoef(prod, it.unit) : 1;
          const rate = num(it.rate);
          lines.push({
            no: inv.no,
            product: it.productName,
            unit: it.unit,
            qtySold: num(it.qty),
            qtyFree: num(it.freeQty),
            rate,
            value: num(it.total),
            piece: coef > 0 ? rate / coef : rate,
          });
        });
      });
      lines.sort((a, b) => a.no - b.no || a.product.localeCompare(b.product));
      const totalValue = lines.reduce((s, l) => s + l.value, 0);
      const totalSold = lines.reduce((s, l) => s + l.qtySold, 0);
      const totalFree = lines.reduce((s, l) => s + l.qtyFree, 0);
      const invCount = new Set(lines.map((l) => l.no)).size;
      return {
        type,
        title: "Fatura Totale Sot",
        subtitle: (ff.from === day && ff.to === day) ? `Data: ${day}` : sub,
        columns: [
          { key: "no", label: "Nr." },
          { key: "product", label: "Artikulli" },
          { key: "unit", label: "Njësia" },
          { key: "qtySold", label: "Sasi shitur", align: "right", format: "qty" },
          { key: "qtyFree", label: "Sasi dhuratë", align: "right", format: "qty" },
          { key: "rate", label: "Çmim", align: "right", format: "money" },
          { key: "value", label: "Vlerë", align: "right", format: "money" },
          { key: "piece", label: "Çmim/copë", align: "right", format: "money" },
        ],
        rows: lines as any,
        summary: [
          { label: "Fatura", value: String(invCount) },
          { label: "Rreshta", value: String(lines.length) },
          { label: "Sasi shitur", value: fmt(totalSold) },
          { label: "Sasi dhuratë", value: fmt(totalFree) },
          { label: "Vlerë totale", value: fmt(totalValue) },
        ],
        emptyMessage: "Nuk ka shitje për ditën e zgjedhur.",
      };
    }
    case "shitjeSot": {
      // SHITJE SOT — sales over a date interval (defaults to TODAY when no range
      // is set). Rows are grouped by product + selected unit + price, so the
      // same product sold at different prices appears as separate rows. The free
      // (gift) quantity is shown in the item name only — it NEVER adds to Vlerë.
      const day = todayStr();
      const ff: ReportFilter = (f.from || f.to) ? f : { ...f, from: day, to: day };
      const lines = salesLines(db, ff);
      const qtyTxt = (n: number) => Number(n || 0).toLocaleString("sq-AL", { maximumFractionDigits: 3 });
      type G = { product: string; unit: string; rate: number; qtySold: number; qtyFree: number; value: number };
      const map = new Map<string, G>();
      lines.forEach((l) => {
        const k = `${normKey(l.product)}|${normKey(l.unit)}|${l.rate}`;
        const cur = map.get(k) || { product: l.product, unit: l.unit, rate: l.rate, qtySold: 0, qtyFree: 0, value: 0 };
        cur.qtySold += l.qty;
        cur.qtyFree += l.free;
        // Vlerë uses the SOLD quantity only (qty × price); gifts add nothing.
        cur.value += l.value;
        map.set(k, cur);
      });
      const grouped = [...map.values()].sort((a, b) => a.product.localeCompare(b.product) || b.value - a.value);
      const rows: Row[] = grouped.map((g) => ({
        product: g.qtyFree > 0 ? `${g.product} (${qtyTxt(g.qtySold)} shitur +${qtyTxt(g.qtyFree)})` : g.product,
        qty: g.qtySold,
        unit: g.unit,
        rate: g.rate,
        value: g.value,
      }));
      const totalValue = grouped.reduce((s, g) => s + g.value, 0);
      // Green TOTAL row at the bottom of the table.
      rows.push({ _total: 1, product: "TOTAL", qty: "", unit: "", rate: "", value: totalValue });
      return {
        type,
        title: "Shitje Sot",
        subtitle: (ff.from === day && ff.to === day) ? `Data: ${day}` : sub,
        columns: [
          { key: "product", label: "Emërtimi" },
          { key: "qty", label: "Sasi", align: "right", format: "qty" },
          { key: "unit", label: "Njësia" },
          { key: "rate", label: "Çmimi", align: "right", format: "money" },
          { key: "value", label: "Vlerë", align: "right", format: "money" },
        ],
        rows,
        summary: [
          { label: "Artikuj", value: String(grouped.length) },
          { label: "Vlerë totale", value: fmt(totalValue) },
        ],
        emptyMessage: "Nuk ka shitje për periudhën e zgjedhur.",
      };
    }
    case "kerkeseFurnizimi": {
      // KËRKESË FURNIZIMI — a supply request listing items that need restocking
      // (current stock <= min stock). ONLY three columns: Emërtimi, Sasi, Njësia.
      // No price / value / total / VAT / QR.
      const rows: Row[] = db.products
        .filter((p) => inMulti(p.name, f.products, f.product) && passCategory(p.name, f, db))
        .filter((p) => (p.minStock || 0) > 0 && totalStock(p) <= (p.minStock || 0))
        .map((p) => {
          const needBase = Math.max(0, (p.minStock || 0) - totalStock(p));
          const units = (p.units || [{ name: "Copë", coef: 1 }]).slice().sort((a, b) => b.coef - a.coef);
          const big = units[0] || { name: "Copë", coef: 1 };
          const qty = big.coef > 0 ? needBase / big.coef : needBase;
          return { product: p.name, qty, unit: big.name };
        })
        .filter((r) => r.qty > 0)
        .sort((a, b) => a.product.localeCompare(b.product));
      return {
        type,
        title: "Kërkesë Furnizimi",
        subtitle: "Artikujt nën stokun minimal",
        columns: [
          { key: "product", label: "Emërtimi i artikullit" },
          { key: "qty", label: "Sasi", align: "right", format: "qty" },
          { key: "unit", label: "Njësia" },
        ],
        rows,
        summary: [{ label: "Artikuj", value: String(rows.length) }],
        emptyMessage: "Asnjë artikull nuk është nën stokun minimal.",
      };
    }
    case "managerProfitItem": {
      const lines = salesLines(db, f);
      const map = new Map<string, { product: string; unit: string; qty: number; value: number; cost: number; profit: number }>();
      lines.forEach((l) => {
        const k = `${l.product}|${l.unit}`;
        const cur = map.get(k) || { product: l.product, unit: l.unit, qty: 0, value: 0, cost: 0, profit: 0 };
        cur.qty += l.qty;
        cur.value += l.value;
        cur.cost += l.cost;
        cur.profit += l.profit;
        map.set(k, cur);
      });
      const rows = [...map.values()].sort((a, b) => b.profit - a.profit);
      return {
        type,
        title: "Fitimi për artikull",
        subtitle: sub,
        columns: [
          { key: "product", label: "Artikulli" },
          { key: "unit", label: "Njësia" },
          { key: "qty", label: "Sasia", align: "right", format: "qty" },
          { key: "value", label: "Shitje", align: "right", format: "money" },
          { key: "cost", label: "Kosto", align: "right", format: "money" },
          { key: "profit", label: "Fitim", align: "right", format: "money" },
        ],
        rows: rows as any,
        summary: [
          { label: "Vlerë", value: fmt(rows.reduce((s, r) => s + r.value, 0)) },
          { label: "Fitim", value: fmt(rows.reduce((s, r) => s + r.profit, 0)) },
        ],
      };
    }
    case "managerProfitInvoice": {
      const invs = filteredInvoices(db, f);
      return {
        type,
        title: "Fitimi për faturë",
        subtitle: sub,
        columns: [
          { key: "no", label: "Nr." },
          { key: "date", label: "Data" },
          { key: "customer", label: "Klienti" },
          { key: "total", label: "Shitje", align: "right", format: "money" },
          { key: "totalCost", label: "Kosto", align: "right", format: "money" },
          { key: "profit", label: "Fitim", align: "right", format: "money" },
          { key: "margin", label: "Marzh %", align: "right", format: "pct" },
        ],
        rows: invs.map((i) => ({
          no: i.no,
          date: i.date,
          customer: i.customer,
          total: i.total,
          totalCost: i.totalCost,
          profit: i.profit,
          margin: i.total ? (i.profit / i.total) * 100 : 0,
        })),
        summary: [
          { label: "Fitim total", value: fmt(invs.reduce((s, i) => s + num(i.profit), 0)) },
        ],
      };
    }
    case "purchaseAnalytic": {
      const lines = purchaseLines(db, f);
      return {
        type,
        title: "Regjistri Analitik i Blerjeve",
        subtitle: sub,
        columns: [
          { key: "date", label: "Data" },
          { key: "no", label: "Nr." },
          { key: "party", label: "Furnitori" },
          { key: "product", label: "Artikulli" },
          { key: "unit", label: "Njësia" },
          { key: "qty", label: "Sasia", align: "right", format: "qty" },
          { key: "rate", label: "Çmimi", align: "right", format: "money" },
          { key: "value", label: "Vlerë", align: "right", format: "money" },
        ],
        rows: lines as any,
        summary: [{ label: "Vlerë", value: fmt(lines.reduce((s, l) => s + l.value, 0)) }],
      };
    }
    case "purchaseBySupplier": {
      const purs = filteredPurchases(db, f);
      const map = new Map<string, { supplier: string; count: number; total: number; due: number }>();
      purs.forEach((p) => {
        const cur = map.get(p.supplier) || { supplier: p.supplier, count: 0, total: 0, due: 0 };
        cur.count += 1;
        cur.total += num(p.total);
        cur.due += num(p.due);
        map.set(p.supplier, cur);
      });
      return {
        type,
        title: "Blerje sipas furnitorit",
        subtitle: sub,
        columns: [
          { key: "supplier", label: "Furnitori" },
          { key: "count", label: "Blerje", align: "right", format: "qty" },
          { key: "total", label: "Totali", align: "right", format: "money" },
          { key: "due", label: "Detyrim", align: "right", format: "money" },
        ],
        rows: [...map.values()].sort((a, b) => b.total - a.total) as any,
      };
    }
    case "purchaseByProduct": {
      const lines = purchaseLines(db, f);
      const map = new Map<string, { product: string; unit: string; qty: number; value: number }>();
      lines.forEach((l) => {
        const k = `${l.product}|${l.unit}`;
        const cur = map.get(k) || { product: l.product, unit: l.unit, qty: 0, value: 0 };
        cur.qty += l.qty;
        cur.value += l.value;
        map.set(k, cur);
      });
      return {
        type,
        title: "Blerje sipas artikullit",
        subtitle: sub,
        columns: [
          { key: "product", label: "Artikulli" },
          { key: "unit", label: "Njësia" },
          { key: "qty", label: "Sasia", align: "right", format: "qty" },
          { key: "value", label: "Vlerë", align: "right", format: "money" },
        ],
        rows: [...map.values()].sort((a, b) => b.value - a.value) as any,
      };
    }
    case "purchaseDaily": {
      const purs = filteredPurchases(db, f);
      const map = new Map<string, { date: string; count: number; total: number }>();
      purs.forEach((p) => {
        const cur = map.get(p.date) || { date: p.date, count: 0, total: 0 };
        cur.count += 1;
        cur.total += num(p.total);
        map.set(p.date, cur);
      });
      return {
        type,
        title: "Blerje ditore",
        subtitle: sub,
        columns: [
          { key: "date", label: "Data" },
          { key: "count", label: "Blerje", align: "right", format: "qty" },
          { key: "total", label: "Totali", align: "right", format: "money" },
        ],
        rows: [...map.values()].sort((a, b) => a.date.localeCompare(b.date)) as any,
      };
    }
    case "purchaseInvoiceBatch": {
      const purs = filteredPurchases(db, f).sort((a, b) => a.no - b.no);
      return {
        type,
        title: "Fatura blerje të renditura",
        subtitle: sub,
        columns: [
          { key: "no", label: "Nr." },
          { key: "date", label: "Data" },
          { key: "supplier", label: "Furnitori" },
          { key: "items", label: "Rreshta", align: "right", format: "qty" },
          { key: "total", label: "Totali", align: "right", format: "money" },
        ],
        rows: purs.map((p) => ({
          no: p.no,
          date: p.date,
          supplier: p.supplier,
          items: p.items.length,
          total: p.total,
        })),
      };
    }
    case "itemCard": {
      const sales = salesLines(db, f).map((l) => ({ ...l, kind: "Shitje" }));
      const buys = purchaseLines(db, f).map((l) => ({ ...l, kind: "Blerje" }));
      const all = [...sales, ...buys].sort((a, b) => a.date.localeCompare(b.date));
      return {
        type,
        title: "Kartela e Artikullit",
        subtitle: f.product ? `Artikulli: ${f.product}` : sub,
        columns: [
          { key: "date", label: "Data" },
          { key: "kind", label: "Lloji" },
          { key: "no", label: "Nr." },
          { key: "party", label: "Pala" },
          { key: "qty", label: "Sasia", align: "right", format: "qty" },
          { key: "unit", label: "Njësia" },
          { key: "rate", label: "Çmimi", align: "right", format: "money" },
          { key: "value", label: "Vlerë", align: "right", format: "money" },
        ],
        rows: all as any,
      };
    }
    case "stockSummary": {
      // Which store(s) are we reporting on? If a store filter is set, stock is
      // taken from that store only; otherwise the total across all stores.
      const selectedStores = (f.stores && f.stores.length) ? f.stores : (f.store ? [f.store] : []);
      const storeLabel = selectedStores.length ? selectedStores.join(", ") : "Të gjitha magazinat";
      // Filter products by the product multi filter (store is applied to the quantity, not to exclude items).
      const prods = db.products.filter((p) =>
        f.products && f.products.length
          ? f.products.some((x) => normKey(x) === normKey(p.name))
          : (!f.product || !f.product.trim() || normKey(p.name).includes(normKey(f.product))),
      );
      // Real base-unit stock of a product for the selected store scope.
      const baseStockOf = (p: (typeof prods)[number]): number => {
        if (!selectedStores.length) return totalStock(p);
        return selectedStores.reduce((s, st) => s + stockInStore(p, st), 0);
      };
      // Fixed column order per requirement:
      // Nr. | Artikulli | Njësia bazë | Njësia 2 | Sasia | Gjendja (të dyja njësitë) | Çmim blerje | Vlerë.
      // Stock is ALWAYS kept internally in base units (copë). The balance column
      // shows the quantity both in the base unit AND the second unit simultaneously.
      const columns: Column[] = [
        { key: "nr", label: "Nr.", align: "right" },
        { key: "product", label: "Artikulli" },
        { key: "baseUnit", label: "Njësia bazë" },
        { key: "secondUnit", label: "Njësia 2" },
        { key: "qty", label: "Sasia (bazë)", align: "right", format: "qty" },
        { key: "balance", label: "Gjendja", align: "right" },
        { key: "buyPiece", label: "Çmim blerje", align: "right", format: "money" },
        { key: "value", label: "Vlerë", align: "right", format: "money" },
      ];
      const rows = prods.map((p, idx) => {
        const stockBase = baseStockOf(p);
        const baseUnit = p.units?.[0]?.name || "Copë";
        const second = p.units?.[1];
        const secondName = second?.name || "";
        const secondCoef = second ? unitCoef(p, second.name) : 0;
        // Balance shown in BOTH units, e.g. "1.368 Copë / 114 Koli" (or "11.4 Koli" if partial).
        let balance = `${fmt(stockBase)} ${baseUnit}`;
        if (second && secondCoef > 0) {
          const inSecond = stockBase / secondCoef;
          balance += ` / ${fmt(inSecond)} ${secondName}`;
        }
        return {
          nr: idx + 1,
          product: p.name,
          baseUnit,
          secondUnit: secondName || "—",
          qty: stockBase,
          balance,
          buyPiece: p.buyPiece,
          value: stockBase * p.buyPiece,
        } as Row;
      });
      return {
        type,
        title: "Gjendja aktuale e stokut",
        subtitle: `${sub} · ${storeLabel}`,
        columns,
        rows,
        summary: [
          { label: "Artikuj", value: String(rows.length) },
          { label: "Magazina", value: storeLabel },
          { label: "Vlerë inventari", value: fmt(rows.reduce((s, r) => s + num(r.value), 0)) },
        ],
      };
    }
    case "stockByWarehouse": {
      const map = new Map<string, { store: string; products: number; stock: number; value: number }>();
      // Seed every known store so empty ones still show.
      db.stores.forEach((s) => map.set(s, { store: s, products: 0, stock: 0, value: 0 }));
      db.products.forEach((p) => {
        db.stores.forEach((s) => {
          const qty = stockInStore(p, s);
          if (qty === 0) return;
          const cur = map.get(s) || { store: s, products: 0, stock: 0, value: 0 };
          cur.products += 1;
          cur.stock += qty;
          cur.value += qty * p.buyPiece;
          map.set(s, cur);
        });
      });
      return {
        type,
        title: "Gjendja sipas magazinave",
        subtitle: sub,
        columns: [
          { key: "store", label: "Magazina" },
          { key: "products", label: "Artikuj", align: "right", format: "qty" },
          { key: "stock", label: "Stok", align: "right", format: "qty" },
          { key: "value", label: "Vlerë", align: "right", format: "money" },
        ],
        rows: [...map.values()] as any,
      };
    }
    case "transferReport": {
      // Warehouse-to-warehouse transfers, filtered by date / product / warehouse.
      const wantStores = (f.stores && f.stores.length) ? f.stores : (f.store ? [f.store] : []);
      const rows = (db.transfers || [])
        .filter((t) => dateOK(t.date, f.from, f.to))
        .filter((t) =>
          f.products && f.products.length
            ? f.products.some((x) => normKey(x) === normKey(t.product))
            : (!f.product || !f.product.trim() || normKey(t.product).includes(normKey(f.product))),
        )
        .filter((t) =>
          wantStores.length
            ? wantStores.some((s) => normKey(s) === normKey(t.fromWarehouse) || normKey(s) === normKey(t.toWarehouse))
            : true,
        )
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id)
        .map((t) => ({
          transferNo: t.transferNo,
          date: t.date,
          fromWarehouse: t.fromWarehouse,
          toWarehouse: t.toWarehouse,
          product: t.product,
          unit: t.unit,
          qty: num(t.qty),
          pieces: num(t.pieces),
          note: t.note || "",
        }));
      return {
        type,
        title: "Transferimet mes magazinave",
        subtitle: sub,
        emptyMessage: "Nuk ka transferime në periudhë.",
        columns: [
          { key: "transferNo", label: "Nr. Transferimi" },
          { key: "date", label: "Data" },
          { key: "fromWarehouse", label: "Nga" },
          { key: "toWarehouse", label: "Te" },
          { key: "product", label: "Artikulli" },
          { key: "unit", label: "Njësia" },
          { key: "qty", label: "Sasia", align: "right", format: "qty" },
          { key: "pieces", label: "Në copë", align: "right", format: "qty" },
          { key: "note", label: "Shënim" },
        ],
        rows: rows as any,
        summary: [
          { label: "Transferime", value: String(rows.length) },
          { label: "Copë gjithsej", value: fmt(rows.reduce((s, r) => s + num(r.pieces), 0)) },
        ],
      };
    }
    case "stockMovement": {
      const moves: Row[] = [];
      const baseEq = (productName: string, qty: number, unit: string) => {
        const prod = db.products.find((p) => p.name === productName);
        return qty * (prod ? unitCoef(prod, unit) : 1);
      };
      filteredInvoices(db, f).forEach((i) =>
        i.items.forEach((it) => {
          if (!itemOK(it, f, db)) return;
          const q = num(it.qty) + num(it.freeQty);
          moves.push({
            date: i.date,
            kind: "Shitje",
            product: it.productName,
            qty: -q,
            unit: it.unit,
            base: -baseEq(it.productName, q, it.unit),
            store: i.store || "",
            ref: `Fat ${i.no}`,
          });
        }),
      );
      filteredPurchases(db, f).forEach((p) =>
        p.items.forEach((it) => {
          if (!itemOK(it, f, db)) return;
          const q = num(it.qty) + num(it.freeQty);
          moves.push({
            date: p.date,
            kind: "Blerje",
            product: it.productName,
            qty: q,
            unit: it.unit,
            base: baseEq(it.productName, q, it.unit),
            store: p.store || "",
            ref: `Bl ${p.no}`,
          });
        }),
      );
      db.stockAdjustments
        .filter((a) => dateOK(a.date, f.from, f.to))
        .filter((a) => inMulti(a.store, f.stores, f.store))
        .filter((a) =>
          f.products && f.products.length
            ? f.products.some((x) => normKey(x) === normKey(a.product))
            : (!f.product || !f.product.trim() || normKey(a.product).includes(normKey(f.product))),
        )
        .filter((a) =>
          f.units && f.units.length ? f.units.some((x) => normKey(x) === normKey(a.unit)) : (!f.unit || !f.unit.trim() || normKey(a.unit) === normKey(f.unit)),
        )
        .forEach((a) => {
          const signed = a.type === "add" ? a.qty : -a.qty;
          moves.push({
            date: a.date,
            kind: a.type === "add" ? "Shtim" : "Pakësim",
            product: a.product,
            qty: signed,
            unit: a.unit,
            base: baseEq(a.product, signed, a.unit),
            store: a.store || "",
            ref: a.details || "Rregullim",
          });
        });
      // Warehouse documents (Phase 1): Fletë Hyrje / Dalje / Inventar / Transferim.
      const docProductOK = (name: string) =>
        f.products && f.products.length
          ? f.products.some((x) => normKey(x) === normKey(name))
          : (!f.product || !f.product.trim() || normKey(name).includes(normKey(f.product)));
      (db.inboundDocs || [])
        .filter((d) => dateOK(d.date, f.from, f.to) && inMulti(d.warehouse, f.stores, f.store))
        .forEach((d) =>
          d.lines.filter((l) => docProductOK(l.productName)).forEach((l) =>
            moves.push({
              date: d.date, kind: "Fletë Hyrje", product: l.productName, store: d.warehouse,
              unit: l.unit, qty: num(l.qty), base: num(l.baseQty), ref: d.no,
            }),
          ),
        );
      (db.outboundDocs || [])
        .filter((d) => dateOK(d.date, f.from, f.to) && inMulti(d.warehouse, f.stores, f.store))
        .forEach((d) =>
          d.lines.filter((l) => docProductOK(l.productName)).forEach((l) =>
            moves.push({
              date: d.date, kind: "Fletë Dalje", product: l.productName, store: d.warehouse,
              unit: l.unit, qty: -num(l.qty), base: -num(l.baseQty), ref: d.no,
            }),
          ),
        );
      (db.inventoryDocs || [])
        .filter((d) => dateOK(d.date, f.from, f.to) && inMulti(d.warehouse, f.stores, f.store))
        .forEach((d) =>
          d.lines.filter((l) => docProductOK(l.productName) && Math.abs(l.diff) > 0.0001).forEach((l) =>
            moves.push({
              date: d.date, kind: "Inventar", product: l.productName, store: d.warehouse,
              unit: "copë", qty: l.diff, base: l.diff, ref: d.no,
            }),
          ),
        );
      moves.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return {
        type,
        title: "Lëvizjet e magazinës",
        subtitle: sub,
        columns: [
          { key: "date", label: "Data" },
          { key: "kind", label: "Lloji" },
          { key: "product", label: "Artikulli" },
          { key: "store", label: "Magazina" },
          { key: "unit", label: "Njësia" },
          { key: "qty", label: "Sasia", align: "right", format: "qty" },
          { key: "base", label: "Në copë", align: "right", format: "qty" },
          { key: "ref", label: "Referenca" },
        ],
        rows: moves,
      };
    }
    case "stockByCompany": {
      // Reports operate on the active company's slice; summarize its total stock.
      let products = 0;
      let stock = 0;
      let value = 0;
      db.products.forEach((p) => {
        const q = totalStock(p);
        if (q !== 0) {
          products += 1;
          stock += q;
          value += q * p.buyPiece;
        }
      });
      return {
        type,
        title: "Gjendja sipas kompanisë",
        subtitle: sub,
        columns: [
          { key: "company", label: "Kompania" },
          { key: "warehouses", label: "Magazina", align: "right", format: "qty" },
          { key: "products", label: "Artikuj", align: "right", format: "qty" },
          { key: "stock", label: "Stok (copë)", align: "right", format: "qty" },
          { key: "value", label: "Vlerë", align: "right", format: "money" },
        ],
        rows: [
          {
            company: db.company?.name || "Kompania",
            warehouses: (db.warehouses || []).filter((w) => w.status === "active").length,
            products,
            stock,
            value,
          },
        ] as any,
        summary: [
          { label: "Artikuj", value: fmt(products) },
          { label: "Stok (copë)", value: fmt(stock) },
          { label: "Vlera e stokut", value: fmt(value) },
        ],
      };
    }
    case "inboundDocsReport":
    case "outboundDocsReport": {
      const isIn = type === "inboundDocsReport";
      const docs = (isIn ? db.inboundDocs : db.outboundDocs) || [];
      const wantStores = (f.stores && f.stores.length) ? f.stores : (f.store ? [f.store] : []);
      const prodOK = (name: string) =>
        f.products && f.products.length
          ? f.products.some((x) => normKey(x) === normKey(name))
          : (!f.product || !f.product.trim() || normKey(name).includes(normKey(f.product)));
      const rows: Row[] = [];
      let totalPieces = 0;
      docs
        .filter((d) => dateOK(d.date, f.from, f.to))
        .filter((d) => (wantStores.length ? wantStores.some((s) => normKey(s) === normKey(d.warehouse)) : true))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id)
        .forEach((d) => {
          d.lines.filter((l) => prodOK(l.productName)).forEach((l) => {
            totalPieces += num(l.baseQty);
            rows.push({
              no: d.no,
              date: d.date,
              warehouse: d.warehouse,
              product: l.productName,
              unit: l.unit,
              qty: num(l.qty),
              base: num(l.baseQty),
              reason: d.reason || d.note || "",
            });
          });
        });
      return {
        type,
        title: isIn ? "Raporti Fletë Hyrje" : "Raporti Fletë Dalje",
        subtitle: sub,
        emptyMessage: "Nuk ka dokumente në periudhë.",
        columns: [
          { key: "no", label: "Nr. Dok." },
          { key: "date", label: "Data" },
          { key: "warehouse", label: "Magazina" },
          { key: "product", label: "Artikulli" },
          { key: "unit", label: "Njësia" },
          { key: "qty", label: "Sasia", align: "right", format: "qty" },
          { key: "base", label: "Në copë", align: "right", format: "qty" },
          { key: "reason", label: "Arsyeja" },
        ],
        rows,
        summary: [
          { label: "Rreshta", value: String(rows.length) },
          { label: "Copë gjithsej", value: fmt(totalPieces) },
        ],
      };
    }
    case "inventoryDocsReport": {
      const wantStores = (f.stores && f.stores.length) ? f.stores : (f.store ? [f.store] : []);
      const prodOK = (name: string) =>
        f.products && f.products.length
          ? f.products.some((x) => normKey(x) === normKey(name))
          : (!f.product || !f.product.trim() || normKey(name).includes(normKey(f.product)));
      const rows: Row[] = [];
      let totalDiff = 0;
      (db.inventoryDocs || [])
        .filter((d) => dateOK(d.date, f.from, f.to))
        .filter((d) => (wantStores.length ? wantStores.some((s) => normKey(s) === normKey(d.warehouse)) : true))
        .sort((a, b) => String(b.date).localeCompare(String(a.date)) || b.id - a.id)
        .forEach((d) => {
          d.lines.filter((l) => prodOK(l.productName)).forEach((l) => {
            totalDiff += num(l.diff);
            rows.push({
              no: d.no,
              date: d.date,
              warehouse: d.warehouse,
              product: l.productName,
              systemQty: num(l.systemQty),
              countedQty: num(l.countedQty),
              diff: num(l.diff),
            });
          });
        });
      return {
        type,
        title: "Raporti Inventar Fizik",
        subtitle: sub,
        emptyMessage: "Nuk ka inventarë në periudhë.",
        columns: [
          { key: "no", label: "Nr. Dok." },
          { key: "date", label: "Data" },
          { key: "warehouse", label: "Magazina" },
          { key: "product", label: "Artikulli" },
          { key: "systemQty", label: "Sistemi", align: "right", format: "qty" },
          { key: "countedQty", label: "Numëruar", align: "right", format: "qty" },
          { key: "diff", label: "Diferenca", align: "right", format: "qty" },
        ],
        rows,
        summary: [{ label: "Diferenca neto (copë)", value: fmt(totalDiff) }],
      };
    }
    case "supplyNeed": {
      const rows = db.products
        .filter((p) => (p.minStock || 0) > 0 && totalStock(p) <= (p.minStock || 0))
        .map((p) => {
          const st = totalStock(p);
          return {
            product: p.name,
            stock: st,
            minStock: p.minStock || 0,
            need: Math.max(0, (p.minStock || 0) - st),
            buyPiece: p.buyPiece,
            buyValue: Math.max(0, (p.minStock || 0) - st) * p.buyPiece,
          };
        });
      return {
        type,
        title: "Kërkesë furnizimi",
        subtitle: sub,
        columns: [
          { key: "product", label: "Artikulli" },
          { key: "stock", label: "Stoku", align: "right", format: "qty" },
          { key: "minStock", label: "Min.", align: "right", format: "qty" },
          { key: "need", label: "Nevoja", align: "right", format: "qty" },
          { key: "buyPiece", label: "Çmim blerje", align: "right", format: "money" },
          { key: "buyValue", label: "Vlerë", align: "right", format: "money" },
        ],
        rows: rows as any,
        summary: [{ label: "Total i nevojshëm", value: fmt(rows.reduce((s, r) => s + r.buyValue, 0)) }],
      };
    }
    case "purchaseSuggestion": {
      // Every item sold in the period -> suggest ordering the same quantity
      // expressed in the item's LARGEST used unit (e.g. sold 10 koli -> 10 koli).
      const lines = salesLines(db, f);
      // Group by product, accumulate sold quantity in BASE units.
      const byProduct = new Map<string, { product: string; soldBase: number }>();
      lines.forEach((l) => {
        const prod = db.products.find((p) => p.name === l.product);
        const coef = prod ? unitCoef(prod, l.unit) : 1;
        const base = (l.qty + l.free) * coef;
        const cur = byProduct.get(l.product) || { product: l.product, soldBase: 0 };
        cur.soldBase += base;
        byProduct.set(l.product, cur);
      });
      const rows = [...byProduct.values()].map((r) => {
        const prod = db.products.find((p) => p.name === r.product);
        // largest unit = unit with biggest coef
        const units = (prod?.units || [{ name: "Cope", coef: 1 }]).slice().sort((a, b) => b.coef - a.coef);
        const big = units[0];
        const suggestQty = big.coef > 0 ? r.soldBase / big.coef : r.soldBase;
        const buyPiece = prod?.buyPiece || 0;
        return {
          product: r.product,
          soldBase: r.soldBase,
          unit: big.name,
          suggest: suggestQty,
          stock: prod?.stock ?? 0,
          buyValue: r.soldBase * buyPiece,
        };
      }).sort((a, b) => b.buyValue - a.buyValue);
      return {
        type,
        title: "Kërkesë furnizimi (sipas shitjes)",
        subtitle: sub,
        columns: [
          { key: "product", label: "Artikulli" },
          { key: "soldBase", label: "Shitur (bazë)", align: "right", format: "qty" },
          { key: "stock", label: "Stok aktual", align: "right", format: "qty" },
          { key: "suggest", label: "Kërko", align: "right", format: "qty" },
          { key: "unit", label: "Njësia" },
          { key: "buyValue", label: "Vlerë blerje", align: "right", format: "money" },
        ],
        rows: rows as any,
        summary: [
          { label: "Artikuj", value: String(rows.length) },
          { label: "Vlerë e nevojshme", value: fmt(rows.reduce((s, r) => s + r.buyValue, 0)) },
        ],
        emptyMessage: "Nuk ka shitje në periudhë për të gjeneruar kërkesë furnizimi.",
      };
    }
    case "warehouseStockAsOf": {
      const asOf = f.to || (new Date()).toISOString().slice(0, 10);
      const ps = db.products.map((p) => {
        const sold = db.invoices
          .filter((i) => i.date <= asOf)
          .flatMap((i) => i.items.filter((it) => it.productName === p.name))
          .reduce((s, it) => s + num(it.qty) + num(it.freeQty), 0);
        const bought = db.purchases
          .filter((i) => i.date <= asOf)
          .flatMap((i) => i.items.filter((it) => it.productName === p.name))
          .reduce((s, it) => s + num(it.qty) + num(it.freeQty), 0);
        const adj = db.stockAdjustments
          .filter((a) => a.date <= asOf && a.product === p.name)
          .reduce((s, a) => s + (a.type === "add" ? a.qty : -a.qty), 0);
        const stockNow = p.stock; // current snapshot
        // heuristic: stock at asOf = current - (purchases after asOf - sales after asOf - adj after asOf)
        const purAfter = db.purchases
          .filter((i) => i.date > asOf)
          .flatMap((i) => i.items.filter((it) => it.productName === p.name))
          .reduce((s, it) => s + num(it.qty) + num(it.freeQty), 0);
        const saleAfter = db.invoices
          .filter((i) => i.date > asOf)
          .flatMap((i) => i.items.filter((it) => it.productName === p.name))
          .reduce((s, it) => s + num(it.qty) + num(it.freeQty), 0);
        const adjAfter = db.stockAdjustments
          .filter((a) => a.date > asOf && a.product === p.name)
          .reduce((s, a) => s + (a.type === "add" ? a.qty : -a.qty), 0);
        const stockAt = stockNow - (purAfter - saleAfter + adjAfter);
        return {
          product: p.name,
          sold,
          bought,
          adj,
          stockAt,
          value: stockAt * p.buyPiece,
        };
      });
      return {
        type,
        title: "Gjendje magazine datë",
        subtitle: `Deri më: ${asOf}`,
        columns: [
          { key: "product", label: "Artikulli" },
          { key: "bought", label: "Blerë", align: "right", format: "qty" },
          { key: "sold", label: "Shitur", align: "right", format: "qty" },
          { key: "adj", label: "Rregullim", align: "right", format: "qty" },
          { key: "stockAt", label: "Stok", align: "right", format: "qty" },
          { key: "value", label: "Vlerë", align: "right", format: "money" },
        ],
        rows: ps as any,
      };
    }
    case "itemAnalysis": {
      const rows = db.products.map((p) => {
        const sold = db.invoices
          .flatMap((i) => i.items.filter((it) => it.productName === p.name))
          .reduce((s, it) => s + num(it.qty), 0);
        const bought = db.purchases
          .flatMap((i) => i.items.filter((it) => it.productName === p.name))
          .reduce((s, it) => s + num(it.qty), 0);
        const profit = db.invoices
          .flatMap((i) => i.items.filter((it) => it.productName === p.name))
          .reduce((s, it) => s + num(it.total) - num(it.cost), 0);
        return {
          product: p.name,
          stock: p.stock,
          sold,
          bought,
          turnover: sold,
          profit,
        };
      });
      return {
        type,
        title: "Analizë artikulli",
        subtitle: sub,
        columns: [
          { key: "product", label: "Artikulli" },
          { key: "stock", label: "Stok", align: "right", format: "qty" },
          { key: "bought", label: "Blerë", align: "right", format: "qty" },
          { key: "sold", label: "Shitur", align: "right", format: "qty" },
          { key: "profit", label: "Fitim", align: "right", format: "money" },
        ],
        rows: rows as any,
      };
    }
    case "managerTopProducts": {
      const lines = salesLines(db, f);
      const map = new Map<string, { product: string; qty: number; value: number; profit: number }>();
      lines.forEach((l) => {
        const cur = map.get(l.product) || { product: l.product, qty: 0, value: 0, profit: 0 };
        cur.qty += l.qty;
        cur.value += l.value;
        cur.profit += l.profit;
        map.set(l.product, cur);
      });
      return {
        type,
        title: "Top artikujt sipas shitjes",
        subtitle: sub,
        columns: [
          { key: "product", label: "Artikulli" },
          { key: "qty", label: "Sasia", align: "right", format: "qty" },
          { key: "value", label: "Vlerë", align: "right", format: "money" },
          { key: "profit", label: "Fitim", align: "right", format: "money" },
        ],
        rows: [...map.values()].sort((a, b) => b.value - a.value).slice(0, 50) as any,
      };
    }
    case "managerTopClients": {
      const invs = filteredInvoices(db, f);
      const map = new Map<string, { party: string; total: number; profit: number }>();
      invs.forEach((i) => {
        const cur = map.get(i.customer) || { party: i.customer, total: 0, profit: 0 };
        cur.total += num(i.total);
        cur.profit += num(i.profit);
        map.set(i.customer, cur);
      });
      return {
        type,
        title: "Top klientët sipas shitjes",
        subtitle: sub,
        columns: [
          { key: "party", label: "Klienti" },
          { key: "total", label: "Shitje", align: "right", format: "money" },
          { key: "profit", label: "Fitim", align: "right", format: "money" },
        ],
        rows: [...map.values()].sort((a, b) => b.total - a.total).slice(0, 50) as any,
      };
    }
    case "managerMarginByClient": {
      const invs = filteredInvoices(db, f);
      const map = new Map<string, { party: string; sale: number; cost: number }>();
      invs.forEach((i) => {
        const cur = map.get(i.customer) || { party: i.customer, sale: 0, cost: 0 };
        cur.sale += num(i.total);
        cur.cost += num(i.totalCost);
        map.set(i.customer, cur);
      });
      const rows = [...map.values()].map((r) => ({
        party: r.party,
        sale: r.sale,
        profit: r.sale - r.cost,
        margin: r.sale ? ((r.sale - r.cost) / r.sale) * 100 : 0,
      }));
      return {
        type,
        title: "Marzhi sipas klientit",
        subtitle: sub,
        columns: [
          { key: "party", label: "Klienti" },
          { key: "sale", label: "Shitje", align: "right", format: "money" },
          { key: "profit", label: "Fitim", align: "right", format: "money" },
          { key: "margin", label: "Marzh %", align: "right", format: "pct" },
        ],
        rows: rows.sort((a, b) => b.margin - a.margin) as any,
      };
    }
    case "managerDailyProfit": {
      const invs = filteredInvoices(db, f);
      const map = new Map<string, { date: string; total: number; profit: number }>();
      invs.forEach((i) => {
        const cur = map.get(i.date) || { date: i.date, total: 0, profit: 0 };
        cur.total += num(i.total);
        cur.profit += num(i.profit);
        map.set(i.date, cur);
      });
      return {
        type,
        title: "Fitimi ditor",
        subtitle: sub,
        columns: [
          { key: "date", label: "Data" },
          { key: "total", label: "Shitje", align: "right", format: "money" },
          { key: "profit", label: "Fitim", align: "right", format: "money" },
        ],
        rows: [...map.values()].sort((a, b) => a.date.localeCompare(b.date)) as any,
      };
    }
    case "managerSalesVsPurchases": {
      const invs = filteredInvoices(db, f);
      const purs = filteredPurchases(db, f);
      const dates = new Set<string>([...invs.map((i) => i.date), ...purs.map((p) => p.date)]);
      const rows = [...dates].sort().map((d) => ({
        date: d,
        sales: invs.filter((i) => i.date === d).reduce((s, i) => s + num(i.total), 0),
        purchases: purs.filter((p) => p.date === d).reduce((s, p) => s + num(p.total), 0),
      }));
      return {
        type,
        title: "Krahasim shitje vs blerje",
        subtitle: sub,
        columns: [
          { key: "date", label: "Data" },
          { key: "sales", label: "Shitje", align: "right", format: "money" },
          { key: "purchases", label: "Blerje", align: "right", format: "money" },
          { key: "diff", label: "Diferencë", align: "right", format: "money" },
        ],
        rows: rows.map((r) => ({ ...r, diff: r.sales - r.purchases })) as any,
      };
    }
    case "managerInventoryValue": {
      const rows = db.products.map((p) => {
        const st = totalStock(p);
        return {
          product: p.name,
          stock: st,
          buyPiece: p.buyPiece,
          salePiece: p.salePiece,
          valueCost: st * p.buyPiece,
          valueSale: st * p.salePiece,
        };
      });
      return {
        type,
        title: "Vlera e inventarit",
        subtitle: sub,
        columns: [
          { key: "product", label: "Artikulli" },
          { key: "stock", label: "Stok", align: "right", format: "qty" },
          { key: "buyPiece", label: "Çm. blerje", align: "right", format: "money" },
          { key: "salePiece", label: "Çm. shitje", align: "right", format: "money" },
          { key: "valueCost", label: "Vlerë me kosto", align: "right", format: "money" },
          { key: "valueSale", label: "Vlerë me shitje", align: "right", format: "money" },
        ],
        rows: rows as any,
        summary: [
          { label: "Vlerë me kosto", value: fmt(rows.reduce((s, r) => s + r.valueCost, 0)) },
          { label: "Vlerë me shitje", value: fmt(rows.reduce((s, r) => s + r.valueSale, 0)) },
        ],
      };
    }
    case "managerSlowMovingStock": {
      const cutoff = f.from || (() => {
        const d = new Date();
        d.setDate(d.getDate() - 60);
        return d.toISOString().slice(0, 10);
      })();
      const rows = db.products
        .map((p) => {
          const lastSale = db.invoices
            .filter((i) => i.items.some((it) => it.productName === p.name))
            .map((i) => i.date)
            .sort()
            .pop();
          return { product: p.name, stock: totalStock(p), lastSale: lastSale || "—" };
        })
        .filter((r) => r.lastSale === "—" || r.lastSale < cutoff);
      return {
        type,
        title: "Artikuj pa lëvizje",
        subtitle: `Pa shitje që nga: ${cutoff}`,
        columns: [
          { key: "product", label: "Artikulli" },
          { key: "stock", label: "Stoku", align: "right", format: "qty" },
          { key: "lastSale", label: "Shitja e fundit" },
        ],
        rows: rows as any,
      };
    }
    case "managerWarehouseTurnover": {
      const map = new Map<string, { store: string; sale: number; purchase: number }>();
      filteredInvoices(db, f).forEach((i) => {
        const k = i.store || db.stores[0] || "Magazina kryesore";
        const cur = map.get(k) || { store: k, sale: 0, purchase: 0 };
        cur.sale += num(i.total);
        map.set(k, cur);
      });
      filteredPurchases(db, f).forEach((p) => {
        const k = p.store || db.stores[0] || "Magazina kryesore";
        const cur = map.get(k) || { store: k, sale: 0, purchase: 0 };
        cur.purchase += num(p.total);
        map.set(k, cur);
      });
      return {
        type,
        title: "Qarkullimi sipas magazinës",
        subtitle: sub,
        columns: [
          { key: "store", label: "Magazina" },
          { key: "sale", label: "Shitje", align: "right", format: "money" },
          { key: "purchase", label: "Blerje", align: "right", format: "money" },
        ],
        rows: [...map.values()] as any,
      };
    }
    case "supplierBalances": {
      const rows = db.suppliers.map((s) => ({
        supplier: s.name,
        opening: num(s.openingBalance || 0),
        due: supplierDue(db, s.name),
      }));
      return {
        type,
        title: "Detyrime sipas furnitorëve",
        subtitle: sub,
        columns: [
          { key: "supplier", label: "Furnitori" },
          { key: "opening", label: "Hapje", align: "right", format: "money" },
          { key: "due", label: "Detyrim", align: "right", format: "money" },
        ],
        rows: rows.filter((r) => r.due > 0 || r.opening !== 0) as any,
        summary: [{ label: "Total", value: fmt(rows.reduce((s, r) => s + r.due, 0)) }],
      };
    }
    case "clientBalances": {
      const rows = db.customers.map((c) => ({
        client: c.name,
        opening: num(c.openingBalance || 0),
        due: partyDue(db, c.name),
      }));
      return {
        type,
        title: "Detyrime sipas klientëve",
        subtitle: sub,
        columns: [
          { key: "client", label: "Klienti" },
          { key: "opening", label: "Hapje", align: "right", format: "money" },
          { key: "due", label: "Detyrim", align: "right", format: "money" },
        ],
        rows: rows.filter((r) => r.due > 0 || r.opening !== 0) as any,
        summary: [{ label: "Total", value: fmt(rows.reduce((s, r) => s + r.due, 0)) }],
      };
    }
    case "supplierLedger":
    case "clientLedger": {
      const isClient = type === "clientLedger";
      const name = isClient ? f.client : f.supplier;
      const rows: Row[] = [];
      if (isClient && name) {
        db.invoices
          .filter((i) => normKey(i.customer) === normKey(name))
          .filter((i) => dateOK(i.date, f.from, f.to))
          .forEach((i) =>
            rows.push({
              date: i.date,
              ref: `Fat #${i.no}`,
              kind: "Shitje",
              debit: i.total,
              credit: i.paid,
              balance: i.due,
            }),
          );
        db.payments
          .filter((p) => p.partyType === "customer" && normKey(p.party) === normKey(name))
          .filter((p) => dateOK(p.date, f.from, f.to))
          .forEach((p) =>
            rows.push({
              date: p.date,
              ref: p.method,
              kind: "Pagesë",
              debit: 0,
              credit: p.amount,
              balance: -p.amount,
            }),
          );
      } else if (!isClient && name) {
        db.purchases
          .filter((i) => normKey(i.supplier) === normKey(name))
          .filter((i) => dateOK(i.date, f.from, f.to))
          .forEach((i) =>
            rows.push({
              date: i.date,
              ref: `Bl #${i.no}`,
              kind: "Blerje",
              debit: 0,
              credit: i.total,
              balance: i.due,
            }),
          );
        db.payments
          .filter((p) => p.partyType === "supplier" && normKey(p.party) === normKey(name))
          .filter((p) => dateOK(p.date, f.from, f.to))
          .forEach((p) =>
            rows.push({
              date: p.date,
              ref: p.method,
              kind: "Pagesë",
              debit: p.amount,
              credit: 0,
              balance: -p.amount,
            }),
          );
      }
      rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const balance = isClient && name ? partyDue(db, name) : !isClient && name ? supplierDue(db, name) : 0;
      return {
        type,
        title: isClient ? "Kartela klientit" : "Kartela furnitorit",
        subtitle: name ? `${name} • ${sub}` : `Zgjidh ${isClient ? "klientin" : "furnitorin"} në filtra`,
        emptyMessage: name ? "Pa lëvizje në periudhë" : `Zgjidh ${isClient ? "klientin" : "furnitorin"} në filtra`,
        columns: [
          { key: "date", label: "Data" },
          { key: "ref", label: "Referenca" },
          { key: "kind", label: "Lloji" },
          { key: "debit", label: "Debit", align: "right", format: "money" },
          { key: "credit", label: "Kredit", align: "right", format: "money" },
          { key: "balance", label: "Balanca", align: "right", format: "money" },
        ],
        rows,
        summary: name ? [{ label: "Balanca", value: fmt(balance) }] : undefined,
      };
    }
    case "unpaidInvoices": {
      const invs = filteredInvoices(db, f).filter((i) => num(i.due) > 0);
      return {
        type,
        title: "Fatura pa paguara",
        subtitle: sub,
        columns: [
          { key: "no", label: "Nr." },
          { key: "date", label: "Data" },
          { key: "customer", label: "Klienti" },
          { key: "total", label: "Totali", align: "right", format: "money" },
          { key: "paid", label: "Paguar", align: "right", format: "money" },
          { key: "due", label: "Detyrim", align: "right", format: "money" },
        ],
        rows: invs.map((i) => ({
          no: i.no,
          date: i.date,
          customer: i.customer,
          total: i.total,
          paid: i.paid,
          due: i.due,
        })),
        summary: [{ label: "Total i papaguar", value: fmt(invs.reduce((s, i) => s + num(i.due), 0)) }],
      };
    }
    case "clientSalesHistoryAnalytic": {
      const lines = salesLines(db, { ...f }).filter((l) => !f.client || normKey(l.party) === normKey(f.client));
      return {
        type,
        title: "Historik shitjesh klientit analitik",
        subtitle: f.client ? `${f.client} • ${sub}` : sub,
        columns: [
          { key: "date", label: "Data" },
          { key: "no", label: "Fat." },
          { key: "product", label: "Artikulli" },
          { key: "unit", label: "Njësia" },
          { key: "qty", label: "Sasia", align: "right", format: "qty" },
          { key: "rate", label: "Çmimi", align: "right", format: "money" },
          { key: "value", label: "Vlerë", align: "right", format: "money" },
        ],
        rows: lines as any,
      };
    }
    case "clientBillingPayments":
    case "supplierBillingPayments": {
      const isClient = type === "clientBillingPayments";
      const filterName = isClient ? f.client : f.supplier;
      const txn: Row[] = [];
      if (isClient) {
        db.invoices
          .filter((i) => dateOK(i.date, f.from, f.to))
          .filter((i) => !filterName || normKey(i.customer) === normKey(filterName))
          .forEach((i) =>
            txn.push({ date: i.date, party: i.customer, type: "Faturë", ref: `#${i.no}`, total: i.total, paid: i.paid, due: i.due }),
          );
        db.payments
          .filter((p) => p.partyType === "customer")
          .filter((p) => dateOK(p.date, f.from, f.to))
          .filter((p) => !filterName || normKey(p.party) === normKey(filterName))
          .forEach((p) =>
            txn.push({ date: p.date, party: p.party, type: "Pagesë", ref: p.method, total: 0, paid: p.amount, due: -p.amount }),
          );
      } else {
        db.purchases
          .filter((i) => dateOK(i.date, f.from, f.to))
          .filter((i) => !filterName || normKey(i.supplier) === normKey(filterName))
          .forEach((i) =>
            txn.push({ date: i.date, party: i.supplier, type: "Blerje", ref: `#${i.no}`, total: i.total, paid: i.paid, due: i.due }),
          );
        db.payments
          .filter((p) => p.partyType === "supplier")
          .filter((p) => dateOK(p.date, f.from, f.to))
          .filter((p) => !filterName || normKey(p.party) === normKey(filterName))
          .forEach((p) =>
            txn.push({ date: p.date, party: p.party, type: "Pagesë", ref: p.method, total: 0, paid: p.amount, due: -p.amount }),
          );
      }
      txn.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return {
        type,
        title: isClient ? "Faturime pagesa klientit" : "Faturime pagesa furnitorit",
        subtitle: sub,
        columns: [
          { key: "date", label: "Data" },
          { key: "party", label: "Pala" },
          { key: "type", label: "Lloji" },
          { key: "ref", label: "Referenca" },
          { key: "total", label: "Totali", align: "right", format: "money" },
          { key: "paid", label: "Paguar", align: "right", format: "money" },
          { key: "due", label: "Detyrim", align: "right", format: "money" },
        ],
        rows: txn,
      };
    }
    case "expenseSummary": {
      const list = (db.expenses || []).filter((e) => dateOK(e.date, f.from, f.to));
      const total = list.reduce((a, e) => a + num(e.amount), 0);
      return {
        type,
        title: "Përmbledhje shpenzimesh",
        subtitle: sub,
        columns: [
          { key: "date", label: "Data" },
          { key: "category", label: "Kategoria" },
          { key: "description", label: "Përshkrimi" },
          { key: "paymentMethod", label: "Pagesa" },
          { key: "amount", label: "Shuma", align: "right", format: "money" },
        ],
        rows: [...list]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((e) => ({
            date: e.date,
            category: e.category,
            description: e.description || "",
            paymentMethod: e.paymentMethod || "",
            amount: e.amount,
          })),
        summary: [
          { label: "Numri", value: fmt(list.length) },
          { label: "Totali", value: fmt(total) },
        ],
      };
    }
    case "expenseByCategory": {
      const list = (db.expenses || []).filter((e) => dateOK(e.date, f.from, f.to));
      const byCat = new Map<string, { count: number; total: number }>();
      for (const e of list) {
        const cur = byCat.get(e.category) || { count: 0, total: 0 };
        byCat.set(e.category, { count: cur.count + 1, total: cur.total + num(e.amount) });
      }
      const total = list.reduce((a, e) => a + num(e.amount), 0);
      const rows: Row[] = [...byCat.entries()]
        .map(([category, v]) => ({ category, count: v.count, total: v.total, share: total ? (v.total / total) * 100 : 0 }))
        .sort((a, b) => num(b.total) - num(a.total));
      return {
        type,
        title: "Shpenzime sipas kategorisë",
        subtitle: sub,
        columns: [
          { key: "category", label: "Kategoria" },
          { key: "count", label: "Numri", align: "right", format: "qty" },
          { key: "total", label: "Totali", align: "right", format: "money" },
          { key: "share", label: "Përqindja", align: "right", format: "pct" },
        ],
        rows,
        summary: [{ label: "Totali", value: fmt(total) }],
      };
    }
    case "expenseByMonth": {
      const list = (db.expenses || []).filter((e) => dateOK(e.date, f.from, f.to));
      const byMonth = new Map<string, { count: number; total: number }>();
      for (const e of list) {
        const month = e.date.slice(0, 7);
        const cur = byMonth.get(month) || { count: 0, total: 0 };
        byMonth.set(month, { count: cur.count + 1, total: cur.total + num(e.amount) });
      }
      const total = list.reduce((a, e) => a + num(e.amount), 0);
      const rows: Row[] = [...byMonth.entries()]
        .map(([month, v]) => ({ month, count: v.count, total: v.total }))
        .sort((a, b) => String(b.month).localeCompare(String(a.month)));
      return {
        type,
        title: "Shpenzime sipas muajit",
        subtitle: sub,
        columns: [
          { key: "month", label: "Muaji" },
          { key: "count", label: "Numri", align: "right", format: "qty" },
          { key: "total", label: "Totali", align: "right", format: "money" },
        ],
        rows,
        summary: [{ label: "Totali", value: fmt(total) }],
      };
    }
    case "locationReport": {
      // All sale + purchase documents with their salesman + GPS metadata.
      type LocRow = Row & { _hasGeo: number };
      const rows: LocRow[] = [];
      filteredInvoices(db, f).forEach((i) =>
        rows.push({
          docType: "Shitje",
          no: i.no,
          date: i.date,
          party: i.customer,
          salesman: i.salesmanName || i.salesman || "—",
          total: i.total,
          gps:
            i.geo?.status === "ok" || (i.latitude != null && i.longitude != null)
              ? "Po"
              : i.geo?.status
                ? `Jo (${i.geo.status})`
                : "Jo",
          maps: i.mapsUrl || (i.latitude != null && i.longitude != null ? mapsLink(i.latitude, i.longitude) : ""),
          _hasGeo: i.latitude != null && i.longitude != null ? 1 : 0,
        }),
      );
      filteredPurchases(db, f).forEach((p) =>
        rows.push({
          docType: "Blerje",
          no: p.no,
          date: p.date,
          party: p.supplier,
          salesman: p.salesmanName || p.salesman || "—",
          total: p.total,
          gps:
            p.geo?.status === "ok" || (p.latitude != null && p.longitude != null)
              ? "Po"
              : p.geo?.status
                ? `Jo (${p.geo.status})`
                : "Jo",
          maps: p.mapsUrl || (p.latitude != null && p.longitude != null ? mapsLink(p.latitude, p.longitude) : ""),
          _hasGeo: p.latitude != null && p.longitude != null ? 1 : 0,
        }),
      );
      rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || num(a.no) - num(b.no));
      const withGps = rows.filter((r) => r._hasGeo === 1).length;
      return {
        type,
        title: "Raporti i vendndodhjes (GPS)",
        subtitle: sub,
        emptyMessage: "Asnjë dokument me të dhëna vendndodhjeje në periudhë",
        columns: [
          { key: "docType", label: "Lloji" },
          { key: "no", label: "Nr." },
          { key: "date", label: "Data" },
          { key: "party", label: "Pala" },
          { key: "salesman", label: "Shitësi" },
          { key: "total", label: "Totali", align: "right", format: "money" },
          { key: "gps", label: "GPS", align: "center" },
          { key: "maps", label: "Harta" },
        ],
        rows: rows as any,
        summary: [
          { label: "Dokumente", value: fmt(rows.length) },
          { label: "Me GPS", value: fmt(withGps) },
        ],
      };
    }
    case "salesmanSummary": {
      const invs = filteredInvoices(db, f);
      const purs = filteredPurchases(db, f);
      type Agg = { sales: number; invoices: number; customers: Set<string>; gps: number; purchases: number };
      const map = new Map<string, Agg>();
      const get = (name: string): Agg => {
        const key = name || "—";
        let a = map.get(key);
        if (!a) {
          a = { sales: 0, invoices: 0, customers: new Set(), gps: 0, purchases: 0 };
          map.set(key, a);
        }
        return a;
      };
      invs.forEach((i) => {
        const a = get(i.salesmanName || i.salesman || "—");
        a.sales += num(i.total);
        a.invoices += 1;
        if (i.customer) a.customers.add(normKey(i.customer));
        if (i.latitude != null && i.longitude != null) a.gps += 1;
      });
      purs.forEach((p) => {
        const a = get(p.salesmanName || p.salesman || "—");
        a.purchases += num(p.total);
        if (p.latitude != null && p.longitude != null) a.gps += 1;
      });
      const rows: Row[] = [...map.entries()]
        .map(([salesman, a]) => ({
          salesman,
          sales: a.sales,
          invoices: a.invoices,
          customers: a.customers.size,
          purchases: a.purchases,
          gps: a.gps,
        }))
        .sort((x, y) => num(y.sales) - num(x.sales));
      return {
        type,
        title: "Përmbledhje sipas shitësit",
        subtitle: sub,
        emptyMessage: "Asnjë dokument në periudhë",
        columns: [
          { key: "salesman", label: "Shitësi" },
          { key: "sales", label: "Shitje", align: "right", format: "money" },
          { key: "invoices", label: "Fatura", align: "right", format: "qty" },
          { key: "customers", label: "Klientë", align: "right", format: "qty" },
          { key: "purchases", label: "Blerje", align: "right", format: "money" },
          { key: "gps", label: "Regj. GPS", align: "right", format: "qty" },
        ],
        rows,
        summary: [
          { label: "Shitës", value: fmt(rows.length) },
          { label: "Shitje gjithsej", value: fmt(rows.reduce((s, r) => s + num(r.sales), 0)) },
        ],
      };
    }
    case "salesmanActivity": {
      // One row per recorded route track (daily itinerary), filtered by salesman + date.
      const rows: Row[] = [];
      (db.routeTracks || [])
        .filter((r) => dateOK(r.date, f.from, f.to))
        .filter((r) => passSalesman({ salesman: r.salesman, salesmanName: r.salesman }, f))
        .forEach((r) => {
          const pts = r.points || [];
          const first = pts[0];
          const last = pts[pts.length - 1];
          rows.push({
            date: r.date,
            salesman: r.salesman || "—",
            status: r.status === "active" ? "Aktiv" : "Mbyllur",
            points: pts.length,
            startedAt: (r.startedAt || "").slice(11, 16),
            endedAt: (r.endedAt || "").slice(11, 16),
            maps: last ? mapsLink(last.lat, last.lng) : first ? mapsLink(first.lat, first.lng) : "",
          });
        });
      rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return {
        type,
        title: "Aktiviteti / Itinerari i shitësit",
        subtitle: sub,
        emptyMessage: "Asnjë itinerar i regjistruar në periudhë",
        columns: [
          { key: "date", label: "Data" },
          { key: "salesman", label: "Shitësi" },
          { key: "status", label: "Statusi", align: "center" },
          { key: "points", label: "Pika GPS", align: "right", format: "qty" },
          { key: "startedAt", label: "Fillimi", align: "center" },
          { key: "endedAt", label: "Mbarimi", align: "center" },
          { key: "maps", label: "Harta (pika e fundit)" },
        ],
        rows,
        summary: [
          { label: "Itinerare", value: fmt(rows.length) },
          { label: "Pika GPS gjithsej", value: fmt(rows.reduce((s, r) => s + num(r.points), 0)) },
        ],
      };
    }
  }
  return {
    type,
    title: "Raport",
    subtitle: sub,
    columns: [],
    rows: [],
  };
}

/** Google Maps deep link helper (mirrors store.mapsUrl, kept local for reports). */
function mapsLink(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

// ---------- HTML for PDF / share ----------
export function renderReportHtml(
  result: ReportResult,
  opts: { companyName?: string; period?: string; filters?: ReportFilter; currency?: string } = {},
): string {
  const fmtCell = (val: any, fmt?: Column["format"]) => {
    if (fmt === "money") return Number(val || 0).toLocaleString("sq-AL", { maximumFractionDigits: 2 });
    if (fmt === "qty") return Number(val || 0).toLocaleString("sq-AL", { maximumFractionDigits: 2 });
    if (fmt === "pct") return `${Number(val || 0).toFixed(1)}%`;
    return String(val ?? "");
  };
  const fset = opts.filters || {};
  const filterRow = `
    <div class="filters">
      <div><b>Nga</b> ${fset.from || "—"}</div>
      <div><b>Deri</b> ${fset.to || "—"}</div>
      <div><b>Klienti</b> ${fset.client || "Të gjithë"}</div>
      <div><b>Furnitori</b> ${fset.supplier || "Të gjithë"}</div>
      <div><b>Artikulli</b> ${fset.product || "Të gjithë"}</div>
      <div><b>Magazina</b> ${fset.store || "Të gjitha"}</div>
    </div>
  `;
  const head = result.columns
    .map((c) => `<th style="text-align:${c.align || "left"}">${c.label}</th>`)
    .join("");
  const body = result.rows
    .map(
      (r) =>
        `<tr${(r as any)._total ? ' class="totrow"' : ""}>${result.columns
          .map(
            (c) =>
              `<td style="text-align:${c.align || "left"};white-space:nowrap">${fmtCell((r as any)[c.key], c.format)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  const summary = (result.summary || [])
    .map((s) => `<div class="kv"><span>${s.label}</span><b>${s.value}</b></div>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    @page{size:A4 landscape;margin:8mm}
    body{font-family:Arial,Helvetica,sans-serif;color:#0f172a;margin:0;padding:0}
    h1{font-size:18px;margin:0 0 6px}
    .sub{color:#475569;font-size:11px;margin-bottom:8px}
    .filters{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;font-size:9px;color:#475569;margin:0 0 8px}
    .filters div{border:1px solid #cbd5e1;padding:4px;border-radius:4px;background:#f8fafc}
    .summary{display:flex;flex-wrap:wrap;gap:10px;margin:6px 0 10px}
    .kv{border:1px solid #cbd5e1;border-radius:6px;padding:6px 10px;background:#f1f5f9;font-size:11px}
    .kv span{color:#64748b;display:block;font-size:10px}
    .kv b{font-size:13px}
    table{width:100%;border-collapse:collapse;font-size:10px}
    th,td{border:1px solid #cbd5e1;padding:4px 6px;vertical-align:top}
    th{background:#e2e8f0;color:#0f172a;text-align:left}
    tr:nth-child(even) td{background:#f8fafc}
    tr.totrow td{background:#16a34a;color:#fff;font-weight:800}
    .footer{margin-top:14px;color:#64748b;font-size:10px;text-align:center}
  </style></head><body>
    <h1>${result.title}</h1>
    <div class="sub">${opts.companyName || ""} ${result.subtitle ? `• ${result.subtitle}` : ""}</div>
    ${filterRow}
    ${summary ? `<div class="summary">${summary}</div>` : ""}
    <table><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${result.columns.length}" style="text-align:center;color:#64748b">Pa të dhëna</td></tr>`}</tbody></table>
    <div class="footer">Gjeneruar nga ${opts.companyName || "Sistemi Genit"} • ${new Date().toLocaleString("sq-AL")}</div>
  </body></html>`;
}
