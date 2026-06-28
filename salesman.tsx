import React from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { Header, Btn, Field } from "@/components/ui-kit";
import { router } from "expo-router";
import {
  useStore,
  withSalesman,
  allSalesmen,
  activeRoute,
  currentSalesmanName,
  type RouteTrack,
} from "@/lib/store";
import { captureLocation, geoToRoutePoint } from "@/lib/location";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function rid(): string {
  return `rt_${Date.now()}_${Math.floor(Math.random() * 1e4)}`;
}

export default function SalesmanScreen() {
  const colors = useColors();
  const { db, setDB } = useStore();
  const [name, setName] = React.useState(currentSalesmanName(db));
  const [busy, setBusy] = React.useState(false);

  const known = allSalesmen(db);
  const route = activeRoute(db);
  const gpsOn = db.settings?.gpsEnabled !== false;

  const saveName = async () => {
    const clean = name.trim();
    if (!clean) {
      Alert.alert("Shitësi", "Shkruaj emrin e shitësit.");
      return;
    }
    await setDB(withSalesman(db, clean));
    Alert.alert("OK", `Shitësi u vendos: ${clean}`);
  };

  const toggleGps = async (val: boolean) => {
    await setDB({ ...db, settings: { ...db.settings, gpsEnabled: val } });
  };

  const startRoute = async () => {
    if (busy) return;
    const salesman = currentSalesmanName(db) || name.trim();
    if (!salesman) {
      Alert.alert("Shitësi", "Vendos fillimisht emrin e shitësit.");
      return;
    }
    if (activeRoute(db)) {
      Alert.alert("Itinerar", "Ka tashmë një itinerar aktiv. Mbylle atë së pari.");
      return;
    }
    setBusy(true);
    try {
      const geo = gpsOn ? await captureLocation() : undefined;
      const pt = geo ? geoToRoutePoint(geo) : null;
      const track: RouteTrack = {
        id: rid(),
        salesman,
        date: todayStr(),
        startedAt: new Date().toISOString(),
        status: "active",
        points: pt ? [pt] : [],
      };
      await setDB({ ...db, routeTracks: [...(db.routeTracks || []), track] });
      Alert.alert(
        "Itinerar i nisur",
        gpsOn && !pt
          ? "Itinerari u nis, por GPS nuk u kap (kontrollo lejet/sinjalin). Pikat do kapen me çdo faturë."
          : "Itinerari u nis. Çdo faturë e re do regjistrojë vendndodhjen.",
      );
    } finally {
      setBusy(false);
    }
  };

  const stopRoute = async () => {
    if (busy) return;
    const active = activeRoute(db);
    if (!active) return;
    setBusy(true);
    try {
      const geo = gpsOn ? await captureLocation() : undefined;
      const pt = geo ? geoToRoutePoint(geo) : null;
      const next = (db.routeTracks || []).map((r) =>
        r.id === active.id
          ? {
              ...r,
              status: "ended" as const,
              endedAt: new Date().toISOString(),
              points: pt ? [...r.points, pt] : r.points,
            }
          : r,
      );
      await setDB({ ...db, routeTracks: next });
      Alert.alert("Itinerar i mbyllur", `Pika GPS të regjistruara: ${active.points.length + (pt ? 1 : 0)}`);
    } finally {
      setBusy(false);
    }
  };

  const testGps = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const geo = await captureLocation();
      if (geo.status === "ok") {
        Alert.alert("GPS OK", `Gjerësia: ${geo.lat?.toFixed(5)}\nGjatësia: ${geo.lng?.toFixed(5)}\nSaktësia: ${geo.accuracy ? Math.round(geo.accuracy) + " m" : "—"}`);
      } else {
        Alert.alert("GPS", `Nuk u kap vendndodhja (${geo.status}).`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer>
      <Header title="Shitësi & GPS" back={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
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
          <Text style={{ color: colors.primary, fontWeight: "800" }}>Shitësi aktual</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
            Emri i shitësit shtohet automatikisht në çdo faturë shitje/blerje të re. Kur GPS është
            aktiv, vendndodhja regjistrohet me çdo faturë.
          </Text>
        </View>

        <Field label="Emri i shitësit" value={name} onChangeText={setName} placeholder="p.sh. Agim Hoxha" />
        <Btn fullWidth title="Ruaj shitësin" icon="checkmark" onPress={saveName} />

        {known.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: colors.muted, fontWeight: "800", marginBottom: 6 }}>Shitësit e njohur</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {known.map((s) => {
                const active = s.toLowerCase() === currentSalesmanName(db).toLowerCase();
                return (
                  <Pressable
                    key={s}
                    onPress={() => setName(s)}
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 16,
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.border,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{ color: active ? "#fff" : colors.foreground, fontWeight: "700", fontSize: 12 }}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* GPS toggle */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: colors.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginTop: 18,
          }}
        >
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ fontWeight: "800", color: colors.foreground }}>Regjistro vendndodhjen (GPS)</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
              Kap koordinatat GPS sa herë ruhet një faturë.
            </Text>
          </View>
          <Switch value={gpsOn} onValueChange={toggleGps} />
        </View>

        <View style={{ marginTop: 8 }}>
          <Btn fullWidth variant="soft" title="Provo GPS" icon="location.fill" onPress={testGps} />
        </View>

        {/* Route tracking */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: colors.border,
            padding: 14,
            marginTop: 18,
          }}
        >
          <Text style={{ fontWeight: "900", color: colors.foreground, fontSize: 15 }}>Itinerari (rruga e shitësit)</Text>
          {route ? (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              Aktiv që nga {route.startedAt.slice(11, 16)} • {route.points.length} pika GPS • shitës: {route.salesman}
            </Text>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              Nis një itinerar për të gjurmuar rrugën gjatë ditës. Çdo faturë shton një pikë GPS.
            </Text>
          )}
          <View style={{ marginTop: 10 }}>
            {route ? (
              <Btn fullWidth title="Mbyll itinerarin" icon="stop.fill" onPress={stopRoute} />
            ) : (
              <Btn fullWidth title="Nis itinerar" icon="play.fill" onPress={startRoute} />
            )}
          </View>
        </View>

        <View style={{ marginTop: 18 }}>
          <Btn
            fullWidth
            variant="ghost"
            title="Hap Raportin e vendndodhjes"
            icon="map.fill"
            onPress={() => router.push({ pathname: "/(tabs)/reports", params: { type: "locationReport" } } as any)}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
