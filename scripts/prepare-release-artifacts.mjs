import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { releaseAssets } from "./release-assets.mjs";

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
  releaseAssets.windowsInstaller,
  { requireSignature: true }
);

await copyArtifact(
  findFile(files, /\.dmg$/i, "macOS DMG"),
  releaseAssets.macosDmg
);

await copyArtifact(
  findFile(files, /\.app\.tar\.gz$/i, "macOS updater archive"),
  releaseAssets.macosUpdaterArchive,
  { requireSignature: true }
);

await copyArtifact(
  findFile(files, /\.AppImage$/i, "Linux AppImage"),
  releaseAssets.linuxAppImage,
  { requireSignature: true }
);

await copyArtifact(
  findFile(files, /\.deb$/i, "Linux deb package"),
  releaseAssets.linuxDeb
);
