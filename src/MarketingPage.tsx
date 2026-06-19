import { useState, type ReactNode } from "react";
import type { IconType } from "react-icons";
import { FaApple, FaGithub, FaLinux, FaWindows } from "react-icons/fa";
import {
  FiActivity,
  FiArrowRight,
  FiBarChart2,
  FiClock,
  FiCpu,
  FiDatabase,
  FiHardDrive,
  FiKey,
  FiLock,
  FiRefreshCw,
  FiShield,
} from "react-icons/fi";
import { TbChevronDown, TbDownload, TbExternalLink } from "react-icons/tb";
import { LogoMark } from "./components/Logo";
import changelog from "./generated/changelog";

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
  title: string;
  copy: string;
  image: string;
  alt: string;
  align: "left" | "right";
  points: string[];
};

type Feature = {
  title: string;
  copy: string;
  Icon: IconType;
};

type WorkflowStep = {
  step: string;
  title: string;
  copy: string;
  signal: string;
};

type LegalSection = {
  heading: string;
  body: ReactNode;
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

const productStories: ProductStory[] = [
  {
    title: "A real quota board before the next run",
    copy: "Provider limits, reset countdowns, balances, estimated spend, and token history stay visible in one local dashboard.",
    image: PRODUCT_SHOT_URL,
    alt: "TokenMaxxer dashboard showing provider cards, quota reset windows, provider mix, and global usage trend.",
    align: "right",
    points: ["Provider mix", "Reset countdowns", "Usage trend", "Local history"],
  },
  {
    title: "Account setup that validates before saving",
    copy: "Choose the provider, paste the credential shape it expects, and keep it in the operating system vault.",
    image: ADD_ACCOUNT_SHOT_URL,
    alt: "TokenMaxxer add account flow with provider selection and credential validation.",
    align: "left",
    points: ["14 providers", "Admin APIs", "Cloud metrics", "Local vault"],
  },
  {
    title: "Details when the card is not enough",
    copy: "Open any account for model breakdowns, reset timestamps, balance context, and the usage history behind a decision.",
    image: ACCOUNT_DETAILS_SHOT_URL,
    alt: "TokenMaxxer account detail modal showing quota windows, model breakdown, and historical usage chart.",
    align: "right",
    points: ["Model breakdowns", "Reset timestamps", "Historical usage"],
  },
];

const workflowSteps: WorkflowStep[] = [
  {
    step: "01",
    title: "Add provider credentials",
    copy: "TokenMaxxer checks the provider response before an account enters your local board.",
    signal: "Validated locally",
  },
  {
    step: "02",
    title: "Refresh the board",
    copy: "Pull the latest quota windows for one account or the full list when a session is about to start.",
    signal: "Manual control",
  },
  {
    step: "03",
    title: "Pick the account with room",
    copy: "Compare reset times, available quota, balance, spend, and token history without opening a stack of provider dashboards.",
    signal: "Decision ready",
  },
];

const features: Feature[] = [
  {
    title: "Secure local vault",
    copy: "Credentials stay in DPAPI, macOS Keychain, or Linux Secret Service where available.",
    Icon: FiShield,
  },
  {
    title: "Provider adapters",
    copy: "14 provider surfaces normalize quota, balance, cloud metric, and admin usage data into one interface.",
    Icon: FiCpu,
  },
  {
    title: "Refresh controls",
    copy: "Refresh one account or the full board and see new snapshots immediately.",
    Icon: FiRefreshCw,
  },
  {
    title: "Trend context",
    copy: "Switch day, week, month, year, or all-time views for spend and tokens.",
    Icon: FiBarChart2,
  },
  {
    title: "Local history",
    copy: "Spend, tokens, balances, and resets stay on your machine.",
    Icon: FiDatabase,
  },
  {
    title: "Signed releases",
    copy: "Windows, macOS, and Linux builds use stable GitHub release asset names.",
    Icon: TbDownload,
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
            <h1 id="hero-title">Know which LLM account still has room.</h1>
            <p>
              TokenMaxxer is a local desktop quota board for subscriptions,
              API keys, admin reports, and cloud AI usage. Check reset windows,
              balance, tokens, and estimated spend before the next long run.
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
                No hosted account
              </span>
              <span>
                <FiHardDrive aria-hidden="true" />
                Local history
              </span>
              <span>
                <FiClock aria-hidden="true" />
                Reset windows
              </span>
            </div>
          </div>

          <HeroProductVideo />
        </div>
      </section>

      <section className="signal-strip" aria-label="TokenMaxxer product signals">
        <span>Private desktop app</span>
        <span>Multi-provider adapters</span>
        <span>Manual refresh loop</span>
        <span>Signed release channel</span>
      </section>

      <section id="product" className="marketing-section product-overview">
        <div className="section-heading">
          <h2>Built around the quota decision.</h2>
          <p>
            Compare accounts, inspect reset windows, and decide where the next
            session should run without opening a stack of provider dashboards.
          </p>
        </div>

        <div className="product-story-stack" aria-label="TokenMaxxer product walkthrough">
          {productStories.map((story) => (
            <article className={`product-story product-story-${story.align}`} key={story.title}>
              <div className="product-story-copy">
                <h3>{story.title}</h3>
                <p>{story.copy}</p>
                <ul>
                  {story.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
              <figure className="product-story-media">
                <img alt={story.alt} src={story.image} />
              </figure>
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="marketing-section workflow-section">
        <div className="section-heading">
          <h2>A short loop, not another dashboard habit.</h2>
          <p>
            Add the accounts once, refresh when you need the truth, then pick
            the provider with the least friction for the work ahead.
          </p>
        </div>

        <div className="workflow-rail">
          {workflowSteps.map((item) => (
            <article className="workflow-step" key={item.step}>
              <span className="workflow-index">{item.step}</span>
              <div>
                <strong>{item.signal}</strong>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="security" className="marketing-section security-section">
        <div className="security-layout">
          <div className="security-copy">
            <h2>Local-first by default.</h2>
            <p>
              TokenMaxxer reads provider quota APIs from your machine. It has no
              hosted account, analytics pipeline, or cloud dashboard to sign in
              to.
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

      <section className="marketing-section features-section">
        <div className="section-heading">
          <h2>Details that make it feel engineered.</h2>
          <p>
            The interface is built for repeated use: clear state, predictable
            controls, local storage, and release assets that are easy to find.
          </p>
        </div>

        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-row" key={feature.title}>
              <span>
                <feature.Icon aria-hidden="true" />
              </span>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </div>
            </article>
          ))}
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
    <figure className="hero-product-video" aria-label="TokenMaxxer product video preview">
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
        <div className="hero-video-footer">
          <span>
            <FiActivity aria-hidden="true" />
            Live quota board
          </span>
          <span>
            <FiKey aria-hidden="true" />
            Add account flow
          </span>
          <span>
            <FiBarChart2 aria-hidden="true" />
            Usage details
          </span>
        </div>
      </div>
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
            Pick the release asset for your OS. TokenMaxxer runs locally, stores
            credentials locally, and points every package link at the stable
            GitHub release channel.
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
        <a href="/#workflow">Workflow</a>
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
            Local-first LLM quota tracking across subscriptions, API keys,
            admin reports, and cloud AI usage.
          </p>
        </div>

        <nav className="footer-col" aria-label="Product">
          <h3>Product</h3>
          <a href="/#product">Product UI</a>
          <a href="/#workflow">Workflow</a>
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
