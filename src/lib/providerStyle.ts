import type { ProviderKind, ModelVendor } from "../types";

export interface ProviderStyle {
  label: string;
  gradient: string;
  dot: string;
  tagline: string;
  /**
   * Brand accent: the bar/rule color used for the card's top rule and its
   * usage bar fill. Kept neutral for providers whose logo is itself near
   * monochrome (Codex), brand-colored otherwise.
   */
  accentBar: string;
  /**
   * Faint brand-tinted background for the icon chip (e.g. bg-teal-500/10).
   */
  chipBg: string;
}

export function providerStyle(kind: ProviderKind): ProviderStyle {
  switch (kind) {
    case "codex":
      return {
        label: "Codex",
        gradient: "from-zinc-500 to-zinc-800 dark:from-zinc-400 dark:to-zinc-200",
        dot: "bg-zinc-800 dark:bg-zinc-200",
        tagline: "OpenAI Codex",
        accentBar: "bg-zinc-800 dark:bg-zinc-200",
        chipBg: "bg-zinc-800/10 dark:bg-zinc-200/10",
      };
    case "antigravity":
      return {
        label: "Antigravity",
        gradient: "from-zinc-600 to-zinc-900 dark:from-zinc-400 dark:to-zinc-100",
        dot: "bg-zinc-800 dark:bg-zinc-200",
        tagline: "Google Antigravity",
        accentBar: "bg-teal-500",
        chipBg: "bg-teal-500/10",
      };
    case "deepseek":
      return {
        label: "DeepSeek",
        gradient: "from-neutral-500 to-neutral-800 dark:from-neutral-400 dark:to-neutral-200",
        dot: "bg-neutral-800 dark:bg-neutral-200",
        tagline: "DeepSeek API",
        accentBar: "bg-[#4D6BFE]",
        chipBg: "bg-[#4D6BFE]/10",
      };
    case "z_ai":
      return {
        label: "Z.ai",
        gradient: "from-zinc-700 to-zinc-950 dark:from-zinc-300 dark:to-zinc-100",
        dot: "bg-zinc-800 dark:bg-zinc-200",
        tagline: "Z.ai Coding Plan",
        accentBar: "bg-indigo-500",
        chipBg: "bg-indigo-500/10",
      };
    case "github_copilot":
      return {
        label: "GitHub Copilot",
        gradient: "from-neutral-600 to-neutral-900 dark:from-neutral-400 dark:to-neutral-100",
        dot: "bg-neutral-800 dark:bg-neutral-200",
        tagline: "Copilot subscription",
        accentBar: "bg-emerald-500",
        chipBg: "bg-emerald-500/10",
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
