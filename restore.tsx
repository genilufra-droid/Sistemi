import React from "react";
import { Alert, ScrollView, Text, View, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Header, Btn } from "@/components/ui-kit";
import { router } from "expo-router";
import { useStore } from "@/lib/store";
import {
  backupFilename,
  parseBackup,
  previewSummary,
  serializeBackup,
  type ValidationResult,
  isMultiBackup,
  parseMultiBackup,
  serializeMultiBackup,
  multiBackupFilename,
  multiPreviewSummary,
  type MultiValidationResult,
} from "@/lib/backup";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export default function RestoreScreen() {
  const colors = useColors();
  const { db, setDB, getMultiDB, restoreMultiDB } = useStore();
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<ValidationResult | null>(null);
  const [multiPreview, setMultiPreview] = React.useState<MultiValidationResult | null>(null);

  /** Always create a safety backup of the CURRENT data before overwriting. */
  const makeSafetyBackup = async (): Promise<void> => {
    try {
      const json = serializeBackup(db);
      const filename = `SIGURIA_${backupFilename()}`;
      if (Platform.OS === "web") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: "application/json",
          dialogTitle: "Backup sigurie (të dhënat aktuale)",
        });
      }
    } catch (_e) {
      // Non-fatal: continue with restore even if sharing the safety backup failed.
    }
  };

  /** Safety backup of ALL companies before an all-companies restore. */
  const makeMultiSafetyBackup = async (): Promise<void> => {
    try {
      const json = serializeMultiBackup(getMultiDB());
      const filename = `SIGURIA_${multiBackupFilename()}`;
      if (Platform.OS === "web") {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const path = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: "application/json",
          dialogTitle: "Backup sigurie (të gjitha kompanitë)",
        });
      }
    } catch (_e) {
      // Non-fatal.
    }
  };

  const pick = async () => {
    try {
      setBusy(true);
      setPreview(null);
      setMultiPreview(null);
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/plain", "*/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) {
        setBusy(false);
        return;
      }
      const file = res.assets?.[0];
      if (!file) {
        setBusy(false);
        return;
      }
      let raw: string;
      if (Platform.OS === "web") {
        const r = await fetch(file.uri);
        raw = await r.text();
      } else {
        raw = await FileSystem.readAsStringAsync(file.uri);
      }
      // Detect the kind of backup: multi-company vs single-company.
      let parsed: any = null;
      try {
        parsed = JSON.parse(raw);
      } catch (_e) {
        parsed = null;
      }
      if (isMultiBackup(parsed)) {
        const mres = parseMultiBackup(raw);
        if (!mres.ok) {
          Alert.alert("Skedar i pavlefshëm", mres.errors.join("\n"));
          setBusy(false);
          return;
        }
        setMultiPreview(mres);
        setBusy(false);
        return;
      }
      const result = parseBackup(raw);
      if (!result.ok) {
        Alert.alert("Skedar i pavlefshëm", result.errors.join("\n"));
        setBusy(false);
        return;
      }
      setPreview(result);
      setBusy(false);
    } catch (e: any) {
      setBusy(false);
      Alert.alert("Gabim", e?.message || String(e));
    }
  };

  const confirmRestore = () => {
    if (!preview || !preview.data) return;
    const counts = preview.recordCounts;
    const summary = counts ? previewSummary(counts) : "";
    Alert.alert(
      "Konfirmo rikthimin",
      `Të dhënat aktuale do të ZËVENDËSOHEN plotësisht me këtë backup:\n\n${summary}\n\nDo të krijohet automatikisht një backup sigurie i të dhënave aktuale para rikthimit. Vazhdo?`,
      [
        { text: "Anulo", style: "cancel" },
        {
          text: "Rikthe",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await makeSafetyBackup();
              // All-or-nothing: commit the migrated DB in a single write.
              await setDB(preview.data!);
              setBusy(false);
              setPreview(null);
              Alert.alert("Sukses", "Të dhënat u rikthyen me sukses.");
              router.back();
            } catch (e: any) {
              setBusy(false);
              Alert.alert("Gabim", e?.message || String(e));
            }
          },
        },
      ],
    );
  };

  const confirmMultiRestore = () => {
    if (!multiPreview || !multiPreview.mdb) return;
    const summary = multiPreview.companySummaries
      ? multiPreviewSummary(multiPreview.companySummaries)
      : "";
    const n = multiPreview.mdb.companies.length;
    Alert.alert(
      "Konfirmo rikthimin (të gjitha kompanitë)",
      `TË GJITHA kompanitë ekzistuese (${n}) do të ZËVENDËSOHEN plotësisht me këtë backup:\n\n${summary}\n\nDo të krijohet automatikisht një backup sigurie i të gjitha të dhënave aktuale. Vazhdo?`,
      [
        { text: "Anulo", style: "cancel" },
        {
          text: "Rikthe të gjitha",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await makeMultiSafetyBackup();
              await restoreMultiDB(multiPreview.mdb!);
              setBusy(false);
              setMultiPreview(null);
              Alert.alert("Sukses", "Të gjitha kompanitë u rikthyen me sukses.");
              router.back();
            } catch (e: any) {
              setBusy(false);
              Alert.alert("Gabim", e?.message || String(e));
            }
          },
        },
      ],
    );
  };

  const counts = preview?.recordCounts;

  return (
    <ScreenContainer>
      <Header title="Rikthe / Importo" back={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
        <View
          style={{
            backgroundColor: "#fff7ed",
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#fed7aa",
            marginBottom: 12,
          }}
        >
          <Text style={{ color: "#9a3412", fontWeight: "800" }}>Kujdes</Text>
          <Text style={{ color: "#9a3412", fontSize: 13, marginTop: 6 }}>
            Rikthimi do të zëvendësojë plotësisht të dhënat aktuale. Para rikthimit krijohet
            automatikisht një backup sigurie i të dhënave të tanishme.
          </Text>
        </View>

        <Btn
          fullWidth
          icon="square.and.arrow.down"
          title={busy ? "Duke punuar..." : "Zgjidh skedar JSON"}
          onPress={pick}
        />

        {preview && counts ? (
          <View
            style={{
              backgroundColor: colors.surface,
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              marginTop: 14,
            }}
          >
            <Text style={{ fontWeight: "800", color: colors.foreground, marginBottom: 4 }}>
              Parapamje e backup-it
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Versioni: {preview.version || "—"}
              {preview.exportDate ? ` • ${preview.exportDate.slice(0, 16).replace("T", " ")}` : ""}
            </Text>
            <View style={{ marginTop: 8, gap: 3 }}>
              {[
                ["Magazina", counts.warehouses],
                ["Artikuj", counts.products],
                ["Klientë", counts.customers],
                ["Furnitorë", counts.suppliers],
                ["Fatura shitje", counts.invoices],
                ["Blerje", counts.purchases],
                ["Pagesa", counts.payments],
                ["Transferime", counts.transfers],
              ].map(([label, value]) => (
                <View key={label as string} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.muted }}>{label}</Text>
                  <Text style={{ color: colors.foreground, fontWeight: "700" }}>{value}</Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 12 }}>
              <Btn fullWidth icon="arrow.clockwise" title="Rikthe këtë backup" onPress={confirmRestore} />
            </View>
          </View>
        ) : null}

        {multiPreview && multiPreview.mdb ? (
          <View
            style={{
              backgroundColor: colors.surface,
              padding: 12,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: colors.border,
              marginTop: 14,
            }}
          >
            <Text style={{ fontWeight: "800", color: colors.foreground, marginBottom: 4 }}>
              Parapamje — backup i të gjitha kompanive
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Versioni: {multiPreview.version || "—"}
              {multiPreview.exportDate
                ? ` • ${multiPreview.exportDate.slice(0, 16).replace("T", " ")}`
                : ""}
            </Text>
            <Text style={{ color: colors.foreground, fontWeight: "700", marginTop: 8 }}>
              {multiPreview.mdb.companies.length} kompani
            </Text>
            <View style={{ marginTop: 6, gap: 6 }}>
              {(multiPreview.companySummaries || []).map((s) => (
                <View
                  key={s.id}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <Text style={{ color: colors.foreground, fontWeight: "700" }}>{s.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                    {s.counts.products} artikuj • {s.counts.invoices} fatura • {s.counts.purchases} blerje •{" "}
                    {s.counts.customers} klientë
                  </Text>
                </View>
              ))}
            </View>
            <View style={{ marginTop: 12 }}>
              <Btn
                fullWidth
                icon="arrow.clockwise"
                title="Rikthe të gjitha kompanitë"
                onPress={confirmMultiRestore}
              />
            </View>
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
