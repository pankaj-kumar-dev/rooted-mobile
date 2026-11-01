import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, TOUCH } from "../theme";
import { TabIcon, type TabIconName } from "./icons";

export type Tab = "Today" | "Journey" | "Habits" | "Settings";
export const TABS: ReadonlyArray<{ key: Tab; icon: TabIconName }> = [
  { key: "Today", icon: "today" },
  { key: "Journey", icon: "journey" },
  { key: "Habits", icon: "habits" },
  { key: "Settings", icon: "settings" },
];

export function TabBar({ active, onSelect }: { active: Tab; onSelect: (t: Tab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {TABS.map((t) => {
        const on = active === t.key;
        return (
          <Pressable
            key={t.key}
            style={styles.item}
            onPress={() => onSelect(t.key)}
            accessibilityRole="tab"
            accessibilityLabel={t.key}
            accessibilityState={{ selected: on }}
          >
            <TabIcon name={t.icon} color={on ? colors.green : colors.textMuted} />
            <Text style={[styles.label, on && styles.labelOn]}>{t.key}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.bgElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  item: { flex: 1, minHeight: TOUCH, alignItems: "center", justifyContent: "center", gap: 3 },
  label: { color: colors.textMuted, fontSize: 11.5, fontWeight: "600" },
  labelOn: { color: colors.green },
});
