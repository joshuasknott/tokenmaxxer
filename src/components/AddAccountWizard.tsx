import { useState } from "react";
import type { ProviderDescriptor, ProviderKind } from "../types";
import { addAccount, listProviders } from "../lib/tauri";

interface AddAccountWizardProps {
  onClose: () => void;
  onAdded: () => void;
}

type Step = "pick" | "credentials" | "working" | "done" | "error";

export function AddAccountWizard({ onClose, onAdded }: AddAccountWizardProps) {
  const [providers, setProviders] = useState<ProviderDescriptor[]>([]);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [provider, setProvider] = useState<ProviderKind | null>(null);
  
  // Input fields
  const [apiKey, setApiKey] = useState("");
  const [githubOrg, setGithubOrg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  if (!providersLoaded) {
    setProvidersLoaded(true);
    void listProviders()
      .then(setProviders)
      .catch((e) => setErrorMsg(String(e)));
  }

  function reset() {
    setStep("pick");
    setProvider(null);
    setApiKey("");
    setGithubOrg("");
    setErrorMsg("");
  }

  async function submit() {
    if (!provider) return;
    setStep("working");
    try {
      const creds = parseCredentials(provider, apiKey, githubOrg);
      const generatedLabel = defaultLabel(provider);
      await addAccount(generatedLabel, provider, creds);
      setStep("done");
      onAdded();
    } catch (e) {
      setErrorMsg(String(e));
      setStep("error");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-lg p-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Add Account</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-sm font-semibold p-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {step === "pick" && (
          <div className="space-y-2">
            {providers.map((p) => (
              <button
                key={p.kind}
                onClick={() => {
                  setProvider(p.kind);
                  setStep("credentials");
                }}
                className="block w-full rounded-lg p-3 text-left transition bg-zinc-50 dark:bg-zinc-900/40 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800"
              >
                <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">{p.displayName}</div>
                <div
                  className="text-[11px] mt-0.5"
                  style={{ color: "var(--text-muted)" }}
                >
                  {p.credentialDescription}
                </div>
              </button>
            ))}
            {providers.length === 0 && (
              <p
                className="text-xs text-zinc-400 text-center py-4"
              >
                Loading providers…
              </p>
            )}
          </div>
        )}

        {(step === "credentials") && provider && (
          <div className="space-y-4">
            <CredentialInstructions
              provider={provider}
              apiKey={apiKey}
              onChangeApiKey={setApiKey}
              githubOrg={githubOrg}
              onChangeOrg={setGithubOrg}
            />
            
            <div className="flex justify-between pt-2">
              <button onClick={reset} className="btn-ghost">
                Back
              </button>
              <button
                onClick={submit}
                disabled={!apiKey.trim() && provider !== "github_copilot"}
                className="btn-primary"
              >
                Add Account
              </button>
            </div>
          </div>
        )}

        {step === "working" && (
          <p className="text-sm text-zinc-500 text-center py-6 font-medium">Validating and saving account…</p>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center py-4">
            <p className="text-sm text-zinc-900 dark:text-zinc-100 font-bold">
              ✓ Account successfully added
            </p>
            <div className="flex justify-center">
              <button onClick={onClose} className="btn-primary">
                Done
              </button>
            </div>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-4">
            <div className="text-xs text-red-500 bg-red-500/5 border border-red-500/10 p-3 rounded-lg">
              {errorMsg}
            </div>
            <div className="flex justify-between">
              <button onClick={reset} className="btn-ghost">
                Start over
              </button>
              <button onClick={onClose} className="btn-ghost">
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface CredentialInstructionsProps {
  provider: ProviderKind;
  apiKey: string;
  onChangeApiKey: (v: string) => void;
  githubOrg: string;
  onChangeOrg: (v: string) => void;
}

function CredentialInstructions({
  provider,
  apiKey,
  onChangeApiKey,
  githubOrg,
  onChangeOrg,
}: CredentialInstructionsProps) {
  if (provider === "codex") {
    return (
      <div className="space-y-3">
        <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5 text-zinc-600 dark:text-zinc-400">
          <p className="font-semibold text-zinc-950 dark:text-zinc-100">Step-by-step Setup Instructions:</p>
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Open a terminal (Command Prompt / PowerShell).</li>
            <li>Run: <code className="bg-zinc-200 dark:bg-zinc-850 px-1 py-0.5 rounded font-mono text-[10px]">type %USERPROFILE%\.codex\auth.json</code></li>
            <li>Copy the entire JSON content block output.</li>
            <li>Paste it into the text box below.</li>
          </ol>
        </div>
        <textarea
          value={apiKey}
          onChange={(e) => onChangeApiKey(e.target.value)}
          rows={5}
          placeholder={'{ "tokens": { "access_token": "...", "refresh_token": "..." } }'}
          className="w-full rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-zinc-900 dark:text-zinc-100"
        />
      </div>
    );
  }

  if (provider === "antigravity") {
    return (
      <div className="space-y-3">
        <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5 text-zinc-600 dark:text-zinc-400">
          <p className="font-semibold text-zinc-950 dark:text-zinc-100">Step-by-step Setup Instructions:</p>
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Make sure you are logged into your Google account in the Antigravity IDE.</li>
            <li>Open a terminal in the project directory.</li>
            <li>Run: <code className="bg-zinc-200 dark:bg-zinc-850 px-1 py-0.5 rounded font-mono text-[10px]">node decode-antigravity-token.cjs</code></li>
            <li>Copy the entire JSON content block written to the temporary file.</li>
            <li>Paste the JSON content below, including <code className="bg-zinc-200 dark:bg-zinc-850 px-1 py-0.5 rounded font-mono text-[10px]">client_secret</code> unless the app was launched with <code className="bg-zinc-200 dark:bg-zinc-850 px-1 py-0.5 rounded font-mono text-[10px]">TOKENMAXXER_GOOGLE_CLIENT_SECRET</code>.</li>
          </ol>
        </div>
        <textarea
          value={apiKey}
          onChange={(e) => onChangeApiKey(e.target.value)}
          rows={5}
          placeholder={'{ "refresh_token": "...", "client_secret": "...", "email": "you@gmail.com" }'}
          className="w-full rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-zinc-900 dark:text-zinc-100"
        />
      </div>
    );
  }

  if (provider === "github_copilot") {
    return (
      <div className="space-y-3">
        <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5 text-zinc-600 dark:text-zinc-400">
          <p className="font-semibold text-zinc-950 dark:text-zinc-100">Step-by-step Setup Instructions:</p>
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Go to GitHub settings &gt; **Developer settings** &gt; **Personal access tokens**.</li>
            <li>Generate a token (classic) with <code className="bg-zinc-200 dark:bg-zinc-850 px-1 py-0.5 rounded font-mono text-[10px]">read:org</code> scope.</li>
            <li>Copy the generated token and paste it in the field below.</li>
            <li>Optional: Enter organization name to track corporate seat counts.</li>
          </ol>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              GitHub Personal Access Token (PAT)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => onChangeApiKey(e.target.value)}
              placeholder="Paste GitHub token"
              className="w-full rounded-lg px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-zinc-900 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Organization Name (Optional)
            </label>
            <input
              value={githubOrg}
              onChange={(e) => onChangeOrg(e.target.value)}
              placeholder="e.g. google"
              className="w-full rounded-lg px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>
      </div>
    );
  }

  // DeepSeek or Z.ai
  const platformSteps = provider === "deepseek" ? (
    <ol className="list-decimal list-inside space-y-1 pl-1">
      <li>Log in to platform.deepseek.com.</li>
      <li>Go to **API Keys** on the dashboard.</li>
      <li>Create and copy your API key (starts with <code className="bg-zinc-200 dark:bg-zinc-850 px-1 py-0.5 rounded font-mono text-[10px]">sk-</code>).</li>
    </ol>
  ) : (
    <ol className="list-decimal list-inside space-y-1 pl-1">
      <li>Log in to z.ai.</li>
      <li>Navigate to **Manage API Key**.</li>
      <li>Copy your GLM Coding Plan key.</li>
    </ol>
  );

  return (
    <div className="space-y-3">
      <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5 text-zinc-600 dark:text-zinc-400">
        <p className="font-semibold text-zinc-950 dark:text-zinc-100">Step-by-step Setup Instructions:</p>
        {platformSteps}
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-zinc-500 dark:text-zinc-400">
          API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => onChangeApiKey(e.target.value)}
          placeholder="sk-..."
          className="w-full rounded-lg px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-zinc-900 dark:text-zinc-100"
        />
      </div>
    </div>
  );
}

function parseCredentials(provider: ProviderKind, key: string, org: string): unknown {
  const trimmed = key.trim();
  if (provider === "github_copilot") {
    return { token: trimmed, org: org.trim() || null };
  }
  
  if (provider === "deepseek" || provider === "z_ai") {
    return trimmed;
  }

  // Codex / Antigravity expect JSON string
  try {
    return JSON.parse(trimmed);
  } catch {
    throw new Error("Credentials must be valid JSON for this provider.");
  }
}

function defaultLabel(provider: ProviderKind): string {
  switch (provider) {
    case "codex":
      return "Codex Account";
    case "antigravity":
      return "Antigravity Account";
    case "deepseek":
      return "DeepSeek Account";
    case "z_ai":
      return "Z.ai Account";
    case "github_copilot":
      return "GitHub Copilot";
  }
}
