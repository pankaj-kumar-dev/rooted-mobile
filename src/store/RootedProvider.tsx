import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { AppState } from "react-native";
import { persistence } from "../data/asyncStore";
import type { LoadResult } from "../data/persistence";
import { todayLocal } from "../domain/dates";
import type { MigrationReport } from "../domain/migrate";
import { HABIT_PRESETS, presetByKey } from "../domain/presets";
import { overallGrowth, ratingOf, type OverallGrowthView } from "../domain/selectors";
import {
  createHabit, DomainError, EMPTY_STATE, setCheckIn, setHabitActive, updateHabit,
  type HabitInput, type HabitPatch, type RootedState,
} from "../domain/state";
import type { CheckInOutcome } from "../domain/types";

export type RecoveryResult = Exclude<LoadResult, { status: "ok" } | { status: "empty" }>;
export type Boot = { kind: "loading" } | { kind: "ready" } | { kind: "recovery"; result: RecoveryResult };

export interface Notice {
  id: number;
  text: string;
  tone: "info" | "error";
}

export interface RootedApi {
  boot: Boot;
  state: RootedState;
  /** The user's local calendar date. Refreshes when the app resumes or the day rolls over. */
  today: string;
  growth: OverallGrowthView;
  ratingFor(habitId: string): number;

  /** A save failed. The change is kept on screen but NOT on disk until a retry succeeds. */
  saveError: string | null;
  retrySave(): void;

  notice: Notice | null;
  dismissNotice(): void;
  migrationSummary: string | null;
  dismissMigrationSummary(): void;

  addHabit(input: HabitInput): boolean;
  addPreset(key: string): boolean;
  editHabit(habitId: string, patch: HabitPatch): boolean;
  setActive(habitId: string, active: boolean): boolean;
  setOutcome(habitId: string, date: string, outcome: CheckInOutcome | null): boolean;

  deleteAllData(): Promise<boolean>;
  retryLoad(): void;
  startFresh(): Promise<void>;
}

const Ctx = createContext<RootedApi | null>(null);

export function useRooted(): RootedApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useRooted must be used inside <RootedProvider>.");
  return v;
}

function useLocalToday(): string {
  const [today, setToday] = useState(() => todayLocal());
  useEffect(() => {
    const sync = () => setToday((prev) => {
      const next = todayLocal();
      return next === prev ? prev : next;
    });
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") sync();
    });
    const timer = setInterval(sync, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);
  return today;
}

function describeMigration(r: MigrationReport): string {
  const bits = [`Your earlier data was upgraded (${r.habits} habits, ${r.checkIns} check-ins).`];
  bits.push("Ratings now follow the ROOTED rules: they start at 0 and can go below it, so some numbers may differ from before.");
  if (r.skipsConvertedToMissed) bits.push(`${r.skipsConvertedToMissed} skipped days are now shown as missed check-ins.`);
  if (r.checkInsDropped) bits.push(`${r.checkInsDropped} unreadable check-ins could not be kept.`);
  if (r.duplicatesCollapsed) bits.push(`${r.duplicatesCollapsed} duplicate days were merged.`);
  if (r.habitsDeactivatedForCap) bits.push(`${r.habitsDeactivatedForCap} habits were archived to stay within five.`);
  bits.push("A backup of the original data was kept on this device.");
  return bits.join(" ");
}

export function RootedProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Boot>({ kind: "loading" });
  const [state, setStateRaw] = useState<RootedState>(EMPTY_STATE);
  const stateRef = useRef<RootedState>(EMPTY_STATE);
  const readyRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [migrationSummary, setMigrationSummary] = useState<string | null>(null);
  const noticeId = useRef(0);
  const today = useLocalToday();

  const setState = useCallback((next: RootedState) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);

  const say = useCallback((text: string, tone: Notice["tone"] = "info") => {
    noticeId.current += 1;
    setNotice({ id: noticeId.current, text, tone });
  }, []);

  const load = useCallback(async () => {
    setBoot({ kind: "loading" });
    const result = await persistence.load();
    if (result.status === "ok" || result.status === "empty") {
      setState(result.state);
      readyRef.current = true;
      if (result.status === "ok" && result.migration) setMigrationSummary(describeMigration(result.migration));
      setBoot({ kind: "ready" });
    } else {
      readyRef.current = false;
      setBoot({ kind: "recovery", result });
    }
  }, [setState]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Persist the latest snapshot. Because every save is a full snapshot, a later success also covers earlier failures. */
  const persist = useCallback((snapshot: RootedState) => {
    persistence.save(snapshot).then(
      // Saves run strictly in order, so the last outcome to arrive belongs to the newest snapshot.
      () => setSaveError(null),
      (e: unknown) => setSaveError(e instanceof Error ? e.message : "Your latest change could not be saved on this device."),
    );
  }, []);

  const retrySave = useCallback(() => persist(stateRef.current), [persist]);

  /** Applies a pure state change. Domain errors become a notice and leave state untouched. */
  const mutate = useCallback(
    (fn: (s: RootedState) => RootedState): boolean => {
      if (!readyRef.current) return false;
      const prev = stateRef.current;
      let next: RootedState;
      try {
        next = fn(prev);
      } catch (e) {
        say(e instanceof DomainError ? e.message : "Something went wrong. Nothing was changed.", "error");
        return false;
      }
      if (next === prev) return true;
      setState(next);
      persist(next);
      return true;
    },
    [persist, say, setState],
  );

  const addHabit = useCallback((input: HabitInput) => mutate((s) => createHabit(s, input)), [mutate]);

  const addPreset = useCallback(
    (key: string) => {
      const p = presetByKey(key);
      if (!p) return false;
      return mutate((s) =>
        createHabit(s, {
          name: p.name, icon: p.icon, description: p.description, goodDay: p.goodDay, slipDay: p.slipDay, presetKey: p.key,
        }),
      );
    },
    [mutate],
  );

  const editHabit = useCallback((id: string, patch: HabitPatch) => mutate((s) => updateHabit(s, id, patch)), [mutate]);
  const setActive = useCallback((id: string, active: boolean) => mutate((s) => setHabitActive(s, id, active)), [mutate]);
  const setOutcome = useCallback(
    (habitId: string, date: string, outcome: CheckInOutcome | null) =>
      mutate((s) => setCheckIn(s, habitId, date, outcome, todayLocal())),
    [mutate],
  );

  const deleteAllData = useCallback(async () => {
    try {
      await persistence.deleteAll();
    } catch {
      say("Could not delete the data on this device. Nothing was changed.", "error");
      return false;
    }
    setState(EMPTY_STATE);
    setSaveError(null);
    setMigrationSummary(null);
    say("All ROOTED data on this device was deleted.");
    return true;
  }, [say, setState]);

  const startFresh = useCallback(async () => {
    if (boot.kind !== "recovery" || boot.result.status !== "corrupt") return;
    try {
      const fresh = await persistence.startFresh(boot.result);
      setState(fresh);
      readyRef.current = true;
      setBoot({ kind: "ready" });
      say("Started fresh. Your unreadable data is still backed up on this device.");
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not start fresh.", "error");
    }
  }, [boot, say, setState]);

  const growth = useMemo(() => overallGrowth(state, today), [state, today]);
  const ratingFor = useCallback(
    (id: string) => {
      const pts = growth.pointsById[id];
      return pts && pts.length ? pts[pts.length - 1]!.rating : ratingOf(state, id, today);
    },
    [growth, state, today],
  );

  const value = useMemo<RootedApi>(
    () => ({
      boot, state, today, growth, ratingFor, saveError, retrySave,
      notice, dismissNotice: () => setNotice(null),
      migrationSummary, dismissMigrationSummary: () => setMigrationSummary(null),
      addHabit, addPreset, editHabit, setActive, setOutcome,
      deleteAllData, retryLoad: () => void load(), startFresh,
    }),
    [boot, state, today, growth, ratingFor, saveError, retrySave, notice, migrationSummary,
      addHabit, addPreset, editHabit, setActive, setOutcome, deleteAllData, load, startFresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const SUGGESTED = HABIT_PRESETS;
