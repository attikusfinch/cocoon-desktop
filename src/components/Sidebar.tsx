import { useMemo, useState } from "react";
import { formatNanoTON } from "../api";
import type { AppState, ChatSummary } from "../types";
import logo from "../assets/egg.png";

export type View = "chat" | "wallet" | "network" | "settings";

type Props = {
  state: AppState | null;
  ready: boolean;
  connecting: boolean;
  chats: ChatSummary[];
  pinnedChatIds: string[];
  currentChatId: string | null;
  view: View;
  onNewChat: () => void;
  onOpenChat: (id: string) => void;
  onTogglePinChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onView: (v: View) => void;
};

export function Sidebar(props: Props) {
  const balance = props.state?.wallet?.balance_nano;
  const [query, setQuery] = useState("");

  const pinned = useMemo(() => new Set(props.pinnedChatIds), [props.pinnedChatIds]);
  const filteredChats = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return props.chats
      .filter((c) => {
        if (!q) return true;
        return `${c.title} ${c.model ?? ""}`.toLocaleLowerCase().includes(q);
      })
      .sort((a, b) => {
        const ap = pinned.has(a.id);
        const bp = pinned.has(b.id);
        if (ap !== bp) return ap ? -1 : 1;
        return b.updated_at - a.updated_at;
      });
  }, [props.chats, pinned, query]);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-900">
      {/* Brand */}
      <div className="flex h-12 shrink-0 items-center gap-2.5 px-4">
        <img src={logo} alt="" className="h-6 w-6" draggable={false} />
        <span className="text-[15px] font-semibold tracking-tight">Cocoon</span>
      </div>

      {/* New chat and search */}
      <div className="space-y-2 px-3 pb-2 pt-1">
        <button
          type="button"
          onClick={props.onNewChat}
          className="flex w-full items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-sm text-fg transition-colors hover:border-accent-500/40 hover:bg-ink-800"
        >
          <span className="text-accent-400">+</span> Новый чат
        </button>
        <label className="relative block">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.9">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" strokeLinecap="round" />
            </svg>
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск чатов"
            className="h-9 w-full rounded-lg border border-ink-700 bg-ink-950/45 pl-8 pr-8 text-[13px] text-fg outline-none transition-colors placeholder:text-fg-faint focus:border-accent-500/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              title="Очистить поиск"
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-fg-faint transition-colors hover:bg-ink-700 hover:text-fg"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m7 7 10 10M17 7 7 17" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </label>
      </div>

      {/* Chat list */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {props.chats.length === 0 && (
          <div className="px-3 py-2 text-xs text-fg-faint">История пуста</div>
        )}
        {props.chats.length > 0 && filteredChats.length === 0 && (
          <div className="px-3 py-2 text-xs text-fg-faint">Ничего не найдено</div>
        )}
        {filteredChats.map((c) => {
          const active = props.view === "chat" && c.id === props.currentChatId;
          const pinnedChat = pinned.has(c.id);
          return (
            <div
              key={c.id}
              className={`group flex items-center rounded-lg transition-colors ${
                active ? "bg-ink-700/70" : "hover:bg-ink-800"
              }`}
            >
              <button
                type="button"
                onClick={() => props.onOpenChat(c.id)}
                className="min-w-0 flex-1 truncate px-3 py-2 text-left text-[13px] text-fg-muted group-hover:text-fg"
                title={c.title}
              >
                <span className={active ? "text-fg" : ""}>{c.title}</span>
              </button>
              <button
                type="button"
                onClick={() => props.onTogglePinChat(c.id)}
                title={pinnedChat ? "Открепить чат" : "Закрепить чат"}
                className={`mr-0.5 h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-ink-600 ${
                  pinnedChat ? "flex text-accent-300" : "hidden text-fg-faint hover:text-fg group-hover:flex"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
                  fill={pinnedChat ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path
                    d="M14.5 3.8 20.2 9.5l-3.1.9-3.7 3.7.3 4.7-1.1 1.1-4.1-4.1-4.1-4.1 1.1-1.1 4.7.3 3.7-3.7.6-3.4Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="m8.5 15.5-4.2 4.2" strokeLinecap="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => props.onDeleteChat(c.id)}
                title="Удалить чат"
                className="mr-1.5 hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-fg-faint hover:bg-ink-600 hover:text-err group-hover:flex"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0 1 13h6l1-13" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          );
        })}
      </nav>

      {/* Bottom nav */}
      <div className="shrink-0 border-t border-ink-800 p-2">
        <NavItem
          label="Кошелек"
          active={props.view === "wallet"}
          onClick={() => props.onView("wallet")}
          trailing={balance !== undefined ? `${formatNanoTON(balance)} TON` : undefined}
          icon={
            <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm13 5h3" strokeLinecap="round" />
          }
        />
        <NavItem
          label="Сеть"
          active={props.view === "network"}
          onClick={() => props.onView("network")}
          trailing={
            <span
              className={`h-2 w-2 rounded-full ${
                props.ready ? "bg-ok" : props.connecting ? "bg-warn dot-pulse" : "bg-fg-faint"
              }`}
            />
          }
          icon={<path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.2 2.2m8.4 8.4 2.2 2.2m0-12.8-2.2 2.2M7.8 16.2l-2.2 2.2" strokeLinecap="round" />}
        />
        <NavItem
          label="Настройки"
          active={props.view === "settings"}
          onClick={() => props.onView("settings")}
          icon={
            <>
              <circle cx="12" cy="12" r="3" />
              <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c.07-.4.1-.8.1-1.2Z" />
            </>
          }
        />
      </div>
    </aside>
  );
}

function NavItem(props: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${
        props.active ? "bg-ink-700/70 text-fg" : "text-fg-muted hover:bg-ink-800 hover:text-fg"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
        {props.icon}
      </svg>
      <span className="flex-1 text-left">{props.label}</span>
      {props.trailing && <span className="text-[11.5px] text-fg-faint">{props.trailing}</span>}
    </button>
  );
}
