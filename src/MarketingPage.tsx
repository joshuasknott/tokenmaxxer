import type { IconType } from "react-icons";
import { FaApple, FaGithub, FaLinux, FaWindows } from "react-icons/fa";
import {
  FiActivity,
  FiBarChart2,
  FiClock,
  FiDatabase,
  FiKey,
  FiMonitor,
  FiRefreshCw,
  FiShield,
} from "react-icons/fi";
import { TbChevronDown, TbDownload, TbExternalLink } from "react-icons/tb";
import { LogoMark } from "./components/Logo";
import changelog from "./generated/changelog";

const SOURCE_URL = "https://github.com/joshuasknott/tokenmaxxer";
const DOWNLOAD_BASE_URL = `${SOURCE_URL}/releases/latest/download`;
const CHANGELOG_URL = "/changelog";
const PRODUCT_SHOT_URL = "/tokenmaxxer-product-shot.png";
const PRODUCT_DEMO_URL = "/tokenmaxxer-demo.mp4";
const ADD_ACCOUNT_SHOT_URL = "/tokenmaxxer-add-account-shot.png";
const ACCOUNT_DETAILS_SHOT_URL = "/tokenmaxxer-account-details-shot.png";

type PlatformOption = {
  platform: string;
  artifact: string;
  copy: string;
  href: string;
  Icon: IconType;
};

type UseCase = {
  title: string;
  copy: string;
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

const platformOptions: PlatformOption[] = [
  {
    platform: "Windows",
    artifact: "NSIS installer",
    copy: "Download for Windows",
    href: `${DOWNLOAD_BASE_URL}/TokenMaxxer-Windows-x64-setup.exe`,
    Icon: FaWindows,
  },
  {
    platform: "macOS",
    artifact: "Universal DMG",
    copy: "Download for macOS",
    href: `${DOWNLOAD_BASE_URL}/TokenMaxxer-macOS-universal.dmg`,
    Icon: FaApple,
  },
  {
    platform: "Linux",
    artifact: "AppImage",
    copy: "Download for Linux",
    href: `${DOWNLOAD_BASE_URL}/TokenMaxxer-Linux-x86_64.AppImage`,
    Icon: FaLinux,
  },
];

const useCases: UseCase[] = [
  {
    title: "Scan the board",
    copy: "Open TokenMaxxer before a long run and see which account has room.",
    Icon: FiActivity,
  },
  {
    title: "Add a provider",
    copy: "Choose Codex, Antigravity, DeepSeek, or Z.ai and validate credentials first.",
    Icon: FiKey,
  },
  {
    title: "Inspect the reset",
    copy: "Open the account details view when a quota window needs explanation.",
    Icon: FiClock,
  },
  {
    title: "Keep history local",
    copy: "Track cost, tokens, balances, and reset windows without a hosted account.",
    Icon: FiDatabase,
  },
];

const productStories: ProductStory[] = [
  {
    title: "A quota board before you choose a model",
    copy: "The dashboard keeps provider limits, reset windows, balances, estimated spend, and token history in one local view.",
    image: PRODUCT_SHOT_URL,
    alt: "TokenMaxxer dashboard showing provider cards, quota reset windows, provider mix, and global usage trend.",
    align: "right",
    points: ["Provider mix", "Reset countdowns", "Usage trend", "Local history"],
  },
  {
    title: "Credential setup with the context beside the choice",
    copy: "Each provider shows the exact credential shape it expects, then validates before the account enters local storage.",
    image: ADD_ACCOUNT_SHOT_URL,
    alt: "TokenMaxxer add account flow with provider selection and credential validation.",
    align: "left",
    points: ["Codex", "Antigravity", "DeepSeek", "Z.ai"],
  },
  {
    title: "A detail view for the moment the card is not enough",
    copy: "Drill into model breakdowns, reset timestamps, balance context, and the usage trend behind a single tracked account.",
    image: ACCOUNT_DETAILS_SHOT_URL,
    alt: "TokenMaxxer account detail modal showing quota windows, model breakdown, and historical usage chart.",
    align: "right",
    points: ["Model breakdowns", "Reset timestamps", "Historical usage"],
  },
];

const features: Feature[] = [
  {
    title: "Secure local vault",
    copy: "Credentials stay in DPAPI, macOS Keychain, or Linux Secret Service where available.",
    Icon: FiShield,
  },
  {
    title: "Manual refresh controls",
    copy: "Refresh one account or the full board and see new snapshots immediately.",
    Icon: FiRefreshCw,
  },
  {
    title: "Signed release channel",
    copy: "Windows, macOS, and Linux packages are prepared with stable download names.",
    Icon: TbDownload,
  },
  {
    title: "Trend context",
    copy: "Switch day, week, month, year, or all-time views for spend and tokens.",
    Icon: FiBarChart2,
  },
  {
    title: "Provider adapters",
    copy: "Codex, Antigravity, DeepSeek, and Z.ai share one normalized UI model.",
    Icon: FiMonitor,
  },
  {
    title: "Credential validation",
    copy: "The add-account flow checks provider credentials before saving them.",
    Icon: FiKey,
  },
];

const heroSteps = ["Scan quotas", "Add an account", "Open details"];

export function MarketingPage() {
  const latestEntry = changelog.entries[0];

  return (
    <main className="marketing-page">
      <SiteNav />

      <section className="marketing-hero" aria-labelledby="marketing-title">
        <div className="hero-stage">
          <div className="hero-copy-overlay">
            <h1 id="marketing-title">TokenMaxxer</h1>
            <p>Watch the local quota workflow: scan accounts, add a provider, and inspect reset details.</p>
          </div>

          <figure className="hero-product-frame" aria-label="TokenMaxxer walkthrough video">
            <video
              aria-label="TokenMaxxer demo showing the quota board, add account flow, and account details"
              autoPlay
              loop
              muted
              playsInline
              poster={PRODUCT_SHOT_URL}
              preload="metadata"
              src={PRODUCT_DEMO_URL}
            />
            <figcaption className="hero-step-strip">
              {heroSteps.map((step, index) => (
                <span key={step}>
                  <strong>{index + 1}</strong>
                  {step}
                </span>
              ))}
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="marketing-section ways-section">
        <div className="section-heading">
          <h2>Use it before the next long run</h2>
          <p>
            TokenMaxxer is built for the moment before you commit to a model,
            account, or overnight job.
          </p>
        </div>

        <div className="ways-grid">
          {useCases.map((item) => (
            <article className="way-card" key={item.title}>
              <item.Icon aria-hidden="true" />
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="product-story-stack" aria-label="TokenMaxxer product walkthrough">
        {productStories.map((story) => (
          <article className={`product-story product-story-${story.align}`} key={story.title}>
            <div className="product-story-copy">
              <h2>{story.title}</h2>
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
      </section>

      <section className="marketing-section features-section">
        <div className="section-heading">
          <h2>The full quota loop</h2>
          <p>
            Secure credential storage, provider refreshes, usage history, and
            package updates stay part of one desktop workflow.
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

      <section className="marketing-section release-section">
        <div className="release-panel">
          <div>
            <h2>Changelog that belongs to the site</h2>
            <p>
              The changelog page is generated from repository history during
              local and production builds. The latest entry is {latestEntry.title}.
            </p>
          </div>

          <div className="release-actions">
            <a className="text-action" href={CHANGELOG_URL}>
              Changelog
            </a>
          </div>

          <div className="release-channel-list" aria-label="TokenMaxxer platform downloads">
            {platformOptions.map((option) => (
              <a className="release-channel" href={option.href} key={option.platform}>
                <option.Icon aria-hidden="true" />
                <span>
                  <strong>{option.copy}</strong>
                  <small>{option.artifact}</small>
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

export function ChangelogPage() {
  return (
    <main className="marketing-page changelog-page">
      <SiteNav />

      <section className="changelog-hero marketing-section">
        <div className="section-heading">
          <h1>Changelog</h1>
          <p>
            Generated during builds from TokenMaxxer version tags and commit
            history, then served as a first-party page.
          </p>
        </div>
      </section>

      <section className="changelog-list" aria-label="TokenMaxxer changelog entries">
        {changelog.entries.map((entry) => (
          <article className="changelog-entry" key={`${entry.version}-${entry.date}`}>
            <div className="changelog-entry-head">
              <div>
                <h2>{entry.title}</h2>
                <p>{entry.summary}</p>
              </div>
              {entry.date && <time dateTime={entry.date}>{entry.date}</time>}
            </div>

            <div className="changelog-groups">
              {entry.groups.map((group) => (
                <section key={group.category}>
                  <h3>{group.category}</h3>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </article>
        ))}
      </section>

      <MarketingFooter />
    </main>
  );
}

function SiteNav() {
  return (
    <header className="marketing-nav">
      <a className="nav-brand" href={SOURCE_URL} rel="noreferrer" target="_blank" aria-label="TokenMaxxer GitHub source">
        <LogoMark className="nav-logo-mark" />
        <span>TokenMaxxer</span>
      </a>

      <nav aria-label="Marketing links">
        <a href={CHANGELOG_URL}>Changelog</a>
        <a href={SOURCE_URL} rel="noreferrer" target="_blank">
          <FaGithub aria-hidden="true" />
          GitHub Source
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
              <strong>{option.copy}</strong>
              <small>{option.artifact}</small>
            </span>
          </a>
        ))}
      </div>
    </details>
  );
}

function MarketingFooter() {
  return (
    <footer className="marketing-footer">
      <div className="footer-brand">
        <LogoMark className="footer-logo-mark" />
        <span>TokenMaxxer</span>
      </div>

      <nav aria-label="Footer links">
        <a href={CHANGELOG_URL}>Changelog</a>
        <a href={SOURCE_URL} rel="noreferrer" target="_blank">
          GitHub Source
        </a>
        {platformOptions.map((option) => (
          <a href={option.href} key={option.platform}>
            {option.copy}
          </a>
        ))}
      </nav>
    </footer>
  );
}
