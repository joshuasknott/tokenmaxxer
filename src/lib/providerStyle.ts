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
   * Neutral surface for real provider artwork. Logos should not be recolored
   * for theme contrast.
   */
  chipBg: string;
}

const providerIconChip = "bg-white shadow-sm ring-1 ring-black/10";

export function providerStyle(kind: ProviderKind): ProviderStyle {
  switch (kind) {
    case "codex":
      return {
        label: "Codex",
        gradient: "from-zinc-500 to-zinc-800 dark:from-zinc-400 dark:to-zinc-200",
        dot: "bg-zinc-800 dark:bg-zinc-200",
        tagline: "OpenAI Codex",
        accentBar: "bg-zinc-800 dark:bg-zinc-200",
        chipBg: providerIconChip,
      };
    case "antigravity":
      return {
        label: "Antigravity",
        gradient: "from-zinc-600 to-zinc-900 dark:from-zinc-400 dark:to-zinc-100",
        dot: "bg-zinc-800 dark:bg-zinc-200",
        tagline: "Google Antigravity",
        accentBar: "bg-teal-500",
        chipBg: providerIconChip,
      };
    case "deepseek":
      return {
        label: "DeepSeek",
        gradient: "from-neutral-500 to-neutral-800 dark:from-neutral-400 dark:to-neutral-200",
        dot: "bg-neutral-800 dark:bg-neutral-200",
        tagline: "DeepSeek API",
        accentBar: "bg-[#4D6BFE]",
        chipBg: providerIconChip,
      };
    case "z_ai":
      return {
        label: "Z.ai",
        gradient: "from-zinc-700 to-zinc-950 dark:from-zinc-300 dark:to-zinc-100",
        dot: "bg-zinc-800 dark:bg-zinc-200",
        tagline: "Z.ai Coding Plan",
        accentBar: "bg-indigo-500",
        chipBg: providerIconChip,
      };
    case "openrouter":
      return {
        label: "OpenRouter",
        gradient: "from-slate-600 to-black dark:from-zinc-300 dark:to-white",
        dot: "bg-black dark:bg-zinc-100",
        tagline: "OpenRouter Credits",
        accentBar: "bg-sky-500",
        chipBg: providerIconChip,
      };
    case "openai_api":
      return {
        label: "OpenAI API",
        gradient: "from-emerald-600 to-zinc-900 dark:from-emerald-300 dark:to-zinc-100",
        dot: "bg-emerald-600",
        tagline: "OpenAI Admin Usage",
        accentBar: "bg-emerald-500",
        chipBg: providerIconChip,
      };
    case "anthropic_api":
      return {
        label: "Anthropic API",
        gradient: "from-stone-500 to-orange-700 dark:from-orange-200 dark:to-stone-100",
        dot: "bg-orange-600",
        tagline: "Anthropic Admin Usage",
        accentBar: "bg-orange-500",
        chipBg: providerIconChip,
      };
    case "claude_code":
      return {
        label: "Claude Code",
        gradient: "from-orange-600 to-zinc-900 dark:from-orange-200 dark:to-zinc-100",
        dot: "bg-orange-500",
        tagline: "Claude Code Analytics",
        accentBar: "bg-amber-500",
        chipBg: providerIconChip,
      };
    case "cursor":
      return {
        label: "Cursor",
        gradient: "from-zinc-800 to-cyan-700 dark:from-zinc-100 dark:to-cyan-200",
        dot: "bg-cyan-600",
        tagline: "Cursor Team Usage",
        accentBar: "bg-cyan-500",
        chipBg: providerIconChip,
      };
    case "contextual_ai":
      return {
        label: "Contextual AI",
        gradient: "from-fuchsia-700 to-teal-700 dark:from-fuchsia-200 dark:to-teal-200",
        dot: "bg-fuchsia-600",
        tagline: "Contextual Billing",
        accentBar: "bg-fuchsia-500",
        chipBg: providerIconChip,
      };
  }
}

export function vendorDot(vendor: ModelVendor): string {
  switch (vendor) {
    case "gemini":
      return "bg-teal-500";
    case "claude":
      return "bg-orange-500";
    case "gpt":
      return "bg-emerald-500";
    case "other":
      return "bg-zinc-400";
  }
}
