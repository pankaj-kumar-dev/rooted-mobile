import { describe, expect, it } from "vitest";
import { migrateV1ToV2 } from "./migrate";
import { ratingOf } from "./selectors";
import { parseStateV2 } from "./validate";

const habit = (over: Record<string, unknown> = {}) => ({
  id: "h1",
  name: "Daily exercise",
  description: "Move",
  goodDayDefinition: "20 min",
  slipDefinition: "None",
  rating: 3,
  createdAt: "2025-01-01T00:00:00.000Z",
  ...over,
});
const ci = (over: Record<string, unknown> = {}) => ({
  id: "c1",
  habitId: "h1",
  date: "2025-03-01",
  outcome: "good",
  delta: 1,
  ratingAfter: 2,
  createdAt: "2025-03-01T08:00:00.000Z",
  ...over,
});
const v1 = (habits: unknown[], checkIns: unknown[]) => ({ version: 1, habits, checkIns, onboardingComplete: true });

describe("migrateV1ToV2", () => {
  it("maps fields, drops stored ratings and yields a valid v2 state", () => {
    const r = migrateV1ToV2(v1([habit({ archivedAt: "2025-02-01T00:00:00.000Z" })], [ci()]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.habits[0]).toMatchObject({
      id: "h1", presetKey: "exercise", icon: "run", goodDay: "20 min", slipDay: "None", active: false,
    });
    expect(JSON.stringify(r.state)).not.toMatch(/ratingAfter|delta|"rating"/);
    expect(parseStateV2(JSON.parse(JSON.stringify(r.state))).ok).toBe(true);
  });

  it("converts skip to missed and reports it", () => {
    const r = migrateV1ToV2(v1([habit()], [ci({ outcome: "skip", delta: 0 })]));
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.checkIns[0]!.outcome).toBe("missed");
    expect(r.report.skipsConvertedToMissed).toBe(1);
  });

  it("re-derives ratings with baseline 0 and no floor (v1 floor of 1 is dropped)", () => {
    // v1 would have shown 1,1 (floored). v2 derives -1, -2.
    const r = migrateV1ToV2(v1([habit()], [
      ci({ id: "a", date: "2025-03-01", outcome: "slip", delta: -1, ratingAfter: 1 }),
      ci({ id: "b", date: "2025-03-02", outcome: "slip", delta: -1, ratingAfter: 1 }),
    ]));
    if (!r.ok) throw new Error(r.reason);
    expect(ratingOf(r.state, "h1", "2025-03-02")).toBe(-2);
  });

  it("collapses duplicates keeping the latest, and counts them", () => {
    const r = migrateV1ToV2(v1([habit()], [
      ci({ id: "a", outcome: "good", createdAt: "2025-03-01T08:00:00.000Z" }),
      ci({ id: "b", outcome: "slip", createdAt: "2025-03-01T09:00:00.000Z" }),
    ]));
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.checkIns).toHaveLength(1);
    expect(r.state.checkIns[0]!.outcome).toBe("slip");
    expect(r.report.duplicatesCollapsed).toBe(1);
  });

  it("drops and counts orphan, invalid-date and invalid-outcome check-ins", () => {
    const r = migrateV1ToV2(v1([habit()], [
      ci({ habitId: "ghost" }), ci({ date: "2025-02-30" }), ci({ outcome: "maybe" }), "junk", ci(),
    ]));
    if (!r.ok) throw new Error(r.reason);
    expect(r.report.checkInsDropped).toBe(4);
    expect(r.state.checkIns).toHaveLength(1);
  });

  it("keeps only five active habits if v1 data held more", () => {
    const six = Array.from({ length: 6 }, (_, i) =>
      habit({ id: `h${i}`, name: `Custom ${i}`, createdAt: `2025-01-0${i + 1}T00:00:00.000Z` }));
    const r = migrateV1ToV2(v1(six, []));
    if (!r.ok) throw new Error(r.reason);
    expect(r.state.habits.filter((h) => h.active)).toHaveLength(5);
    expect(r.report.habitsDeactivatedForCap).toBe(1);
    expect(r.state.habits.find((h) => h.id === "h5")!.active).toBe(false);
  });

  it("rejects malformed payloads instead of producing an empty state", () => {
    expect(migrateV1ToV2(null).ok).toBe(false);
    expect(migrateV1ToV2({ version: 2, habits: [], checkIns: [] }).ok).toBe(false);
    expect(migrateV1ToV2({ version: 1, habits: "x", checkIns: [] }).ok).toBe(false);
    expect(migrateV1ToV2(v1([{ name: "no id" }], [])).ok).toBe(false);
    expect(migrateV1ToV2(v1([habit(), habit()], [])).ok).toBe(false);
  });

  it("migrates an empty v1 state", () => {
    const r = migrateV1ToV2(v1([], []));
    expect(r.ok).toBe(true);
  });
});
