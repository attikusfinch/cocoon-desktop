/** Shapes mirrored from gocoon-runner's /api and OpenAI endpoints. */

export type AppPaths = {
  data_dir: string;
  wallet_path: string;
  config_path: string;
  ton_config_path: string;
  runner_state_path: string;
};

export type ChannelState = {
  address: string;
  state: string;
  active: boolean;
  balance_nano: string;
  balance_ton: string;
  stake_nano: string;
  stake_ton: string;
  tokens_used: number;
};

export type WalletState = {
  owner_address: string;
  fund_address: string;
  recommended_funding_nano: string;
  recommended_funding_ton: string;
  balance_nano?: string;
  balance_ton?: string;
  balance_source?: "engine" | "chain";
  balance_error?: string;
  funded?: boolean;
  min_client_stake_nano?: string;
  min_client_stake_ton?: string;
  /** Existing on-chain payment channel rediscovered from tx history. */
  channel?: ChannelState;
  channel_error?: string;
};

export type AppState = {
  paths: AppPaths;
  has_wallet: boolean;
  has_config: boolean;
  engine: { running: boolean; error?: string };
  wallet?: WalletState;
  wallet_error?: string;
  version: { version: string; commit: string };
};

export type WalletBackup = {
  wallet_path: string;
  owner_mnemonic: string[];
  owner_mnemonic_text: string;
  node_secret_base64: string;
  owner_address: string;
  fund_address: string;
  backup_json: string;
};

export type RunnerStats = {
  status: {
    wallet_balance: number;
    ton_last_synced_at: number;
    enabled: boolean;
    git_commit: string;
  };
  localconf: { root_address: string; owner_address: string };
  proxy_connections: { address: string; is_ready: boolean; proxy_sc_address: string }[];
  proxies: ProxyChannel[];
};

export type ProxyChannel = {
  proxy_sc_address: string;
  proxy_public_key: string;
  sc_address: string;
  state: number;
  tokens_used_proxy_committed_to_blockchain: number;
  tokens_used_proxy_committed_to_db: number;
  tokens_used_proxy_max: number;
  tokens_charged: number;
  tokens_payed: number;
};

export type ModelInfo = {
  id: string;
  workers: { coefficient: number; running_requests: number; max_running_requests: number }[];
};

export type ChatUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  total_cost?: number | string;
  prompt_total_cost?: number | string;
  completion_total_cost?: number | string;
};

/** A message as persisted in /api/chats documents. */
export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  thinking?: string[];
  ts: number;
  model?: string;
  usage?: ChatUsage;
  error?: string;
};

export type ChatDoc = {
  id: string;
  title: string;
  model?: string;
  created_at: number;
  updated_at: number;
  messages: ChatMessage[];
};

export type ChatSummary = {
  id: string;
  title: string;
  model?: string;
  created_at: number;
  updated_at: number;
  messages: number;
};

/** Sidecar process status reported by the Tauri shell. */
export type SidecarStatus = {
  running: boolean;
  runnerUrl: string;
  dataDir: string;
  configPath: string;
  configExists: boolean;
};
