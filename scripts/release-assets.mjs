export const releaseAssets = {
  windowsInstaller: "TokenMaxxer-Windows-x64-setup.exe",
  macosDmg: "TokenMaxxer-macOS-universal.dmg",
  macosUpdaterArchive: "TokenMaxxer-macOS-universal.app.tar.gz",
  linuxAppImage: "TokenMaxxer-Linux-x86_64.AppImage",
  linuxDeb: "TokenMaxxer-Linux-x86_64.deb",
};

export const updaterPlatforms = [
  {
    platform: "windows-x86_64",
    asset: releaseAssets.windowsInstaller,
  },
  {
    platform: "darwin-x86_64",
    asset: releaseAssets.macosUpdaterArchive,
  },
  {
    platform: "darwin-aarch64",
    asset: releaseAssets.macosUpdaterArchive,
  },
  {
    platform: "linux-x86_64",
    asset: releaseAssets.linuxAppImage,
  },
];
