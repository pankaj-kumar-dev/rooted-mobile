import type { CheckInOutcome } from "./types";
import { MAX_ACTIVE_HABITS } from "./score";
import { isValidDateKey } from "./dateKeys";
import { isHabitIcon, type HabitIconName } from "./presets";

export const SCHEMA_VERSION = 2 as const;

/** Field limits mirror the web database constraints (supabase/migrations/0001_init.sql). */
export const LIMITS = { name: 40, description: 200, definition: 200 } as const;

export interface HabitRecord {
  id: string;
  presetKey: string | null;
  name: string;
  icon: HabitIconName;
  description: string;
  goodDay: string;
  slipDay: string;
  /** false = archived. Archived habits keep their full history. */
  active: boolean;
  createdAt: string; // ISO timestamp
}

/** One authoritative outcome per (habitId, date). Ratings are derived, never stored. */
export interface CheckInRecord {
  habitId: string;
  date: string; // local YYYY-MM-DD
  outcome: CheckInOutcome;
  updatedAt: string; // ISO timestamp
}

export interface RootedState {
  schemaVersion: typeof SCHEMA_VERSION;
  habits: HabitRecord[];
  checkIns: CheckInRecord[];
  /** Reserved for future preferences (reminders etc.). Intentionally empty in the MVP. */
  settings: Record<string, never>;
}

export const EMPTY_STATE: RootedState = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  habits: [],
  checkIns: [],
  settings: {},
}) as RootedState;

export type DomainErrorCode =
  | "habit_not_found"
  | "habit_limit"
  | "habit_inactive"
  | "invalid_name"
  | "invalid_text"
  | "invalid_date"
  | "future_date"
  | "invalid_outcome"
  | "duplicate_preset";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export const LIMIT_MESSAGE = "You can track up to five habits. Archive one to add another.";

export const activeHabits = (state: RootedState): HabitRecord[] => state.habits.filter((h) => h.active);
export const archivedHabits = (state: RootedState): HabitRecord[] => state.habits.filter((h) => !h.active);
export const canActivateMore = (state: RootedState): boolean => activeHabits(state).length < MAX_ACTIVE_HABITS;

export interface HabitInput {
  name: string;
  description?: string;
  goodDay?: string;
  slipDay?: string;
  icon?: HabitIconName;
  presetKey?: string | null;
}

export interface Deps {
  now: () => Date;
  newId: () => string;
}

function defaultId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
export const defaultDeps: Deps = { now: () => new Date(), newId: defaultId };

function cleanName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < 1) throw new DomainError("invalid_name", "Give your habit a name.");
  if (name.length > LIMITS.name) {
    throw new DomainError("invalid_name", `Habit names can be up to ${LIMITS.name} characters.`);
  }
  return name;
}

function cleanText(raw: string | undefined, max: number, label: string): string {
  const v = (raw ?? "").trim();
  if (v.length > max) throw new DomainError("invalid_text", `${label} can be up to ${max} characters.`);
  return v;
}

/** Adds a new active habit. Definitions are optional. Enforces the five-active cap. */
export function createHabit(state: RootedState, input: HabitInput, deps: Deps = defaultDeps): RootedState {
  if (!canActivateMore(state)) throw new DomainError("habit_limit", LIMIT_MESSAGE);
  const presetKey = input.presetKey ?? null;
  if (presetKey && state.habits.some((h) => h.presetKey === presetKey)) {
    // Mirrors web's unique (user, preset_key): a preset exists once; reactivate it instead.
    throw new DomainError("duplicate_preset", "That suggested habit is already in your list.");
  }
  const habit: HabitRecord = {
    id: deps.newId(),
    presetKey,
    name: cleanName(input.name),
    icon: isHabitIcon(input.icon) ? input.icon : "spark",
    description: cleanText(input.description, LIMITS.description, "Description"),
    goodDay: cleanText(input.goodDay, LIMITS.definition, "Good-day definition"),
    slipDay: cleanText(input.slipDay, LIMITS.definition, "Slip-up definition"),
    active: true,
    createdAt: deps.now().toISOString(),
  };
  return { ...state, habits: [...state.habits, habit] };
}

export type HabitPatch = Partial<Pick<HabitInput, "name" | "description" | "goodDay" | "slipDay" | "icon">>;

/** Edits habit text only. History is untouched, so ratings never change. */
export function updateHabit(state: RootedState, habitId: string, patch: HabitPatch): RootedState {
  const habit = state.habits.find((h) => h.id === habitId);
  if (!habit) throw new DomainError("habit_not_found", "That habit no longer exists.");
  const next: HabitRecord = {
    ...habit,
    ...(patch.name !== undefined ? { name: cleanName(patch.name) } : {}),
    ...(patch.description !== undefined
      ? { description: cleanText(patch.description, LIMITS.description, "Description") }
      : {}),
    ...(patch.goodDay !== undefined
      ? { goodDay: cleanText(patch.goodDay, LIMITS.definition, "Good-day definition") }
      : {}),
    ...(patch.slipDay !== undefined
      ? { slipDay: cleanText(patch.slipDay, LIMITS.definition, "Slip-up definition") }
      : {}),
    ...(patch.icon !== undefined && isHabitIcon(patch.icon) ? { icon: patch.icon } : {}),
  };
  return { ...state, habits: state.habits.map((h) => (h.id === habitId ? next : h)) };
}

/** Archive (false) or reactivate (true). Never deletes the habit or its check-ins. Reactivating respects the cap. */
export function setHabitActive(state: RootedState, habitId: string, active: boolean): RootedState {
  const habit = state.habits.find((h) => h.id === habitId);
  if (!habit) throw new DomainError("habit_not_found", "That habit no longer exists.");
  if (habit.active === active) return state;
  if (active && !canActivateMore(state)) throw new DomainError("habit_limit", LIMIT_MESSAGE);
  return { ...state, habits: state.habits.map((h) => (h.id === habitId ? { ...h, active } : h)) };
}

const OUTCOMES: readonly CheckInOutcome[] = ["good", "slip", "missed"];

/**
 * Set, change, or (outcome = null) clear one habit's outcome for one local date.
 * Upsert on (habitId, date), so duplicates are impossible. Any past date is allowed, never a future one.
 * Only active habits accept changes; archived habits keep their history read-only.
 */
export function setCheckIn(
  state: RootedState,
  habitId: string,
  date: string,
  outcome: CheckInOutcome | null,
  today: string,
  deps: Deps = defaultDeps,
): RootedState {
  const habit = state.habits.find((h) => h.id === habitId);
  if (!habit) throw new DomainError("habit_not_found", "That habit no longer exists.");
  if (!habit.active) throw new DomainError("habit_inactive", "Reactivate this habit to change its check-ins.");
  if (!isValidDateKey(date)) throw new DomainError("invalid_date", "That date is not valid.");
  if (!isValidDateKey(today)) throw new DomainError("invalid_date", "Today's date is not valid.");
  if (date > today) throw new DomainError("future_date", "You can't check in for a day that hasn't happened yet.");
  if (outcome !== null && !OUTCOMES.includes(outcome)) throw new DomainError("invalid_outcome", "Unknown outcome.");

  const rest = state.checkIns.filter((c) => !(c.habitId === habitId && c.date === date));
  if (outcome === null) {
    return rest.length === state.checkIns.length ? state : { ...state, checkIns: rest };
  }
  const record: CheckInRecord = { habitId, date, outcome, updatedAt: deps.now().toISOString() };
  return { ...state, checkIns: [...rest, record] };
}

export function checkInFor(state: RootedState, habitId: string, date: string): CheckInRecord | undefined {
  return state.checkIns.find((c) => c.habitId === habitId && c.date === date);
}
