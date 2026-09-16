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

export interface RepoActivityStat {
  repository: string;
  is_private: boolean;
  is_fork: boolean;
  commits: number;
  pull_requests: number;
  issues: number;
  reviews: number;
  additions: number;
  deletions: number;
  net_lines: number;
  total_contributions: number;
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
  languages: LanguageStat[];
  repositories: RepositorySummary;
  contributions: ContributionBreakdown;
  streaks_and_consistency: StreaksAndConsistency;
  pull_requests: PullRequestSummary;
  repositories_contributed_to: RepoActivityStat[];
  daily_contributions: Record<string, number>;
}
