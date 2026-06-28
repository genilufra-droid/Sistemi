/**
 * In-memory sale/purchase draft used while the user is composing
 * an invoice. Persists across navigation pushes (party select, item
 * select, etc.) until Ruaj or cancel.
 */
import React from "react";
import type { InvoiceItem } from "./store";

export type Draft = {
  kind: "sale" | "purchase";
  party: string;
  store: string;
  date: string;
  time: string;
  mode: "Me detyrim" | "Me arke";
  items: InvoiceItem[];
  paid: number;
  paymentType: string;
  roundOff: number;
  note: string;
  /** Salesman responsible for this document (defaults to current salesman). */
  salesman?: string;
  /** v1.0.17 — create a linked Fletë Dalje automatically for this sale. */
  autoOutbound?: boolean;
  /** v1.0.17 — create a linked Fletë Hyrje automatically for this purchase. */
  autoInbound?: boolean;
  // editing existing
  no?: number;
};

const DEFAULT_DRAFT: Draft = {
  kind: "sale",
  party: "",
  store: "",
  date: new Date().toISOString().slice(0, 10),
  time: new Date().toTimeString().slice(0, 5),
  mode: "Me detyrim",
  items: [],
  paid: 0,
  paymentType: "Cash",
  roundOff: 0,
  note: "",
  autoOutbound: true,
  autoInbound: true,
};

let _draft: Draft = { ...DEFAULT_DRAFT };
const _listeners = new Set<() => void>();

function emit() {
  _listeners.forEach((l) => l());
}

export function getDraft(): Draft {
  return _draft;
}

export function setDraft(next: Partial<Draft> | ((prev: Draft) => Draft)): void {
  if (typeof next === "function") {
    _draft = next(_draft);
  } else {
    _draft = { ..._draft, ...next };
  }
  emit();
}

export function resetDraft(kind: "sale" | "purchase" = "sale", store = "") {
  _draft = {
    ...DEFAULT_DRAFT,
    kind,
    store,
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
  };
  emit();
}

export function useDraft(): Draft {
  const [, setVer] = React.useState(0);
  React.useEffect(() => {
    const cb = () => setVer((v) => v + 1);
    _listeners.add(cb);
    return () => {
      _listeners.delete(cb);
    };
  }, []);
  return _draft;
}
