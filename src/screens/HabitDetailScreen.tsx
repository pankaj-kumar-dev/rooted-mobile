import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HabitFormSheet } from "../components/HabitFormSheet";
import { ChevronLeft, HabitIcon, OutcomeGlyph } from "../components/icons";
import { OutcomePicker } from "../components/OutcomePicker";
import { RatingChartCard } from "../components/RatingChartCard";
import { Button, Card, Sheet, Stat } from "../components/ui";
import { describeHabitPoint } from "../domain/chartModel";
import { shiftDate } from "../domain/dates";
import { describeOutcome } from "../domain/score";
import { timelinesFor } from "../domain/selectors";
import { checkInFor, canActivateMore, LIMIT_MESSAGE } from "../domain/state";
import type { DisplayOutcome, GraphPoint } from "../domain/types";
import { outcomeLabel, signed, weekdayDate } from "../format";
import { useRooted } from "../store/RootedProvider";
import { colors, fonts, space, TOUCH, type } from "../theme";

const PAGE = 14;

export function HabitDetailScreen({ habitId, onBack }: { habitId: string; onBack: () => void }) {
  const { state, today, setOutcome, setActive, editHabit } = useRooted();
  const insets = useSafeAreaInsets();
  const habit = state.habits.find((h) => h.id === habitId);
  const [days, setDays] = useState(PAGE);
  const [editing, setEditing] = useState(false);
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  const points = useMemo<GraphPoint[]>(
    () => timelinesFor(state, [habitId], today, Math.max(30, days))[habitId] ?? [],
    [state, habitId, today, days],
  );
  // Chart window: the habit's whole history (at least 30 days), independent of how many list days are shown.
  const chartPoints = useMemo<GraphPoint[]>(
    () => timelinesFor(state, [habitId], today)[habitId] ?? [],
    [state, habitId, today],
  );
  const byDate = useMemo(() => new Map(points.map((p) => [p.date, p])), [points]);

  if (!habit) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + space.lg, paddingHorizontal: space.lg, gap: space.lg }]}>
        <Text style={type.title}>This habit no longer exists.</Text>
        <Button label="Back" onPress={onBack} />
      </View>
    );
  }

  const rating = points.length ? points[points.length - 1]!.rating : 0;
  const records = state.checkIns.filter((c) => c.habitId === habitId);
  const count = (o: string) => records.filter((c) => c.outcome === o).length;
  const dayList = Array.from({ length: days }, (_, i) => shiftDate(today, -i));
  const picked = pickedDate ? byDate.get(pickedDate) : undefined;
  const pickedCurrent = pickedDate ? checkInFor(state, habitId, pickedDate)?.outcome : undefined;
  const editable = habit.active;

  function confirmArchive() {
    Alert.alert(
      "Archive this habit?",
      "It leaves your daily check-ins, but its history stays on this device. You can reactivate it later.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Archive", onPress: () => { if (setActive(habitId, false)) onBack(); } },
      ],
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={styles.backBtn} hitSlop={8}>
          <ChevronLeft />
        </Pressable>
        <Text style={[type.heading, { flex: 1 }]} numberOfLines={1} accessibilityRole="header">{habit.name}</Text>
        {editable ? (
          <Pressable onPress={() => setEditing(true)} accessibilityRole="button" accessibilityLabel="Edit habit" style={styles.backBtn}>
            <Text style={{ color: colors.green, fontWeight: "700" }}>Edit</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl + insets.bottom, gap: space.lg }}>
        <Card>
          <View style={styles.hero}>
            <View style={styles.iconWrap}><HabitIcon name={habit.icon} size={28} /></View>
            <View style={{ flex: 1 }}>
              <Text style={type.small}>CURRENT RATING</Text>
              <Text style={styles.rating} accessibilityLabel={`Current rating ${signed(rating)}`}>{signed(rating)}</Text>
            </View>
            {!habit.active ? <Text style={styles.archivedTag}>ARCHIVED</Text> : null}
          </View>
          {habit.description ? <Text style={type.muted}>{habit.description}</Text> : null}
          <View style={{ flexDirection: "row", gap: space.sm }}>
            <Stat label="Good days" value={String(count("good"))} />
            <Stat label="Slip-ups" value={String(count("slip"))} />
            <Stat label="Missed" value={String(count("missed"))} />
          </View>
        </Card>

        <RatingChartCard
          title="Rating over time"
          points={chartPoints}
          describe={describeHabitPoint}
          legend="habit"
          nothingRecorded={records.length === 0}
        />

        <Card>
          <Text style={type.heading}>Your definitions</Text>
          <View style={{ gap: 2 }}>
            <Text style={type.eyebrow}>GOOD DAY</Text>
            <Text style={type.body}>{habit.goodDay || "Not defined yet."}</Text>
          </View>
          <View style={{ gap: 2 }}>
            <Text style={[type.eyebrow, { color: colors.slip }]}>SLIP-UP</Text>
            <Text style={type.body}>{habit.slipDay || "Not defined yet."}</Text>
          </View>
          <Text style={type.small}>
            Good day: rating +1. Slip-up: rating −1. Missed or no check-in: unchanged. Ratings start at 0 and can go below it. Earlier days are never erased.
          </Text>
        </Card>

        <Card>
          <Text style={type.heading}>Day by day</Text>
          <Text style={type.small}>
            {editable ? "Tap any day to record, change or clear it." : "Reactivate this habit to change its days."}
          </Text>
          {dayList.map((date) => {
            const p = byDate.get(date);
            const outcome: DisplayOutcome = p?.outcome ?? "unrecorded";
            return (
              <Pressable
                key={date}
                disabled={!editable}
                onPress={() => setPickedDate(date)}
                accessibilityRole="button"
                accessibilityLabel={`${weekdayDate(date)}: ${outcomeLabel(outcome)}${p ? `, rating ${signed(p.rating)}` : ""}`}
                style={({ pressed }) => [styles.dayRow, pressed && { opacity: 0.7 }]}
              >
                <OutcomeGlyph outcome={outcome} size={16} />
                <View style={{ flex: 1 }}>
                  <Text style={type.body}>{date === today ? "Today" : weekdayDate(date)}</Text>
                  <Text style={type.small}>{outcomeLabel(outcome)}</Text>
                </View>
                {p ? (
                  <Text style={styles.dayRating}>
                    {signed(p.previousRating)} → {signed(p.rating)}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
          <Button label="Show earlier days" variant="secondary" onPress={() => setDays((d) => d + PAGE)} />
        </Card>

        {habit.active ? (
          <Button label="Archive habit" variant="danger" onPress={confirmArchive} accessibilityHint="Keeps all history" />
        ) : (
          <View style={{ gap: space.sm }}>
            <Button
              label="Reactivate habit"
              disabled={!canActivateMore(state)}
              onPress={() => setActive(habitId, true)}
            />
            {!canActivateMore(state) ? <Text style={type.small}>{LIMIT_MESSAGE}</Text> : null}
          </View>
        )}
      </ScrollView>

      <Sheet visible={pickedDate !== null} onClose={() => setPickedDate(null)} title={pickedDate ? (pickedDate === today ? "Today" : weekdayDate(pickedDate)) : ""}>
        {pickedDate ? (
          <>
            <Text style={type.muted}>{habit.name}</Text>
            <OutcomePicker
              value={pickedCurrent}
              onChange={(o) => setOutcome(habitId, pickedDate, o)}
              habitName={habit.name}
              dayLabel={weekdayDate(pickedDate)}
            />
            <Card style={{ backgroundColor: colors.bgElevated }}>
              <Text style={type.body}>{describeOutcome(picked?.outcome ?? "unrecorded")}</Text>
              {picked ? (
                <Text style={type.small}>Rating {signed(picked.previousRating)} → {signed(picked.rating)} on this day. Later days update automatically.</Text>
              ) : null}
            </Card>
            <Button label="Done" onPress={() => setPickedDate(null)} />
          </>
        ) : null}
      </Sheet>

      <HabitFormSheet
        visible={editing}
        habit={habit}
        onClose={() => setEditing(false)}
        onSubmit={(v) => editHabit(habitId, v)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.sm, paddingBottom: space.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bgElevated,
  },
  backBtn: { minWidth: TOUCH, minHeight: TOUCH, alignItems: "center", justifyContent: "center" },
  hero: { flexDirection: "row", alignItems: "center", gap: space.md },
  iconWrap: {
    width: 56, height: 56, borderRadius: 18, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center",
  },
  rating: { color: colors.green, fontFamily: fonts.display, fontSize: 44, lineHeight: 50 },
  archivedTag: { color: colors.neutral, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  dayRow: {
    flexDirection: "row", alignItems: "center", gap: space.md, minHeight: TOUCH + 4,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  dayRating: { color: colors.textMuted, fontSize: 13, fontVariant: ["tabular-nums"] },
});
