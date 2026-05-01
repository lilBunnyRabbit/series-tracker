import { execSync } from "node:child_process";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const STATIC = join(ROOT, "static");

function git(args: string): string | null {
  try {
    return execSync(`git ${args}`, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
}

const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8")) as { version: string };

// CI sets these; locally we fall back to git. Either way "unknown" if both fail
// so the build never crashes on a fresh clone or detached HEAD.
const commit = (process.env.GITHUB_SHA?.slice(0, 7)) ?? git("rev-parse --short HEAD") ?? "unknown";
const branch = process.env.GITHUB_REF_NAME ?? git("rev-parse --abbrev-ref HEAD") ?? "unknown";

const now = new Date();
const manifest = {
  version: pkg.version,
  commit,
  branch,
  buildTime: now.toISOString(),
  buildTimestamp: now.getTime(),
};

await writeFile(join(STATIC, "version.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`✓ static/version.json — v${manifest.version} ${manifest.commit} (${manifest.branch})`);

const changelogSrc = join(ROOT, "CHANGELOG.md");
if (existsSync(changelogSrc)) {
  await copyFile(changelogSrc, join(STATIC, "CHANGELOG.md"));
  console.log("✓ static/CHANGELOG.md");
} else {
  console.warn("⚠ CHANGELOG.md not found at repo root — skipping copy");
}
