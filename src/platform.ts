/**
 * Bridge to the Tauri shell. In a plain browser (vite dev against an
 * externally started runner) every sidecar call becomes a no-op so the whole
 * UI stays usable for development.
 */
import type { SidecarStatus } from "./types";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export async function sidecarStatus(): Promise<SidecarStatus | null> {
  if (!isTauri) return null;
  return invoke<SidecarStatus>("runner_status");
}

export async function sidecarStart(): Promise<SidecarStatus | null> {
  if (!isTauri) return null;
  return invoke<SidecarStatus>("runner_start");
}

export async function sidecarStop(): Promise<SidecarStatus | null> {
  if (!isTauri) return null;
  return invoke<SidecarStatus>("runner_stop");
}

export function onSidecarExit(handler: () => void): () => void {
  if (!isTauri) return () => {};
  let unlisten: (() => void) | null = null;
  void import("@tauri-apps/api/event").then(({ listen }) =>
    listen("runner-exit", handler).then((fn) => {
      unlisten = fn;
    }),
  );
  return () => unlisten?.();
}
