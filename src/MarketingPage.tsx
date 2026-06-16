import { useState, useMemo } from "react";
import type { IconType } from "react-icons";
import { FaApple, FaGithub, FaLinux, FaWindows } from "react-icons/fa";
import {
  TbActivityHeartbeat,
  TbBellRinging,
  TbChartBar,
  TbCoinPound,
  TbDownload,
  TbLock,
  TbRefresh,
  TbShieldLock,
} from "react-icons/tb";
import logoUrl from "./assets/tokenmaxxer-logo.png";
import {
  CodexLogo,
  DeepSeekLogo,
  GeminiLogo,
  GithubCopilotLogo,
  ZaiLogo,
} from "./components/ProviderLogo";
import type { AccountConfig, ProviderKind, Snapshot } from "./types";
import { AccountCard } from "./components/AccountCard";
import { SummaryTiles } from "./components/SummaryTiles";
import { UsageChart } from "./components/UsageChart";
import { Logo } from "./components/Logo";

const SOURCE_URL = "https://github.com/joshuasknott/tokenmaxxer";
const RELEASES_URL = `${SOURCE_URL}/releases`;
const WINDOWS_DOWNLOAD_URL = "/downloads/TokenMaxxer_0.1.0_x64-setup.exe";

type DownloadOption = {
  platform: string;
  format: string;
  detail: string;
  href: string | null;
  Icon: IconType;
};

const downloadOptions: DownloadOption[] = [
  {
    platform: "Windows",
    format: "NSIS installer",
    detail: "Published for Windows 10 and 11.",
    href: WINDOWS_DOWNLOAD_URL,
    Icon: FaWindows,
  },
  {
    platform: "macOS",
    format: "Universal DMG and .app",
    detail: "Built by the release workflow for Intel and Apple Silicon Macs.",
    href: null,
    Icon: FaApple,
  },
  {
    platform: "Linux",
    format: "AppImage and .deb",
    detail: "Built by the release workflow on Ubuntu.",
    href: null,
    Icon: FaLinux,
  },
];

const compatibleProviders = [
  { name: "Codex", Icon: CodexLogo },
  { name: "Google Gemini & Antigravity", Icon: GeminiLogo },
  { name: "GitHub Copilot Student", Icon: GithubCopilotLogo },
  { name: "Z.ai", Icon: ZaiLogo },
  { name: "DeepSeek API", Icon: DeepSeekLogo },
];


const proofPoints = [
  { label: "Cooldown Windows", value: "Track resets live", Icon: TbRefresh },
  { label: "Token Quotas", value: "Breakdown by model", Icon: TbChartBar },
  { label: "Local-First Vault", value: "Secure OS keychain", Icon: TbShieldLock },
  { label: "Spend Estimator", value: "Configured in GBP", Icon: TbCoinPound },
];

const workflow = [
  {
    title: "Add accounts once",
    body: "Save provider credentials in the local encrypted vault and keep labels clean for every account you track.",
    Icon: TbLock,
  },
  {
    title: "Watch reset windows",
    body: "See cooldowns, quota percentage, balances, and upcoming reset times without opening five provider dashboards.",
    Icon: TbActivityHeartbeat,
  },
  {
    title: "Act before you hit limits",
    body: "Use clear status and spend signals to switch accounts, pause work, or top up before a session stalls.",
    Icon: TbBellRinging,
  },
];


export function MarketingPage() {
  return (
    <main className="marketing-page min-h-screen text-zinc-50">
      <Header />

      <section className="hero-shell mx-auto grid w-full max-w-[1480px] grid-cols-1 items-start gap-12 px-5 pb-12 pt-28 sm:px-8 sm:pt-32 lg:grid-cols-[0.82fr_1.18fr] lg:px-12 lg:pt-36">
        <div className="max-w-2xl">
          <h1 className="max-w-[12ch] text-5xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-[76px] bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Know when every AI limit resets.
          </h1>
          <p className="mt-7 max-w-xl text-base leading-relaxed text-zinc-300 sm:text-lg">
            TokenMaxxer is a sleek, offline-first dashboard for tracking subscription limits, API key balances, and rate limits. Monitor your local AI capacity without cloud accounts or third-party servers.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <DownloadButton className="marketing-primary" />
            <a className="marketing-secondary" href={SOURCE_URL} rel="noreferrer" target="_blank">
              <FaGithub aria-hidden="true" />
              View source
            </a>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 sm:grid-cols-4">
            {proofPoints.map((point) => (
              <ProofTile key={point.label} {...point} />
            ))}
          </div>
        </div>

        <HeroPreview />
      </section>

      <ProviderBand />
      <WorkflowSection />
      <SecuritySection />
      <DownloadBand />
      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-[#0e1114]/88 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1480px] items-center justify-between px-5 sm:px-8 lg:px-12">
        <a className="flex min-w-0 items-center gap-3" href="#">
          <img alt="" aria-hidden="true" className="h-11 w-11 shrink-0 object-contain" src={logoUrl} />
          <span className="hidden truncate text-base font-black uppercase tracking-normal text-white min-[480px]:inline sm:text-2xl">
            TokenMaxxer
          </span>
        </a>

        <nav className="hidden items-center gap-9 text-sm font-semibold text-zinc-400 md:flex">
          <a className="transition hover:text-white" href="#providers">Providers</a>
          <a className="transition hover:text-white" href="#workflow">Workflow</a>
          <a className="transition hover:text-white" href="#security">Security</a>
          <a className="transition hover:text-white" href="#download">Download</a>
        </nav>

        <DownloadButton className="marketing-header-button hidden sm:inline-flex" />
      </div>
    </header>
  );
}

function DownloadButton({ className }: { className: string }) {
  return (
    <a
      aria-label="Download Windows installer for TokenMaxxer"
      className={className}
      download
      href={WINDOWS_DOWNLOAD_URL}
      rel="noreferrer"
    >
      <FaWindows aria-hidden="true" />
      Download Windows
    </a>
  );
}

const initialAccounts: AccountConfig[] = [
  { id: "1", label: "personal@openai", provider: "codex", authRef: "vault_codex" },
  { id: "2", label: "work@google-oauth", provider: "antigravity", authRef: "vault_antigravity" },
  { id: "3", label: "student-copilot", provider: "github_copilot", authRef: "vault_copilot" },
  { id: "4", label: "deepseek-payg", provider: "deepseek", authRef: "vault_deepseek" },
];

const initialSnapshots: Record<string, Snapshot> = {
  "1": {
    accountId: "1",
    timestamp: Date.now() - 300000,
    planName: "Codex Free Tier",
    accountDetail: "personal@openai",
    providerKind: "codex",
    windows: [
      {
        label: "5h window",
        usedPercent: 71,
        limitWindowSeconds: 18000,
        resetsAt: new Date(Date.now() + 2520000).toISOString(),
        models: [],
      }
    ],
    cost: {
      estimatedGbp: 0.85,
      tokensUsed: 42500,
      tokenBudget: 60000,
      ratePerMtuGbp: 20,
    },
    isStale: false,
    error: null,
  },
  "2": {
    accountId: "2",
    timestamp: Date.now() - 60000,
    planName: "Antigravity Pro",
    accountDetail: "work@google-oauth",
    providerKind: "antigravity",
    windows: [
      {
        label: "Weekly quota",
        usedPercent: 37,
        limitWindowSeconds: 604800,
        resetsAt: new Date(Date.now() + 259200000).toISOString(),
        models: [
          { label: "Gemini 1.5 Pro", modelId: "gemini-1.5-pro", vendor: "gemini", usedPercent: 45, resetTime: null },
          { label: "Gemini 1.5 Flash", modelId: "gemini-1.5-flash", vendor: "gemini", usedPercent: 25, resetTime: null },
        ],
      }
    ],
    cost: {
      estimatedGbp: 4.12,
      tokensUsed: 206000,
      tokenBudget: 500000,
      ratePerMtuGbp: 20,
    },
    isStale: false,
    error: null,
  },
  "3": {
    accountId: "3",
    timestamp: Date.now() - 450000,
    planName: "GitHub Copilot Student",
    accountDetail: "student-copilot",
    providerKind: "github_copilot",
    windows: [],
    cost: {
      estimatedGbp: 0,
      tokensUsed: 0,
      tokenBudget: 0,
      ratePerMtuGbp: 0,
    },
    isStale: false,
    error: null,
  },
  "4": {
    accountId: "4",
    timestamp: Date.now() - 120000,
    planName: "API Key Credits",
    accountDetail: "deepseek-payg",
    providerKind: "deepseek",
    balanceGbp: 18.42,
    windows: [],
    cost: {
      estimatedGbp: 1.58,
      tokensUsed: 79000,
      tokenBudget: 100000,
      ratePerMtuGbp: 20,
    },
    isStale: false,
    error: null,
  },
};

const generateMockEvents = () => {
  const events = [];
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  for (let i = 7; i >= 0; i--) {
    const timestamp = now - i * oneDay;
    events.push({
      timestamp,
      accountId: "1",
      tokensUsed: 12000 + Math.sin(i) * 5000,
      costGbp: 0.24 + Math.sin(i) * 0.1,
    });
    events.push({
      timestamp,
      accountId: "2",
      tokensUsed: 45000 + Math.cos(i) * 15000,
      costGbp: 0.90 + Math.cos(i) * 0.3,
    });
    events.push({
      timestamp,
      accountId: "4",
      tokensUsed: 8000 + Math.sin(i * 2) * 3000,
      costGbp: 0.16 + Math.sin(i * 2) * 0.06,
    });
  }
  return events;
};

function MockWizard({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, provider: ProviderKind) => void;
}) {
  const [provider, setProvider] = useState<ProviderKind>("codex");
  const [label, setLabel] = useState("");

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-4 rounded-b-xl">
      <div className="card w-full max-w-md p-5 bg-[#12161a] border border-zinc-800 rounded-xl shadow-2xl space-y-4 text-zinc-100">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Add Mock Account</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">✕</button>
        </div>
        
        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-zinc-400 font-semibold mb-1">Select Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderKind)}
              className="w-full bg-[#0e1114] border border-zinc-850 rounded-md p-2 text-zinc-200 focus:outline-none focus:border-zinc-700"
            >
              <option value="codex">Codex</option>
              <option value="antigravity">Antigravity</option>
              <option value="github_copilot">GitHub Copilot</option>
              <option value="deepseek">DeepSeek</option>
              <option value="z_ai">Z.ai</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-400 font-semibold mb-1">Account Label</label>
            <input
              type="text"
              placeholder="e.g. personal-key, work-auth"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-[#0e1114] border border-zinc-850 rounded-md p-2 text-zinc-200 focus:outline-none focus:border-zinc-700"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-3 py-1.5 border border-zinc-800 rounded-md hover:bg-zinc-800 text-zinc-300 transition">
              Cancel
            </button>
            <button
              onClick={() => {
                if (label.trim()) {
                  onAdd(label.trim(), provider);
                }
              }}
              className="px-3 py-1.5 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 font-bold rounded-md transition"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroPreview() {
  const [accounts, setAccounts] = useState<AccountConfig[]>(initialAccounts);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot>>(initialSnapshots);
  const [period, setPeriod] = useState<"day" | "week" | "month" | "year" | "all">("week");
  const [showWizard, setShowWizard] = useState(false);
  
  const historyEvents = useMemo(() => {
    return generateMockEvents();
  }, []);

  const handleRetry = (id: string) => {
    setSnapshots((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        timestamp: Date.now(),
        isStale: false,
        error: null,
      },
    }));
  };

  const handleRemove = (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setSnapshots((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  return (
    <div className="hero-preview relative flex items-start justify-center lg:justify-start w-full lg:pl-6">
      <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-[#090b0d] shadow-[0_32px_100px_rgba(0,0,0,0.65)] hover:border-zinc-700/40 transition-all duration-500 max-w-[820px] w-full">
        {/* Fake Window Header Bar */}
        <div className="flex h-10 items-center justify-between border-b border-zinc-900 bg-[#0b0d10] px-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 select-none">
            TokenMaxxer Native Dashboard
          </span>
          <div className="w-12" />
        </div>

        {/* Real Product UI Container forced to dark theme */}
        <div
          className="dark text-zinc-100 p-6 space-y-6 select-none bg-zinc-950/40"
          style={{
            colorScheme: "dark",
            "--bg": "#09090b",
            "--bg-elev": "#12161a",
            "--bg-elev-2": "#1b2026",
            "--border": "#21262d",
            "--border-strong": "#30363d",
            "--text": "#f0f6fc",
            "--text-muted": "#8b949e",
            "--text-faint": "#484f58",
            "--ring": "rgba(240, 246, 252, 0.15)",
            "--accent-color": "#f0f6fc",
            "--accent-text": "#0d1117",
          } as React.CSSProperties}
        >
          {/* Simulated App Header */}
          <header className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <Logo size="md" />
              {accounts.length > 0 && (
                <span className="hidden text-xs sm:inline text-zinc-400">
                  · {accounts.length} {accounts.length === 1 ? "account" : "accounts"}
                </span>
              )}
            </div>
            {accounts.length > 0 && (
              <button onClick={() => setShowWizard(true)} className="btn-primary">
                + Add Account
              </button>
            )}
          </header>

          {/* Chart Section */}
          {accounts.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-tight text-zinc-100">Usage Analytics</h2>
                
                {/* Period Selector Tabs */}
                <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
                  {(["day", "week", "month", "year", "all"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wider transition-all ${
                        period === p
                          ? "bg-zinc-800 text-zinc-100 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <UsageChart events={historyEvents} period={period} />
            </section>
          )}

          {/* Summary Tiles Row */}
          {accounts.length > 0 && (
            <SummaryTiles snapshots={snapshots} accountCount={accounts.length} />
          )}

          {/* Tracked Accounts Grid */}
          <section className="space-y-3">
            <h2 className="text-sm font-bold tracking-tight text-zinc-100">Tracked Accounts</h2>
            
            {accounts.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {accounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    snapshot={snapshots[account.id] ?? null}
                    onRetry={handleRetry}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            ) : (
              <div className="card border-zinc-800 bg-zinc-950 p-8 text-center rounded-xl">
                <h3 className="mx-auto max-w-md text-sm font-extrabold tracking-tight text-zinc-200">
                  No accounts tracked yet
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-xs text-zinc-500">
                  Add credentials to start monitoring your AI limits.
                </p>
                <button onClick={() => setShowWizard(true)} className="btn-primary mt-4">
                  + Add Account
                </button>
              </div>
            )}
          </section>

          {/* Mock Add Account Wizard overlay */}
          {showWizard && (
            <MockWizard
              onClose={() => setShowWizard(false)}
              onAdd={(name, provider) => {
                const newId = String(Date.now());
                const newAccount: AccountConfig = {
                  id: newId,
                  label: name,
                  provider,
                  authRef: `vault_${newId}`,
                };
                const newSnapshot: Snapshot = {
                  accountId: newId,
                  timestamp: Date.now(),
                  planName: `${provider.toUpperCase()} Custom Account`,
                  accountDetail: name,
                  providerKind: provider,
                  windows: [
                    {
                      label: "Standard Limit",
                      usedPercent: 10,
                      limitWindowSeconds: 3600,
                      resetsAt: new Date(Date.now() + 3600000).toISOString(),
                      models: [],
                    },
                  ],
                  cost: {
                    estimatedGbp: 0.1,
                    tokensUsed: 5000,
                    tokenBudget: 50000,
                    ratePerMtuGbp: 20,
                  },
                  isStale: false,
                  error: null,
                };
                setAccounts((prev) => [...prev, newAccount]);
                setSnapshots((prev) => ({ ...prev, [newId]: newSnapshot }));
                setShowWizard(false);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}



function ProofTile({ label, value, Icon }: { label: string; value: string; Icon: IconType }) {
  return (
    <div className="bg-[#0b0d0f] p-4">
      <Icon className="mb-4 h-5 w-5 text-indigo-400" aria-hidden="true" />
      <p className="text-sm font-bold text-white">{label}</p>
      <p className="mt-1 text-xs text-zinc-500">{value}</p>
    </div>
  );
}

function ProviderBand() {
  return (
    <section id="providers" className="border-y border-zinc-800/40 bg-zinc-950/20 backdrop-blur-sm py-12">
      <div className="mx-auto max-w-[1200px] px-5 text-center sm:px-8 lg:px-12">
        <p className="text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-6">
          Compatible with
        </p>
        
        <div className="flex flex-wrap justify-center items-center gap-x-10 gap-y-6">
          {compatibleProviders.map((prov) => (
            <span key={prov.name} title={prov.name}>
              <prov.Icon
                className="h-8 w-8 text-zinc-400"
                aria-hidden="true"
              />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section id="workflow" className="mx-auto max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12">
      <div className="grid gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
        <div>
          <h2 className="max-w-xl text-4xl font-black leading-tight tracking-normal text-white sm:text-5xl">
            Take control of your development workflow.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400">
            TokenMaxxer simplifies monitoring your AI accounts, keeping you in the flow instead of checking dashboards.
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 md:grid-cols-3">
          {workflow.map((item) => (
            <article className="bg-[#0b0d0f] p-6" key={item.title}>
              <item.Icon className="mb-8 h-8 w-8 text-amber-400" aria-hidden="true" />
              <h3 className="text-xl font-bold tracking-normal text-white">{item.title}</h3>
              <p className="mt-4 text-sm leading-7 text-zinc-400">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  return (
    <section id="security" className="bg-[#0b0d0f] border-t border-zinc-800/80">
      <div className="mx-auto grid max-w-[1480px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_0.9fr] lg:px-12">
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-950 p-6 shadow-2xl sm:p-10">
          <div className="absolute -left-16 -top-16 h-36 w-36 rounded-full bg-indigo-500/10 blur-[60px]" />
          <div className="absolute -bottom-16 -right-16 h-36 w-36 rounded-full bg-amber-500/5 blur-[60px]" />

          <div className="relative z-10">
            <div className="mb-8 flex items-center justify-between border-b border-zinc-800/60 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                  <TbShieldLock className="h-6 w-6" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Security Architecture</h3>
                  <p className="text-[11px] text-zinc-500">Your keys never leave your machine</p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                Encrypted
              </span>
            </div>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-850 text-zinc-400">
                  <TbLock className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Hardware-backed Encryption</h4>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    Your credentials stay in local secure storage: macOS Keychain, a DPAPI-encrypted Windows vault, or Linux Secret Service.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-850 text-zinc-400">
                  <TbActivityHeartbeat className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Direct-to-Provider Queries</h4>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    TokenMaxxer queries provider endpoints directly from your computer. No central server or middleman intercepts your tokens or checks your balance.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-850 text-zinc-400">
                  <TbChartBar className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Local-First Storage</h4>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    All analytics data, usage metrics, and historical logs stay inside a secure JSON database stored locally in your user application directory.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <h2 className="max-w-lg text-4xl font-black leading-tight tracking-normal text-white sm:text-5xl">
            Local-first by design.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400">
            The app runs on Windows, macOS, and Linux, keeps credentials in native secure storage, and reads provider usage directly from your machine.
          </p>
          <div className="mt-8 grid gap-4 text-sm text-zinc-300">
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
                ✓
              </span>
              No cloud accounts or hosting required.
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
                ✓
              </span>
              API credentials never leave your local workspace.
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
                ✓
              </span>
              Full source code is open and verifiable.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DownloadBand() {
  return (
    <section id="download" className="mx-auto max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12">
      <div className="download-band rounded-lg border border-indigo-500/30 p-6 sm:p-10">
        <div>
          <h2 className="text-3xl font-black leading-tight tracking-normal text-white sm:text-4xl">
            Download TokenMaxxer.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
            Platform installers are listed only when there is a published artifact
            for that operating system. Missing builds stay visible without sending
            you to a broken download.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {downloadOptions.map((option) => (
            <PlatformDownloadCard key={option.platform} option={option} />
          ))}
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <a className="marketing-secondary" href={RELEASES_URL} rel="noreferrer" target="_blank">
            <TbDownload aria-hidden="true" />
            Release notes
          </a>
          <a className="marketing-secondary" href={SOURCE_URL} rel="noreferrer" target="_blank">
            <FaGithub aria-hidden="true" />
            Build from source
          </a>
        </div>
      </div>
    </section>
  );
}

function PlatformDownloadCard({ option }: { option: DownloadOption }) {
  const { Icon } = option;
  const isAvailable = Boolean(option.href);

  return (
    <article className="download-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="download-card-icon">
            <Icon aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-lg font-black text-white">{option.platform}</h3>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {option.format}
            </p>
          </div>
        </div>
        <span className={isAvailable ? "download-status-available" : "download-status-missing"}>
          {isAvailable ? "Available" : "Not published"}
        </span>
      </div>

      <p className="mt-5 min-h-[3.5rem] text-sm leading-6 text-zinc-400">
        {option.detail}
      </p>

      {option.href ? (
        <a className="download-action" download href={option.href} rel="noreferrer">
          <TbDownload aria-hidden="true" />
          Download
        </a>
      ) : (
        <span aria-disabled="true" className="download-action download-action-disabled">
          <TbDownload aria-hidden="true" />
          Coming soon
        </span>
      )}
    </article>
  );
}

function Footer() {
  return (
    <footer className="border-t border-zinc-800 px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-4 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
        <span>TokenMaxxer</span>
        <a className="transition hover:text-zinc-200" href={SOURCE_URL} rel="noreferrer" target="_blank">
          GitHub
        </a>
      </div>
    </footer>
  );
}
