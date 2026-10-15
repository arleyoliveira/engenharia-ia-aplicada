import { describe, expect, it } from "vitest";
import { readSettings, writeApiBase, writeTheme } from "./settings";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
  };
}

describe("settings", () => {
  it("grava URL absoluta e tema, e rejeita o resto", () => {
    const storage = memoryStorage();
    expect(readSettings(storage)).toEqual({
      apiBase: "http://localhost:3000",
      theme: "system",
    });

    expect(writeApiBase(storage, "http://localhost:9090/")).toEqual({
      ok: true,
      apiBase: "http://localhost:9090",
    });
    expect(storage.getItem("opspilot.apiBase")).toBe("http://localhost:9090");

    for (const invalid of ["ftp://localhost", "", "localhost:3000"]) {
      expect(writeApiBase(storage, invalid)).toEqual({
        ok: false,
        apiBase: "http://localhost:9090",
      });
      expect(storage.getItem("opspilot.apiBase")).toBe("http://localhost:9090");
    }

    expect(writeTheme(storage, "light")).toBe("light");
    expect(writeTheme(storage, "dark")).toBe("dark");
    expect(writeTheme(storage, "system")).toBe("system");
    expect(writeTheme(storage, "sepia")).toBe("system");
    expect(storage.getItem("opspilot.theme")).toBe("system");
  });
});
