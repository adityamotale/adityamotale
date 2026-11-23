import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export * from "./lib/types.ts";
export * from "./lib/gh-client.ts";
export * from "./lib/queries.ts";
export * from "./lib/aggregator.ts";
export * from "./lib/delta.ts";

import type {
  DateRange,
  GitHubStatsOutput,
  GraphQLOptions,
  PeriodMetrics,
  PullRequestSummary,
  ReleaseItem,
  RepoActivityStat,
  RepoContribDelta,
  RepoLocStat,
  ViewerContext,
  ViewerRepoNode,
  WindowContributions,
  YearlyContributionItem,
} from "./lib/types.ts";
import { runGraphQLAsync } from "./lib/gh-client.ts";
import {
  GET_CONTRIBUTIONS_QUERY,
  GET_PRS_QUERY,
  GET_REPO_COMMIT_LOC_QUERY,
  GET_VIEWER_QUERY,
} from "./lib/queries.ts";
import {
  buildRepositoryActivities,
  calculateCategoryMetrics,
  calculateLanguages,
  calculateRepositorySummary,
  calculateStreaks,
  calculateWeightedLanguages,
  classifyRepoTier,
  extractReleases,
} from "./lib/aggregator.ts";
import {
  formatMonthLabel,
  getSundayToSaturdayWindow,
  mergeWeeklyDelta,
} from "./lib/delta.ts";

export const EXCLUDED_REPOSITORIES = new Set<string>([
  "KinariwalaS/MitRa_admission_new",
]);

export async function fetchViewerContext(
  options?: GraphQLOptions,
): Promise<ViewerContext> {
  const allRepos: ViewerRepoNode[] = [];
  const organizations = new Set<string>();
  let cursor: string | null = null;
  let hasNextPage = true;
  let login = "";
  let id = "";
  let name: string | null = null;

  while (hasNextPage) {
    const data: any = await runGraphQLAsync(
      GET_VIEWER_QUERY,
      { cursor },
      options,
    );
    const viewer = data.viewer;
    if (!viewer) break;

    login = viewer.login;
    id = viewer.id;
    name = viewer.name || null;

    for (const org of viewer.organizations?.nodes || []) {
      if (org?.login) organizations.add(org.login.toLowerCase());
    }

    for (const node of viewer.allRepos?.nodes || []) {
      allRepos.push(node);
      if (node.owner?.login && node.owner.login !== login) {
        organizations.add(node.owner.login.toLowerCase());
      }
    }

    hasNextPage = viewer.allRepos?.pageInfo?.hasNextPage;
    cursor = viewer.allRepos?.pageInfo?.endCursor;
  }

  return { id, login, name, organizations, allRepos };
}

export async function fetchContributionsWindow(
  fromISO: string,
  toISO: string,
  options?: GraphQLOptions,
): Promise<WindowContributions> {
  const data: any = await runGraphQLAsync(
    GET_CONTRIBUTIONS_QUERY,
    { from: fromISO, to: toISO },
    options,
  );
  const cc = data.viewer?.contributionsCollection;
  if (!cc) {
    throw new Error(`Failed to fetch contributions for ${fromISO} - ${toISO}`);
  }

  const repoContributions = new Map<string, RepoContribDelta>();

  const getOrCreate = (
    name: string,
    isPrivate: boolean,
    isArchived = false,
  ): RepoContribDelta => {
    if (!repoContributions.has(name)) {
      repoContributions.set(name, {
        commits: 0,
        issues: 0,
        pullRequests: 0,
        reviews: 0,
        isPrivate,
        isFork: false,
        isArchived,
      });
    }
    return repoContributions.get(name)!;
  };

  const tally = (items: any[], field: keyof RepoContribDelta) => {
    for (const item of items || []) {
      if (!item?.repository?.nameWithOwner) continue;
      const entry = getOrCreate(
        item.repository.nameWithOwner,
        Boolean(item.repository.isPrivate),
        Boolean(item.repository.isArchived),
      );
      (entry[field] as number) += item.contributions?.totalCount || 0;
    }
  };

  tally(cc.commitContributionsByRepository, "commits");
  tally(cc.pullRequestContributionsByRepository, "pullRequests");
  tally(cc.pullRequestReviewContributionsByRepository, "reviews");

  const daily: Record<string, number> = {};
  for (const week of cc.contributionCalendar?.weeks || []) {
    for (const day of week.contributionDays || []) {
      daily[day.date] = day.contributionCount;
    }
  }

  return {
    totalCommits: cc.totalCommitContributions || 0,
    totalPRs: cc.totalPullRequestContributions || 0,
    totalIssues: cc.totalIssueContributions || 0,
    totalReviews: cc.totalPullRequestReviewContributions || 0,
    repos: repoContributions,
    daily,
  };
}

export async function fetchRepoLOC(
  repos: Array<{ nameWithOwner: string; isPrivate: boolean; isFork: boolean }>,
  viewerId: string,
  dateRange: DateRange,
  concurrency = 0x05,
  options?: GraphQLOptions,
): Promise<Map<string, RepoLocStat>> {
  const results = new Map<string, RepoLocStat>();

  for (let i = 0; i < repos.length; i += concurrency) {
    const chunk = repos.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async ({ nameWithOwner, isPrivate, isFork }) => {
        const [owner, name] = nameWithOwner.split("/");
        if (!owner || !name) return;

        let additions = 0;
        let deletions = 0;
        let commitCount = 0;
        let cursor: string | null = null;
        let hasNextPage = true;
        let repoLanguages: Array<{
          name: string;
          color: string | null;
          size: number;
        }> = [];

        try {
          while (hasNextPage) {
            const data: any = await runGraphQLAsync(
              GET_REPO_COMMIT_LOC_QUERY,
              {
                owner,
                name,
                authorId: viewerId,
                since: dateRange.from,
                until: dateRange.to,
                cursor,
              },
              options,
            );

            if (
              data.repository?.languages?.edges &&
              repoLanguages.length === 0
            ) {
              repoLanguages = data.repository.languages.edges.map((e: any) => ({
                name: e.node.name,
                color: e.node.color ?? null,
                size: e.size ?? 0,
              }));
            }

            const history = data.repository?.defaultBranchRef?.target?.history;
            if (!history?.nodes) break;

            for (const commit of history.nodes) {
              commitCount++;
              additions += commit.additions || 0;
              deletions += commit.deletions || 0;
            }

            hasNextPage = history.pageInfo?.hasNextPage;
            cursor = history.pageInfo?.endCursor;
          }

          if (commitCount > 0 || additions > 0 || deletions > 0) {
            results.set(nameWithOwner, {
              repository: nameWithOwner,
              is_private: isPrivate,
              is_fork: isFork,
              additions,
              deletions,
              commit_count: commitCount,
              languages: repoLanguages,
            });
          }
        } catch (err: unknown) {
          console.warn(
            `Failed to fetch commit LoC for ${nameWithOwner}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }),
    );
  }

  return results;
}

export async function fetchPullRequests(
  username: string,
  dateRange: DateRange,
  options?: GraphQLOptions,
): Promise<PullRequestSummary> {
  const fromDate = dateRange.from.slice(0, 10);
  const toDate = dateRange.to.slice(0, 10);
  const searchQuery = `author:${username} type:pr created:${fromDate}..${toDate}`;

  let total = 0;
  let merged = 0;
  let closedUnmerged = 0;
  let open = 0;
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data: any = await runGraphQLAsync(
      GET_PRS_QUERY,
      { searchQuery, cursor },
      options,
    );
    const search = data.search;
    if (!search?.nodes) break;

    for (const pr of search.nodes) {
      total++;
      if (pr.merged) {
        merged++;
      } else if (pr.state === "CLOSED") {
        closedUnmerged++;
      } else {
        open++;
      }
    }

    hasNextPage = search.pageInfo?.hasNextPage;
    cursor = search.pageInfo?.endCursor;
  }

  const mergeRate =
    total > 0 ? parseFloat(((merged / total) * 100).toFixed(1)) : 0;

  return {
    total,
    merged,
    closed_unmerged: closedUnmerged,
    open,
    merge_rate_percentage: mergeRate,
  };
}

export function parseCliArgs(): {
  mode: "incremental" | "full-backfill";
  days?: number;
  from?: string;
  to?: string;
  outputFile?: string;
} {
  const args = process.argv.slice(2);
  let mode: "incremental" | "full-backfill" = "incremental";
  let days: number | undefined;
  let from: string | undefined;
  let to: string | undefined;
  let outputFile: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--full-backfill" || arg === "--init") {
      mode = "full-backfill";
    } else if (arg === "--last-week") {
      mode = "incremental";
    } else if (arg === "--days" && args[i + 1]) {
      days = parseInt(args[++i], 10);
    } else if (arg === "--from" && args[i + 1]) {
      from = args[++i];
    } else if (arg === "--to" && args[i + 1]) {
      to = args[++i];
    } else if (arg === "--output" && args[i + 1]) {
      outputFile = args[++i];
    }
  }

  return { mode, days, from, to, outputFile };
}

export async function executeIncremental(
  args: { days?: number; from?: string; to?: string },
  existingData: GitHubStatsOutput,
  options?: GraphQLOptions,
): Promise<GitHubStatsOutput> {
  let dateRange: DateRange;
  if (args.from && args.to) {
    dateRange = {
      from: args.from.includes("T") ? args.from : `${args.from}T00:00:00Z`,
      to: args.to.includes("T") ? args.to : `${args.to}T23:59:59Z`,
    };
  } else if (args.days) {
    const to = new Date();
    const from = new Date(to.getTime() - args.days * 24 * 60 * 60 * 1000);
    dateRange = {
      from: `${from.toISOString().slice(0, 10)}T00:00:00Z`,
      to: `${to.toISOString().slice(0, 10)}T23:59:59Z`,
    };
  } else {
    dateRange = getSundayToSaturdayWindow();
  }

  console.log(
    `\n==> Fetching GitHub incremental stats (${dateRange.from} - ${dateRange.to})`,
  );
  const viewer = await fetchViewerContext(options);
  const windowData = await fetchContributionsWindow(
    dateRange.from,
    dateRange.to,
    options,
  );

  const reposToFetchLOC = Array.from(windowData.repos.entries())
    .filter(([name]) => !EXCLUDED_REPOSITORIES.has(name))
    .map(([name, r]) => ({
      nameWithOwner: name,
      isPrivate: r.isPrivate,
      isFork: r.isFork,
    }));

  const locResults = await fetchRepoLOC(
    reposToFetchLOC,
    viewer.id,
    dateRange,
    5,
    options,
  );
  const prSummary = await fetchPullRequests(viewer.login, dateRange, options);

  let windowAdditions = 0;
  let windowDeletions = 0;
  for (const loc of locResults.values()) {
    windowAdditions += loc.additions;
    windowDeletions += loc.deletions;
  }

  const windowActivities = buildRepositoryActivities({
    repoContributions: windowData.repos,
    locResults,
    viewerRepos: viewer.allRepos,
    username: viewer.login,
    affiliatedOrgs: viewer.organizations,
  });

  const streaks = calculateStreaks(windowData.daily, dateRange);
  const topLanguages = calculateWeightedLanguages(windowActivities);

  const windowPublicRepos = windowActivities.filter(
    (r) => !r.is_private,
  ).length;
  const windowPrivateRepos = windowActivities.filter(
    (r) => r.is_private,
  ).length;
  const windowOrgRepos = windowActivities.filter(
    (r) => r.tier === "organization",
  ).length;
  const windowRepoSummary = {
    total: windowActivities.length,
    public: windowPublicRepos,
    private: windowPrivateRepos,
    org: windowOrgRepos,
  };

  const windowMetrics: PeriodMetrics = {
    period: dateRange,
    commits: windowData.totalCommits,
    lines_of_code: {
      total_additions: windowAdditions,
      total_deletions: windowDeletions,
      net_lines: windowAdditions - windowDeletions,
    },
    pull_requests: prSummary,
    repositories: windowRepoSummary,
    streaks_and_consistency: streaks,
    languages: topLanguages,
  };

  const newReleases = extractReleases(viewer.allRepos, windowActivities);

  return mergeWeeklyDelta({
    existing: existingData,
    windowMetrics,
    windowActivities,
    newReleases,
    user: { login: viewer.login, name: viewer.name },
  });
}

export async function executeFullBackfill(
  options?: GraphQLOptions,
): Promise<GitHubStatsOutput> {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const startYear = 2021;
  const dateRange: DateRange = {
    from: "2021-01-01T00:00:00Z",
    to: now.toISOString(),
  };

  console.log(
    `\n==> Executing full historical backfill from ${dateRange.from} to ${dateRange.to}`,
  );
  const viewer = await fetchViewerContext(options);

  const mergedDaily: Record<string, number> = {};
  const repoContributions = new Map<string, RepoContribDelta>();
  let totalCommits = 0;
  let totalPRs = 0;
  let totalIssues = 0;
  let totalReviews = 0;

  const yearlyContributions: YearlyContributionItem[] = [];

  for (let year = startYear; year <= currentYear; year++) {
    const from =
      year === startYear ? dateRange.from : `${year}-01-01T00:00:00Z`;
    const to = year === currentYear ? dateRange.to : `${year}-12-31T23:59:59Z`;

    console.log(`  -> Fetching contribution window for ${year}...`);
    const yearData = await fetchContributionsWindow(from, to, options);
    totalCommits += yearData.totalCommits;
    totalPRs += yearData.totalPRs;
    totalIssues += yearData.totalIssues;
    totalReviews += yearData.totalReviews;

    Object.assign(mergedDaily, yearData.daily);

    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const numDays = isLeap ? 366 : 365;
    const days: number[] = [];
    const weeks: number[] = [];
    let runningTotal = 0;

    for (let d = 0; d < numDays; d++) {
      const cur = new Date(Date.UTC(year, 0, 1 + d));
      if (year === currentYear && cur > now) {
        break;
      }
      const dateStr = cur.toISOString().slice(0, 10);
      const count = yearData.daily[dateStr] || 0;
      runningTotal += count;
      days.push(runningTotal);
      if (d % 7 === 0 || d === numDays - 1) {
        weeks.push(runningTotal);
      }
    }

    yearlyContributions.push({
      year,
      total: runningTotal,
      weeks,
      days,
    });

    for (const [name, delta] of yearData.repos.entries()) {
      const entry = repoContributions.get(name) ?? {
        commits: 0,
        issues: 0,
        pullRequests: 0,
        reviews: 0,
        isPrivate: delta.isPrivate,
        isFork: delta.isFork,
        isArchived: delta.isArchived,
      };
      entry.commits += delta.commits;
      entry.issues += delta.issues;
      entry.pullRequests += delta.pullRequests;
      entry.reviews += delta.reviews;
      repoContributions.set(name, entry);
    }
  }

  const candidateMap = new Map<
    string,
    { nameWithOwner: string; isPrivate: boolean; isFork: boolean }
  >();

  for (const r of viewer.allRepos) {
    if (r.isArchived || EXCLUDED_REPOSITORIES.has(r.nameWithOwner)) continue;
    candidateMap.set(r.nameWithOwner, {
      nameWithOwner: r.nameWithOwner,
      isPrivate: r.isPrivate,
      isFork: r.isFork,
    });
  }

  for (const [name, stat] of repoContributions.entries()) {
    if (stat.isArchived || EXCLUDED_REPOSITORIES.has(name)) continue;
    if (!candidateMap.has(name)) {
      candidateMap.set(name, {
        nameWithOwner: name,
        isPrivate: stat.isPrivate,
        isFork: stat.isFork,
      });
    }
  }

  console.log(
    `  -> Fetching commit LoC across ${candidateMap.size} repositories...`,
  );
  const locResults = await fetchRepoLOC(
    Array.from(candidateMap.values()),
    viewer.id,
    dateRange,
    5,
    options,
  );

  console.log(`  -> Fetching pull requests summary...`);
  const prSummary = await fetchPullRequests(viewer.login, dateRange, options);

  let totalAdditions = 0;
  let totalDeletions = 0;
  for (const loc of locResults.values()) {
    totalAdditions += loc.additions;
    totalDeletions += loc.deletions;
  }

  const activities = buildRepositoryActivities({
    repoContributions,
    locResults,
    viewerRepos: viewer.allRepos,
    username: viewer.login,
    affiliatedOrgs: viewer.organizations,
  });

  const categories = calculateCategoryMetrics(activities);
  const reposSummary = calculateRepositorySummary(
    viewer.allRepos,
    viewer.login,
  );
  const languages = calculateWeightedLanguages(activities);
  const streaks = calculateStreaks(mergedDaily, dateRange);
  const releases = extractReleases(viewer.allRepos, activities);

  // Generate rolling 6 months history
  const monthlyHistory = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    const mNum = d.getUTCMonth() + 1;
    const mLabel = formatMonthLabel(d);
    const lastDayOfMonth = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    const mFrom = `${d.toISOString().slice(0, 7)}-01T00:00:00Z`;
    const mTo =
      i === 0
        ? now.toISOString()
        : `${d.toISOString().slice(0, 7)}-${String(lastDayOfMonth).padStart(2, "0")}T23:59:59Z`;

    // Filter daily activity for this month
    const mDaily: Record<string, number> = {};
    let mCommits = 0;
    for (const [day, count] of Object.entries(mergedDaily)) {
      if (day >= mFrom.slice(0, 10) && day <= mTo.slice(0, 10)) {
        mDaily[day] = count;
        mCommits += count;
      }
    }

    const mStreaks = calculateStreaks(mDaily, { from: mFrom, to: mTo });
    const approxAdds = Math.round(
      (mCommits / (totalCommits || 1)) * totalAdditions,
    );
    const approxDels = Math.round(
      (mCommits / (totalCommits || 1)) * totalDeletions,
    );

    monthlyHistory.push({
      label: mLabel,
      month: mNum,
      period: { from: mFrom, to: mTo },
      commits: mCommits,
      lines_of_code: {
        total_additions: approxAdds,
        total_deletions: approxDels,
        net_lines: approxAdds - approxDels,
      },
      pull_requests: {
        total: Math.round((mCommits / (totalCommits || 1)) * prSummary.total),
        merged: Math.round((mCommits / (totalCommits || 1)) * prSummary.merged),
        closed_unmerged: 0,
        open: 0,
        merge_rate_percentage: prSummary.merge_rate_percentage,
      },
      repositories: {
        total: Math.max(1, Math.round(activities.length * 0.1)),
        public: Math.max(1, Math.round(activities.length * 0.08)),
        private: Math.round(activities.length * 0.02),
        org: Math.max(1, Math.round(activities.length * 0.05)),
      },
      streaks_and_consistency: mStreaks,
      languages: languages.slice(0, 5),
    });
  }

  const weeklyWindow = getSundayToSaturdayWindow(now);
  const weeklyDaily: Record<string, number> = {};
  let weeklyCommits = 0;
  for (const [day, count] of Object.entries(mergedDaily)) {
    if (
      day >= weeklyWindow.from.slice(0, 10) &&
      day <= weeklyWindow.to.slice(0, 10)
    ) {
      weeklyDaily[day] = count;
      weeklyCommits += count;
    }
  }

  const weeklyStreaks = calculateStreaks(weeklyDaily, weeklyWindow);
  const wAdds = Math.round(
    (weeklyCommits / (totalCommits || 1)) * totalAdditions,
  );
  const wDels = Math.round(
    (weeklyCommits / (totalCommits || 1)) * totalDeletions,
  );

  return {
    generated_at: new Date().toISOString(),
    period: dateRange,
    user: {
      login: viewer.login,
      name: viewer.name,
    },
    categories,
    contributions: {
      total: totalCommits + prSummary.total + totalReviews,
      commits: totalCommits,
      pull_requests: prSummary.total,
      reviews: totalReviews,
      issues: totalIssues,
      public: totalCommits,
      private: 0,
    },
    lines_of_code: {
      total_additions: totalAdditions,
      total_deletions: totalDeletions,
      net_lines: totalAdditions - totalDeletions,
    },
    repositories: reposSummary,
    pull_requests: prSummary,
    streaks_and_consistency: streaks,
    languages,
    repositories_contributed_to: activities,
    releases,
    monthly_history: monthlyHistory,
    weekly_summary: {
      period: weeklyWindow,
      commits: weeklyCommits,
      lines_of_code: {
        total_additions: wAdds,
        total_deletions: wDels,
        net_lines: wAdds - wDels,
      },
      pull_requests: {
        total: 0,
        merged: 0,
        closed_unmerged: 0,
        open: 0,
        merge_rate_percentage: 0,
      },
      repositories: {
        total: Math.max(1, Math.round(activities.length * 0.05)),
        public: Math.max(1, Math.round(activities.length * 0.04)),
        private: 0,
        org: Math.max(1, Math.round(activities.length * 0.03)),
      },
      streaks_and_consistency: weeklyStreaks,
      languages: languages.slice(0, 3),
    },
    yearly_contributions: yearlyContributions,
  };
}

export function printReport(stats: GitHubStatsOutput, mode: string): void {
  console.log(`\n======================================================`);
  console.log(`  GitHub Stats Generated (${mode})`);
  console.log(`======================================================`);
  console.log(`  User:        ${stats.user?.login || "anonymous"}`);
  console.log(`  Commits:     ${stats.contributions.commits.toLocaleString()}`);
  console.log(
    `  Net LoC:     ${stats.lines_of_code.net_lines.toLocaleString()}`,
  );
  console.log(
    `  LoC Added:   +${stats.lines_of_code.total_additions.toLocaleString()}`,
  );
  console.log(
    `  LoC Removed: -${stats.lines_of_code.total_deletions.toLocaleString()}`,
  );
  console.log(
    `  PRs Merged:  ${stats.pull_requests.merged}/${stats.pull_requests.total}`,
  );
  console.log(
    `  Top Stack:   ${
      stats.languages
        .slice(0, 3)
        .map((l) => `${l.name} (${l.percentage}%)`)
        .join(", ") || "--"
    }`,
  );
  console.log(`  Releases:    ${stats.releases?.length || 0} tracked`);
  console.log(`======================================================\n`);
}

export async function main() {
  const cliArgs = parseCliArgs();
  const rootDir = process.cwd().endsWith("scripts")
    ? path.resolve(process.cwd(), "..")
    : process.cwd();
  const dataDir = path.join(rootDir, "data");
  const statsFilePath =
    cliArgs.outputFile || path.join(dataDir, "github-stats.json");

  mkdirSync(dataDir, { recursive: true });

  let existingData: GitHubStatsOutput | null = null;
  if (existsSync(statsFilePath)) {
    try {
      existingData = JSON.parse(readFileSync(statsFilePath, "utf-8"));
    } catch {
      existingData = null;
    }
  }

  let finalStats: GitHubStatsOutput;
  if (cliArgs.mode === "full-backfill" || !existingData) {
    finalStats = await executeFullBackfill();
  } else {
    finalStats = await executeIncremental(cliArgs, existingData);
  }

  writeFileSync(statsFilePath, JSON.stringify(finalStats, null, 2) + "\n");
  printReport(finalStats, cliArgs.mode);
}

if (process.argv[1] && process.argv[1].endsWith("fetch-github-stats.ts")) {
  main().catch((err) => {
    console.error(`Fatal error in fetch-github-stats:`, err);
    process.exit(1);
  });
}
