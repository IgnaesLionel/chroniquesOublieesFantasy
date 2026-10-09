// Pattern Repository : l'UI ne parle qu'à StorageAdapter.
// Aujourd'hui localStorage, demain SQLite/Postgres sans changer l'UI.

export interface StorageAdapter {
  load<T>(key: string): T | null;
  save<T>(key: string, value: T): void;
}

export const localStorageAdapter: StorageAdapter = {
  load<T>(key: string): T | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  save(key, value) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  },
};

export function exportJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
