import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CheckInOutcome } from "../domain/types";
import { colors, radius, space, TOUCH } from "../theme";
import { OutcomeGlyph } from "./icons";

const CHOICES: ReadonlyArray<{ outcome: CheckInOutcome; label: string; hint: string; color: string }> = [
  { outcome: "good", label: "Good day", hint: "+1", color: colors.greenStrong },
  { outcome: "slip", label: "Slip-up", hint: "−1", color: colors.slip },
  { outcome: "missed", label: "Missed", hint: "no change", color: colors.neutral },
];

interface Props {
  value: CheckInOutcome | undefined;
  /** `null` clears the day. Tapping the selected option again clears it, like the web app. */
  onChange: (next: CheckInOutcome | null) => void;
  habitName: string;
  dayLabel: string;
}

export function OutcomePicker({ value, onChange, habitName, dayLabel }: Props) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={`${habitName}, ${dayLabel}`}>
      {CHOICES.map((c) => {
        const selected = value === c.outcome;
        return (
          <Pressable
            key={c.outcome}
            accessibilityRole="radio"
            accessibilityLabel={`${c.label}, ${c.hint}`}
            accessibilityHint={selected ? "Selected. Tap again to clear this day." : undefined}
            accessibilityState={{ selected }}
            onPress={() => onChange(selected ? null : c.outcome)}
            style={({ pressed }) => [
              styles.choice,
              selected && { borderColor: c.color, backgroundColor: colors.surfaceRaised },
              pressed && { opacity: 0.7 },
            ]}
          >
            <OutcomeGlyph outcome={c.outcome} size={16} />
            <Text style={[styles.label, selected && { color: colors.text }]} numberOfLines={1}>{c.label}</Text>
            <Text style={[styles.hint, selected && { color: c.color }]} numberOfLines={1}>{c.hint}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.sm },
  choice: {
    flex: 1,
    minHeight: TOUCH + 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.sm,
    paddingHorizontal: 2,
    gap: 2,
  },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  hint: { color: colors.textMuted, fontSize: 11 },
});
