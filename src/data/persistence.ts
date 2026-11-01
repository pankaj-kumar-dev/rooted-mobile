import { migrateV1ToV2, type MigrationReport } from "../domain/migrate";
import { EMPTY_STATE, type RootedState } from "../domain/state";
import { parseStateV2 } from "../domain/validate";

/** Minimal async key-value contract. AsyncStorage satisfies it; tests use an in-memory fake. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  /** Optional. When present, "delete all data" also removes backups it does not know by name. */
  getAllKeys?(): Promise<readonly string[]>;
}

export const KEYS = {
  v2: "@rooted/state-v2",
  /** Legacy payload. Never deleted by the app: it stays as a second safety copy. */
  v1: "@rooted/state-v1",
  v1Backup: "@rooted/backup/v1-premigration",
  corruptPrefix: "@rooted/backup/corrupt-",
} as const;

export class StorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "StorageError";
  }
}

export type LoadResult =
  | { status: "ok"; state: RootedState; migration?: MigrationReport; duplicatesRemoved: number }
  | { status: "empty"; state: RootedState }
  /** Stored data exists but cannot be read. It is NOT replaced; the user decides what happens next. */
  | { status: "corrupt"; source: "v2" | "v1"; reason: string; raw: string; backupKey: string | null }
  /** Stored data was written by a newer app version. Left untouched. */
  | { status: "unsupported"; reason: string; raw: string }
  /** The storage layer itself failed (read/write/verify). Nothing was overwritten. */
  | { status: "error"; error: Error };

async function writeVerified(store: KeyValueStore, key: string, value: string): Promise<void> {
  await store.setItem(key, value);
  const back = await store.getItem(key);
  if (back !== value) throw new StorageError("Write could not be verified.");
}

function tryParse(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

/** Best-effort, verified copy of unreadable data under a unique key. Returns the key, or null if it failed. */
async function backupCorrupt(store: KeyValueStore, raw: string, now: Date): Promise<string | null> {
  const key = `${KEYS.corruptPrefix}${now.getTime()}`;
  try {
    await writeVerified(store, key, raw);
    return key;
  } catch {
    return null;
  }
}

export interface LoadOptions {
  now?: () => Date;
}

/**
 * Loads state. Order: v2 -> (v1 migration) -> empty.
 * Never overwrites unreadable data with an empty state; never deletes the v1 payload.
 */
export async function loadState(store: KeyValueStore, options: LoadOptions = {}): Promise<LoadResult> {
  const now = options.now ?? (() => new Date());
  try {
    const rawV2 = await store.getItem(KEYS.v2);
    if (rawV2 !== null) {
      const json = tryParse(rawV2);
      const parsed = json.ok ? parseStateV2(json.value) : null;
      if (parsed?.ok) return { status: "ok", state: parsed.state, duplicatesRemoved: parsed.duplicatesRemoved };
      if (parsed && !parsed.ok && parsed.newer) return { status: "unsupported", reason: parsed.reason, raw: rawV2 };
      const reason = parsed && !parsed.ok ? parsed.reason : "Stored data is not valid JSON.";
      return { status: "corrupt", source: "v2", reason, raw: rawV2, backupKey: await backupCorrupt(store, rawV2, now()) };
    }

    const rawV1 = await store.getItem(KEYS.v1);
    if (rawV1 === null) return { status: "empty", state: EMPTY_STATE };

    const json = tryParse(rawV1);
    const migrated = json.ok ? migrateV1ToV2(json.value) : null;
    if (!migrated || !migrated.ok) {
      const reason = migrated && !migrated.ok ? migrated.reason : "Legacy data is not valid JSON.";
      return { status: "corrupt", source: "v1", reason, raw: rawV1, backupKey: await backupCorrupt(store, rawV1, now()) };
    }

    // 1) verified backup of the exact v1 payload, 2) verified v2 write. Only then report success.
    await writeVerified(store, KEYS.v1Backup, rawV1);
    const serialized = JSON.stringify(migrated.state);
    try {
      await writeVerified(store, KEYS.v2, serialized);
    } catch (e) {
      await store.removeItem(KEYS.v2).catch(() => undefined); // leave no half-written v2; v1 is intact
      throw e;
    }
    return { status: "ok", state: migrated.state, migration: migrated.report, duplicatesRemoved: 0 };
  } catch (e) {
    return { status: "error", error: e instanceof Error ? e : new StorageError("Storage failed.", e) };
  }
}

/** Persists state and verifies it by reading it back. Throws StorageError on any failure. */
export async function saveState(store: KeyValueStore, state: RootedState): Promise<void> {
  const check = parseStateV2(JSON.parse(JSON.stringify(state)));
  if (!check.ok) throw new StorageError(`Refusing to save invalid state: ${check.reason}`);
  try {
    await writeVerified(store, KEYS.v2, JSON.stringify(state));
  } catch (e) {
    if (e instanceof StorageError) throw e;
    throw new StorageError("Your latest change could not be saved on this device.", e);
  }
}

/**
 * After the user explicitly chooses to start fresh from unreadable data. The unreadable payload must already
 * be safely backed up (or be the untouched v1 key); otherwise this refuses rather than destroy it.
 */
export async function startFresh(
  store: KeyValueStore,
  result: Extract<LoadResult, { status: "corrupt" }>,
): Promise<RootedState> {
  if (result.source === "v2" && result.backupKey === null) {
    throw new StorageError("Unreadable data could not be backed up, so it was not replaced.");
  }
  await saveState(store, EMPTY_STATE);
  return EMPTY_STATE;
}

/**
 * Wipes ROOTED data on this device (user-initiated): state, legacy v1, the migration backup and any corrupt-data
 * backups (found by the `@rooted/` prefix when the store can list keys).
 */
export async function deleteAllData(store: KeyValueStore, extraKeys: readonly string[] = []): Promise<void> {
  const keys = new Set<string>([KEYS.v2, KEYS.v1, KEYS.v1Backup, ...extraKeys]);
  if (store.getAllKeys) for (const k of await store.getAllKeys()) if (k.startsWith("@rooted/")) keys.add(k);
  for (const key of keys) await store.removeItem(key);
}

/**
 * Serializes writes so concurrent saves can never interleave; each save resolves/rejects on its own.
 * A failed save does not block later saves.
 */
export function createPersistence(store: KeyValueStore) {
  let chain: Promise<unknown> = Promise.resolve();
  return {
    store,
    load: (options?: LoadOptions) => loadState(store, options),
    deleteAll: () => deleteAllData(store),
    startFresh: (result: Extract<LoadResult, { status: "corrupt" }>) => startFresh(store, result),
    save(state: RootedState): Promise<void> {
      const run = chain.then(() => saveState(store, state));
      chain = run.catch(() => undefined);
      return run;
    },
  };
}
