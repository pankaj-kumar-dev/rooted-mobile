/**
 * Suggested habits. Ids, names, icons and definitions mirror the web demo presets
 * (rooted/src/data/demo.ts) so both products describe the same habits.
 */
export type HabitIconName = "phone" | "glass" | "smoke" | "wave" | "run" | "moon" | "leaf" | "book" | "spark";

export const HABIT_ICONS: readonly HabitIconName[] = [
  "phone", "glass", "smoke", "wave", "run", "moon", "leaf", "book", "spark",
];

export const isHabitIcon = (v: unknown): v is HabitIconName =>
  typeof v === "string" && (HABIT_ICONS as readonly string[]).includes(v);

export interface HabitPreset {
  key: string;
  name: string;
  icon: HabitIconName;
  category: string;
  description: string;
  goodDay: string;
  slipDay: string;
}

export const HABIT_PRESETS: readonly HabitPreset[] = [
  { key: "phone", name: "Less phone time", icon: "phone", category: "Focus", description: "Screen time under my own limit.", goodDay: "Under 2h of screen time", slipDay: "Over my limit" },
  { key: "alcohol", name: "Alcohol goal", icon: "glass", category: "Substances", description: "Stay within the goal I set.", goodDay: "Stayed within my goal", slipDay: "Went past my goal" },
  { key: "cigarettes", name: "No cigarettes", icon: "smoke", category: "Substances", description: "A smoke-free day, on my terms.", goodDay: "Smoke-free day", slipDay: "Had a cigarette" },
  { key: "anger", name: "Anger management", icon: "wave", category: "Mind", description: "Pause before reacting.", goodDay: "Paused and responded calmly", slipDay: "Reacted in a way I regret" },
  { key: "exercise", name: "Daily exercise", icon: "run", category: "Body", description: "Move for at least 20 minutes.", goodDay: "20+ minutes of movement", slipDay: "Skipped on purpose" },
  { key: "sleep", name: "Sleep by 11pm", icon: "moon", category: "Body", description: "Lights out on my schedule.", goodDay: "In bed by 11pm", slipDay: "Stayed up late" },
  { key: "sugar", name: "Less sugar", icon: "leaf", category: "Body", description: "Fewer sweet snacks, my definition.", goodDay: "Stayed within my own limit", slipDay: "Went past my limit" },
  { key: "reading", name: "Read 15 minutes", icon: "book", category: "Mind", description: "A small daily page habit.", goodDay: "Read for 15+ minutes", slipDay: "Chose not to read" },
];

export function presetByKey(key: string): HabitPreset | undefined {
  return HABIT_PRESETS.find((p) => p.key === key);
}
