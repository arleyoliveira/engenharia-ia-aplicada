export const API_BASE_KEY = "opspilot.apiBase";
export const THEME_KEY = "opspilot.theme";
export const DEFAULT_API_BASE = "http://localhost:3000";

export type ThemeChoice = "light" | "dark" | "system";

export type Settings = {
  apiBase: string;
  theme: ThemeChoice;
};

export function normalizeApiBase(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path}${url.search}`;
}

export function readApiBase(storage: Storage): string {
  const raw = storage.getItem(API_BASE_KEY);
  if (raw === null) {
    return DEFAULT_API_BASE;
  }
  return normalizeApiBase(raw) ?? DEFAULT_API_BASE;
}

export function writeApiBase(storage: Storage, value: string): { ok: boolean; apiBase: string } {
  const current = readApiBase(storage);
  const next = normalizeApiBase(value);
  if (!next) {
    return { ok: false, apiBase: current };
  }
  storage.setItem(API_BASE_KEY, next);
  return { ok: true, apiBase: next };
}

export function readTheme(storage: Storage): ThemeChoice {
  const raw = storage.getItem(THEME_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") {
    return raw;
  }
  return "system";
}

export function writeTheme(storage: Storage, value: string): ThemeChoice {
  const theme: ThemeChoice = value === "light" || value === "dark" || value === "system" ? value : "system";
  storage.setItem(THEME_KEY, theme);
  return theme;
}

export function readSettings(storage: Storage): Settings {
  return { apiBase: readApiBase(storage), theme: readTheme(storage) };
}

export function applyTheme(theme: ThemeChoice): void {
  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }
  document.documentElement.setAttribute("data-theme", theme);
}
