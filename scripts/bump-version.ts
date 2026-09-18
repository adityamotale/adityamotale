import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  bumpSemver,
  updateChangelog,
  updatePackageJson,
  updatePackageLock,
} from "./lib/version.ts";

interface CliOptions {
  type: "patch" | "minor" | "major";
  message: string;
  force: boolean;
  dryRun: boolean;
  skipPush: boolean;
  skipPdf: boolean;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  const getOption = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")
      ? args[idx + 1]
      : null;
  };

  const type = (getOption("--type") || "patch") as "patch" | "minor" | "major";
  const message =
    getOption("--message") || "update github activity and coding metrics";
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");
  const skipPush = args.includes("--skip-push");
  const skipPdf = args.includes("--skip-pdf");

  return { type, message, force, dryRun, skipPush, skipPdf };
}

function runCommand(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, stdio: "pipe", encoding: "utf-8" }).trim();
}

function main() {
  const options = parseCliArgs();
  const rootDir = path.resolve(import.meta.dirname, "..");
  const statsFile = path.join(rootDir, "data", "github-stats.json");
  const websitePkgFile = path.join(rootDir, "website", "package.json");

  let hasStatsChanges = false;
  try {
    const statusOutput = runCommand(
      "git status --porcelain data/github-stats.json",
      rootDir,
    );
    hasStatsChanges = statusOutput.length > 0;
  } catch (err) {
    console.warn("⚠️ Unable to check git status:", err);
  }

  if (!hasStatsChanges && !options.force) {
    console.log(
      "ℹ️ No changes detected in data/github-stats.json. Skipping version bump and release.",
    );
    return;
  }

  if (!existsSync(websitePkgFile)) {
    throw new Error(`website/package.json not found at: ${websitePkgFile}`);
  }

  const websitePkg = JSON.parse(readFileSync(websitePkgFile, "utf-8"));
  const currentVersion = websitePkg.version || "0.1.0";
  const nextVersion = bumpSemver(currentVersion, options.type);
  const today = new Date().toISOString().split("T")[0];

  console.log(
    `🚀 Preparing release v${nextVersion} (bumped from v${currentVersion}, type: ${options.type})`,
  );

  const packages = ["mdparser", "scripts", "website"];
  for (const pkgName of packages) {
    const pkgJsonPath = path.join(rootDir, pkgName, "package.json");
    const pkgLockPath = path.join(rootDir, pkgName, "package-lock.json");

    if (existsSync(pkgJsonPath)) {
      const original = readFileSync(pkgJsonPath, "utf-8");
      const updated = updatePackageJson(original, nextVersion);
      if (!options.dryRun) {
        writeFileSync(pkgJsonPath, updated, "utf-8");
      }
      console.log(`  ✓ Updated ${pkgName}/package.json -> ${nextVersion}`);
    }

    if (existsSync(pkgLockPath)) {
      const original = readFileSync(pkgLockPath, "utf-8");
      const updated = updatePackageLock(original, nextVersion);
      if (!options.dryRun) {
        writeFileSync(pkgLockPath, updated, "utf-8");
      }
      console.log(`  ✓ Updated ${pkgName}/package-lock.json -> ${nextVersion}`);
    }
  }

  const changelogPath = path.join(rootDir, "CHANGELOG.md");
  if (existsSync(changelogPath)) {
    const currentChangelog = readFileSync(changelogPath, "utf-8");
    const updatedChangelog = updateChangelog(
      currentChangelog,
      nextVersion,
      today,
      options.message,
    );
    if (!options.dryRun) {
      writeFileSync(changelogPath, updatedChangelog, "utf-8");
    }
    console.log(
      `  ✓ Updated CHANGELOG.md with entry for [${nextVersion}] - ${today}`,
    );
  }

  if (!options.skipPdf) {
    console.log("  ↻ Regenerating resume PDF with latest metrics...");
    if (!options.dryRun) {
      try {
        runCommand(
          "node scripts/generate-resume-pdf.js",
          path.join(rootDir, "website"),
        );
        console.log("  ✓ Generated website/public/adityamotale.pdf");
      } catch (err: any) {
        console.error("❌ Failed to generate resume PDF:", err.message);
        throw err;
      }
    }
  }

  console.log("  ↻ Updating README.md with latest metrics...");
  if (!options.dryRun) {
    try {
      runCommand("node scripts/generate-readme.ts", rootDir);
      console.log("  ✓ Updated README.md");
    } catch (err: any) {
      console.error("❌ Failed to update README.md:", err.message);
      throw err;
    }
  }

  if (options.dryRun) {
    console.log(
      `\n[DRY RUN] Release v${nextVersion} prepared successfully (no files written or committed).`,
    );
    return;
  }

  console.log("  📦 Committing and tagging release...");

  try {
    const existingUser = runCommand("git config user.name || true", rootDir);
    if (!existingUser) {
      runCommand('git config user.name "github-actions[bot]"', rootDir);
      runCommand(
        'git config user.email "github-actions[bot]@users.noreply.github.com"',
        rootDir,
      );
    }
  } catch (_) {}

  runCommand(
    "git add data/github-stats.json README.md assets CHANGELOG.md mdparser/package.json mdparser/package-lock.json scripts/package.json scripts/package-lock.json website/package.json website/package-lock.json website/public/adityamotale.pdf",
    rootDir,
  );

  const commitMsg = `release: v${nextVersion}`;
  runCommand(`git commit -m "${commitMsg}"`, rootDir);
  console.log(`  ✓ Committed: "${commitMsg}"`);

  const tagMsg = `Release of v${nextVersion}`;
  runCommand(`git tag -a "v${nextVersion}" -m "${tagMsg}"`, rootDir);
  console.log(`  ✓ Tagged: v${nextVersion}`);

  if (!options.skipPush) {
    console.log("  🚀 Pushing release commit and tag to origin...");
    runCommand("git push origin HEAD", rootDir);
    runCommand(`git push origin "v${nextVersion}"`, rootDir);
    console.log(`  ✓ Pushed commit and tag v${nextVersion} to origin!`);
  } else {
    console.log("  ℹ️ Skipping push (--skip-push).");
  }

  console.log(`\n✨ Successfully triggered release v${nextVersion}!`);
}

main();
