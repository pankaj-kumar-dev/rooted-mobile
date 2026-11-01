import { describe, expect, it } from "vitest";
import { buildCombinedPoints, buildGraphPoints, buildTimeline, currentRating, outcomeDelta, toggleHabit } from "./score";
import type { CheckInOutcome, DailyCheckIn } from "./types";

const ci = (habitId: string, date: string, outcome: CheckInOutcome): DailyCheckIn => ({
  habitId,
  date,
  outcome,
});

describe("outcomeDelta", () => {
  it("maps outcomes", () => {
    expect(outcomeDelta("good")).toBe(1);
    expect(outcomeDelta("slip")).toBe(-1);
    expect(outcomeDelta("missed")).toBe(0);
    expect(outcomeDelta("unrecorded")).toBe(0);
  });
});

describe("buildGraphPoints", () => {
  it("rises by one per good day", () => {
    const pts = buildGraphPoints("a", [
      ci("a", "2025-01-01", "good"),
      ci("a", "2025-01-02", "good"),
      ci("a", "2025-01-03", "good"),
    ]);
    expect(pts.map((p) => p.rating)).toEqual([1, 2, 3]);
  });

  it("slip lowers by one and keeps prior points", () => {
    const pts = buildGraphPoints("a", [
      ci("a", "2025-01-01", "good"),
      ci("a", "2025-01-02", "good"),
      ci("a", "2025-01-03", "slip"),
    ]);
    expect(pts.map((p) => p.rating)).toEqual([1, 2, 1]);
    expect(pts[2]).toMatchObject({ previousRating: 2, delta: -1 });
  });

  it("missed keeps score", () => {
    const pts = buildGraphPoints("a", [ci("a", "2025-01-01", "good"), ci("a", "2025-01-02", "missed")]);
    expect(pts[1]).toMatchObject({ rating: 1, previousRating: 1, delta: 0, outcome: "missed" });
  });

  it("sorts chronologically before scoring", () => {
    const pts = buildGraphPoints("a", [
      ci("a", "2025-01-03", "slip"),
      ci("a", "2025-01-01", "good"),
      ci("a", "2025-01-02", "good"),
    ]);
    expect(pts.map((p) => p.date)).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);
    expect(pts.map((p) => p.rating)).toEqual([1, 2, 1]);
  });

  it("does not mutate input", () => {
    const input = [ci("a", "2025-01-02", "good"), ci("a", "2025-01-01", "slip")];
    const copy = structuredClone(input);
    buildGraphPoints("a", input);
    expect(input).toEqual(copy);
  });

  it("empty input gives empty list", () => {
    expect(buildGraphPoints("a", [])).toEqual([]);
    expect(currentRating([])).toBe(0);
  });

  it("respects baseline", () => {
    expect(buildGraphPoints("a", [ci("a", "2025-01-01", "good")], 5)[0]?.rating).toBe(6);
  });

  it("habits are independent", () => {
    const a = buildGraphPoints("a", [ci("a", "2025-01-01", "good"), ci("a", "2025-01-02", "good")]);
    const bAfter = buildGraphPoints("b", [ci("b", "2025-01-01", "good"), ci("b", "2025-01-02", "slip")]);
    expect(a.map((p) => p.rating)).toEqual([1, 2]);
    expect(bAfter.map((p) => p.rating)).toEqual([1, 0]);
  });
});

describe("buildTimeline", () => {
  it("fills unrecorded days with flat score", () => {
    const pts = buildTimeline(
      "a",
      [ci("a", "2025-01-01", "good"), ci("a", "2025-01-04", "slip")],
      "2025-01-01",
      "2025-01-04",
    );
    expect(pts.map((p) => p.outcome)).toEqual(["good", "unrecorded", "unrecorded", "slip"]);
    expect(pts.map((p) => p.rating)).toEqual([1, 1, 1, 0]);
  });

  it("crosses month boundaries", () => {
    const pts = buildTimeline("a", [], "2025-01-30", "2025-02-02");
    expect(pts.map((p) => p.date)).toEqual(["2025-01-30", "2025-01-31", "2025-02-01", "2025-02-02"]);
  });
});

describe("toggleHabit", () => {
  it("caps at five", () => {
    let sel: string[] = [];
    for (const id of ["1", "2", "3", "4", "5", "6"]) sel = toggleHabit(sel, id);
    expect(sel).toEqual(["1", "2", "3", "4", "5"]);
  });
  it("allows removal at the cap", () => {
    expect(toggleHabit(["1", "2", "3", "4", "5"], "3")).toEqual(["1", "2", "4", "5"]);
  });
});

describe("buildCombinedPoints", () => {
  const map: Record<string, CheckInOutcome> = { g: "good", s: "slip", m: "missed" };
  const mk = (id: string, pattern: string) =>
    buildTimeline(
      id,
      [...pattern].map((ch, i) => ci(id, `2025-03-0${i + 1}`, map[ch]!)),
      "2025-03-01",
      `2025-03-0${pattern.length}`,
    );

  it("sums daily deltas: +1 x4 and -1 x1 gives net +3 (example from product brief)", () => {
    const series = [mk("a", "g"), mk("b", "g"), mk("c", "g"), mk("d", "g"), mk("e", "s")];
    const [day] = buildCombinedPoints(series);
    expect(day!.delta).toBe(3);
    expect(day!.rating).toBe(3);
    expect(day!.good).toBe(4);
    expect(day!.slip).toBe(1);
  });

  it("accumulates across days and keeps missed days level", () => {
    const out = buildCombinedPoints([mk("a", "gm"), mk("b", "gg")]);
    expect(out.map((p) => p.rating)).toEqual([2, 3]);
  });

  it("does not alter individual habit points", () => {
    const a = mk("a", "gg");
    const before = JSON.stringify(a);
    buildCombinedPoints([a, mk("b", "ss")]);
    expect(JSON.stringify(a)).toBe(before);
  });

  it("returns empty for no habits", () => {
    expect(buildCombinedPoints([])).toEqual([]);
  });
});
