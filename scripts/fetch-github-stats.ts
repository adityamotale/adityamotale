import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  buildRepositoryActivities,
  calculateLanguages,
  calculateRepositorySummary,
  calculateStreaks,
} from "./lib/aggregator.ts";
import {
  fetchContributionsWindow,
  fetchPullRequests,
  fetchRepoLOC,
  fetchViewerContext,
  type RepoContribDelta,
  type ViewerContext,
} from "./lib/collector.ts";
import { getSundayToSaturdayWindow } from "./lib/date.ts";
import type {
  ContributionBreakdown,
  DateRange,
  GitHubStatsOutput,
  RepoActivityStat,
} from "./lib/types.ts";

function parseCliArgs(): {
  dateRange: DateRange;
  isIncremental: boolean;
  dataDir: string;
} {
  const args = process.argv.slice(2);
  const getOption = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")
      ? args[idx + 1]
      : null;
  };

  const dataDir = getOption("--data-dir") || path.join(process.cwd(), "data");
  const cacheExists = existsSync(path.join(dataDir, "github-stats.json"));
  const forceFull = args.includes("--full") || args.includes("--full-backfill");
  const lastWeek = args.includes("--last-week");
  const days = getOption("--days");
  const fromArg = getOption("--from");
  const toArg = getOption("--to");

  if (lastWeek) {
    return {
      dateRange: getSundayToSaturdayWindow(),
      isIncremental: true,
      dataDir,
    };
  }

  if (days) {
    const dayCount = parseInt(days, 10) || 7;
    const now = new Date();
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
    );
    const start = new Date(
      end.getTime() - (dayCount - 1) * 24 * 60 * 60 * 1000,
    );
    return {
      dateRange: {
        from: `${start.toISOString().slice(0, 10)}T00:00:00Z`,
        to: `${end.toISOString().slice(0, 10)}T23:59:59Z`,
      },
      isIncremental: true,
      dataDir,
    };
  }

  if (fromArg || toArg) {
    const from = fromArg
      ? fromArg.includes("T")
        ? fromArg
        : `${fromArg}T00:00:00Z`
      : "2021-01-01T00:00:00Z";
    const to = toArg
      ? toArg.includes("T")
        ? toArg
        : `${toArg}T23:59:59Z`
      : new Date().toISOString();
    return {
      dateRange: { from, to },
      isIncremental: !forceFull && cacheExists,
      dataDir,
    };
  }

  if (cacheExists && !forceFull) {
    return {
      dateRange: getSundayToSaturdayWindow(),
      isIncremental: true,
      dataDir,
    };
  }

  return {
    dateRange: { from: "2021-01-01T00:00:00Z", to: new Date().toISOString() },
    isIncremental: false,
    dataDir,
  };
}

function printReport(stats: GitHubStatsOutput, mode: string): void {
  console.log("\n======================================================");
  console.log(`        GITHUB ACTIVITY & STATS REPORT [${mode.toUpperCase()}]`);
  console.log("======================================================");
  console.log(`User:         ${stats.metadata.username}`);
  console.log(
    `Period:       ${stats.metadata.period.from} → ${stats.metadata.period.to}`,
  );
  console.log(`Generated:    ${stats.metadata.generated_at}`);
  console.log("------------------------------------------------------");

  console.log("📊 1. LINES OF CODE (ALL REPOSITORIES)");
  console.log(
    `  - Total Additions: +${stats.lines_of_code.total_additions.toLocaleString()} lines`,
  );
  console.log(
    `  - Total Deletions: -${stats.lines_of_code.total_deletions.toLocaleString()} lines`,
  );
  console.log(
    `  - Net Code Change:  ${stats.lines_of_code.net_lines.toLocaleString()} lines`,
  );

  console.log("\n💻 2. TOP 5 LANGUAGES");
  for (const lang of stats.languages.slice(0, 5)) {
    const bar = "█".repeat(Math.round(lang.percentage / 5));
    console.log(
      `  - ${lang.name.padEnd(14)} ${lang.percentage.toFixed(2).padStart(6)}% [${bar}] (${(lang.bytes / 1024).toFixed(1)} KB)`,
    );
  }

  console.log("\n📦 3. REPOSITORIES OWNED");
  console.log(
    `  - Total Owned:     ${stats.repositories.total_owned} (Public: ${stats.repositories.public}, Private: ${stats.repositories.private}, Forks: ${stats.repositories.forks})`,
  );
  console.log(`  - Total Stars:     ⭐ ${stats.repositories.total_stars}`);
  console.log(`  - Total Forks:     🍴 ${stats.repositories.total_forks}`);

  console.log("\n🔥 4. TOTAL CONTRIBUTIONS");
  console.log(
    `  - Grand Total:     ${stats.contributions.total.toLocaleString()}`,
  );
  console.log(
    `  - Public / Private:${stats.contributions.public.toLocaleString()} public | ${stats.contributions.private.toLocaleString()} private (${((stats.contributions.private / (stats.contributions.total || 1)) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  - Breakdown:       ${stats.contributions.commits.toLocaleString()} commits, ${stats.contributions.pull_requests.toLocaleString()} PRs, ${stats.contributions.issues.toLocaleString()} issues, ${stats.contributions.reviews.toLocaleString()} reviews`,
  );

  console.log("\n🚀 5. TOP REPOSITORIES");
  console.log(
    `  - Distinct Repos:  ${stats.repositories_contributed_to.length} repositories`,
  );
  for (const repo of stats.repositories_contributed_to.slice(0, 8)) {
    const tag = repo.is_private
      ? "[Private]"
      : repo.is_fork
        ? "[Fork]"
        : "[Public]";
    console.log(
      `    • ${repo.repository.padEnd(32)} ${tag.padEnd(10)} +${repo.additions.toLocaleString()}/-${repo.deletions.toLocaleString()} LOC | ${repo.total_contributions} contribs (${repo.commits}c, ${repo.pull_requests}pr)`,
    );
  }

  console.log("\n📈 6. STREAKS & CONSISTENCY");
  console.log(
    `  - Longest Streak:  ${stats.streaks_and_consistency.longest_streak_days} days`,
  );
  console.log(
    `  - Current Streak:  ${stats.streaks_and_consistency.current_streak_days} days`,
  );
  console.log(
    `  - Active Days:     ${stats.streaks_and_consistency.active_days_count} / ${stats.streaks_and_consistency.total_days_in_period} days (${stats.streaks_and_consistency.activity_rate_percentage}%)`,
  );
  if (stats.streaks_and_consistency.busiest_day.date) {
    console.log(
      `  - Busiest Day:     ${stats.streaks_and_consistency.busiest_day.date} (${stats.streaks_and_consistency.busiest_day.count} contributions)`,
    );
  }

  console.log("\n🔄 7. PULL REQUESTS");
  console.log(`  - Total Opened:    ${stats.pull_requests.total}`);
  console.log(
    `  - Merged:          ${stats.pull_requests.merged} (${stats.pull_requests.merge_rate_percentage}% merge rate)`,
  );
  console.log(`  - Open:            ${stats.pull_requests.open}`);
  console.log(`  - Closed (no merge):${stats.pull_requests.closed_unmerged}`);

  console.log("\n💾 DATA FILE SAVED");
  console.log(`  ✔ data/github-stats.json`);
  console.log("======================================================\n");
}

async function executeIncremental(
  existing: GitHubStatsOutput,
  window: DateRange,
  viewer: ViewerContext,
): Promise<GitHubStatsOutput> {
  console.log(
    `Executing incremental update for window: ${window.from} → ${window.to}`,
  );

  const windowData = await fetchContributionsWindow(window.from, window.to);

  const daily = { ...existing.daily_contributions, ...windowData.daily };
  const grandTotal = Object.values(daily).reduce(
    (sum, count) => sum + count,
    0,
  );

  const activeNames = Array.from(windowData.repoContributions.keys());
  const candidateRepos = activeNames.map((name) => {
    const meta = viewer.repositories.find((r) => r.nameWithOwner === name);
    return {
      nameWithOwner: name,
      isPrivate:
        meta?.isPrivate ??
        windowData.repoContributions.get(name)?.isPrivate ??
        false,
      isFork: meta?.isFork ?? false,
    };
  });

  const locResults = await fetchRepoLOC(viewer.id, candidateRepos, window);

  let newAdditions = 0;
  let newDeletions = 0;
  for (const loc of locResults.values()) {
    newAdditions += loc.additions;
    newDeletions += loc.deletions;
  }

  const repoMap = new Map(
    existing.repositories_contributed_to.map((r) => [r.repository, { ...r }]),
  );

  for (const [name, stat] of windowData.repoContributions.entries()) {
    const loc = locResults.get(name);
    const adds = loc?.additions ?? 0;
    const dels = loc?.deletions ?? 0;
    const commitCount = Math.max(stat.commits, loc?.commit_count ?? 0);
    const contribCount =
      commitCount + stat.issues + stat.pullRequests + stat.reviews;

    if (repoMap.has(name)) {
      const entry = repoMap.get(name)!;
      entry.commits += commitCount;
      entry.issues += stat.issues;
      entry.pull_requests += stat.pullRequests;
      entry.reviews += stat.reviews;
      entry.additions += adds;
      entry.deletions += dels;
      entry.net_lines = entry.additions - entry.deletions;
      entry.total_contributions += contribCount;
    } else {
      repoMap.set(name, {
        repository: name,
        is_private: stat.isPrivate,
        is_fork:
          candidateRepos.find((r) => r.nameWithOwner === name)?.isFork ?? false,
        commits: commitCount,
        issues: stat.issues,
        pull_requests: stat.pullRequests,
        reviews: stat.reviews,
        additions: adds,
        deletions: dels,
        net_lines: adds - dels,
        total_contributions: contribCount,
      });
    }
  }

  const windowPRs = await fetchPullRequests(viewer.login, window);
  const totalPRs = existing.pull_requests.total + windowPRs.total;
  const mergedPRs = existing.pull_requests.merged + windowPRs.merged;

  let windowPub = 0;
  let windowPriv = 0;
  let windowOrg = 0;
  let windowCommits = 0;

  for (const [name, stat] of windowData.repoContributions.entries()) {
    const loc = locResults.get(name);
    const commitCount = Math.max(stat.commits, loc?.commit_count ?? 0);
    windowCommits += commitCount;
    if (name.startsWith(viewer.login + "/")) {
      if (stat.isPrivate) windowPriv++;
      else windowPub++;
    } else {
      windowOrg++;
    }
  }

  const weeklySummary = {
    period: window,
    lines_of_code: {
      total_additions: newAdditions,
      total_deletions: newDeletions,
      net_lines: newAdditions - newDeletions,
    },
    commits: windowCommits || windowData.commits,
    pull_requests: windowPRs,
    streaks_and_consistency: calculateStreaks(windowData.daily, window),
    repositories: {
      total: windowData.repoContributions.size,
      public: windowPub,
      private: windowPriv,
      org: windowOrg,
    },
  };

  const fullPeriod: DateRange = {
    from: existing.metadata.period.from,
    to:
      window.to > existing.metadata.period.to
        ? window.to
        : existing.metadata.period.to,
  };

  return {
    metadata: {
      username: viewer.login,
      generated_at: new Date().toISOString(),
      period: fullPeriod,
    },
    lines_of_code: {
      total_additions: existing.lines_of_code.total_additions + newAdditions,
      total_deletions: existing.lines_of_code.total_deletions + newDeletions,
      net_lines:
        existing.lines_of_code.total_additions +
        newAdditions -
        (existing.lines_of_code.total_deletions + newDeletions),
    },
    languages: calculateLanguages(viewer.repositories, viewer.login),
    repositories: calculateRepositorySummary(viewer.repositories, viewer.login),
    contributions: {
      commits: existing.contributions.commits + windowData.commits,
      pull_requests:
        existing.contributions.pull_requests + windowData.pullRequests,
      issues: existing.contributions.issues + windowData.issues,
      reviews: existing.contributions.reviews + windowData.reviews,
      public:
        existing.contributions.public +
        (windowData.commits +
          windowData.pullRequests +
          windowData.issues +
          windowData.reviews),
      private: existing.contributions.private + windowData.restricted,
      total: grandTotal,
    },
    streaks_and_consistency: calculateStreaks(daily, fullPeriod),
    pull_requests: {
      total: totalPRs,
      merged: mergedPRs,
      open: windowPRs.open,
      closed_unmerged:
        existing.pull_requests.closed_unmerged + windowPRs.closed_unmerged,
      merge_rate_percentage:
        totalPRs > 0
          ? parseFloat(((mergedPRs / totalPRs) * 100).toFixed(2))
          : 0,
    },
    repositories_contributed_to: Array.from(repoMap.values()).sort(
      (a, b) =>
        b.total_contributions - a.total_contributions ||
        b.additions - a.additions,
    ),
    daily_contributions: daily,
    weekly_summary: weeklySummary,
    monthly_history: existing.monthly_history,
  };
}

async function executeFullBackfill(
  dateRange: DateRange,
  viewer: ViewerContext,
): Promise<GitHubStatsOutput> {
  console.log(
    `Executing full historical backfill: ${dateRange.from} → ${dateRange.to}`,
  );

  const startYear = parseInt(dateRange.from.slice(0, 4), 10);
  const endYear = parseInt(dateRange.to.slice(0, 4), 10);

  const mergedDaily: Record<string, number> = {};
  const repoContribs = new Map<string, RepoContribDelta>();

  let commits = 0;
  let issues = 0;
  let pullRequests = 0;
  let reviews = 0;
  let restricted = 0;

  for (let year = startYear; year <= endYear; year++) {
    const from =
      year === startYear ? dateRange.from : `${year}-01-01T00:00:00Z`;
    const to = year === endYear ? dateRange.to : `${year}-12-31T23:59:59Z`;

    const yearData = await fetchContributionsWindow(from, to);
    commits += yearData.commits;
    issues += yearData.issues;
    pullRequests += yearData.pullRequests;
    reviews += yearData.reviews;
    restricted += yearData.restricted;

    Object.assign(mergedDaily, yearData.daily);

    for (const [name, stat] of yearData.repoContributions.entries()) {
      const entry = repoContribs.get(name) ?? {
        commits: 0,
        issues: 0,
        pullRequests: 0,
        reviews: 0,
        isPrivate: stat.isPrivate,
      };
      entry.commits += stat.commits;
      entry.issues += stat.issues;
      entry.pullRequests += stat.pullRequests;
      entry.reviews += stat.reviews;
      repoContribs.set(name, entry);
    }
  }

  const candidateMap = new Map<
    string,
    { nameWithOwner: string; isPrivate: boolean; isFork: boolean }
  >();
  for (const r of viewer.repositories) {
    candidateMap.set(r.nameWithOwner, {
      nameWithOwner: r.nameWithOwner,
      isPrivate: r.isPrivate,
      isFork: r.isFork,
    });
  }
  for (const [name, stat] of repoContribs.entries()) {
    if (!candidateMap.has(name)) {
      candidateMap.set(name, {
        nameWithOwner: name,
        isPrivate: stat.isPrivate,
        isFork: false,
      });
    }
  }

  const locResults = await fetchRepoLOC(
    viewer.id,
    Array.from(candidateMap.values()),
    dateRange,
  );

  let totalAdditions = 0;
  let totalDeletions = 0;
  for (const loc of locResults.values()) {
    totalAdditions += loc.additions;
    totalDeletions += loc.deletions;
  }

  const prSummary = await fetchPullRequests(viewer.login, dateRange);
  const grandTotal = Object.values(mergedDaily).reduce(
    (sum, count) => sum + count,
    0,
  );

  return {
    metadata: {
      username: viewer.login,
      generated_at: new Date().toISOString(),
      period: dateRange,
    },
    lines_of_code: {
      total_additions: totalAdditions,
      total_deletions: totalDeletions,
      net_lines: totalAdditions - totalDeletions,
    },
    languages: calculateLanguages(viewer.repositories, viewer.login),
    repositories: calculateRepositorySummary(viewer.repositories, viewer.login),
    contributions: {
      total: grandTotal,
      commits,
      pull_requests: pullRequests,
      issues,
      reviews,
      public: commits + pullRequests + issues + reviews,
      private: restricted,
    },
    streaks_and_consistency: calculateStreaks(mergedDaily, dateRange),
    pull_requests: prSummary,
    repositories_contributed_to: buildRepositoryActivities({
      repoContributions: repoContribs,
      locResults,
      viewerRepos: viewer.repositories,
    }),
    daily_contributions: mergedDaily,
  };
}

async function main() {
  const { dateRange, isIncremental, dataDir } = parseCliArgs();
  const filePath = path.join(dataDir, "github-stats.json");

  const viewer = await fetchViewerContext();
  let stats: GitHubStatsOutput;
  let mode: string;

  if (isIncremental && existsSync(filePath)) {
    const existing = JSON.parse(
      readFileSync(filePath, "utf-8"),
    ) as GitHubStatsOutput;
    stats = await executeIncremental(existing, dateRange, viewer);
    mode = "Incremental (Sunday → Saturday)";
  } else {
    stats = await executeFullBackfill(dateRange, viewer);
    mode = "Full Historical (2021 → Date)";
  }

  mkdirSync(dataDir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(stats, null, 2), "utf-8");

  printReport(stats, mode);
}

main().catch((err) => {
  console.error(
    "\n[FATAL ERROR]",
    err instanceof Error ? err.stack || err.message : err,
  );
  process.exit(1);
});
