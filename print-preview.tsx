/**
 * PrintPreview — a full-screen modal that previews a document (sale / purchase /
 * transfer) at a chosen paper size and lets the user Share it as a PDF or Print
 * it directly. Works for the four supported formats: 58 / 80 / 110 mm thermal
 * receipts and a full A4 tax invoice.
 *
 * The on-screen preview is rendered with native components (we have no WebView),
 * mirroring the printed layout. The actual PDF/print output is produced from the
 * pure HTML builders in `lib/print-templates` so what you see matches what you
 * print closely.
 */
import React from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SvgXml } from "react-native-svg";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { useColors } from "@/hooks/use-colors";
import { Btn } from "@/components/ui-kit";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { Company } from "@/lib/store";
import {
  PAPER_SIZES,
  buildDocHtml,
  fmtMoney,
  fmtQty,
  formatAlbDateTime,
  paymentLabel,
  qrPayload,
  vatBreakdown,
  type PaperSize,
  type PrintableDoc,
} from "@/lib/print-templates";
import { generateQrSvg } from "@/lib/qr";
import { exportWarehouseDocToExcel } from "@/lib/excel";

type Props = {
  visible: boolean;
  onClose: () => void;
  doc: PrintableDoc | null;
  company: Company;
  defaultPaper?: PaperSize;
};

export function PrintPreview({ visible, onClose, doc, company, defaultPaper = "80" }: Props) {
  const colors = useColors();
  const [paper, setPaper] = React.useState<PaperSize>(defaultPaper);
  const [qrSvg, setQrSvg] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);

  // Reset to the requested default paper each time the modal is (re)opened.
  React.useEffect(() => {
    if (visible) setPaper(defaultPaper);
  }, [visible, defaultPaper]);

  // (Re)generate the QR code whenever the document or paper size changes.
  // QR size matches the target print output (58mm→120, 80mm→150, 110mm→180, A4→180).
  React.useEffect(() => {
    let alive = true;
    // Warehouse documents (Fletë Dalje / Hyrje) never carry a QR / fiscal code.
    if (!doc || doc.warehouse) {
      setQrSvg("");
      return;
    }
    const qrSize = paper === "58" ? 120 : paper === "80" ? 150 : 180;
    generateQrSvg(qrPayload(doc), qrSize).then((svg) => {
      if (alive) setQrSvg(svg);
    });
    return () => {
      alive = false;
    };
  }, [doc, paper]);

  if (!doc) return null;

  const html = () => buildDocHtml(doc, company, paper, qrSvg);

  const sharePDF = async () => {
    try {
      setBusy(true);
      if (Platform.OS === "web") {
        await Print.printAsync({ html: html() });
        return;
      }
      const { uri } = await Print.printToFileAsync({ html: html() });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `${doc.title} ${doc.number}`,
          UTI: "com.adobe.pdf",
        });
      } else {
        await Print.printAsync({ html: html() });
      }
    } catch (err: any) {
      Alert.alert("Gabim", err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const print = async () => {
    try {
      setBusy(true);
      await Print.printAsync({ html: html() });
    } catch (err: any) {
      Alert.alert("Gabim", err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  const exportExcel = async () => {
    if (!doc) return;
    try {
      setBusy(true);
      await exportWarehouseDocToExcel(doc, company);
    } catch (err: any) {
      Alert.alert("Gabim", err?.message || String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingTop: Platform.OS === "ios" ? 56 : 16,
            paddingBottom: 12,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ flex: 1, fontSize: 18, fontWeight: "900", color: colors.foreground }}>
            Pamja e printimit
          </Text>
          <Pressable onPress={onClose} hitSlop={10} style={{ padding: 6 }}>
            <IconSymbol name="xmark" size={24} color={colors.foreground} />
          </Pressable>
        </View>

        {/* Paper-size selector */}
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderColor: colors.border,
          }}
        >
          {PAPER_SIZES.map((p) => {
            const active = p.value === paper;
            return (
              <Pressable
                key={p.value}
                onPress={() => setPaper(p.value)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  alignItems: "center",
                  backgroundColor: active ? colors.primary : "transparent",
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text style={{ fontWeight: "800", color: active ? "#fff" : colors.foreground }}>{p.label}</Text>
                <Text style={{ fontSize: 9, color: active ? "#eaf4ff" : colors.muted }}>{p.hint}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Preview */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ alignItems: "center", padding: 16 }}
        >
          <DocPreview doc={doc} company={company} paper={paper} qrSvg={qrSvg} colors={colors} />
        </ScrollView>

        {/* Action bar */}
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            padding: 12,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Btn title="PDF" icon="square.and.arrow.up" variant="soft" onPress={sharePDF} disabled={busy} style={{ flex: 1 }} />
          {doc.warehouse ? (
            <Btn title="Excel" icon="tablecells" variant="soft" onPress={exportExcel} disabled={busy} style={{ flex: 1 }} />
          ) : null}
          <Btn title="Printo" icon="printer.fill" onPress={print} disabled={busy} style={{ flex: 1 }} />
          <Btn title="Mbyll" variant="ghost" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// On-screen preview (mirrors the printed layout with native components)
// ---------------------------------------------------------------------------

type PreviewProps = {
  doc: PrintableDoc;
  company: Company;
  paper: PaperSize;
  qrSvg: string;
  colors: ReturnType<typeof useColors>;
};

function DocPreview({ doc, company, paper, qrSvg }: PreviewProps) {
  // The "paper" is always rendered as a white sheet with black text for a
  // realistic, print-friendly preview regardless of app theme.
  const isWarehouse = !!doc.warehouse;
  const sheetWidth = isWarehouse
    ? 360
    : paper === "A4" ? 360 : paper === "58" ? 190 : paper === "110" ? 320 : 250;
  return (
    <View
      style={{
        width: sheetWidth,
        backgroundColor: "#fff",
        padding: paper === "A4" || isWarehouse ? 18 : 12,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#ddd",
        // subtle paper shadow
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      }}
    >
      {isWarehouse ? (
        <WarehouseDocPreview doc={doc} company={company} />
      ) : paper === "A4" ? (
        <A4Preview doc={doc} company={company} qrSvg={qrSvg} />
      ) : (
        <ThermalPreview doc={doc} company={company} paper={paper} qrSvg={qrSvg} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Warehouse document preview — FLETË DALJE / FLETË HYRJE (bordered table)
// ---------------------------------------------------------------------------

function WarehouseDocPreview({ doc, company }: { doc: PrintableDoc; company: Company }) {
  // Column flex weights mirror the printed table widths.
  const cols = [0.5, 3.0, 1.0, 1.0, 0.8, 1.2, 1.3, 1.5];
  const headers = ["Nr", "Emërtimi i mallit", "Njësia", "Sasia", "Koef", "Sasia Copë", "Çmimi", "Vlefta"];
  const headerFields: [string, string][] = [
    ["Nr. / Dokumenti", doc.number || ""],
    ["Dt. / Data", formatAlbDateTime(doc.date, doc.time)],
    ["Magazina", doc.warehouseName || doc.businessUnit || ""],
    ["Adresa ku shkon malli", doc.destinationAddress || doc.partyAddress || ""],
    [doc.warehouseKind === "inbound" ? "Furnitori" : "Marrësi", doc.receiver || doc.partyName || ""],
    ["Emri, mbiemri pers. Autorizuar", doc.authorizedPerson || ""],
    ["Lloji e targa e Mjetit transp.", doc.vehicle || ""],
    ["Seria / Nr. references", doc.serialNo || ""],
  ];
  const cellBox = { borderRightWidth: 1, borderColor: INK, paddingVertical: 3, paddingHorizontal: 3 } as const;

  return (
    <View>
      <Text style={{ fontSize: 18, fontWeight: "900", color: INK, textAlign: "center", letterSpacing: 1 }}>
        {doc.title}
      </Text>
      <Text style={{ fontSize: 12, fontWeight: "800", color: INK, textAlign: "center", marginTop: 2 }}>
        {company.name || ""}
      </Text>
      {company.address ? (
        <Text style={{ fontSize: 10, color: INK_MUTED, textAlign: "center" }}>
          {company.address}{company.city ? `, ${company.city}` : ""}
        </Text>
      ) : null}

      {/* Header field block (bordered) */}
      <View style={{ borderWidth: 1, borderColor: INK, marginTop: 10 }}>
        {headerFields.map(([label, value], i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              borderBottomWidth: i === headerFields.length - 1 ? 0 : 1,
              borderColor: INK,
            }}
          >
            <Text
              style={{
                flex: 0.95,
                fontSize: 9.5,
                fontWeight: "700",
                color: INK,
                backgroundColor: "#f0f0f0",
                padding: 4,
                borderRightWidth: 1,
                borderColor: INK,
              }}
            >
              {label}
            </Text>
            <Text style={{ flex: 1.05, fontSize: 9.5, color: INK, padding: 4 }}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Goods table */}
      <View style={{ borderWidth: 1, borderColor: INK, marginTop: 10 }}>
        {/* header row */}
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: INK, backgroundColor: "#e8e8e8" }}>
          {headers.map((h, i) => (
            <Text
              key={i}
              style={{
                flex: cols[i],
                fontSize: 8.5,
                fontWeight: "800",
                color: INK,
                textAlign: "center",
                paddingVertical: 4,
                paddingHorizontal: 2,
                borderRightWidth: i === headers.length - 1 ? 0 : 1,
                borderColor: INK,
              }}
            >
              {h}
            </Text>
          ))}
        </View>
        {/* data rows */}
        {doc.lines.map((l, ri) => (
          <View key={ri} style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: INK }}>
            <Text style={[cellBox, { flex: cols[0], fontSize: 9, color: INK, textAlign: "center" }]}>{ri + 1}</Text>
            <Text style={[cellBox, { flex: cols[1], fontSize: 9, color: INK }]}>{l.name}</Text>
            <Text style={[cellBox, { flex: cols[2], fontSize: 9, color: INK, textAlign: "center" }]}>{l.unit}</Text>
            <Text style={[cellBox, { flex: cols[3], fontSize: 9, color: INK, textAlign: "right" }]}>{fmtQty(l.qty)}</Text>
            <Text style={[cellBox, { flex: cols[4], fontSize: 9, color: INK, textAlign: "center" }]}>{fmtQty(l.coef ?? 1)}</Text>
            <Text style={[cellBox, { flex: cols[5], fontSize: 9, color: INK, textAlign: "right" }]}>{fmtQty(l.baseQty ?? l.qty * (l.coef ?? 1))}</Text>
            <Text style={[cellBox, { flex: cols[6], fontSize: 9, color: INK, textAlign: "right" }]}>{fmtMoney(l.rate)}</Text>
            <Text style={[{ flex: cols[7], fontSize: 9, color: INK, textAlign: "right", paddingVertical: 3, paddingHorizontal: 3 }]}>{fmtMoney(l.total)}</Text>
          </View>
        ))}
        {/* total row — shows physical total (Sasia Copë) + financial total (Vlefta) */}
        <View style={{ flexDirection: "row", backgroundColor: "#f0f0f0" }}>
          <Text style={{ flex: cols.slice(0, 5).reduce((a, b) => a + b, 0), fontSize: 9.5, fontWeight: "800", color: INK, textAlign: "right", paddingVertical: 4, paddingHorizontal: 3, borderRightWidth: 1, borderColor: INK }}>
            TOTALI
          </Text>
          <Text style={{ flex: cols[5], fontSize: 9.5, fontWeight: "800", color: INK, textAlign: "right", paddingVertical: 4, paddingHorizontal: 3, borderRightWidth: 1, borderColor: INK }}>
            {fmtQty(doc.lines.reduce((s, l) => s + Number(l.baseQty ?? l.qty * (l.coef ?? 1)), 0))}
          </Text>
          <Text style={{ flex: cols[6], fontSize: 9.5, fontWeight: "800", color: INK, textAlign: "right", paddingVertical: 4, paddingHorizontal: 3, borderRightWidth: 1, borderColor: INK }} />
          <Text style={{ flex: cols[7], fontSize: 9.5, fontWeight: "800", color: INK, textAlign: "right", paddingVertical: 4, paddingHorizontal: 3 }}>
            {fmtMoney(doc.total)}
          </Text>
        </View>
      </View>

      {doc.note ? (
        <Text style={{ fontSize: 9.5, color: INK, marginTop: 8 }}>
          <Text style={{ fontWeight: "800" }}>Shënim: </Text>{doc.note}
        </Text>
      ) : null}

      {/* Signatures — Fletë Hyrje adds "Dorëzuesi". */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 30 }}>
        {(doc.warehouseKind === "inbound"
          ? ["Magazinieri", "Dorëzuesi", "Marrësi në dorëzim", "Transportuesi", "Llogaritari"]
          : ["Magazinieri", "Marrësi në dorëzim", "Transportuesi", "Llogaritari"]
        ).map((s) => (
          <View key={s} style={{ flex: 1, alignItems: "center", paddingHorizontal: 3 }}>
            <Text style={{ fontSize: 8, fontWeight: "700", color: INK, textAlign: "center", marginBottom: 20 }}>{s}</Text>
            <View style={{ borderTopWidth: 1, borderColor: INK, alignSelf: "stretch", marginBottom: 3 }} />
            <Text style={{ fontSize: 7, color: INK_MUTED, textAlign: "center" }}>Emri, mbiemri / Nënshkrimi</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const INK = "#111";
const INK_MUTED = "#555";
const LINE = "#ccc";

function Hr() {
  return <View style={{ borderTopWidth: 1, borderColor: LINE, marginVertical: 6 }} />;
}

function A4Preview({ doc, company, qrSvg }: { doc: PrintableDoc; company: Company; qrSvg: string }) {
  const currency = company.currency || "ALL";
  const isTransfer = doc.docType === "transfer";
  const totalVb = vatBreakdown(doc.total, doc.vatRate);
  const vatLabel = doc.vatRate ? `Shitje me TVSH ${doc.vatRate}%` : "Shitje pa TVSH";

  return (
    <View>
      <Text style={{ fontSize: 18, fontWeight: "800", color: INK, textAlign: "center" }}>
        {doc.title === "FATURË TATIMORE" ? "Faturë Tatimore" : doc.title}
      </Text>

      <Text style={{ fontSize: 13, fontWeight: "800", color: INK, marginTop: 12 }}>DETAJE</Text>
      <Hr />
      <KV label="Data" value={formatAlbDateTime(doc.date, doc.time)} />
      <KV label="Numri i Faturës" value={doc.number} />
      {doc.operator ? <KV label="Operatori" value={doc.operator} /> : null}
      {doc.businessUnit ? <KV label="Njësia e biznesit" value={doc.businessUnit} /> : null}
      <KV label="Valuta" value={currency} />
      <KV label="Kursi" value="1.00" />

      <Hr />
      <Text style={{ fontWeight: "800", color: INK }}>Shitësi:</Text>
      <Text style={{ color: INK }}>{company.name || ""}</Text>
      {company.nipt ? <Text style={{ color: INK_MUTED }}>{company.nipt}</Text> : null}
      {company.address ? <Text style={{ color: INK_MUTED }}>{company.address}</Text> : null}

      {!isTransfer && doc.partyName ? (
        <>
          <Hr />
          <Text style={{ fontWeight: "800", color: INK }}>{doc.partyLabel}:</Text>
          <Text style={{ color: INK }}>{doc.partyName}</Text>
        </>
      ) : null}

      {isTransfer ? (
        <>
          <Hr />
          <KV label="Nga magazina" value={doc.fromWarehouse || ""} />
          <KV label="Te magazina" value={doc.toWarehouse || ""} />
        </>
      ) : null}

      {/* Items */}
      <Text style={{ fontSize: 13, fontWeight: "800", color: INK, marginTop: 12 }}>Artikujt</Text>
      <View style={{ flexDirection: "row", borderBottomWidth: 2, borderColor: INK, paddingVertical: 4 }}>
        <Text style={[colHead, { flex: 3 }]}>Emri / Kodi</Text>
        <Text style={[colHead, { flex: 1.4, textAlign: "right" }]}>Çmimi</Text>
        <Text style={[colHead, { flex: 1.4, textAlign: "center" }]}>Sasia</Text>
        {!isTransfer ? <Text style={[colHead, { flex: 1.4, textAlign: "right" }]}>Vlera</Text> : null}
      </View>
      {doc.lines.map((l, i) => {
        const idParts = [l.code, l.barcode].filter(Boolean).join(" / ");
        return (
          <View key={i} style={{ flexDirection: "row", borderBottomWidth: 1, borderColor: "#eee", paddingVertical: 5 }}>
            <View style={{ flex: 3 }}>
              <Text style={{ color: INK, fontSize: 11 }}>{l.name}</Text>
              {idParts ? <Text style={{ color: INK_MUTED, fontSize: 9 }}>{idParts}</Text> : null}
            </View>
            <Text style={[cell, { flex: 1.4, textAlign: "right" }]}>{isTransfer ? "—" : fmtMoney(l.rate)}</Text>
            <Text style={[cell, { flex: 1.4, textAlign: "center" }]}>{fmtQty(l.qty)} {l.unit}</Text>
            {!isTransfer ? <Text style={[cell, { flex: 1.4, textAlign: "right" }]}>{fmtMoney(l.total)}</Text> : null}
          </View>
        );
      })}
      {!isTransfer ? (
        <View style={{ flexDirection: "row", borderTopWidth: 2, borderColor: INK, paddingVertical: 6 }}>
          <Text style={[cell, { flex: 5.8, textAlign: "right", fontWeight: "800" }]}>TOTALI NË {currency}</Text>
          <Text style={[cell, { flex: 1.4, textAlign: "right", fontWeight: "800" }]}>{fmtMoney(doc.total)}</Text>
        </View>
      ) : null}

      {/* VAT + payment */}
      {!isTransfer ? (
        <>
          <Text style={{ fontSize: 13, fontWeight: "800", color: INK, marginTop: 12 }}>TVSH</Text>
          <Hr />
          <KV label={vatLabel} value={`${fmtMoney(totalVb.vat)} ${currency}`} />
          <KV label="Vlera pa TVSH" value={`${fmtMoney(totalVb.net)} ${currency}`} />

          <Text style={{ fontSize: 13, fontWeight: "800", color: INK, marginTop: 12 }}>Pagesa</Text>
          <Hr />
          <KV label={paymentLabel(doc)} value={`${fmtMoney(doc.paid || doc.total)} ${currency}`} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: "900", color: INK }}>TOTALI</Text>
            <Text style={{ fontSize: 16, fontWeight: "900", color: INK }}>{fmtMoney(doc.total)} {currency}</Text>
          </View>
        </>
      ) : null}

      {/* Signatures */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 26 }}>
        {(isTransfer
          ? ["DORËZUESI", "MARRËSI"]
          : ["SHITËSI", "BLERËSI", "TRANSPORTUESI"]
        ).map((s) => (
          <View key={s} style={{ flex: 1, alignItems: "center", paddingHorizontal: 4 }}>
            <View style={{ borderTopWidth: 1, borderColor: INK, alignSelf: "stretch", marginBottom: 3 }} />
            <Text style={{ fontSize: 8, color: INK_MUTED, textAlign: "center" }}>{s}</Text>
          </View>
        ))}
      </View>

      {/* Fiscal QR */}
      {qrSvg ? (
        <View style={{ alignItems: "flex-end", marginTop: 16 }}>
          <SvgXml xml={qrSvg} width={140} height={140} />
          {doc.nivf ? <Text style={{ fontSize: 8, color: INK_MUTED, marginTop: 4 }}>NIVF: {doc.nivf}</Text> : null}
          {doc.nslf ? <Text style={{ fontSize: 8, color: INK_MUTED }}>NSLF: {doc.nslf}</Text> : null}
        </View>
      ) : null}

      <Text style={{ fontSize: 8, color: "#888", marginTop: 12 }}>Gjeneruar nga {company.name || "Sistemi Genit"}</Text>
    </View>
  );
}

function ThermalPreview({ doc, company, paper, qrSvg }: { doc: PrintableDoc; company: Company; paper: PaperSize; qrSvg: string }) {
  const currency = company.currency || "LEK";
  const isTransfer = doc.docType === "transfer";
  const totalVb = vatBreakdown(doc.total, doc.vatRate);
  const fs = paper === "58" ? 10 : paper === "110" ? 13 : 12;
  const titleFs = paper === "58" ? 15 : paper === "110" ? 20 : 18;

  return (
    <View>
      <Text style={{ fontSize: titleFs, fontWeight: "900", color: INK, textAlign: "center" }}>
        {doc.title === "FATURË TATIMORE" ? "FATURË TATIMORE" : doc.title}
      </Text>
      <Text style={{ fontSize: fs + 1, fontWeight: "800", color: INK, textAlign: "center", marginTop: 2 }}>
        {company.name || ""}
      </Text>
      {company.address ? (
        <Text style={{ fontSize: fs, color: INK, textAlign: "center" }}>{company.address}</Text>
      ) : null}

      <Hr />
      {company.nipt ? <TKV label="NIPT:" value={company.nipt} fs={fs} /> : null}
      <TKV label="Data/Ora:" value={formatAlbDateTime(doc.date, doc.time)} fs={fs} />
      <TKV label={isTransfer ? "Transferta Nr:" : "Fatura Nr:"} value={doc.number} fs={fs} />
      {doc.operator ? <TKV label="Operatori:" value={doc.operator} fs={fs} /> : null}
      {doc.businessUnit ? <TKV label="Njësia:" value={doc.businessUnit} fs={fs} /> : null}
      {!isTransfer && doc.partyName ? <TKV label={`${doc.partyLabel}:`} value={doc.partyName} fs={fs} /> : null}
      {!isTransfer ? <TKV label="Mënyra e pagesës:" value={paymentLabel(doc)} fs={fs} /> : null}

      <Hr />
      {doc.lines.map((l, i) => (
        <View key={i} style={{ marginVertical: 4 }}>
          <Text style={{ fontSize: fs, fontWeight: "700", color: INK }}>{l.name}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: fs, color: INK }}>
              {fmtQty(l.qty)} {l.unit}{isTransfer ? "" : ` × ${fmtMoney(l.rate)}`}
            </Text>
            {!isTransfer ? <Text style={{ fontSize: fs, color: INK }}>{fmtMoney(l.total)}</Text> : null}
          </View>
        </View>
      ))}

      <Hr />
      {!isTransfer ? (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: titleFs - 2, fontWeight: "900", color: INK }}>TOTAL {currency}</Text>
            <Text style={{ fontSize: titleFs - 2, fontWeight: "900", color: INK }}>{fmtMoney(doc.total)}</Text>
          </View>
          <TKV label={paymentLabel(doc)} value={fmtMoney(doc.paid || doc.total)} fs={fs} bold />
          {doc.due > 0 ? <TKV label="Detyrim" value={fmtMoney(doc.due)} fs={fs} bold /> : null}
          {doc.change ? <TKV label="Kusuri" value={fmtMoney(doc.change)} fs={fs} bold /> : null}
          <Hr />
          {doc.vatRate ? (
            <>
              <TKV label={`Pa TVSH ${doc.vatRate}%`} value={fmtMoney(totalVb.net)} fs={fs} />
              <TKV label={`TVSH ${doc.vatRate}%`} value={fmtMoney(totalVb.vat)} fs={fs} />
            </>
          ) : (
            <TKV label="Shitje pa TVSH" value={fmtMoney(doc.total)} fs={fs} />
          )}
        </>
      ) : (
        <>
          <TKV label="Nga" value={doc.fromWarehouse || ""} fs={fs} bold />
          <TKV label="Te" value={doc.toWarehouse || ""} fs={fs} bold />
        </>
      )}

      {doc.note ? (
        <>
          <Hr />
          <Text style={{ fontSize: fs, color: INK, textAlign: "center" }}>{doc.note}</Text>
        </>
      ) : null}

      {(doc.nslf || doc.nivf || qrSvg) ? <Hr /> : null}
      {doc.nslf ? (
        <Text style={{ fontSize: fs - 1, color: INK, textAlign: "center" }}>
          <Text style={{ fontWeight: "900" }}>NSLF{"\n"}</Text>
          {doc.nslf}
        </Text>
      ) : null}
      {doc.nivf ? (
        <Text style={{ fontSize: fs - 1, color: INK, textAlign: "center", marginTop: 4 }}>
          <Text style={{ fontWeight: "900" }}>NIVF{"\n"}</Text>
          {doc.nivf}
        </Text>
      ) : null}
      {qrSvg ? (
        <View style={{ alignItems: "center", marginTop: 8 }}>
          <SvgXml xml={qrSvg} width={paper === "58" ? 110 : paper === "80" ? 130 : 150} height={paper === "58" ? 110 : paper === "80" ? 130 : 150} />
        </View>
      ) : null}
    </View>
  );
}

// Small presentational helpers ------------------------------------------------

const colHead = { fontSize: 9, fontWeight: "700" as const, color: INK };
const cell = { fontSize: 11, color: INK };

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 1 }}>
      <Text style={{ color: INK_MUTED, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: INK, fontSize: 11, fontWeight: "600", flexShrink: 1, textAlign: "right", marginLeft: 8 }}>
        {value}
      </Text>
    </View>
  );
}

function TKV({ label, value, fs, bold }: { label: string; value: string; fs: number; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginVertical: 1 }}>
      <Text style={{ fontSize: fs, color: INK, fontWeight: bold ? "800" : "600" }}>{label}</Text>
      <Text style={{ fontSize: fs, color: INK, fontWeight: bold ? "800" : "600", flexShrink: 1, textAlign: "right", marginLeft: 8 }}>
        {value}
      </Text>
    </View>
  );
}

export default PrintPreview;
