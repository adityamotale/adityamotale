import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  calculateCategoryMetrics,
  calculateLanguages,
  calculateRepositorySummary,
  calculateStreaks,
  classifyRepoTier,
  getSundayToSaturdayWindow,
  type GitHubStatsOutput,
  type RepoActivityStat,
  type ViewerRepoNode,
} from "../fetch-github-stats.ts";

describe("GitHub Stats Engine Integration & Schema Verification", () => {
  it("generates a complete schema conforming to GitHubStatsOutput", () => {
    const viewerRepos: ViewerRepoNode[] = [
      {
        nameWithOwner: "adityamotale/adityamotale",
        name: "adityamotale",
        isPrivate: false,
        isFork: false,
        stargazerCount: 15,
        forkCount: 3,
        owner: { login: "adityamotale" },
        languages: {
          edges: [
            { size: 5000, node: { name: "TypeScript", color: "#3178c6" } },
            { size: 2000, node: { name: "Rust", color: "#dea584" } },
          ],
        },
      },
      {
        nameWithOwner: "pid7-org/turbofox",
        name: "turbofox",
        isPrivate: false,
        isFork: false,
        stargazerCount: 42,
        forkCount: 7,
        owner: { login: "pid7-org" },
        languages: {
          edges: [{ size: 12000, node: { name: "Rust", color: "#dea584" } }],
        },
      },
    ];

    const activities: RepoActivityStat[] = [
      {
        repository: "adityamotale/adityamotale",
        tier: classifyRepoTier(
          "adityamotale/adityamotale",
          "adityamotale",
          new Set(["pid7-org"]),
        ),
        is_private: false,
        is_fork: false,
        description: "profile readme and portfolio",
        commits: 50,
        pull_requests: 5,
        issues: 2,
        reviews: 0,
        additions: 1200,
        deletions: 300,
        net_lines: 900,
        total_contributions: 57,
      },
      {
        repository: "pid7-org/turbofox",
        tier: classifyRepoTier(
          "pid7-org/turbofox",
          "adityamotale",
          new Set(["pid7-org"]),
        ),
        is_private: false,
        is_fork: false,
        description: "high performance database engine",
        commits: 120,
        pull_requests: 15,
        issues: 5,
        reviews: 8,
        additions: 8500,
        deletions: 1500,
        net_lines: 7000,
        total_contributions: 148,
      },
      {
        repository: "external/hyper-fast",
        tier: classifyRepoTier(
          "external/hyper-fast",
          "adityamotale",
          new Set(["pid7-org"]),
        ),
        is_private: false,
        is_fork: true,
        description: "upstream SIMD utilities",
        commits: 4,
        pull_requests: 2,
        issues: 0,
        reviews: 1,
        additions: 300,
        deletions: 50,
        net_lines: 250,
        total_contributions: 7,
      },
    ];

    const dailyContributions: Record<string, number> = {
      "2026-09-10": 4,
      "2026-09-11": 8,
      "2026-09-12": 15,
      "2026-09-13": 0,
      "2026-09-14": 6,
      "2026-09-15": 10,
    };

    const period = {
      from: "2026-09-10T00:00:00Z",
      to: "2026-09-15T23:59:59Z",
    };

    const categories = calculateCategoryMetrics(activities);
    const reposSummary = calculateRepositorySummary(
      viewerRepos,
      "adityamotale",
    );
    const languages = calculateLanguages(viewerRepos, "adityamotale");
    const streaks = calculateStreaks(dailyContributions, period);

    const fullStats: GitHubStatsOutput = {
      metadata: {
        username: "adityamotale",
        generated_at: new Date().toISOString(),
        period,
      },
      lines_of_code: {
        total_additions: 10000,
        total_deletions: 1850,
        net_lines: 8150,
      },
      categories,
      repositories: reposSummary,
      contributions: {
        total: 212,
        commits: 174,
        pull_requests: 22,
        issues: 7,
        reviews: 9,
        public: 212,
        private: 0,
      },
      streaks_and_consistency: streaks,
      pull_requests: {
        total: 22,
        merged: 20,
        open: 1,
        closed_unmerged: 1,
        merge_rate_percentage: 90.91,
      },
      languages,
      repositories_contributed_to: activities,
      daily_contributions: dailyContributions,
    };

    assert.equal(fullStats.categories.personal.repositories_count, 1);
    assert.equal(fullStats.categories.organization.repositories_count, 1);
    assert.equal(fullStats.categories.external_oss.repositories_count, 1);

    assert.equal(fullStats.categories.personal.commits, 50);
    assert.equal(fullStats.categories.organization.commits, 120);
    assert.equal(fullStats.categories.external_oss.commits, 4);

    assert.equal(fullStats.repositories_contributed_to[0].tier, "personal");
    assert.equal(fullStats.repositories_contributed_to[1].tier, "organization");
    assert.equal(fullStats.repositories_contributed_to[2].tier, "external_oss");

    assert.ok(fullStats.lines_of_code.total_additions > 0);
    assert.ok(fullStats.lines_of_code.total_deletions > 0);
    assert.equal(
      fullStats.lines_of_code.net_lines,
      fullStats.lines_of_code.total_additions -
        fullStats.lines_of_code.total_deletions,
    );
  });

  it("safely handles file serialization and deserialization in a test directory", () => {
    const tmpDir = path.join(
      process.cwd(),
      "scripts",
      "__tests__",
      ".tmp-test-data",
    );
    mkdirSync(tmpDir, { recursive: true });
    const targetFile = path.join(tmpDir, "github-stats.json");

    const payload: GitHubStatsOutput = {
      metadata: {
        username: "testuser",
        generated_at: "2026-09-20T00:00:00Z",
        period: {
          from: "2026-01-01T00:00:00Z",
          to: "2026-09-20T23:59:59Z",
        },
      },
      lines_of_code: {
        total_additions: 500,
        total_deletions: 100,
        net_lines: 400,
      },
      categories: {
        personal: {
          repositories_count: 1,
          commits: 10,
          pull_requests: 1,
          issues: 0,
          reviews: 0,
          additions: 500,
          deletions: 100,
          net_lines: 400,
          total_contributions: 11,
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
      },
      repositories: {
        total_owned: 1,
        public: 1,
        private: 0,
        forks: 0,
        total_stars: 2,
        total_forks: 0,
      },
      contributions: {
        total: 11,
        commits: 10,
        pull_requests: 1,
        issues: 0,
        reviews: 0,
        public: 11,
        private: 0,
      },
      streaks_and_consistency: {
        longest_streak_days: 2,
        current_streak_days: 1,
        active_days_count: 2,
        total_days_in_period: 2,
        activity_rate_percentage: 100,
        busiest_day: { date: "2026-09-19", count: 8 },
      },
      pull_requests: {
        total: 1,
        merged: 1,
        open: 0,
        closed_unmerged: 0,
        merge_rate_percentage: 100,
      },
      languages: [
        { name: "Rust", color: "#dea584", bytes: 1000, percentage: 100 },
      ],
      repositories_contributed_to: [
        {
          repository: "testuser/testrepo",
          tier: "personal",
          is_private: false,
          is_fork: false,
          description: "test repo",
          commits: 10,
          pull_requests: 1,
          issues: 0,
          reviews: 0,
          additions: 500,
          deletions: 100,
          net_lines: 400,
          total_contributions: 11,
        },
      ],
      daily_contributions: {
        "2026-09-19": 8,
        "2026-09-20": 3,
      },
    };

    writeFileSync(targetFile, JSON.stringify(payload, null, 2), "utf-8");
    assert.ok(existsSync(targetFile));

    const readBack = JSON.parse(
      readFileSync(targetFile, "utf-8"),
    ) as GitHubStatsOutput;
    assert.equal(readBack.metadata.username, "testuser");
    assert.equal(readBack.categories.personal.commits, 10);
    assert.equal(readBack.repositories_contributed_to[0].tier, "personal");

    rmSync(tmpDir, { recursive: true, force: true });
    assert.ok(!existsSync(tmpDir));
  });
});
