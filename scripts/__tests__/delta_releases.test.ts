import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractReleases,
  mergeWeeklyDelta,
  type GitHubStatsOutput,
  type PeriodMetrics,
  type RepoActivityStat,
  type ViewerRepoNode,
} from "../fetch-github-stats.ts";

describe("extractReleases", () => {
  it("extracts, deduplicates, and sorts releases newest first", () => {
    const viewerRepos: ViewerRepoNode[] = [
      {
        nameWithOwner: "adityamotale/app",
        name: "app",
        isPrivate: false,
        isFork: false,
        isArchived: false,
        stargazerCount: 10,
        forkCount: 2,
        owner: { login: "adityamotale" },
        latestRelease: {
          tagName: "v1.0.0",
          name: "Initial Release",
          publishedAt: "2026-05-01T12:00:00Z",
          url: "https://github.com/adityamotale/app/releases/tag/v1.0.0",
        },
      },
      {
        nameWithOwner: "pid7-org/turbofox",
        name: "turbofox",
        isPrivate: false,
        isFork: false,
        isArchived: false,
        stargazerCount: 50,
        forkCount: 5,
        owner: { login: "pid7-org" },
        latestRelease: {
          tagName: "v0.4.0",
          name: "Engine Update",
          publishedAt: "2026-09-15T18:00:00Z",
          url: "https://github.com/pid7-org/turbofox/releases/tag/v0.4.0",
        },
      },
    ];

    const activities: RepoActivityStat[] = [
      {
        repository: "adityamotale/app",
        tier: "personal",
        is_private: false,
        is_fork: false,
        commits: 5,
        pull_requests: 1,
        issues: 0,
        reviews: 0,
        additions: 100,
        deletions: 20,
        net_lines: 80,
        total_contributions: 6,
        latest_release: {
          tag_name: "v1.0.0",
          title: "Initial Release",
          published_at: "2026-05-01T12:00:00Z",
        },
      },
      {
        repository: "pid7-org/kosa",
        tier: "organization",
        is_private: false,
        is_fork: false,
        commits: 12,
        pull_requests: 2,
        issues: 0,
        reviews: 1,
        additions: 300,
        deletions: 50,
        net_lines: 250,
        total_contributions: 15,
        latest_release: {
          tag_name: "v0.1.2",
          title: "Patch 2",
          published_at: "2026-08-10T10:00:00Z",
          url: "https://github.com/pid7-org/kosa/releases/tag/v0.1.2",
        },
      },
    ];

    const releases = extractReleases(viewerRepos, activities);

    assert.equal(releases.length, 3);
    assert.equal(releases[0].repo, "pid7-org/turbofox");
    assert.equal(releases[0].tag_name, "v0.4.0");
    assert.equal(releases[1].repo, "pid7-org/kosa");
    assert.equal(releases[1].tag_name, "v0.1.2");
    assert.equal(releases[2].repo, "adityamotale/app");
    assert.equal(releases[2].tag_name, "v1.0.0");
  });
});

describe("mergeWeeklyDelta", () => {
  it("merges incremental weekly delta into cumulative lifetime totals", () => {
    const existing: GitHubStatsOutput = {
      generated_at: "2026-09-12T00:00:00Z",
      period: { from: "2021-01-01T00:00:00Z", to: "2026-09-12T23:59:59Z" },
      user: { login: "adityamotale", name: "Aditya Motale" },
      categories: {
        personal: {
          repositories_count: 1,
          commits: 100,
          pull_requests: 10,
          issues: 2,
          reviews: 0,
          additions: 5000,
          deletions: 1000,
          net_lines: 4000,
          total_contributions: 112,
        },
        organization: {
          repositories_count: 1,
          commits: 200,
          pull_requests: 20,
          issues: 5,
          reviews: 10,
          additions: 15000,
          deletions: 3000,
          net_lines: 12000,
          total_contributions: 235,
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
      },
      contributions: {
        total: 347,
        commits: 300,
        pull_requests: 30,
        reviews: 10,
        issues: 7,
        public: 347,
        private: 0,
      },
      lines_of_code: {
        total_additions: 20000,
        total_deletions: 4000,
        net_lines: 16000,
      },
      repositories: {
        total: 2,
        public: 2,
        private: 0,
        org: 1,
        total_stars: 20,
        total_forks: 5,
      },
      pull_requests: {
        total: 30,
        merged: 27,
        closed_unmerged: 3,
        open: 0,
        merge_rate_percentage: 90.0,
      },
      streaks_and_consistency: {
        longest_streak_days: 14,
        current_streak_days: 5,
        active_days_count: 120,
        total_days_in_period: 2000,
        activity_rate_percentage: 60.0,
        busiest_day: { date: "2026-08-01", count: 25 },
      },
      languages: [
        { name: "Rust", color: "#dea584", loc: 12000, percentage: 75.0 },
        { name: "TypeScript", color: "#3178c6", loc: 4000, percentage: 25.0 },
      ],
      repositories_contributed_to: [
        {
          repository: "adityamotale/app",
          tier: "personal",
          is_private: false,
          is_fork: false,
          commits: 100,
          pull_requests: 10,
          issues: 2,
          reviews: 0,
          additions: 5000,
          deletions: 1000,
          net_lines: 4000,
          total_contributions: 112,
          languages: [
            {
              name: "TypeScript",
              color: "#3178c6",
              bytes: 10000,
              percentage: 100,
            },
          ],
        },
        {
          repository: "pid7-org/turbofox",
          tier: "organization",
          is_private: false,
          is_fork: false,
          commits: 200,
          pull_requests: 20,
          issues: 5,
          reviews: 10,
          additions: 15000,
          deletions: 3000,
          net_lines: 12000,
          total_contributions: 235,
          languages: [
            { name: "Rust", color: "#dea584", bytes: 50000, percentage: 100 },
          ],
        },
      ],
      releases: [],
      monthly_history: [],
    };

    const windowMetrics: PeriodMetrics = {
      period: { from: "2026-09-13T00:00:00Z", to: "2026-09-19T23:59:59Z" },
      commits: 15,
      lines_of_code: {
        total_additions: 1200,
        total_deletions: 200,
        net_lines: 1000,
      },
      pull_requests: {
        total: 2,
        merged: 2,
        closed_unmerged: 0,
        open: 0,
        merge_rate_percentage: 100.0,
      },
      streaks_and_consistency: {
        longest_streak_days: 6,
        current_streak_days: 6,
        active_days_count: 6,
        total_days_in_period: 7,
        activity_rate_percentage: 85.71,
        busiest_day: { date: "2026-09-15", count: 8 },
      },
      languages: [],
    };

    const windowActivities: RepoActivityStat[] = [
      {
        repository: "pid7-org/turbofox",
        tier: "organization",
        is_private: false,
        is_fork: false,
        commits: 15,
        pull_requests: 2,
        issues: 0,
        reviews: 1,
        additions: 1200,
        deletions: 200,
        net_lines: 1000,
        total_contributions: 18,
      },
    ];

    const result = mergeWeeklyDelta({
      existing,
      windowMetrics,
      windowActivities,
      newReleases: [
        {
          repo: "pid7-org/turbofox",
          tag_name: "v0.5.0",
          title: "Turbofox 0.5.0",
          published_at: "2026-09-18T10:00:00Z",
          url: "https://github.com/pid7-org/turbofox/releases/tag/v0.5.0",
        },
      ],
    });

    assert.equal(result.lines_of_code.total_additions, 21200);
    assert.equal(result.lines_of_code.total_deletions, 4200);
    assert.equal(result.lines_of_code.net_lines, 17000);
    assert.equal(result.contributions.commits, 315);
    assert.equal(result.contributions.pull_requests, 32);
    assert.equal(result.pull_requests.merged, 29);
    assert.equal(result.categories.organization.commits, 215);
    assert.equal(result.categories.organization.net_lines, 13000);
    assert.equal(result.monthly_history?.length, 1);
    assert.equal(result.monthly_history?.[0].commits, 15);
    assert.equal(result.weekly_summary?.commits, 15);
    assert.equal(result.releases?.length, 1);
    assert.equal(result.releases?.[0].tag_name, "v0.5.0");
  });
});
