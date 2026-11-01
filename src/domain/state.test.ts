import { describe, expect, it } from "vitest";
import { isValidDateKey } from "./dateKeys";
import { overallGrowth, ratingOf, timelinesFor } from "./selectors";
import {
  activeHabits, checkInFor, createHabit, DomainError, EMPTY_STATE, setCheckIn, setHabitActive, updateHabit,
  type Deps, type RootedState,
} from "./state";

const TODAY = "2025-03-10";
let n = 0;
const deps: Deps = { now: () => new Date("2025-03-10T12:00:00Z"), newId: () => `h${++n}` };

function withHabits(count: number): RootedState {
  let s: RootedState = EMPTY_STATE;
  for (let i = 0; i < count; i++) s = createHabit(s, { name: `Habit ${i + 1}` }, deps);
  return s;
}
const expectCode = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`expected DomainError ${code}`);
};

describe("createHabit", () => {
  it("adds an active habit with optional definitions", () => {
    const s = createHabit(EMPTY_STATE, { name: "  Less   phone " }, deps);
    expect(s.habits[0]).toMatchObject({ name: "Less phone", goodDay: "", slipDay: "", active: true, icon: "spark" });
  });
  it("rejects empty and over-long names", () => {
    expectCode(() => createHabit(EMPTY_STATE, { name: "   " }, deps), "invalid_name");
    expectCode(() => createHabit(EMPTY_STATE, { name: "x".repeat(41) }, deps), "invalid_name");
  });
  it("rejects over-long definitions", () => {
    expectCode(() => createHabit(EMPTY_STATE, { name: "A", goodDay: "x".repeat(201) }, deps), "invalid_text");
  });
  it("enforces the five-active cap", () => {
    const s = withHabits(5);
    expect(activeHabits(s)).toHaveLength(5);
    expectCode(() => createHabit(s, { name: "Sixth" }, deps), "habit_limit");
  });
  it("allows a new habit once one is archived", () => {
    let s = withHabits(5);
    s = setHabitActive(s, s.habits[0]!.id, false);
    expect(activeHabits(createHabit(s, { name: "Sixth" }, deps))).toHaveLength(5);
  });
  it("does not duplicate a preset", () => {
    const s = createHabit(EMPTY_STATE, { name: "Less phone time", presetKey: "phone" }, deps);
    expectCode(() => createHabit(s, { name: "Less phone time", presetKey: "phone" }, deps), "duplicate_preset");
  });
  it("does not mutate the input state", () => {
    const before = JSON.stringify(EMPTY_STATE);
    createHabit(EMPTY_STATE, { name: "A" }, deps);
    expect(JSON.stringify(EMPTY_STATE)).toBe(before);
  });
});

describe("setCheckIn", () => {
  it("records, changes and clears an outcome for the same date without duplicates", () => {
    let s = withHabits(1);
    const id = s.habits[0]!.id;
    s = setCheckIn(s, id, TODAY, "good", TODAY, deps);
    s = setCheckIn(s, id, TODAY, "slip", TODAY, deps);
    expect(s.checkIns).toHaveLength(1);
    expect(checkInFor(s, id, TODAY)?.outcome).toBe("slip");
    s = setCheckIn(s, id, TODAY, null, TODAY, deps);
    expect(s.checkIns).toHaveLength(0);
  });
  it("re-submitting the same outcome is idempotent (no duplicate)", () => {
    let s = withHabits(1);
    const id = s.habits[0]!.id;
    s = setCheckIn(s, id, TODAY, "good", TODAY, deps);
    s = setCheckIn(s, id, TODAY, "good", TODAY, deps);
    expect(s.checkIns).toHaveLength(1);
  });
  it("allows any past date", () => {
    let s = withHabits(1);
    const id = s.habits[0]!.id;
    s = setCheckIn(s, id, "2024-01-15", "good", TODAY, deps);
    expect(s.checkIns[0]!.date).toBe("2024-01-15");
  });
  it("rejects future and invalid dates", () => {
    const s = withHabits(1);
    const id = s.habits[0]!.id;
    expectCode(() => setCheckIn(s, id, "2025-03-11", "good", TODAY, deps), "future_date");
    expectCode(() => setCheckIn(s, id, "2025-02-30", "good", TODAY, deps), "invalid_date");
    expectCode(() => setCheckIn(s, id, "03/10/2025", "good", TODAY, deps), "invalid_date");
  });
  it("rejects unknown habits, bad outcomes and archived habits", () => {
    let s = withHabits(1);
    const id = s.habits[0]!.id;
    expectCode(() => setCheckIn(s, "nope", TODAY, "good", TODAY, deps), "habit_not_found");
    expectCode(() => setCheckIn(s, id, TODAY, "skip" as never, TODAY, deps), "invalid_outcome");
    s = setHabitActive(s, id, false);
    expectCode(() => setCheckIn(s, id, TODAY, "good", TODAY, deps), "habit_inactive");
  });
  it("a missed check-in is stored as missed and never as a slip", () => {
    let s = withHabits(1);
    const id = s.habits[0]!.id;
    s = setCheckIn(s, id, TODAY, "missed", TODAY, deps);
    expect(s.checkIns[0]!.outcome).toBe("missed");
    expect(ratingOf(s, id, TODAY)).toBe(0);
  });
  it("keeps habits independent", () => {
    let s = withHabits(2);
    const [a, b] = s.habits.map((h) => h.id) as [string, string];
    s = setCheckIn(s, a, TODAY, "good", TODAY, deps);
    s = setCheckIn(s, b, TODAY, "slip", TODAY, deps);
    expect(ratingOf(s, a, TODAY)).toBe(1);
    expect(ratingOf(s, b, TODAY)).toBe(-1);
  });
});

describe("derived ratings (web semantics: baseline 0, no floor)", () => {
  it("goes negative with no floor", () => {
    let s = withHabits(1);
    const id = s.habits[0]!.id;
    s = setCheckIn(s, id, "2025-03-08", "slip", TODAY, deps);
    s = setCheckIn(s, id, "2025-03-09", "slip", TODAY, deps);
    expect(ratingOf(s, id, TODAY)).toBe(-2);
  });
  it("editing a past day recomputes every later rating consistently", () => {
    let s = withHabits(1);
    const id = s.habits[0]!.id;
    for (const [d, o] of [["2025-03-07", "good"], ["2025-03-08", "good"], ["2025-03-09", "good"]] as const) {
      s = setCheckIn(s, id, d, o, TODAY, deps);
    }
    expect(ratingOf(s, id, TODAY)).toBe(3);
    s = setCheckIn(s, id, "2025-03-07", "slip", TODAY, deps);
    const pts = timelinesFor(s, [id], TODAY)[id]!;
    expect(pts.find((p) => p.date === "2025-03-07")!.rating).toBe(-1);
    expect(pts.find((p) => p.date === "2025-03-09")!.rating).toBe(1);
    expect(ratingOf(s, id, TODAY)).toBe(1);
  });
  it("timeline covers at least 30 days and starts earlier for older check-ins", () => {
    let s = withHabits(1);
    const id = s.habits[0]!.id;
    expect(timelinesFor(s, [id], TODAY)[id]).toHaveLength(30);
    s = setCheckIn(s, id, "2025-01-01", "good", TODAY, deps);
    const pts = timelinesFor(s, [id], TODAY)[id]!;
    expect(pts[0]!.date).toBe("2025-01-01");
    expect(pts[pts.length - 1]!.date).toBe(TODAY);
  });
  it("ignores check-ins dated after today", () => {
    let s = withHabits(1);
    const id = s.habits[0]!.id;
    s = setCheckIn(s, id, "2025-03-10", "good", "2025-03-10", deps);
    expect(ratingOf(s, id, "2025-03-09")).toBe(0);
  });
});

describe("archive and reactivate", () => {
  it("keeps all history and restores the rating on reactivation", () => {
    let s = withHabits(1);
    const id = s.habits[0]!.id;
    s = setCheckIn(s, id, "2025-03-08", "good", TODAY, deps);
    s = setCheckIn(s, id, "2025-03-09", "good", TODAY, deps);
    s = setHabitActive(s, id, false);
    expect(s.checkIns).toHaveLength(2);
    expect(activeHabits(s)).toHaveLength(0);
    s = setHabitActive(s, id, true);
    expect(ratingOf(s, id, TODAY)).toBe(2);
  });
  it("blocks reactivation when five others are active", () => {
    let s = withHabits(5);
    const first = s.habits[0]!.id;
    s = setHabitActive(s, first, false);
    s = createHabit(s, { name: "Replacement" }, deps);
    expectCode(() => setHabitActive(s, first, true), "habit_limit");
  });
  it("unknown habit throws", () => {
    expectCode(() => setHabitActive(EMPTY_STATE, "x", false), "habit_not_found");
  });
});

describe("updateHabit", () => {
  it("edits text without touching history or ratings", () => {
    let s = withHabits(1);
    const id = s.habits[0]!.id;
    s = setCheckIn(s, id, TODAY, "good", TODAY, deps);
    const edited = updateHabit(s, id, { name: "Renamed", goodDay: "New meaning" });
    expect(edited.habits[0]).toMatchObject({ name: "Renamed", goodDay: "New meaning" });
    expect(edited.checkIns).toEqual(s.checkIns);
    expect(ratingOf(edited, id, TODAY)).toBe(1);
  });
  it("validates edits", () => {
    const s = withHabits(1);
    expectCode(() => updateHabit(s, s.habits[0]!.id, { name: "" }), "invalid_name");
    expectCode(() => updateHabit(s, "nope", { name: "A" }), "habit_not_found");
  });
});

describe("overallGrowth", () => {
  it("sums daily deltas across active habits only (+1 x4, -1 x1 = +3)", () => {
    let s = withHabits(5);
    s.habits.forEach((h, i) => {
      s = setCheckIn(s, h.id, TODAY, i === 4 ? "slip" : "good", TODAY, deps);
    });
    const g = overallGrowth(s, TODAY);
    expect(g.summary.totalNet).toBe(3);
    expect(g.combined[g.combined.length - 1]!.delta).toBe(3);
  });
  it("excludes archived habits and includes them again on reactivation", () => {
    let s = withHabits(2);
    const [a, b] = s.habits.map((h) => h.id) as [string, string];
    s = setCheckIn(s, a, TODAY, "good", TODAY, deps);
    s = setCheckIn(s, b, TODAY, "good", TODAY, deps);
    expect(overallGrowth(s, TODAY).summary.totalNet).toBe(2);
    s = setHabitActive(s, b, false);
    expect(overallGrowth(s, TODAY).summary.totalNet).toBe(1);
    s = setHabitActive(s, b, true);
    expect(overallGrowth(s, TODAY).summary.totalNet).toBe(2);
  });
  it("is empty with no active habits", () => {
    const g = overallGrowth(EMPTY_STATE, TODAY);
    expect(g.combined).toEqual([]);
    expect(g.summary.totalNet).toBe(0);
  });
  it("counts days up, down and level", () => {
    let s = withHabits(1);
    const id = s.habits[0]!.id;
    s = setCheckIn(s, id, "2025-03-08", "good", TODAY, deps);
    s = setCheckIn(s, id, "2025-03-09", "slip", TODAY, deps);
    const { summary } = overallGrowth(s, TODAY);
    expect(summary.daysUp).toBe(1);
    expect(summary.daysDown).toBe(1);
    expect(summary.daysLevel).toBe(28);
    expect(summary.totalNet).toBe(0);
  });
});

describe("isValidDateKey", () => {
  it("accepts real dates and rejects impossible or malformed ones", () => {
    expect(isValidDateKey("2024-02-29")).toBe(true);
    expect(isValidDateKey("2025-02-29")).toBe(false);
    expect(isValidDateKey("2025-13-01")).toBe(false);
    expect(isValidDateKey("2025-1-1")).toBe(false);
    expect(isValidDateKey(20250101)).toBe(false);
  });
});
