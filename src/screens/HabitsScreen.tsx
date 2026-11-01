import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { HabitFormSheet } from "../components/HabitFormSheet";
import { ChevronRight, HabitIcon } from "../components/icons";
import { Banner, Button, Card, ScreenScroll, SectionHeader } from "../components/ui";
import { HABIT_PRESETS } from "../domain/presets";
import { MAX_ACTIVE_HABITS } from "../domain/score";
import { activeHabits, archivedHabits, canActivateMore, LIMIT_MESSAGE, type HabitRecord } from "../domain/state";
import { signed } from "../format";
import { useRooted } from "../store/RootedProvider";
import { colors, radius, space, TOUCH, type } from "../theme";

export function HabitsScreen({ onOpenHabit }: { onOpenHabit: (id: string) => void }) {
  const { state, ratingFor, addHabit, addPreset, editHabit, setActive } = useRooted();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<HabitRecord | null>(null);

  const active = activeHabits(state);
  const archived = archivedHabits(state);
  const atLimit = !canActivateMore(state);
  const usedPresets = new Set(state.habits.map((h) => h.presetKey).filter(Boolean));
  const suggestions = HABIT_PRESETS.filter((p) => !usedPresets.has(p.key));

  function confirmArchive(h: HabitRecord) {
    Alert.alert(
      `Archive “${h.name}”?`,
      "It leaves your daily check-ins, but its history stays on this device. You can reactivate it later.",
      [{ text: "Cancel", style: "cancel" }, { text: "Archive", onPress: () => setActive(h.id, false) }],
    );
  }

  return (
    <ScreenScroll>
      <View style={{ gap: space.xs }}>
        <Text style={type.eyebrow}>YOUR RULES</Text>
        <Text style={type.display}>Choose what matters.</Text>
        <Text style={type.muted}>
          Every habit has its own rating and its own meaning of success. Track one to five at a time.
        </Text>
      </View>

      <SectionHeader title="Active" trailing={`${active.length} of ${MAX_ACTIVE_HABITS}`} />
      {atLimit ? <Banner text={`You're tracking five habits. ${LIMIT_MESSAGE}`} /> : null}

      {active.length === 0 ? (
        <Card>
          <Text style={type.title}>No active habits yet.</Text>
          <Text style={type.muted}>Pick a suggestion below or create your own.</Text>
        </Card>
      ) : (
        active.map((h) => (
          <Card key={h.id}>
            <Pressable
              style={styles.row}
              onPress={() => onOpenHabit(h.id)}
              accessibilityRole="button"
              accessibilityLabel={`${h.name}, rating ${signed(ratingFor(h.id))}. Open details.`}
            >
              <View style={styles.iconWrap}><HabitIcon name={h.icon} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.heading} numberOfLines={1}>{h.name}</Text>
                <Text style={type.small} numberOfLines={2}>
                  {h.goodDay ? `Good: ${h.goodDay}` : "No definitions yet"}
                </Text>
              </View>
              <Text style={styles.rating}>{signed(ratingFor(h.id))}</Text>
              <ChevronRight />
            </Pressable>
            <View style={styles.actions}>
              <Button label="Edit" variant="secondary" onPress={() => setEditing(h)} style={styles.flex} />
              <Button label="Archive" variant="danger" onPress={() => confirmArchive(h)} style={styles.flex} />
            </View>
          </Card>
        ))
      )}

      <Button
        label="Create your own habit"
        variant={active.length === 0 ? "primary" : "secondary"}
        disabled={atLimit}
        onPress={() => setCreating(true)}
        accessibilityHint={atLimit ? LIMIT_MESSAGE : undefined}
      />
      {atLimit ? <Text style={type.small}>{LIMIT_MESSAGE}</Text> : null}

      {suggestions.length > 0 ? (
        <>
          <SectionHeader title="Suggested" trailing="Your rules, your words" />
          {suggestions.map((p) => (
            <Card key={p.key}>
              <View style={styles.row}>
                <View style={styles.iconWrap}><HabitIcon name={p.icon} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={type.heading}>{p.name}</Text>
                  <Text style={type.small}>{p.description}</Text>
                </View>
              </View>
              <Button
                label={atLimit ? "Limit reached" : `Add ${p.name}`}
                variant="secondary"
                disabled={atLimit}
                onPress={() => addPreset(p.key)}
              />
            </Card>
          ))}
          <Text style={type.small}>
            Suggestions are examples, not advice. You can edit the definitions after adding. ROOTED is a reflection tool, not medical treatment.
          </Text>
        </>
      ) : null}

      {archived.length > 0 ? (
        <>
          <SectionHeader title="Archived" trailing="History kept" />
          {archived.map((h) => (
            <Card key={h.id}>
              <Pressable
                style={styles.row}
                onPress={() => onOpenHabit(h.id)}
                accessibilityRole="button"
                accessibilityLabel={`${h.name}, archived. View history.`}
              >
                <View style={[styles.iconWrap, { opacity: 0.6 }]}><HabitIcon name={h.icon} color={colors.neutral} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={type.heading} numberOfLines={1}>{h.name}</Text>
                  <Text style={type.small}>Rating {signed(ratingFor(h.id))} · tap to view history</Text>
                </View>
                <ChevronRight />
              </Pressable>
              <Button
                label={atLimit ? "Archive one to reactivate" : "Reactivate"}
                variant="secondary"
                disabled={atLimit}
                onPress={() => setActive(h.id, true)}
              />
            </Card>
          ))}
        </>
      ) : null}

      <HabitFormSheet visible={creating} onClose={() => setCreating(false)} onSubmit={(v) => addHabit(v)} />
      <HabitFormSheet
        visible={editing !== null}
        habit={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSubmit={(v) => (editing ? editHabit(editing.id, v) : false)}
      />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: TOUCH },
  iconWrap: {
    width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceRaised,
    alignItems: "center", justifyContent: "center",
  },
  rating: { color: colors.green, fontSize: 20, fontWeight: "700" },
  actions: { flexDirection: "row", gap: space.sm },
  flex: { flex: 1 },
});
