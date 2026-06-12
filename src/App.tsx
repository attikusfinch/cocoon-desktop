import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

type RunnerStatus = {
  running: boolean;
  runnerUrl: string;
  dataDir: string;
  configPath: string;
  configExists: boolean;
};

function App() {
  const [status, setStatus] = useState<RunnerStatus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  const refresh = async () => {
    try {
      setStatus(await invoke<RunnerStatus>("runner_status"));
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    refresh();
    invoke<string[]>("runner_logs").then(setLogs).catch(() => {});
    const unlistenLog = listen<string>("runner-log", (e) => {
      setLogs((prev) => [...prev.slice(-999), e.payload]);
    });
    const unlistenExit = listen("runner-exit", () => refresh());
    return () => {
      unlistenLog.then((fn) => fn());
      unlistenExit.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [logs]);

  const act = async (cmd: "runner_start" | "runner_stop") => {
    setError(null);
    try {
      setStatus(await invoke<RunnerStatus>(cmd));
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <main className="shell">
      <header className="topbar">
        <h1>Cocoon</h1>
        <span className={`pill ${status?.running ? "ok" : "off"}`}>
          {status?.running ? "runner online" : "runner offline"}
        </span>
      </header>

      <section className="card">
        <h2>Ядро (gocoon-runner)</h2>
        <dl>
          <dt>Data dir</dt>
          <dd>{status?.dataDir ?? "…"}</dd>
          <dt>Конфиг</dt>
          <dd>
            {status?.configPath ?? "…"}{" "}
            {status && (status.configExists ? "✓" : "— не найден (онбординг ещё не пройден)")}
          </dd>
          <dt>API</dt>
          <dd>{status?.runnerUrl ?? "…"}</dd>
        </dl>
        <div className="row">
          <button onClick={() => act("runner_start")} disabled={status?.running}>
            Запустить
          </button>
          <button onClick={() => act("runner_stop")} disabled={!status?.running}>
            Остановить
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card grow">
        <h2>Логи</h2>
        <pre ref={logRef}>{logs.length ? logs.join("\n") : "пока пусто"}</pre>
      </section>

      <footer className="hint">
        Каркас приложения: настоящий UI (онбординг, чат, кошелёк) — в работе.
      </footer>
    </main>
  );
}

export default App;
