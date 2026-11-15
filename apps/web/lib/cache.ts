const DB_NAME = "ninacal-cache";
const STORE = "json";
const DB_VERSION = 1;
const DEFAULT_TTL = 12 * 60 * 60 * 1000;

type Entry<T> = { value: T; expires: number };

let database: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (database) return database;
  database = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return database;
}

async function read<T>(key: string): Promise<Entry<T> | null> {
  const db = await openDatabase();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(key);
    request.onsuccess = () => resolve((request.result as Entry<T> | undefined) ?? null);
    request.onerror = () => resolve(null);
  });
}

async function write<T>(key: string, entry: Entry<T>): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

/** Cached JSON fetch for deterministic GETs. Falls back to the network. */
export async function cachedJson<T>(
  url: string,
  options: { signal?: AbortSignal; ttl?: number } = {},
): Promise<T> {
  const now = Date.now();
  const cached = await read<T>(url);
  if (cached && cached.expires > now) return cached.value;

  const response = await fetch(url, {
    signal: options.signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const value = (await response.json()) as T;
  void write(url, { value, expires: now + (options.ttl ?? DEFAULT_TTL) });
  return value;
}

export async function clearJsonCache(): Promise<void> {
  const db = await openDatabase();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
