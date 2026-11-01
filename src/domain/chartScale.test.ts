import { describe, expect, it } from "vitest";
import { computeDayTicks, computeYAxis } from "./chartScale";

describe("computeYAxis", () => {
  it("contains all ratings and zero with headroom", () => {
    const a = computeYAxis([1, 2, 3, 2, 4]);
    expect(a.min).toBeLessThanOrEqual(-1);
    expect(a.max).toBeGreaterThanOrEqual(5);
    expect(a.ticks).toContain(0);
  });
  it("handles negative runs", () => {
    const a = computeYAxis([-1, -2, -5]);
    expect(a.min).toBeLessThanOrEqual(-6);
    expect(a.max).toBeGreaterThanOrEqual(1);
  });
  it("scales steps for large ranges and caps tick count", () => {
    const a = computeYAxis([0, 20, 45, 80]);
    expect(a.ticks.length).toBeLessThanOrEqual(8);
    expect(a.max).toBeGreaterThanOrEqual(81);
  });
  it("handles empty input", () => {
    const a = computeYAxis([]);
    expect(a.min).toBeLessThan(0);
    expect(a.max).toBeGreaterThan(0);
  });
});

describe("computeDayTicks", () => {
  it("labels every day when there is room", () => {
    expect(computeDayTicks(7, 600)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it("thins labels on narrow plots", () => {
    const t = computeDayTicks(30, 300);
    expect(t.length).toBeLessThanOrEqual(9);
    expect(t.every((d) => d >= 1 && d <= 30)).toBe(true);
  });
});
