import { describe, expect, it } from "vitest";
import { EMPTY_STATE, createHabit, setCheckIn, type Deps, type RootedState } from "../domain/state";
import {
  createPersistence, deleteAllData, KEYS, loadState, saveState, startFresh, type KeyValueStore,
} from "./persistence";

class MemoryStore implements KeyValueStore {
  data = new Map<string, string>();
  failSet: ((key: string) => boolean) | null = null;
  dropWrites: ((key: string) => boolean) | null = null; // reports success but stores nothing
  failGet = false;
  async getItem(k: string) {
    if (this.failGet) throw new Error("read failed");
    return this.data.get(k) ?? null;
  }
  async setItem(k: string, v: string) {
    if (this.failSet?.(k)) throw new Error("disk full");
    if (this.dropWrites?.(k)) return;
    this.data.set(k, v);
  }
  async removeItem(k: string) {
    this.data.delete(k);
  }
  async getAllKeys() {
    return [...this.data.keys()];
  }
}

const deps: Deps = { now: () => new Date("2025-03-10T12:00:00Z"), newId: () => "h1" };
const NOW = () => new Date("2025-03-10T12:00:00Z");
const sample = (): RootedState => {
  let s = createHabit(EMPTY_STATE, { name: "Run" }, deps);
  s = setCheckIn(s, "h1", "2025-03-10", "good", "2025-03-10", deps);
  return s;
};
const V1 = JSON.stringify({
  version: 1,
  onboardingComplete: true,
  habits: [{ id: "h1", name: "Daily exercise", description: "", goodDayDefinition: "g", slipDefinition: "s", rating: 2, createdAt: "2025-01-01T00:00:00.000Z" }],
  checkIns: [{ id: "c1", habitId: "h1", date: "2025-03-01", outcome: "skip", delta: 0, ratingAfter: 1, createdAt: "2025-03-01T08:00:00.000Z" }],
});

describe("loadState", () => {
  it("returns empty on a fresh install and writes nothing", async () => {
    const store = new MemoryStore();
    const r = await loadState(store, { now: NOW });
    expect(r.status).toBe("empty");
    expect(store.data.size).toBe(0);
  });

  it("round-trips saved state", async () => {
    const store = new MemoryStore();
    await saveState(store, sample());
    const r = await loadState(store);
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.state).toEqual(sample());
  });

  it("migrates v1: backs up raw payload, writes verified v2, keeps v1", async () => {
    const store = new MemoryStore();
    store.data.set(KEYS.v1, V1);
    const r = await loadState(store, { now: NOW });
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.migration?.skipsConvertedToMissed).toBe(1);
    expect(store.data.get(KEYS.v1Backup)).toBe(V1);
    expect(store.data.get(KEYS.v1)).toBe(V1);
    expect(JSON.parse(store.data.get(KEYS.v2)!).schemaVersion).toBe(2);
    // second launch reads v2 and does not migrate again
    const again = await loadState(store);
    expect(again.status === "ok" && again.migration).toBeFalsy();
  });

  it("does not re-migrate over existing v2 data", async () => {
    const store = new MemoryStore();
    await saveState(store, sample());
    store.data.set(KEYS.v1, V1);
    const r = await loadState(store);
    expect(r.status === "ok" && r.state.habits[0]!.name).toBe("Run");
  });

  it("corrupt v2: reports corrupt, keeps and backs up the raw data, never writes empty", async () => {
    const store = new MemoryStore();
    store.data.set(KEYS.v2, "{not json");
    const r = await loadState(store, { now: NOW });
    expect(r.status).toBe("corrupt");
    if (r.status !== "corrupt") return;
    expect(store.data.get(KEYS.v2)).toBe("{not json");
    expect(store.data.get(r.backupKey!)).toBe("{not json");
  });

  it("structurally invalid v2 is corrupt, not silently emptied", async () => {
    const store = new MemoryStore();
    const bad = JSON.stringify({ schemaVersion: 2, habits: [{ id: "x" }], checkIns: [], settings: {} });
    store.data.set(KEYS.v2, bad);
    const r = await loadState(store, { now: NOW });
    expect(r.status).toBe("corrupt");
    expect(store.data.get(KEYS.v2)).toBe(bad);
  });

  it("newer schema is unsupported and untouched", async () => {
    const store = new MemoryStore();
    const future = JSON.stringify({ schemaVersion: 3, habits: [], checkIns: [] });
    store.data.set(KEYS.v2, future);
    const r = await loadState(store);
    expect(r.status).toBe("unsupported");
    expect(store.data.get(KEYS.v2)).toBe(future);
  });

  it("corrupt v1 is reported and left in place; no v2 is written", async () => {
    const store = new MemoryStore();
    store.data.set(KEYS.v1, "garbage");
    const r = await loadState(store, { now: NOW });
    expect(r.status).toBe("corrupt");
    expect(store.data.get(KEYS.v1)).toBe("garbage");
    expect(store.data.has(KEYS.v2)).toBe(false);
  });

  it("aborts migration if the backup write fails: v1 intact, no v2", async () => {
    const store = new MemoryStore();
    store.data.set(KEYS.v1, V1);
    store.failSet = (k) => k === KEYS.v1Backup;
    const r = await loadState(store);
    expect(r.status).toBe("error");
    expect(store.data.get(KEYS.v1)).toBe(V1);
    expect(store.data.has(KEYS.v2)).toBe(false);
  });

  it("aborts migration if the v2 write cannot be verified; leaves no v2 and keeps v1", async () => {
    const store = new MemoryStore();
    store.data.set(KEYS.v1, V1);
    store.dropWrites = (k) => k === KEYS.v2;
    const r = await loadState(store);
    expect(r.status).toBe("error");
    expect(store.data.has(KEYS.v2)).toBe(false);
    expect(store.data.get(KEYS.v1)).toBe(V1);
  });

  it("surfaces read failures as error, not empty", async () => {
    const store = new MemoryStore();
    store.failGet = true;
    expect((await loadState(store)).status).toBe("error");
  });
});

describe("saveState", () => {
  it("throws when the write fails", async () => {
    const store = new MemoryStore();
    store.failSet = () => true;
    await expect(saveState(store, sample())).rejects.toThrow();
  });
  it("throws when the write cannot be verified (silent drop)", async () => {
    const store = new MemoryStore();
    store.dropWrites = () => true;
    await expect(saveState(store, sample())).rejects.toThrow(/verified/);
  });
  it("refuses to save structurally invalid state", async () => {
    const store = new MemoryStore();
    const bad = { ...sample(), checkIns: [{ habitId: "ghost", date: "2025-03-10", outcome: "good", updatedAt: "2025-03-10T00:00:00Z" }] } as RootedState;
    await expect(saveState(store, bad)).rejects.toThrow(/invalid/);
    expect(store.data.size).toBe(0);
  });
});

describe("startFresh", () => {
  it("writes an empty v2 only after the corrupt data is backed up", async () => {
    const store = new MemoryStore();
    store.data.set(KEYS.v2, "oops");
    const r = await loadState(store, { now: NOW });
    if (r.status !== "corrupt") throw new Error("expected corrupt");
    const s = await startFresh(store, r);
    expect(s).toEqual(EMPTY_STATE);
    expect(store.data.get(r.backupKey!)).toBe("oops");
  });
  it("refuses when the backup failed", async () => {
    const store = new MemoryStore();
    store.data.set(KEYS.v2, "oops");
    store.failSet = (k) => k.startsWith(KEYS.corruptPrefix);
    const r = await loadState(store, { now: NOW });
    if (r.status !== "corrupt") throw new Error("expected corrupt");
    expect(r.backupKey).toBeNull();
    await expect(startFresh(store, r)).rejects.toThrow();
    expect(store.data.get(KEYS.v2)).toBe("oops");
  });
});

describe("createPersistence", () => {
  it("applies saves in call order and a failed save does not block later ones", async () => {
    const store = new MemoryStore();
    const p = createPersistence(store);
    let calls = 0;
    store.failSet = () => ++calls === 1;
    const a = p.save(sample());
    const b = p.save(EMPTY_STATE);
    await expect(a).rejects.toThrow();
    await expect(b).resolves.toBeUndefined();
    expect(JSON.parse(store.data.get(KEYS.v2)!).habits).toEqual([]);
  });
});

describe("deleteAllData", () => {
  it("removes state, legacy, migration and corrupt backups, but nothing outside @rooted/", async () => {
    const store = new MemoryStore();
    store.data.set(KEYS.v2, "a");
    store.data.set(KEYS.v1, "b");
    store.data.set(KEYS.v1Backup, "c");
    store.data.set(`${KEYS.corruptPrefix}123`, "d");
    store.data.set("other-app-key", "keep");
    await deleteAllData(store);
    expect([...store.data.keys()]).toEqual(["other-app-key"]);
  });
});
