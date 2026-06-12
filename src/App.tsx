import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChat,
  deleteChat,
  engineStart,
  getChat,
  getModels,
  getState,
  getStats,
  listChats,
  putChat,
} from "./api";
import { onSidecarExit, sidecarStatus } from "./platform";
import type { AppState, ChatDoc, ChatSummary, ModelInfo, RunnerStats, SidecarStatus, WalletBackup } from "./types";
import { ChatView } from "./components/Chat";
import { BackupReveal, Onboarding } from "./components/Onboarding";
import { Sidebar, type View } from "./components/Sidebar";
import { WalletPanel } from "./components/WalletPanel";
import { NetworkPanel } from "./components/NetworkPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { Spinner } from "./components/ui";

export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [stats, setStats] = useState<RunnerStats | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [sidecar, setSidecar] = useState<SidecarStatus | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chat, setChat] = useState<ChatDoc | null>(null);
  const [view, setView] = useState<View>("chat");
  const [pendingBackup, setPendingBackup] = useState<WalletBackup | null>(null);

  const ready = (stats?.proxy_connections ?? []).some((p) => p.is_ready);
  const connecting = state?.engine.running === true && !ready;

  const refreshState = useCallback(() => {
    getState().then(
      (s) => {
        setState(s);
        setOnline(true);
      },
      () => setOnline(false),
    );
  }, []);

  const refreshChats = useCallback(() => {
    listChats().then(setChats, () => {});
  }, []);

  // Core state poll.
  useEffect(() => {
    refreshState();
    const t = setInterval(refreshState, 4000);
    return () => clearInterval(t);
  }, [refreshState]);

  // Stats + models poll while the engine runs.
  useEffect(() => {
    if (state?.engine.running !== true) {
      setStats(null);
      return;
    }
    const tick = () => {
      getStats().then(setStats, () => setStats(null));
    };
    tick();
    const t = setInterval(tick, 4000);
    return () => clearInterval(t);
  }, [state?.engine.running]);

  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      getModels().then(setModels, () => {});
    };
    tick();
    const t = setInterval(tick, 20000);
    return () => clearInterval(t);
  }, [ready]);

  // Chats list once the runner is reachable.
  useEffect(() => {
    if (online) refreshChats();
  }, [online, refreshChats]);

  // The runner auto-starts the engine on boot when a config exists, but in
  // the very first session the config appears only after onboarding — kick
  // the engine once the wallet is funded or an existing channel is found
  // (an active channel already holds the stake, no wallet balance needed).
  const engineKick = useRef(0);
  useEffect(() => {
    if (!state || state.engine.running || state.engine.error) return;
    if (!state.has_config) return;
    const canConnect = state.wallet?.funded === true || state.wallet?.channel?.active === true;
    if (!canConnect) return;
    if (Date.now() - engineKick.current < 15000) return;
    engineKick.current = Date.now();
    engineStart().then(
      (r) => setState(r.state),
      () => {},
    );
  }, [state]);

  // Sidecar status (Tauri only).
  useEffect(() => {
    sidecarStatus().then(setSidecar, () => {});
    return onSidecarExit(() => {
      setOnline(false);
      sidecarStatus().then(setSidecar, () => {});
    });
  }, []);

  /* Chat document handling */

  const persistTimer = useRef<number | null>(null);
  const persistChat = useCallback(
    (doc: ChatDoc) => {
      setChat(doc);
      if (persistTimer.current) window.clearTimeout(persistTimer.current);
      persistTimer.current = window.setTimeout(() => {
        putChat(doc.id, { title: doc.title, model: doc.model, messages: doc.messages }).then(
          () => refreshChats(),
          () => {},
        );
      }, 250);
    },
    [refreshChats],
  );

  const handleCreateChat = useCallback(
    async (title: string, model: string) => {
      const doc = await createChat(title, model);
      setChat(doc);
      refreshChats();
      return doc;
    },
    [refreshChats],
  );

  const openChat = useCallback((id: string) => {
    setView("chat");
    getChat(id).then(setChat, () => {});
  }, []);

  const removeChat = useCallback(
    (id: string) => {
      deleteChat(id).then(() => {
        refreshChats();
        setChat((cur) => (cur?.id === id ? null : cur));
      }, () => {});
    },
    [refreshChats],
  );

  const newChat = useCallback(() => {
    setView("chat");
    setChat(null);
  }, []);

  /* Render */

  if (state === null && online === null) {
    return (
      <div className="flex h-full items-center justify-center bg-ink-950">
        <Spinner className="h-6 w-6 text-accent-400" />
      </div>
    );
  }

  if (pendingBackup) {
    return (
      <BackupReveal
        backup={pendingBackup}
        onConfirm={() => {
          setPendingBackup(null);
          refreshState();
        }}
      />
    );
  }

  if (!state || !state.has_wallet) {
    return (
      <Onboarding
        online={online}
        onDone={(s, backup) => {
          setState(s);
          if (backup) setPendingBackup(backup);
        }}
      />
    );
  }

  return (
    <div className="flex h-full bg-ink-950">
      <Sidebar
        state={state}
        ready={ready}
        connecting={connecting}
        chats={chats}
        currentChatId={chat?.id ?? null}
        view={view}
        onNewChat={newChat}
        onOpenChat={openChat}
        onDeleteChat={removeChat}
        onView={setView}
      />
      <main className="min-w-0 flex-1">
        {view === "chat" && (
          <ChatView
            state={state}
            ready={ready}
            connecting={connecting}
            chat={chat}
            models={models}
            onCreateChat={handleCreateChat}
            onChange={persistChat}
          />
        )}
        {view === "wallet" && <WalletPanel state={state} stats={stats} />}
        {view === "network" && (
          <NetworkPanel
            state={state}
            stats={stats}
            models={models}
            ready={ready}
            connecting={connecting}
            onStateChanged={refreshState}
          />
        )}
        {view === "settings" && <SettingsPanel state={state} sidecar={sidecar} />}
      </main>
    </div>
  );
}
