import type { ProviderKind, ModelVendor } from "../types";

export interface ProviderStyle {
  label: string;
  gradient: string;
  dot: string;
  tagline: string;
}

export function providerStyle(kind: ProviderKind): ProviderStyle {
  switch (kind) {
    case "codex":
      return {
        label: "Codex",
        gradient: "from-zinc-500 to-zinc-800 dark:from-zinc-400 dark:to-zinc-200",
        dot: "bg-zinc-800 dark:bg-zinc-200",
        tagline: "OpenAI Codex",
      };
    case "antigravity":
      return {
        label: "Antigravity",
        gradient: "from-zinc-600 to-zinc-900 dark:from-zinc-400 dark:to-zinc-100",
        dot: "bg-zinc-800 dark:bg-zinc-200",
        tagline: "Google Antigravity",
      };
    case "deepseek":
      return {
        label: "DeepSeek",
        gradient: "from-neutral-500 to-neutral-800 dark:from-neutral-400 dark:to-neutral-200",
        dot: "bg-neutral-800 dark:bg-neutral-200",
        tagline: "DeepSeek API",
      };
    case "z_ai":
      return {
        label: "Z.ai",
        gradient: "from-zinc-700 to-zinc-950 dark:from-zinc-300 dark:to-zinc-100",
        dot: "bg-zinc-800 dark:bg-zinc-200",
        tagline: "Z.ai Coding Plan",
      };
    case "github_copilot":
      return {
        label: "GitHub Copilot",
        gradient: "from-neutral-600 to-neutral-900 dark:from-neutral-400 dark:to-neutral-100",
        dot: "bg-neutral-800 dark:bg-neutral-200",
        tagline: "Copilot subscription",
      };
  }
}

export function vendorDot(vendor: ModelVendor): string {
  switch (vendor) {
    case "gemini":
      return "bg-zinc-800 dark:bg-zinc-200";
    case "claude":
      return "bg-zinc-600 dark:bg-zinc-400";
    case "gpt":
      return "bg-zinc-400 dark:bg-zinc-600";
    case "other":
      return "bg-zinc-300 dark:bg-zinc-700";
  }
}
