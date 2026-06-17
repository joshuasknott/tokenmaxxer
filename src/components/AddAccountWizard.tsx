import { useEffect, useState } from "react";
import type { ProviderDescriptor, ProviderKind } from "../types";
import { addAccount, listProviders } from "../lib/tauri";
import { ProviderLogo } from "./ProviderLogo";
import { providerStyle } from "../lib/providerStyle";

interface AddAccountWizardProps {
  onClose: () => void;
  onAdded: () => void;
  providersOverride?: ProviderDescriptor[];
}

type Step = "pick" | "credentials" | "working" | "done" | "error";

/** Map raw backend error strings to user-friendly messages. */
function friendlyError(raw: string): string {
  const s = raw.replace(/^Error:\s*/i, "");

  if (/missing client_secret/i.test(s) || /Missing client_secret/i.test(s)) {
    return (
      "Missing client_secret. The Antigravity IDE's token store does not include a client secret.\n\n" +
      'Option 1: Add "client_secret": "YOUR_SECRET" to the JSON you pasted.\n' +
      "Option 2: Set the TOKENMAXXER_GOOGLE_CLIENT_SECRET environment variable before launching TokenMaxxer."
    );
  }
  if (/google token refresh failed/i.test(s)) {
    return (
      "Google rejected the token refresh request. This usually means the refresh token is expired or revoked.\n\n" +
      "Try signing out and back in to Google in the Antigravity IDE, then re-run the decoder script."
    );
  }
  if (/unauthorized.*refresh token may be revoked/i.test(s)) {
    return (
      "The refresh token appears to be revoked. Sign in to Google in the Antigravity IDE again, " +
      "then re-run decode-antigravity-token.cjs to get a fresh token."
    );
  }
  if (/expected json with.*refresh_token/i.test(s)) {
    return (
      'Invalid credential format. The JSON must contain a "refresh_token" field.\n\n' +
      "If you ran decode-antigravity-token.cjs, paste the entire contents of antigravity-token.tmp.json."
    );
  }
  // Fall through: return the original error, prefixed for context.
  return s;
}

export function AddAccountWizard({
  onClose,
  onAdded,
  providersOverride,
}: AddAccountWizardProps) {
  const [providers, setProviders] = useState<ProviderDescriptor[]>(() => providersOverride ?? []);
  const [providersLoaded, setProvidersLoaded] = useState(() => Boolean(providersOverride));
  const [step, setStep] = useState<Step>("pick");
  const [provider, setProvider] = useState<ProviderKind | null>(null);
  
  // Input fields
  const [apiKey, setApiKey] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  // Token masking toggle for sensitive textareas (Antigravity, Codex)
  const [showSecret, setShowSecret] = useState(true);

  useEffect(() => {
    let active = true;

    if (providersOverride) {
      setProviders(providersOverride);
      setProvidersLoaded(true);
      return;
    }

    setProvidersLoaded(false);
    void listProviders()
      .then((items) => {
        if (active) setProviders(items);
      })
      .catch((e) => {
        if (active) setErrorMsg(String(e));
      })
      .finally(() => {
        if (active) setProvidersLoaded(true);
      });

    return () => {
      active = false;
    };
  }, [providersOverride]);

  function reset() {
    setStep("pick");
    setProvider(null);
    setApiKey("");
    setErrorMsg("");
    setShowSecret(true);
  }

  async function submit() {
    if (!provider) return;
    setStep("working");
    try {
      const creds = parseCredentials(provider, apiKey);
      const generatedLabel = defaultLabel(provider);
      await addAccount(generatedLabel, provider, creds);
      setStep("done");
      onAdded();
    } catch (e) {
      setErrorMsg(friendlyError(String(e)));
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
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === "pick" && (
          <div className="space-y-2">
            {providers.map((p) => {
              const style = providerStyle(p.kind);
              return (
                <button
                  key={p.kind}
                  onClick={() => {
                    setProvider(p.kind);
                    setStep("credentials");
                  }}
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition bg-zinc-50 dark:bg-zinc-900/40 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-800"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.chipBg}`}
                  >
                    <ProviderLogo kind={p.kind} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-xs text-zinc-900 dark:text-zinc-100">{p.displayName}</span>
                    <span
                      className="block text-[11px] mt-0.5"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {p.credentialDescription}
                    </span>
                  </span>
                </button>
              );
            })}
            {!providersLoaded && providers.length === 0 && (
              <p
                className="text-xs text-zinc-400 text-center py-4"
              >
                Loading providers...
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
              showSecret={showSecret}
              onToggleSecret={() => setShowSecret((v) => !v)}
            />
            
            <div className="flex justify-between pt-2">
              <button onClick={reset} className="btn-ghost">
                Back
              </button>
              <button
                onClick={submit}
                disabled={!apiKey.trim()}
                className="btn-primary"
              >
                Add Account
              </button>
            </div>
          </div>
        )}

        {step === "working" && (
          <p className="text-sm text-zinc-500 text-center py-6 font-medium">Validating and saving account...</p>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center py-4">
            <p className="text-sm text-zinc-900 dark:text-zinc-100 font-bold flex items-center justify-center gap-1.5">
              <svg className="h-4.5 w-4.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>Account successfully added</span>
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
            <div className="text-xs text-red-500 bg-red-500/5 border border-red-500/10 p-3 rounded-lg whitespace-pre-line">
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
  showSecret: boolean;
  onToggleSecret: () => void;
}

function CredentialInstructions({
  provider,
  apiKey,
  onChangeApiKey,
  showSecret,
  onToggleSecret,
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
            <li>Open <code className="bg-zinc-200 dark:bg-zinc-850 px-1 py-0.5 rounded font-mono text-[10px]">antigravity-token.tmp.json</code> and copy the entire JSON content.</li>
            <li>Paste the JSON content below.</li>
          </ol>
          <div className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 leading-normal border-t border-zinc-200/60 dark:border-zinc-800/60 pt-1.5 flex items-start gap-1">
            <svg className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>
              The decoded token does <strong>not</strong> include <code className="bg-zinc-200 dark:bg-zinc-850 px-1 py-0.5 rounded font-mono">client_secret</code>.
              Either add <code className="bg-zinc-200 dark:bg-zinc-850 px-1 py-0.5 rounded font-mono">"client_secret": "YOUR_SECRET"</code> to the JSON,
              or launch TokenMaxxer with the <code className="bg-zinc-200 dark:bg-zinc-850 px-1 py-0.5 rounded font-mono">TOKENMAXXER_GOOGLE_CLIENT_SECRET</code> environment variable set.
            </span>
          </div>
        </div>
        <div className="relative">
          <textarea
            value={apiKey}
            onChange={(e) => onChangeApiKey(e.target.value)}
            rows={5}
            placeholder={'{ "refresh_token": "1//...", "client_secret": "...", "access_token": "ya29...", "expires_at": 12345 }'}
            className={`w-full rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2 pr-16 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 text-zinc-900 dark:text-zinc-100 ${
              !showSecret && apiKey ? "text-transparent selection:text-transparent caret-zinc-400" : ""
            }`}
            style={!showSecret && apiKey ? ({ WebkitTextSecurity: "disc" } as unknown as React.CSSProperties) : undefined}
          />
          {apiKey && (
            <button
              type="button"
              onClick={onToggleSecret}
              className="absolute top-2 right-2 text-[10px] font-semibold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded"
            >
              {showSecret ? "Hide" : "Show"}
            </button>
          )}
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

function parseCredentials(provider: ProviderKind, key: string): unknown {
  const trimmed = key.trim();

  if (provider === "deepseek" || provider === "z_ai") {
    return trimmed;
  }

  // Codex / Antigravity expect JSON string
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error("Credentials must be valid JSON for this provider.");
  }

  // Antigravity-specific pre-validation: check the JSON shape before sending
  // to the backend, so the user gets an immediate, clear error.
  if (provider === "antigravity") {
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error(
        'Expected a JSON object with a "refresh_token" field.\n' +
        'Example: { "refresh_token": "1//...", "client_secret": "..." }'
      );
    }
    // Strip the "type" field if present (older script versions or gcloud ADC
    // files include "type": "authorized_user" which the backend doesn't need).
    if ("type" in parsed) {
      delete (parsed as Record<string, unknown>).type;
    }
    if (!parsed.refresh_token || typeof parsed.refresh_token !== "string") {
      const keys = Object.keys(parsed).join(", ") || "(empty)";
      throw new Error(
        `Missing required field "refresh_token" in the pasted JSON.\n` +
        `Found keys: ${keys}\n\n` +
        `Make sure you pasted the full contents of antigravity-token.tmp.json.`
      );
    }
  }

  return parsed;
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
  }
}
