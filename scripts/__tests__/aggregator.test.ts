import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRepositoryActivities,
  calculateCategoryMetrics,
  calculateLanguages,
  calculateRepositorySummary,
  calculateStreaks,
  calculateWeightedLanguages,
  classifyRepoTier,
  type RepoActivityStat,
  type ViewerRepoNode,
} from "../fetch-github-stats.ts";

describe("classifyRepoTier", () => {
  const orgs = new Set(["pid7-org", "cloud-native"]);

  it("classifies personal repos accurately", () => {
    assert.equal(
      classifyRepoTier("adityamotale/adityamotale", "adityamotale", orgs),
      "personal",
    );
    assert.equal(
      classifyRepoTier("adityamotale/ocelot", "adityamotale", orgs),
      "personal",
    );
  });

  it("classifies organization repos accurately", () => {
    assert.equal(
      classifyRepoTier("pid7-org/turbofox", "adityamotale", orgs),
      "organization",
    );
    assert.equal(
      classifyRepoTier("cloud-native/specs", "adityamotale", orgs),
      "organization",
    );
  });

  it("classifies third-party / upstream repos as external_oss", () => {
    assert.equal(
      classifyRepoTier("torvalds/linux", "adityamotale", orgs),
      "external_oss",
    );
    assert.equal(
      classifyRepoTier("rust-lang/rust", "adityamotale", orgs),
      "external_oss",
    );
  });
});

describe("calculateCategoryMetrics", () => {
  it("aggregates contributions, commits, PRs, and LOC by tier", () => {
    const activities: RepoActivityStat[] = [
      {
        repository: "adityamotale/repo1",
        tier: "personal",
        is_private: false,
        is_fork: false,
        commits: 10,
        pull_requests: 2,
        issues: 1,
        reviews: 0,
        additions: 150,
        deletions: 50,
        net_lines: 100,
        total_contributions: 13,
      },
      {
        repository: "pid7-org/turbofox",
        tier: "organization",
        is_private: false,
        is_fork: false,
        commits: 25,
        pull_requests: 5,
        issues: 2,
        reviews: 4,
        additions: 500,
        deletions: 100,
        net_lines: 400,
        total_contributions: 36,
      },
      {
        repository: "upstream/project",
        tier: "external_oss",
        is_private: false,
        is_fork: true,
        commits: 2,
        pull_requests: 1,
        issues: 0,
        reviews: 0,
        additions: 20,
        deletions: 5,
        net_lines: 15,
        total_contributions: 3,
      },
    ];

    const metrics = calculateCategoryMetrics(activities);

    assert.equal(metrics.personal.repositories_count, 1);
    assert.equal(metrics.personal.commits, 10);
    assert.equal(metrics.personal.additions, 150);
    assert.equal(metrics.personal.net_lines, 100);
    assert.equal(metrics.personal.total_contributions, 13);

    assert.equal(metrics.organization.repositories_count, 1);
    assert.equal(metrics.organization.commits, 25);
    assert.equal(metrics.organization.total_contributions, 36);
    assert.equal(metrics.organization.net_lines, 400);

    assert.equal(metrics.external_oss.repositories_count, 1);
    assert.equal(metrics.external_oss.commits, 2);
    assert.equal(metrics.external_oss.total_contributions, 3);
  });
});

describe("calculateWeightedLanguages", () => {
  it("weights language distribution by contribution LOC across repos", () => {
    const activities: RepoActivityStat[] = [
      {
        repository: "user/c-project",
        tier: "personal",
        is_private: false,
        is_fork: false,
        commits: 10,
        pull_requests: 0,
        issues: 0,
        reviews: 0,
        additions: 1000,
        deletions: 200,
        net_lines: 800,
        total_contributions: 10,
      },
      {
        repository: "org/rust-core",
        tier: "organization",
        is_private: false,
        is_fork: false,
        commits: 20,
        pull_requests: 2,
        issues: 0,
        reviews: 0,
        additions: 3000,
        deletions: 500,
        net_lines: 2500,
        total_contributions: 22,
      },
    ];

    const repoLanguageMap = new Map([
      ["user/c-project", [{ name: "C", color: "#555555", size: 1000 }]],
      ["org/rust-core", [{ name: "Rust", color: "#dea584", size: 3000 }]],
    ]);

    const result = calculateWeightedLanguages(activities, repoLanguageMap);

    assert.equal(result.length, 2);
    assert.equal(result[0].name, "Rust");
    assert.equal(result[0].percentage, 75);
    assert.equal(result[1].name, "C");
    assert.equal(result[1].percentage, 25);
  });
});

describe("calculateLanguages", () => {
  it("aggregates bytes, calculates percentages, and sorts descending for owned repos", () => {
    const repos: ViewerRepoNode[] = [
      {
        nameWithOwner: "adityamotale/repo1",
        name: "repo1",
        isPrivate: false,
        isFork: false,
        stargazerCount: 0,
        forkCount: 0,
        owner: { login: "adityamotale" },
        languages: {
          edges: [
            { size: 600, node: { name: "Rust", color: "#dea584" } },
            { size: 400, node: { name: "TypeScript", color: "#3178c6" } },
          ],
        },
      },
      {
        nameWithOwner: "adityamotale/repo2",
        name: "repo2",
        isPrivate: true,
        isFork: false,
        stargazerCount: 0,
        forkCount: 0,
        owner: { login: "adityamotale" },
        languages: {
          edges: [{ size: 1000, node: { name: "Rust", color: null } }],
        },
      },
      {
        nameWithOwner: "otherorg/repo3",
        name: "repo3",
        isPrivate: false,
        isFork: false,
        stargazerCount: 10,
        forkCount: 2,
        owner: { login: "otherorg" },
        languages: {
          edges: [{ size: 5000, node: { name: "Go", color: "#00ADD8" } }],
        },
      },
    ];

    const result = calculateLanguages(repos, "adityamotale");

    assert.equal(result.length, 2);
    assert.equal(result[0].name, "Rust");
    assert.equal(result[0].bytes, 1600);
    assert.equal(result[0].percentage, 80);
    assert.equal(result[0].color, "#dea584");

    assert.equal(result[1].name, "TypeScript");
    assert.equal(result[1].bytes, 400);
    assert.equal(result[1].percentage, 20);
    assert.equal(result[1].color, "#3178c6");
  });

  it("handles zero total bytes and empty repositories without division by zero", () => {
    const emptyRepo: ViewerRepoNode = {
      nameWithOwner: "adityamotale/empty",
      name: "empty",
      isPrivate: false,
      isFork: false,
      stargazerCount: 0,
      forkCount: 0,
      owner: { login: "adityamotale" },
    };

    assert.deepEqual(calculateLanguages([], "adityamotale"), []);
    assert.deepEqual(calculateLanguages([emptyRepo], "adityamotale"), []);
  });

  it("excludes archived repositories from language calculations", () => {
    const repos: ViewerRepoNode[] = [
      {
        nameWithOwner: "adityamotale/active-repo",
        name: "active-repo",
        isPrivate: false,
        isFork: false,
        isArchived: false,
        stargazerCount: 0,
        forkCount: 0,
        owner: { login: "adityamotale" },
        languages: {
          edges: [{ size: 1000, node: { name: "Rust", color: "#dea584" } }],
        },
      },
      {
        nameWithOwner: "adityamotale/archived-repo",
        name: "archived-repo",
        isPrivate: false,
        isFork: false,
        isArchived: true,
        stargazerCount: 0,
        forkCount: 0,
        owner: { login: "adityamotale" },
        languages: {
          edges: [{ size: 5000, node: { name: "Go", color: "#00ADD8" } }],
        },
      },
    ];

    const result = calculateLanguages(repos, "adityamotale");
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Rust");
    assert.equal(result[0].percentage, 100);
  });
});

describe("calculateRepositorySummary", () => {
  it("correctly aggregates owned repository counts, stars, and forks", () => {
    const repos: ViewerRepoNode[] = [
      {
        nameWithOwner: "adityamotale/public-repo",
        name: "public-repo",
        isPrivate: false,
        isFork: false,
        stargazerCount: 5,
        forkCount: 2,
        owner: { login: "adityamotale" },
      },
      {
        nameWithOwner: "adityamotale/private-repo",
        name: "private-repo",
        isPrivate: true,
        isFork: false,
        stargazerCount: 0,
        forkCount: 0,
        owner: { login: "adityamotale" },
      },
      {
        nameWithOwner: "adityamotale/forked-repo",
        name: "forked-repo",
        isPrivate: false,
        isFork: true,
        stargazerCount: 1,
        forkCount: 3,
        owner: { login: "adityamotale" },
      },
      {
        nameWithOwner: "org/not-owned",
        name: "not-owned",
        isPrivate: false,
        isFork: false,
        stargazerCount: 100,
        forkCount: 50,
        owner: { login: "org" },
      },
    ];

    const result = calculateRepositorySummary(repos, "adityamotale");

    assert.equal(result.total_owned, 3);
    assert.equal(result.public, 2);
    assert.equal(result.private, 1);
    assert.equal(result.forks, 1);
    assert.equal(result.total_stars, 6);
    assert.equal(result.total_forks, 5);
  });

  it("excludes archived repositories from repository summary", () => {
    const repos: ViewerRepoNode[] = [
      {
        nameWithOwner: "adityamotale/active",
        name: "active",
        isPrivate: false,
        isFork: false,
        isArchived: false,
        stargazerCount: 10,
        forkCount: 2,
        owner: { login: "adityamotale" },
      },
      {
        nameWithOwner: "adityamotale/archived",
        name: "archived",
        isPrivate: false,
        isFork: false,
        isArchived: true,
        stargazerCount: 50,
        forkCount: 10,
        owner: { login: "adityamotale" },
      },
    ];

    const result = calculateRepositorySummary(repos, "adityamotale");
    assert.equal(result.total_owned, 1);
    assert.equal(result.public, 1);
    assert.equal(result.total_stars, 10);
  });
});

describe("calculateStreaks", () => {
  it("accurately computes streaks, active days, and busiest day", () => {
    const daily = {
      "2026-09-01": 2,
      "2026-09-02": 5,
      "2026-09-03": 10,
      "2026-09-04": 0,
      "2026-09-05": 1,
      "2026-09-06": 3,
    };

    const dateRange = {
      from: "2026-09-01T00:00:00Z",
      to: "2026-09-06T23:59:59Z",
    };

    const result = calculateStreaks(daily, dateRange);

    assert.equal(result.longest_streak_days, 3);
    assert.equal(result.current_streak_days, 2);
    assert.equal(result.active_days_count, 5);
    assert.equal(result.total_days_in_period, 6);
    assert.equal(result.activity_rate_percentage, 83.33);
    assert.deepEqual(result.busiest_day, { date: "2026-09-03", count: 10 });
  });

  it("resets current streak to 0 if the latest day in period has zero contributions", () => {
    const daily = {
      "2026-09-01": 5,
      "2026-09-02": 8,
      "2026-09-03": 0,
    };

    const result = calculateStreaks(daily, {
      from: "2026-09-01T00:00:00Z",
      to: "2026-09-03T23:59:59Z",
    });

    assert.equal(result.longest_streak_days, 2);
    assert.equal(result.current_streak_days, 0);
  });

  it("handles completely inactive periods safely", () => {
    const daily = {
      "2026-01-01": 0,
      "2026-01-02": 0,
    };

    const result = calculateStreaks(daily, {
      from: "2026-01-01T00:00:00Z",
      to: "2026-01-02T23:59:59Z",
    });

    assert.equal(result.longest_streak_days, 0);
    assert.equal(result.current_streak_days, 0);
    assert.equal(result.active_days_count, 0);
    assert.equal(result.activity_rate_percentage, 0);
    assert.deepEqual(result.busiest_day, { date: "", count: 0 });
  });

  it("sorts chronological order even if keys are unordered", () => {
    const daily = {
      "2026-01-03": 1,
      "2026-01-01": 1,
      "2026-01-02": 1,
    };

    const result = calculateStreaks(daily, {
      from: "2026-01-01T00:00:00Z",
      to: "2026-01-03T23:59:59Z",
    });

    assert.equal(result.longest_streak_days, 3);
    assert.equal(result.current_streak_days, 3);
  });
});

describe("buildRepositoryActivities", () => {
  it("unifies contributions and LOC records into non-duplicated items with tier classification", () => {
    const repoContributions = new Map([
      [
        "user/repo-a",
        {
          commits: 10,
          issues: 2,
          pullRequests: 1,
          reviews: 0,
          isPrivate: false,
        },
      ],
      [
        "org/repo-b",
        { commits: 5, issues: 0, pullRequests: 0, reviews: 1, isPrivate: true },
      ],
    ]);

    const locResults = new Map([
      [
        "user/repo-a",
        {
          repository: "user/repo-a",
          is_private: false,
          is_fork: false,
          additions: 200,
          deletions: 50,
          commit_count: 8,
        },
      ],
      [
        "external/repo-c",
        {
          repository: "external/repo-c",
          is_private: false,
          is_fork: true,
          additions: 50,
          deletions: 10,
          commit_count: 2,
        },
      ],
    ]);

    const viewerRepos: ViewerRepoNode[] = [
      {
        nameWithOwner: "user/repo-a",
        name: "repo-a",
        isPrivate: false,
        isFork: false,
        stargazerCount: 0,
        forkCount: 0,
        owner: { login: "user" },
      },
      {
        nameWithOwner: "org/repo-b",
        name: "repo-b",
        isPrivate: true,
        isFork: false,
        stargazerCount: 0,
        forkCount: 0,
        owner: { login: "org" },
      },
      {
        nameWithOwner: "external/repo-c",
        name: "repo-c",
        isPrivate: false,
        isFork: true,
        stargazerCount: 0,
        forkCount: 0,
        owner: { login: "external" },
      },
    ];

    const result = buildRepositoryActivities({
      repoContributions,
      locResults,
      viewerRepos,
      username: "user",
      affiliatedOrgs: new Set(["org"]),
    });

    assert.equal(result.length, 3);

    const repoA = result.find((r) => r.repository === "user/repo-a")!;
    assert.equal(repoA.tier, "personal");
    assert.equal(repoA.commits, 10);
    assert.equal(repoA.issues, 2);
    assert.equal(repoA.pull_requests, 1);
    assert.equal(repoA.additions, 200);
    assert.equal(repoA.deletions, 50);
    assert.equal(repoA.net_lines, 150);
    assert.equal(repoA.total_contributions, 13);
    assert.equal(repoA.is_private, false);

    const repoB = result.find((r) => r.repository === "org/repo-b")!;
    assert.equal(repoB.tier, "organization");
    assert.equal(repoB.commits, 5);
    assert.equal(repoB.additions, 0);
    assert.equal(repoB.deletions, 0);
    assert.equal(repoB.total_contributions, 6);
    assert.equal(repoB.is_private, true);

    const repoC = result.find((r) => r.repository === "external/repo-c")!;
    assert.equal(repoC.tier, "external_oss");
    assert.equal(repoC.commits, 2);
    assert.equal(repoC.additions, 50);
    assert.equal(repoC.deletions, 10);
    assert.equal(repoC.net_lines, 40);
    assert.equal(repoC.total_contributions, 2);
    assert.equal(repoC.is_fork, true);

    assert.equal(result[0].repository, "user/repo-a");
    assert.equal(result[1].repository, "org/repo-b");
    assert.equal(result[2].repository, "external/repo-c");
  });

  it("correctly calculates negative net lines when deletions exceed additions", () => {
    const locResults = new Map([
      [
        "user/refactor-repo",
        {
          repository: "user/refactor-repo",
          is_private: false,
          is_fork: false,
          additions: 30,
          deletions: 120,
          commit_count: 3,
        },
      ],
    ]);

    const result = buildRepositoryActivities({
      repoContributions: new Map(),
      locResults,
      viewerRepos: [],
      username: "user",
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].net_lines, -90);
    assert.equal(result[0].additions, 30);
    assert.equal(result[0].deletions, 120);
    assert.equal(result[0].tier, "personal");
  });

  it("excludes archived repositories from repository activities", () => {
    const repoContributions = new Map([
      [
        "user/active-repo",
        {
          commits: 5,
          issues: 0,
          pullRequests: 0,
          reviews: 0,
          isPrivate: false,
          isArchived: false,
        },
      ],
      [
        "user/archived-repo",
        {
          commits: 15,
          issues: 2,
          pullRequests: 1,
          reviews: 0,
          isPrivate: false,
          isArchived: true,
        },
      ],
    ]);

    const result = buildRepositoryActivities({
      repoContributions,
      locResults: new Map(),
      viewerRepos: [
        {
          nameWithOwner: "user/archived-repo",
          name: "archived-repo",
          isPrivate: false,
          isFork: false,
          isArchived: true,
          stargazerCount: 0,
          forkCount: 0,
          owner: { login: "user" },
        },
      ],
      username: "user",
    });

    assert.equal(result.length, 1);
    assert.equal(result[0].repository, "user/active-repo");
  });
});
