import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import type {
  AccountConfig,
  AppConfig,
  CodexProfileSession,
  ProviderDescriptor,
  ProviderKind,
  Snapshot,
} from "../types";

// ---- Config ----

export const getConfig = (): Promise<AppConfig> => invoke("get_config");

export const addAccount = (
  label: string,
  provider: ProviderKind,
  /** Provider-specific credential blob, already JSON-parsed. */
  credentials: unknown
): Promise<AccountConfig> =>
  invoke("add_account", { label, provider, credentials });

export const removeAccount = (id: string): Promise<void> =>
  invoke("remove_account", { id });

// ---- Providers ----

export const listProviders = (): Promise<ProviderDescriptor[]> =>
  invoke("list_providers");

/** Trigger an immediate refresh for one account (e.g. on a retry click). */
export const refreshAccount = (id: string): Promise<Snapshot> =>
  invoke("refresh_account", { id });

/** Returns the last-known snapshot for an account, if any. */
export const getSnapshot = (id: string): Promise<Snapshot | null> =>
  invoke("get_snapshot", { id });

/** Returns the recent history of snapshots for an account (oldest-first). */
export const getHistory = (id: string): Promise<any[]> =>
  invoke("get_history", { id });

// ---- Live events ----

/** Subscribe to usage updates. Returns an unsubscribe function. */
export function onUsageUpdate(
  handler: (snapshot: Snapshot) => void
): Promise<UnlistenFn> {
  return listen<Snapshot>("usage:update", (e) => handler(e.payload));
}

// ---- Isolated Codex profiles ----

export const prepareCodexProfile = (): Promise<CodexProfileSession> =>
  invoke("prepare_codex_profile");

export const completeCodexProfile = (
  profileId: string,
  label: string
): Promise<AccountConfig> =>
  invoke("complete_codex_profile", { profileId, label });

// ---- App updates ----

export type AppUpdate = NonNullable<Awaited<ReturnType<typeof check>>>;
export type UpdateDownloadEvent = DownloadEvent;

export const checkForAppUpdate = (): Promise<AppUpdate | null> =>
  check({ timeout: 30_000 });

export const installAppUpdate = (
  update: AppUpdate,
  onEvent: (event: UpdateDownloadEvent) => void
): Promise<void> => update.downloadAndInstall(onEvent, { timeout: 300_000 });

export const relaunchApp = (): Promise<void> => relaunch();
