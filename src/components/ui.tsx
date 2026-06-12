/** Small shared UI primitives. */
import { useState, type ReactNode } from "react";

export function Card(props: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-ink-700 bg-ink-850 ${props.className ?? ""}`}>
      {props.children}
    </div>
  );
}

export function SectionTitle(props: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-faint">
      {props.children}
    </div>
  );
}

export function Pill(props: { tone: "ok" | "warn" | "err" | "muted"; children: ReactNode; pulse?: boolean }) {
  const tones: Record<string, string> = {
    ok: "text-ok border-ok/40 bg-ok/10",
    warn: "text-warn border-warn/40 bg-warn/10",
    err: "text-err border-err/40 bg-err/10",
    muted: "text-fg-muted border-ink-600 bg-ink-800",
  };
  const dots: Record<string, string> = {
    ok: "bg-ok",
    warn: "bg-warn",
    err: "bg-err",
    muted: "bg-fg-faint",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[props.tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dots[props.tone]} ${props.pulse ? "dot-pulse" : ""}`} />
      {props.children}
    </span>
  );
}

export function Button(props: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  busy?: boolean;
  className?: string;
  title?: string;
}) {
  const kind = props.kind ?? "primary";
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45";
  const kinds: Record<string, string> = {
    primary: "bg-gold-500 text-ink-950 hover:bg-gold-400 active:bg-gold-600",
    ghost: "border border-ink-600 bg-transparent text-fg hover:bg-ink-800",
    danger: "border border-err/40 bg-err/10 text-err hover:bg-err/20",
  };
  return (
    <button
      type="button"
      title={props.title}
      className={`${base} ${kinds[kind]} ${props.className ?? ""}`}
      onClick={props.onClick}
      disabled={props.disabled || props.busy}
    >
      {props.busy && <Spinner className="h-3.5 w-3.5" />}
      {props.children}
    </button>
  );
}

export function Spinner(props: { className?: string }) {
  return (
    <svg className={`animate-spin ${props.className ?? "h-4 w-4"}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function CopyButton(props: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 rounded-md border border-ink-600 px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-ink-800 hover:text-fg ${props.className ?? ""}`}
      onClick={() => {
        void navigator.clipboard.writeText(props.text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
    >
      {copied ? "✓ Скопировано" : (props.label ?? "Копировать")}
    </button>
  );
}

export function Mono(props: { children: ReactNode; className?: string }) {
  return (
    <span className={`selectable font-mono text-[12.5px] text-fg-muted ${props.className ?? ""}`}>
      {props.children}
    </span>
  );
}

export function ErrorNote(props: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-err/30 bg-err/10 px-3 py-2 text-[13px] text-err selectable">
      {props.children}
    </div>
  );
}

export function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-fg-muted">{props.label}</div>
      {props.children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-fg outline-none transition-colors placeholder:text-fg-faint focus:border-gold-500/60";
