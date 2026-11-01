import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  availableRanges, DEFAULT_RANGE, effectiveRange, RANGE_LABEL, sliceRange, toneOf, type PointText, type RangeKey,
} from "../domain/chartModel";
import { summarizePoints } from "../domain/score";
import type { GraphPoint } from "../domain/types";
import { longDate, signed } from "../format";
import { colors, radius, space, TOUCH, type } from "../theme";
import { OutcomeGlyph } from "./icons";
import { RatingChart } from "./RatingChart";
import { Card } from "./ui";

interface Props<T extends GraphPoint> {
  title: string;
  points: readonly T[];
  describe: (point: T) => PointText;
  legend: "habit" | "overall";
  /** True when no real check-in exists in the whole timeline (the line is flat only because nothing was recorded). */
  nothingRecorded?: boolean;
}

const LEGEND = {
  habit: [
    { tone: "up", glyph: "good", label: "Good day  +1" },
    { tone: "down", glyph: "slip", label: "Slip-up  −1" },
    { tone: "flat", glyph: "missed", label: "No change  0" },
  ],
  overall: [
    { tone: "up", glyph: "good", label: "Net gain" },
    { tone: "down", glyph: "slip", label: "Net dip" },
    { tone: "flat", glyph: "missed", label: "Even day" },
  ],
} as const;

/** Range selector + chart + the details of the tapped day + legend. Used for one habit and for overall growth. */
export function RatingChartCard<T extends GraphPoint>({ title, points, describe, legend, nothingRecorded }: Props<T>) {
  const [range, setRange] = useState<RangeKey>(DEFAULT_RANGE);
  const [selected, setSelected] = useState<number | null>(null);

  const ranges = useMemo(() => availableRanges(points.length), [points.length]);
  const active = effectiveRange(range, points.length);
  const visible = useMemo(() => sliceRange(points, active), [points, active]);

  // A new window or new data invalidates the selected index.
  useEffect(() => setSelected(null), [active, points]);

  const sel = selected !== null ? visible[selected] : undefined;
  const text = sel ? describe(sel) : undefined;

  return (
    <Card>
      <View style={styles.header}>
        <Text style={type.heading} accessibilityRole="header">{title}</Text>
        <View style={styles.ranges} accessibilityRole="radiogroup" accessibilityLabel="Time range">
          {ranges.map((r) => (
            <Pressable
              key={String(r)}
              onPress={() => setRange(r)}
              accessibilityRole="radio"
              accessibilityLabel={RANGE_LABEL[r]}
              accessibilityState={{ selected: active === r }}
              style={[styles.rangeBtn, active === r && styles.rangeBtnOn]}
              hitSlop={{ top: 6, bottom: 6 }}
            >
              <Text style={[styles.rangeText, active === r && { color: colors.onGreen }]}>
                {r === "all" ? "All" : `${r}d`}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.plot}>
        <RatingChart
          points={visible}
          selectedIndex={selected}
          onSelect={setSelected}
          accessibilitySummary={`${title}. ${summarizePoints(visible)}`}
        />
      </View>

      {sel && text ? (
        <View style={styles.detail} accessibilityLiveRegion="polite">
          <View style={styles.detailTop}>
            <OutcomeGlyph outcome={sel.outcome} size={16} />
            <Text style={[type.heading, { flex: 1 }]}>{text.head}</Text>
            <Text style={[styles.delta, { color: deltaColor(sel.delta) }]}>{signed(sel.delta)}</Text>
          </View>
          <Text style={type.small}>{longDate(sel.date)} · Day {(selected ?? 0) + 1} of {visible.length}</Text>
          <Text style={type.body}>
            Rating {signed(sel.previousRating)} → <Text style={{ fontWeight: "700" }}>{signed(sel.rating)}</Text>
          </Text>
          {text.body ? <Text style={type.small}>{text.body}</Text> : null}
        </View>
      ) : (
        <Text style={[type.small, styles.hint]}>
          {nothingRecorded
            ? "Nothing recorded yet, so the line stays level. Check in and it will start to move."
            : "Touch or drag along the chart to see a day's details."}
        </Text>
      )}

      <View style={styles.legend}>
        {LEGEND[legend].map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <OutcomeGlyph outcome={l.glyph} size={12} />
            <Text style={type.small}>{l.label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const deltaColor = (d: number) => (toneOf(d) === "up" ? colors.chartLine : toneOf(d) === "down" ? colors.chartSlip : colors.chartFlat);

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  ranges: { flexDirection: "row", gap: space.xs },
  rangeBtn: {
    minWidth: 44, minHeight: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", paddingHorizontal: space.md,
  },
  rangeBtnOn: { backgroundColor: colors.green, borderColor: colors.green },
  rangeText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  plot: { backgroundColor: colors.chartBg, borderRadius: radius.md, overflow: "hidden", marginHorizontal: -space.xs },
  hint: { minHeight: TOUCH, textAlignVertical: "center" },
  detail: {
    backgroundColor: colors.bgElevated, borderRadius: radius.md, padding: space.md, gap: 4, minHeight: TOUCH + 28,
  },
  detailTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  delta: { fontSize: 18, fontWeight: "700" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
});
