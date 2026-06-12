/** Typed client for the gocoon-runner local API (one port for everything). */
import type {
  AppState,
  ChatDoc,
  ChatMessage,
  ChatSummary,
  ChatUsage,
  ModelInfo,
  RunnerStats,
  WalletBackup,
} from "./types";

export const RUNNER_URL = "http://127.0.0.1:10000";

/** Dev-only mock (browser: append ?mock=1): fakes a ready proxy session and
 * streams a canned reply so the chat UI can be exercised without spending
 * TON. Never active inside the packaged app. */
const MOCK =
  typeof location !== "undefined" &&
  !("__TAURI_INTERNALS__" in window) &&
  new URLSearchParams(location.search).has("mock");

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(RUNNER_URL + path, init);
  const text = await resp.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  if (!resp.ok) {
    const body = parsed as { error?: { message?: string } | string } | null;
    const msg =
      typeof body?.error === "string"
        ? body.error
        : (body?.error?.message ?? text.slice(0, 300) ?? resp.statusText);
    throw new ApiError(resp.status, msg || `HTTP ${resp.status}`);
  }
  return parsed as T;
}

const post = (body?: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

/* App state and onboarding */

export const getState = (): Promise<AppState> =>
  MOCK
    ? request<AppState>("/api/state").then((s) => ({
        ...s,
        engine: { running: true },
        wallet: s.wallet
          ? { ...s.wallet, funded: true, balance_nano: "18500000000", balance_ton: "18.5", balance_error: undefined }
          : s.wallet,
      }))
    : request<AppState>("/api/state");

export const createWallet = () =>
  request<{ backup?: WalletBackup; state: AppState }>("/api/wallet/create", post());

export const importWallet = (payload: { mnemonic?: string; backup_json?: string }) =>
  request<{ backup: WalletBackup; state: AppState }>("/api/wallet/import", post(payload));

export const getBackup = () =>
  request<{ backup: WalletBackup }>("/api/wallet/backup", post()).then((r) => r.backup);

export const walletQRUrl = () => `${RUNNER_URL}/api/wallet/qr.png`;

export const engineStart = () => request<{ state: AppState }>("/api/engine/start", post());
export const engineStop = () => request<{ state: AppState }>("/api/engine/stop", post());

export const getLogs = () => request<{ logs: string[] }>("/api/logs").then((r) => r.logs);

/* Network */

export const getStats = (): Promise<RunnerStats> =>
  MOCK
    ? Promise.resolve({
        status: { wallet_balance: 18_500_000_000, ton_last_synced_at: Date.now() / 1000, enabled: true, git_commit: "mock" },
        localconf: { root_address: "EQmock", owner_address: "EQmock" },
        proxy_connections: [{ address: "203.0.113.1:9801", is_ready: true, proxy_sc_address: "EQproxy" }],
        proxies: [
          {
            proxy_sc_address: "EQproxy",
            proxy_public_key: "00",
            sc_address: "EQCns7bYSp0igFvS1wpb5wsZjCKCV19MD5AVzI4EyxsnU73k",
            state: 0,
            tokens_used_proxy_committed_to_blockchain: 120000,
            tokens_used_proxy_committed_to_db: 134500,
            tokens_used_proxy_max: 1500000,
            tokens_charged: 134500,
            tokens_payed: 120000,
          },
        ],
      })
    : request<RunnerStats>("/jsonstats");

export const getModels = (): Promise<ModelInfo[]> =>
  MOCK
    ? Promise.resolve([
        { id: "Qwen/Qwen3-235B-A22B-Instruct", workers: [{ coefficient: 4000, running_requests: 3, max_running_requests: 16 }] },
        { id: "deepseek-ai/DeepSeek-V3", workers: [{ coefficient: 5200, running_requests: 1, max_running_requests: 8 }] },
      ])
    : request<{ data: ModelInfo[] }>("/v1/models").then((r) => r.data ?? []);

export const channelRequest = (verb: "topup" | "close" | "withdraw", clientSC: string, amountNano?: string) => {
  const amount = verb === "topup" && amountNano ? `&amount=${encodeURIComponent(amountNano)}` : "";
  return fetch(`${RUNNER_URL}/request/${verb}?proxy=${encodeURIComponent(clientSC)}${amount}`).then(
    async (resp) => {
      const text = await resp.text();
      if (!/Request sent/i.test(text)) {
        const match = text.match(/failed:\s*([^<]*)/i);
        throw new Error(match ? match[1].trim() : "request failed");
      }
    },
  );
};

/* Chats */

export const listChats = () => request<{ chats: ChatSummary[] }>("/api/chats").then((r) => r.chats);
export const createChat = (title?: string, model?: string) =>
  request<ChatDoc>("/api/chats", post({ title, model }));
export const getChat = (id: string) => request<ChatDoc>(`/api/chats/${id}`);
export const putChat = (id: string, doc: { title?: string; model?: string; messages: ChatMessage[] }) =>
  request<ChatDoc>(`/api/chats/${id}`, { ...post(doc), method: "PUT" });
export const deleteChat = (id: string) =>
  request<{ deleted: boolean }>(`/api/chats/${id}`, { method: "DELETE" });

/* Chat completion with SSE streaming */

export type StreamUpdate = {
  /** Full accumulated visible text so far. */
  visible: string;
  /** Completed (and possibly one in-progress) thinking blocks. */
  thinking: string[];
  /** True while inside an unclosed <think> block. */
  thinkingLive: boolean;
};

export type StreamResult = {
  visible: string;
  thinking: string[];
  usage?: ChatUsage;
};

/** Splits <think>…</think> blocks out of accumulated model output. */
export function splitThink(text: string): StreamUpdate {
  const thinking: string[] = [];
  let visible = "";
  let rest = text;
  let live = false;
  for (;;) {
    const open = rest.toLowerCase().indexOf("<think>");
    if (open < 0) {
      visible += rest;
      break;
    }
    visible += rest.slice(0, open);
    rest = rest.slice(open + 7);
    const close = rest.toLowerCase().indexOf("</think>");
    if (close < 0) {
      const t = rest.trim();
      if (t) thinking.push(t);
      live = true;
      break;
    }
    const t = rest.slice(0, close).trim();
    if (t) thinking.push(t);
    rest = rest.slice(close + 8);
  }
  return { visible: visible.replace(/^\s+/, ""), thinking, thinkingLive: live };
}

/**
 * POSTs an OpenAI chat completion with stream:true and parses the SSE
 * response. Works with both true upstream streaming and the runner's
 * single-chunk fallback.
 */
export async function streamChatCompletion(
  model: string,
  messages: { role: string; content: string }[],
  onUpdate: (u: StreamUpdate) => void,
  signal: AbortSignal,
): Promise<StreamResult> {
  if (MOCK) return mockStream(onUpdate, signal);
  const resp = await fetch(`${RUNNER_URL}/v1/chat/completions`, {
    ...post({ model, stream: true, messages }),
    signal,
  });
  if (!resp.ok) {
    const text = await resp.text();
    let msg = text.slice(0, 300);
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) msg = parsed.error.message;
    } catch {
      /* keep raw */
    }
    throw new ApiError(resp.status, msg || `HTTP ${resp.status}`);
  }

  const contentType = resp.headers.get("Content-Type") ?? "";
  let raw = "";
  let usage: ChatUsage | undefined;

  const applyChunk = (data: string) => {
    const chunk = JSON.parse(data) as {
      error?: { message?: string };
      choices?: { delta?: { content?: string }; message?: { content?: string } }[];
      usage?: ChatUsage;
    };
    if (chunk.error?.message) throw new Error(chunk.error.message);
    const choice = chunk.choices?.[0];
    const delta = choice?.delta?.content ?? choice?.message?.content ?? "";
    if (delta) {
      raw += delta;
      onUpdate(splitThink(raw));
    }
    if (chunk.usage) usage = chunk.usage;
  };

  if (contentType.includes("text/event-stream") && resp.body) {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (;;) {
        const sep = buffer.indexOf("\n\n");
        if (sep < 0) break;
        const event = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of event.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          applyChunk(data);
        }
      }
    }
  } else {
    // Plain JSON document (non-streaming runner or error fallback).
    const text = await resp.text();
    applyChunk(text);
  }

  const final = splitThink(raw);
  return { visible: final.visible, thinking: final.thinking, usage };
}

async function mockStream(onUpdate: (u: StreamUpdate) => void, signal: AbortSignal): Promise<StreamResult> {
  const text =
    "<think>Пользователь проверяет интерфейс. Отвечу с разметкой, чтобы было что посмотреть.</think>" +
    "Привет! Это **демо-ответ** из мок-режима — сеть Cocoon не использовалась.\n\n" +
    "Что умеет рендер:\n- списки\n- `инлайн-код`\n- ссылки: [ton.org](https://ton.org)\n\n" +
    "```go\nfunc main() {\n\tfmt.Println(\"hello from cocoon\")\n}\n```\n\n> Цитата для проверки. Хорошего дня!";
  let raw = "";
  for (const ch of text.match(/.{1,7}/gs) ?? []) {
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    raw += ch;
    onUpdate(splitThink(raw));
    // Hidden tabs throttle timers hard; fall back to microtasks there.
    if (document.visibilityState === "visible") {
      await new Promise((r) => setTimeout(r, 12));
    } else {
      await Promise.resolve();
    }
  }
  const final = splitThink(raw);
  return {
    visible: final.visible,
    thinking: final.thinking,
    usage: { prompt_tokens: 42, completion_tokens: 96, total_tokens: 138, total_cost: "1352000" },
  };
}

/* Formatting helpers */

export function formatNanoTON(nano: string | number | undefined): string {
  if (nano === undefined || nano === null || nano === "") return "0";
  const v = BigInt(typeof nano === "number" ? Math.round(nano) : nano);
  const sign = v < 0n ? "-" : "";
  const abs = v < 0n ? -v : v;
  const whole = abs / 1_000_000_000n;
  const frac = abs % 1_000_000_000n;
  if (frac === 0n) return sign + whole.toString();
  const fracStr = frac.toString().padStart(9, "0").replace(/0+$/, "");
  return `${sign}${whole}.${fracStr}`;
}

export function shortAddress(addr: string | undefined, head = 6, tail = 5): string {
  if (!addr) return "";
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function usageCostTON(usage: ChatUsage | undefined): string | null {
  const cost = usage?.total_cost;
  if (cost === undefined || cost === null) return null;
  try {
    return formatNanoTON(typeof cost === "string" ? cost : Math.round(cost));
  } catch {
    return null;
  }
}
