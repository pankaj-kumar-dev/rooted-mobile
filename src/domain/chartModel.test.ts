import { describe, expect, it } from "vitest";
import {
  availableRanges, describeCombinedPoint, describeHabitPoint, effectiveRange, indexFromX, sliceRange, toneOf,
} from "./chartModel";
import { buildCombinedPoints, buildTimeline } from "./score";
import type { DailyCheckIn } from "./types";

const ci = (habitId: string, date: string, outcome: DailyCheckIn["outcome"]): DailyCheckIn => ({ habitId, date, outcome });

describe("toneOf", () => {
  it("classifies by delta", () => {
    expect([toneOf(2), toneOf(-1), toneOf(0)]).toEqual(["up", "down", "flat"]);
  });
});

describe("ranges", () => {
  it("offers only ranges smaller than the data, plus All", () => {
    expect(availableRanges(5)).toEqual(["all"]);
    expect(availableRanges(30)).toEqual([7, "all"]);
    expect(availableRanges(31)).toEqual([7, 30, "all"]);
    expect(availableRanges(200)).toEqual([7, 30, 90, "all"]);
  });
  it("falls back to All when the stored range is no longer offered", () => {
    expect(effectiveRange(90, 40)).toBe("all");
    expect(effectiveRange(30, 40)).toBe(30);
  });
  it("slices the last N days and keeps the true starting level", () => {
    const pts = buildTimeline("a", [ci("a", "2025-03-01", "good"), ci("a", "2025-03-02", "good"), ci("a", "2025-03-03", "slip")], "2025-03-01", "2025-03-10");
    const last3 = sliceRange(pts, 7);
    expect(last3).toHaveLength(7);
    expect(last3[0]!.previousRating).toBe(pts[3]!.previousRating);
    expect(sliceRange(pts, "all")).toHaveLength(10);
    expect(sliceRange(pts, "all")).not.toBe(pts);
  });
});

describe("indexFromX", () => {
  // left 40, width 300, 10 days: day i at 40 + (i+1)*30
  it("snaps to the nearest day", () => {
    expect(indexFromX(70, 40, 300, 10)).toBe(0);
    expect(indexFromX(71, 40, 300, 10)).toBe(0);
    expect(indexFromX(100, 40, 300, 10)).toBe(1);
    expect(indexFromX(340, 40, 300, 10)).toBe(9);
  });
  it("clamps outside the plot", () => {
    expect(indexFromX(-50, 40, 300, 10)).toBe(0);
    expect(indexFromX(9999, 40, 300, 10)).toBe(9);
  });
  it("returns null when empty", () => {
    expect(indexFromX(10, 40, 300, 0)).toBeNull();
    expect(indexFromX(10, 40, 0, 5)).toBeNull();
  });
});

describe("point text", () => {
  it("never describes a missed or unrecorded day as a slip", () => {
    const [m, u] = buildTimeline("a", [ci("a", "2025-03-01", "missed")], "2025-03-01", "2025-03-02");
    expect(describeHabitPoint(m!).head).toBe("Missed check-in");
    expect(describeHabitPoint(u!).head).toBe("No check-in recorded");
  });
  it("summarises a combined day by net and by habit", () => {
    const series = [
      buildTimeline("a", [ci("a", "2025-03-01", "good")], "2025-03-01", "2025-03-01"),
      buildTimeline("b", [ci("b", "2025-03-01", "good")], "2025-03-01", "2025-03-01"),
      buildTimeline("c", [ci("c", "2025-03-01", "slip")], "2025-03-01", "2025-03-01"),
    ];
    const [day] = buildCombinedPoints(series);
    const t = describeCombinedPoint(day!, { a: "Run", b: "Read", c: "Phone" });
    expect(t.head).toBe("Net +1");
    expect(t.body).toContain("2 good, 1 slip-up");
    expect(t.body).toContain("Phone −1");
  });
});
