// Types mirrored from the Rust `provider` module. The Rust structs all use
// `#[serde(rename_all = "camelCase")]`, so the wire format over Tauri IPC is
// camelCase - these interfaces MUST match that (not the Rust snake_case names).

export type ProviderKind =
  | "codex"
  | "antigravity"
  | "deepseek"
  | "z_ai"
  | "openrouter"
  | "openai_api"
  | "anthropic_api"
  | "claude_code"
  | "cursor"
  | "contextual_ai"
  | "x_ai"
  | "aws_bedrock"
  | "azure_openai"
  | "fireworks";

export interface AccountConfig {
  id: string;
  label: string;
  provider: ProviderKind;
  /** Vault key under which this account's secret credentials are stored. */
  authRef: string;
}

export interface AppConfig {
  accounts: AccountConfig[];
  pollIntervalSeconds: number;
  theme: string;
}

/** Vendor group for a model, used to color-code and rate the cost estimate. */
export type ModelVendor = "gemini" | "claude" | "gpt" | "other";

/** A single usage window (e.g. Codex's 5h window, or its weekly window). */
export interface UsageWindow {
  label: string;
  /** 0..100 - fraction of the window *consumed*. Drives the bar. */
  usedPercent: number;
  /** Length of the window in seconds, if known (e.g. 18000 for 5h). */
  limitWindowSeconds: number | null;
  /** ISO-8601 timestamp of when the window resets. */
  resetsAt: string;
  /** Per-model breakdown (Antigravity). Empty for Codex. */
  models: ModelQuota[];
}

export interface ModelQuota {
  label: string;
  modelId: string;
  vendor: ModelVendor;
  /** 0..100 used, or null if the source didn't report it. */
  usedPercent: number | null;
  /** ISO-8601 reset time, if known. */
  resetTime: string | null;
}

/** Best-effort GBP cost estimate for a snapshot. */
export interface CostEstimate {
  /** Estimated GBP consumed so far in the current window. */
  estimatedGbp: number;
  /** Estimated tokens consumed so far. */
  tokensUsed: number;
  /** Assumed full token budget for the window. */
  tokenBudget: number;
  /** Blended GBP rate per 1M tokens. */
  ratePerMtuGbp: number;
}

/** The normalized output every provider returns. */
export interface Snapshot {
  accountId: string;
  /** Milliseconds since epoch when this snapshot was fetched. */
  timestamp: number;
  planName: string | null;
  /** Signed-in account identifier (usually email), auto-detected from API. */
  accountDetail: string | null;
  /** Provider kind that produced this snapshot. */
  providerKind: ProviderKind | null;
  windows: UsageWindow[];
  /** Best-effort cost estimate. */
  cost: CostEstimate;
  /** Remaining balance in GBP, if applicable (API keys). */
  balanceGbp?: number | null;
  /** True when the last fetch failed and this is a cached/last-good value. */
  isStale: boolean;
  /** Present when fetch failed and no prior snapshot exists. */
  error: string | null;
}

export interface ProviderDescriptor {
  kind: ProviderKind;
  /** Human-readable name shown in the add-account wizard. */
  displayName: string;
  /** Short description of what credentials this provider needs. */
  credentialDescription: string;
}

/** Default zero-cost estimate, used before the first snapshot arrives. */
export const EMPTY_COST: CostEstimate = {
  estimatedGbp: 0,
  tokensUsed: 0,
  tokenBudget: 0,
  ratePerMtuGbp: 0,
};

export interface UsageEvent {
  timestamp: number;
  accountId: string;
  tokensUsed: number;
  costGbp: number;
}
