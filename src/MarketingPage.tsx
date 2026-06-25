import { useState, type ReactNode } from "react";
import type { IconType } from "react-icons";
import { FaApple, FaGithub, FaLinux, FaWindows } from "react-icons/fa";
import {
  FiArrowRight,
  FiClock,
  FiHardDrive,
  FiLock,
} from "react-icons/fi";
import { TbChevronDown, TbDownload, TbExternalLink } from "react-icons/tb";
import { LogoMark } from "./components/Logo";
import { ProviderLogo } from "./components/ProviderLogo";
import changelog from "./generated/changelog";
import type { ProviderKind } from "./types";

const SOURCE_URL = "https://github.com/joshuasknott/tokenmaxxer";
const LATEST_DOWNLOAD_URL = `${SOURCE_URL}/releases/latest/download`;
const CHANGELOG_URL = "/changelog";
const PRIVACY_URL = "/privacy";
const TERMS_URL = "/terms";
const PRODUCT_SHOT_URL = "/tokenmaxxer-product-shot.png";
const PRODUCT_DEMO_URL = "/tokenmaxxer-demo.mp4";
const ADD_ACCOUNT_SHOT_URL = "/tokenmaxxer-add-account-shot.png";
const ACCOUNT_DETAILS_SHOT_URL = "/tokenmaxxer-account-details-shot.png";
const releaseAssetUrl = (assetName: string) =>
  `${LATEST_DOWNLOAD_URL}/${assetName}`;

type PlatformOption = {
  platform: string;
  artifact: string;
  copy: string;
  href: string;
  Icon: IconType;
};

type ProductStory = {
  step: string;
  title: string;
  copy: string;
  image: string;
  alt: string;
  caption: string;
};

type TrackingRow = {
  label: string;
  copy: string;
};

type LegalSection = {
  heading: string;
  body: ReactNode;
};

type ProviderCoverage = {
  kind: ProviderKind;
  name: string;
  copy: string;
};

const platformOptions: PlatformOption[] = [
  {
    platform: "Windows",
    artifact: "NSIS installer",
    copy: "Download for Windows",
    href: releaseAssetUrl("TokenMaxxer-Windows-x64-setup.exe"),
    Icon: FaWindows,
  },
  {
    platform: "macOS",
    artifact: "Universal DMG",
    copy: "Download for macOS",
    href: releaseAssetUrl("TokenMaxxer-macOS-universal.dmg"),
    Icon: FaApple,
  },
  {
    platform: "Linux",
    artifact: "AppImage",
    copy: "Download for Linux",
    href: releaseAssetUrl("TokenMaxxer-Linux-x86_64.AppImage"),
    Icon: FaLinux,
  },
];

const providerCoverage: ProviderCoverage[] = [
  {
    kind: "codex",
    name: "Codex / ChatGPT",
    copy: "Quota windows, reset countdowns, plan context, and account identity.",
  },
  {
    kind: "antigravity",
    name: "Google Antigravity",
    copy: "Gemini, Claude, and GPT model-window usage from connector exports.",
  },
  {
    kind: "deepseek",
    name: "DeepSeek API",
    copy: "API key balance and usage snapshots.",
  },
  {
    kind: "z_ai",
    name: "Z.ai",
    copy: "GLM coding plan key usage and balance checks.",
  },
  {
    kind: "openrouter",
    name: "OpenRouter",
    copy: "Credit balance, key limit, and usage data.",
  },
  {
    kind: "openai_api",
    name: "OpenAI API",
    copy: "Organization usage and cost reports from admin access.",
  },
  {
    kind: "anthropic_api",
    name: "Anthropic API",
    copy: "Organization usage and cost reports from admin access.",
  },
  {
    kind: "claude_code",
    name: "Claude Code",
    copy: "Team analytics from Anthropic organization reporting.",
  },
  {
    kind: "cursor",
    name: "Cursor Teams",
    copy: "Team usage events and spend from admin API access.",
  },
  {
    kind: "contextual_ai",
    name: "Contextual AI",
    copy: "Tenant balance and current-month usage.",
  },
  {
    kind: "x_ai",
    name: "xAI / Grok",
    copy: "Team billing through the xAI Management API.",
  },
  {
    kind: "aws_bedrock",
    name: "Amazon Bedrock",
    copy: "Bedrock token metrics from CloudWatch.",
  },
  {
    kind: "azure_openai",
    name: "Azure OpenAI",
    copy: "Token totals from Azure Monitor metrics.",
  },
  {
    kind: "fireworks",
    name: "Fireworks AI",
    copy: "Billing metrics imported from Fireworks exports.",
  },
];

const providerCount = providerCoverage.length;

const productStories: ProductStory[] = [
  {
    step: "Dashboard",
    title: "Compare every configured account before you start.",
    copy: `The main board shows provider accounts, quota windows, reset countdowns, credits, estimated spend, token totals, refresh state, and the global trend. The demo data includes all ${providerCount} supported provider surfaces, so the account count and provider mix reflect the current app.`,
    image: PRODUCT_SHOT_URL,
    alt: "TokenMaxxer dashboard showing provider cards, quota reset windows, provider mix, and global usage trend.",
    caption:
      "The dashboard is the decision screen: it shows which accounts still have quota or balance before a long AI run.",
  },
  {
    step: "Add Account",
    title: "Pick a provider and validate the credential before saving.",
    copy: "The Add Account flow lists every supported provider. After you choose one, TokenMaxxer asks for the credential format that provider needs, validates the provider response, and stores the secret in the operating system vault.",
    image: ADD_ACCOUNT_SHOT_URL,
    alt: "TokenMaxxer add account flow with provider selection and credential validation.",
    caption:
      "The provider picker is where users can see Codex, Antigravity, API key providers, admin-report providers, and cloud metric providers in one place.",
  },
  {
    step: "Account Details",
    title: "Open one account when you need the underlying history.",
    copy: "Account details show the quota windows behind a card, model and vendor breakdowns when a provider reports them, exact reset timestamps, and the usage history for that account.",
    image: ACCOUNT_DETAILS_SHOT_URL,
    alt: "TokenMaxxer account detail modal showing quota windows, model breakdown, and historical usage chart.",
    caption:
      "The detail view explains why a card looks available, stale, expensive, or close to reset.",
  },
];

const trackingRows: TrackingRow[] = [
  {
    label: "Quota windows and resets",
    copy: "For providers that expose subscription windows, TokenMaxxer shows the percentage available and the next reset time.",
  },
  {
    label: "Balances, credits, tokens, and spend",
    copy: "For API, admin, cloud, and import-based providers, the board records balances, token totals, and estimated costs when those fields are available.",
  },
  {
    label: "Refresh health",
    copy: "Each account shows whether the latest fetch is fresh, stale, failed, or using cached data, so you know when a number needs attention.",
  },
  {
    label: "Local usage history",
    copy: "Snapshots and usage events stay on this machine and power the day, week, month, year, and all-time views.",
  },
];

const securityRows = [
  ["Credentials", "Stored in OS secure storage where available."],
  ["Configuration", "Account labels and provider settings live in local config."],
  ["History", "Usage events and cost estimates stay in local history files."],
  ["Updates", "Signed release checks happen through GitHub and Tauri."],
];

export function MarketingPage() {
  return (
    <main className="marketing-page">
      <SiteNav />

      <section className="marketing-hero" aria-labelledby="hero-title">
        <div className="hero-shell">
          <div className="hero-copy">
            <h1 id="hero-title">See which AI account has quota left.</h1>
            <p>
              TokenMaxxer is a local desktop app for tracking AI provider
              limits. It reads the accounts you configure and shows reset
              windows, balances, token use, estimated spend, refresh state, and
              usage history in one board.
            </p>
            <div className="hero-actions" aria-label="Primary actions">
              <a className="hero-primary-action" href="#download">
                <TbDownload aria-hidden="true" />
                Download
              </a>
              <a
                className="hero-secondary-action"
                href={SOURCE_URL}
                rel="noreferrer"
                target="_blank"
              >
                <FaGithub aria-hidden="true" />
                View source
                <TbExternalLink aria-hidden="true" />
              </a>
            </div>
            <div className="hero-proof-grid" aria-label="Product guarantees">
              <span>
                <FiLock aria-hidden="true" />
                No TokenMaxxer account
              </span>
              <span>
                <FiHardDrive aria-hidden="true" />
                Local credential vault
              </span>
              <span>
                <FiClock aria-hidden="true" />
                {providerCount} provider surfaces
              </span>
            </div>
          </div>

          <HeroProductVideo />
        </div>
      </section>

      <section id="product" className="marketing-section product-overview">
        <div className="section-heading">
          <h2>How the product works.</h2>
          <p>
            TokenMaxxer has one main job: help you decide which AI account can
            handle the next run. The screenshots below are rendered from the
            same React product screens used by the app demo.
          </p>
        </div>

        <div className="product-story-stack" aria-label="TokenMaxxer product walkthrough">
          {productStories.map((story) => (
            <article className="product-story" key={story.title}>
              <div className="product-story-copy">
                <span>{story.step}</span>
                <h3>{story.title}</h3>
                <p>{story.copy}</p>
              </div>
              <figure className="product-story-media">
                <img alt={story.alt} src={story.image} />
                <figcaption>{story.caption}</figcaption>
              </figure>
            </article>
          ))}
        </div>
      </section>

      <section id="tracks" className="marketing-section tracking-section">
        <div className="section-heading">
          <h2>What TokenMaxxer tracks.</h2>
          <p>
            Providers expose different kinds of quota and billing data.
            TokenMaxxer normalizes those fields into the same local interface
            instead of sending you to a separate dashboard for each account.
          </p>
        </div>

        <div className="tracking-list">
          {trackingRows.map((row) => (
            <article className="tracking-row" key={row.label}>
              <h3>{row.label}</h3>
              <p>{row.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="providers" className="marketing-section provider-section">
        <div className="section-heading">
          <h2>Supported providers.</h2>
          <p>
            TokenMaxxer currently supports {providerCount} provider surfaces
            across subscriptions, API keys, admin reports, cloud metrics, and
            imported usage exports.
          </p>
        </div>

        <div className="provider-list" aria-label="Supported TokenMaxxer providers">
          {providerCoverage.map((provider) => (
            <article className="provider-row" key={provider.kind}>
              <span className="provider-row-logo">
                <ProviderLogo kind={provider.kind} className="h-5 w-5" />
              </span>
              <div>
                <h3>{provider.name}</h3>
                <p>{provider.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="security" className="marketing-section security-section">
        <div className="security-layout">
          <div className="security-copy">
            <h2>Your data stays on this machine.</h2>
            <p>
              TokenMaxxer contacts provider APIs directly from your desktop. It
              has no hosted TokenMaxxer account, analytics pipeline, or cloud
              dashboard to sign in to.
            </p>
            <a href={PRIVACY_URL}>
              Read privacy details
              <FiArrowRight aria-hidden="true" />
            </a>
          </div>

          <div className="security-table" role="table" aria-label="Local-first data model">
            {securityRows.map(([label, value]) => (
              <div role="row" key={label}>
                <span role="cell">{label}</span>
                <strong role="cell">{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <DownloadSection />

      <MarketingFooter />
    </main>
  );
}

function HeroProductVideo() {
  const [videoFailed, setVideoFailed] = useState(false);

  return (
    <figure className="hero-product-video" aria-label="TokenMaxxer product walkthrough video preview">
      <div className="demo-window-bar">
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <strong>TokenMaxxer / Quota Board</strong>
      </div>

      <div className="hero-video-stage">
        {videoFailed ? (
          <img
            alt="TokenMaxxer dashboard showing provider cards, reset windows, and global usage trend."
            src={PRODUCT_SHOT_URL}
          />
        ) : (
          <video
            aria-label="TokenMaxxer demo video showing the quota board, add account flow, and account details."
            autoPlay
            muted
            onError={() => setVideoFailed(true)}
            onLoadedMetadata={(event) => {
              event.currentTarget.currentTime = 3.1;
            }}
            onTimeUpdate={(event) => {
              if (event.currentTarget.currentTime > 11.7) {
                event.currentTarget.currentTime = 3.1;
                void event.currentTarget.play();
              }
            }}
            playsInline
            poster={PRODUCT_SHOT_URL}
            preload="auto"
            src={PRODUCT_DEMO_URL}
          />
        )}
      </div>
      <figcaption>
        The loop shows the dashboard, the Add Account provider picker, and an
        account detail view.
      </figcaption>
    </figure>
  );
}

export function ChangelogPage() {
  return (
    <main className="marketing-page changelog-page">
      <SiteNav />

      <section className="page-hero marketing-section">
        <div className="section-heading">
          <h1>Changelog</h1>
          <p>Release notes for the desktop quota board.</p>
        </div>
      </section>

      <section className="changelog-list" aria-label="TokenMaxxer changelog entries">
        {changelog.entries.length === 0 ? (
          <article className="changelog-entry">
            <div className="changelog-entry-head">
              <div>
                <h2>No public releases yet</h2>
                <p>Release notes will appear here after TokenMaxxer v1.0.0 is tagged.</p>
              </div>
            </div>
          </article>
        ) : null}

        {changelog.entries.map((entry) => (
          <article className="changelog-entry" key={`${entry.version}-${entry.date}`}>
            <div className="changelog-entry-head">
              <div>
                <h2>{entry.title}</h2>
                <p>{entry.summary}</p>
              </div>
              {entry.date && <time dateTime={entry.date}>{entry.date}</time>}
            </div>

            <ul className="changelog-notes">
              {entry.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <MarketingFooter />
    </main>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="Last updated June 18, 2026"
      sections={privacySections}
    />
  );
}

export function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="Last updated June 18, 2026"
      sections={termsSections}
    />
  );
}

function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <main className="marketing-page legal-page">
      <SiteNav />

      <section className="page-hero marketing-section">
        <div className="section-heading">
          <h1>{title}</h1>
          <p>{updated}</p>
        </div>
      </section>

      <section className="legal-body" aria-label={`${title} contents`}>
        {sections.map((section) => (
          <article className="legal-section" key={section.heading}>
            <h2>{section.heading}</h2>
            <div className="legal-prose">{section.body}</div>
          </article>
        ))}
      </section>

      <MarketingFooter />
    </main>
  );
}

const privacySections: LegalSection[] = [
  {
    heading: "Summary",
    body: (
      <p>
        TokenMaxxer is a local-first desktop application. It does not require an
        account, does not send your data to TokenMaxxer or its developers, and
        includes no analytics or telemetry. These notes explain exactly what the
        app stores and what it contacts on your behalf.
      </p>
    ),
  },
  {
    heading: "Data we do not collect",
    body: (
      <ul>
        <li>No account is required to use TokenMaxxer.</li>
        <li>No personal information is transmitted to TokenMaxxer or its developers.</li>
        <li>The app contains no analytics, telemetry, or crash reporting.</li>
        <li>The source code is open under the MIT License, so this can be verified directly.</li>
      </ul>
    ),
  },
  {
    heading: "Information stored on your device",
    body: (
      <>
        <p>
          Provider credentials, configuration, and usage history stay on your
          machine:
        </p>
        <ul>
          <li>
            Provider credentials are stored in your operating system&apos;s secure
            storage - Windows DPAPI, macOS Keychain, or Linux Secret Service
            where available.
          </li>
          <li>
            Account labels and provider configuration live in a local{" "}
            <code>config.json</code> file.
          </li>
          <li>
            Usage history (tokens, spend, balances, reset windows) lives in a
            local <code>history.json</code> file.
          </li>
          <li>This data does not leave your device through TokenMaxxer.</li>
        </ul>
      </>
    ),
  },
  {
    heading: "Third-party providers",
    body: (
      <>
        <p>
          TokenMaxxer contacts provider APIs directly from your device to read
          quota and usage information:
        </p>
        <ul>
          <li>Credentials are sent only to the provider they belong to, over HTTPS.</li>
          <li>
            OpenAI/ChatGPT, Google, Anthropic, Cursor, xAI, AWS, Azure,
            Fireworks, and other providers each have their own privacy policies
            that apply to your use of their services.
          </li>
          <li>
            TokenMaxxer is not affiliated with, endorsed by, or sponsored by
            these providers.
          </li>
        </ul>
      </>
    ),
  },
  {
    heading: "Software updates",
    body: (
      <ul>
        <li>The app checks GitHub for signed updates using the Tauri updater plugin.</li>
        <li>This check reveals your IP address to GitHub. No TokenMaxxer-specific identifier is sent.</li>
        <li>Updates are cryptographically signed and verified before installation.</li>
      </ul>
    ),
  },
  {
    heading: "Contact",
    body: (
      <p>
        To ask a privacy question or request a change, open an issue on{" "}
        <a href={SOURCE_URL} rel="noreferrer" target="_blank">
          GitHub
        </a>
        .
      </p>
    ),
  },
];

const termsSections: LegalSection[] = [
  {
    heading: "Acceptance",
    body: (
      <p>
        By downloading or using TokenMaxxer, you agree to these terms. If you do
        not agree, do not use the software.
      </p>
    ),
  },
  {
    heading: "License",
    body: (
      <p>
        TokenMaxxer is released under the{" "}
        <a
          href={`${SOURCE_URL}/blob/main/LICENSE`}
          rel="noreferrer"
          target="_blank"
        >
          MIT License
        </a>
        . You may use, copy, modify, merge, publish, and distribute the software
        subject to the terms of that license.
      </p>
    ),
  },
  {
    heading: "Your responsibilities",
    body: (
      <ul>
        <li>You are responsible for keeping your provider credentials secure.</li>
        <li>
          You must comply with the terms of service of each provider whose APIs
          TokenMaxxer contacts on your behalf.
        </li>
        <li>
          You are responsible for your use of those provider APIs, including any
          costs or rate limits they impose.
        </li>
      </ul>
    ),
  },
  {
    heading: "Third-party services",
    body: (
      <ul>
        <li>
          TokenMaxxer interacts with third-party APIs operated by the providers
          you configure, including OpenAI, Google, Anthropic, Cursor, xAI, AWS,
          Azure, Fireworks, and others.
        </li>
        <li>These services have their own terms of service that apply to your use.</li>
        <li>
          TokenMaxxer is not affiliated with these providers. They may change,
          rate-limit, or revoke API access at any time.
        </li>
      </ul>
    ),
  },
  {
    heading: "No warranty",
    body: (
      <p>
        The software is provided &quot;as is&quot;, without warranty of any
        kind, express or implied, including but not limited to the warranties of
        merchantability, fitness for a particular purpose, and non-infringement.
      </p>
    ),
  },
  {
    heading: "Limitation of liability",
    body: (
      <p>
        To the maximum extent permitted by law, neither the author nor
        contributors shall be liable for any claim, damages, or other liability
        arising from the use of or inability to use the software.
      </p>
    ),
  },
  {
    heading: "Changes",
    body: (
      <p>
        These terms may be updated from time to time. Continued use of
        TokenMaxxer after a change constitutes acceptance of the revised terms.
      </p>
    ),
  },
  {
    heading: "Contact",
    body: (
      <p>
        To ask a question about these terms, open an issue on{" "}
        <a href={SOURCE_URL} rel="noreferrer" target="_blank">
          GitHub
        </a>
        .
      </p>
    ),
  },
];

function DownloadSection() {
  return (
    <section id="download" className="marketing-section download-section">
      <div className="download-panel">
        <div className="download-panel-copy">
          <h2>Download the desktop build.</h2>
          <p>
            Pick the release asset for your OS. TokenMaxxer runs locally, keeps
            credentials in local secure storage, and uses the GitHub release
            channel for desktop packages.
          </p>
        </div>

        <div className="download-cards" aria-label="TokenMaxxer platform downloads">
          {platformOptions.map((option) => (
            <a className="download-card" href={option.href} key={option.platform}>
              <span className="download-card-icon">
                <option.Icon aria-hidden="true" />
              </span>
              <span className="download-card-copy">
                <strong>{option.copy}</strong>
                <small>{option.artifact}</small>
              </span>
              <span className="download-card-action" aria-hidden="true">
                <TbDownload />
              </span>
            </a>
          ))}
        </div>

        <p className="download-footnote">
          Want the source instead? Review the MIT-licensed project on{" "}
          <a href={SOURCE_URL} rel="noreferrer" target="_blank">
            GitHub
          </a>
          .
        </p>
      </div>
    </section>
  );
}

function SiteNav() {
  return (
    <header className="marketing-nav">
      <a className="nav-brand" href="/" aria-label="TokenMaxxer home">
        <LogoMark className="nav-logo-mark" />
        <span>TokenMaxxer</span>
      </a>

      <nav className="nav-links" aria-label="Marketing links">
        <a href="/#product">Product</a>
        <a href="/#tracks">Tracking</a>
        <a href="/#providers">Providers</a>
        <a href="/#security">Security</a>
        <a href={CHANGELOG_URL}>Changelog</a>
        <a href={SOURCE_URL} rel="noreferrer" target="_blank">
          <FaGithub aria-hidden="true" />
          GitHub
          <TbExternalLink aria-hidden="true" />
        </a>
      </nav>

      <DownloadMenu />
    </header>
  );
}

function DownloadMenu() {
  return (
    <details className="download-menu">
      <summary>
        <TbDownload aria-hidden="true" />
        Download
        <TbChevronDown aria-hidden="true" />
      </summary>
      <div className="download-menu-panel">
        {platformOptions.map((option) => (
          <a href={option.href} key={option.platform}>
            <option.Icon aria-hidden="true" />
            <span>
              <strong>{option.platform}</strong>
              <small>{option.artifact}</small>
            </span>
          </a>
        ))}
      </div>
    </details>
  );
}

function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="marketing-footer">
      <div className="footer-grid">
        <div className="footer-brand-col">
          <a className="footer-brand" href="/" aria-label="TokenMaxxer home">
            <LogoMark className="footer-logo-mark" />
            <span>TokenMaxxer</span>
          </a>
          <p className="footer-tagline">
            Local-first AI quota tracking across subscriptions, API keys, admin
            reports, cloud metrics, and imported usage exports.
          </p>
        </div>

        <nav className="footer-col" aria-label="Product">
          <h3>Product</h3>
          <a href="/#product">Product walkthrough</a>
          <a href="/#providers">Providers</a>
          <a href="/#download">Download</a>
          <a href={CHANGELOG_URL}>Changelog</a>
        </nav>

        <nav className="footer-col" aria-label="Legal">
          <h3>Legal</h3>
          <a href={PRIVACY_URL}>Privacy Policy</a>
          <a href={TERMS_URL}>Terms of Service</a>
          <a
            href={`${SOURCE_URL}/blob/main/LICENSE`}
            rel="noreferrer"
            target="_blank"
          >
            MIT License
          </a>
        </nav>
      </div>

      <div className="footer-base">
        <span>&copy; {year} Joshua Knott</span>
        <span className="footer-disclaimer">
          TokenMaxxer is not affiliated with the providers it can track.
        </span>
      </div>
    </footer>
  );
}
