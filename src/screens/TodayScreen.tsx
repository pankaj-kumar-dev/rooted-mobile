import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HabitIcon, LeafMark, ChevronRight } from "../components/icons";
import { OutcomePicker } from "../components/OutcomePicker";
import type { Tab } from "../components/TabBar";
import { Button, Card, ScreenScroll, SectionHeader } from "../components/ui";
import { activeHabits, checkInFor } from "../domain/state";
import { longDate, signed } from "../format";
import { useRooted } from "../store/RootedProvider";
import { colors, fonts, radius, space, type } from "../theme";

export function TodayScreen({ onOpenHabit, onGoTab }: { onOpenHabit: (id: string) => void; onGoTab: (t: Tab) => void }) {
  const { state, today, growth, ratingFor, setOutcome } = useRooted();
  const habits = activeHabits(state);
  const done = habits.filter((h) => checkInFor(state, h.id, today)).length;

  return (
    <ScreenScroll>
      <View style={styles.brandRow}>
        <LeafMark />
        <Text style={styles.brand} accessibilityRole="header">ROOTED</Text>
      </View>
      <View style={{ gap: space.xs }}>
        <Text style={type.eyebrow}>{longDate(today).toUpperCase()}</Text>
        <Text style={type.display}>How did today go?</Text>
      </View>

      {habits.length === 0 ? (
        <Card>
          <Text style={type.title}>Start with one thing.</Text>
          <Text style={type.muted}>
            Choose a habit that matters to you. Track up to five; five is a limit, not a target.
          </Text>
          <Button label="Choose your habits" onPress={() => onGoTab("Habits")} />
          <Text style={type.small}>ROOTED is a reflection tool, not medical treatment.</Text>
        </Card>
      ) : (
        <>
          <Pressable
            onPress={() => onGoTab("Journey")}
            accessibilityRole="button"
            accessibilityLabel={`${done} of ${habits.length} checked in today. Overall growth ${signed(growth.summary.totalNet)}. Open journey.`}
          >
            <Card style={styles.summary}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.small}>TODAY</Text>
                <Text style={styles.summaryBig}>{done} of {habits.length}</Text>
                <Text style={type.small}>checked in</Text>
              </View>
              <View style={styles.divider} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.small}>OVERALL GROWTH</Text>
                <Text style={styles.summaryBig}>{signed(growth.summary.totalNet)}</Text>
                <Text style={type.small}>across {habits.length} habit{habits.length > 1 ? "s" : ""}</Text>
              </View>
              <ChevronRight />
            </Card>
          </Pressable>

          <SectionHeader title="Your habits" trailing={done === habits.length ? "All recorded" : "Tap to record"} />
          {habits.map((h) => {
            const current = checkInFor(state, h.id, today);
            const rating = ratingFor(h.id);
            return (
              <Card key={h.id}>
                <Pressable
                  style={styles.cardTop}
                  onPress={() => onOpenHabit(h.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${h.name}, rating ${signed(rating)}. Open details.`}
                >
                  <View style={styles.iconWrap}><HabitIcon name={h.icon} /></View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={type.heading} numberOfLines={1}>{h.name}</Text>
                    <Text style={type.small} numberOfLines={1}>{h.goodDay || h.description || "Details"}</Text>
                  </View>
                  <View style={styles.rating}>
                    <Text style={styles.ratingNum}>{signed(rating)}</Text>
                    <Text style={styles.ratingCap}>RATING</Text>
                  </View>
                </Pressable>
                <OutcomePicker
                  value={current?.outcome}
                  onChange={(o) => setOutcome(h.id, today, o)}
                  habitName={h.name}
                  dayLabel="today"
                />
                <Text style={type.small}>
                  {current
                    ? current.outcome === "good"
                      ? "Recorded: good day. Rating +1. Tap it again to clear."
                      : current.outcome === "slip"
                        ? "Recorded: slip-up. Rating −1. Your history stays. Tap it again to clear."
                        : "Recorded: missed. Rating unchanged. Tap it again to clear."
                    : "Not checked in yet. Nothing is assumed."}
                </Text>
              </Card>
            );
          })}
          <Card style={styles.principle}>
            <Text style={styles.principleTitle}>A setback is a step, not the whole staircase.</Text>
            <Text style={type.muted}>
              Good day +1 · Slip-up −1 · Missed check-in 0. Every earlier day stays on the record. You can fix any past day from a habit&apos;s page.
            </Text>
          </Card>
        </>
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  brand: { color: colors.text, fontSize: 15, fontWeight: "800", letterSpacing: 4 },
  summary: { flexDirection: "row", alignItems: "center", gap: space.md },
  summaryBig: { color: colors.text, fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
  divider: { width: 1, alignSelf: "stretch", backgroundColor: colors.border },
  cardTop: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 48 },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceRaised,
    alignItems: "center", justifyContent: "center",
  },
  rating: { alignItems: "center", minWidth: 52 },
  ratingNum: { color: colors.green, fontFamily: fonts.display, fontSize: 26, lineHeight: 30 },
  ratingCap: { color: colors.textMuted, fontSize: 9.5, letterSpacing: 1 },
  principle: { backgroundColor: colors.bgElevated },
  principleTitle: { ...type.title, fontSize: 18, lineHeight: 24 },
});
