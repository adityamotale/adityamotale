export type RepoTier = "personal" | "organization" | "external_oss";

export interface DateRange {
  from: string;
  to: string;
}

export interface LanguageStat {
  name: string;
  color: string | null;
  bytes?: number;
  loc?: number;
  percentage: number;
}

export interface LanguageItem {
  name: string;
  color?: string | null;
  bytes?: number;
  percentage: number;
}

export interface TierMetrics {
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

export type CategoryMetrics = TierMetrics;

export interface Categories {
  personal: TierMetrics;
  organization: TierMetrics;
  external_oss: TierMetrics;
}

export interface ReleaseItem {
  repo: string;
  tag_name: string;
  title: string | null;
  published_at: string;
  url: string;
}

export interface RepoActivityStat {
  repository: string;
  tier: RepoTier;
  is_private: boolean;
  is_fork: boolean;
  is_archived?: boolean;
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
  primary_language?: { name: string; color: string | null } | null;
  latest_release?: {
    tag_name: string;
    title?: string | null;
    published_at: string;
    url?: string | null;
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
  closed_unmerged: number;
  open: number;
  merge_rate_percentage: number;
}

export interface RepositorySummary {
  total: number;
  public: number;
  private: number;
  org: number;
  total_stars: number;
  total_forks: number;
}

export interface ContributionBreakdown {
  total: number;
  commits: number;
  pull_requests: number;
  reviews: number;
  issues: number;
  public: number;
  private: number;
}

export interface LinesOfCodeSummary {
  total_additions: number;
  total_deletions: number;
  net_lines: number;
}

export interface PeriodMetrics {
  period: DateRange;
  commits: number;
  lines_of_code: LinesOfCodeSummary;
  pull_requests: PullRequestSummary;
  repositories?: {
    total: number;
    public: number;
    private: number;
    org: number;
  };
  streaks_and_consistency: StreaksAndConsistency;
  languages?: LanguageStat[];
}

export interface MonthlyStatItem extends PeriodMetrics {
  label: string;
  month: number;
}

export interface GitHubStatsOutput {
  generated_at: string;
  period: DateRange;
  user: {
    login: string;
    name?: string | null;
  };
  categories: Categories;
  contributions: ContributionBreakdown;
  lines_of_code: LinesOfCodeSummary;
  repositories: RepositorySummary;
  pull_requests: PullRequestSummary;
  streaks_and_consistency: StreaksAndConsistency;
  languages: LanguageStat[];
  repositories_contributed_to: RepoActivityStat[];
  releases?: ReleaseItem[];
  monthly_history?: MonthlyStatItem[];
  weekly_summary?: PeriodMetrics;
}

export interface ViewerRepoNode {
  nameWithOwner: string;
  name: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  description: string | null;
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
    name?: string | null;
    publishedAt: string;
    url?: string | null;
  } | null;
}

export interface ViewerContext {
  id: string;
  login: string;
  name: string | null;
  organizations: Set<string>;
  allRepos: ViewerRepoNode[];
}

export interface RepoContribDelta {
  commits: number;
  pullRequests: number;
  issues: number;
  reviews: number;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
}

export interface WindowContributions {
  totalCommits: number;
  totalPRs: number;
  totalIssues: number;
  totalReviews: number;
  repos: Map<string, RepoContribDelta>;
  daily: Record<string, number>;
}

export interface RepoLocStat {
  repository: string;
  is_private: boolean;
  is_fork: boolean;
  additions: number;
  deletions: number;
  commit_count: number;
  languages?: Array<{
    name: string;
    color: string | null;
    size: number;
  }>;
}

export interface GraphQLOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}
