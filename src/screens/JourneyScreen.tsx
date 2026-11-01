import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight, HabitIcon } from "../components/icons";
import type { Tab } from "../components/TabBar";
import { RatingChartCard } from "../components/RatingChartCard";
import { Button, Card, ScreenScroll, SectionHeader, Stat } from "../components/ui";
import { describeCombinedPoint } from "../domain/chartModel";
import { signed } from "../format";
import { useRooted } from "../store/RootedProvider";
import { colors, fonts, space, TOUCH, type } from "../theme";

/** Overall growth chart and summary, plus an entry point to each habit's own chart. */
export function JourneyScreen({ onOpenHabit, onGoTab }: { onOpenHabit: (id: string) => void; onGoTab: (t: Tab) => void }) {
  const { growth, ratingFor, state } = useRooted();
  const { summary, habits, combined } = growth;
  const nameById = useMemo(() => Object.fromEntries(habits.map((h) => [h.id, h.name])), [habits]);
  const activeIds = new Set(habits.map((h) => h.id));
  const nothingRecorded = !state.checkIns.some((c) => activeIds.has(c.habitId));

  return (
    <ScreenScroll>
      <View style={{ gap: space.xs }}>
        <Text style={type.eyebrow}>YOUR HISTORY</Text>
        <Text style={type.display}>Your journey.</Text>
        <Text style={type.muted}>No streaks to protect. A hard day never erases earlier progress.</Text>
      </View>

      {habits.length === 0 ? (
        <Card>
          <Text style={type.title}>Your journey starts here.</Text>
          <Text style={type.muted}>Add a habit to see your progress take shape.</Text>
          <Button label="Choose your habits" onPress={() => onGoTab("Habits")} />
        </Card>
      ) : (
        <>
          <Card>
            <Text style={type.small}>OVERALL GROWTH</Text>
            <Text style={styles.big} accessibilityLabel={`Overall growth ${signed(summary.totalNet)}`}>{signed(summary.totalNet)}</Text>
            <Text style={type.small}>
              The sum of every day&apos;s changes across your {habits.length} active habit{habits.length > 1 ? "s" : ""}.
            </Text>
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <Stat label="Days up" value={String(summary.daysUp)} />
              <Stat label="Days down" value={String(summary.daysDown)} />
              <Stat label="Days level" value={String(summary.daysLevel)} />
            </View>
          </Card>

          <RatingChartCard
            title="Combined rating"
            points={combined}
            describe={(p) => describeCombinedPoint(p, nameById)}
            legend="overall"
            nothingRecorded={nothingRecorded}
          />

          <SectionHeader title="Each habit" trailing="Tap for history" />
          {habits.map((h) => {
            const g = summary.perHabit.find((p) => p.habitId === h.id);
            return (
              <Pressable
                key={h.id}
                onPress={() => onOpenHabit(h.id)}
                accessibilityRole="button"
                accessibilityLabel={`${h.name}, rating ${signed(ratingFor(h.id))}, ${g?.good ?? 0} good days, ${g?.slip ?? 0} slip-ups. Open history.`}
              >
                <Card style={styles.row}>
                  <HabitIcon name={h.icon} />
                  <View style={{ flex: 1 }}>
                    <Text style={type.heading} numberOfLines={1}>{h.name}</Text>
                    <Text style={type.small}>{g?.good ?? 0} good · {g?.slip ?? 0} slip-ups</Text>
                  </View>
                  <Text style={styles.rating}>{signed(ratingFor(h.id))}</Text>
                  <ChevronRight />
                </Card>
              </Pressable>
            );
          })}
        </>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  big: { color: colors.green, fontFamily: fonts.display, fontSize: 52, lineHeight: 58 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: TOUCH },
  rating: { color: colors.green, fontSize: 20, fontWeight: "700" },
});
