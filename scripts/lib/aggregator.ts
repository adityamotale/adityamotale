import type {
  Categories,
  DateRange,
  LanguageItem,
  LanguageStat,
  ReleaseItem,
  RepoActivityStat,
  RepositorySummary,
  RepoTier,
  StreaksAndConsistency,
  TierMetrics,
  ViewerRepoNode,
} from "./types.ts";

export function classifyRepoTier(
  repoName: string,
  username: string,
  affiliatedOrgs: Set<string> = new Set(),
): RepoTier {
  const parts = repoName.split("/");
  if (parts.length < 2) return "personal";

  const ownerLower = parts[0].toLowerCase();
  const userLower = username.toLowerCase();

  if (ownerLower === userLower) {
    return "personal";
  }

  for (const org of affiliatedOrgs) {
    if (org.toLowerCase() === ownerLower) {
      return "organization";
    }
  }

  return "external_oss";
}

export function calculateCategoryMetrics(
  activities: RepoActivityStat[],
): Categories {
  const categories: Categories = {
    personal: {
      repositories_count: 0,
      commits: 0,
      pull_requests: 0,
      issues: 0,
      reviews: 0,
      additions: 0,
      deletions: 0,
      net_lines: 0,
      total_contributions: 0,
    },
    organization: {
      repositories_count: 0,
      commits: 0,
      pull_requests: 0,
      issues: 0,
      reviews: 0,
      additions: 0,
      deletions: 0,
      net_lines: 0,
      total_contributions: 0,
    },
    external_oss: {
      repositories_count: 0,
      commits: 0,
      pull_requests: 0,
      issues: 0,
      reviews: 0,
      additions: 0,
      deletions: 0,
      net_lines: 0,
      total_contributions: 0,
    },
  };

  for (const activity of activities) {
    const bucket: TierMetrics = categories[activity.tier];
    if (!bucket) continue;

    bucket.repositories_count += 1;
    bucket.commits += activity.commits;
    bucket.pull_requests += activity.pull_requests;
    bucket.issues += activity.issues || 0;
    bucket.reviews += activity.reviews;
    bucket.additions += activity.additions;
    bucket.deletions += activity.deletions;
    bucket.net_lines += activity.net_lines;
    bucket.total_contributions += activity.total_contributions;
  }

  return categories;
}

export function calculateLanguages(
  repos: ViewerRepoNode[],
  username: string,
): LanguageStat[] {
  const userLower = username.toLowerCase();
  const langTotals = new Map<string, { bytes: number; color: string | null }>();

  for (const repo of repos) {
    if (repo.isArchived) continue;
    if (repo.owner.login.toLowerCase() !== userLower) continue;

    const edges = repo.languages?.edges || [];
    for (const edge of edges) {
      const name = edge.node.name;
      const size = edge.size || 0;
      const color = edge.node.color || null;

      const existing = langTotals.get(name);
      if (existing) {
        existing.bytes += size;
        if (!existing.color && color) existing.color = color;
      } else {
        langTotals.set(name, { bytes: size, color });
      }
    }
  }

  const totalBytes = Array.from(langTotals.values()).reduce(
    (sum, val) => sum + val.bytes,
    0,
  );

  if (totalBytes === 0) return [];

  const results: LanguageStat[] = [];
  for (const [name, { bytes, color }] of langTotals.entries()) {
    const percentage = parseFloat(((bytes / totalBytes) * 100).toFixed(1));
    results.push({ name, color, bytes, percentage });
  }

  return results.sort((a, b) => (b.bytes || 0) - (a.bytes || 0));
}

export function calculateWeightedLanguages(
  activities: RepoActivityStat[],
  repoLanguageMap?: Map<
    string,
    Array<{ name: string; color: string | null; size: number }>
  >,
): LanguageStat[] {
  const languageLoc = new Map<string, { loc: number; color: string | null }>();

  for (const activity of activities) {
    if (activity.is_fork || activity.is_archived) continue;

    const userLoc =
      activity.additions > 0
        ? activity.additions
        : Math.max(0, activity.net_lines);
    if (userLoc <= 0) continue;

    let languages = repoLanguageMap?.get(activity.repository);
    if (!languages && activity.languages && activity.languages.length > 0) {
      languages = activity.languages.map((l) => ({
        name: l.name,
        color: l.color || null,
        size: l.bytes || 1,
      }));
    } else if (!languages && activity.primary_language?.name) {
      languages = [
        {
          name: activity.primary_language.name,
          color: activity.primary_language.color || null,
          size: 1,
        },
      ];
    }

    if (!languages || languages.length === 0) continue;

    const totalRepoBytes = languages.reduce((sum, l) => sum + (l.size || 0), 0);
    if (totalRepoBytes === 0) continue;

    for (const lang of languages) {
      const langFraction = (lang.size || 0) / totalRepoBytes;
      const attributedLoc = userLoc * langFraction;

      const existing = languageLoc.get(lang.name);
      if (existing) {
        existing.loc += attributedLoc;
        if (!existing.color && lang.color) existing.color = lang.color;
      } else {
        languageLoc.set(lang.name, {
          loc: attributedLoc,
          color: lang.color || null,
        });
      }
    }
  }

  const grandTotalLoc = Array.from(languageLoc.values()).reduce(
    (sum, val) => sum + val.loc,
    0,
  );

  if (grandTotalLoc === 0) return [];

  const result: LanguageStat[] = [];
  for (const [name, { loc, color }] of languageLoc.entries()) {
    const percentage = parseFloat(((loc / grandTotalLoc) * 100).toFixed(1));
    result.push({
      name,
      color,
      loc: Math.round(loc),
      percentage,
    });
  }

  return result.sort((a, b) => (b.loc || 0) - (a.loc || 0));
}

export function calculateRepositorySummary(
  repos: ViewerRepoNode[],
  username: string,
): RepositorySummary & { total_owned: number; forks: number } {
  const userLower = username.toLowerCase();
  let totalOwned = 0;
  let publicOwned = 0;
  let privateOwned = 0;
  let forks = 0;
  let totalStars = 0;
  let totalForks = 0;

  for (const repo of repos) {
    if (repo.isArchived) continue;
    if (repo.owner.login.toLowerCase() !== userLower) continue;

    totalOwned += 1;
    if (repo.isPrivate) {
      privateOwned += 1;
    } else {
      publicOwned += 1;
    }
    if (repo.isFork) forks += 1;
    totalStars += repo.stargazerCount || 0;
    totalForks += repo.forkCount || 0;
  }

  return {
    total: totalOwned,
    total_owned: totalOwned,
    public: publicOwned,
    private: privateOwned,
    forks,
    org: 0,
    total_stars: totalStars,
    total_forks: totalForks,
  };
}

export function calculateStreaks(
  dailyContributions: Record<string, number>,
  dateRange: DateRange,
): StreaksAndConsistency {
  const sortedDates = Object.keys(dailyContributions).sort();
  if (sortedDates.length === 0) {
    return {
      longest_streak_days: 0,
      current_streak_days: 0,
      active_days_count: 0,
      total_days_in_period: 0,
      activity_rate_percentage: 0,
      busiest_day: { date: "", count: 0 },
    };
  }

  let longestStreak = 0;
  let currentRun = 0;
  let activeDays = 0;
  let busiestDate = "";
  let busiestCount = 0;

  for (const date of sortedDates) {
    const count = dailyContributions[date] || 0;
    if (count > 0) {
      activeDays += 1;
      currentRun += 1;
      if (currentRun > longestStreak) {
        longestStreak = currentRun;
      }
      if (count > busiestCount) {
        busiestCount = count;
        busiestDate = date;
      }
    } else {
      currentRun = 0;
    }
  }

  const latestDate = sortedDates[sortedDates.length - 1];
  const currentStreak =
    (dailyContributions[latestDate] || 0) > 0 ? currentRun : 0;

  const totalDays = sortedDates.length;
  const activityRate =
    totalDays > 0 ? parseFloat(((activeDays / totalDays) * 100).toFixed(2)) : 0;

  return {
    longest_streak_days: longestStreak,
    current_streak_days: currentStreak,
    active_days_count: activeDays,
    total_days_in_period: totalDays,
    activity_rate_percentage: activityRate,
    busiest_day: {
      date: busiestDate,
      count: busiestCount,
    },
  };
}

export function buildRepositoryActivities(params: {
  repoContributions: Map<string, any>;
  locResults: Map<string, any>;
  viewerRepos?: ViewerRepoNode[];
  username: string;
  affiliatedOrgs?: Set<string>;
  repoMeta?: Map<string, any>;
}): RepoActivityStat[] {
  const {
    repoContributions,
    locResults,
    viewerRepos = [],
    username,
    affiliatedOrgs = new Set<string>(),
    repoMeta = new Map(),
  } = params;

  for (const node of viewerRepos) {
    repoMeta.set(node.nameWithOwner, {
      isPrivate: node.isPrivate,
      isFork: node.isFork,
      isArchived: node.isArchived,
      description: node.description,
      stargazerCount: node.stargazerCount,
      forkCount: node.forkCount,
      languages:
        node.languages?.edges?.map((e) => ({
          name: e.node.name,
          color: e.node.color,
          bytes: e.size,
          percentage: 0,
        })) || [],
      latestRelease: node.latestRelease
        ? {
            tag_name: node.latestRelease.tagName,
            title: node.latestRelease.name || null,
            published_at: node.latestRelease.publishedAt,
            url: node.latestRelease.url || null,
          }
        : null,
    });
  }

  const repoNames = Array.from(
    new Set([
      ...repoContributions.keys(),
      ...locResults.keys(),
      ...repoMeta.keys(),
    ]),
  );

  const activities: RepoActivityStat[] = [];

  for (const name of repoNames) {
    if (name === "KinariwalaS/MitRa_admission_new") continue;
    const contrib = repoContributions.get(name);
    const loc = locResults.get(name);
    const meta = repoMeta.get(name);

    const isArchived = meta?.isArchived ?? contrib?.isArchived ?? false;
    if (isArchived) continue;

    const isPrivate =
      meta?.isPrivate ?? contrib?.isPrivate ?? loc?.is_private ?? false;
    const isFork = meta?.isFork ?? loc?.is_fork ?? false;
    const description = meta?.description ?? null;
    const commits = Math.max(contrib?.commits ?? 0, loc?.commit_count ?? 0);
    const additions = loc?.additions ?? 0;
    const deletions = loc?.deletions ?? 0;
    const issues = contrib?.issues ?? 0;
    const pullRequests = contrib?.pullRequests ?? 0;
    const reviews = contrib?.reviews ?? 0;
    const totalContrib = contrib
      ? commits + issues + pullRequests + reviews
      : commits;

    const tier = classifyRepoTier(name, username, affiliatedOrgs);

    const langs: LanguageItem[] =
      loc?.languages?.map((l: any) => ({
        name: l.name,
        color: l.color,
        bytes: l.size,
        percentage: 0,
      })) ||
      meta?.languages ||
      [];

    const primaryLang =
      langs.length > 0
        ? { name: langs[0].name, color: langs[0].color || null }
        : null;

    if (totalContrib > 0 || additions > 0 || deletions > 0) {
      activities.push({
        repository: name,
        tier,
        is_private: isPrivate,
        is_fork: isFork,
        is_archived: isArchived,
        description,
        commits,
        pull_requests: pullRequests,
        issues,
        reviews,
        additions,
        deletions,
        net_lines: additions - deletions,
        total_contributions: totalContrib,
        languages: langs,
        primary_language: primaryLang,
        latest_release: meta?.latestRelease ?? null,
      });
    }
  }

  return activities.sort((a, b) => {
    if (b.total_contributions !== a.total_contributions) {
      return b.total_contributions - a.total_contributions;
    }
    return b.additions - a.additions;
  });
}

export function extractReleases(
  viewerRepos: ViewerRepoNode[],
  activities: RepoActivityStat[] = [],
): ReleaseItem[] {
  const releaseMap = new Map<string, ReleaseItem>();

  for (const repo of viewerRepos) {
    if (repo.latestRelease?.tagName && repo.latestRelease?.publishedAt) {
      releaseMap.set(`${repo.nameWithOwner}#${repo.latestRelease.tagName}`, {
        repo: repo.nameWithOwner,
        tag_name: repo.latestRelease.tagName,
        title: repo.latestRelease.name || null,
        published_at: repo.latestRelease.publishedAt,
        url:
          repo.latestRelease.url ||
          `https://github.com/${repo.nameWithOwner}/releases/tag/${repo.latestRelease.tagName}`,
      });
    }
  }

  for (const act of activities) {
    if (act.latest_release?.tag_name && act.latest_release?.published_at) {
      const key = `${act.repository}#${act.latest_release.tag_name}`;
      if (!releaseMap.has(key)) {
        releaseMap.set(key, {
          repo: act.repository,
          tag_name: act.latest_release.tag_name,
          title: act.latest_release.title || null,
          published_at: act.latest_release.published_at,
          url:
            act.latest_release.url ||
            `https://github.com/${act.repository}/releases/tag/${act.latest_release.tag_name}`,
        });
      }
    }
  }

  return Array.from(releaseMap.values()).sort(
    (a, b) =>
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );
}
