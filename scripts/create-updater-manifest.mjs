import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { updaterPlatforms } from "./release-assets.mjs";

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
const filesByName = new Map(files.map((file) => [path.basename(file), file]));
const platforms = {};

function assetUrl(fileName) {
  return `https://github.com/${repo}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(fileName)}`;
}

function requireReleaseAsset(fileName) {
  const filePath = filesByName.get(fileName);

  if (!filePath) {
    throw new Error(
      `Missing stable release asset ${fileName}. Run scripts/prepare-release-artifacts.mjs before generating latest.json.`
    );
  }

  return filePath;
}

async function addPlatform({ platform, asset }) {
  const assetPath = requireReleaseAsset(asset);
  const signaturePath = requireReleaseAsset(`${asset}.sig`);

  platforms[platform] = {
    signature: (await readFile(signaturePath, "utf8")).trim(),
    url: assetUrl(path.basename(assetPath)),
  };
}

for (const updaterPlatform of updaterPlatforms) {
  await addPlatform(updaterPlatform);
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
