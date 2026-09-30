import type { FormEvent } from "react";
import type { ThemeChoice } from "../model/settings";

type SettingsDialogProps = {
  open: boolean;
  apiBase: string;
  theme: ThemeChoice;
  urlError: string;
  onClose: () => void;
  onConfirmUrl: (value: string) => void;
  onTheme: (theme: ThemeChoice) => void;
};

export function SettingsDialog({
  open,
  apiBase,
  theme,
  urlError,
  onClose,
  onConfirmUrl,
  onTheme,
}: SettingsDialogProps) {
  if (!open) {
    return null;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onConfirmUrl(String(data.get("apiBase") ?? ""));
  }

  return (
    <form className="settings" onSubmit={onSubmit}>
      <h2>Configurações</h2>
      <label htmlFor="api-url">URL da API</label>
      <input
        id="api-url"
        name="apiBase"
        defaultValue={apiBase}
        aria-describedby={urlError.length > 0 ? "api-url-error" : undefined}
      />
      {urlError.length > 0 && <p id="api-url-error" className="field-error">{urlError}</p>}
      <fieldset className="themes">
        <legend>Tema</legend>
        <label>
          <input
            type="radio"
            name="theme"
            value="light"
            checked={theme === "light"}
            onChange={() => onTheme("light")}
          />
          Claro
        </label>
        <label>
          <input
            type="radio"
            name="theme"
            value="dark"
            checked={theme === "dark"}
            onChange={() => onTheme("dark")}
          />
          Escuro
        </label>
        <label>
          <input
            type="radio"
            name="theme"
            value="system"
            checked={theme === "system"}
            onChange={() => onTheme("system")}
          />
          Sistema
        </label>
      </fieldset>
      <div className="actions">
        <button type="submit">Confirmar</button>
        <button type="button" className="secondary" onClick={onClose}>Fechar</button>
      </div>
    </form>
  );
}
