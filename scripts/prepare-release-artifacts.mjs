import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const [sourceRoot = "release-artifacts", outputRoot = "release-publish"] =
  process.argv.slice(2);

async function walk(dir) {
  const entries = await readdir(dir);
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const info = await stat(fullPath);
    if (info.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

function findFile(files, pattern, label) {
  const match = files.find((file) => pattern.test(path.basename(file)));
  if (!match) {
    throw new Error(`Missing ${label} artifact.`);
  }
  return match;
}

async function copyArtifact(source, fileName, { requireSignature = false } = {}) {
  const destination = path.join(outputRoot, fileName);
  await copyFile(source, destination);

  const signatureSource = `${source}.sig`;
  const signatureDestination = `${destination}.sig`;

  try {
    await stat(signatureSource);
    await copyFile(signatureSource, signatureDestination);
  } catch (error) {
    if (requireSignature) {
      throw new Error(`Missing signature for ${path.basename(source)}.`);
    }

    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}

await rm(outputRoot, { recursive: true, force: true });
await mkdir(outputRoot, { recursive: true });

const files = await walk(sourceRoot);

await copyArtifact(
  findFile(files, /\.exe$/i, "Windows installer"),
  "TokenMaxxer-Windows-x64-setup.exe",
  { requireSignature: true }
);

await copyArtifact(
  findFile(files, /\.dmg$/i, "macOS DMG"),
  "TokenMaxxer-macOS-universal.dmg"
);

await copyArtifact(
  findFile(files, /\.app\.tar\.gz$/i, "macOS updater archive"),
  "TokenMaxxer-macOS-universal.app.tar.gz",
  { requireSignature: true }
);

await copyArtifact(
  findFile(files, /\.AppImage$/i, "Linux AppImage"),
  "TokenMaxxer-Linux-x86_64.AppImage",
  { requireSignature: true }
);

await copyArtifact(
  findFile(files, /\.deb$/i, "Linux deb package"),
  "TokenMaxxer-Linux-x86_64.deb"
);
