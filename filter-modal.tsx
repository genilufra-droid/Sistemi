import React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";

/** Brand red used for the primary "Apliko" action, matching the Vyapar reference. */
const APPLY_RED = "#EF4444";

export type FilterModalValue = {
  /** Selected document kinds: "sale" | "purchase" | "transfer". */
  types: string[];
  /** Selected payment statuses: "paid" | "unpaid" | "partial" | "due". */
  statuses: string[];
};

const DOC_TYPES: { value: string; label: string }[] = [
  { value: "sale", label: "Shitje" },
  { value: "purchase", label: "Blerje" },
  { value: "transfer", label: "Transfertë Magazinash" },
];

const PAY_STATUSES: { value: string; label: string }[] = [
  { value: "paid", label: "Paguar" },
  { value: "unpaid", label: "Papaguar" },
  { value: "partial", label: "Pjesërisht" },
  { value: "due", label: "Me Afat" },
];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * A bottom-sheet style filter modal inspired by Vyapar's "Filter By".
 *
 * Section 1 — document type (Sale / Purchase / Warehouse transfer).
 * Section 2 — payment status (Paid / Unpaid / Partial / Due).
 * Every checkbox is independent (multi-select). "Pastro" clears all selections;
 * "Apliko" commits and closes. The modal shows the CURRENT selection when opened.
 */
export function FilterModal({
  visible,
  initial,
  onClose,
  onApply,
}: {
  visible: boolean;
  initial: FilterModalValue;
  onClose: () => void;
  onApply: (value: FilterModalValue) => void;
}) {
  const colors = useColors();
  const [types, setTypes] = React.useState<string[]>(initial.types);
  const [statuses, setStatuses] = React.useState<string[]>(initial.statuses);

  // Re-sync local draft to the current selection each time the modal opens.
  React.useEffect(() => {
    if (visible) {
      setTypes(initial.types);
      setStatuses(initial.statuses);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const clear = () => {
    setTypes([]);
    setStatuses([]);
  };

  const apply = () => {
    onApply({ types, statuses });
    onClose();
  };

  const Row = ({
    label,
    checked,
    onPress,
  }: {
    label: string;
    checked: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 16, color: colors.foreground }}>{label}</Text>
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 5,
          borderWidth: 2,
          borderColor: checked ? APPLY_RED : colors.muted,
          backgroundColor: checked ? APPLY_RED : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked ? <IconSymbol name="checkmark" size={16} color="#fff" /> : null}
      </View>
    </Pressable>
  );

  const SectionTitle = ({ title }: { title: string }) => (
    <Text
      style={{
        fontSize: 13,
        fontWeight: "800",
        color: colors.muted,
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 6,
        textTransform: "uppercase",
        letterSpacing: 0.5,
      }}
    >
      {title}
    </Text>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Dim backdrop — tap to dismiss */}
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
      >
        {/* Sheet — stop propagation so taps inside don't dismiss */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: "85%",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingVertical: 18,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.foreground }}>
              Filtro Sipas
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Mbyll">
              <IconSymbol name="xmark" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <SectionTitle title="Lloji i Dokumentit" />
            {DOC_TYPES.map((t) => (
              <Row
                key={t.value}
                label={t.label}
                checked={types.includes(t.value)}
                onPress={() => setTypes((cur) => toggle(cur, t.value))}
              />
            ))}

            <SectionTitle title="Statusi i Pagesës" />
            {PAY_STATUSES.map((s) => (
              <Row
                key={s.value}
                label={s.label}
                checked={statuses.includes(s.value)}
                onPress={() => setStatuses((cur) => toggle(cur, s.value))}
              />
            ))}
            <View style={{ height: 12 }} />
          </ScrollView>

          {/* Footer actions */}
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: colors.border,
            }}
          >
            <Pressable
              onPress={clear}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: colors.background,
                borderRadius: 28,
                paddingVertical: 15,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>Pastro</Text>
            </Pressable>
            <Pressable
              onPress={apply}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: APPLY_RED,
                borderRadius: 28,
                paddingVertical: 15,
                alignItems: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#fff" }}>Apliko</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
