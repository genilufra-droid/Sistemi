/**
 * Sistemi Genit data store - AsyncStorage backed
 * Albanian Vyapar clone — central business data
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";

export const STORAGE_KEY = "sistemi_genit_db_v1";

export type Unit = { name: string; coef: number };

export type Product = {
  id: number;
  code?: string;
  barcode?: string;
  name: string;
  category?: string;
  /** Default/home store for the item (where opening stock was placed). */
  store?: string;
  salePiece: number;
  buyPiece: number;
  /** Up to 10 sale prices per item, indexed 0..9. Names are taken from company.priceListNames. */
  prices?: number[];
  /**
   * Total stock in BASE units across all stores. Kept in sync with `stockByStore`.
   * Legacy field — `stockByStore` is the source of truth when present.
   */
  stock: number;
  /** Stock in BASE units per store name, e.g. { "Magazina kryesore": 120, "Rugova": 36 }. */
  stockByStore?: Record<string, number>;
  minStock?: number;
  units: Unit[];
};

export type Customer = {
  id: number;
  name: string;
  phone?: string;
  nipt?: string;
  city?: string;
  address?: string;
  openingBalance?: number;
  limit?: number;
  note?: string;
  /** 0..9 — default price-list index applied at sale time. */
  defaultPriceList?: number;
};

export type Supplier = Customer;

export type InvoiceItem = {
  productName: string;
  qty: number;
  freeQty: number;
  unit: string;
  rate: number;
  buyRate: number;
  total: number;
  cost: number;
  /** Index 0..9 of the price list used on this line, when available. */
  priceList?: number;
};

/**
 * GPS location captured when a document is saved. Mirrors the HTML `geo` object.
 * `status` is "ok" when coordinates are present, else "denied"/"timeout"/etc.
 */
export type GeoLocation = {
  status: "ok" | "denied" | "timeout" | "unavailable" | "unsupported";
  lat?: number;
  lng?: number;
  accuracy?: number;
  capturedAt?: string;
  error?: string;
};

/** Salesman + GPS metadata attached to a sale/purchase document. */
export type DocLocationFields = {
  /** Salesman name responsible for the document. */
  salesman?: string;
  salesmanName?: string;
  /** ISO timestamp when the salesman/location were captured. */
  salesmanCapturedAt?: string;
  /** Active route id (if route tracking was ON). */
  routeTrackId?: string;
  /** Full geo object. */
  geo?: GeoLocation;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  /** Google Maps deep link, e.g. https://maps.google.com/?q=lat,lng */
  mapsUrl?: string;
  /** Non-ok geo status shorthand (e.g. "denied"). */
  locationStatus?: string;
};

export type Invoice = {
  no: number;
  date: string;
  time: string;
  customer: string;
  billingName?: string;
  store?: string;
  mode: "Me detyrim" | "Me arke";
  items: InvoiceItem[];
  subtotal: number;
  roundOff: number;
  total: number;
  paid: number;
  due: number;
  /** Kusuri (change returned to customer) when paid > total. */
  change?: number;
  paymentType: string;
  note?: string;
  totalCost: number;
  profit: number;
  /** v1.0.17 — auto-linked warehouse Fletë Dalje (outbound) document. */
  autoCreateOutboundDoc?: boolean;
  linkedOutboundDocId?: number;
  linkedOutboundDocNo?: string;
  /** Warehouse used for the linked Fletë Dalje. */
  warehouseName?: string;
  /** Reserved link to a future Offer/Preventiv (v1.0.19). */
  linkedOfferId?: string;
} & DocLocationFields;

export type Purchase = {
  no: number;
  date: string;
  time: string;
  supplier: string;
  billingName?: string;
  store?: string;
  mode: "Me detyrim" | "Me arke";
  items: InvoiceItem[];
  subtotal: number;
  roundOff: number;
  total: number;
  paid: number;
  due: number;
  paymentType: string;
  note?: string;
  /** v1.0.17 — auto-linked warehouse Fletë Hyrje (inbound) document. */
  autoCreateInboundDoc?: boolean;
  linkedInboundDocId?: number;
  linkedInboundDocNo?: string;
  /** Warehouse used for the linked Fletë Hyrje. */
  warehouseName?: string;
  /** Reserved link to a future Purchase Order (v1.0.20). */
  linkedPurchaseOrderId?: string;
} & DocLocationFields;

/** A salesman known to the system. */
export type Salesman = {
  name: string;
  createdAt: string;
  phone?: string;
};

/** A single GPS point recorded while a route was active. */
export type RoutePoint = {
  lat: number;
  lng: number;
  accuracy?: number;
  capturedAt: string;
  source?: string;
};

/** A salesman's daily route track (a sequence of GPS points). */
export type RouteTrack = {
  id: string;
  salesman: string;
  date: string;
  startedAt: string;
  endedAt?: string;
  status: "active" | "ended";
  points: RoutePoint[];
};

export type Payment = {
  id: number;
  partyType: "customer" | "supplier";
  party: string;
  date: string;
  amount: number;
  method: string;
  ref?: string;
  note?: string;
};

export type PriceHistoryRow = {
  product: string;
  fromDate: string;
  salePiece: number;
  buyPiece: number;
  note?: string;
};

export type StockAdjustment = {
  id: number;
  date: string;
  store: string;
  product: string;
  unit: string;
  qty: number;
  type: "add" | "reduce";
  price: number;
  details?: string;
};

export type Company = {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  nipt?: string;
  city?: string;
  currency: string;
  footer?: string;
  logoUri?: string;
  /** Names for the 10 sale price lists (length 10). */
  priceListNames?: string[];
};

export type Expense = {
  id: number;
  date: string;
  category: string;
  description?: string;
  amount: number;
  paymentMethod: string;
  ref?: string;
};

export type StoreTransfer = {
  id: number;
  date: string;
  fromStore: string;
  toStore: string;
  product: string;
  unit: string;
  qty: number;
  note?: string;
};

/**
 * A warehouse / inventory location (Magazina). Phase 1 multi-warehouse model.
 * Stock per warehouse is tracked on each product via `stockByStore`, keyed by
 * the warehouse NAME (kept unique). `stores: string[]` mirrors the names of the
 * ACTIVE warehouses for backward compatibility with existing screens/reports.
 */
export type WarehouseType = "main" | "van" | "branch" | "reserve";

export type Warehouse = {
  id: number;
  name: string;
  address?: string;
  /** main warehouse / van / branch / reserve. Defaults to "main". */
  type?: WarehouseType;
  status: "active" | "inactive";
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

/** Albanian labels for the warehouse types. */
export const WAREHOUSE_TYPE_LABELS: Record<WarehouseType, string> = {
  main: "Magazina kryesore",
  van: "Furgon",
  branch: "Degë",
  reserve: "Rezervë",
};

/**
 * A stock transfer between two warehouses. `qty` is in `unit`; `pieces` is the
 * base-unit (copë) amount actually moved. `transferNo` is TR-YYYYMMDD-NNN.
 */
export type Transfer = {
  id: number;
  transferNo: string;
  date: string;
  fromWarehouse: string;
  toWarehouse: string;
  product: string;
  unit: string;
  qty: number;
  pieces: number;
  note?: string;
  createdAt: string;
};

export type AppSettings = {
  favoriteReports: string[];
  defaultPrinter?: { name: string; address: string; width: 58 | 80 };
  /** Name of the salesman currently logged in / operating the app. */
  salesmanName?: string;
  /** Whether GPS location should be captured automatically when saving documents. */
  gpsEnabled?: boolean;
};

// ---------------------------------------------------------------------------
// Warehouse documents (Phase 1): Fletë Hyrje / Fletë Dalje / Inventar Fizik
// plus a per-warehouse Stock Movement ledger. All quantities use the existing
// multi-unit logic (unit + coef -> baseQty in pieces).
// ---------------------------------------------------------------------------

/** A single line on a warehouse document. */
export type WarehouseDocLine = {
  productName: string;
  unit: string;
  /** Quantity in the selected unit. */
  qty: number;
  /** Coefficient of the selected unit (pieces per unit). */
  coef: number;
  /** Quantity converted to BASE units (pieces). */
  baseQty: number;
  /**
   * Çmimi — price PER SELECTED UNIT (e.g. price per Koli). The visible price
   * column on the Fletë Dalje/Hyrje follows the selected unit, never the piece
   * cost. Vlefta = qty × price.
   */
  price?: number;
  /** Çmimi Kosto Copë — cost per BASE unit (piece), for optional cost valuation. */
  costPiece?: number;
  /**
   * @deprecated kept for back-compat — mirrors `price`. Older docs stored the
   * per-unit price here. New code should read `price`.
   */
  cost?: number;
  /** Vlefta = qty × price (in the selected unit). */
  value?: number;
  /** True when this is a FREE / gift (DHURATË) line: price 0, value 0, still moves stock. */
  isGift?: boolean;
  note?: string;
};

/** A physical-inventory line carries system vs counted quantities (base units). */
export type InventoryDocLine = WarehouseDocLine & {
  /** Stock currently in the warehouse for this product (base units). */
  systemQty: number;
  /** Quantity the user counted, converted to base units. */
  countedQty: number;
  /** countedQty - systemQty (base units). */
  diff: number;
};

/** Fletë Hyrje — increases stock in a warehouse. */
export type InboundDoc = {
  id: number;
  no: string;
  date: string;
  warehouse: string;
  reason?: string;
  note?: string;
  createdBy?: string;
  status: "saved" | "cancelled";
  lines: WarehouseDocLine[];
  createdAt: string;
  /** v1.0.17 — how this doc was created and what it is linked to. */
  sourceType?: "SALE_INVOICE" | "PURCHASE_INVOICE" | "MANUAL";
  sourceInvoiceId?: number;
  sourceInvoiceNo?: number;
  sourcePurchaseId?: number;
  sourcePurchaseNo?: number;
  /** Customer/supplier copied from the source document for printing. */
  customerName?: string;
  supplierName?: string;
  supplierInvoiceNo?: string;
  /** "Adresa ku shkon malli" for the printed Fletë Dalje. */
  destinationAddress?: string;
};

/** Fletë Dalje — decreases stock from a warehouse. */
export type OutboundDoc = InboundDoc;

/** Inventar Fizik — reconciles counted stock against system stock. */
export type InventoryDoc = {
  id: number;
  no: string;
  date: string;
  warehouse: string;
  note?: string;
  createdBy?: string;
  status: "saved" | "cancelled";
  lines: InventoryDocLine[];
  createdAt: string;
};

/** Type of stock movement recorded in the ledger. */
export type StockMovementType =
  | "sale"
  | "purchase"
  | "gift"
  | "inbound"
  | "outbound"
  | "transfer-in"
  | "transfer-out"
  | "inventory";

/** A single immutable stock-movement ledger entry (per warehouse + product). */
export type StockMovement = {
  id: number;
  date: string;
  time?: string;
  warehouse: string;
  productName: string;
  docType: StockMovementType;
  docNo: string;
  /** Base units that came IN (0 for out-movements). */
  inBase: number;
  /** Base units that went OUT (0 for in-movements). */
  outBase: number;
  /** Warehouse balance for this product AFTER applying the movement. */
  balanceAfter: number;
  note?: string;
  createdAt: string;
};

/**
 * Company metadata for the multi-company container. The per-company business
 * data lives in its own full `DB` slice (see `MultiDB`), so company isolation is
 * automatic — switching company swaps the whole slice.
 */
export type CompanyMeta = {
  id: string;
  name: string;
  nipt?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUri?: string;
  currency: string;
  status: "active" | "inactive";
  createdAt: string;
};

/** Multi-company persistence envelope (schema 2). */
export type MultiDB = {
  schema: 2;
  activeCompanyId: string;
  companies: CompanyMeta[];
  /** companyId -> full single-company DB slice. */
  data: Record<string, DB>;
};

export type DB = {
  company: Company;
  stores: string[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  invoices: Invoice[];
  purchases: Purchase[];
  payments: Payment[];
  priceHistory: PriceHistoryRow[];
  stockAdjustments: StockAdjustment[];
  expenses: Expense[];
  expenseCategories: string[];
  storeTransfers: StoreTransfer[];
  /** Rich warehouse definitions (Phase 1 multi-warehouse). */
  warehouses?: Warehouse[];
  /** Warehouse-to-warehouse stock transfers (Phase 1). */
  transfers?: Transfer[];
  /** Fletë Hyrje documents (stock in). */
  inboundDocs?: InboundDoc[];
  /** Fletë Dalje documents (stock out). */
  outboundDocs?: OutboundDoc[];
  /** Inventar Fizik documents (physical inventory). */
  inventoryDocs?: InventoryDoc[];
  /** Per-warehouse stock movement ledger. */
  stockMovements?: StockMovement[];
  settings: AppSettings;
  /** Known salesmen. */
  salesmen?: Salesman[];
  /** Daily route tracks (GPS point sequences) per salesman. */
  routeTracks?: RouteTrack[];
  /** Salesman currently selected for new documents. */
  currentSalesman?: string;
  nextInvoice: number;
  nextPurchase: number;
  /** Per-client last 5 sale prices per product (for smart price suggestions in sale screen). */
  clientPriceHistory?: Record<string, ClientPriceRecord[]>;
};

const DEFAULT_DB: DB = {
  company: {
    name: "SISTEMI GENIT",
    address: "LUSHNJE",
    phone: "",
    email: "",
    nipt: "",
    city: "",
    currency: "LEK",
    footer: "Gjeneruar nga Sistemi Genit",
    priceListNames: [
      "Pakicë",
      "Shumicë",
      "Lista 3",
      "Lista 4",
      "Lista 5",
      "Lista 6",
      "Lista 7",
      "Lista 8",
      "Lista 9",
      "Lista 10",
    ],
  },
  stores: ["Magazina kryesore"],
  products: [
    {
      id: 1,
      code: "A001",
      name: "UJE 0.5L",
      category: "Pije",
      store: "Magazina kryesore",
      salePiece: 25,
      buyPiece: 18,
      stock: 300,
      minStock: 24,
      units: [
        { name: "Copë", coef: 1 },
        { name: "Koli", coef: 12 },
        // 1 Paletë = 114 Koli × 12 copë/Koli = 1.368 copë (base units).
        { name: "Paletë", coef: 1368 },
      ],
    },
    {
      id: 2,
      code: "A002",
      name: "KOLA KANACE",
      category: "Pije",
      store: "Magazina kryesore",
      salePiece: 104,
      buyPiece: 83,
      stock: 500,
      minStock: 24,
      units: [
        { name: "Copë", coef: 1 },
        { name: "Koli", coef: 12 },
      ],
    },
  ],
  customers: [
    { id: 1, name: "Klient Rastesor" },
    { id: 2, name: "Prenga", city: "Lushnje" },
    { id: 3, name: "Adelina Kolonj" },
    { id: 4, name: "Afrimi Lokali Dasmave" },
    { id: 5, name: "Cash Sale" },
  ],
  suppliers: [{ id: 1, name: "Rugove" }],
  invoices: [],
  purchases: [],
  payments: [],
  priceHistory: [
    { product: "UJE 0.5L", fromDate: "1900-01-01", salePiece: 25, buyPiece: 18 },
    { product: "KOLA KANACE", fromDate: "1900-01-01", salePiece: 104, buyPiece: 83 },
  ],
  stockAdjustments: [],
  expenses: [],
  expenseCategories: [
    "Qira",
    "Rrymë",
    "Ujë",
    "Karburant",
    "Paga",
    "Transport",
    "Telefon / Internet",
    "Materiale zyre",
    "Mirëmbajtje",
    "Të tjera",
  ],
  storeTransfers: [],
  warehouses: [
    {
      id: 1,
      name: "Magazina kryesore",
      address: "LUSHNJE",
      status: "active",
      notes: "",
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
    },
  ],
  transfers: [],
  settings: {
    favoriteReports: ["saleSummary", "profitLoss", "unpaidInvoices", "stockSummary"],
    gpsEnabled: true,
  },
  salesmen: [],
  routeTracks: [],
  currentSalesman: "",
  nextInvoice: 1058,
  nextPurchase: 1,
};

// ------------- helpers -------------
export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
export function nowTimeStr() {
  return new Date().toTimeString().slice(0, 5);
}
export function num(v: any): number {
  const n = Number(String(v ?? 0).replace(/[^\d.-]/g, ""));
  return isFinite(n) ? n : 0;
}
export function money(v: number, currency = "L"): string {
  const n = Number(v || 0);
  return `${currency} ${n.toLocaleString("sq-AL", { maximumFractionDigits: 2 })}`;
}
export function fmt(v: number): string {
  return Number(v || 0).toLocaleString("sq-AL", { maximumFractionDigits: 2 });
}

/** Returns the sale price for a product at the given price-list index, falling back to salePiece. */
export function priceForList(p: Product | undefined, listIdx?: number): number {
  if (!p) return 0;
  const idx = Math.max(0, Math.min(9, num(listIdx ?? 0)));
  const list = p.prices || [];
  const v = num(list[idx]);
  return v > 0 ? v : num(p.salePiece);
}

/** Returns the sale price the given customer should see for a product, using their defaultPriceList. */
export function priceForCustomer(db: DB, p: Product | undefined, customerName: string): number {
  const c = db.customers.find((x) => x.name === customerName);
  return priceForList(p, c?.defaultPriceList ?? 0);
}

export function unitCoef(p: Product | undefined, unit: string): number {
  if (!p) return 1;
  return p.units.find((u) => u.name.toLowerCase() === unit.toLowerCase())?.coef || 1;
}

export function activePrice(
  db: DB,
  productName: string,
  date?: string,
): { salePiece: number; buyPiece: number } {
  const d = (date || todayStr()).slice(0, 10);
  const rows = db.priceHistory
    .filter((r) => r.product === productName && r.fromDate <= d)
    .sort((a, b) => a.fromDate.localeCompare(b.fromDate));
  if (rows.length) {
    const r = rows[rows.length - 1];
    return { salePiece: r.salePiece, buyPiece: r.buyPiece };
  }
  const p = db.products.find((p) => p.name === productName);
  return { salePiece: p?.salePiece || 0, buyPiece: p?.buyPiece || 0 };
}

export function partyDue(db: DB, name: string): number {
  const inv = db.invoices.filter((i) => i.customer === name).reduce((s, i) => s + num(i.due), 0);
  const c = db.customers.find((c) => c.name === name);
  const opening = num(c?.openingBalance || 0);
  const pays = db.payments
    .filter((p) => p.partyType === "customer" && p.party === name)
    .reduce((s, p) => s + num(p.amount), 0);
  return opening + inv - pays;
}

export function supplierDue(db: DB, name: string): number {
  const pur = db.purchases.filter((p) => p.supplier === name).reduce((s, p) => s + num(p.due), 0);
  const sup = db.suppliers.find((s) => s.name === name);
  const opening = num(sup?.openingBalance || 0);
  const pays = db.payments
    .filter((p) => p.partyType === "supplier" && p.party === name)
    .reduce((s, p) => s + num(p.amount), 0);
  return opening + pur - pays;
}

// ---------------------------------------------------------------------------
// Multi-warehouse migration + helpers (Phase 1)
// `warehouses` is the rich source of truth; `stores: string[]` mirrors the
// names of ACTIVE warehouses for backward compatibility. Per-warehouse stock
// lives on each product's `stockByStore`, keyed by warehouse NAME.
// ---------------------------------------------------------------------------

/** Ensure warehouses/transfers exist and `stores` mirrors active warehouse names. */
export function migrateDB(db: DB): DB {
  const next: DB = { ...db };
  if (!Array.isArray(next.transfers)) next.transfers = [];
  if (!Array.isArray(next.storeTransfers)) next.storeTransfers = [];
  if (!Array.isArray(next.inboundDocs)) next.inboundDocs = [];
  if (!Array.isArray(next.outboundDocs)) next.outboundDocs = [];
  if (!Array.isArray(next.inventoryDocs)) next.inventoryDocs = [];
  if (!Array.isArray(next.stockMovements)) next.stockMovements = [];
  // Build warehouses from legacy `stores` when missing/empty.
  if (!Array.isArray(next.warehouses) || next.warehouses.length === 0) {
    const names = (next.stores && next.stores.length ? next.stores : ["Magazina kryesore"]);
    const now = new Date().toISOString();
    next.warehouses = names.map((name, i) => ({
      id: i + 1,
      name,
      address: "",
      status: "active",
      notes: "",
      createdAt: now,
      updatedAt: now,
    }));
  } else {
    // Make sure any store name not yet represented as a warehouse is added.
    const have = new Set(next.warehouses.map((w) => w.name));
    const now = new Date().toISOString();
    (next.stores || []).forEach((name) => {
      if (name && !have.has(name)) {
        next.warehouses!.push({
          id: nextWarehouseId(next),
          name,
          address: "",
          status: "active",
          notes: "",
          createdAt: now,
          updatedAt: now,
        });
        have.add(name);
      }
    });
  }
  // Mirror active warehouse names into `stores` (preserve order, ensure ≥1).
  return syncStoresFromWarehouses(next);
}

/** Recompute `stores` as the list of ACTIVE warehouse names. */
export function syncStoresFromWarehouses(db: DB): DB {
  const active = (db.warehouses || []).filter((w) => w.status === "active").map((w) => w.name);
  const names = active.length ? active : (db.warehouses || []).map((w) => w.name);
  return { ...db, stores: names.length ? names : ["Magazina kryesore"] };
}

export function nextWarehouseId(db: DB): number {
  return Math.max(0, ...((db.warehouses || []).map((w) => w.id))) + 1;
}

/** All warehouses (active + inactive). */
export function allWarehouses(db: DB): Warehouse[] {
  return db.warehouses || [];
}

/** Only active warehouses. */
export function activeWarehouses(db: DB): Warehouse[] {
  return (db.warehouses || []).filter((w) => w.status === "active");
}

/** Names of active warehouses (for pickers / dropdowns). */
export function warehouseNames(db: DB, onlyActive = true): string[] {
  return (onlyActive ? activeWarehouses(db) : allWarehouses(db)).map((w) => w.name);
}

/** Look up a warehouse by id or (case-insensitive) name. */
export function findWarehouse(db: DB, idOrName: number | string): Warehouse | undefined {
  if (typeof idOrName === "number") return (db.warehouses || []).find((w) => w.id === idOrName);
  const key = normName(idOrName);
  return (db.warehouses || []).find((w) => normName(w.name) === key);
}

/** Create a warehouse. Returns the new DB (immutable). Throws on duplicate/empty name. */
export function createWarehouse(
  db: DB,
  input: {
    name: string;
    type?: WarehouseType;
    address?: string;
    notes?: string;
    status?: "active" | "inactive";
  },
): DB {
  const name = (input.name || "").trim();
  if (!name) throw new Error("Emri i magazinës është i detyrueshëm.");
  if (findWarehouse(db, name)) throw new Error("Kjo magazinë ekziston tashmë.");
  const now = new Date().toISOString();
  const wh: Warehouse = {
    id: nextWarehouseId(db),
    name,
    type: input.type || "branch",
    address: (input.address || "").trim(),
    notes: (input.notes || "").trim(),
    status: input.status || "active",
    createdAt: now,
    updatedAt: now,
  };
  return syncStoresFromWarehouses({ ...db, warehouses: [...(db.warehouses || []), wh] });
}

/** Update a warehouse's editable fields. Renaming migrates stock + document references. */
export function updateWarehouse(
  db: DB,
  id: number,
  patch: { name?: string; type?: WarehouseType; address?: string; notes?: string; status?: "active" | "inactive" },
): DB {
  const wh = findWarehouse(db, id);
  if (!wh) throw new Error("Magazina nuk u gjet.");
  const newName = patch.name != null ? patch.name.trim() : wh.name;
  if (!newName) throw new Error("Emri i magazinës është i detyrueshëm.");
  const clash = (db.warehouses || []).find((w) => w.id !== id && normName(w.name) === normName(newName));
  if (clash) throw new Error("Kjo magazinë ekziston tashmë.");
  let next: DB = { ...db };
  // Rename everywhere if the name changed.
  if (normName(newName) !== normName(wh.name)) {
    next = renameWarehouseEverywhere(next, wh.name, newName);
  }
  next = {
    ...next,
    warehouses: (next.warehouses || []).map((w) =>
      w.id === id
        ? {
            ...w,
            name: newName,
            type: patch.type != null ? patch.type : w.type,
            address: patch.address != null ? patch.address.trim() : w.address,
            notes: patch.notes != null ? patch.notes.trim() : w.notes,
            status: patch.status != null ? patch.status : w.status,
            updatedAt: new Date().toISOString(),
          }
        : w,
    ),
  };
  return syncStoresFromWarehouses(next);
}

/** Activate / deactivate a warehouse. */
export function setWarehouseStatus(db: DB, id: number, status: "active" | "inactive"): DB {
  return updateWarehouse(db, id, { status });
}

/** Rename a warehouse across products' stockByStore and all document store fields. */
export function renameWarehouseEverywhere(db: DB, oldName: string, newName: string): DB {
  const products = db.products.map((p) => {
    let store = p.store === oldName ? newName : p.store;
    let stockByStore = p.stockByStore;
    if (p.stockByStore && oldName in p.stockByStore) {
      const map: Record<string, number> = {};
      Object.entries(p.stockByStore).forEach(([k, v]) => {
        const key = k === oldName ? newName : k;
        map[key] = num(map[key]) + num(v);
      });
      stockByStore = map;
    }
    return { ...p, store, stockByStore };
  });
  const fixStore = <T extends { store?: string }>(d: T): T =>
    d.store === oldName ? { ...d, store: newName } : d;
  return {
    ...db,
    products,
    invoices: db.invoices.map(fixStore),
    purchases: db.purchases.map(fixStore),
    transfers: (db.transfers || []).map((t) => ({
      ...t,
      fromWarehouse: t.fromWarehouse === oldName ? newName : t.fromWarehouse,
      toWarehouse: t.toWarehouse === oldName ? newName : t.toWarehouse,
    })),
    storeTransfers: (db.storeTransfers || []).map((t) => ({
      ...t,
      fromStore: t.fromStore === oldName ? newName : t.fromStore,
      toStore: t.toStore === oldName ? newName : t.toStore,
    })),
  };
}

/** Base-unit stock of a product (by name) in a warehouse (by name). */
export function getWarehouseStock(db: DB, productName: string, warehouseName: string): number {
  const p = db.products.find((x) => normName(x.name) === normName(productName));
  return stockInStore(p, warehouseName);
}

/** Exact Albanian insufficient-stock message required by Phase 1. */
export function insufficientStockMessage(
  warehouseName: string,
  available: number,
  required: number,
): string {
  return `Stoku i pamjaftueshëm në magazinë ${warehouseName}. Disponibël: ${fmt(available)}, Kërkuar: ${fmt(required)}`;
}

/**
 * Detailed per-product sale-stock errors for the SELECTED warehouse, using the
 * exact Phase 1 message. Lines are aggregated per product (qty + free, unit-aware).
 */
export function saleStockErrorsDetailed(
  products: Product[],
  lines: { productName: string; qty: number; freeQty?: number; unit: string }[],
  warehouseName: string | undefined,
): string[] {
  const wh = warehouseName || "";
  const required = new Map<string, number>();
  for (const ln of lines) {
    const p = products.find((x) => x.name === ln.productName);
    if (!p) continue;
    const baseQty = toBaseQty(p, num(ln.qty) + num(ln.freeQty), ln.unit);
    required.set(ln.productName, num(required.get(ln.productName)) + baseQty);
  }
  const errors: string[] = [];
  required.forEach((need, productName) => {
    const p = products.find((x) => x.name === productName);
    const available = stockInStore(p, wh);
    if (available + 0.0001 < need) {
      errors.push(`${productName} — ${insufficientStockMessage(wh, available, need)}`);
    }
  });
  return errors;
}

// ---------------- Transfers (Phase 1) ----------------

export function nextTransferRecordId(db: DB): number {
  return Math.max(0, ...((db.transfers || []).map((t) => t.id))) + 1;
}

/** Build the next TR-YYYYMMDD-NNN transfer number for the given date. */
export function makeTransferNo(db: DB, date: string): string {
  const ymd = (date || todayStr()).slice(0, 10).replace(/-/g, "");
  const prefix = `TR-${ymd}-`;
  const sameDay = (db.transfers || []).filter((t) => (t.transferNo || "").startsWith(prefix));
  let maxN = 0;
  sameDay.forEach((t) => {
    const n = parseInt((t.transferNo || "").slice(prefix.length), 10);
    if (isFinite(n) && n > maxN) maxN = n;
  });
  const seq = String(maxN + 1).padStart(3, "0");
  return `${prefix}${seq}`;
}

export type TransferInput = {
  date: string;
  fromWarehouse: string;
  toWarehouse: string;
  product: string;
  unit: string;
  qty: number;
  note?: string;
};

/**
 * Validate + apply a warehouse transfer. Moves base-unit stock out of the
 * source and into the destination. Returns the new DB and the created Transfer,
 * or an `error` (Albanian) when validation fails — nothing is mutated on error.
 */
export function createTransfer(db: DB, input: TransferInput): { db: DB; transfer?: Transfer; error?: string } {
  const product = db.products.find((p) => normName(p.name) === normName(input.product));
  if (!product) return { db, error: "Zgjidh një artikull." };
  if (!input.fromWarehouse || !input.toWarehouse) {
    return { db, error: "Zgjidh magazinën burim dhe destinacion." };
  }
  if (normName(input.fromWarehouse) === normName(input.toWarehouse)) {
    return { db, error: "Magazina burim dhe destinacion duhet të jenë të ndryshme." };
  }
  const qty = num(input.qty);
  if (qty <= 0) return { db, error: "Sasia duhet të jetë më e madhe se 0." };
  const pieces = toBaseQty(product, qty, input.unit);
  const available = stockInStore(product, input.fromWarehouse);
  if (available + 0.0001 < pieces) {
    return { db, error: insufficientStockMessage(input.fromWarehouse, available, pieces) };
  }
  const transfer: Transfer = {
    id: nextTransferRecordId(db),
    transferNo: makeTransferNo(db, input.date),
    date: input.date,
    fromWarehouse: input.fromWarehouse,
    toWarehouse: input.toWarehouse,
    product: input.product,
    unit: input.unit,
    qty,
    pieces,
    note: input.note,
    createdAt: new Date().toISOString(),
  };
  const products = db.products.map((p) => {
    if (normName(p.name) !== normName(input.product)) return p;
    const afterOut = applyStockDelta(p, input.fromWarehouse, -pieces);
    return applyStockDelta(afterOut, input.toWarehouse, pieces);
  });
  // Log two ledger movements: OUT of source, IN to destination.
  const movedProduct = products.find((p) => normName(p.name) === normName(input.product));
  const balOut = stockInStore(movedProduct, input.fromWarehouse);
  const balIn = stockInStore(movedProduct, input.toWarehouse);
  const mOut: StockMovement = {
    id: nextMovementId(db),
    date: input.date,
    warehouse: input.fromWarehouse,
    productName: input.product,
    docType: "transfer-out",
    docNo: transfer.transferNo,
    inBase: 0,
    outBase: pieces,
    balanceAfter: balOut,
    note: input.note,
    createdAt: transfer.createdAt,
  };
  const mIn: StockMovement = {
    id: mOut.id + 1,
    date: input.date,
    warehouse: input.toWarehouse,
    productName: input.product,
    docType: "transfer-in",
    docNo: transfer.transferNo,
    inBase: pieces,
    outBase: 0,
    balanceAfter: balIn,
    note: input.note,
    createdAt: transfer.createdAt,
  };
  return {
    db: {
      ...db,
      products,
      transfers: [transfer, ...(db.transfers || [])],
      stockMovements: [mOut, mIn, ...(db.stockMovements || [])],
    },
    transfer,
  };
}

// ---------------------------------------------------------------------------
// Stock movement ledger + warehouse documents (Fletë Hyrje / Dalje / Inventar)
// ---------------------------------------------------------------------------

export function nextMovementId(db: DB): number {
  return Math.max(0, ...((db.stockMovements || []).map((m) => m.id))) + 1;
}

export function nextInboundId(db: DB): number {
  return Math.max(0, ...((db.inboundDocs || []).map((d) => d.id))) + 1;
}

export function nextOutboundId(db: DB): number {
  return Math.max(0, ...((db.outboundDocs || []).map((d) => d.id))) + 1;
}

export function nextInventoryId(db: DB): number {
  return Math.max(0, ...((db.inventoryDocs || []).map((d) => d.id))) + 1;
}

/**
 * Build the next sequential document number for a given prefix among an existing
 * set of documents, e.g. makeDocNoFrom(existing, "FH", date) -> FH-YYYYMMDD-NNN.
 */
export function makeDocNoFrom(existing: { no: string }[], prefix: string, date: string): string {
  const ymd = (date || todayStr()).slice(0, 10).replace(/-/g, "");
  const full = `${prefix}-${ymd}-`;
  let maxN = 0;
  (existing || []).forEach((d) => {
    if ((d.no || "").startsWith(full)) {
      const n = parseInt((d.no || "").slice(full.length), 10);
      if (isFinite(n) && n > maxN) maxN = n;
    }
  });
  return `${full}${String(maxN + 1).padStart(3, "0")}`;
}

/** Input line for a warehouse document (qty in the selected unit). */
export type WarehouseDocLineInput = {
  productName: string;
  unit: string;
  qty: number;
  /** Price PER SELECTED UNIT (Çmimi). Falls back to `cost` when omitted. */
  price?: number;
  /** Cost per BASE unit / piece (Çmimi Kosto Copë). */
  costPiece?: number;
  /** @deprecated legacy alias for `price` (per selected unit). */
  cost?: number;
  /**
   * True when this line is a FREE / gift quantity (DHURATË). Gift lines carry
   * price 0 and value 0 (they never add to the financial value) but they STILL
   * deduct / add stock exactly like any other line.
   */
  isGift?: boolean;
  note?: string;
};

export type WarehouseDocInput = {
  date: string;
  warehouse: string;
  reason?: string;
  note?: string;
  createdBy?: string;
  lines: WarehouseDocLineInput[];
  /** v1.0.18 — Richer metadata for manual docs to match auto-generated ones. */
  customerName?: string;
  supplierName?: string;
  destinationAddress?: string;
  authorizedPerson?: string;
  vehicle?: string;
  serialNo?: string;
};

/** Convert input lines to full doc lines (computing coef + baseQty + value). */
function buildDocLines(db: DB, lines: WarehouseDocLineInput[]): WarehouseDocLine[] {
  return (lines || []).map((ln) => {
    const p = db.products.find((x) => normName(x.name) === normName(ln.productName));
    const coef = unitCoef(p, ln.unit);
    const qty = num(ln.qty);
    const baseQty = qty * coef;
    const isGift = !!ln.isGift;
    // Çmimi follows the SELECTED unit (price per unit). `cost` is a legacy alias.
    // Gift (DHURATË) lines are always price 0 / value 0 — they never add value
    // but still move stock (baseQty > 0).
    const price = isGift ? 0 : (num(ln.price) || num(ln.cost));
    const costPiece = num(ln.costPiece);
    return {
      productName: ln.productName,
      unit: ln.unit,
      qty,
      coef,
      baseQty,
      price: isGift ? 0 : (price || undefined),
      costPiece: costPiece || undefined,
      cost: isGift ? 0 : (price || undefined), // back-compat mirror
      // Vlefta = qty (selected unit) × price (per selected unit). Gift = 0.
      value: isGift ? 0 : (price ? price * qty : undefined),
      isGift: isGift || undefined,
      note: ln.note,
    };
  });
}

/**
 * Fletë Hyrje — increases stock in the selected warehouse for every line.
 * Records one IN stock-movement per line. Returns {db, doc, error}.
 */
export function createInboundDoc(
  db: DB,
  input: WarehouseDocInput,
): { db: DB; doc?: InboundDoc; error?: string } {
  if (!input.warehouse) return { db, error: "Zgjidh magazinën." };
  const lines = buildDocLines(db, input.lines).filter((l) => l.baseQty > 0);
  if (!lines.length) return { db, error: "Shto të paktën një artikull me sasi." };
  const doc: InboundDoc = {
    id: nextInboundId(db),
    no: makeDocNoFrom(db.inboundDocs || [], "FH", input.date),
    date: input.date,
    warehouse: input.warehouse,
    reason: input.reason,
    note: input.note,
    createdBy: input.createdBy,
    status: "saved",
    lines,
    createdAt: new Date().toISOString(),
    sourceType: "MANUAL",
    customerName: input.customerName,
    supplierName: input.supplierName,
    destinationAddress: input.destinationAddress,
    authorizedPerson: input.authorizedPerson,
    vehicle: input.vehicle,
    serialNo: input.serialNo,
  };
  let products = db.products;
  const movements: StockMovement[] = [];
  let movId = nextMovementId(db);
  for (const ln of lines) {
    const idx = products.findIndex((p) => normName(p.name) === normName(ln.productName));
    if (idx < 0) continue;
    const updated = applyStockDelta(products[idx], input.warehouse, ln.baseQty);
    products = products.map((p, i) => (i === idx ? updated : p));
    movements.push({
      id: movId++,
      date: input.date,
      warehouse: input.warehouse,
      productName: ln.productName,
      docType: "inbound",
      docNo: doc.no,
      inBase: ln.baseQty,
      outBase: 0,
      balanceAfter: stockInStore(updated, input.warehouse),
      note: input.note,
      createdAt: doc.createdAt,
    });
  }
  return {
    db: {
      ...db,
      products,
      inboundDocs: [doc, ...(db.inboundDocs || [])],
      stockMovements: [...movements.reverse(), ...(db.stockMovements || [])],
    },
    doc,
  };
}

/**
 * Fletë Dalje — decreases stock from the selected warehouse for every line.
 * BLOCKS (returns error, mutates nothing) when any line exceeds available stock.
 * Records one OUT stock-movement per line.
 */
export function createOutboundDoc(
  db: DB,
  input: WarehouseDocInput,
): { db: DB; doc?: OutboundDoc; error?: string } {
  if (!input.warehouse) return { db, error: "Zgjidh magazinën." };
  const lines = buildDocLines(db, input.lines).filter((l) => l.baseQty > 0);
  if (!lines.length) return { db, error: "Shto të paktën një artikull me sasi." };
  // Aggregate required per product and validate against available stock.
  const required: Record<string, number> = {};
  for (const ln of lines) required[ln.productName] = (required[ln.productName] || 0) + ln.baseQty;
  const errors: string[] = [];
  for (const name of Object.keys(required)) {
    const p = db.products.find((x) => normName(x.name) === normName(name));
    const avail = stockInStore(p, input.warehouse);
    if (avail + 0.0001 < required[name]) {
      errors.push(insufficientStockMessage(input.warehouse, avail, required[name]) + ` (${name})`);
    }
  }
  if (errors.length) return { db, error: errors.join("\n\n") };

  const doc: OutboundDoc = {
    id: nextOutboundId(db),
    no: makeDocNoFrom(db.outboundDocs || [], "FD", input.date),
    date: input.date,
    warehouse: input.warehouse,
    reason: input.reason,
    note: input.note,
    createdBy: input.createdBy,
    status: "saved",
    lines,
    createdAt: new Date().toISOString(),
    sourceType: "MANUAL",
    customerName: input.customerName,
    supplierName: input.supplierName,
    destinationAddress: input.destinationAddress,
    authorizedPerson: input.authorizedPerson,
    vehicle: input.vehicle,
    serialNo: input.serialNo,
  };
  let products = db.products;
  const movements: StockMovement[] = [];
  let movId = nextMovementId(db);
  for (const ln of lines) {
    const idx = products.findIndex((p) => normName(p.name) === normName(ln.productName));
    if (idx < 0) continue;
    const updated = applyStockDelta(products[idx], input.warehouse, -ln.baseQty);
    products = products.map((p, i) => (i === idx ? updated : p));
    movements.push({
      id: movId++,
      date: input.date,
      warehouse: input.warehouse,
      productName: ln.productName,
      docType: "outbound",
      docNo: doc.no,
      inBase: 0,
      outBase: ln.baseQty,
      balanceAfter: stockInStore(updated, input.warehouse),
      note: input.reason || input.note,
      createdAt: doc.createdAt,
    });
  }
  return {
    db: {
      ...db,
      products,
      outboundDocs: [doc, ...(db.outboundDocs || [])],
      stockMovements: [...movements.reverse(), ...(db.stockMovements || [])],
    },
    doc,
  };
}

/** Input line for a physical inventory (countedQty in the selected unit). */
export type InventoryLineInput = {
  productName: string;
  unit: string;
  /** Counted amount in the selected unit. */
  countedQty: number;
  note?: string;
};

export type InventoryDocInput = {
  date: string;
  warehouse: string;
  note?: string;
  createdBy?: string;
  lines: InventoryLineInput[];
};

/**
 * Compute inventory lines (system vs counted) WITHOUT mutating stock — useful
 * for previewing differences before confirming.
 */
export function buildInventoryLines(db: DB, input: InventoryDocInput): InventoryDocLine[] {
  return (input.lines || []).map((ln) => {
    const p = db.products.find((x) => normName(x.name) === normName(ln.productName));
    const coef = unitCoef(p, ln.unit);
    const countedBase = num(ln.countedQty) * coef;
    const systemQty = stockInStore(p, input.warehouse);
    return {
      productName: ln.productName,
      unit: ln.unit,
      qty: num(ln.countedQty),
      coef,
      baseQty: countedBase,
      systemQty,
      countedQty: countedBase,
      diff: countedBase - systemQty,
      note: ln.note,
    };
  });
}

/**
 * Inventar Fizik — sets each product's warehouse stock to the counted quantity
 * and records a movement for the difference (positive diff -> IN, negative -> OUT).
 */
export function createInventoryDoc(
  db: DB,
  input: InventoryDocInput,
): { db: DB; doc?: InventoryDoc; error?: string } {
  if (!input.warehouse) return { db, error: "Zgjidh magazinën." };
  const lines = buildInventoryLines(db, input).filter((l) => l.productName);
  if (!lines.length) return { db, error: "Shto të paktën një artikull." };
  const doc: InventoryDoc = {
    id: nextInventoryId(db),
    no: makeDocNoFrom(db.inventoryDocs || [], "IF", input.date),
    date: input.date,
    warehouse: input.warehouse,
    note: input.note,
    createdBy: input.createdBy,
    status: "saved",
    lines,
    createdAt: new Date().toISOString(),
    sourceType: "MANUAL",
    customerName: input.customerName,
    supplierName: input.supplierName,
    destinationAddress: input.destinationAddress,
    authorizedPerson: input.authorizedPerson,
    vehicle: input.vehicle,
    serialNo: input.serialNo,
  };
  let products = db.products;
  const movements: StockMovement[] = [];
  let movId = nextMovementId(db);
  for (const ln of lines) {
    if (Math.abs(ln.diff) < 0.0001) continue; // no change
    const idx = products.findIndex((p) => normName(p.name) === normName(ln.productName));
    if (idx < 0) continue;
    const updated = applyStockDelta(products[idx], input.warehouse, ln.diff);
    products = products.map((p, i) => (i === idx ? updated : p));
    movements.push({
      id: movId++,
      date: input.date,
      warehouse: input.warehouse,
      productName: ln.productName,
      docType: "inventory",
      docNo: doc.no,
      inBase: ln.diff > 0 ? ln.diff : 0,
      outBase: ln.diff < 0 ? -ln.diff : 0,
      balanceAfter: stockInStore(updated, input.warehouse),
      note: input.note,
      createdAt: doc.createdAt,
    });
  }
  return {
    db: {
      ...db,
      products,
      inventoryDocs: [doc, ...(db.inventoryDocs || [])],
      stockMovements: [...movements.reverse(), ...(db.stockMovements || [])],
    },
    doc,
  };
}

/**
 * Append sale/purchase stock movements for an invoice/purchase that has already
 * been applied to stock. `db` must be the POST-stock-update database so that
 * balanceAfter reflects the new balances. Sale qty -> OUT, sale freeQty -> a
 * separate "gift" OUT movement, purchase qty(+free) -> IN.
 */
export function recordDocumentMovements(
  db: DB,
  opts: {
    kind: "sale" | "purchase";
    docNo: string | number;
    date: string;
    time?: string;
    warehouse: string;
    lines: { productName: string; qty: number; freeQty?: number; unit: string }[];
  },
): DB {
  const warehouse = opts.warehouse || (db.stores && db.stores[0]) || "Magazina kryesore";
  const movements: StockMovement[] = [];
  let movId = nextMovementId(db);
  for (const ln of opts.lines) {
    const p = db.products.find((x) => normName(x.name) === normName(ln.productName));
    if (!p) continue;
    const qtyBase = toBaseQty(p, num(ln.qty), ln.unit);
    const giftBase = toBaseQty(p, num(ln.freeQty), ln.unit);
    const bal = stockInStore(p, warehouse);
    if (opts.kind === "sale") {
      if (qtyBase > 0) {
        movements.push({
          id: movId++, date: opts.date, time: opts.time, warehouse, productName: ln.productName,
          docType: "sale", docNo: String(opts.docNo), inBase: 0, outBase: qtyBase,
          balanceAfter: bal, createdAt: new Date().toISOString(),
        });
      }
      if (giftBase > 0) {
        movements.push({
          id: movId++, date: opts.date, time: opts.time, warehouse, productName: ln.productName,
          docType: "gift", docNo: String(opts.docNo), inBase: 0, outBase: giftBase,
          balanceAfter: bal, note: "Dhuratë/Falas", createdAt: new Date().toISOString(),
        });
      }
    } else {
      const inBase = qtyBase + giftBase;
      if (inBase > 0) {
        movements.push({
          id: movId++, date: opts.date, time: opts.time, warehouse, productName: ln.productName,
          docType: "purchase", docNo: String(opts.docNo), inBase, outBase: 0,
          balanceAfter: bal, createdAt: new Date().toISOString(),
        });
      }
    }
  }
  if (!movements.length) return db;
  return { ...db, stockMovements: [...movements, ...(db.stockMovements || [])] };
}

// ---------------------------------------------------------------------------
// v1.0.17 — Linked warehouse documents (auto Fletë Dalje / Fletë Hyrje)
// These helpers keep stock changes in ONE place so quantities are never
// deducted or added twice. The sale/purchase screens delegate all stock
// mutations to commitSaleInvoice / commitPurchaseInvoice.
// ---------------------------------------------------------------------------

/** Remove stock movements that belong to a given document number + types. */
function removeMovementsByDoc(db: DB, docNo: string | number, docTypes: StockMovementType[]): DB {
  const set = new Set(docTypes);
  const no = String(docNo);
  return {
    ...db,
    stockMovements: (db.stockMovements || []).filter(
      (m) => !(set.has(m.docType) && String(m.docNo) === no),
    ),
  };
}

/**
 * Reverse a Fletë Dalje (outbound) document: re-add its base quantities to the
 * warehouse, drop the document, and remove its OUT stock movements.
 */
export function reverseOutboundDoc(db: DB, docId: number): DB {
  const doc = (db.outboundDocs || []).find((d) => d.id === docId);
  if (!doc) return db;
  let products = db.products;
  for (const ln of doc.lines) {
    const idx = products.findIndex((p) => normName(p.name) === normName(ln.productName));
    if (idx < 0) continue;
    const updated = applyStockDelta(products[idx], doc.warehouse, num(ln.baseQty));
    products = products.map((p, i) => (i === idx ? updated : p));
  }
  let next: DB = {
    ...db,
    products,
    outboundDocs: (db.outboundDocs || []).filter((d) => d.id !== docId),
  };
  next = {
    ...next,
    stockMovements: (next.stockMovements || []).filter(
      (m) => !(m.docType === "outbound" && m.docNo === doc.no),
    ),
  };
  return next;
}

/**
 * Reverse a Fletë Hyrje (inbound) document: subtract its base quantities from
 * the warehouse, drop the document, and remove its IN stock movements.
 */
export function reverseInboundDoc(db: DB, docId: number): DB {
  const doc = (db.inboundDocs || []).find((d) => d.id === docId);
  if (!doc) return db;
  let products = db.products;
  for (const ln of doc.lines) {
    const idx = products.findIndex((p) => normName(p.name) === normName(ln.productName));
    if (idx < 0) continue;
    const updated = applyStockDelta(products[idx], doc.warehouse, -num(ln.baseQty));
    products = products.map((p, i) => (i === idx ? updated : p));
  }
  let next: DB = {
    ...db,
    products,
    inboundDocs: (db.inboundDocs || []).filter((d) => d.id !== docId),
  };
  next = {
    ...next,
    stockMovements: (next.stockMovements || []).filter(
      (m) => !(m.docType === "inbound" && m.docNo === doc.no),
    ),
  };
  return next;
}

/**
 * Save a sale invoice and apply its stock effect exactly once.
 *
 * When `autoOutbound` is true a linked Fletë Dalje is created via
 * createOutboundDoc (which both validates and deducts stock); the legacy
 * applyLinesToStock / recordDocumentMovements path is skipped to avoid double
 * deduction. When false, the legacy path runs unchanged.
 *
 * When editing, the previous stock effect is reversed first (the linked doc is
 * reversed if it exists, otherwise the legacy movement is undone).
 */
export function commitSaleInvoice(
  db: DB,
  invoice: Invoice,
  opts: { autoOutbound: boolean; editingNo?: number },
): { db: DB; invoice: Invoice; error?: string } {
  const { autoOutbound, editingNo } = opts;
  let working = db;

  // 1) Reverse the previous stock effect when editing.
  if (editingNo != null) {
    const old = (working.invoices || []).find((i) => i.no === editingNo);
    if (old) {
      if (old.linkedOutboundDocId != null) {
        working = reverseOutboundDoc(working, old.linkedOutboundDocId);
      } else {
        working = { ...working, products: applyLinesToStock(working.products, old.items, old.store, 1) };
        working = removeMovementsByDoc(working, old.no, ["sale", "gift"]);
      }
    }
  }

  let result = invoice;

  if (autoOutbound) {
    if (!invoice.store) return { db, invoice, error: "Zgjidh magazinën për këtë shitje." };
    // Each invoice item becomes a SOLD line (qty × price) plus, when a free
    // quantity exists, a SEPARATE gift line (DHURATË) with price 0 / value 0.
    // The gift line still deducts stock so total stock-out = (qty + freeQty)×coef.
    const lines: WarehouseDocLineInput[] = invoice.items.flatMap((it) => {
      const out: WarehouseDocLineInput[] = [
        {
          productName: it.productName,
          unit: it.unit,
          qty: num(it.qty),
          // Çmimi = selling price per SELECTED unit (it.rate, e.g. 300/Koli).
          price: num(it.rate) || undefined,
          // Çmimi Kosto Copë = buy price per piece (for optional cost valuation).
          costPiece: num(it.buyRate) || undefined,
        },
      ];
      if (num(it.freeQty) > 0) {
        out.push({
          productName: it.productName,
          unit: it.unit,
          qty: num(it.freeQty),
          price: 0,
          costPiece: num(it.buyRate) || undefined,
          isGift: true,
        });
      }
      return out;
    });
    const res = createOutboundDoc(working, {
      date: invoice.date,
      warehouse: invoice.store,
      reason: "Shitje",
      note: `Faturë shitje #${invoice.no}`,
      lines,
    });
    if (res.error || !res.doc) {
      return { db, invoice, error: res.error || "S'u krijua Fletë Dalja." };
    }
    const taggedDoc: OutboundDoc = {
      ...res.doc,
      sourceType: "SALE_INVOICE",
      sourceInvoiceId: invoice.no,
      sourceInvoiceNo: invoice.no,
      customerName: invoice.customer,
      destinationAddress: invoice.billingName || invoice.customer,
    };
    working = {
      ...res.db,
      outboundDocs: (res.db.outboundDocs || []).map((d) => (d.id === taggedDoc.id ? taggedDoc : d)),
    };
    result = {
      ...invoice,
      autoCreateOutboundDoc: true,
      linkedOutboundDocId: taggedDoc.id,
      linkedOutboundDocNo: taggedDoc.no,
      warehouseName: invoice.store,
    };
  } else {
    const stockErrors = saleStockErrorsDetailed(working.products, invoice.items, invoice.store);
    if (stockErrors.length) return { db, invoice, error: stockErrors.join("\n\n") };
    working = { ...working, products: applyLinesToStock(working.products, invoice.items, invoice.store, -1) };
    working = recordDocumentMovements(working, {
      kind: "sale",
      docNo: invoice.no,
      date: invoice.date,
      time: invoice.time,
      warehouse: invoice.store || "",
      lines: invoice.items.map((it) => ({
        productName: it.productName,
        qty: it.qty,
        freeQty: it.freeQty,
        unit: it.unit,
      })),
    });
    result = {
      ...invoice,
      autoCreateOutboundDoc: false,
      linkedOutboundDocId: undefined,
      linkedOutboundDocNo: undefined,
    };
  }

  // Insert or replace the invoice.
  let invoices = working.invoices || [];
  if (editingNo != null && invoices.some((i) => i.no === editingNo)) {
    invoices = invoices.map((i) => (i.no === editingNo ? result : i));
    working = { ...working, invoices };
  } else {
    invoices = [...invoices, result];
    working = { ...working, invoices, nextInvoice: Math.max(num(working.nextInvoice), result.no + 1) };
  }
  return { db: working, invoice: result };
}

/**
 * Save a purchase invoice and apply its stock effect exactly once.
 * When `autoInbound` is true a linked Fletë Hyrje is created via
 * createInboundDoc; otherwise the legacy applyLinesToStock(+1) path runs.
 */
export function commitPurchaseInvoice(
  db: DB,
  purchase: Purchase,
  opts: { autoInbound: boolean; editingNo?: number },
): { db: DB; purchase: Purchase; error?: string } {
  const { autoInbound, editingNo } = opts;
  let working = db;

  // 1) Reverse the previous stock effect when editing.
  if (editingNo != null) {
    const old = (working.purchases || []).find((p) => p.no === editingNo);
    if (old) {
      if (old.linkedInboundDocId != null) {
        working = reverseInboundDoc(working, old.linkedInboundDocId);
      } else {
        working = { ...working, products: applyLinesToStock(working.products, old.items, old.store, -1) };
        working = removeMovementsByDoc(working, old.no, ["purchase"]);
      }
    }
  }

  let result = purchase;

  if (autoInbound) {
    if (!purchase.store) return { db, purchase, error: "Zgjidh magazinën për këtë blerje." };
    // SOLD line + separate gift line (DHURATË, price 0) — gift still adds stock.
    const lines: WarehouseDocLineInput[] = purchase.items.flatMap((it) => {
      const out: WarehouseDocLineInput[] = [
        {
          productName: it.productName,
          unit: it.unit,
          qty: num(it.qty),
          // Çmimi = purchase price per SELECTED unit (it.rate).
          price: num(it.rate) || undefined,
          // Çmimi Kosto Copë = buy price per piece.
          costPiece: num(it.buyRate) || undefined,
        },
      ];
      if (num(it.freeQty) > 0) {
        out.push({
          productName: it.productName,
          unit: it.unit,
          qty: num(it.freeQty),
          price: 0,
          costPiece: num(it.buyRate) || undefined,
          isGift: true,
        });
      }
      return out;
    });
    const res = createInboundDoc(working, {
      date: purchase.date,
      warehouse: purchase.store,
      reason: "Blerje",
      note: `Faturë blerje #${purchase.no}`,
      lines,
    });
    if (res.error || !res.doc) {
      return { db, purchase, error: res.error || "S'u krijua Fletë Hyrja." };
    }
    const taggedDoc: InboundDoc = {
      ...res.doc,
      sourceType: "PURCHASE_INVOICE",
      sourcePurchaseId: purchase.no,
      sourcePurchaseNo: purchase.no,
      supplierName: purchase.supplier,
    };
    working = {
      ...res.db,
      inboundDocs: (res.db.inboundDocs || []).map((d) => (d.id === taggedDoc.id ? taggedDoc : d)),
    };
    result = {
      ...purchase,
      autoCreateInboundDoc: true,
      linkedInboundDocId: taggedDoc.id,
      linkedInboundDocNo: taggedDoc.no,
      warehouseName: purchase.store,
    };
  } else {
    working = { ...working, products: applyLinesToStock(working.products, purchase.items, purchase.store, 1) };
    const errors = negativeStockErrors(working.products);
    if (errors.length) return { db, purchase, error: errors.join("\n\n") };
    working = recordDocumentMovements(working, {
      kind: "purchase",
      docNo: purchase.no,
      date: purchase.date,
      time: purchase.time,
      warehouse: purchase.store || "",
      lines: purchase.items.map((it) => ({
        productName: it.productName,
        qty: it.qty,
        freeQty: it.freeQty,
        unit: it.unit,
      })),
    });
    result = {
      ...purchase,
      autoCreateInboundDoc: false,
      linkedInboundDocId: undefined,
      linkedInboundDocNo: undefined,
    };
  }

  // Insert or replace the purchase.
  let purchases = working.purchases || [];
  if (editingNo != null && purchases.some((p) => p.no === editingNo)) {
    purchases = purchases.map((p) => (p.no === editingNo ? result : p));
    working = { ...working, purchases };
  } else {
    purchases = [...purchases, result];
    working = { ...working, purchases, nextPurchase: Math.max(num(working.nextPurchase), result.no + 1) };
  }
  return { db: working, purchase: result };
}

export async function loadDB(): Promise<DB> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      // backfill keys that may not exist in older versions
      return migrateDB({ ...DEFAULT_DB, ...parsed });
    }
  } catch (_) {}
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DB));
  return DEFAULT_DB;
}

export async function saveDB(db: DB): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

// ============================================================================
// Multi-company persistence (schema 2)
// ----------------------------------------------------------------------------
// Each company owns a full DB slice; only the ACTIVE slice is exposed as `db`
// through the StoreProvider. Switching company swaps the whole slice, so data
// isolation is automatic and existing screens keep working unchanged.
// ============================================================================
export const MDB_STORAGE_KEY = "sistemi_genit_mdb_v1";

export function genCompanyId(): string {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Derive lightweight company metadata from a DB slice's company profile. */
export function companyMetaFromDB(id: string, db: DB, overrides?: Partial<CompanyMeta>): CompanyMeta {
  return {
    id,
    name: db.company?.name || "Kompani",
    nipt: db.company?.nipt || "",
    address: db.company?.address || "",
    phone: db.company?.phone || "",
    email: db.company?.email || "",
    logoUri: db.company?.logoUri,
    currency: db.company?.currency || "LEK",
    status: "active",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Build a clean, empty DB slice for a brand-new company. */
export function newCompanyDB(meta: Partial<CompanyMeta> & { name: string }): DB {
  const now = new Date().toISOString();
  const slice: DB = {
    ...DEFAULT_DB,
    company: {
      ...DEFAULT_DB.company,
      name: meta.name,
      nipt: meta.nipt || "",
      address: meta.address || "",
      phone: meta.phone || "",
      email: meta.email || "",
      logoUri: meta.logoUri,
      currency: meta.currency || "LEK",
    },
    stores: ["Magazina Kryesore"],
    products: [],
    customers: [{ id: 1, name: "Klient Rastesor" }],
    suppliers: [],
    invoices: [],
    purchases: [],
    payments: [],
    priceHistory: [],
    stockAdjustments: [],
    expenses: [],
    storeTransfers: [],
    warehouses: [
      {
        id: 1,
        name: "Magazina Kryesore",
        type: "main",
        address: meta.address || "",
        status: "active",
        notes: "",
        createdAt: now,
        updatedAt: now,
      },
    ],
    transfers: [],
    inboundDocs: [],
    outboundDocs: [],
    inventoryDocs: [],
    stockMovements: [],
    salesmen: [],
    routeTracks: [],
    currentSalesman: "",
    nextInvoice: 1,
    nextPurchase: 1,
  };
  return migrateDB(slice);
}

/** Build a fresh MultiDB envelope wrapping a single legacy/default DB as company c1. */
export function wrapAsMultiDB(legacy: DB): MultiDB {
  const id = "c1";
  return {
    schema: 2,
    activeCompanyId: id,
    companies: [companyMetaFromDB(id, legacy, { createdAt: "2024-01-01T00:00:00.000Z" })],
    data: { [id]: migrateDB({ ...DEFAULT_DB, ...legacy }) },
  };
}

export function migrateMultiDB(parsed: MultiDB): MultiDB {
  const data: Record<string, DB> = {};
  for (const [cid, slice] of Object.entries(parsed.data || {})) {
    data[cid] = migrateDB({ ...DEFAULT_DB, ...slice });
  }
  let companies = (parsed.companies || []).filter((c) => data[c.id]);
  if (!companies.length && Object.keys(data).length) {
    companies = Object.keys(data).map((cid) => companyMetaFromDB(cid, data[cid]));
  }
  let activeCompanyId = parsed.activeCompanyId;
  if (!activeCompanyId || !data[activeCompanyId]) {
    activeCompanyId = companies[0]?.id || Object.keys(data)[0];
  }
  return { schema: 2, activeCompanyId, companies, data };
}

export async function loadMultiDB(): Promise<MultiDB> {
  // 1) Existing multi-company store
  try {
    const raw = await AsyncStorage.getItem(MDB_STORAGE_KEY);
    if (raw) {
      return migrateMultiDB(JSON.parse(raw) as MultiDB);
    }
  } catch (_) {}
  // 2) Legacy single-company store → wrap as company c1 (no data loss)
  try {
    const legacyRaw = await AsyncStorage.getItem(STORAGE_KEY);
    if (legacyRaw) {
      const legacy = migrateDB({ ...DEFAULT_DB, ...(JSON.parse(legacyRaw) as DB) });
      const mdb = wrapAsMultiDB(legacy);
      await saveMultiDB(mdb);
      return mdb;
    }
  } catch (_) {}
  // 3) Brand-new install → one default company from DEFAULT_DB
  const mdb = wrapAsMultiDB(DEFAULT_DB);
  await saveMultiDB(mdb);
  return mdb;
}

export async function saveMultiDB(mdb: MultiDB): Promise<void> {
  await AsyncStorage.setItem(MDB_STORAGE_KEY, JSON.stringify(mdb));
}

// ------------- React context / hook -------------
type Ctx = {
  /** Active company's DB slice. */
  db: DB;
  ready: boolean;
  setDB: (next: DB | ((prev: DB) => DB)) => Promise<void>;
  reset: () => Promise<void>;
  // --- multi-company ---
  companies: CompanyMeta[];
  activeCompanyId: string;
  activeCompany: CompanyMeta | undefined;
  switchCompany: (id: string) => Promise<void>;
  createCompany: (meta: Partial<CompanyMeta> & { name: string }) => Promise<string>;
  updateCompany: (id: string, patch: Partial<CompanyMeta>) => Promise<void>;
  setCompanyStatus: (id: string, status: "active" | "inactive") => Promise<void>;
  /** Returns the full multi-company database (all companies + data). For backup. */
  getMultiDB: () => MultiDB;
  /** Replaces the entire multi-company database (all companies). For restore-all. */
  restoreMultiDB: (mdb: MultiDB) => Promise<void>;
};

const StoreContext = React.createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [mdb, setMdb] = React.useState<MultiDB>(() => wrapAsMultiDB(DEFAULT_DB));
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    loadMultiDB().then((m) => {
      if (mounted) {
        setMdb(m);
        setReady(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const persist = React.useCallback(async (next: MultiDB) => {
    setMdb(next);
    await saveMultiDB(next);
  }, []);

  const activeCompanyId = mdb.activeCompanyId;
  const db = mdb.data[activeCompanyId] || DEFAULT_DB;

  const setDB = React.useCallback(
    async (next: DB | ((prev: DB) => DB)) => {
      const cur = mdb.data[mdb.activeCompanyId] || DEFAULT_DB;
      const computed = typeof next === "function" ? (next as any)(cur) : next;
      // keep company meta in sync with the slice's company profile
      const companies = mdb.companies.map((c) =>
        c.id === mdb.activeCompanyId
          ? {
              ...c,
              name: computed.company?.name || c.name,
              nipt: computed.company?.nipt ?? c.nipt,
              address: computed.company?.address ?? c.address,
              phone: computed.company?.phone ?? c.phone,
              email: computed.company?.email ?? c.email,
              logoUri: computed.company?.logoUri ?? c.logoUri,
              currency: computed.company?.currency || c.currency,
            }
          : c,
      );
      const next2: MultiDB = {
        ...mdb,
        companies,
        data: { ...mdb.data, [mdb.activeCompanyId]: computed },
      };
      await persist(next2);
    },
    [mdb, persist],
  );

  const reset = React.useCallback(async () => {
    const fresh = wrapAsMultiDB(DEFAULT_DB);
    await persist(fresh);
  }, [persist]);

  const switchCompany = React.useCallback(
    async (id: string) => {
      if (!mdb.data[id]) return;
      await persist({ ...mdb, activeCompanyId: id });
    },
    [mdb, persist],
  );

  const createCompany = React.useCallback(
    async (meta: Partial<CompanyMeta> & { name: string }) => {
      const id = genCompanyId();
      const slice = newCompanyDB(meta);
      const company = companyMetaFromDB(id, slice, {
        status: meta.status || "active",
        currency: meta.currency || "LEK",
      });
      const next: MultiDB = {
        ...mdb,
        activeCompanyId: id,
        companies: [...mdb.companies, company],
        data: { ...mdb.data, [id]: slice },
      };
      await persist(next);
      return id;
    },
    [mdb, persist],
  );

  const updateCompany = React.useCallback(
    async (id: string, patch: Partial<CompanyMeta>) => {
      const companies = mdb.companies.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c));
      const slice = mdb.data[id];
      const data =
        slice != null
          ? {
              ...mdb.data,
              [id]: {
                ...slice,
                company: {
                  ...slice.company,
                  name: patch.name ?? slice.company.name,
                  nipt: patch.nipt ?? slice.company.nipt,
                  address: patch.address ?? slice.company.address,
                  phone: patch.phone ?? slice.company.phone,
                  email: patch.email ?? slice.company.email,
                  logoUri: patch.logoUri ?? slice.company.logoUri,
                  currency: patch.currency ?? slice.company.currency,
                },
              },
            }
          : mdb.data;
      await persist({ ...mdb, companies, data });
    },
    [mdb, persist],
  );

  const setCompanyStatus = React.useCallback(
    async (id: string, status: "active" | "inactive") => {
      const companies = mdb.companies.map((c) => (c.id === id ? { ...c, status } : c));
      await persist({ ...mdb, companies });
    },
    [mdb, persist],
  );

  const getMultiDB = React.useCallback(() => mdb, [mdb]);

  const restoreMultiDB = React.useCallback(
    async (next: MultiDB) => {
      const safe = migrateMultiDB(next);
      await persist(safe);
    },
    [persist],
  );

  const activeCompany = mdb.companies.find((c) => c.id === activeCompanyId);

  return React.createElement(
    StoreContext.Provider,
    {
      value: {
        db,
        ready,
        setDB,
        reset,
        companies: mdb.companies,
        activeCompanyId,
        activeCompany,
        switchCompany,
        createCompany,
        updateCompany,
        setCompanyStatus,
        getMultiDB,
        restoreMultiDB,
      },
    },
    children,
  );
}

export function useStore(): Ctx {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/** Convenience hook for company-management screens. */
export function useCompanies() {
  const {
    companies,
    activeCompanyId,
    activeCompany,
    switchCompany,
    createCompany,
    updateCompany,
    setCompanyStatus,
  } = useStore();
  return {
    companies,
    activeCompanyId,
    activeCompany,
    switchCompany,
    createCompany,
    updateCompany,
    setCompanyStatus,
  };
}

// ------------- domain ops -------------

/** Total stock (base units) of a product, summed across all stores. */
export function stockOf(db: DB, productName: string): number {
  const p = db.products.find((x) => x.name === productName);
  return totalStock(p);
}

/** Total base-unit stock of a product, using stockByStore when present, else legacy stock. */
export function totalStock(p?: Product): number {
  if (!p) return 0;
  if (p.stockByStore && Object.keys(p.stockByStore).length) {
    return Object.values(p.stockByStore).reduce((s, v) => s + num(v), 0);
  }
  return num(p.stock);
}

/** Base-unit stock of a product in a specific store. */
export function stockInStore(p: Product | undefined, store?: string): number {
  if (!p) return 0;
  if (!store) return totalStock(p);
  if (p.stockByStore && store in p.stockByStore) return num(p.stockByStore[store]);
  // Legacy items had a single `stock` assigned to their home store.
  if (!p.stockByStore && p.store && p.store === store) return num(p.stock);
  return 0;
}

/**
 * Convert a quantity expressed in `unit` into BASE units, using the product's unit coefficient.
 * e.g. 2 "Koli" with coef 12 => 24 base units. Free quantity must use the SAME conversion.
 */
export function toBaseQty(p: Product | undefined, qty: number, unit: string): number {
  return num(qty) * unitCoef(p, unit);
}

/**
 * Apply a stock movement to a product immutably and return the updated product.
 * `deltaBase` is in BASE units: negative for sales/reduce, positive for purchase/add.
 * Keeps both `stockByStore` and the legacy `stock` total in sync.
 */
export function applyStockDelta(p: Product, store: string | undefined, deltaBase: number): Product {
  const target = store || p.store || "Magazina kryesore";
  const map: Record<string, number> = { ...(p.stockByStore || {}) };
  // Seed the map from legacy stock on first migration.
  if (!p.stockByStore || Object.keys(p.stockByStore).length === 0) {
    const home = p.store || target;
    map[home] = num(p.stock);
  }
  map[target] = num(map[target]) + deltaBase;
  const total = Object.values(map).reduce((s, v) => s + num(v), 0);
  return { ...p, stockByStore: map, stock: total };
}

/**
 * Apply a list of invoice/purchase lines to the products array, converting each line's
 * (qty + freeQty) into base units via the line unit. `sign` = -1 for sale, +1 for purchase.
 */
export function applyLinesToStock(
  products: Product[],
  lines: { productName: string; qty: number; freeQty?: number; unit: string }[],
  store: string | undefined,
  sign: 1 | -1,
): Product[] {
  let next = products;
  for (const ln of lines) {
    const idx = next.findIndex((x) => x.name === ln.productName);
    if (idx < 0) continue;
    const p = next[idx];
    const baseQty = toBaseQty(p, num(ln.qty) + num(ln.freeQty), ln.unit);
    const updated = applyStockDelta(p, store, sign * baseQty);
    next = next.map((x, i) => (i === idx ? updated : x));
  }
  return next;
}


/**
 * Validate that a sale can be deducted from the selected store without sending stock negative.
 * Lines are aggregated per product because the same product may appear more than once.
 */
export function validateSaleStock(
  products: Product[],
  lines: { productName: string; qty: number; freeQty?: number; unit: string }[],
  store: string | undefined,
): string[] {
  const required = new Map<string, number>();
  for (const ln of lines) {
    const p = products.find((x) => x.name === ln.productName);
    if (!p) continue;
    const baseQty = toBaseQty(p, num(ln.qty) + num(ln.freeQty), ln.unit);
    required.set(ln.productName, num(required.get(ln.productName)) + baseQty);
  }
  const errors: string[] = [];
  required.forEach((need, productName) => {
    const p = products.find((x) => x.name === productName);
    const available = stockInStore(p, store);
    if (available + 0.0001 < need) {
      errors.push(`${productName}: kërkohen ${fmt(need)} copë, gjendje ${fmt(available)} copë`);
    }
  });
  return errors;
}


/** Return human-readable errors for any product/store whose stock is negative. */
export function negativeStockErrors(products: Product[]): string[] {
  const errors: string[] = [];
  products.forEach((p) => {
    const map = p.stockByStore && Object.keys(p.stockByStore).length
      ? p.stockByStore
      : { [p.store || "Magazina kryesore"]: num(p.stock) };
    Object.entries(map).forEach(([store, qty]) => {
      if (num(qty) < -0.0001) errors.push(`${p.name} @ ${store}: ${fmt(num(qty))} copë`);
    });
  });
  return errors;
}

export function nextProductId(db: DB): number {
  return Math.max(0, ...db.products.map((p) => p.id)) + 1;
}

export function nextCustomerId(db: DB): number {
  return Math.max(0, ...db.customers.map((c) => c.id)) + 1;
}

export function nextSupplierId(db: DB): number {
  return Math.max(0, ...db.suppliers.map((s) => s.id)) + 1;
}

export function nextPaymentId(db: DB): number {
  return Math.max(0, ...db.payments.map((p) => p.id)) + 1;
}

export function nextStockAdjId(db: DB): number {
  return Math.max(0, ...db.stockAdjustments.map((x) => x.id)) + 1;
}

export function nextExpenseId(db: DB): number {
  return Math.max(0, ...(db.expenses || []).map((x) => x.id)) + 1;
}

export function nextTransferId(db: DB): number {
  return Math.max(0, ...(db.storeTransfers || []).map((x) => x.id)) + 1;
}

/** Cash-in-hand at any point: invoices paid (cash) + payment-in cash − purchases paid cash − payment-out cash − cash expenses */
export function cashInHand(db: DB): number {
  let cash = 0;
  for (const inv of db.invoices) {
    if ((inv.paymentType || "").toLowerCase().includes("para") || inv.mode === "Me arke") {
      cash += num(inv.paid);
    }
  }
  for (const pur of db.purchases) {
    if ((pur.paymentType || "").toLowerCase().includes("para") || pur.mode === "Me arke") {
      cash -= num(pur.paid);
    }
  }
  for (const pay of db.payments) {
    if ((pay.method || "").toLowerCase().includes("para")) {
      cash += pay.partyType === "customer" ? num(pay.amount) : -num(pay.amount);
    }
  }
  for (const e of db.expenses || []) {
    if ((e.paymentMethod || "").toLowerCase().includes("para")) {
      cash -= num(e.amount);
    }
  }
  return cash;
}

export function totalExpenses(db: DB, fromDate?: string, toDate?: string): number {
  return (db.expenses || [])
    .filter((e) => (!fromDate || e.date >= fromDate) && (!toDate || e.date <= toDate))
    .reduce((s, e) => s + num(e.amount), 0);
}

// ------------- salesman / route helpers -------------

/** Current salesman name for new documents (DB.currentSalesman → settings → ""). */
export function currentSalesmanName(db: DB): string {
  return (db.currentSalesman || db.settings?.salesmanName || "").trim();
}

/** Return an immutable copy of db with the salesman set + registered in salesmen[]. */
export function withSalesman(db: DB, name: string): DB {
  const clean = (name || "").trim();
  const salesmen = [...(db.salesmen || [])];
  if (clean && !salesmen.some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
    salesmen.push({ name: clean, createdAt: new Date().toISOString() });
  }
  return {
    ...db,
    currentSalesman: clean,
    salesmen,
    settings: { ...db.settings, salesmanName: clean },
  };
}

/** All distinct salesman names known to the system (registered + used on docs). */
export function allSalesmen(db: DB): string[] {
  const set = new Set<string>();
  (db.salesmen || []).forEach((s) => s.name && set.add(s.name));
  (db.invoices || []).forEach((i) => {
    const n = i.salesmanName || i.salesman;
    if (n) set.add(n);
  });
  (db.purchases || []).forEach((p) => {
    const n = p.salesmanName || p.salesman;
    if (n) set.add(n);
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** The active (not-ended) route track, if any. */
export function activeRoute(db: DB): RouteTrack | undefined {
  return (db.routeTracks || []).find((r) => r.status === "active" && !r.endedAt);
}

/** Build a Google Maps deep link for a coordinate pair. */
export function mapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

/** Apply salesman + geo fields to a document object (mutates a copy). */
export function attachLocation<T extends DocLocationFields>(
  doc: T,
  salesman: string,
  geo: GeoLocation | undefined,
  routeId?: string,
): T {
  const out: T = { ...doc };
  if (salesman) {
    out.salesman = salesman;
    out.salesmanName = salesman;
    out.salesmanCapturedAt = new Date().toISOString();
  }
  if (routeId) out.routeTrackId = routeId;
  if (geo && geo.status === "ok" && geo.lat != null && geo.lng != null) {
    out.geo = geo;
    out.latitude = geo.lat;
    out.longitude = geo.lng;
    out.locationAccuracy = geo.accuracy;
    out.mapsUrl = mapsUrl(geo.lat, geo.lng);
  } else if (geo) {
    out.geo = geo;
    out.locationStatus = geo.status;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Multi-unit stock display
// Stock is ALWAYS stored internally in BASE units (pieces). These helpers turn
// that base quantity into the product's configured units (base / second / third
// …) for display only. Unit names are NEVER hardcoded — they come from the
// product setup (copë / koli / paletë, piece / case / pallet, etc.).
// ---------------------------------------------------------------------------

/** A single unit row for stock display, e.g. { name: "Koli", qty: 114, isBase: false }. */
export type StockUnitView = { name: string; qty: number; coef: number; isBase: boolean };

/**
 * Break the base-unit stock of a product down into every configured unit.
 * Returns one row per unit in setup order (base first). `qty` is `stockBase /
 * coef` and may be fractional when stock is not exactly divisible.
 */
export function stockUnitBreakdown(p: Product | undefined, stockBase?: number): StockUnitView[] {
  if (!p) return [];
  const base = stockBase == null ? totalStock(p) : num(stockBase);
  const units = (p.units && p.units.length ? p.units : [{ name: "Copë", coef: 1 }]);
  return units.map((u, i) => {
    const coef = num(u.coef) > 0 ? num(u.coef) : 1;
    return { name: u.name || (i === 0 ? "Copë" : `Njësia ${i + 1}`), qty: base / coef, coef, isBase: i === 0 };
  });
}

/**
 * Compact stock label for lists: base unit + second unit when one exists,
 * e.g. "1.368 copë / 114 koli". Falls back to just the base unit otherwise.
 */
export function formatStockUnits(p: Product | undefined, stockBase?: number): string {
  if (!p) return "0";
  const rows = stockUnitBreakdown(p, stockBase);
  if (!rows.length) return fmt(stockBase == null ? totalStock(p) : num(stockBase));
  let label = `${fmt(rows[0].qty)} ${rows[0].name}`;
  if (rows[1]) label += ` / ${fmt(rows[1].qty)} ${rows[1].name}`;
  return label;
}

// ---------------------------------------------------------------------------
// Payment-status filter (Home / Kryefaqe documents list)
// Pure helpers so the filtering logic is unit-testable.
// ---------------------------------------------------------------------------

const PAY_EPS = 0.001;

/**
 * Return every payment status that applies to a document, derived from its
 * total/paid. A document can match more than one status (e.g. a partially paid
 * invoice is both "partial" and "due").
 *   - "paid"    fully settled (due <= 0)
 *   - "unpaid"  nothing paid yet (paid == 0 and something owed)
 *   - "partial" some paid but not all
 *   - "due"     anything still owed (unpaid + partial)
 */
export function paymentStatusesOf(inv: { total: number; paid: number }): string[] {
  const total = num(inv.total);
  const paid = num(inv.paid);
  const due = total - paid;
  const statuses: string[] = [];
  if (due <= PAY_EPS || paid >= total - PAY_EPS) statuses.push("paid");
  if (paid <= PAY_EPS && due > PAY_EPS) statuses.push("unpaid");
  if (paid > PAY_EPS && paid < total - PAY_EPS) statuses.push("partial");
  if (due > PAY_EPS) statuses.push("due");
  return statuses;
}

/**
 * Filter documents by a multi-select list of payment statuses. An empty list or
 * one containing "all" returns everything. A document matches when ANY of its
 * statuses is in the selected list.
 */
export function filterInvoicesByPaymentStatus<T extends { total: number; paid: number }>(
  invoices: T[],
  selected: string[] | undefined,
): T[] {
  if (!selected || selected.length === 0 || selected.includes("all")) return invoices;
  return invoices.filter((inv) => {
    const st = paymentStatusesOf(inv);
    return selected.some((s) => st.includes(s));
  });
}

// ---------------------------------------------------------------------------
// Unified document list + combined (type + payment-status) filtering
// Used by the Home screen "Filtro Sipas" modal (Vyapar-style).
// ---------------------------------------------------------------------------

/** The kind of a document shown on the home screen. */
export type DocKind = "sale" | "purchase" | "transfer";

/**
 * A normalized document row that unifies sales invoices, purchase invoices and
 * warehouse transfers so they can be listed and filtered together on the home
 * screen. `paid`/`due`/`total` are 0 for transfers (no payment concept).
 */
export type UnifiedDoc = {
  kind: DocKind;
  /** Stable key for list rendering. */
  key: string;
  /** Document number (invoice/purchase no) or transfer code. */
  no: number | string;
  date: string;
  time: string;
  /** Display party: customer (sale), supplier (purchase), "From → To" (transfer). */
  party: string;
  total: number;
  paid: number;
  due: number;
  /** Original record for navigation / detail. */
  raw: Invoice | Purchase | Transfer;
};

/**
 * Build a unified, newest-first list of all documents (sales, purchases and
 * warehouse transfers) from the database.
 */
export function unifiedDocuments(db: DB): UnifiedDoc[] {
  const sales: UnifiedDoc[] = (db.invoices || []).map((i) => ({
    kind: "sale" as const,
    key: `sale-${i.no}`,
    no: i.no,
    date: i.date,
    time: i.time || "",
    party: i.customer,
    total: num(i.total),
    paid: num(i.paid),
    due: num(i.due),
    raw: i,
  }));
  const purchases: UnifiedDoc[] = (db.purchases || []).map((p) => ({
    kind: "purchase" as const,
    key: `purchase-${p.no}`,
    no: p.no,
    date: p.date,
    time: p.time || "",
    party: p.supplier,
    total: num(p.total),
    paid: num(p.paid),
    due: num(p.due),
    raw: p,
  }));
  const transfers: UnifiedDoc[] = (db.transfers || []).map((t) => ({
    kind: "transfer" as const,
    key: `transfer-${t.id}`,
    no: t.transferNo,
    date: t.date,
    time: "",
    party: `${t.fromWarehouse} → ${t.toWarehouse}`,
    total: 0,
    paid: 0,
    due: 0,
    raw: t,
  }));
  const all = [...sales, ...purchases, ...transfers];
  return all.sort((a, b) => {
    const k = (d: UnifiedDoc) => `${d.date} ${d.time} ${String(d.no).padStart(8, "0")}`;
    return k(b).localeCompare(k(a));
  });
}

/**
 * Combined document filter for the home screen "Filtro Sipas" modal.
 *
 * - `types`: selected document kinds. Empty / undefined / contains "all" → all kinds.
 * - `statuses`: selected payment statuses. Empty / undefined / contains "all" → all.
 *
 * A document is kept when it matches ANY selected type AND ANY selected status.
 * Transfers have no payment concept, so when a specific payment status is
 * selected (not "all"), transfers are excluded.
 */
export function filterUnifiedDocs(
  docs: UnifiedDoc[],
  types: string[] | undefined,
  statuses: string[] | undefined,
): UnifiedDoc[] {
  const typeAll = !types || types.length === 0 || types.includes("all");
  const statusAll = !statuses || statuses.length === 0 || statuses.includes("all");
  return docs.filter((d) => {
    if (!typeAll && !types!.includes(d.kind)) return false;
    if (!statusAll) {
      if (d.kind === "transfer") return false; // no payment status on transfers
      const st = paymentStatusesOf(d);
      if (!statuses!.some((s) => st.includes(s))) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Per-warehouse stock helpers (Items list + Product detail)
// ---------------------------------------------------------------------------

/**
 * Base-unit stock of a product for a given warehouse, or the grand total across
 * all warehouses when `warehouse` is "all" (or empty).
 */
export function warehouseStockOf(p: Product | undefined, warehouse?: string): number {
  if (!p) return 0;
  if (!warehouse || warehouse === "all") return totalStock(p);
  return stockInStore(p, warehouse);
}

export type WarehouseStockRow = {
  warehouse: string;
  pieces: number;
  label: string;
  breakdown: StockUnitView[];
};

/**
 * Per-warehouse stock breakdown for a product, used on the product-detail
 * screen. Includes every known warehouse plus any warehouse that already holds
 * stock for this product (so legacy/renamed stores are not lost).
 */
export function stockByWarehouseRows(db: DB, p: Product | undefined): WarehouseStockRow[] {
  if (!p) return [];
  const names: string[] = [];
  const push = (n: string) => {
    if (n && !names.some((x) => normName(x) === normName(n))) names.push(n);
  };
  warehouseNames(db, false).forEach(push);
  Object.keys(p.stockByStore || {}).forEach(push);
  return names.map((w) => {
    const pieces = stockInStore(p, w);
    return { warehouse: w, pieces, label: formatStockUnits(p, pieces), breakdown: stockUnitBreakdown(p, pieces) };
  });
}

// ---------------------------------------------------------------------------
// Smart Repeat — Sales
// When a customer is chosen on a new invoice we look at their previous invoices
// and offer to (a) copy the latest invoice, or (b) add their most-frequent items.
// Only line data is reused — never the old invoice number, paid amount, payment
// status, GPS, route id or timestamp.
// ---------------------------------------------------------------------------

function normName(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

/** Clone an invoice line, recomputing the line total, dropping nothing line-level. */
function cloneItem(it: InvoiceItem): InvoiceItem {
  const qty = num(it.qty);
  const rate = num(it.rate);
  const total = qty * rate || num(it.total);
  const out: InvoiceItem = {
    productName: it.productName,
    qty,
    freeQty: num(it.freeQty),
    unit: it.unit || "Copë",
    rate,
    buyRate: num(it.buyRate),
    total,
    cost: num(it.cost),
  };
  if (it.priceList != null) out.priceList = it.priceList;
  return out;
}

/** All invoices for a customer, newest first (by date, then invoice no). */
export function invoicesForCustomer(db: DB, customerName: string): Invoice[] {
  const c = normName(customerName);
  if (!c) return [];
  return (db.invoices || [])
    .filter((x) => normName(x.customer) === c)
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || num(b.no) - num(a.no));
}

/** The customer's most recent invoice, or null. */
export function latestInvoiceForCustomer(db: DB, customerName: string): Invoice | null {
  return invoicesForCustomer(db, customerName)[0] || null;
}

/**
 * The customer's most-frequently purchased items across their last `historyLimit`
 * invoices, up to `limit` items. Each item carries the latest known unit / qty /
 * free / rate / coefficient for that product.
 */
export function usualItemsForCustomer(
  db: DB,
  customerName: string,
  limit = 5,
  historyLimit = 20,
): InvoiceItem[] {
  const invs = invoicesForCustomer(db, customerName).slice(0, historyLimit);
  const map = new Map<string, { count: number; date: string; line: InvoiceItem }>();
  invs.forEach((inv) => {
    (inv.items || []).forEach((it) => {
      const key = normName(it.productName);
      if (!key) return;
      const prev = map.get(key);
      const d = String(inv.date || "");
      if (!prev) {
        map.set(key, { count: 1, date: d, line: cloneItem(it) });
      } else {
        prev.count += 1;
        if (d >= prev.date) {
          prev.date = d;
          prev.line = cloneItem(it);
        }
      }
    });
  });
  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((e) => e.line);
}

/** Cloned line items of the customer's latest invoice (for "Copy last invoice"). */
export function copyLastCustomerInvoice(db: DB, customerName: string): InvoiceItem[] {
  const inv = latestInvoiceForCustomer(db, customerName);
  return inv ? (inv.items || []).map(cloneItem) : [];
}

/**
 * Usual items NOT already present in `currentItems` (for "Add usual items").
 * Returns the items to append; the caller concatenates them.
 */
export function addUsualCustomerItems(
  db: DB,
  customerName: string,
  currentItems: InvoiceItem[],
  limit = 5,
  historyLimit = 20,
): InvoiceItem[] {
  const existing = new Set((currentItems || []).map((l) => normName(l.productName)));
  return usualItemsForCustomer(db, customerName, limit, historyLimit).filter(
    (l) => !existing.has(normName(l.productName)),
  );
}

// ---------------------------------------------------------------------------
// Smart Repeat — Purchases (supplier side, same logic as sales)
// ---------------------------------------------------------------------------

/** All purchases for a supplier, newest first. */
export function purchasesForSupplier(db: DB, supplierName: string): Purchase[] {
  const s = normName(supplierName);
  if (!s) return [];
  return (db.purchases || [])
    .filter((x) => normName(x.supplier) === s)
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || num(b.no) - num(a.no));
}

/** The supplier's most recent purchase, or null. */
export function latestPurchaseForSupplier(db: DB, supplierName: string): Purchase | null {
  return purchasesForSupplier(db, supplierName)[0] || null;
}

/** The supplier's most-frequently supplied items across the last `historyLimit` purchases. */
export function usualItemsForSupplier(
  db: DB,
  supplierName: string,
  limit = 5,
  historyLimit = 20,
): InvoiceItem[] {
  const docs = purchasesForSupplier(db, supplierName).slice(0, historyLimit);
  const map = new Map<string, { count: number; date: string; line: InvoiceItem }>();
  docs.forEach((doc) => {
    (doc.items || []).forEach((it) => {
      const key = normName(it.productName);
      if (!key) return;
      const prev = map.get(key);
      const d = String(doc.date || "");
      if (!prev) {
        map.set(key, { count: 1, date: d, line: cloneItem(it) });
      } else {
        prev.count += 1;
        if (d >= prev.date) {
          prev.date = d;
          prev.line = cloneItem(it);
        }
      }
    });
  });
  return [...map.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((e) => e.line);
}

/** Cloned line items of the supplier's latest purchase (for "Copy last purchase"). */
export function copyLastSupplierPurchase(db: DB, supplierName: string): InvoiceItem[] {
  const doc = latestPurchaseForSupplier(db, supplierName);
  return doc ? (doc.items || []).map(cloneItem) : [];
}

/** Usual supplier items NOT already present in `currentItems`. */
export function addUsualSupplierItems(
  db: DB,
  supplierName: string,
  currentItems: InvoiceItem[],
  limit = 5,
  historyLimit = 20,
): InvoiceItem[] {
  const existing = new Set((currentItems || []).map((l) => normName(l.productName)));
  return usualItemsForSupplier(db, supplierName, limit, historyLimit).filter(
    (l) => !existing.has(normName(l.productName)),
  );
}

// ==================== CLIENT PRICE HISTORY (Last 5 prices per client + product) ====================
export type ClientPriceRecord = {
  product: string;
  price: number;
  unit: string;
  date: string;
  listIndex?: number;
};

/** Record the price used when saving a sale invoice for a specific client + product. Keeps only last 5. */
export function recordClientPrice(
  db: DB,
  customer: string,
  productName: string,
  price: number,
  unit: string,
  listIndex?: number
): DB {
  if (!customer || !productName) return db;
  const key = `${customer}|${productName}`;
  const history: ClientPriceRecord[] = db.clientPriceHistory?.[key] || [];

  const newRecord: ClientPriceRecord = {
    product: productName,
    price: Math.round(price),
    unit,
    date: todayStr(),
    listIndex,
  };

  const updatedHistory = [newRecord, ...history].slice(0, 5);

  return {
    ...db,
    clientPriceHistory: {
      ...(db.clientPriceHistory || {}),
      [key]: updatedHistory,
    },
  };
}

/** Get the last 5 prices used for this client + product (for suggestions in sale screen). */
export function getLastClientPrices(
  db: DB,
  customer: string,
  productName: string
): ClientPriceRecord[] {
  if (!customer || !productName) return [];
  const key = `${customer}|${productName}`;
  return db.clientPriceHistory?.[key] || [];
}

