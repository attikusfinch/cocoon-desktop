import { useEffect, useRef, useState } from "react";
import { engineStart, engineStop, getLogs } from "../api";
import type { AppState, ModelInfo, RunnerStats } from "../types";
import { Button, Card, ErrorNote, Mono, Pill, SectionTitle } from "./ui";

type Props = {
  state: AppState | null;
  stats: RunnerStats | null;
  models: ModelInfo[];
  ready: boolean;
  connecting: boolean;
  onStateChanged: () => void;
};

export function NetworkPanel(props: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const engineRunning = props.state?.engine.running === true;

  const toggleEngine = async () => {
    setBusy(true);
    setError(null);
    try {
      if (engineRunning) {
        await engineStop();
      } else {
        await engineStart();
      }
      props.onStateChanged();
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-6">
        <h1 className="text-lg font-semibold">Сеть</h1>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <SectionTitle>Движок Cocoon</SectionTitle>
              <div className="mt-1.5 flex items-center gap-2">
                {props.ready ? (
                  <Pill tone="ok">подключён к прокси</Pill>
                ) : props.connecting ? (
                  <Pill tone="warn" pulse>ищем прокси…</Pill>
                ) : engineRunning ? (
                  <Pill tone="warn">запущен</Pill>
                ) : (
                  <Pill tone="muted">остановлен</Pill>
                )}
              </div>
            </div>
            <Button kind={engineRunning ? "ghost" : "primary"} busy={busy} onClick={() => void toggleEngine()}>
              {engineRunning ? "Остановить" : "Запустить"}
            </Button>
          </div>
          {props.state?.engine.error && (
            <div className="mt-3"><ErrorNote>{props.state.engine.error}</ErrorNote></div>
          )}
          {error && <div className="mt-3"><ErrorNote>{error}</ErrorNote></div>}
        </Card>

        <Card className="p-5">
          <SectionTitle>Прокси</SectionTitle>
          {(props.stats?.proxy_connections?.length ?? 0) === 0 ? (
            <div className="mt-2 text-[13px] text-fg-faint">Нет активных подключений.</div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {props.stats!.proxy_connections.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2">
                  <Mono className="truncate">{p.address}</Mono>
                  {p.is_ready ? <Pill tone="ok">готов</Pill> : <Pill tone="warn" pulse>хендшейк</Pill>}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>Модели в сети</SectionTitle>
          {props.models.length === 0 ? (
            <div className="mt-2 text-[13px] text-fg-faint">
              Список моделей появится после подключения к прокси.
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2">
              {props.models.map((m) => {
                const busyReq = m.workers.reduce((acc, w) => acc + w.running_requests, 0);
                const cap = m.workers.reduce((acc, w) => acc + w.max_running_requests, 0);
                const coeff = m.workers.length
                  ? Math.min(...m.workers.map((w) => w.coefficient))
                  : 0;
                return (
                  <div key={m.id} className="rounded-lg border border-ink-700 bg-ink-900 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="selectable truncate text-[13px] font-medium">{m.id}</span>
                      <span className="shrink-0 text-[12px] text-fg-faint">{m.workers.length} GPU</span>
                    </div>
                    <div className="mt-1 flex gap-4 text-[11.5px] text-fg-faint">
                      <span>нагрузка {busyReq}/{cap}</span>
                      <span>коэффициент цены ×{coeff / 1000}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <LogsCard />
      </div>
    </div>
  );
}

function LogsCard() {
  const [logs, setLogs] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const preRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const tick = () => {
      getLogs().then((lines) => {
        if (alive) setLogs(lines);
      }, () => {});
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [open]);

  useEffect(() => {
    preRef.current?.scrollTo({ top: preRef.current.scrollHeight });
  }, [logs]);

  return (
    <Card className="p-5">
      <button
        type="button"
        className="flex w-full items-center justify-between"
        onClick={() => setOpen(!open)}
      >
        <SectionTitle>Логи ядра</SectionTitle>
        <span className="text-xs text-fg-faint">{open ? "скрыть" : "показать"}</span>
      </button>
      {open && (
        <pre
          ref={preRef}
          className="selectable mt-3 h-64 overflow-auto rounded-lg border border-ink-700 bg-ink-950 p-3 font-mono text-[11.5px] leading-relaxed text-fg-muted"
        >
          {logs.length ? logs.join("\n") : "пусто"}
        </pre>
      )}
    </Card>
  );
}
