import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { FiAlertTriangle, FiCheck, FiEye, FiEyeOff, FiLoader, FiX } from "react-icons/fi";
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

const RAW_KEY_PROVIDERS = new Set<ProviderKind>([
  "deepseek",
  "z_ai",
  "openrouter",
  "cursor",
  "contextual_ai",
]);

const ADMIN_KEY_PROVIDERS = new Set<ProviderKind>([
  "openai_api",
  "anthropic_api",
  "claude_code",
]);

const CONFIG_JSON_PROVIDERS = new Set<ProviderKind>([
  "x_ai",
  "aws_bedrock",
  "azure_openai",
  "fireworks",
]);

const instructionPanelClass =
  "rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)] p-3 text-xs leading-relaxed text-[var(--text-muted)]";
const instructionTitleClass = "font-semibold text-[var(--text)]";
const credentialFieldClass =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)] p-2 font-mono text-[11px] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]";
const inlineCodeClass =
  "rounded border border-[var(--border)] bg-[var(--bg-elev)] px-1 py-0.5 font-mono text-[10px] text-[var(--text)]";

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
  if (/OpenAI.*(401|403|invalid credentials|insufficient permissions|api\.usage\.read)/i.test(s)) {
    return (
      "OpenAI rejected the request. Use an organization Admin API key with usage and costs permissions; ordinary project API keys cannot read this report."
    );
  }
  if (/(Anthropic|Claude Code).*(401|403|invalid credentials|unauthorized|forbidden)/i.test(s)) {
    return (
      "Anthropic rejected the request. Use an organization admin key, not a personal Claude login or ordinary model API key."
    );
  }
  if (/Cursor.*(401|403|invalid credentials|unauthorized|forbidden)/i.test(s)) {
    return "Cursor rejected the request. Use a team Admin API key from a Teams or Enterprise workspace.";
  }
  if (/Contextual AI.*(401|403|invalid credentials|unauthorized|forbidden)/i.test(s)) {
    return "Contextual AI rejected the request. Use a tenant billing API key with billing access.";
  }
  if (/xAI.*(401|403|invalid credentials|unauthorized|forbidden)|xAI expects/i.test(s)) {
    return "xAI rejected the request. Use a Management API key JSON with the team_id; a normal Grok model API key cannot read billing.";
  }
  if (/AWS.*(401|403|invalid credentials|unauthorized|forbidden)|AWS .*required/i.test(s)) {
    return "AWS rejected the request. Use IAM credentials that can call CloudWatch GetMetricData for the AWS/Bedrock namespace.";
  }
  if (/Azure OpenAI.*(401|403|invalid credentials|unauthorized|forbidden)|Azure OpenAI expects/i.test(s)) {
    return "Azure rejected the request. Use an Azure management-plane bearer token and the resource_id for the Azure OpenAI or Foundry resource.";
  }
  if (/Fireworks.*(invalid credentials|firectl|CSV)/i.test(s)) {
    return "Fireworks could not read billing metrics. Provide a metrics_csv_path export, or install/login to firectl and include an API key if needed.";
  }
  if (/429|rate limit/i.test(s)) {
    return "The provider rate-limited the validation request. Wait a moment, then try again.";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-4">
      <div
        className="card flex max-h-[92vh] min-w-0 max-w-2xl flex-col overflow-hidden bg-[var(--bg-elev)] shadow-2xl"
        style={{ width: "min(100%, calc(100vw - 1.5rem))" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="min-w-0 px-5 pt-5">
            <h2 className="text-base font-bold tracking-tight">Add Account</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Pick a provider, paste credentials, then validate and store them locally.
            </p>
          </div>
          <button
            onClick={onClose}
            className="mr-4 mt-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-elev-2)] hover:text-[var(--text)]"
            aria-label="Close"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {step === "pick" && (
          <div className="grid gap-2 sm:grid-cols-2">
            {providers.map((p) => {
              const style = providerStyle(p.kind);
              return (
                <button
                  key={p.kind}
                  onClick={() => {
                    setProvider(p.kind);
                    setStep("credentials");
                  }}
                  className="flex min-h-[4.75rem] w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)] p-3 text-left transition hover:border-[var(--border-strong)]"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${style.chipBg}`}
                  >
                    <ProviderLogo kind={p.kind} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold">{p.displayName}</span>
                    <span
                      className="mt-0.5 block text-[11px] leading-relaxed text-[var(--text-muted)]"
                    >
                      {p.credentialDescription}
                    </span>
                  </span>
                </button>
              );
            })}
            {!providersLoaded && providers.length === 0 && (
              <div className="col-span-full rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-elev-2)] px-4 py-8 text-center text-xs font-medium text-[var(--text-muted)]">
                <FiLoader className="mx-auto mb-2 h-4 w-4 animate-spin" />
                Loading providers...
              </div>
            )}
            {providersLoaded && providers.length === 0 && errorMsg && (
              <div className="col-span-full rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs leading-relaxed text-red-400">
                {errorMsg}
              </div>
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
            
            <div className="flex justify-between border-t border-[var(--border)] pt-4">
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
          <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg-elev-2)] py-8 text-center text-sm font-medium text-[var(--text-muted)]">
            <FiLoader className="mx-auto mb-3 h-5 w-5 animate-spin" />
            Validating and saving account...
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center py-4">
            <p className="flex items-center justify-center gap-1.5 text-sm font-bold">
              <FiCheck className="h-5 w-5 text-emerald-500" />
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
            <div className="flex items-start gap-2 whitespace-pre-line rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs leading-relaxed text-red-400">
              <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
              {errorMsg}
              </span>
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
        <div className={`${instructionPanelClass} space-y-1.5`}>
          <p className={instructionTitleClass}>Step-by-step Setup Instructions:</p>
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Open a terminal (Command Prompt / PowerShell).</li>
            <li>Run: <code className={inlineCodeClass}>type %USERPROFILE%\.codex\auth.json</code></li>
            <li>Copy the entire JSON content block output.</li>
            <li>Paste it into the text box below.</li>
          </ol>
        </div>
        <textarea
          value={apiKey}
          onChange={(e) => onChangeApiKey(e.target.value)}
          rows={5}
          placeholder={'{ "tokens": { "access_token": "...", "refresh_token": "..." } }'}
          className={credentialFieldClass}
        />
      </div>
    );
  }

  if (provider === "antigravity") {
    return (
      <div className="space-y-3">
        <div className={`${instructionPanelClass} space-y-1.5`}>
          <p className={instructionTitleClass}>Step-by-step Setup Instructions:</p>
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Make sure you are logged into your Google account in the Antigravity IDE.</li>
            <li>Open a terminal in the project directory.</li>
            <li>Run: <code className={inlineCodeClass}>node decode-antigravity-token.cjs</code></li>
            <li>Open <code className={inlineCodeClass}>antigravity-token.tmp.json</code> and copy the entire JSON content.</li>
            <li>Paste the JSON content below.</li>
          </ol>
          <div className="mt-2 flex items-start gap-1 border-t border-[var(--border)] pt-1.5 text-[10px] leading-normal text-amber-400">
            <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              The decoded token does <strong>not</strong> include <code className={inlineCodeClass}>client_secret</code>.
              Either add <code className={inlineCodeClass}>"client_secret": "YOUR_SECRET"</code> to the JSON,
              or launch TokenMaxxer with the <code className={inlineCodeClass}>TOKENMAXXER_GOOGLE_CLIENT_SECRET</code> environment variable set.
            </span>
          </div>
        </div>
        <div className="relative">
          <textarea
            value={apiKey}
            onChange={(e) => onChangeApiKey(e.target.value)}
            rows={5}
            placeholder={'{ "refresh_token": "1//...", "client_secret": "...", "access_token": "ya29...", "expires_at": 12345 }'}
            className={`${credentialFieldClass} pr-16 ${
              !showSecret && apiKey ? "text-transparent selection:text-transparent caret-[var(--text-muted)]" : ""
            }`}
            style={!showSecret && apiKey ? ({ WebkitTextSecurity: "disc" } as unknown as CSSProperties) : undefined}
          />
          {apiKey && (
            <button
              type="button"
              onClick={onToggleSecret}
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--bg-elev)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--text)]"
            >
              {showSecret ? <FiEyeOff className="h-3 w-3" /> : <FiEye className="h-3 w-3" />}
              {showSecret ? "Hide" : "Show"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (ADMIN_KEY_PROVIDERS.has(provider)) {
    const adminCopy = adminProviderCopy(provider);
    return (
      <div className="space-y-3">
        <div className={`${instructionPanelClass} space-y-1.5`}>
          <p className={instructionTitleClass}>Step-by-step Setup Instructions:</p>
          {adminCopy.steps}
          <p className="pt-1 text-[11px] text-[var(--text-muted)]">
            Paste the key directly, or use JSON if you want filters.
          </p>
        </div>
        <textarea
          value={apiKey}
          onChange={(e) => onChangeApiKey(e.target.value)}
          rows={5}
          placeholder={adminCopy.placeholder}
          className={credentialFieldClass}
        />
      </div>
    );
  }

  if (CONFIG_JSON_PROVIDERS.has(provider)) {
    const configCopy = configProviderCopy(provider);
    return (
      <div className="space-y-3">
        <div className={`${instructionPanelClass} space-y-1.5`}>
          <p className={instructionTitleClass}>Step-by-step Setup Instructions:</p>
          {configCopy.steps}
        </div>
        <textarea
          value={apiKey}
          onChange={(e) => onChangeApiKey(e.target.value)}
          rows={5}
          placeholder={configCopy.placeholder}
          className={credentialFieldClass}
        />
      </div>
    );
  }

  const rawCopy = rawProviderCopy(provider);

  return (
    <div className="space-y-3">
      <div className={`${instructionPanelClass} space-y-1.5`}>
        <p className={instructionTitleClass}>Step-by-step Setup Instructions:</p>
        {rawCopy.steps}
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-[var(--text-muted)]">
          {rawCopy.label}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => onChangeApiKey(e.target.value)}
          placeholder={rawCopy.placeholder}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elev-2)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
        />
      </div>
    </div>
  );
}

function adminProviderCopy(provider: ProviderKind): {
  steps: ReactNode;
  placeholder: string;
} {
  switch (provider) {
    case "openai_api":
      return {
        steps: (
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Create an OpenAI organization Admin API key.</li>
            <li>Make sure it can read organization usage and costs.</li>
            <li>Optional: add a project filter with <code className={inlineCodeClass}>project_id</code>.</li>
          </ol>
        ),
        placeholder: '{ "admin_api_key": "sk-admin-...", "project_id": "proj_...", "start_days_ago": 30 }',
      };
    case "anthropic_api":
      return {
        steps: (
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Create an Anthropic organization admin key.</li>
            <li>Use a key with usage and cost report access.</li>
            <li>Optional: include <code className={inlineCodeClass}>workspace_id</code> for display.</li>
          </ol>
        ),
        placeholder: '{ "admin_api_key": "sk-ant-admin-...", "workspace_id": "wrk_...", "start_days_ago": 30 }',
      };
    case "claude_code":
      return {
        steps: (
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Create an Anthropic organization admin key.</li>
            <li>Use an organization that has Claude Code analytics available.</li>
            <li>Optional: set <code className={inlineCodeClass}>limit</code> for returned daily rows.</li>
          </ol>
        ),
        placeholder: '{ "admin_api_key": "sk-ant-admin-...", "start_days_ago": 30, "limit": 100 }',
      };
    default:
      return {
        steps: null,
        placeholder: "",
      };
  }
}

function rawProviderCopy(provider: ProviderKind): {
  steps: ReactNode;
  label: string;
  placeholder: string;
} {
  switch (provider) {
    case "deepseek":
      return {
        steps: (
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Log in to platform.deepseek.com.</li>
            <li>Go to API Keys on the dashboard.</li>
            <li>Create and copy your API key.</li>
          </ol>
        ),
        label: "API Key",
        placeholder: "sk-...",
      };
    case "z_ai":
      return {
        steps: (
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Log in to z.ai.</li>
            <li>Navigate to Manage API Key.</li>
            <li>Copy your GLM Coding Plan key.</li>
          </ol>
        ),
        label: "API Key",
        placeholder: "sk-...",
      };
    case "openrouter":
      return {
        steps: (
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Create an OpenRouter API key.</li>
            <li>Use a management key if you want full account credits.</li>
            <li>Ordinary keys can still report their key-level limit and usage.</li>
          </ol>
        ),
        label: "OpenRouter Key",
        placeholder: "sk-or-v1-...",
      };
    case "cursor":
      return {
        steps: (
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Open Cursor team settings.</li>
            <li>Create a team Admin API key.</li>
            <li>Use a Teams or Enterprise workspace; personal accounts do not expose this report.</li>
          </ol>
        ),
        label: "Cursor Admin API Key",
        placeholder: "crsr_...",
      };
    case "contextual_ai":
      return {
        steps: (
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Create or copy a Contextual AI API key with billing access.</li>
            <li>The app reads tenant balance and the current month's usage.</li>
            <li>Use JSON later if you need a custom base URL or month.</li>
          </ol>
        ),
        label: "Contextual AI API Key",
        placeholder: "ctx_...",
      };
    default:
      return {
        steps: null,
        label: "API Key",
        placeholder: "sk-...",
      };
  }
}

function configProviderCopy(provider: ProviderKind): {
  steps: ReactNode;
  placeholder: string;
} {
  switch (provider) {
    case "x_ai":
      return {
        steps: (
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Create an xAI Management API key.</li>
            <li>Copy the team id from the xAI team settings or billing URL.</li>
            <li>Paste JSON with both values; model API keys cannot read billing.</li>
          </ol>
        ),
        placeholder: '{ "management_key": "xai-mgmt-...", "team_id": "team_...", "start_days_ago": 30 }',
      };
    case "aws_bedrock":
      return {
        steps: (
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Create or choose IAM credentials with CloudWatch GetMetricData access.</li>
            <li>Set the AWS region where Bedrock usage is reported.</li>
            <li>The app reads token metrics from the <code className={inlineCodeClass}>AWS/Bedrock</code> namespace.</li>
          </ol>
        ),
        placeholder: '{ "access_key_id": "AKIA...", "secret_access_key": "...", "region": "us-east-1", "start_days_ago": 30 }',
      };
    case "azure_openai":
      return {
        steps: (
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Get an Azure management bearer token from Azure CLI or Entra ID.</li>
            <li>Copy the resource id for the Azure OpenAI or AI Foundry resource.</li>
            <li>The app reads token totals from Azure Monitor metrics.</li>
          </ol>
        ),
        placeholder: '{ "access_token": "eyJ...", "resource_id": "/subscriptions/.../providers/Microsoft.CognitiveServices/accounts/...", "start_days_ago": 30 }',
      };
    case "fireworks":
      return {
        steps: (
          <ol className="list-decimal list-inside space-y-1 pl-1">
            <li>Export Fireworks billing metrics with <code className={inlineCodeClass}>firectl billing export-metrics</code>, or install/login to firectl.</li>
            <li>Paste a CSV path for offline import, or paste an API key and let firectl export.</li>
            <li>The app sums prompt and completion token columns from the billing export.</li>
          </ol>
        ),
        placeholder: '{ "metrics_csv_path": "C:/Users/you/Downloads/fireworks-metrics.csv" }\n\n{ "api_key": "fw_...", "firectl_path": "firectl", "start_days_ago": 30 }',
      };
    default:
      return { steps: null, placeholder: "" };
  }
}

function parseCredentials(provider: ProviderKind, key: string): unknown {
  const trimmed = key.trim();

  if (RAW_KEY_PROVIDERS.has(provider)) {
    if (trimmed.startsWith("{")) {
      const parsed = parseJsonObject(trimmed);
      if (!hasAnyStringField(parsed, ["api_key", "admin_api_key", "key", "token", "management_key", "cursor_api_key", "contextual_api_key"])) {
        throw new Error('Expected JSON with an "api_key" field, or paste the API key directly.');
      }
      return parsed;
    }
    return trimmed;
  }

  if (ADMIN_KEY_PROVIDERS.has(provider)) {
    if (!trimmed.startsWith("{")) {
      return trimmed;
    }
    const parsed = parseJsonObject(trimmed);
    if (!hasAnyStringField(parsed, ["admin_api_key", "api_key", "openai_admin_key", "anthropic_admin_key"])) {
      throw new Error('Expected JSON with an "admin_api_key" field, or paste the admin key directly.');
    }
    return parsed;
  }

  if (CONFIG_JSON_PROVIDERS.has(provider)) {
    const parsed = parseJsonObject(trimmed);
    switch (provider) {
      case "x_ai":
        if (
          !hasAnyStringField(parsed, ["management_key", "api_key", "token"]) ||
          !hasAnyStringField(parsed, ["team_id"])
        ) {
          throw new Error('Expected JSON with "management_key" and "team_id".');
        }
        break;
      case "aws_bedrock":
        if (
          !hasAnyStringField(parsed, ["access_key_id", "aws_access_key_id"]) ||
          !hasAnyStringField(parsed, ["secret_access_key", "aws_secret_access_key"])
        ) {
          throw new Error('Expected JSON with "access_key_id" and "secret_access_key".');
        }
        break;
      case "azure_openai":
        if (
          !hasAnyStringField(parsed, ["access_token", "bearer_token", "azure_access_token"]) ||
          !hasAnyStringField(parsed, ["resource_id"])
        ) {
          throw new Error('Expected JSON with "access_token" and "resource_id".');
        }
        break;
      case "fireworks":
        if (
          !hasAnyStringField(parsed, ["metrics_csv_path", "csv_path"]) &&
          !hasAnyStringField(parsed, ["api_key", "fireworks_api_key", "token"])
        ) {
          throw new Error('Expected JSON with "metrics_csv_path" or a Fireworks "api_key".');
        }
        break;
    }
    return parsed;
  }

  // Codex / Antigravity expect JSON string
  const parsed = parseJsonObject(trimmed);

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

function parseJsonObject(text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Credentials must be valid JSON for this provider.");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Credentials must be a JSON object for this provider.");
  }
  return parsed as Record<string, unknown>;
}

function hasAnyStringField(obj: Record<string, unknown>, fields: string[]): boolean {
  return fields.some((field) => typeof obj[field] === "string" && Boolean((obj[field] as string).trim()));
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
    case "openrouter":
      return "OpenRouter Account";
    case "openai_api":
      return "OpenAI API Account";
    case "anthropic_api":
      return "Anthropic API Account";
    case "claude_code":
      return "Claude Code Account";
    case "cursor":
      return "Cursor Team Account";
    case "contextual_ai":
      return "Contextual AI Account";
    case "x_ai":
      return "xAI Account";
    case "aws_bedrock":
      return "Bedrock Account";
    case "azure_openai":
      return "Azure OpenAI Account";
    case "fireworks":
      return "Fireworks Account";
  }
}
