import type {
  DateRange,
  GitHubStatsOutput,
  MonthlyStatItem,
  PeriodMetrics,
  ReleaseItem,
  RepoActivityStat,
} from "./types.ts";
import {
  calculateCategoryMetrics,
  calculateWeightedLanguages,
} from "./aggregator.ts";

export function getSundayToSaturdayWindow(now = new Date()): DateRange {
  const dayOfWeek = now.getUTCDay();
  const daysSinceSaturday = (dayOfWeek + 1) % 7 || 7;

  const lastSaturday = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysSinceSaturday,
    ),
  );
  const prevSunday = new Date(
    Date.UTC(
      lastSaturday.getUTCFullYear(),
      lastSaturday.getUTCMonth(),
      lastSaturday.getUTCDate() - 6,
    ),
  );

  return {
    from: `${prevSunday.toISOString().slice(0, 10)}T00:00:00Z`,
    to: `${lastSaturday.toISOString().slice(0, 10)}T23:59:59Z`,
  };
}

export function formatMonthLabel(date: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const m = months[date.getUTCMonth()];
  const y = String(date.getUTCFullYear()).slice(-2);
  return `${m} '${y}`;
}

export function mergeWeeklyDelta(params: {
  existing: GitHubStatsOutput;
  windowMetrics: PeriodMetrics;
  windowActivities: RepoActivityStat[];
  newReleases?: ReleaseItem[];
  user?: { login: string; name?: string | null };
}): GitHubStatsOutput {
  const {
    existing,
    windowMetrics,
    windowActivities,
    newReleases = [],
    user,
  } = params;

  const updated: GitHubStatsOutput = structuredClone(existing);
  updated.generated_at = new Date().toISOString();

  if (user) {
    updated.user = user;
  } else if (!updated.user && (existing as any).metadata?.username) {
    updated.user = { login: (existing as any).metadata.username };
  }

  // 1. Merge Lines of Code
  const adds = windowMetrics.lines_of_code.total_additions || 0;
  const dels = windowMetrics.lines_of_code.total_deletions || 0;
  const net = windowMetrics.lines_of_code.net_lines || adds - dels;

  updated.lines_of_code.total_additions += adds;
  updated.lines_of_code.total_deletions += dels;
  updated.lines_of_code.net_lines += net;

  // 2. Merge Contributions
  const commits = windowMetrics.commits || 0;
  const prs = windowMetrics.pull_requests.total || 0;
  const mergedPrs = windowMetrics.pull_requests.merged || 0;

  updated.contributions.commits += commits;
  updated.contributions.pull_requests += prs;
  updated.contributions.total += commits + prs;

  // 3. Merge Pull Requests Summary
  updated.pull_requests.total += prs;
  updated.pull_requests.merged += mergedPrs;
  if (updated.pull_requests.total > 0) {
    updated.pull_requests.merge_rate_percentage = parseFloat(
      (
        (updated.pull_requests.merged / updated.pull_requests.total) *
        100
      ).toFixed(1),
    );
  }

  // 4. Merge Repositories Contributed To
  const repoMap = new Map<string, RepoActivityStat>();
  for (const r of updated.repositories_contributed_to) {
    repoMap.set(r.repository, r);
  }

  for (const winRepo of windowActivities) {
    const existingRepo = repoMap.get(winRepo.repository);
    if (existingRepo) {
      existingRepo.commits += winRepo.commits;
      existingRepo.pull_requests += winRepo.pull_requests;
      existingRepo.reviews += winRepo.reviews;
      existingRepo.issues = (existingRepo.issues || 0) + (winRepo.issues || 0);
      existingRepo.additions += winRepo.additions;
      existingRepo.deletions += winRepo.deletions;
      existingRepo.net_lines += winRepo.net_lines;
      existingRepo.total_contributions += winRepo.total_contributions;
      if (winRepo.latest_release) {
        existingRepo.latest_release = winRepo.latest_release;
      }
      if (winRepo.primary_language) {
        existingRepo.primary_language = winRepo.primary_language;
      }
    } else {
      repoMap.set(winRepo.repository, structuredClone(winRepo));
    }
  }

  updated.repositories_contributed_to = Array.from(repoMap.values()).sort(
    (a, b) => b.total_contributions - a.total_contributions,
  );

  // 5. Recalculate Categories Breakdown
  updated.categories = calculateCategoryMetrics(
    updated.repositories_contributed_to,
  );

  // 6. Recalculate Languages Distribution
  updated.languages = calculateWeightedLanguages(
    updated.repositories_contributed_to,
  );

  // 7. Update Weekly Summary
  updated.weekly_summary = windowMetrics;

  // 8. Update Monthly History (Rolling 6 Months)
  const windowEndDate = new Date(windowMetrics.period.to);
  const currentMonthNum = windowEndDate.getUTCMonth() + 1;
  const currentMonthLabel = formatMonthLabel(windowEndDate);

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

  const history = updated.monthly_history || [];
  const existingMonthIndex = history.findIndex(
    (m) => m.month === currentMonthNum && m.label === currentMonthLabel,
  );

  if (existingMonthIndex >= 0) {
    const m = history[existingMonthIndex];
    m.commits += commits;
    m.lines_of_code.total_additions += adds;
    m.lines_of_code.total_deletions += dels;
    m.lines_of_code.net_lines += net;
    m.pull_requests.total += prs;
    m.pull_requests.merged += mergedPrs;
    if (m.pull_requests.total > 0) {
      m.pull_requests.merge_rate_percentage = parseFloat(
        ((m.pull_requests.merged / m.pull_requests.total) * 100).toFixed(1),
      );
    }
    m.repositories = windowRepoSummary;
    m.streaks_and_consistency = windowMetrics.streaks_and_consistency;
  } else {
    const newMonth: MonthlyStatItem = {
      label: currentMonthLabel,
      month: currentMonthNum,
      period: {
        from: `${windowEndDate.toISOString().slice(0, 7)}-01T00:00:00Z`,
        to: windowMetrics.period.to,
      },
      commits,
      lines_of_code: {
        total_additions: adds,
        total_deletions: dels,
        net_lines: net,
      },
      pull_requests: windowMetrics.pull_requests,
      repositories: windowRepoSummary,
      streaks_and_consistency: windowMetrics.streaks_and_consistency,
      languages: windowMetrics.languages,
    };
    history.push(newMonth);
  }

  // Keep at most 6 recent months
  while (history.length > 6) {
    history.shift();
  }
  updated.monthly_history = history;

  // 9. Update Releases (Chronological newest first)
  const allReleasesMap = new Map<string, ReleaseItem>();
  for (const rel of updated.releases || []) {
    allReleasesMap.set(`${rel.repo}#${rel.tag_name}`, rel);
  }
  for (const rel of newReleases) {
    allReleasesMap.set(`${rel.repo}#${rel.tag_name}`, rel);
  }
  for (const repo of updated.repositories_contributed_to) {
    if (repo.latest_release?.tag_name && repo.latest_release?.published_at) {
      const key = `${repo.repository}#${repo.latest_release.tag_name}`;
      if (!allReleasesMap.has(key)) {
        allReleasesMap.set(key, {
          repo: repo.repository,
          tag_name: repo.latest_release.tag_name,
          title: repo.latest_release.title || null,
          published_at: repo.latest_release.published_at,
          url:
            repo.latest_release.url ||
            `https://github.com/${repo.repository}/releases/tag/${repo.latest_release.tag_name}`,
        });
      }
    }
  }

  updated.releases = Array.from(allReleasesMap.values()).sort(
    (a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );

  return updated;
}
