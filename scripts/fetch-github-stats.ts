import { execFile, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type RepoTier = "personal" | "organization" | "external_oss";

export interface DateRange {
  from: string;
  to: string;
}

export interface LanguageStat {
  name: string;
  color: string | null;
  bytes: number;
  percentage: number;
}

export interface LanguageItem {
  name: string;
  color?: string | null;
  bytes?: number;
  percentage: number;
}

export interface CategoryMetrics {
  repositories_count: number;
  commits: number;
  pull_requests: number;
  issues: number;
  reviews: number;
  additions: number;
  deletions: number;
  net_lines: number;
  total_contributions: number;
}

export interface RepoActivityStat {
  repository: string;
  tier: RepoTier;
  is_private: boolean;
  is_fork: boolean;
  description?: string | null;
  commits: number;
  pull_requests: number;
  issues: number;
  reviews: number;
  additions: number;
  deletions: number;
  net_lines: number;
  total_contributions: number;
  languages?: LanguageItem[];
  latest_release?: {
    tag_name: string;
    published_at: string;
  } | null;
}

export interface StreaksAndConsistency {
  longest_streak_days: number;
  current_streak_days: number;
  active_days_count: number;
  total_days_in_period: number;
  activity_rate_percentage: number;
  busiest_day: {
    date: string;
    count: number;
  };
}

export interface PullRequestSummary {
  total: number;
  merged: number;
  open: number;
  closed_unmerged: number;
  merge_rate_percentage: number;
}

export interface RepositorySummary {
  total_owned: number;
  public: number;
  private: number;
  forks: number;
  total_stars: number;
  total_forks: number;
}

export interface ContributionBreakdown {
  total: number;
  commits: number;
  pull_requests: number;
  issues: number;
  reviews: number;
  public: number;
  private: number;
}

export interface PeriodMetrics {
  period: DateRange;
  lines_of_code: {
    total_additions: number;
    total_deletions: number;
    net_lines: number;
  };
  commits: number;
  pull_requests: PullRequestSummary;
  streaks_and_consistency: StreaksAndConsistency;
  repositories: {
    total: number;
    public: number;
    private: number;
    org: number;
  };
  languages?: LanguageItem[];
}

export interface MonthlyStatItem extends PeriodMetrics {
  label: string;
  year: number;
  month: number;
  top_stack?: string[];
}

export interface GitHubStatsOutput {
  metadata: {
    username: string;
    generated_at: string;
    period: DateRange;
  };
  lines_of_code: {
    total_additions: number;
    total_deletions: number;
    net_lines: number;
  };
  categories: {
    personal: CategoryMetrics;
    organization: CategoryMetrics;
    external_oss: CategoryMetrics;
  };
  repositories: RepositorySummary;
  contributions: ContributionBreakdown;
  streaks_and_consistency: StreaksAndConsistency;
  pull_requests: PullRequestSummary;
  languages: LanguageStat[];
  repositories_contributed_to: RepoActivityStat[];
  daily_contributions: Record<string, number>;
  weekly_summary?: PeriodMetrics;
  monthly_history?: MonthlyStatItem[];
}

export interface ViewerRepoNode {
  nameWithOwner: string;
  name: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived?: boolean;
  description?: string | null;
  stargazerCount: number;
  forkCount: number;
  owner: { login: string };
  defaultBranchRef?: { name: string } | null;
  languages?: {
    edges: Array<{
      size: number;
      node: {
        name: string;
        color: string | null;
      };
    }>;
  };
  latestRelease?: {
    tagName: string;
    publishedAt: string;
  } | null;
}

export interface ViewerContext {
  login: string;
  id: string;
  organizations: Set<string>;
  repositories: ViewerRepoNode[];
}

export interface RepoContribDelta {
  commits: number;
  issues: number;
  pullRequests: number;
  reviews: number;
  isPrivate: boolean;
  isArchived?: boolean;
}

export interface WindowContributions {
  totalContributions: number;
  commits: number;
  issues: number;
  pullRequests: number;
  reviews: number;
  restricted: number;
  daily: Record<string, number>;
  repoContributions: Map<string, RepoContribDelta>;
}

export interface RepoLocStat {
  repository: string;
  is_private: boolean;
  is_fork: boolean;
  additions: number;
  deletions: number;
  commit_count: number;
  languages?: Array<{ name: string; color: string | null; size: number }>;
}

export interface GraphQLOptions {
  token?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

export function isTransientGraphQLError(message: string): boolean {
  return /HTTP (403|429|499|500|502|503|504)|Something went wrong while executing your query|rate limit|secondary rate limit|was submitted too quickly|abuse detection|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|timed out|timeout|fetch failed|Service Unavailable|Gateway Timeout|Bad Gateway|Internal Server Error/i.test(
    message,
  );
}

export function getGitHubToken(): string {
  const envToken =
    process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim();
  if (envToken) return envToken;

  try {
    const cliToken = execFileSync("gh", ["auth", "token"], {
      encoding: "utf-8",
    }).trim();
    if (cliToken) return cliToken;
  } catch {}

  throw new Error(
    'Missing GitHub token: Set GH_TOKEN or authenticate via "gh auth login"',
  );
}

export async function runGraphQLAsync<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options?: GraphQLOptions,
): Promise<T> {
  const token = options?.token || getGitHubToken();
  const cliArgs = ["api", "graphql", "-f", `query=${query}`];

  for (const [key, val] of Object.entries(variables)) {
    if (val !== undefined && val !== null) {
      cliArgs.push("-F", `${key}=${val}`);
    }
  }

  const maxRetries = options?.maxRetries ?? 0x04;
  let delayMs = options?.retryDelayMs ?? 1500;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { stdout } = await execFileAsync("gh", cliArgs, {
        encoding: "utf-8",
        env: { ...process.env, GH_TOKEN: token },
        maxBuffer: 0x32 * 1024 * 1024,
      });

      const parsed = JSON.parse(stdout);
      if (parsed.errors?.length) {
        throw new Error(
          `GraphQL errors: ${parsed.errors.map((e: { message: string }) => e.message).join("; ")}`,
        );
      }

      if (!parsed.data) {
        throw new Error('GraphQL response missing "data" payload.');
      }

      return parsed.data as T;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isTransient = isTransientGraphQLError(message);

      if (isTransient && attempt < maxRetries) {
        console.warn(
          `[GraphQL Retry] Attempt ${attempt}/${maxRetries} failed: ${message.slice(0, 120)}... Retrying in ${delayMs}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2;
        continue;
      }

      const sanitizedMsg = token
        ? message.replaceAll(token, "[REDACTED]")
        : message;
      throw new Error(`GraphQL request failed: ${sanitizedMsg}`);
    }
  }

  throw new Error("GraphQL request failed after retries.");
}

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

export function classifyRepoTier(
  nameWithOwner: string,
  username: string,
  affiliatedOrgs: Set<string> = new Set(),
): RepoTier {
  const [owner] = nameWithOwner.split("/");
  if (!owner) return "external_oss";

  const ownerLower = owner.toLowerCase();
  const userLower = username.toLowerCase();

  if (userLower && ownerLower === userLower) {
    return "personal";
  }

  if (affiliatedOrgs.has(ownerLower)) {
    return "organization";
  }

  return "external_oss";
}

export function calculateCategoryMetrics(activities: RepoActivityStat[]): {
  personal: CategoryMetrics;
  organization: CategoryMetrics;
  external_oss: CategoryMetrics;
} {
  const createEmpty = (): CategoryMetrics => ({
    repositories_count: 0,
    commits: 0,
    pull_requests: 0,
    issues: 0,
    reviews: 0,
    additions: 0,
    deletions: 0,
    net_lines: 0,
    total_contributions: 0,
  });

  const res = {
    personal: createEmpty(),
    organization: createEmpty(),
    external_oss: createEmpty(),
  };

  for (const r of activities) {
    const bucket = res[r.tier] || res.external_oss;
    bucket.repositories_count++;
    bucket.commits += r.commits;
    bucket.pull_requests += r.pull_requests;
    bucket.issues += r.issues;
    bucket.reviews += r.reviews;
    bucket.additions += r.additions;
    bucket.deletions += r.deletions;
    bucket.net_lines += r.net_lines;
    bucket.total_contributions += r.total_contributions;
  }

  return res;
}

export function calculateLanguages(
  repos: ViewerRepoNode[],
  username?: string,
  includeAll = false,
): LanguageStat[] {
  const languageMap = new Map<
    string,
    { name: string; color: string | null; bytes: number }
  >();

  for (const repo of repos) {
    if (repo.isArchived) continue;
    if (!includeAll && username && repo.owner.login !== username) continue;
    if (!repo.languages?.edges) continue;

    for (const { size, node } of repo.languages.edges) {
      const entry = languageMap.get(node.name) ?? {
        name: node.name,
        color: node.color,
        bytes: 0,
      };
      entry.bytes += size || 0;
      if (node.color && !entry.color) entry.color = node.color;
      languageMap.set(node.name, entry);
    }
  }

  const totalBytes = Array.from(languageMap.values()).reduce(
    (sum, item) => sum + item.bytes,
    0,
  );

  return Array.from(languageMap.values())
    .map((item) => ({
      name: item.name,
      color: item.color,
      bytes: item.bytes,
      percentage:
        totalBytes > 0
          ? parseFloat(((item.bytes / totalBytes) * 100).toFixed(2))
          : 0,
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

export function calculateWeightedLanguages(
  activities: RepoActivityStat[],
  repoLanguageMap?: Map<
    string,
    Array<{ name: string; color: string | null; size: number }>
  >,
): LanguageStat[] {
  const languageMap = new Map<
    string,
    { name: string; color: string | null; score: number }
  >();
  let totalScore = 0;

  for (const repo of activities) {
    const langs =
      repoLanguageMap?.get(repo.repository) ||
      (repo.languages || []).map((l) => ({
        name: l.name,
        color: l.color || null,
        size: l.bytes || Math.round(l.percentage * 100),
      }));

    if (!langs.length) continue;

    const repoWeight =
      repo.additions > 0
        ? repo.additions
        : repo.commits * 0x32 || repo.total_contributions * 0x19;
    if (repoWeight <= 0) continue;

    const totalRepoBytes = langs.reduce((sum, l) => sum + (l.size || 0), 0);
    if (totalRepoBytes > 0) {
      for (const l of langs) {
        const share = (l.size / totalRepoBytes) * repoWeight;
        totalScore += share;
        const entry = languageMap.get(l.name) ?? {
          name: l.name,
          color: l.color || null,
          score: 0,
        };
        entry.score += share;
        if (l.color && !entry.color) entry.color = l.color;
        languageMap.set(l.name, entry);
      }
    }
  }

  if (totalScore === 0) return [];

  return Array.from(languageMap.values())
    .map((item) => ({
      name: item.name,
      color: item.color,
      bytes: Math.round(item.score),
      percentage: parseFloat(((item.score / totalScore) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.bytes - a.bytes);
}

export function calculateRepositorySummary(
  repos: ViewerRepoNode[],
  username: string,
): RepositorySummary {
  let publicCount = 0;
  let privateCount = 0;
  let forkCount = 0;
  let totalStars = 0;
  let totalForks = 0;

  for (const repo of repos) {
    if (repo.isArchived) continue;
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
  dateRange: DateRange,
): StreaksAndConsistency {
  const fromDate = dateRange.from.slice(0, 10);
  const toDate = dateRange.to.slice(0, 10);

  const entries = Object.entries(dailyContributions)
    .filter(([date]) => date >= fromDate && date <= toDate)
    .sort(([a], [b]) => a.localeCompare(b));

  let longestStreak = 0;
  let tempStreak = 0;
  let activeDaysCount = 0;
  let busiestDay = { date: "", count: 0 };

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
  const activityRate =
    totalDaysInPeriod > 0
      ? parseFloat(((activeDaysCount / totalDaysInPeriod) * 100).toFixed(2))
      : 0;

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
  username?: string;
  affiliatedOrgs?: Set<string>;
}): RepoActivityStat[] {
  const {
    repoContributions,
    locResults,
    viewerRepos,
    username = "",
    affiliatedOrgs = new Set<string>(),
  } = params;

  const repoNames = new Set([
    ...repoContributions.keys(),
    ...locResults.keys(),
    ...viewerRepos.map((r) => r.nameWithOwner),
  ]);

  const repoMeta = new Map(
    viewerRepos.map((r) => [
      r.nameWithOwner,
      {
        isPrivate: r.isPrivate,
        isFork: r.isFork,
        isArchived: r.isArchived,
        description: r.description ?? null,
        languages:
          r.languages?.edges?.map((e) => ({
            name: e.node.name,
            color: e.node.color ?? null,
            bytes: e.size,
            percentage: 0,
          })) ?? null,
        latestRelease: r.latestRelease
          ? {
              tag_name: r.latestRelease.tagName,
              published_at: r.latestRelease.publishedAt,
            }
          : null,
      },
    ]),
  );

  const activities: RepoActivityStat[] = [];

  for (const name of repoNames) {
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

    const langs =
      loc?.languages?.map((l) => ({
        name: l.name,
        color: l.color,
        bytes: l.size,
        percentage: 0,
      })) ||
      meta?.languages ||
      undefined;

    if (totalContrib > 0 || additions > 0 || deletions > 0) {
      activities.push({
        repository: name,
        tier,
        is_private: isPrivate,
        is_fork: isFork,
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
        latest_release: meta?.latestRelease ?? null,
      });
    }
  }

  return activities.sort(
    (a, b) =>
      b.total_contributions - a.total_contributions ||
      b.additions - a.additions,
  );
}

const GET_VIEWER_REPOS_QUERY = `
  query getViewerRepos($cursor: String) {
    viewer {
      login
      id
      organizations(first: 50) {
        nodes {
          login
        }
      }
      allRepos: repositories(affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER], first: 100, after: $cursor) {
        nodes {
          nameWithOwner
          name
          isPrivate
          isFork
          isArchived
          description
          stargazerCount
          forkCount
          owner { login }
          defaultBranchRef { name }
          languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
            edges {
              size
              node {
                name
                color
              }
            }
          }
          latestRelease {
            tagName
            publishedAt
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

const GET_REPO_COMMIT_LOC_QUERY = `
  query getRepoCommitLOC($owner: String!, $name: String!, $authorId: ID!, $since: GitTimestamp!, $until: GitTimestamp!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      isPrivate
      isFork
      languages(first: 20, orderBy: { field: SIZE, direction: DESC }) {
        edges {
          size
          node {
            name
            color
          }
        }
      }
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: 100, author: { id: $authorId }, since: $since, until: $until, after: $cursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                oid
                additions
                deletions
              }
            }
          }
        }
      }
    }
  }
`;

const GET_CONTRIBUTIONS_QUERY = `
  query getContributions($from: DateTime!, $to: DateTime!) {
    viewer {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
        commitContributionsByRepository(maxRepositories: 100) {
          repository {
            nameWithOwner
            isPrivate
            isArchived
            description
            isFork
          }
          contributions { totalCount }
        }
        issueContributionsByRepository(maxRepositories: 100) {
          repository {
            nameWithOwner
            isPrivate
            isArchived
            description
            isFork
          }
          contributions { totalCount }
        }
        pullRequestContributionsByRepository(maxRepositories: 100) {
          repository {
            nameWithOwner
            isPrivate
            isArchived
            description
            isFork
          }
          contributions { totalCount }
        }
        pullRequestReviewContributionsByRepository(maxRepositories: 100) {
          repository {
            nameWithOwner
            isPrivate
            isArchived
            description
            isFork
          }
          contributions { totalCount }
        }
      }
    }
  }
`;

const GET_PRS_QUERY = `
  query getPRs($searchQuery: String!, $cursor: String) {
    search(query: $searchQuery, type: ISSUE, first: 100, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ... on PullRequest {
          title
          state
          merged
          repository {
            nameWithOwner
            isPrivate
            isFork
            isArchived
            description
          }
        }
      }
    }
  }
`;

export async function fetchViewerContext(
  options?: GraphQLOptions,
): Promise<ViewerContext> {
  const repositories: ViewerRepoNode[] = [];
  const organizations = new Set<string>();
  let cursor: string | null = null;
  let hasNextPage = true;
  let login = "";
  let id = "";

  while (hasNextPage) {
    const data: any = await runGraphQLAsync(
      GET_VIEWER_REPOS_QUERY,
      { cursor },
      options,
    );
    const viewer = data.viewer;
    if (!viewer) break;

    login = viewer.login;
    id = viewer.id;

    for (const org of viewer.organizations?.nodes || []) {
      if (org?.login) organizations.add(org.login.toLowerCase());
    }

    for (const node of viewer.allRepos?.nodes || []) {
      repositories.push(node);
      if (node.owner?.login && node.owner.login !== login) {
        organizations.add(node.owner.login.toLowerCase());
      }
    }

    hasNextPage = viewer.allRepos?.pageInfo?.hasNextPage;
    cursor = viewer.allRepos?.pageInfo?.endCursor;
  }

  return { login, id, organizations, repositories };
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

  const daily: Record<string, number> = {};
  for (const week of cc.contributionCalendar?.weeks || []) {
    for (const day of week.contributionDays || []) {
      daily[day.date] = day.contributionCount;
    }
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
  tally(cc.issueContributionsByRepository, "issues");
  tally(cc.pullRequestContributionsByRepository, "pullRequests");
  tally(cc.pullRequestReviewContributionsByRepository, "reviews");

  return {
    totalContributions: cc.contributionCalendar?.totalContributions || 0,
    commits: cc.totalCommitContributions || 0,
    issues: cc.totalIssueContributions || 0,
    pullRequests: cc.totalPullRequestContributions || 0,
    reviews: cc.totalPullRequestReviewContributions || 0,
    restricted: cc.restrictedContributionsCount || 0,
    daily,
    repoContributions,
  };
}

export async function fetchRepoLOC(
  viewerId: string,
  repos: Array<{ nameWithOwner: string; isPrivate: boolean; isFork: boolean }>,
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
        } catch {}
      }),
    );
  }

  return results;
}

export async function fetchPullRequests(
  username: string,
  dateRange: DateRange,
  options?: GraphQLOptions,
): Promise<{
  summary: PullRequestSummary;
  discoveredRepos: Array<{
    nameWithOwner: string;
    isPrivate: boolean;
    isFork: boolean;
    isArchived: boolean;
    description: string | null;
  }>;
}> {
  const fromDate = dateRange.from.slice(0, 10);
  const toDate = dateRange.to.slice(0, 10);
  const searchQuery = `author:${username} type:pr created:${fromDate}..${toDate}`;

  let total = 0;
  let merged = 0;
  let open = 0;
  let closedUnmerged = 0;
  let cursor: string | null = null;
  let hasNextPage = true;
  const discoveredReposMap = new Map<
    string,
    {
      nameWithOwner: string;
      isPrivate: boolean;
      isFork: boolean;
      isArchived: boolean;
      description: string | null;
    }
  >();

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
      if (pr.merged) merged++;
      else if (pr.state === "OPEN") open++;
      else closedUnmerged++;

      if (pr.repository?.nameWithOwner) {
        discoveredReposMap.set(pr.repository.nameWithOwner, {
          nameWithOwner: pr.repository.nameWithOwner,
          isPrivate: Boolean(pr.repository.isPrivate),
          isFork: Boolean(pr.repository.isFork),
          isArchived: Boolean(pr.repository.isArchived),
          description: pr.repository.description ?? null,
        });
      }
    }

    hasNextPage = search.pageInfo?.hasNextPage;
    cursor = search.pageInfo?.endCursor;
  }

  const mergeRate =
    total > 0 ? parseFloat(((merged / total) * 100).toFixed(2)) : 0;

  return {
    summary: {
      total,
      merged,
      open,
      closed_unmerged: closedUnmerged,
      merge_rate_percentage: mergeRate,
    },
    discoveredRepos: Array.from(discoveredReposMap.values()),
  };
}

export function parseCliArgs(): {
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

export async function executeIncremental(
  existing: GitHubStatsOutput,
  window: DateRange,
  viewer: ViewerContext,
): Promise<GitHubStatsOutput> {
  console.log(
    `Executing incremental update for window: ${window.from} → ${window.to}`,
  );

  const windowData = await fetchContributionsWindow(window.from, window.to);
  const prResult = await fetchPullRequests(viewer.login, window);

  const daily = { ...existing.daily_contributions, ...windowData.daily };
  const grandTotal = Object.values(daily).reduce(
    (sum, count) => sum + count,
    0,
  );

  const candidateMap = new Map<
    string,
    { nameWithOwner: string; isPrivate: boolean; isFork: boolean }
  >();

  for (const name of windowData.repoContributions.keys()) {
    const meta = viewer.repositories.find((r) => r.nameWithOwner === name);
    const isArchived =
      meta?.isArchived ??
      windowData.repoContributions.get(name)?.isArchived ??
      false;
    if (isArchived) continue;
    candidateMap.set(name, {
      nameWithOwner: name,
      isPrivate:
        meta?.isPrivate ??
        windowData.repoContributions.get(name)?.isPrivate ??
        false,
      isFork: meta?.isFork ?? false,
    });
  }

  for (const r of viewer.repositories) {
    if (r.isArchived) continue;
    if (!candidateMap.has(r.nameWithOwner)) {
      candidateMap.set(r.nameWithOwner, {
        nameWithOwner: r.nameWithOwner,
        isPrivate: r.isPrivate,
        isFork: r.isFork,
      });
    }
  }

  for (const r of prResult.discoveredRepos) {
    if (r.isArchived) continue;
    if (!candidateMap.has(r.nameWithOwner)) {
      candidateMap.set(r.nameWithOwner, {
        nameWithOwner: r.nameWithOwner,
        isPrivate: r.isPrivate,
        isFork: r.isFork,
      });
    }
  }

  const locResults = await fetchRepoLOC(
    viewer.id,
    Array.from(candidateMap.values()),
    window,
  );

  let newAdditions = 0;
  let newDeletions = 0;
  for (const loc of locResults.values()) {
    newAdditions += loc.additions;
    newDeletions += loc.deletions;
  }

  const repoMap = new Map<string, RepoActivityStat>(
    existing.repositories_contributed_to.map((r) => [r.repository, { ...r }]),
  );

  for (const [name, stat] of windowData.repoContributions.entries()) {
    const loc = locResults.get(name);
    const adds = loc?.additions ?? 0;
    const dels = loc?.deletions ?? 0;
    const commitCount = Math.max(stat.commits, loc?.commit_count ?? 0);
    const contribCount =
      commitCount + stat.issues + stat.pullRequests + stat.reviews;
    const tier = classifyRepoTier(name, viewer.login, viewer.organizations);

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
      entry.tier = tier;
      if (!entry.description) {
        entry.description =
          viewer.repositories.find((r) => r.nameWithOwner === name)
            ?.description ?? null;
      }
      const vRepo = viewer.repositories.find((r) => r.nameWithOwner === name);
      if (vRepo?.latestRelease) {
        entry.latest_release = {
          tag_name: vRepo.latestRelease.tagName,
          published_at: vRepo.latestRelease.publishedAt,
        };
      }
    } else {
      repoMap.set(name, {
        repository: name,
        tier,
        is_private: stat.isPrivate,
        is_fork:
          candidateMap.get(name)?.isFork ??
          viewer.repositories.find((r) => r.nameWithOwner === name)?.isFork ??
          false,
        description:
          viewer.repositories.find((r) => r.nameWithOwner === name)
            ?.description ?? null,
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

  const windowPRs = prResult.summary;
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

  const weeklySummary: PeriodMetrics = {
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

  const activities = Array.from(repoMap.values()).sort(
    (a, b) =>
      b.total_contributions - a.total_contributions ||
      b.additions - a.additions,
  );

  const categories = calculateCategoryMetrics(activities);

  const repoLanguageMap = new Map<
    string,
    Array<{ name: string; color: string | null; size: number }>
  >();

  for (const r of viewer.repositories) {
    if (r.languages?.edges) {
      repoLanguageMap.set(
        r.nameWithOwner,
        r.languages.edges.map((e) => ({
          name: e.node.name,
          color: e.node.color,
          size: e.size,
        })),
      );
    }
  }

  for (const [name, loc] of locResults.entries()) {
    if (
      loc.languages &&
      loc.languages.length > 0 &&
      !repoLanguageMap.has(name)
    ) {
      repoLanguageMap.set(name, loc.languages);
    }
  }

  const weightedLangs = calculateWeightedLanguages(activities, repoLanguageMap);
  const finalLanguages =
    weightedLangs.length > 0
      ? weightedLangs
      : calculateLanguages(viewer.repositories, viewer.login, true);

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
    categories,
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
    languages: finalLanguages,
    repositories_contributed_to: activities,
    daily_contributions: daily,
    weekly_summary: weeklySummary,
    monthly_history: existing.monthly_history,
  };
}

export async function executeFullBackfill(
  dateRange: DateRange,
  viewer: ViewerContext,
  existing?: GitHubStatsOutput,
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

  const prResult = await fetchPullRequests(viewer.login, dateRange);

  const candidateMap = new Map<
    string,
    { nameWithOwner: string; isPrivate: boolean; isFork: boolean }
  >();

  for (const r of viewer.repositories) {
    if (r.isArchived) continue;
    candidateMap.set(r.nameWithOwner, {
      nameWithOwner: r.nameWithOwner,
      isPrivate: r.isPrivate,
      isFork: r.isFork,
    });
  }

  for (const [name, stat] of repoContribs.entries()) {
    if (stat.isArchived) continue;
    if (!candidateMap.has(name)) {
      candidateMap.set(name, {
        nameWithOwner: name,
        isPrivate: stat.isPrivate,
        isFork: false,
      });
    }
  }

  for (const r of prResult.discoveredRepos) {
    if (r.isArchived) continue;
    if (!candidateMap.has(r.nameWithOwner)) {
      candidateMap.set(r.nameWithOwner, {
        nameWithOwner: r.nameWithOwner,
        isPrivate: r.isPrivate,
        isFork: r.isFork,
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

  const grandTotal = Object.values(mergedDaily).reduce(
    (sum, count) => sum + count,
    0,
  );

  const activities = buildRepositoryActivities({
    repoContributions: repoContribs,
    locResults,
    viewerRepos: viewer.repositories,
    username: viewer.login,
    affiliatedOrgs: viewer.organizations,
  });

  const categories = calculateCategoryMetrics(activities);

  const repoLanguageMap = new Map<
    string,
    Array<{ name: string; color: string | null; size: number }>
  >();

  for (const r of viewer.repositories) {
    if (r.languages?.edges) {
      repoLanguageMap.set(
        r.nameWithOwner,
        r.languages.edges.map((e) => ({
          name: e.node.name,
          color: e.node.color,
          size: e.size,
        })),
      );
    }
  }

  for (const [name, loc] of locResults.entries()) {
    if (
      loc.languages &&
      loc.languages.length > 0 &&
      !repoLanguageMap.has(name)
    ) {
      repoLanguageMap.set(name, loc.languages);
    }
  }

  const weightedLangs = calculateWeightedLanguages(activities, repoLanguageMap);
  const finalLanguages =
    weightedLangs.length > 0
      ? weightedLangs
      : calculateLanguages(viewer.repositories, viewer.login, true);

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
    categories,
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
    pull_requests: prResult.summary,
    languages: finalLanguages,
    repositories_contributed_to: activities,
    daily_contributions: mergedDaily,
    weekly_summary: existing?.weekly_summary,
    monthly_history: existing?.monthly_history,
  };
}

export function printReport(stats: GitHubStatsOutput, mode: string): void {
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

  if (stats.categories) {
    console.log("\n🏷️ 2. CONTRIBUTION TIERS");
    console.log(
      `  - Personal:        ${stats.categories.personal.repositories_count} repos | ${stats.categories.personal.total_contributions} contribs (+${stats.categories.personal.additions}/-${stats.categories.personal.deletions} LOC)`,
    );
    console.log(
      `  - Organization:    ${stats.categories.organization.repositories_count} repos | ${stats.categories.organization.total_contributions} contribs (+${stats.categories.organization.additions}/-${stats.categories.organization.deletions} LOC)`,
    );
    console.log(
      `  - External OSS:    ${stats.categories.external_oss.repositories_count} repos | ${stats.categories.external_oss.total_contributions} contribs (+${stats.categories.external_oss.additions}/-${stats.categories.external_oss.deletions} LOC)`,
    );
  }

  console.log("\n💻 3. TOP 5 LANGUAGES");
  for (const lang of stats.languages.slice(0, 5)) {
    const bar = "█".repeat(Math.round(lang.percentage / 5));
    console.log(
      `  - ${lang.name.padEnd(14)} ${lang.percentage.toFixed(2).padStart(6)}% [${bar}] (${(lang.bytes / 1024).toFixed(1)} KB)`,
    );
  }

  console.log("\n📦 4. REPOSITORIES OWNED");
  console.log(
    `  - Total Owned:     ${stats.repositories.total_owned} (Public: ${stats.repositories.public}, Private: ${stats.repositories.private}, Forks: ${stats.repositories.forks})`,
  );
  console.log(`  - Total Stars:     ⭐ ${stats.repositories.total_stars}`);
  console.log(`  - Total Forks:     🍴 ${stats.repositories.total_forks}`);

  console.log("\n🔥 5. TOTAL CONTRIBUTIONS");
  console.log(
    `  - Grand Total:     ${stats.contributions.total.toLocaleString()}`,
  );
  console.log(
    `  - Breakdown:       ${stats.contributions.commits.toLocaleString()} commits, ${stats.contributions.pull_requests.toLocaleString()} PRs, ${stats.contributions.issues.toLocaleString()} issues, ${stats.contributions.reviews.toLocaleString()} reviews`,
  );

  console.log("\n🚀 6. TOP REPOSITORIES");
  console.log(
    `  - Distinct Repos:  ${stats.repositories_contributed_to.length} repositories`,
  );
  for (const repo of stats.repositories_contributed_to.slice(0, 8)) {
    const tag = `[${repo.tier}]`;
    console.log(
      `    • ${repo.repository.padEnd(32)} ${tag.padEnd(16)} +${repo.additions.toLocaleString()}/-${repo.deletions.toLocaleString()} LOC | ${repo.total_contributions} contribs (${repo.commits}c, ${repo.pull_requests}pr)`,
    );
  }

  console.log("\n📈 7. STREAKS & CONSISTENCY");
  console.log(
    `  - Longest Streak:  ${stats.streaks_and_consistency.longest_streak_days} days`,
  );
  console.log(
    `  - Current Streak:  ${stats.streaks_and_consistency.current_streak_days} days`,
  );
  console.log(
    `  - Active Days:     ${stats.streaks_and_consistency.active_days_count} / ${stats.streaks_and_consistency.total_days_in_period} days (${stats.streaks_and_consistency.activity_rate_percentage}%)`,
  );

  console.log("\n🔄 8. PULL REQUESTS");
  console.log(`  - Total Opened:    ${stats.pull_requests.total}`);
  console.log(
    `  - Merged:          ${stats.pull_requests.merged} (${stats.pull_requests.merge_rate_percentage}% merge rate)`,
  );

  console.log("\n💾 DATA FILE SAVED");
  console.log(`  ✔ data/github-stats.json`);
  console.log("======================================================\n");
}

export async function main() {
  const { dateRange, isIncremental, dataDir } = parseCliArgs();
  const filePath = path.join(dataDir, "github-stats.json");

  const viewer = await fetchViewerContext();
  let stats: GitHubStatsOutput;
  let mode: string;

  const existing = existsSync(filePath)
    ? (JSON.parse(readFileSync(filePath, "utf-8")) as GitHubStatsOutput)
    : undefined;

  if (isIncremental && existing) {
    stats = await executeIncremental(existing, dateRange, viewer);
    mode = "Incremental (Sunday → Saturday)";
  } else {
    stats = await executeFullBackfill(dateRange, viewer, existing);
    mode = "Full Historical (2021 → Date)";
  }

  mkdirSync(dataDir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(stats, null, 2), "utf-8");

  printReport(stats, mode);
}

if (process.argv[1] === import.meta.filename) {
  main().catch((err) => {
    console.error(
      "\n[FATAL ERROR]",
      err instanceof Error ? err.stack || err.message : err,
    );
    process.exit(1);
  });
}
