import { formatNanoTON } from "../api";
import type { AppState, ChatSummary } from "../types";
import logo from "../assets/CocoonEggLogo.webp";

export type View = "chat" | "wallet" | "network" | "settings";

type Props = {
  state: AppState | null;
  ready: boolean;
  connecting: boolean;
  chats: ChatSummary[];
  currentChatId: string | null;
  view: View;
  onNewChat: () => void;
  onOpenChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onView: (v: View) => void;
};

export function Sidebar(props: Props) {
  const balance = props.state?.wallet?.balance_nano;

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-ink-800 bg-ink-900">
      {/* Brand */}
      <div className="flex h-12 shrink-0 items-center gap-2.5 px-4">
        <img src={logo} alt="" className="h-6 w-6" draggable={false} />
        <span className="text-[15px] font-semibold tracking-tight">Cocoon</span>
      </div>

      {/* New chat */}
      <div className="px-3 pb-2 pt-1">
        <button
          type="button"
          onClick={props.onNewChat}
          className="flex w-full items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-sm text-fg transition-colors hover:border-gold-500/40 hover:bg-ink-800"
        >
          <span className="text-gold-400">+</span> Новый чат
        </button>
      </div>

      {/* Chat list */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        {props.chats.length === 0 && (
          <div className="px-3 py-2 text-xs text-fg-faint">История пуста</div>
        )}
        {props.chats.map((c) => {
          const active = props.view === "chat" && c.id === props.currentChatId;
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
          label="Кошелёк"
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
