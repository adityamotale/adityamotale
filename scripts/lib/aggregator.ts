import type {
  DateRange,
  LanguageStat,
  RepoActivityStat,
  RepositorySummary,
  StreaksAndConsistency,
} from './types.ts';
import type { RepoContribDelta, RepoLocStat, ViewerRepoNode } from './collector.ts';

export function calculateLanguages(repos: ViewerRepoNode[], username: string): LanguageStat[] {
  const languageMap = new Map<string, { name: string; color: string | null; bytes: number }>();

  for (const repo of repos) {
    if (repo.owner.login !== username || !repo.languages?.edges) continue;

    for (const { size, node } of repo.languages.edges) {
      const entry = languageMap.get(node.name) ?? { name: node.name, color: node.color, bytes: 0 };
      entry.bytes += size || 0;
      if (node.color && !entry.color) entry.color = node.color;
      languageMap.set(node.name, entry);
    }
  }

  const totalBytes = Array.from(languageMap.values()).reduce((sum, item) => sum + item.bytes, 0);

  return Array.from(languageMap.values())
    .map((item) => ({
      name: item.name,
      color: item.color,
      bytes: item.bytes,
      percentage: totalBytes > 0 ? parseFloat(((item.bytes / totalBytes) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

export function calculateRepositorySummary(repos: ViewerRepoNode[], username: string): RepositorySummary {
  let publicCount = 0;
  let privateCount = 0;
  let forkCount = 0;
  let totalStars = 0;
  let totalForks = 0;

  for (const repo of repos) {
    if (repo.owner.login !== username) continue;

    if (repo.isPrivate) privateCount++;
    else publicCount++;

    if (repo.isFork) forkCount++;

    totalStars += repo.stargazerCount || 0;
    totalForks += repo.forkCount || 0;
  }

  return {
    total_owned: publicCount + privateCount,
    public: publicCount,
    private: privateCount,
    forks: forkCount,
    total_stars: totalStars,
    total_forks: totalForks,
  };
}

export function calculateStreaks(
  dailyContributions: Record<string, number>,
  dateRange: DateRange
): StreaksAndConsistency {
  const fromDate = dateRange.from.slice(0, 10);
  const toDate = dateRange.to.slice(0, 10);

  const entries = Object.entries(dailyContributions)
    .filter(([date]) => date >= fromDate && date <= toDate)
    .sort(([a], [b]) => a.localeCompare(b));

  let longestStreak = 0;
  let tempStreak = 0;
  let activeDaysCount = 0;
  let busiestDay = { date: '', count: 0 };

  for (const [date, count] of entries) {
    if (count > 0) {
      activeDaysCount++;
      tempStreak++;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    } else {
      tempStreak = 0;
    }

    if (count > busiestDay.count) {
      busiestDay = { date, count };
    }
  }

  let currentStreak = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i][1] > 0) currentStreak++;
    else break;
  }

  const totalDaysInPeriod = entries.length;
  const activityRate = totalDaysInPeriod > 0 ? parseFloat(((activeDaysCount / totalDaysInPeriod) * 100).toFixed(2)) : 0;

  return {
    longest_streak_days: longestStreak,
    current_streak_days: currentStreak,
    active_days_count: activeDaysCount,
    total_days_in_period: totalDaysInPeriod,
    activity_rate_percentage: activityRate,
    busiest_day: busiestDay,
  };
}

export function buildRepositoryActivities(params: {
  repoContributions: Map<string, RepoContribDelta>;
  locResults: Map<string, RepoLocStat>;
  viewerRepos: ViewerRepoNode[];
}): RepoActivityStat[] {
  const { repoContributions, locResults, viewerRepos } = params;
  const repoNames = new Set([...repoContributions.keys(), ...locResults.keys()]);
  const repoMeta = new Map(viewerRepos.map((r) => [r.nameWithOwner, { isPrivate: r.isPrivate, isFork: r.isFork }]));

  const activities: RepoActivityStat[] = [];

  for (const name of repoNames) {
    const contrib = repoContributions.get(name);
    const loc = locResults.get(name);
    const meta = repoMeta.get(name);

    const isPrivate = meta?.isPrivate ?? contrib?.isPrivate ?? loc?.is_private ?? false;
    const isFork = meta?.isFork ?? loc?.is_fork ?? false;
    const commits = Math.max(contrib?.commits ?? 0, loc?.commit_count ?? 0);
    const additions = loc?.additions ?? 0;
    const deletions = loc?.deletions ?? 0;
    const issues = contrib?.issues ?? 0;
    const pullRequests = contrib?.pullRequests ?? 0;
    const reviews = contrib?.reviews ?? 0;
    const totalContrib = contrib ? commits + issues + pullRequests + reviews : commits;

    if (totalContrib > 0 || additions > 0 || deletions > 0) {
      activities.push({
        repository: name,
        is_private: isPrivate,
        is_fork: isFork,
        commits,
        pull_requests: pullRequests,
        issues,
        reviews,
        additions,
        deletions,
        net_lines: additions - deletions,
        total_contributions: totalContrib,
      });
    }
  }

  return activities.sort((a, b) => b.total_contributions - a.total_contributions || b.additions - a.additions);
}
