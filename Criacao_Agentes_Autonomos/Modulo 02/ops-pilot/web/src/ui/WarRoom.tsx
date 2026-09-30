import { useEffect, useRef, useState, type FormEvent } from "react";
import { postChat, type ChatBody } from "../api/chat";
import { joinChatUrl } from "../api/chat";
import {
  applyOutcome,
  decide,
  enqueueMessage,
  initialThread,
  retry,
  toggleTrace,
  type ThreadState,
} from "../model/thread";
import {
  applyTheme,
  readSettings,
  writeApiBase,
  writeTheme,
  type ThemeChoice,
} from "../model/settings";
import { DecisionCard } from "./DecisionCard";
import { SettingsDialog } from "./SettingsDialog";
import { TracePanel } from "./TracePanel";
import { AnswerBody } from "./AnswerBody";

export function WarRoom() {
  const [settings, setSettings] = useState(() => readSettings(localStorage));
  const [thread, setThread] = useState<ThreadState>(initialThread);
  const [draft, setDraft] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [urlError, setUrlError] = useState("");
  const busy = useRef(false);
  const messageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  function start(next: ThreadState) {
    if (busy.current || !next.pendingBody) {
      return;
    }
    const body: ChatBody = next.pendingBody;
    busy.current = true;
    setThread(next);
    void postChat(joinChatUrl(settings.apiBase), body)
      .then((outcome) => {
        setThread((current) => applyOutcome(current, outcome));
      })
      .finally(() => {
        busy.current = false;
      });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setFieldError("A mensagem não pode ficar vazia.");
      messageRef.current?.focus();
      return;
    }
    if (busy.current) {
      return;
    }
    const next = enqueueMessage(thread, draft);
    if (!next.pendingBody) {
      return;
    }
    setFieldError("");
    setDraft("");
    start(next);
  }

  function onDecide(index: number, decision: "approve" | "deny") {
    if (busy.current) {
      return;
    }
    start(decide(thread, index, decision));
  }

  function onRetry() {
    if (busy.current) {
      return;
    }
    start(retry(thread));
  }

  function onConfirmUrl(value: string) {
    const saved = writeApiBase(localStorage, value);
    if (!saved.ok) {
      setUrlError("Informe uma URL absoluta http ou https.");
      return;
    }
    setUrlError("");
    setSettings((current) => ({ ...current, apiBase: saved.apiBase }));
    setSettingsOpen(false);
  }

  function onTheme(theme: ThemeChoice) {
    writeTheme(localStorage, theme);
    setSettings((current) => ({ ...current, theme }));
  }

  return (
    <div className="room">
      <header className="top">
        <h1>War room</h1>
        <button
          type="button"
          className="gear"
          aria-label="Configurar URL da API"
          onClick={() => setSettingsOpen(true)}
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </header>
      <SettingsDialog
        open={settingsOpen}
        apiBase={settings.apiBase}
        theme={settings.theme}
        urlError={urlError}
        onClose={() => setSettingsOpen(false)}
        onConfirmUrl={onConfirmUrl}
        onTheme={onTheme}
      />
      <main>
        {thread.turns.length === 0 && (
          <section className="empty">
            <h2>Nenhuma mensagem ainda</h2>
            <p>O plantão começa quando você envia a primeira mensagem.</p>
          </section>
        )}
        <ol className="turns">
          {thread.turns.map((turn, index) => (
            <li key={index}>
              {turn.kind === "user" && <p className="bubble">{turn.text}</p>}
              {turn.kind === "answer" && (
                <article className="bubble">
                  <AnswerBody answer={turn.answer} />
                  {turn.requestId.length > 0 && <p className="meta">{turn.requestId}</p>}
                  <TracePanel
                    trace={turn.trace}
                    open={turn.traceOpen}
                    onToggle={() => setThread((current) => toggleTrace(current, index))}
                  />
                </article>
              )}
              {turn.kind === "card" && (
                <DecisionCard
                  summary={turn.summary}
                  requestId={turn.requestId}
                  trace={turn.trace}
                  open={turn.traceOpen}
                  choice={turn.choice}
                  onToggle={() => setThread((current) => toggleTrace(current, index))}
                  onDecide={(decision) => onDecide(index, decision)}
                />
              )}
              {turn.kind === "error" && (
                <div className="error" role="alert">
                  <p>{turn.detail}</p>
                  <button type="button" onClick={onRetry}>Tentar de novo</button>
                </div>
              )}
            </li>
          ))}
        </ol>
        <p className="status" aria-live="polite">{thread.inFlight ? "Enviando…" : ""}</p>
      </main>
      <form className="composer" onSubmit={onSubmit}>
        <label htmlFor="message">Mensagem</label>
        <input
          id="message"
          ref={messageRef}
          value={draft}
          aria-describedby={fieldError.length > 0 ? "message-error" : undefined}
          onChange={(event) => setDraft(event.target.value)}
        />
        {fieldError.length > 0 && <p id="message-error" className="field-error">{fieldError}</p>}
        <button type="submit">Enviar</button>
      </form>
    </div>
  );
}
