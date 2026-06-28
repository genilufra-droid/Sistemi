/**
 * Sistemi Genit — JSON Backup / Restore (Phase 1, Part 2).
 *
 * A backup is a SINGLE self-describing JSON document containing the complete
 * database plus metadata (app name, version, export date, record counts).
 * Import is validated, previewed (record counts) and applied all-or-nothing.
 * There is NO XLSX/CSV backup and NO scheduled/automatic backup here — only
 * manual JSON export / import / restore.
 *
 * These helpers are pure (no Expo/native imports) so they can be unit-tested
 * and reused by the Backup/Restore screens.
 */
import type { DB, MultiDB, CompanyMeta } from "./store";
import { migrateDB, migrateMultiDB } from "./store";

/** Backup format version. Bumped with the app version for Phase 1. */
export const BACKUP_VERSION = "1.0.18";
export const BACKUP_APP_NAME = "Sistemi Genit";

/** The entity keys we count + carry in a backup. */
export type RecordCounts = {
  warehouses: number;
  products: number;
  customers: number;
  suppliers: number;
  invoices: number;
  purchases: number;
  payments: number;
  expenses: number;
  transfers: number;
  storeTransfers: number;
  stockAdjustments: number;
  priceHistory: number;
  salesmen: number;
  routeTracks: number;
};

/** The on-disk backup envelope. */
export type BackupFile = {
  app: string;
  version: string;
  exportDate: string;
  recordCounts: RecordCounts;
  data: DB;
};

/** Count the records of every tracked entity in a DB. */
export function recordCountsOf(db: DB): RecordCounts {
  return {
    warehouses: (db.warehouses || []).length,
    products: (db.products || []).length,
    customers: (db.customers || []).length,
    suppliers: (db.suppliers || []).length,
    invoices: (db.invoices || []).length,
    purchases: (db.purchases || []).length,
    payments: (db.payments || []).length,
    expenses: (db.expenses || []).length,
    transfers: (db.transfers || []).length,
    storeTransfers: (db.storeTransfers || []).length,
    stockAdjustments: (db.stockAdjustments || []).length,
    priceHistory: (db.priceHistory || []).length,
    salesmen: (db.salesmen || []).length,
    routeTracks: (db.routeTracks || []).length,
  };
}

/** Total number of records across all entities (for summary display). */
export function totalRecords(counts: RecordCounts): number {
  return Object.values(counts).reduce((s, n) => s + Number(n || 0), 0);
}

/** Build a complete backup envelope from a DB. */
export function buildBackup(db: DB, exportDate?: string): BackupFile {
  return {
    app: BACKUP_APP_NAME,
    version: BACKUP_VERSION,
    exportDate: exportDate || new Date().toISOString(),
    recordCounts: recordCountsOf(db),
    data: db,
  };
}

/** Serialize a DB to a pretty JSON backup string. */
export function serializeBackup(db: DB, exportDate?: string): string {
  return JSON.stringify(buildBackup(db, exportDate), null, 2);
}

/**
 * Backup filename: `Sistemi_Genit_Backup_YYYY-MM-DD_HH-mm.json`.
 * Uses the provided Date (or now). Always local-time based.
 */
export function backupFilename(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
    d.getHours(),
  )}-${pad(d.getMinutes())}`;
  return `Sistemi_Genit_Backup_${stamp}.json`;
}

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  /** Detected version (envelope version, or "legacy" for a raw DB). */
  version: string;
  /** The DB payload, when extractable. */
  data?: DB;
  /** Record counts, when extractable. */
  recordCounts?: RecordCounts;
  /** Export date, when present. */
  exportDate?: string;
};

/**
 * Validate a parsed backup object. Accepts both the new envelope
 * ({ app, version, data }) AND a legacy raw DB (a bare object with `products`).
 * Returns Albanian error messages on failure.
 */
export function validateBackupStructure(obj: any): ValidationResult {
  const errors: string[] = [];
  if (!obj || typeof obj !== "object") {
    return { ok: false, errors: ["Skedari nuk është JSON i vlefshëm."], version: "" };
  }
  // New envelope format.
  const isEnvelope = "data" in obj && obj.data && typeof obj.data === "object" && "version" in obj;
  const db: any = isEnvelope ? obj.data : obj;
  const version: string = isEnvelope ? String(obj.version || "") : "legacy";

  if (!db || typeof db !== "object") {
    errors.push("Mungojnë të dhënat (data) në skedar.");
    return { ok: false, errors, version };
  }
  if (!Array.isArray(db.products)) {
    errors.push("Mungon lista e artikujve (products).");
  }
  if (!Array.isArray(db.customers)) {
    errors.push("Mungon lista e klientëve (customers).");
  }
  if (!db.company || typeof db.company !== "object") {
    errors.push("Mungojnë të dhënat e kompanisë (company).");
  }
  if (errors.length) return { ok: false, errors, version };

  // Normalize/migrate so warehouses/transfers exist and stores are synced.
  const migrated = migrateDB({ ...db } as DB);
  return {
    ok: true,
    errors: [],
    version,
    data: migrated,
    recordCounts: recordCountsOf(migrated),
    exportDate: isEnvelope ? String(obj.exportDate || "") : undefined,
  };
}

/** Parse + validate a raw JSON string into a validation result. */
export function parseBackup(raw: string): ValidationResult {
  let obj: any;
  try {
    obj = JSON.parse(raw);
  } catch (_e) {
    return { ok: false, errors: ["Skedari nuk është JSON i vlefshëm."], version: "" };
  }
  return validateBackupStructure(obj);
}

/** A short human-readable preview line for a record-counts object (Albanian). */
export function previewSummary(counts: RecordCounts): string {
  return [
    `${counts.warehouses} magazina`,
    `${counts.products} artikuj`,
    `${counts.customers} klientë`,
    `${counts.suppliers} furnitorë`,
    `${counts.invoices} fatura shitje`,
    `${counts.purchases} blerje`,
    `${counts.payments} pagesa`,
    `${counts.transfers} transferime`,
  ].join(" • ");
}

// ============================================================================
// Multi-company backup (Phase 1) — backup/restore ALL companies in one file.
// The single-company helpers above remain fully supported.
// ============================================================================

/** Per-company summary inside a multi-company backup. */
export type CompanyBackupSummary = {
  id: string;
  name: string;
  counts: RecordCounts;
};

/** The on-disk multi-company backup envelope. */
export type MultiBackupFile = {
  app: string;
  version: string;
  kind: "multi";
  exportDate: string;
  activeCompanyId: string;
  companies: CompanyMeta[];
  companySummaries: CompanyBackupSummary[];
  data: Record<string, DB>;
};

/** Build a multi-company backup envelope from a MultiDB. */
export function buildMultiBackup(mdb: MultiDB, exportDate?: string): MultiBackupFile {
  return {
    app: BACKUP_APP_NAME,
    version: BACKUP_VERSION,
    kind: "multi",
    exportDate: exportDate || new Date().toISOString(),
    activeCompanyId: mdb.activeCompanyId,
    companies: mdb.companies,
    companySummaries: mdb.companies.map((c) => ({
      id: c.id,
      name: c.name,
      counts: recordCountsOf(mdb.data[c.id] || ({} as DB)),
    })),
    data: mdb.data,
  };
}

export function serializeMultiBackup(mdb: MultiDB, exportDate?: string): string {
  return JSON.stringify(buildMultiBackup(mdb, exportDate), null, 2);
}

export function multiBackupFilename(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
    d.getHours(),
  )}-${pad(d.getMinutes())}`;
  return `Sistemi_Genit_AllCompanies_${stamp}.json`;
}

export type MultiValidationResult = {
  ok: boolean;
  errors: string[];
  version: string;
  /** The MultiDB payload, when extractable. */
  mdb?: MultiDB;
  companySummaries?: CompanyBackupSummary[];
  exportDate?: string;
};

/** True when a parsed object looks like a multi-company backup envelope. */
export function isMultiBackup(obj: any): boolean {
  return (
    !!obj &&
    typeof obj === "object" &&
    (obj.kind === "multi" || (Array.isArray(obj.companies) && obj.data && typeof obj.data === "object" && !Array.isArray(obj.data) && !("products" in obj.data)))
  );
}

/** Validate + normalize a multi-company backup object. */
export function validateMultiBackup(obj: any): MultiValidationResult {
  const errors: string[] = [];
  if (!obj || typeof obj !== "object") {
    return { ok: false, errors: ["Skedari nuk është JSON i vlefshëm."], version: "" };
  }
  if (!Array.isArray(obj.companies) || !obj.companies.length) {
    errors.push("Mungon lista e kompanive (companies).");
  }
  if (!obj.data || typeof obj.data !== "object") {
    errors.push("Mungojnë të dhënat e kompanive (data).");
  }
  if (errors.length) return { ok: false, errors, version: String(obj.version || "") };

  const mdb = migrateMultiDB({
    schema: 2,
    activeCompanyId: obj.activeCompanyId,
    companies: obj.companies,
    data: obj.data,
  } as MultiDB);

  const summaries: CompanyBackupSummary[] = mdb.companies.map((c) => ({
    id: c.id,
    name: c.name,
    counts: recordCountsOf(mdb.data[c.id]),
  }));

  return {
    ok: true,
    errors: [],
    version: String(obj.version || ""),
    mdb,
    companySummaries: summaries,
    exportDate: obj.exportDate ? String(obj.exportDate) : undefined,
  };
}

/** Parse a raw JSON string into a multi-company validation result. */
export function parseMultiBackup(raw: string): MultiValidationResult {
  let obj: any;
  try {
    obj = JSON.parse(raw);
  } catch (_e) {
    return { ok: false, errors: ["Skedari nuk është JSON i vlefshëm."], version: "" };
  }
  return validateMultiBackup(obj);
}

/** Human-readable preview for a multi-company backup (Albanian). */
export function multiPreviewSummary(summaries: CompanyBackupSummary[]): string {
  return summaries
    .map((s) => `${s.name}: ${s.counts.products} artikuj, ${s.counts.invoices} fatura`)
    .join("\n");
}
