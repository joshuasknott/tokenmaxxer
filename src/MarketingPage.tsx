import type { IconType } from "react-icons";
import { FaApple, FaGithub, FaLinux, FaWindows } from "react-icons/fa";
import { TbDownload, TbExternalLink } from "react-icons/tb";
import { LogoMark } from "./components/Logo";

const SOURCE_URL = "https://github.com/joshuasknott/tokenmaxxer";
const RELEASES_URL = `${SOURCE_URL}/releases`;
const WINDOWS_DOWNLOAD_URL = "/downloads/TokenMaxxer_0.1.0_x64-setup.exe";
const PRODUCT_SHOT_URL = "/tokenmaxxer-product-shot.png";
const PRODUCT_DEMO_URL = "/tokenmaxxer-demo.mp4";

type DownloadOption = {
  platform: string;
  artifact: string;
  status: "available" | "unavailable";
  href: string | null;
  note: string;
  Icon: IconType;
};

const downloadOptions: DownloadOption[] = [
  {
    platform: "Windows",
    artifact: "NSIS installer",
    status: "available",
    href: WINDOWS_DOWNLOAD_URL,
    note: "Available in the current static download bundle.",
    Icon: FaWindows,
  },
  {
    platform: "macOS",
    artifact: "Universal DMG",
    status: "unavailable",
    href: null,
    note: "Not published in this static download bundle yet.",
    Icon: FaApple,
  },
  {
    platform: "Linux",
    artifact: "AppImage / deb",
    status: "unavailable",
    href: null,
    note: "Not published in this static download bundle yet.",
    Icon: FaLinux,
  },
];

export function MarketingPage() {
  return (
    <main className="marketing-page min-h-screen">
      <section className="marketing-hero mx-auto grid w-full max-w-[1680px] grid-cols-1 gap-12 px-5 pb-16 pt-8 sm:px-8 sm:pb-20 lg:grid-cols-[0.72fr_1.28fr] lg:gap-14 lg:px-12 lg:pb-24 lg:pt-10">
        <div className="marketing-copy flex min-w-0 flex-col justify-center">
          <a className="marketing-brand" href={SOURCE_URL} rel="noreferrer" target="_blank">
            <LogoMark className="h-20 w-20 shrink-0" />
            <span>TokenMaxxer</span>
          </a>

          <p className="marketing-kicker">Open-source desktop usage tracker</p>

          <h1>Track AI limits across multiple accounts at once.</h1>

          <p className="marketing-lede">
            TokenMaxxer is an open-source desktop app for monitoring provider
            quotas, reset windows, account balances, and estimated spend from
            one local interface.
          </p>

          <PlatformChooser compact />

          <div className="marketing-source-row">
            <a className="marketing-link-button" href={SOURCE_URL} rel="noreferrer" target="_blank">
              <FaGithub aria-hidden="true" />
              Source on GitHub
              <TbExternalLink aria-hidden="true" />
            </a>
            <a className="marketing-text-link" href={RELEASES_URL} rel="noreferrer" target="_blank">
              Release notes
            </a>
          </div>
        </div>

        <ProductVisual />

        <div className="marketing-downloads">
          <div className="download-note">
            <p>
              Windows is available here. macOS and Linux stay visible until their
              published artifacts are added.
            </p>
          </div>

          <div className="download-list" aria-label="TokenMaxxer platform downloads">
            {downloadOptions.map((option) => (
              <DownloadRow key={option.platform} option={option} />
            ))}

            <div className="download-footer-actions">
              <a className="marketing-link-button" href={SOURCE_URL} rel="noreferrer" target="_blank">
                <FaGithub aria-hidden="true" />
                Build from source
                <TbExternalLink aria-hidden="true" />
              </a>
              <a className="marketing-text-link" href={RELEASES_URL} rel="noreferrer" target="_blank">
                View all releases
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function PlatformChooser({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "platform-chooser platform-chooser-compact" : "platform-chooser"}>
      {downloadOptions.map((option) => (
        <PlatformChoice key={option.platform} option={option} />
      ))}
    </div>
  );
}

function PlatformChoice({ option }: { option: DownloadOption }) {
  const Icon = option.Icon;
  const label =
    option.status === "available"
      ? `Download TokenMaxxer for ${option.platform}`
      : `${option.platform} build not published`;

  if (!option.href) {
    return (
      <span className="platform-choice platform-choice-disabled" aria-disabled="true" title={label}>
        <Icon aria-hidden="true" />
        <span>
          <strong>{option.platform}</strong>
          <small>Not published</small>
        </span>
      </span>
    );
  }

  return (
    <a className="platform-choice" download href={option.href} aria-label={label}>
      <Icon aria-hidden="true" />
      <span>
        <strong>{option.platform}</strong>
        <small>{option.artifact}</small>
      </span>
      <TbDownload aria-hidden="true" />
    </a>
  );
}

function ProductVisual() {
  return (
    <figure className="product-visual" aria-label="TokenMaxxer product interface">
      <video
        aria-label="TokenMaxxer demo showing adding an account and opening account details"
        autoPlay
        loop
        muted
        playsInline
        poster={PRODUCT_SHOT_URL}
        preload="metadata"
        src={PRODUCT_DEMO_URL}
      />
      <img
        alt="TokenMaxxer desktop app showing multiple tracked accounts, usage windows, provider mix, and global usage trend"
        src={PRODUCT_SHOT_URL}
      />
    </figure>
  );
}

function DownloadRow({ option }: { option: DownloadOption }) {
  const Icon = option.Icon;
  const available = option.status === "available" && Boolean(option.href);

  return (
    <article className="download-row">
      <div className="download-row-platform">
        <span className="download-row-icon">
          <Icon aria-hidden="true" />
        </span>
        <span>
          <strong>{option.platform}</strong>
          <small>{option.artifact}</small>
        </span>
      </div>

      <p>{option.note}</p>

      {available && option.href ? (
        <a className="download-row-action" download href={option.href}>
          <TbDownload aria-hidden="true" />
          Download
        </a>
      ) : (
        <span className="download-row-action download-row-action-disabled" aria-disabled="true">
          Not published
        </span>
      )}
    </article>
  );
}
