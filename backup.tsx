import React from "react";
import { Alert, ScrollView, Text, View, Platform } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Header, Btn } from "@/components/ui-kit";
import { router } from "expo-router";
import { useStore } from "@/lib/store";
import {
  BACKUP_VERSION,
  backupFilename,
  recordCountsOf,
  serializeBackup,
  totalRecords,
  serializeMultiBackup,
  multiBackupFilename,
} from "@/lib/backup";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export default function BackupScreen() {
  const colors = useColors();
  const { db, getMultiDB, companies, activeCompany } = useStore();
  const counts = recordCountsOf(db);

  const writeAndShare = async (json: string, filename: string, title: string) => {
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
      await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: title });
    } else {
      Alert.alert("Ruajtur", `Skedari u ruajt ne: ${path}`);
    }
  };

  const exportJson = async () => {
    try {
      await writeAndShare(serializeBackup(db), backupFilename(), "Backup JSON (kompania aktive)");
    } catch (e: any) {
      Alert.alert("Gabim", e?.message || String(e));
    }
  };

  const exportAllJson = async () => {
    try {
      const mdb = getMultiDB();
      await writeAndShare(
        serializeMultiBackup(mdb),
        multiBackupFilename(),
        "Backup JSON (të gjitha kompanitë)",
      );
    } catch (e: any) {
      Alert.alert("Gabim", e?.message || String(e));
    }
  };

  const Row = ({ label, value }: { label: string; value: number }) => (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 }}>
      <Text style={{ color: colors.muted }}>{label}</Text>
      <Text style={{ color: colors.foreground, fontWeight: "700" }}>{value}</Text>
    </View>
  );

  return (
    <ScreenContainer>
      <Header title="Backup (JSON)" back={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 40 }}>
        <View
          style={{
            backgroundColor: "#dceffd",
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: "#bfe0fa",
            marginBottom: 12,
          }}
        >
          <Text style={{ color: colors.primary, fontWeight: "800" }}>Eksporto të dhënat (JSON)</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
            Krijon një skedar JSON me të dhënat (magazina, artikuj, klientë, fatura, blerje, pagesa,
            transferime, dokumente magazine, etj). Ruaje në një vend të sigurt për ta rikthyer më vonë.
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>Versioni i backup-it: {BACKUP_VERSION}</Text>
        </View>

        <View
          style={{
            backgroundColor: colors.surface,
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontWeight: "800", marginBottom: 4, color: colors.foreground }}>
            Përmbledhje ({totalRecords(counts)} regjistrime)
          </Text>
          <Row label="Magazina" value={counts.warehouses} />
          <Row label="Artikuj" value={counts.products} />
          <Row label="Klientë" value={counts.customers} />
          <Row label="Furnitorë" value={counts.suppliers} />
          <Row label="Fatura shitje" value={counts.invoices} />
          <Row label="Blerje" value={counts.purchases} />
          <Row label="Pagesa" value={counts.payments} />
          <Row label="Transferime" value={counts.transfers} />
          <Row label="Shpenzime" value={counts.expenses} />
          <Row label="Rregullime stoku" value={counts.stockAdjustments} />
        </View>

        <Btn
          fullWidth
          icon="square.and.arrow.up"
          title={`Backup kompaninë aktive${activeCompany ? ` (${activeCompany.name})` : ""}`}
          onPress={exportJson}
        />

        <View style={{ height: 10 }} />

        <Btn
          fullWidth
          variant="soft"
          icon="square.and.arrow.up.on.square"
          title={`Backup të gjitha kompanitë (${companies.length})`}
          onPress={exportAllJson}
        />
        <Text style={{ color: colors.muted, marginTop: 8, fontSize: 12 }}>
          Backup-i i të gjitha kompanive ruan çdo kompani me të dhënat e veta, plotësisht të ndara.
        </Text>

        <Text style={{ color: colors.muted, marginTop: 18, fontSize: 12, textAlign: "center" }}>
          Për të rikthyer një backup, përdor ekranin &quot;Rikthe / Importo&quot;.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
}
