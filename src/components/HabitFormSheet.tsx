import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HABIT_ICONS, type HabitIconName } from "../domain/presets";
import { LIMITS, type HabitRecord } from "../domain/state";
import { colors, radius, space, TOUCH, type } from "../theme";
import { HabitIcon } from "./icons";
import { Button, Field, Sheet } from "./ui";

interface Props {
  visible: boolean;
  /** Pass a habit to edit it; omit to create a new one. */
  habit?: HabitRecord;
  onClose: () => void;
  /** Returns true on success (the sheet then closes). */
  onSubmit: (v: { name: string; description: string; goodDay: string; slipDay: string; icon: HabitIconName }) => boolean;
}

export function HabitFormSheet({ visible, habit, onClose, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goodDay, setGoodDay] = useState("");
  const [slipDay, setSlipDay] = useState("");
  const [icon, setIcon] = useState<HabitIconName>("spark");

  // Re-seed whenever the sheet opens, so edits never leak between habits.
  useEffect(() => {
    if (!visible) return;
    setName(habit?.name ?? "");
    setDescription(habit?.description ?? "");
    setGoodDay(habit?.goodDay ?? "");
    setSlipDay(habit?.slipDay ?? "");
    setIcon(habit?.icon ?? "spark");
  }, [visible, habit]);

  const canSave = name.trim().length > 0;

  return (
    <Sheet visible={visible} onClose={onClose} title={habit ? "Edit habit" : "Create a habit"}>
      <Text style={type.muted}>
        Write rules that fit your life. You decide what a good day and a slip-up mean for this habit.
        {habit ? " Editing the words never changes your history or ratings." : ""}
      </Text>
      <Field label="Habit name" value={name} onChangeText={setName} maxLength={LIMITS.name} placeholder="e.g. Cook at home" autoCapitalize="sentences" />
      <Field label="What counts as a good day?" optional value={goodDay} onChangeText={setGoodDay} maxLength={LIMITS.definition} multiline placeholder="e.g. Cooked one meal at home" />
      <Field label="What counts as a slip-up?" optional value={slipDay} onChangeText={setSlipDay} maxLength={LIMITS.definition} multiline placeholder="e.g. Ordered takeaway instead" />
      <Field label="Short description" optional value={description} onChangeText={setDescription} maxLength={LIMITS.description} placeholder="Why it matters to you" />
      <View style={{ gap: space.xs }}>
        <Text style={type.eyebrow}>ICON</Text>
        <View style={styles.icons}>
          {HABIT_ICONS.map((n) => (
            <Pressable
              key={n}
              onPress={() => setIcon(n)}
              accessibilityRole="radio"
              accessibilityLabel={`Icon ${n}`}
              accessibilityState={{ selected: icon === n }}
              style={[styles.iconBtn, icon === n && styles.iconBtnOn]}
            >
              <HabitIcon name={n} color={icon === n ? colors.green : colors.textMuted} />
            </Pressable>
          ))}
        </View>
      </View>
      <Button
        label={habit ? "Save changes" : "Add habit"}
        disabled={!canSave}
        accessibilityHint={canSave ? undefined : "Enter a habit name first"}
        onPress={() => {
          if (onSubmit({ name, description, goodDay, slipDay, icon })) onClose();
        }}
      />
      {!habit ? <Text style={type.small}>You can track up to five active habits. Ratings start at 0.</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  icons: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  iconBtn: {
    width: TOUCH, height: TOUCH, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.bgElevated,
  },
  iconBtnOn: { borderColor: colors.green, backgroundColor: colors.surfaceRaised },
});
