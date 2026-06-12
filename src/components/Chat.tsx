import { useEffect, useMemo, useRef, useState } from "react";
import { streamChatCompletion, usageCostTON, type StreamUpdate } from "../api";
import { renderMarkdown } from "../markdown";
import type { AppState, ChatDoc, ChatMessage, ModelInfo } from "../types";
import { FundingCard } from "./Funding";
import { ErrorNote, Pill, Spinner } from "./ui";
import logo from "../assets/egg.png";

type Props = {
  state: AppState | null;
  /** Proxy session is ready for inference. */
  ready: boolean;
  /** Engine is up but no proxy session is ready yet. */
  connecting: boolean;
  chat: ChatDoc | null;
  models: ModelInfo[];
  onCreateChat: (title: string, model: string) => Promise<ChatDoc>;
  onChange: (doc: ChatDoc) => void;
};

export function ChatView(props: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<StreamUpdate | null>(null);
  const [model, setModel] = useState<string>("default");
  const liveRef = useRef<StreamUpdate | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const messages = props.chat?.messages ?? [];
  const wallet = props.state?.wallet;
  const funded = wallet?.funded === true;

  // Pick the chat's model, else the first advertised one.
  useEffect(() => {
    if (props.chat?.model) {
      setModel(props.chat.model);
    } else if (props.models.length > 0 && model === "default") {
      setModel(props.models[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.chat?.id, props.models.length]);

  // Stick to the bottom while new content arrives.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom || live) el.scrollTo({ top: el.scrollHeight });
  }, [messages.length, live]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [props.chat?.id]);

  const [sendError, setSendError] = useState<string | null>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !props.ready) return;
    setInput("");
    setSendError(null);
    if (inputRef.current) inputRef.current.style.height = "auto";

    let doc = props.chat;
    try {
      if (!doc) {
        doc = await props.onCreateChat(text.length > 48 ? text.slice(0, 48) + "…" : text, model);
      }
    } catch (e) {
      setSendError(String(e instanceof Error ? e.message : e));
      setInput(text);
      return;
    }

    const userMsg: ChatMessage = { role: "user", content: text, ts: Date.now() };
    doc = { ...doc, model, messages: [...doc.messages, userMsg] };
    props.onChange(doc);

    setBusy(true);
    const empty: StreamUpdate = { visible: "", thinking: [], thinkingLive: false };
    liveRef.current = empty;
    setLive(empty);
    const controller = new AbortController();
    abortRef.current = controller;

    const history = doc.messages.map((m) => ({ role: m.role, content: m.content }));
    let assistant: ChatMessage;
    try {
      const res = await streamChatCompletion(
        model,
        history,
        (u) => {
          liveRef.current = u;
          setLive(u);
        },
        controller.signal,
      );
      assistant = {
        role: "assistant",
        content: res.visible,
        thinking: res.thinking.length ? res.thinking : undefined,
        ts: Date.now(),
        model,
        usage: res.usage,
      };
    } catch (e) {
      const partial = liveRef.current;
      const stopped = controller.signal.aborted;
      assistant = {
        role: "assistant",
        content: partial?.visible ?? "",
        thinking: partial?.thinking.length ? partial.thinking : undefined,
        ts: Date.now(),
        model,
        error: stopped ? "Генерация остановлена" : String(e instanceof Error ? e.message : e),
      };
    } finally {
      setBusy(false);
      setLive(null);
      liveRef.current = null;
      abortRef.current = null;
    }
    props.onChange({ ...doc, messages: [...doc.messages, assistant] });
  };

  const stop = () => abortRef.current?.abort();

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const setupGate = useMemo(() => {
    if (!props.state) return null;
    if (props.state.wallet_error) return <ErrorNote>{props.state.wallet_error}</ErrorNote>;
    if (wallet && !funded) return <FundingCard wallet={wallet} />;
    if (props.state.engine.error) {
      return <ErrorNote>Ядро не запустилось: {props.state.engine.error}</ErrorNote>;
    }
    if (!props.ready) {
      return (
        <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3 text-[13px] text-fg-muted">
          <Spinner className="h-4 w-4 text-gold-400" />
          {props.connecting
            ? "Подключаемся к сети Cocoon: проверяем аттестацию прокси и платёжный канал…"
            : "Запускаем локальное ядро…"}
        </div>
      );
    }
    return null;
  }, [props.state, props.ready, props.connecting, wallet, funded]);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-ink-800 px-4">
        <div className="min-w-0 flex-1 truncate text-sm font-medium">
          {props.chat?.title ?? "Новый чат"}
        </div>
        <ModelPicker models={props.models} value={model} onChange={setModel} disabled={busy} />
        {props.ready ? (
          <Pill tone="ok">в сети</Pill>
        ) : props.connecting ? (
          <Pill tone="warn" pulse>подключение</Pill>
        ) : (
          <Pill tone="muted">офлайн</Pill>
        )}
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-6">
          {messages.length === 0 && !live && (
            <div className="fade-in mt-16 flex flex-col items-center text-center">
              <img src={logo} alt="" className="h-16 w-16 opacity-90" draggable={false} />
              <h2 className="mt-4 text-lg font-semibold">Чем помочь?</h2>
              <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-fg-muted">
                Запросы выполняются в TEE-анклавах сети Cocoon и оплачиваются
                с вашего кошелька за фактические токены.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <Message key={i} msg={m} />
          ))}

          {live && (
            <div className="fade-in">
              <RoleLabel role="assistant" />
              {live.thinking.length > 0 && (
                <ThinkingBlocks blocks={live.thinking} live={live.thinkingLive} />
              )}
              {live.visible ? (
                <div className="md selectable caret" dangerouslySetInnerHTML={{ __html: renderMarkdown(live.visible) }} />
              ) : (
                <div className="flex items-center gap-2 text-[13px] text-fg-muted">
                  <Spinner className="h-3.5 w-3.5 text-gold-400" />
                  {live.thinkingLive ? "Модель размышляет…" : "Ждём ответ сети…"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Setup gate / composer */}
      <div className="shrink-0 px-5 pb-5">
        <div className="mx-auto max-w-3xl">
          {sendError && (
            <div className="mb-2">
              <ErrorNote>{sendError}</ErrorNote>
            </div>
          )}
          {setupGate ?? (
            <div className="rounded-2xl border border-ink-600 bg-ink-850 p-2 shadow-[0_8px_30px_rgba(0,0,0,0.35)] focus-within:border-gold-500/50">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  placeholder="Спросите что-нибудь…  (Enter — отправить, Shift+Enter — новая строка)"
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px";
                  }}
                  onKeyDown={onKeyDown}
                  className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-fg-faint"
                />
                {busy ? (
                  <button
                    type="button"
                    onClick={stop}
                    title="Остановить генерацию"
                    className="mb-1 mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink-700 text-fg transition-colors hover:bg-ink-600"
                  >
                    <span className="block h-3 w-3 rounded-[2px] bg-fg" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!input.trim()}
                    title="Отправить"
                    className="mb-1 mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold-500 text-ink-950 transition-colors hover:bg-gold-400 disabled:opacity-35"
                  >
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M12 19V6M6 11l6-6 6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoleLabel(props: { role: "user" | "assistant" }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span
        className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${
          props.role === "user" ? "text-ton-400" : "text-gold-400"
        }`}
      >
        {props.role === "user" ? "Вы" : "Cocoon"}
      </span>
    </div>
  );
}

function Message(props: { msg: ChatMessage }) {
  const m = props.msg;
  const cost = usageCostTON(m.usage);
  return (
    <div className="fade-in">
      <RoleLabel role={m.role} />
      {m.thinking && m.thinking.length > 0 && <ThinkingBlocks blocks={m.thinking} />}
      {m.role === "user" ? (
        <div className="selectable whitespace-pre-wrap rounded-xl border border-ink-700 bg-ink-800/70 px-4 py-3 text-sm leading-relaxed">
          {m.content}
        </div>
      ) : (
        <div className="md selectable" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
      )}
      {m.error && (
        <div className="mt-2 text-[12.5px] text-err selectable">⚠ {m.error}</div>
      )}
      {m.role === "assistant" && (m.usage?.total_tokens || cost) && (
        <div className="mt-1.5 flex gap-3 text-[11.5px] text-fg-faint">
          {m.model && <span>{m.model.split("/").pop()}</span>}
          {m.usage?.total_tokens ? <span>{m.usage.total_tokens} токенов</span> : null}
          {cost && <span className="text-gold-400/80">{cost} TON</span>}
        </div>
      )}
    </div>
  );
}

function ThinkingBlocks(props: { blocks: string[]; live?: boolean }) {
  return (
    <details className="group mb-2 rounded-lg border border-ink-700 bg-ink-900/60">
      <summary className="cursor-pointer select-none px-3 py-1.5 text-[12px] text-fg-faint transition-colors hover:text-fg-muted">
        {props.live ? "Размышляет…" : "Размышления модели"}
      </summary>
      <div className="space-y-2 border-t border-ink-800 px-3 py-2">
        {props.blocks.map((b, i) => (
          <p key={i} className="selectable whitespace-pre-wrap text-[12.5px] leading-relaxed text-fg-muted">
            {b}
          </p>
        ))}
      </div>
    </details>
  );
}

function ModelPicker(props: {
  models: ModelInfo[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  if (props.models.length === 0) return null;
  return (
    <select
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      disabled={props.disabled}
      className="max-w-[220px] cursor-pointer truncate rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-1.5 text-xs text-fg-muted outline-none transition-colors hover:text-fg focus:border-gold-500/60"
    >
      {props.models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.id.split("/").pop()} · {m.workers.length} GPU
        </option>
      ))}
    </select>
  );
}
