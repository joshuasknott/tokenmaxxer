import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const [artifactRoot = "release-artifacts", outputPath = "latest.json"] =
  process.argv.slice(2);

const repo = process.env.GITHUB_REPOSITORY;
const tag = process.env.GITHUB_REF_NAME;

if (!repo) {
  throw new Error("GITHUB_REPOSITORY is required to build update asset URLs.");
}

if (!tag) {
  throw new Error("GITHUB_REF_NAME is required to build update asset URLs.");
}

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

const files = await walk(artifactRoot);
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const platforms = {};

function assetUrl(filePath) {
  const fileName = path.basename(filePath);
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(fileName)}`;
}

async function addPlatform(platform, assetPath) {
  if (!assetPath) return;

  const signaturePath = `${assetPath}.sig`;
  if (!files.includes(signaturePath)) {
    throw new Error(`Missing updater signature for ${path.basename(assetPath)}.`);
  }

  platforms[platform] = {
    signature: (await readFile(signaturePath, "utf8")).trim(),
    url: assetUrl(assetPath),
  };
}

const windowsInstaller = files.find((file) => /\.exe$/i.test(file));
const macArchive = files.find((file) => /\.app\.tar\.gz$/i.test(file));
const linuxAppImage = files.find((file) => /\.AppImage$/.test(file));

await addPlatform("windows-x86_64", windowsInstaller);
await addPlatform("darwin-x86_64", macArchive);
await addPlatform("darwin-aarch64", macArchive);
await addPlatform("linux-x86_64", linuxAppImage);

if (Object.keys(platforms).length === 0) {
  throw new Error("No updater artifacts were found.");
}

await writeFile(
  outputPath,
  `${JSON.stringify(
    {
      version: packageJson.version,
      notes: `TokenMaxxer ${packageJson.version}`,
      pub_date: new Date().toISOString(),
      platforms,
    },
    null,
    2
  )}\n`
);
